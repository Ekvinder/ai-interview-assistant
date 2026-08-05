"use client";

/**
 * useWhiteboardSync
 *
 * Manages real-time Excalidraw collaboration over a LiveKit DataChannel.
 *
 * ── Why the first-stroke bug happened ─────────────────────────────────────────
 *
 * The original implementation sent the full appState (scrollX, scrollY, zoom,
 * tool state, …) in every "scene-update" message and applied it via
 * updateScene({ appState }).  Excalidraw treats an appState update as "replace
 * current UI state".  When it arrived mid-draw it:
 *   1. Reset cursorButton, newElement, and activeTool, cancelling the in-progress
 *      stroke.  The next pointer-down was the first stroke that actually committed
 *      — users perceived this as "first stroke is ignored".
 *   2. Reset scrollX/scrollY/zoom, causing a jarring viewport jump that itself
 *      triggered another onChange → spurious publish loop.
 *
 * The guard flag (isRemoteUpdateRef) was also cleared in a microtask
 * (Promise.resolve().then), but React 18's concurrent renderer can fire the
 * onChange triggered by updateScene as a macrotask — after the microtask queue
 * drains — leaving the guard already cleared and allowing the remote-induced
 * onChange to publish, creating an echo loop.
 *
 * ── Fixes applied ─────────────────────────────────────────────────────────────
 *
 * 1. "scene-update" messages carry only elements + files.  appState is NEVER
 *    applied for incremental updates.  Viewport and tool state belong to each
 *    participant individually.
 *
 * 2. "full-sync" messages (delivered once when a participant joins) DO carry
 *    appState so the newcomer starts with the correct initial style state.
 *
 * 3. updateScene() is called with captureUpdate: "NEVER" on all remote updates.
 *    This tells Excalidraw the update is remote, preventing undo-stack pollution
 *    and suppressing internal state resets that cancel in-progress gestures.
 *
 * 4. The guard flag is cleared with setTimeout(0) — a macrotask — guaranteeing
 *    it outlives any synchronous or microtask-scheduled onChange Excalidraw fires
 *    in response to updateScene.
 */

import { useCallback, useEffect, useRef } from "react";
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

/** Topic used for all whiteboard DataChannel traffic. */
const WHITEBOARD_TOPIC = "whiteboard" as const;

/** Debounce interval for outbound scene-update messages (ms). */
const DEBOUNCE_MS = 250;

/**
 * Maximum random jitter (ms) added before responding to a request-sync.
 * Prevents all existing participants from sending full-sync simultaneously.
 */
const SYNC_RESPONSE_JITTER_MS = 300;

export interface UseWhiteboardSyncReturn {
  /**
   * Call this from Excalidraw's onChange.  It will debounce and publish a
   * scene-update over the DataChannel unless the update was triggered by an
   * incoming remote message.
   */
  handleLocalChange: (scene: WhiteboardScene) => void;

  /**
   * Boolean ref that WhiteboardCanvas reads in onChange to detect whether the
   * current change was caused by a remote updateScene() call.  When true the
   * canvas MUST NOT call handleLocalChange.
   */
  isRemoteUpdateRef: React.RefObject<boolean>;

  /**
   * Ref that WhiteboardCanvas must assign the ExcalidrawImperativeAPI instance
   * to so that this hook can call updateScene() on incoming messages.
   */
  excalidrawApiRef: React.RefObject<ExcalidrawImperativeAPI | null>;
}

