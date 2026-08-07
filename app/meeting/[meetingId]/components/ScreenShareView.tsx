'use client';

import { VideoTrack } from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Button } from '@/components/ui/button';
import { MonitorOff } from 'lucide-react';

interface ScreenShareViewProps {
  screenShareTrackRef: TrackReferenceOrPlaceholder;
  sharerName: string;
  onStopShare?: () => void;
  isLocalSharer: boolean;
}

export default function ScreenShareView({
  screenShareTrackRef,
  sharerName,
  onStopShare,
  isLocalSharer,
}: ScreenShareViewProps) {
  const hasTrack =
    'publication' in screenShareTrackRef &&
    !!screenShareTrackRef.publication &&
    !screenShareTrackRef.publication.isMuted;

  return (
    <div className="relative flex flex-col items-center justify-center flex-1 h-full bg-black overflow-hidden">
      {/* Main stage */}
      <div className="relative w-full h-full">
        {hasTrack ? (
          <VideoTrack
            trackRef={screenShareTrackRef}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white/50 text-sm">
            Screen share unavailable
          </div>
        )}

        {/* Label overlay */}
        {/* <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
          <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
            Sharing: {sharerName}
          </span>
          {isLocalSharer && onStopShare && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onStopShare}
              className="gap-1.5"
            >
              <MonitorOff className="w-3.5 h-3.5" />
              Stop Sharing
            </Button>
          )}
        </div> */}
      </div>
    </div>
  );
}
