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
}

export interface WhiteboardCanvasProps {
  readOnly: boolean;
}

// ── Scene type (safe, uses only inferred types) ───────────────────────────────

export interface WhiteboardScene {
  elements: ExcalidrawElements;
  appState: ExcalidrawAppState;
  files: ExcalidrawFiles;
}

// ── Data-channel message types ────────────────────────────────────────────────

export type WhiteboardMessage =
  | {
      type: "scene-update";
      scene: WhiteboardScene;
      sender: string;
      timestamp: number;
    }
  | {
      type: "request-sync";
      sender: string;
    }
  | {
      type: "full-sync";
      scene: WhiteboardScene;
      sender: string;
    };
