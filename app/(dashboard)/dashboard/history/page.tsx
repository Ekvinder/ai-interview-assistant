'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Loader2, FileText } from 'lucide-react';
import { listInterviews, type Interview } from '@/lib/api';

function statusBadgeClass(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-500';
    case 'active':
      return 'bg-blue-500/10 text-blue-500';
    case 'cancelled':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-yellow-500/10 text-yellow-500';
  }
}

export default function HistoryPage() {
  const [search, setSearch] = useState('');
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await listInterviews();
        if (!cancelled) setInterviews(data);
      } catch (err: unknown) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error('Failed to load interview history.');
          setError(error.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = interviews.filter((item) =>
    item.role.toLowerCase().includes(search.toLowerCase())
  );

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

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-center justify-between gap-4 border-b pb-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by role…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading history…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 text-destructive gap-2">
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Role</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length > 0 ? (
                    filtered.map((item) => (
                      <TableRow key={item._id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium pl-6">
                          <Link
                            href={`/dashboard/interview/result/${item._id}`}
                            className="hover:underline"
                          >
                            {item.role}
                          </Link>
                        </TableCell>
                        <TableCell className="capitalize">{item.interviewType}</TableCell>
                        <TableCell className="capitalize">{item.difficulty}</TableCell>
                        <TableCell>
                          {item.actualDuration != null
                            ? `${item.actualDuration} min`
                            : `${item.duration} min planned`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusBadgeClass(item.status)}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-48 text-center"
                      >
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <FileText className="w-8 h-8 opacity-20" />
                          <p className="text-sm">
                            {search
                              ? 'No interviews match your search.'
                              : 'No interviews yet. Start your first one!'}
                          </p>
                          {!search && (
                            <Link href="/dashboard/interview/new">
                              <Button size="sm" variant="outline">
                                Start Interview
                              </Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {filtered.length > 0 && (
                <div className="flex items-center justify-between p-4 border-t text-sm text-muted-foreground">
                  <span>
                    Showing {filtered.length} of {interviews.length} interview
                    {interviews.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
