/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { forwardRef, useImperativeHandle, useEffect } from 'react';
import { MeetingCard } from './MeetingCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Eye } from 'lucide-react';
import { useMeetings } from '@/hooks/useMeetings';
import Link from 'next/link';
import { toast } from 'sonner';

export interface RecentMeetingsRef {
  refresh: () => void;
}

export const RecentMeetings = forwardRef<RecentMeetingsRef>(
  function RecentMeetings(_, ref) {
    const { data, loading, error, refresh, page, setPage } = useMeetings({ type: 'history', limit: 4 });

    useImperativeHandle(ref, () => ({ refresh }));

    useEffect(() => {
      if (error) {
        toast.error(error);
      }
    }, [error]);

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
          <p className="mb-4 text-sm">No Recent Meetings</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {meetings.map((meeting: any) => (
          <MeetingCard
            key={meeting._id}
            title={meeting.title}
            date={new Date(meeting.createdAt).toLocaleDateString()}
            time={new Date(meeting.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            status={meeting.status}
            host={meeting.host?.name || meeting.host?.email || 'Unknown'}
            participantCount={meeting.participants?.length || 0}
            actions={
              <Link href={`/meeting/${meeting.meetingId}`}>
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" /> View Details
                </Button>
              </Link>
            }
          />
        ))}

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
