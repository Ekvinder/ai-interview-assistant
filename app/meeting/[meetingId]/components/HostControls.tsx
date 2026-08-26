'use client';

import { useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Button } from '@/components/ui/button';
import { Lock, PhoneOff, AlertTriangle } from 'lucide-react';
import { meetingClientService } from '@/services/client/meeting.service';
import { toast } from 'sonner';

interface HostControlsProps {
  meetingId: string;
  meetingDbId: string;
  onEndMeeting: () => void;
}

export default function HostControls({ meetingDbId, onEndMeeting }: HostControlsProps) {
  // useRoomContext must be called inside LiveKitRoom context — this component is always rendered there
  useRoomContext();
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  async function handleEndMeeting() {
    if (!confirmingEnd) {
      setConfirmingEnd(true);
      return;
    }
    setIsEnding(true);
    try {
      await meetingClientService.endMeeting(meetingDbId);
      onEndMeeting();
    } catch (err) {
      const e = err as Error;
      toast.error('Failed to cancel meeting: ' + (e.message || 'Unknown error'));
    } finally {
      setIsEnding(false);
      setConfirmingEnd(false);
    }
  }

  function handleLockMeeting() {
    toast.info('Feature coming soon');
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Lock meeting */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2 justify-start"
        onClick={handleLockMeeting}
      >
        <Lock className="w-3.5 h-3.5" />
        Lock Meeting
      </Button>

      {/* End meeting for everyone */}
      {confirmingEnd ? (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2 text-destructive text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Cancel meeting for everyone?
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 text-xs"
              onClick={handleEndMeeting}
              disabled={isEnding}
            >
              {isEnding ? 'Canceling…' : 'Cancel for All'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setConfirmingEnd(false)}
              disabled={isEnding}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="destructive"
          size="sm"
          className="gap-2 justify-start"
          onClick={handleEndMeeting}
        >
          <PhoneOff className="w-3.5 h-3.5" />
          Cancel Meeting for Everyone
        </Button>
      )}
    </div>
  );
}
