"use client";

/**
 * useWhiteboardSync
 *
 * Manages real-time Excalidraw collaboration over a LiveKit DataChannel and
 * implements the host-controlled whiteboard permission system.
 *
 * ── Architecture ───────────────────────────────────────────────────────────────
 *
 * ONE instance of this hook lives in RoomContent for the lifetime of the room.
 * excalidrawApiRef, isRemoteUpdateRef, and handleLocalChange are passed as props
 * down to WhiteboardCanvas so there is never a second DataChannel subscription.
 *
 * ── Synchronization model ─────────────────────────────────────────────────────
 *
 * The system is PULL-BASED for initial state:
 *
 *   1. On hook mount: broadcast `request-sync` so the host delivers the current
 *      scene + visibility + controllers in a single `full-sync` response.
 *
 *   2. When the participant's whiteboard panel opens (triggered by host broadcast
 *      or manual button): re-send `request-sync` targeted at the host so the
 *      fresh scene is applied immediately to the newly-mounted Excalidraw instance.
 *
 *   3. Host push: the host broadcasts `whiteboard-visibility` and
 *      `whiteboard-permissions` whenever they change.  Participants react to
 *      these in real time.
 *
 * This pull-based approach eliminates the race where a participant's DataChannel
 * subscription is not yet active when the host first pushes visibility state.
 *
 * ── Security ──────────────────────────────────────────────────────────────────
 *
 * - `whiteboard-visibility` and `whiteboard-permissions` are only accepted from
 *   the designated host identity.  Participants cannot spoof these messages.
 * - `scene-update` is only applied if the sender is the host or in the
 *   current controllers set.
 *
 * ── First-stroke bug fix ───────────────────────────────────────────────────────
 *
 * `scene-update` carries only elements + files, never appState.  Applying remote
 * appState mid-draw resets cursorButton / activeTool / viewport, causing the
 * first stroke to be cancelled.  `full-sync` carries a serializable appState
 * subset ONLY for the initial scene load of a newly-joined participant.
 * All remote updateScene() calls use captureUpdate: "NEVER" to suppress undo
 * stack pollution and internal state resets.  The isRemoteUpdateRef guard is
 * cleared with setTimeout(0) — a macrotask — to outlive React 18's concurrent
 * renderer scheduling.
 *
 * ── Re-sync design ────────────────────────────────────────────────────────────
 *
 * Every `request-sync` message is answered unconditionally — there is no
 * per-requester deduplication.  The original `respondedToRef` guard was intended
 * to prevent a flood of responses when many participants join simultaneously, but
 * it was fundamentally broken: `requestResync()` (called when a participant
 * reopens the whiteboard panel) deleted the identity from the *local* node's
 * `respondedToRef`, not from the *host's* — so the host's guard was never
 * cleared and the participant's re-sync request was permanently silenced.
 *
 * Storm prevention is handled instead by the jitter delay (up to 300 ms) that
 * already exists on each response — responses from multiple nodes are naturally
 * spread over time, and the participant applies only the last `full-sync` it
 * receives anyway (pendingFullSyncRef is overwritten, not appended).
 */

import { useCallback, useEffect, useRef, useState, useLayoutEffect } from "react";
import type React from "react";
import { useDataChannel, useLocalParticipant } from "@livekit/components-react";
import type { ReceivedDataMessage } from "@livekit/components-core";
import type { DataPublishOptions } from "livekit-client";
import type {
  ExcalidrawImperativeAPI,
  WhiteboardMessage,
  WhiteboardScene,
  WhiteboardSceneData,
  WhiteboardElementsUpdate,
} from "@/types/whiteboard";
import {
  sceneToFullData,
  sceneToUpdate,
  serializeMessage,
  deserializeMessage,
} from "@/lib/whiteboard/serializer";
import { getSceneVersion } from "@/utils/whiteboard";

const WHITEBOARD_TOPIC = "whiteboard" as const;
const DEBOUNCE_MS = 250;
const SYNC_RESPONSE_JITTER_MS = 300;

