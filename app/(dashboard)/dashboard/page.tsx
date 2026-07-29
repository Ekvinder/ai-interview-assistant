import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UpcomingMeetings } from '@/components/dashboard/UpcomingMeetings';
import { RecentMeetings } from '@/components/dashboard/RecentMeetings';
import { CreateMeetingDialog } from '@/components/dashboard/CreateMeetingDialog';
import { JoinMeetingDialog } from '@/components/dashboard/JoinMeetingDialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, LogIn } from 'lucide-react';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Welcome back, {user.email.split('@')[0]}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Quick Actions */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-4 bg-muted/30">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <CreateMeetingDialog trigger={
              <Button className="h-14 px-6 gap-3 shadow-sm">
                <Play className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Create Meeting</div>
                  <div className="text-xs text-primary-foreground/80 font-normal">Start or schedule</div>
                </div>
              </Button>
            } />
            
            <JoinMeetingDialog trigger={
              <Button variant="outline" className="h-14 px-6 gap-3 bg-background">
                <LogIn className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Join Meeting</div>
                  <div className="text-xs text-muted-foreground font-normal">Enter a code</div>
                </div>
              </Button>
            } />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Upcoming Meetings</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <UpcomingMeetings currentUserId={user.userId} />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Recent Meetings</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <RecentMeetings />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
