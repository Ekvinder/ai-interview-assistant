import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { InterviewService } from '@/services/interview.service';
import { HistoryTable } from './HistoryTable';

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const interviews = await InterviewService.listInterviews(user.userId);

  // Serialise Mongoose documents to plain objects for the Client Component
  const serialised = JSON.parse(JSON.stringify(interviews));

  return (
    <div className="flex-1 p-8 pt-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Interview History</h2>
          <p className="text-muted-foreground mt-2">
            Review your past performances and track your progress.
          </p>
        </div>
      </div>

      <HistoryTable interviews={serialised} />
    </div>
  );
}