// ── Empty scene constant — used when the host hasn't drawn anything yet ────────
const EMPTY_SCENE: WhiteboardSceneData = {
  elements: [],
  appState: {
    viewBackgroundColor: "#ffffff",
    currentItemStrokeColor: "#000000",
    currentItemBackgroundColor: "transparent",
    currentItemFillStyle: "hachure",
    currentItemStrokeWidth: 1,
    currentItemStrokeStyle: "solid",
    currentItemRoughness: 1,
    currentItemOpacity: 100,
    currentItemFontFamily: 1,
    currentItemFontSize: 20,
    currentItemTextAlign: "left",
    currentItemStartArrowhead: null,
    currentItemEndArrowhead: "arrow",
    zoom: { value: 1 },
    scrollX: 0,
    scrollY: 0,
    theme: "dark",
  },
  files: {},
};

export interface UseWhiteboardSyncReturn {
  handleLocalChange: (scene: WhiteboardScene) => void;
  excalidrawApiRef: React.RefObject<ExcalidrawImperativeAPI | null>;

  // ── Participant-side reactive state ───────────────────────────────────────
  /** Whether the whiteboard is open (driven by host broadcasts + full-sync). */
  whiteboardOpen: boolean;
  /** Whether the annotation overlay is active (driven by host broadcasts + full-sync). */
  annotationActive: boolean;
  /** Identities with explicit drawing permission (host excluded). */
  controllers: ReadonlySet<string>;

  // ── Host-side actions ─────────────────────────────────────────────────────
  broadcastVisibility: (open: boolean) => void;
  broadcastAnnotationState: (active: boolean) => void;
  broadcastPermissions: (controllers: string[]) => void;
  /** Sync the internal controllers ref without broadcasting (for request-sync responses). */
  syncControllersRef: (controllers: string[]) => void;

  /**
   * Re-request the current scene from the host.
   * Called by RoomContent when the whiteboard panel is newly opened for a
   * participant so the freshly-mounted Excalidraw gets the latest scene even if
   * the initial mount-time request-sync was sent long before the panel opened.
   */
  requestResync: () => void;
}

