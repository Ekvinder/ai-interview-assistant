import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MeetingService } from '@/services/meeting.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { statusBadgeClass } from '@/components/dashboard/MeetingCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function MeetingPlaceholderPage({
  params,
}: {
  params: { meetingId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  let meeting;
  try {
    meeting = await MeetingService.getMeetingByMeetingId(params.meetingId);
  } catch {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <h1 className="text-2xl font-bold">Meeting Not Found</h1>
        <p className="text-muted-foreground">The meeting ID {params.meetingId} is invalid or has been deleted.</p>
        <Link href="/dashboard">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/20 p-8">
      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader className="text-center space-y-2 pb-6 border-b">
          <CardTitle className="text-3xl font-bold tracking-tight">{meeting.title}</CardTitle>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant="secondary" className="text-sm">ID: {meeting.meetingId}</Badge>
            <Badge variant="outline" className={`capitalize ${statusBadgeClass(meeting.status)}`}>
              {meeting.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Host</p>
              <p className="font-medium">{meeting.host.name || meeting.host.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Scheduled Time</p>
              <p className="font-medium">
                {new Date(meeting.scheduledFor || meeting.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Participants</p>
              <p className="font-medium">{meeting.participants?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-medium">{meeting.duration ? `${meeting.duration} min` : 'Not specified'}</p>
            </div>
          </div>
          
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center mt-8">
            <h3 className="text-lg font-semibold text-primary mb-2">Live Meeting Room</h3>
            <p className="text-sm text-muted-foreground">
              Live Meeting Room will be implemented in Phase 5.
            </p>
            <div className="mt-4">
              <Link href="/dashboard">
                <Button>Return to Dashboard</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
