"use client";

/**
 * WhiteboardPanel
 *
 * Renders the Excalidraw whiteboard in one of two visual modes:
 *
 *   annotationMode=false (default)
 *     Standard sidebar panel — fixed on mobile, static on sm+ screens,
 *     with a header showing the lock control and a close button.
 *
 *   annotationMode=true
 *     Transparent overlay — the panel expands to fill its nearest positioned
 *     ancestor (the screen-share container) via absolute inset-0.  The
 *     WhiteboardCanvas background becomes transparent so annotations appear
 *     directly over the shared screen.  A compact floating toolbar provides
 *     close access without blocking too much of the shared content.
 *
 * The WhiteboardCanvas instance is intentionally mounted unconditionally inside
 * this component so that React never re-creates it when switching between modes.
 * This preserves the scene, undo history, and collaboration state across the
 * normal-whiteboard ↔ annotation-overlay transition.
 */

import { Lock, Unlock, X, PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import WhiteboardCanvas from "./WhiteboardCanvas";

import type { WhiteboardPanelProps } from "@/types/whiteboard";
import { getReadOnlyState } from "@/utils/whiteboard";

export default function WhiteboardPanel({
  meetingId,
  isHost,
  whiteboardLocked,
  onToggleLock,
  onClose,
  localIdentity,
  annotationMode = false,
  controllers,
  excalidrawApiRef,
  onLocalChange,
  onStageSize,
}: WhiteboardPanelProps) {
  const readOnly = getReadOnlyState(isHost, whiteboardLocked, localIdentity, controllers);
  const hasPermission = localIdentity ? controllers?.has(localIdentity) ?? false : false;
  

  // ── Annotation overlay mode ──────────────────────────────────────────────
  // The panel becomes an absolute inset-0 layer over the screen-share
  // container.  Only the canvas and a minimal floating toolbar are rendered —
  // the normal sidebar chrome is hidden so it doesn't block the shared screen.
  //container . only the canva and a minimal floating toolbar are render - 
  // DOM hierarchy:
  //   MeetingRoom (flex-1) ← parent controller
  //   └── relative div (flex-1) ← positioned ancestor for absolute positioning
  //       └── ScreenShareView (containerRef, relative)
  //           └── screen-share-stage (flex-1 w-full h-full) ← positioned ancestor for annotation
  //               ├── VideoTrack (absolute inset-0)
  //               └── annotation-overlay (absolute inset-0)
  //                   └── this WhiteboardPanel (absolute inset-0)
  //
  // When MeetingRoom resizes smaller:
  //   - screen-share-stage shrinks (flex-1 inherits new parent size)
  //   - annotation-overlay (absolute inset-0) inherits the new screen-share-stage dimensions
  //   - WhiteboardCanvas inside shrinks with it
  if (annotationMode) {
    return (
      <div
        style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}
        aria-label="Annotation overlay"
        role="region"
      >
        {/* Canvas fills the stage exactly via absolute inset-0 */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
          <WhiteboardCanvas
            readOnly={readOnly}
            localIdentity={localIdentity}
            annotationMode
            excalidrawApiRef={excalidrawApiRef}
            onLocalChange={onLocalChange}
            onStageSize={onStageSize}
          />
        </div>

        {/* Floating toolbar: top-right corner, always on top of the canvas */}
        <div
          className="
            absolute top-3 right-3 z-20
            pointer-events-auto
            flex items-center gap-1.5
            bg-black/60 backdrop-blur-sm
            rounded-lg px-2 py-1.5
            border border-white/10
          "
          aria-label="Annotation toolbar"
        >
          {/* Annotation indicator */}
          <span className="flex items-center gap-1.5 text-white/80 text-xs font-medium select-none mr-1">
            <PenLine className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
            Annotating
          </span>

          {/* Lock / Unlock — host only */}
          
          {isHost && (
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/10"
              onClick={onToggleLock}
              title={whiteboardLocked ? "Unlock annotations" : "Lock annotations"}
              aria-label={
                whiteboardLocked ? "Unlock annotations" : "Lock annotations"
              }
            >
              {whiteboardLocked ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Unlock className="w-3.5 h-3.5" />
              )}
            </Button>
          )}

          {/* Close / hide annotation overlay */}
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/10"
            onClick={onClose}
            aria-label="Hide annotation overlay"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Normal sidebar mode ───────────────────────────────────────────────────
  return (
    <aside
      className="
        fixed
        inset-y-0
        right-0
        z-30
        w-full
        bg-background
        border-l
        flex
        flex-col
        sm:static
      "
      aria-label="Whiteboard panel"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">Whiteboard</h2>
          <p className="text-xs text-muted-foreground">Meeting ID : {meetingId}</p>
        </div>

        <div className="flex gap-2">
          {isHost && (
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleLock}
              title={whiteboardLocked ? "Unlock whiteboard" : "Lock whiteboard"}
              aria-label={
                whiteboardLocked ? "Unlock whiteboard" : "Lock whiteboard"
              }
            >
              {whiteboardLocked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close whiteboard"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <WhiteboardCanvas
          readOnly={readOnly}
          localIdentity={localIdentity}
          annotationMode={false}
          excalidrawApiRef={excalidrawApiRef}
          onLocalChange={onLocalChange}
          onStageSize={onStageSize}
        />
      </div>
    </aside>
  );
}
