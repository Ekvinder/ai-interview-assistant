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
}

export interface WhiteboardCanvasProps {
  readOnly: boolean;
  /** LiveKit local participant identity */
  localIdentity: string;
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
}

// ── Data-channel message types ────────────────────────────────────────────────

export type WhiteboardMessage =
  | {
      /**
       * Incremental update — elements + files only.
       * Never carries appState so remote viewports are never disrupted.
       */
      type: "scene-update";
      update: WhiteboardElementsUpdate;
      sender: string;
      timestamp: number;
    }
  | {
      type: "request-sync";
      sender: string;
    }
  | {
      /**
       * Full scene delivered to a newly-joined participant.
       * Includes appState so they get the correct initial tool/style state.
       */
      type: "full-sync";
      scene: WhiteboardSceneData;
      sender: string;
    };
