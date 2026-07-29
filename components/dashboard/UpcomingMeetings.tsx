/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { MeetingCard } from './MeetingCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Play, Edit, Square, FileText } from 'lucide-react';
import { useMeetings } from '@/hooks/useMeetings';
import { meetingClientService } from '@/services/client/meeting.service';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface UpcomingMeetingsProps {
  currentUserId: string;
}

export function UpcomingMeetings({ currentUserId }: UpcomingMeetingsProps) {
  const { data, loading, error, refresh } = useMeetings({ type: 'upcoming', limit: 5 });
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleCopyLink = (meetingId: string) => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link);
    // Ideally use toast here, inline fallback
    alert('Meeting link copied to clipboard!');
  };

  const handleJoin = async (meetingId: string) => {
    try {
      setLoadingAction(`join-${meetingId}`);
      await meetingClientService.joinMeeting(meetingId);
      router.push(`/meeting/${meetingId}`);
    } catch (err: any) {
      alert(err.message || 'Failed to join meeting');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEnd = async (id: string) => {
    if (!confirm('Are you sure you want to end this meeting for everyone?')) return;
    try {
      setLoadingAction(`end-${id}`);
      await meetingClientService.endMeeting(id);
      refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to end meeting');
    } finally {
      setLoadingAction(null);
    }
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
        const isHost = meeting.host._id === currentUserId;
        const isLoadingJoin = loadingAction === `join-${meeting.meetingId}`;
        const isLoadingEnd = loadingAction === `end-${meeting._id}`;

        return (
          <MeetingCard
            key={meeting._id}
            title={meeting.title}
            date={new Date(meeting.scheduledFor || meeting.createdAt).toLocaleDateString()}
            time={new Date(meeting.scheduledFor || meeting.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            status={meeting.status}
            host={meeting.host.name || meeting.host.email}
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
                  <>
                    <Button variant="secondary" size="sm" onClick={() => alert('Edit dialog placeholder')}>
                      <Edit className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleEnd(meeting._id)} disabled={isLoadingEnd}>
                      <Square className="w-4 h-4 mr-2" /> {isLoadingEnd ? 'Ending...' : 'End'}
                    </Button>
                  </>
                )}
              </>
            }
          />
        );
      })}
    </div>
  );
}
