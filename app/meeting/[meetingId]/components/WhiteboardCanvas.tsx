"use client";

/**
 * WhiteboardCanvas
 *
 * Renders the Excalidraw editor and bridges it to the parent's sync bindings.
 *
 * annotationMode=true  → transparent background so strokes appear directly
 *                        over the shared screen underneath.
 * annotationMode=false → normal opaque Excalidraw canvas (dark theme).
 *
 * Transparency is achieved by:
 *   1. Setting viewBackgroundColor to "transparent" via updateScene() / initialData
 *   2. CSS mix-blend-mode isolation on the wrapper so the canvas element itself
 *      doesn't paint a solid background over underlying content.
 *
 * We deliberately avoid injecting global <style> tags because they can
 * affect other elements on the page (e.g. video elements in ScreenShareView).
 */

import { useEffect } from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import type { WhiteboardCanvasProps } from "@/types/whiteboard";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div 
        className="h-full w-full flex items-center justify-center"
        style={{ backgroundColor: "transparent" }}
      >
        <div className="flex flex-col items-center gap-3 text-white/40">
          <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading whiteboard…</span>
        </div>
      </div>
    ),
  }
);

export default function WhiteboardCanvas({
  readOnly,
  localIdentity: _localIdentity,
  annotationMode = false,
  excalidrawApiRef,
  onLocalChange,
}: WhiteboardCanvasProps) {
  // When annotationMode changes (e.g. screen-share starts/stops), push the
  // correct viewBackgroundColor into the live Excalidraw instance so the
  // canvas visually transitions without unmounting.
  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    api.updateScene({
      appState: {
        viewBackgroundColor: annotationMode ? "transparent" : "#1e1e2e",
      } as Parameters<typeof api.updateScene>[0]["appState"],
      captureUpdate: "NEVER",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationMode]);

  return (
    <div
      className="h-full w-full"
      style={annotationMode ? {
        background: "transparent",
        // Force the CSS cascade so Excalidraw's own stylesheet doesn't paint
        // a background on top of the screen share.
        // We use inline CSS custom properties so the override is scoped
        // entirely to this element subtree without a global <style> injection.
        colorScheme: "dark",
      } : undefined}
    >
      <Excalidraw
        excalidrawAPI={(instance) => {
          excalidrawApiRef.current = instance;
        }}
        viewModeEnabled={readOnly}
        theme="dark"
        initialData={
          annotationMode
            ? { appState: { viewBackgroundColor: "transparent" } }
            : undefined
        }
        onChange={(elements, appState, files) => {
          if (appState.isLoading) return;
          if (readOnly) return;
          onLocalChange({ elements, appState, files });
        }}
      />
    </div>
  );
}
