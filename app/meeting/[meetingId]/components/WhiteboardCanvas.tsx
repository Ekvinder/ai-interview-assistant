"use client";

import { useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

import type { ExcalidrawImperativeAPI, WhiteboardCanvasProps, WhiteboardScene } from "@/types/whiteboard";
import { useWhiteboardSync } from "@/hooks/useWhiteboardSync";

export default function WhiteboardCanvas({ readOnly }: WhiteboardCanvasProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const { updateScene } = useWhiteboardSync();

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(instance) => {
          apiRef.current = instance;
        }}
        viewModeEnabled={readOnly}
        theme="dark"
        onChange={(elements, appState, files) => {
          // Guard: only propagate changes that originate from user interaction.
          // Excalidraw fires onChange on every internal state update (including
          // ones triggered by our own setScene calls), which causes an infinite
          // loop. Checking collaborators/loading flags prevents self-triggered cycles.
          if (appState.isLoading) return;

          const scene: WhiteboardScene = { elements, appState, files };
          updateScene(scene);
        }}
      />
    </div>
  );
}
