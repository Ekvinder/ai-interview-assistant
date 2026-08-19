'use client';

/**
 * ScreenShareView
 *
 * Renders the screen-share video track with optional annotation overlay.
 *
 * CRITICAL LAYOUT FIX:
 * The screen-share-stage is sized to represent the ACTUAL visible screen-share rectangle,
 * not the full meeting pane. This is calculated by:
 *
 *   1. Observing the outer container's size (available meeting pane)
 *   2. Observing the video's intrinsic dimensions (actual shared screen)
 *   3. Calculating the rendered rectangle that preserves aspect ratio while fitting
 *      within the available space
 *   4. Applying those dimensions DIRECTLY to screen-share-stage
 *
 * The annotation overlay (absolute inset-0) is positioned relative to this stage,
 * so it automatically matches the visible video rectangle size.
 *
 * When the meeting pane resizes:
 *   - outer container size changes
 *   - screen-share-stage recalculates and updates its dimensions
 *   - video (absolute inset-0) inherits the new stage size
 *   - annotation overlay (absolute inset-0) inherits the new stage size
 *   - Excalidraw canvas MUST also respond to its parent resize
 */

import { useEffect, useRef, useState } from 'react';
import { VideoTrack } from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';

interface ScreenShareViewProps {
  screenShareTrackRef: TrackReferenceOrPlaceholder;
  sharerName: string;
  onStopShare?: () => void;
  isLocalSharer: boolean;
  children?: React.ReactNode;
  /** Called whenever the computed stage dimensions change. Used by the host/participant
   *  to feed current stage size into annotation coordinate normalization. */
  onStageSize?: (size: { width: number; height: number }) => void;
}

