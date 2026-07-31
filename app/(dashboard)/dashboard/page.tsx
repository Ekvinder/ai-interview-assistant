import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardMeetings } from '@/components/dashboard/DashboardMeetings';

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

      <DashboardMeetings currentUserId={user.userId} />
    </div>
  );
}
