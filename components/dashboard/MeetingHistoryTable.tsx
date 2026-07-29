/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
import { Search, Loader2, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMeetings } from '@/hooks/useMeetings';
import { statusBadgeClass } from './MeetingCard';

export function MeetingHistoryTable() {
  const [search, setSearch] = useState('');
  // For simplicity since the backend API does not actually take a status filter right now,
  // we will filter client-side over the fetched page, or just keep it simple.
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { data, loading, error, page, setPage, refresh } = useMeetings({ type: 'history', limit: 10 });

  const meetings = data?.meetings || [];
  
  const filtered = meetings.filter((item: any) => {
    const matchesSearch = item.title?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b pb-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select 
            className="border rounded px-3 py-2 text-sm w-full md:w-auto"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading history…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-48 text-destructive gap-2">
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Participants</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map((item: any) => (
                  <TableRow key={item._id} className="hover:bg-muted/50">
                    <TableCell className="font-medium pl-6">
                      {item.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${statusBadgeClass(item.status)}`}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(item.scheduledFor || item.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {item.duration ? `${item.duration} min` : '—'}
                    </TableCell>
                    <TableCell>
                      {item.participants?.length || 0}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Link href={`/meeting/${item.meetingId}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <FileText className="w-8 h-8 opacity-20" />
                      <p className="text-sm">
                        {search || statusFilter !== 'all'
                          ? 'No meetings match your filters.'
                          : 'No meeting history yet.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t text-sm text-muted-foreground">
              <span>
                Page {data.page} of {data.totalPages}
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={data.page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={data.page >= data.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
