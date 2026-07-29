import { Card, CardContent } from '@/components/ui/card';
import { MeetingHistoryTable } from '@/components/dashboard/MeetingHistoryTable';

export default function HistoryPage() {
  return (
    <div className="flex-1 p-8 pt-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Meeting History</h2>
          <p className="text-muted-foreground mt-2">
            Review your past and upcoming meetings here.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 sm:p-4">
          <MeetingHistoryTable />
        </CardContent>
      </Card>
    </div>
  );
}
