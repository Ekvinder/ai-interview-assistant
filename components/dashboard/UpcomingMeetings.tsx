/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { MeetingCard } from './MeetingCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Play, Square, FileText } from 'lucide-react';
import { useMeetings } from '@/hooks/useMeetings';
import { meetingClientService } from '@/services/client/meeting.service';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { toast } from 'sonner';

interface UpcomingMeetingsProps {
  currentUserId: string;
}

export interface UpcomingMeetingsRef {
  refresh: () => void;
}

export const UpcomingMeetings = forwardRef<UpcomingMeetingsRef, UpcomingMeetingsProps>(
  function UpcomingMeetings({ currentUserId }, ref) {
    const { data, loading, error, refresh, page, setPage } = useMeetings({ type: 'upcoming', limit: 4 });
    const router = useRouter();
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({ refresh }));

    // Show API error via toast
    useEffect(() => {
      if (error) {
        toast.error(error);
      }
    }, [error]);

    const handleCopyLink = (meetingId: string) => {
      const link = `${window.location.origin}/meeting/${meetingId}`;
      navigator.clipboard.writeText(link).then(() => {
        toast.success('Meeting link copied to clipboard!');
      }).catch(() => {
        toast.error('Failed to copy link');
      });
    };

    const handleJoin = async (meetingId: string) => {
      try {
        setLoadingAction(`join-${meetingId}`);
        await meetingClientService.joinMeeting(meetingId);
        router.push(`/meeting/${meetingId}`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to join meeting');
      } finally {
        setLoadingAction(null);
      }
    };

    const handleEnd = async (id: string) => {
      toast('End this meeting for everyone?', {
        action: {
          label: 'End Meeting',
          onClick: async () => {
            try {
              setLoadingAction(`end-${id}`);
              await meetingClientService.endMeeting(id);
              toast.success('Meeting ended');
              refresh();
            } catch (err: any) {
              toast.error(err.message || 'Failed to end meeting');
            } finally {
              setLoadingAction(null);
            }
          },
        },
        cancel: {
          label: 'Cancel',
          onClick: () => {},
        },
      });
    };

    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center p-6 bg-red-50 text-red-600 rounded-xl border border-red-100">
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={refresh}>Retry</Button>
        </div>
      );
    }

    const meetings = data?.meetings || [];

    if (meetings.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border rounded-xl border-dashed">
          <FileText className="h-10 w-10 mb-4 opacity-20" />
          <p className="mb-4 text-sm">No Upcoming Meetings</p>
          <Button variant="outline" onClick={() => document.getElementById('create-meeting-trigger')?.click()}>
            Create your first meeting
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {meetings.map((meeting: any) => {
          const isHost = meeting.host?._id?.toString() === currentUserId || meeting.host?.toString() === currentUserId;
          const isLoadingJoin = loadingAction === `join-${meeting.meetingId}`;
          const isLoadingEnd = loadingAction === `end-${meeting._id}`;

          return (
            <MeetingCard
              key={meeting._id}
              title={meeting.title}
              date={new Date(meeting.scheduledFor || meeting.createdAt).toLocaleDateString()}
              time={new Date(meeting.scheduledFor || meeting.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              status={meeting.status}
              host={meeting.host?.name || meeting.host?.email || 'Unknown'}
              participantCount={meeting.participants?.length || 0}
              actions={
                <>
                  <Button variant="outline" size="sm" onClick={() => handleCopyLink(meeting.meetingId)}>
                    <Copy className="w-4 h-4 mr-2" /> Copy Link
                  </Button>
                  <Button size="sm" onClick={() => handleJoin(meeting.meetingId)} disabled={isLoadingJoin}>
                    <Play className="w-4 h-4 mr-2" /> {isLoadingJoin ? 'Joining...' : 'Join'}
                  </Button>
                  {isHost && (
                    <Button variant="destructive" size="sm" onClick={() => handleEnd(meeting._id)} disabled={isLoadingEnd}>
                      <Square className="w-4 h-4 mr-2" /> {isLoadingEnd ? 'Ending...' : 'End'}
                    </Button>
                  )}
                </>
              }
            />
          );
        })}

        {data && data.totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    );
  }
);