export function useWhiteboardSync(): UseWhiteboardSyncReturn {
  const { localParticipant } = useLocalParticipant();

  // ── Refs ───────────────────────────────────────────────────────────────────

  /** The Excalidraw imperative API instance — set by WhiteboardCanvas. */
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  /**
   * Guard flag: true while a remote updateScene() is being processed.
   * Checked inside WhiteboardCanvas.onChange to prevent the remote-induced
   * onChange from publishing back to the network (echo loop).
   *
   * Cleared with setTimeout(0) — a macrotask — so it outlives any synchronous
   * or microtask-scheduled onChange that Excalidraw fires in response to
   * updateScene, regardless of React's rendering mode.
   */
  const isRemoteUpdateRef = useRef(false);

  /**
   * Timer ID for the guard-clear macrotask.
   * We cancel the previous timer each time a new remote update arrives so that
   * rapid back-to-back remote updates don't accidentally clear the flag too early.
   */
  const guardClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The most recently committed local scene, used for:
   * - responding to request-sync from new participants (full-sync)
   * - caching the last good state for reconnect
   */
  const lastLocalSceneRef = useRef<{
    full: WhiteboardSceneData;
    update: WhiteboardElementsUpdate;
  } | null>(null);

  /** Debounce timer for outbound scene-update messages. */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Guards request-sync responses: once we have responded to a given identity,
   * we do not respond again to prevent duplicate full-sync floods.
   */
  const respondedToRef = useRef(new Set<string>());

  /**
   * Stable ref to the DataChannel send function.
   * Storing it in a ref avoids the circular initializer that arises if the
   * useDataChannel callback and the destructured `send` reference each other.
   */
  const sendRef = useRef<
    ((payload: Uint8Array, options: DataPublishOptions) => Promise<void>) | null
  >(null);

  /** Stable ref for localParticipant.identity — avoids stale closures. */
  const localIdentityRef = useRef<string | undefined>(
    localParticipant?.identity
  );
  useEffect(() => {
    localIdentityRef.current = localParticipant?.identity;
  }, [localParticipant?.identity]);

  // ── Apply a remote elements-only update ───────────────────────────────────

  /**
   * Apply an incremental update (elements + files, no appState).
   *
   * We deliberately do NOT touch appState here.  Doing so would:
   *  - Reset the receiving user's viewport (scrollX/scrollY/zoom)
   *  - Cancel their in-progress stroke (cursorButton, newElement, activeTool)
   *  - Cause the "first stroke is ignored" bug
   *
   * captureUpdate: "NEVER" tells Excalidraw this is a remote update — it
   * suppresses undo-stack recording and avoids internal state resets that
   * would interfere with pointer events in flight.
   */
  const applyRemoteUpdate = useCallback(
    (update: WhiteboardElementsUpdate) => {
      const api = excalidrawApiRef.current;
      if (!api) return;

      // Cancel any pending guard-clear from a previous remote update.
      if (guardClearTimerRef.current !== null) {
        clearTimeout(guardClearTimerRef.current);
      }

      // Set the guard BEFORE updateScene so onChange knows to skip publishing.
      isRemoteUpdateRef.current = true;

      api.updateScene({
        elements: update.elements,
        // captureUpdate: "NEVER" = remote update, no undo stack, no state reset
        captureUpdate: "NEVER",
      });

      // Add embedded files (images, etc.) separately — updateScene does not
      // accept a files key.
      if (update.files) {
        const fileValues = Object.values(update.files);
        if (fileValues.length > 0) {
          try {
            api.addFiles(fileValues as Parameters<typeof api.addFiles>[0]);
          } catch {
            // Gracefully ignore invalid file data.
          }
        }
      }

      // Clear the guard with a macrotask (setTimeout 0).
      // This guarantees the flag is still true during any synchronous or
      // microtask-scheduled onChange that Excalidraw fires as a result of
      // updateScene, regardless of React's rendering strategy.
      guardClearTimerRef.current = setTimeout(() => {
        guardClearTimerRef.current = null;
        isRemoteUpdateRef.current = false;
      }, 0);
    },
    []
  );

  // ── Apply a full-sync scene (new participant joining) ─────────────────────

  /**
   * Apply a full scene including appState.
   * Only used once per participant session — when they first join and receive
   * the current whiteboard state from an existing participant.
   */
  const applyFullSync = useCallback((scene: WhiteboardSceneData) => {
    const api = excalidrawApiRef.current;
    if (!api) return;

    if (guardClearTimerRef.current !== null) {
      clearTimeout(guardClearTimerRef.current);
    }

    isRemoteUpdateRef.current = true;

    api.updateScene({
      elements: scene.elements,
      appState: scene.appState as Parameters<
        typeof api.updateScene
      >[0]["appState"],
      captureUpdate: "NEVER",
    });

    if (scene.files) {
      const fileValues = Object.values(scene.files);
      if (fileValues.length > 0) {
        try {
          api.addFiles(fileValues as Parameters<typeof api.addFiles>[0]);
        } catch {
          // Gracefully ignore invalid file data.
        }
      }
    }

    guardClearTimerRef.current = setTimeout(() => {
      guardClearTimerRef.current = null;
      isRemoteUpdateRef.current = false;
    }, 0);
  }, []);

  // ── DataChannel — message receiver ────────────────────────────────────────
  //
  // The message handler is stored in a ref so it always calls the latest
  // version of applyRemoteUpdate / applyFullSync without causing useDataChannel
  // to re-subscribe on every render.  The stable wrapper `stableOnMessage`
  // is the actual callback passed to useDataChannel.

  const onMessageRef = useRef<
    ((msg: ReceivedDataMessage<typeof WHITEBOARD_TOPIC>) => void) | null
  >(null);

  onMessageRef.current = useCallback(
    (msg: ReceivedDataMessage<typeof WHITEBOARD_TOPIC>) => {
      const message = deserializeMessage(msg.payload);
      if (!message) return;

      const senderIdentity = msg.from?.identity;
      const localIdentity = localIdentityRef.current;

      // Never process our own echo.
      if (senderIdentity && senderIdentity === localIdentity) return;

      switch (message.type) {
        case "scene-update": {
          // Incremental update — elements + files only, no appState.
          applyRemoteUpdate(message.update);
          break;
        }

        case "full-sync": {
          // Full scene for a newly-joined participant — includes appState.
          applyFullSync(message.scene);
          // Update our cached scene so future request-sync responses are fresh.
          lastLocalSceneRef.current = {
            full: message.scene,
            update: { elements: message.scene.elements, files: message.scene.files },
          };
          break;
        }

        case "request-sync": {
          // A participant just joined and wants the current scene.
          if (!lastLocalSceneRef.current) break;

          const scene = lastLocalSceneRef.current.full;
          const requester = message.sender;

          // Respond once per requester identity per session.
          if (respondedToRef.current.has(requester)) break;
          respondedToRef.current.add(requester);

          // Random jitter prevents thundering-herd when multiple participants
          // all try to respond to the same newcomer simultaneously.
          const jitter = Math.random() * SYNC_RESPONSE_JITTER_MS;
          setTimeout(() => {
            const identity = localIdentityRef.current;
            if (!identity || !sendRef.current) return;

            const response: WhiteboardMessage = {
              type: "full-sync",
              scene,
              sender: identity,
            };
            sendRef.current(serializeMessage(response), {
              reliable: true,
              topic: WHITEBOARD_TOPIC,
              destinationIdentities: [requester],
            }).catch(() => {
              // Best-effort — participant may have left already.
            });
          }, jitter);
          break;
        }
      }
    },
    [applyRemoteUpdate, applyFullSync]
  );

  const stableOnMessage = useCallback(
    (msg: ReceivedDataMessage<typeof WHITEBOARD_TOPIC>) => {
      onMessageRef.current?.(msg);
    },
    []
  );

  // ── DataChannel hook ───────────────────────────────────────────────────────

  const { send } = useDataChannel(WHITEBOARD_TOPIC, stableOnMessage);

  // Keep the send ref current.
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // ── Request a full-sync on mount ──────────────────────────────────────────

  useEffect(() => {
    // 500 ms delay ensures the DataChannel subscription is established before
    // we broadcast the request to existing participants.
    const timer = setTimeout(() => {
      const identity = localIdentityRef.current;
      if (!identity || !sendRef.current) return;

      const request: WhiteboardMessage = {
        type: "request-sync",
        sender: identity,
      };
      sendRef.current(serializeMessage(request), {
        reliable: true,
        topic: WHITEBOARD_TOPIC,
      }).catch(() => {
        // Transient — no one to sync from if we are the first participant.
      });
    }, 500);

    return () => clearTimeout(timer);
    // Intentionally runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handle local Excalidraw changes ───────────────────────────────────────

  const handleLocalChange = useCallback((scene: WhiteboardScene) => {
    const identity = localIdentityRef.current;
    if (!identity) return;

    // Build the incremental update (elements + files only) and cache it.
    const update = sceneToUpdate(scene);
    // Also keep a full-data snapshot for responding to request-sync.
    const fullData = sceneToFullData(scene);
    lastLocalSceneRef.current = { full: fullData, update };

    // Debounce — never publish on every pointer-move event.
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

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
      }).catch(() => {
        // Best-effort — transient network issues should not break the UX.
      });
    }, DEBOUNCE_MS);
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      if (guardClearTimerRef.current !== null) {
        clearTimeout(guardClearTimerRef.current);
      }
    };
  }, []);

  return {
    handleLocalChange,
    isRemoteUpdateRef,
    excalidrawApiRef,
  };
}
