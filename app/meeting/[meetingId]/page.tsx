import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MeetingService } from '@/services/meeting.service';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/models/User';
import type { IMeeting } from '@/types';
import MeetingRoom from './MeetingRoom';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { MeetingEndedView } from './components/MeetingEndedView';

export const dynamic = 'force-dynamic';

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  // Auth guard
  const user = await getCurrentUser();
  
  const { meetingId } = await params;

  // ── Fetch full user profile for display name ─────────────────────────────
  let userName = '';
  let userEmail = '';
  
  if (!user) {
    // Guest user; proceed without redirect. Guest info will be read from sessionStorage.
    // No redirect to /login.
  } else {
    // Continue with authenticated user logic.
    await connectToDatabase();
    const dbUser = await User.findById(user.userId).select('name email').lean();
    userName = (dbUser as { name?: string; email: string } | null)?.name
      || (dbUser as { name?: string; email: string } | null)?.email
      || user.email;
    userEmail = user.email;
  }

  // ── Fetch and validate the meeting ──────────────────────────────────────
  let meeting: IMeeting | null = null;
  try {
    meeting = await MeetingService.getMeetingByMeetingId(meetingId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const isDatabaseIssue = /mongo|mongodb|server selection|timed out|ECONN|econn/i.test(message);

    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground opacity-40" />
        <h1 className="text-2xl font-bold">
          {isDatabaseIssue ? 'Unable to load meeting' : 'Meeting Not Found'}
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          {isDatabaseIssue
            ? 'The meeting service is temporarily unavailable. Please try again in a moment.'
            : <>The meeting ID{' '}<span className="font-mono font-semibold">{meetingId}</span> does not exist or has been removed.</>}
        </p>
        <Link href="/dashboard">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  // ── Guard against null (getMeetingByMeetingId may return null) ──────────
  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground opacity-40" />
        <h1 className="text-2xl font-bold">Meeting Not Found</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          The meeting ID{' '}
          <span className="font-mono font-semibold">{meetingId}</span> does not
          exist or has been removed.
        </p>
        <Link href="/dashboard">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  // ── Reject ended meetings ────────────────────────────────────────────────
  if (meeting.status === 'ended') {
    return <MeetingEndedView meetingId={meeting.meetingId} />;
  }

  // ── Hand off to the client room component ────────────────────────────────
  // meeting.host is the ObjectId of the host user
  const hostUserId = meeting.host._id?.toString() || meeting.host.toString();

  // Hosts are admitted on page entry; guests are admitted only by the approval
  // endpoint after an explicit host decision.
  if (user && hostUserId === user.userId) {
    try { await MeetingService.joinMeeting(user.userId, meetingId); } catch { /* surfaced by room if needed */ }
  }

  return (
    <MeetingRoom
      meeting={{
        title:     meeting.title,
        meetingId: meeting.meetingId,
        status:    meeting.status,
        _id:       meeting._id.toString(),
      }}
      userId={user?.userId || ''}
      userName={userName}
      userEmail={userEmail}
      hostUserId={hostUserId}
    />
  );
}