export function useWhiteboardSync(
  hostIdentity: string | undefined,
  isHost: boolean,
  hostWhiteboardOpenRef?: React.RefObject<boolean>,
  hostAnnotationActiveRef?: React.RefObject<boolean>
): UseWhiteboardSyncReturn {
  const { localParticipant } = useLocalParticipant();

  // ── Refs ───────────────────────────────────────────────────────────────────

  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const lastSyncedVersionRef = useRef<number>(0);
  const lastLocalSceneRef = useRef<{
    full: WhiteboardSceneData;
    update: WhiteboardElementsUpdate;
  } | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // sendRef is intentionally typed as a mutable ref that starts null and is
  // populated synchronously on the first render from useDataChannel's send.
  // Using a ref rather than a state value avoids triggering re-renders when
  // the send function identity changes (e.g. after a reconnect).
  const sendRef = useRef<
    ((payload: Uint8Array, options: DataPublishOptions) => Promise<void>) | null
  >(null);

  /**
   * Queue for incoming scene-updates that arrive before the Excalidraw instance
   * is ready (excalidrawApiRef.current is null).  Flushed as soon as the API
   * becomes available via the polled effect below.
   */
  const pendingUpdatesRef = useRef<WhiteboardElementsUpdate[]>([]);
  const pendingFullSyncRef = useRef<WhiteboardSceneData | null>(null);

  const localIdentityRef = useRef<string | undefined>(localParticipant?.identity);
  useEffect(() => {
    localIdentityRef.current = localParticipant?.identity;
  }, [localParticipant?.identity]);

  // Initialise synchronously from the prop so the ref is populated before the
  // first DataChannel message could ever arrive.
  const hostIdentityRef = useRef<string | undefined>(hostIdentity);
  useEffect(() => {
    hostIdentityRef.current = hostIdentity;
  }, [hostIdentity]);

  const isHostRef = useRef(isHost);
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // ── Host-controlled reactive state ────────────────────────────────────────

  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [annotationActive, setAnnotationActive] = useState(false);
  const [controllers, setControllers] = useState<ReadonlySet<string>>(new Set());

  // Ref mirror so message handler always reads latest without stale closures.
  const controllersRef = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    controllersRef.current = controllers;
  }, [controllers]);

  // ── Apply helpers ─────────────────────────────────────────────────────────

  const applyRemoteUpdate = useCallback((update: WhiteboardElementsUpdate) => {
    const api = excalidrawApiRef.current;
    if (!api) {
      // Canvas not ready yet — queue; the flush poll will apply once API is available.
      pendingUpdatesRef.current.push(update);
      return;
    }
    lastSyncedVersionRef.current = getSceneVersion(update.elements);
    api.updateScene({ elements: update.elements, captureUpdate: "NEVER" });
    if (update.files) {
      const vals = Object.values(update.files);
      if (vals.length > 0) {
        try { api.addFiles(vals as Parameters<typeof api.addFiles>[0]); } catch { /* ignore */ }
      }
    }
  }, []);

  const applyFullSync = useCallback((scene: WhiteboardSceneData) => {
    const api = excalidrawApiRef.current;
    if (!api) {
      // Canvas not ready — a full-sync supersedes any pending incremental updates.
      pendingFullSyncRef.current = scene;
      pendingUpdatesRef.current = [];
      return;
    }
    lastSyncedVersionRef.current = getSceneVersion(scene.elements);
    const currentAppState = api.getAppState();
    api.updateScene({
      elements: scene.elements,
      appState: {
        ...scene.appState,
        viewBackgroundColor: currentAppState.viewBackgroundColor,
      } as Parameters<typeof api.updateScene>[0]["appState"],
      captureUpdate: "NEVER",
    });
    if (scene.files) {
      const vals = Object.values(scene.files);
      if (vals.length > 0) {
        try { api.addFiles(vals as Parameters<typeof api.addFiles>[0]); } catch { /* ignore */ }
      }
    }
  }, []);

  /**
   * Flush pending updates that arrived before the Excalidraw API was ready.
   *
   * Runs on a 150 ms interval for the lifetime of the hook so it handles:
   *   - Initial mount race (canvas chunk loads after first messages arrive)
   *   - Canvas remounts (panel close → re-open)
   *   - Annotation overlay becoming visible after being hidden
   *
   * The interval does NOT stop after the first flush — new messages queued
   * after the canvas briefly loses its ref (e.g. during a re-render) need
   * to be applied too.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const api = excalidrawApiRef.current;
      if (!api) return; // canvas not ready yet, try next tick

      // A queued full-sync supersedes all incremental updates.
      const pendingFull = pendingFullSyncRef.current;
      if (pendingFull) {
        pendingFullSyncRef.current = null;
        pendingUpdatesRef.current = [];
        lastSyncedVersionRef.current = getSceneVersion(pendingFull.elements);
        const currentAppState = api.getAppState();
        api.updateScene({
          elements: pendingFull.elements,
          appState: {
            ...pendingFull.appState,
            viewBackgroundColor: currentAppState.viewBackgroundColor,
          } as Parameters<typeof api.updateScene>[0]["appState"],
          captureUpdate: "NEVER",
        });
        if (pendingFull.files) {
          const vals = Object.values(pendingFull.files);
          if (vals.length > 0) {
            try { api.addFiles(vals as Parameters<typeof api.addFiles>[0]); } catch { /* ignore */ }
          }
        }
        return;
      }

      // Apply any queued incremental updates — only the latest matters.
      const pending = pendingUpdatesRef.current;
      if (pending.length === 0) return;
      const latest = pending[pending.length - 1];
      pendingUpdatesRef.current = [];
      lastSyncedVersionRef.current = getSceneVersion(latest.elements);
      api.updateScene({ elements: latest.elements, captureUpdate: "NEVER" });
      if (latest.files) {
        const vals = Object.values(latest.files);
        if (vals.length > 0) {
          try { api.addFiles(vals as Parameters<typeof api.addFiles>[0]); } catch { /* ignore */ }
        }
      }
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // ── Message handler (stored in ref to avoid re-subscribing on every render) ─

  const onMessageRef = useRef<
    ((msg: ReceivedDataMessage<typeof WHITEBOARD_TOPIC>) => void) | null
  >(null);

  useLayoutEffect(() => {
    onMessageRef.current = (msg: ReceivedDataMessage<typeof WHITEBOARD_TOPIC>) => {
      const message = deserializeMessage(msg.payload);
      if (!message) return;

      const senderIdentity = msg.from?.identity || message.sender;
      const localIdentity = localIdentityRef.current;

      // Never process our own echo.
      if (senderIdentity && senderIdentity === localIdentity) return;

      switch (message.type) {
        case "scene-update": {
          const isFromHost = senderIdentity === hostIdentityRef.current;
          const isFromController =
            senderIdentity != null && controllersRef.current.has(senderIdentity);
          if (!isFromHost && !isFromController) return; // unauthorised sender
          applyRemoteUpdate(message.update);
          break;
        }

        case "full-sync": {
          applyFullSync(message.scene);
          lastLocalSceneRef.current = {
            full: message.scene,
            update: { elements: message.scene.elements, files: message.scene.files },
          };
          // Restore host-controlled state embedded in the full-sync.
          if (message.whiteboardOpen !== undefined) {
            setWhiteboardOpen(message.whiteboardOpen);
          }
          if (message.annotationActive !== undefined) {
            setAnnotationActive(message.annotationActive);
          }
          if (message.controllers !== undefined) {
            const newSet = new Set(message.controllers);
            setControllers(newSet);
            controllersRef.current = newSet;
          }
          break;
        }

        case "request-sync": {
          // Respond with the full current scene to anyone who asks, as long as
          // we have a scene to share OR we are the host (who always has
          // authoritative state, even with a blank canvas).
          //
          // There is deliberately no per-requester deduplication here.
          // The old `respondedToRef` guard was broken: the participant called
          // `requestResync()` which deleted the identity from the *local* node's
          // set, not from the *host's* — so the host's guard was never cleared
          // and subsequent re-sync requests were permanently silenced.
          //
          // Storm prevention (many participants joining at once) is handled by
          // the random jitter below — responses are naturally spread over up to
          // SYNC_RESPONSE_JITTER_MS milliseconds, and the participant always
          // applies only the last full-sync it receives (pendingFullSyncRef is
          // overwritten on each arrival, not appended).
          if (!lastLocalSceneRef.current && !isHostRef.current) break;

          const requester = message.sender;
          const jitter = Math.random() * SYNC_RESPONSE_JITTER_MS;
          setTimeout(() => {
            const identity = localIdentityRef.current;
            if (!identity || !sendRef.current) return;

            const scene = lastLocalSceneRef.current?.full ?? EMPTY_SCENE;
            const response: WhiteboardMessage = {
              type: "full-sync",
              scene,
              sender: identity,
              whiteboardOpen: isHostRef.current
                ? (hostWhiteboardOpenRef?.current ?? false)
                : undefined,
              annotationActive: isHostRef.current
                ? (hostAnnotationActiveRef?.current ?? false)
                : undefined,
              controllers: Array.from(controllersRef.current),
            };
            sendRef.current(serializeMessage(response), {
              reliable: true,
              topic: WHITEBOARD_TOPIC,
              destinationIdentities: [requester],
            }).catch(() => { /* best-effort */ });
          }, jitter);
          break;
        }

        case "whiteboard-visibility": {
          // Security: only accept from the designated host.
          if (senderIdentity !== hostIdentityRef.current) return;
          setWhiteboardOpen(message.open);
          break;
        }

        case "annotation-active": {
          // Security: only accept from the designated host.
          if (senderIdentity !== hostIdentityRef.current) return;
          setAnnotationActive(message.active);
          break;
        }

        case "whiteboard-permissions": {
          // Security: only accept from the designated host.
          if (senderIdentity !== hostIdentityRef.current) return;
          const newSet = new Set(message.controllers);
          setControllers(newSet);
          controllersRef.current = newSet;
          break;
        }
      }
    };
  }, [applyRemoteUpdate, applyFullSync]);

  const stableOnMessage = useCallback(
    (msg: ReceivedDataMessage<typeof WHITEBOARD_TOPIC>) => {
      onMessageRef.current?.(msg);
    },
    []
  );

  // ── DataChannel ───────────────────────────────────────────────────────────

  const { send } = useDataChannel(WHITEBOARD_TOPIC, stableOnMessage);

  useLayoutEffect(() => {
    sendRef.current = send;
  }, [send]);

  // ── Initial request-sync on mount ─────────────────────────────────────────
  // Sends a broadcast request-sync so the host (or any existing participant)
  // delivers the current scene + visibility state in a full-sync response.
  // 800 ms delay gives the DataChannel subscription time to be established.

  useEffect(() => {
    const timer = setTimeout(() => {
      const identity = localIdentityRef.current;
      if (!identity || !sendRef.current) return;
      const request: WhiteboardMessage = { type: "request-sync", sender: identity };
      sendRef.current(serializeMessage(request), {
        reliable: true,
        topic: WHITEBOARD_TOPIC,
      }).catch(() => { /* transient — no peers yet */ });
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Local change handler ──────────────────────────────────────────────────

  const handleLocalChange = useCallback((scene: WhiteboardScene) => {
    const identity = localIdentityRef.current;
    if (!identity) return;

    const currentVersion = getSceneVersion(scene.elements);
    if (currentVersion === lastSyncedVersionRef.current) return;
    lastSyncedVersionRef.current = currentVersion;

    const update = sceneToUpdate(scene);
    const fullData = sceneToFullData(scene);
    lastLocalSceneRef.current = { full: fullData, update };
    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (!sendRef.current) return;
      const message: WhiteboardMessage = {
        type: "scene-update",
        update,
        sender: identity,
        timestamp: Date.now(),
      };
      sendRef.current(serializeMessage(message), {
        reliable: true,
        topic: WHITEBOARD_TOPIC,
      }).catch(() => { /* best-effort */ });
    }, DEBOUNCE_MS);
  }, []);

  // ── Host broadcast helpers ────────────────────────────────────────────────

  const broadcastVisibility = useCallback((open: boolean) => {
    const identity = localIdentityRef.current;
    if (!identity || !sendRef.current) return;
    const message: WhiteboardMessage = {
      type: "whiteboard-visibility",
      open,
      sender: identity,
    };
    sendRef.current(serializeMessage(message), {
      reliable: true,
      topic: WHITEBOARD_TOPIC,
    }).catch(() => { /* best-effort */ });
  }, []);

  const broadcastAnnotationState = useCallback((active: boolean) => {
    const identity = localIdentityRef.current;
    if (!identity || !sendRef.current) return;
    const message: WhiteboardMessage = {
      type: "annotation-active",
      active,
      sender: identity,
    };
    sendRef.current(serializeMessage(message), {
      reliable: true,
      topic: WHITEBOARD_TOPIC,
    }).catch(() => { /* best-effort */ });
  }, []);

  const broadcastPermissions = useCallback((controllerList: string[]) => {
    const identity = localIdentityRef.current;
    if (!identity || !sendRef.current) return;
    const message: WhiteboardMessage = {
      type: "whiteboard-permissions",
      controllers: controllerList,
      sender: identity,
    };
    sendRef.current(serializeMessage(message), {
      reliable: true,
      topic: WHITEBOARD_TOPIC,
    }).catch(() => { /* best-effort */ });
  }, []);

  const syncControllersRef = useCallback((controllerList: string[]) => {
    const newSet = new Set(controllerList);
    setControllers(newSet);
    controllersRef.current = newSet;
  }, []);

  /**
   * Re-request the full scene from the host.
   * Called by RoomContent when the whiteboard panel is newly opened for a
   * participant so the freshly-mounted Excalidraw gets the latest scene even if
   * the initial mount-time request-sync was sent long before the panel opened.
   *
   * The request is sent directly to the host (when their identity is known) so
   * the response is guaranteed to carry authoritative state rather than a
   * potentially stale scene cached by another participant.
   */
  const requestResync = useCallback(() => {
    const identity = localIdentityRef.current;
    if (!identity || !sendRef.current) return;

    const request: WhiteboardMessage = {
      type: "request-sync",
      sender: identity,
    };
    // Target the host specifically if we know their identity — guarantees the
    // authoritative state arrives rather than any participant's cached copy.
    const opts: DataPublishOptions = hostIdentityRef.current
      ? { reliable: true, topic: WHITEBOARD_TOPIC, destinationIdentities: [hostIdentityRef.current] }
      : { reliable: true, topic: WHITEBOARD_TOPIC };

    sendRef.current(serializeMessage(request), opts).catch(() => { /* best-effort */ });
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return {
    handleLocalChange,
    excalidrawApiRef,
    whiteboardOpen,
    annotationActive,
    controllers,
    broadcastVisibility,
    broadcastAnnotationState,
    broadcastPermissions,
    syncControllersRef,
    requestResync,
  };
}
