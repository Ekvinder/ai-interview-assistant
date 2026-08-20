// Use the Excalidraw component's internal prop types by inferring from the
// component itself — avoids importing from non-exported internal type paths.
import type { Excalidraw } from "@excalidraw/excalidraw";
import type { ComponentProps } from "react";

// ExcalidrawProps is the full props type of the Excalidraw component
type ExcalidrawProps = ComponentProps<typeof Excalidraw>;

// ExcalidrawImperativeAPI — inferred from the excalidrawAPI callback prop
export type ExcalidrawImperativeAPI = NonNullable<
  Parameters<NonNullable<ExcalidrawProps["excalidrawAPI"]>>[0]
>;

// onChange fires with (elements, appState, files) — infer each from the callback
type OnChangeFn = NonNullable<ExcalidrawProps["onChange"]>;
export type ExcalidrawElements = Parameters<OnChangeFn>[0];
export type ExcalidrawAppState = Parameters<OnChangeFn>[1];
export type ExcalidrawFiles = Parameters<OnChangeFn>[2];

// ── Component prop interfaces ─────────────────────────────────────────────────

export interface WhiteboardPanelProps {
  meetingId: string;
  isHost: boolean;
  whiteboardLocked: boolean;
  onToggleLock: () => void;
  onClose: () => void;
  /** LiveKit local participant identity — passed into canvas for sender tagging */
  localIdentity: string;
  /**
   * When true the panel becomes a transparent absolute overlay positioned over
   * the shared screen.  The canvas background is cleared and the panel header
   * floats as a compact toolbar above the annotation layer.
   *
   * The WhiteboardCanvas instance is never re-mounted between modes — scene
   * state, undo history, and collaboration all persist across the transition.
   */
  annotationMode?: boolean;

  /**
   * Set of identities that currently have drawing permission (host excluded).
   * Used to compute readOnly for participants who have been granted control.
   */
  controllers?: ReadonlySet<string>;

  // ── Injected sync bindings ──────────────────────────────────────────────────
  // useWhiteboardSync lives in RoomContent (one instance per room).
  // These callbacks and refs are passed down so WhiteboardCanvas does not need
  // its own DataChannel subscription.

  /** Stable ref to the ExcalidrawImperativeAPI — assigned by WhiteboardCanvas. */
  excalidrawApiRef: React.RefObject<ExcalidrawImperativeAPI | null>;
  /** Called by WhiteboardCanvas.onChange to publish incremental updates. */
  onLocalChange: (scene: { elements: ExcalidrawElements; appState: ExcalidrawAppState; files: ExcalidrawFiles }) => void;
  /** Called when the physical size of the whiteboard container changes. */
  onStageSize?: (size: { width: number; height: number }) => void;
}

export interface WhiteboardCanvasProps {
  readOnly: boolean;
  /** LiveKit local participant identity */
  localIdentity: string;
  /**
   * When true the Excalidraw canvas renders with a transparent background so
   * annotations appear directly over a shared screen.
   */
  annotationMode?: boolean;

  // ── Injected sync bindings (from RoomContent via WhiteboardPanel) ───────────
  excalidrawApiRef: React.RefObject<ExcalidrawImperativeAPI | null>;
  onLocalChange: (scene: { elements: ExcalidrawElements; appState: ExcalidrawAppState; files: ExcalidrawFiles }) => void;
  onStageSize?: (size: { width: number; height: number }) => void;
}

// ── Scene type (safe, uses only inferred types) ───────────────────────────────

export interface WhiteboardScene {
  elements: ExcalidrawElements;
  appState: ExcalidrawAppState;
  files: ExcalidrawFiles;
}

/**
 * Wire-safe scene for full-sync messages (initial load when a participant joins).
 * Includes a serializable appState subset so the new participant gets the correct
 * tool/style state.
 */
export interface WhiteboardSceneData {
  elements: ExcalidrawElements;
  /** Serializable subset of appState — only sent in full-sync, never in scene-update */
  appState: {
    viewBackgroundColor: string;
    currentItemStrokeColor: string;
    currentItemBackgroundColor: string;
    currentItemFillStyle: string;
    currentItemStrokeWidth: number;
    currentItemStrokeStyle: string;
    currentItemRoughness: number;
    currentItemOpacity: number;
    currentItemFontFamily: number;
    currentItemFontSize: number;
    currentItemTextAlign: string;
    currentItemStartArrowhead: string | null;
    currentItemEndArrowhead: string | null;
    zoom: { value: number };
    scrollX: number;
    scrollY: number;
    theme: string;
  };
  files: ExcalidrawFiles;
}

/**
 * Wire-safe incremental update — elements + files only.
 * appState is deliberately excluded from incremental updates to prevent
 * resetting the remote participant's viewport/tool state mid-draw.
 */
export interface WhiteboardElementsUpdate {
  elements: ExcalidrawElements;
  files: ExcalidrawFiles;
  appState?: {
    scrollX: number;
    scrollY: number;
    zoom: { value: number };
  };
}

// ── Data-channel message types ────────────────────────────────────────────────

export type WhiteboardMessage =
  | {
      /**
       * Incremental update — elements + files only.
       * Never carries appState so remote viewports are never disrupted.
       */
      type: "scene-update";
      target: "whiteboard" | "annotation";
      update: WhiteboardElementsUpdate;
      sender: string;
      timestamp: number;
    }
  | {
      type: "request-sync";
      target: "whiteboard" | "annotation";
      sender: string;
    }
  | {
      /**
       * Full scene delivered to a newly-joined participant.
       * Includes appState so they get the correct initial tool/style state.
       * Also carries current whiteboard visibility and controller list so late
       * joiners can restore the full host-controlled state without extra round trips.
       */
      type: "full-sync";
      target: "whiteboard" | "annotation";
      scene: WhiteboardSceneData;
      sender: string;
      /** Whether the whiteboard is currently open for all participants */
      whiteboardOpen?: boolean;
      /** Whether the annotation overlay is currently active */
      annotationActive?: boolean;
      /** Identities that currently have drawing permission (host is always implicit) */
      controllers?: string[];
    }
  | {
      /**
       * Host broadcasts the whiteboard open/close state to all participants.
       * Participants must show or hide the whiteboard without any manual action.
       */
      type: "whiteboard-visibility";
      open: boolean;
      sender: string;
    }
  | {
      /**
       * Host broadcasts the annotation overlay active state to all participants.
       */
      type: "annotation-active";
      active: boolean;
      sender: string;
    }
  | {
      /**
       * Host broadcasts the current set of identities that have drawing
       * permission.  The host is always authoritative — participants must
       * not trust locally-modified versions of this list.
       */
      type: "whiteboard-permissions";
      /** Full list of controller identities (host excluded — host is always implicit) */
      controllers: string[];
      sender: string;
    }
  | {
      type: "chunk";
      id: string;
      i: number;
      t: number;
      d: string;
      sender: string;
    };
