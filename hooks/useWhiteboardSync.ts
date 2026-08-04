"use client";

import { useCallback, useRef } from "react";
import type { WhiteboardScene } from "@/types/whiteboard";

export function useWhiteboardSync() {
  // Store the last scene in a ref only — no useState.
  // Setting state on every Excalidraw onChange causes an infinite render loop
  // because each state update triggers a re-render → Excalidraw fires onChange
  // again → repeat. Refs update synchronously without triggering re-renders.
  const lastScene = useRef<WhiteboardScene | null>(null);

  const updateScene = useCallback((newScene: WhiteboardScene) => {
    lastScene.current = newScene;
    // Broadcast or persist the scene here if needed (e.g. via data channel).
    // Do NOT call setState here — that is what caused the infinite loop.
  }, []);

  return {
    lastScene,
    updateScene,
  };
}
