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
 *
 * CRITICAL: When the parent container resizes (e.g., meeting pane shrinks), we need
 * Excalidraw to recalculate its canvas size. We use a ResizeObserver on the wrapper
 * to trigger Excalidraw's internal recalculation via excalidrawAPI.refresh().
 */

import { useEffect, useRef } from "react";
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Tracks whether this component instance is still mounted.
  // Used to cancel the deferred updateScene in the excalidrawAPI callback
  // and to clear the ref on unmount so no caller talks to a dead instance.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Clear the shared ref so useWhiteboardSync and the ResizeObserver
      // don't call into an unmounted Excalidraw instance.
      excalidrawApiRef.current = null;
    };
  // excalidrawApiRef is a stable ref object — no need in deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Excalidraw handles its own canvas resize via an internal ResizeObserver
  // on its container element. We only need to ensure the wrapper div has the
  // correct CSS dimensions — no manual refresh() call needed.
  // The wrapperRef is kept for potential future use and for the mountedRef guard.

  return (
    <div
      ref={wrapperRef}
      style={annotationMode ? {
        position: 'absolute',
        inset: 0,
        background: 'transparent',
        colorScheme: 'dark',
      } : undefined}
      className={annotationMode ? undefined : "h-full w-full"}
    >
      <Excalidraw
        excalidrawAPI={(instance) => {
           excalidrawApiRef.current = instance;
           const timer = setTimeout(() => {
             // Guard: don't call updateScene if the component unmounted
             // before this tick fired (next/dynamic mount/unmount cycle).
             if (!mountedRef.current) return;
             instance.updateScene({
               appState: {
                 viewBackgroundColor: annotationMode ? "transparent" : "#1e1e2e",
               } as Parameters<typeof instance.updateScene>[0]["appState"],
               captureUpdate: "NEVER",
             });
           }, 0);
           // If the API ref is reassigned before the timer fires (remount),
           // the previous timer is harmless because mountedRef guards it.
           // Store it on the instance itself so nothing external needs cleanup.
           // if the api ref is reassigned before the timer fires store it on the instance itsef so nothing external 
           (instance as unknown as { _bgTimer?: ReturnType<typeof setTimeout> })._bgTimer = timer;
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