export default function ScreenShareView({
  screenShareTrackRef,
  sharerName,
  onStopShare,
  isLocalSharer,
  children,
  onStageSize,
}: ScreenShareViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [parentSize, setParentSize] = useState({ width: 0, height: 0 });
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  const hasTrack =
    'publication' in screenShareTrackRef &&
    !!screenShareTrackRef.publication &&
    !screenShareTrackRef.publication.isMuted;

  // Observe outer container size (available meeting pane)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setParentSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Observe video element intrinsic size.
  // For remote screen-share tracks, videoWidth/videoHeight may be set
  // before our observer attaches, so we also poll as a fallback.
  useEffect(() => {
    if (!containerRef.current) return;

    let videoEl: HTMLVideoElement | null = null;
    let intrinsicObserver: ResizeObserver | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const readIntrinsic = () => {
      if (videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        setVideoSize({ width: videoEl.videoWidth, height: videoEl.videoHeight });
        // Stop polling once we have valid dimensions — events will keep it current
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      }
    };

    const setupVideo = (v: HTMLVideoElement) => {
      if (videoEl === v) return;
      if (videoEl) {
        videoEl.removeEventListener('resize', readIntrinsic);
        videoEl.removeEventListener('loadedmetadata', readIntrinsic);
        videoEl.removeEventListener('loadeddata', readIntrinsic);
        videoEl.removeEventListener('canplay', readIntrinsic);
        intrinsicObserver?.disconnect();
      }
      if (pollTimer) clearInterval(pollTimer);

      videoEl = v;
      videoEl.addEventListener('resize', readIntrinsic);
      videoEl.addEventListener('loadedmetadata', readIntrinsic);
      videoEl.addEventListener('loadeddata', readIntrinsic);
      videoEl.addEventListener('canplay', readIntrinsic);

      // Observe the video element's rendered size — when LiveKit sets
      // clientWidth/clientHeight we can re-read videoWidth/videoHeight.
      intrinsicObserver = new ResizeObserver(readIntrinsic);
      intrinsicObserver.observe(videoEl);

      // Fallback poll: remote tracks often have dimensions already set
      pollTimer = setInterval(readIntrinsic, 200);

      // Try immediately
      readIntrinsic();
    };

    const checkVideo = () => {
      const v = containerRef.current?.querySelector('video');
      if (v) setupVideo(v);
    };

    checkVideo();
    const mutObserver = new MutationObserver(checkVideo);
    mutObserver.observe(containerRef.current, { childList: true, subtree: true });

    return () => {
      if (videoEl) {
        videoEl.removeEventListener('resize', readIntrinsic);
        videoEl.removeEventListener('loadedmetadata', readIntrinsic);
        videoEl.removeEventListener('loadeddata', readIntrinsic);
        videoEl.removeEventListener('canplay', readIntrinsic);
      }
      intrinsicObserver?.disconnect();
      mutObserver.disconnect();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [hasTrack]);

  // Calculate screen-share-stage size based on video aspect ratio and available space
  useEffect(() => {
    let renderWidth = parentSize.width;
    let renderHeight = parentSize.height;

    if (videoSize.width > 0 && videoSize.height > 0 && parentSize.width > 0 && parentSize.height > 0) {
      const videoAspect = videoSize.width / videoSize.height;
      const parentAspect = parentSize.width / parentSize.height;

      if (videoAspect > parentAspect) {
        // Video is wider than parent (letterboxed on top and bottom)
        renderWidth = parentSize.width;
        renderHeight = parentSize.width / videoAspect;
      } else {
        // Video is taller than parent (pillarboxed on sides)
        renderHeight = parentSize.height;
        renderWidth = parentSize.height * videoAspect;
      }
    }

    setStageSize({ width: renderWidth, height: renderHeight });
    onStageSize?.({ width: renderWidth, height: renderHeight });
  }, [parentSize, videoSize, onStageSize]);

  // Comprehensive debugging: track all six rectangles
  useEffect(() => {
    const logAllDimensions = () => {
      if (!containerRef.current || !stageRef.current) return;

      const container = containerRef.current;
      const stage = stageRef.current;
      const video = containerRef.current.querySelector('video');
      const annotation = containerRef.current.querySelector('.annotation-overlay');
      const whiteboardWrapper = containerRef.current.querySelector('[role="region"]');
      const excalidrawRoot = containerRef.current.querySelector('.excalidraw');

      const cRect = container.getBoundingClientRect();
      const sRect = stage.getBoundingClientRect();
      const vRect = video?.getBoundingClientRect();
      const aRect = annotation?.getBoundingClientRect();
      const wRect = whiteboardWrapper?.getBoundingClientRect();
      const eRect = excalidrawRoot?.getBoundingClientRect();

      console.log('[LAYOUT DEBUG] ===== RESIZE CYCLE =====');
      console.log('[LAYOUT] 1. OUTER CONTAINER:', {
        width: Math.round(cRect.width), height: Math.round(cRect.height),
        left: Math.round(cRect.left), top: Math.round(cRect.top)
      });
      console.log('[LAYOUT] 2. SCREEN-SHARE-STAGE:', {
        width: Math.round(sRect.width), height: Math.round(sRect.height),
        left: Math.round(sRect.left), top: Math.round(sRect.top)
      });
      console.log('[LAYOUT] 3. VIDEO ELEMENT:', {
        width: vRect ? Math.round(vRect.width) : 'N/A', height: vRect ? Math.round(vRect.height) : 'N/A',
        left: vRect ? Math.round(vRect.left) : 'N/A', top: vRect ? Math.round(vRect.top) : 'N/A'
      });
      console.log('[LAYOUT] 4. ANNOTATION OVERLAY:', {
        width: aRect ? Math.round(aRect.width) : 'N/A', height: aRect ? Math.round(aRect.height) : 'N/A',
        left: aRect ? Math.round(aRect.left) : 'N/A', top: aRect ? Math.round(aRect.top) : 'N/A'
      });
      console.log('[LAYOUT] 5. WHITEBOARD WRAPPER:', {
        width: wRect ? Math.round(wRect.width) : 'N/A', height: wRect ? Math.round(wRect.height) : 'N/A',
        left: wRect ? Math.round(wRect.left) : 'N/A', top: wRect ? Math.round(wRect.top) : 'N/A'
      });
      console.log('[LAYOUT] 6. EXCALIDRAW ROOT:', {
        width: eRect ? Math.round(eRect.width) : 'N/A', height: eRect ? Math.round(eRect.height) : 'N/A',
        left: eRect ? Math.round(eRect.left) : 'N/A', top: eRect ? Math.round(eRect.top) : 'N/A'
      });

      // Validate all six are aligned
      if (vRect && aRect && wRect && eRect) {
        const allMatch = 
          Math.abs(sRect.width - vRect.width) < 2 &&
          Math.abs(sRect.height - vRect.height) < 2 &&
          Math.abs(sRect.width - aRect.width) < 2 &&
          Math.abs(sRect.height - aRect.height) < 2 &&
          Math.abs(sRect.width - wRect.width) < 2 &&
          Math.abs(sRect.height - wRect.height) < 2 &&
          Math.abs(sRect.width - eRect.width) < 2 &&
          Math.abs(sRect.height - eRect.height) < 2;
        
        if (allMatch) {
          console.log('✓ [LAYOUT] All six rectangles are correctly sized and aligned');
        } else {
          console.warn('✗ [LAYOUT] MISMATCH detected - dimensions are not synchronized');
        }
      }
    };

    logAllDimensions();
    const timer = setInterval(logAllDimensions, 2000);
    return () => clearInterval(timer);
  }, [stageSize, hasTrack]);

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col items-center justify-center flex-1 h-full w-full bg-black overflow-hidden min-h-0 min-w-0"
    >
      {hasTrack ? (
        <div 
          ref={stageRef}
          className="relative screen-share-stage overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ 
            width: stageSize.width > 0 ? `${stageSize.width}px` : '100%', 
            height: stageSize.height > 0 ? `${stageSize.height}px` : '100%' 
          }}
        >
          <VideoTrack
            trackRef={screenShareTrackRef}
            className="absolute inset-0 w-full h-full object-fill"
            style={{ objectFit: 'fill' }}
          />
          {children && (
            <div
              className="annotation-overlay"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
              }}
            >
              {children}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-white/50 text-sm">
          Screen share unavailable
        </div>
      )}
    </div>
  );
}
