"use client";

/**
 * Excalidraw accesses `window` at module evaluation time, so it cannot be
 * imported statically in a Next.js app that runs SSR/SSG.  We load it with
 * next/dynamic + ssr:false so the module is only evaluated in the browser.
 */
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import type { WhiteboardCanvasProps } from "@/types/whiteboard";
import { useWhiteboardSync } from "@/hooks/useWhiteboardSync";

// Excalidraw is loaded client-side only — never executed on the server.
const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false }
);

export default function WhiteboardCanvas({
  readOnly,
  localIdentity,
}: WhiteboardCanvasProps) {
  const { handleLocalChange, isRemoteUpdateRef, excalidrawApiRef } =
    useWhiteboardSync();

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={(instance) => {
          excalidrawApiRef.current = instance;
        }}
        viewModeEnabled={readOnly}
        theme="dark"
        onChange={(elements, appState, files) => {
          // Do not publish while Excalidraw is loading its initial state.
          if (appState.isLoading) return;

          // Do not publish when the change was caused by our own updateScene()
          // call from an incoming remote message.  Clearing the guard happens
          // in a microtask inside useWhiteboardSync after updateScene returns,
          // so this check is always consistent.
          if (isRemoteUpdateRef.current) return;

          // Do not publish in read-only / view mode — the user cannot draw.
          if (readOnly) return;

          handleLocalChange({ elements, appState, files });
        }}
      />
    </div>
  );
}
