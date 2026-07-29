import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Play, History, TrendingUp, BarChart2, Award } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Placeholder data for UI demonstration
  const stats = [
    { title: "Total Interviews", value: "12", icon: FileText },
    { title: "Average Score", value: "84%", icon: TrendingUp },
    { title: "Best Score", value: "95%", icon: Award },
    { title: "Completed", value: "10", icon: BarChart2 },
  ];

  const recentInterviews = [
    { id: '1', role: 'Frontend Engineer', date: '2026-07-25', score: 88, status: 'COMPLETED' },
    { id: '2', role: 'Backend Developer', date: '2026-07-22', score: 92, status: 'COMPLETED' },
    { id: '3', role: 'Full Stack Engineer', date: '2026-07-20', score: 75, status: 'COMPLETED' },
  ];

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Link href="/dashboard/interview/new">
            <Button className="gap-2">
              <Play className="h-4 w-4" />
              New Interview
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-7">
        <Card className="col-span-1 md:col-span-4">
          <CardHeader>
            <CardTitle>Recent Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            {recentInterviews.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInterviews.map((interview) => (
                    <TableRow key={interview.id}>
                      <TableCell className="font-medium">{interview.role}</TableCell>
                      <TableCell>{interview.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500">
                          {interview.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{interview.score}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <FileText className="h-8 w-8 mb-4 opacity-20" />
                <p>No recent interviews.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/dashboard/interview/new" className="block">
              <Button variant="outline" className="w-full justify-start h-14">
                <Play className="mr-2 h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">Start New Interview</div>
                  <div className="text-xs text-muted-foreground">Practice a new scenario</div>
                </div>
              </Button>
            </Link>
            <Link href="/dashboard/history" className="block">
              <Button variant="outline" className="w-full justify-start h-14">
                <History className="mr-2 h-5 w-5" />
                <div className="text-left">
                  <div className="font-semibold">View History</div>
                  <div className="text-xs text-muted-foreground">Review past performances</div>
                </div>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
