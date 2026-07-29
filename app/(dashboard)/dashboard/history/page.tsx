'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export default function HistoryPage() {
  const [search, setSearch] = useState('');

  // Dummy history data
  const history = [
    { id: '1', role: 'Frontend Engineer', date: '2026-07-25', duration: '45m', score: 88, status: 'COMPLETED' },
    { id: '2', role: 'Backend Developer', date: '2026-07-22', duration: '30m', score: 92, status: 'COMPLETED' },
    { id: '3', role: 'Full Stack Engineer', date: '2026-07-20', duration: '60m', score: 75, status: 'COMPLETED' },
    { id: '4', role: 'DevOps Engineer', date: '2026-07-18', duration: '15m', score: 0, status: 'CANCELED' },
    { id: '5', role: 'UI/UX Designer', date: '2026-07-15', duration: '45m', score: 85, status: 'COMPLETED' },
  ];

  const filteredHistory = history.filter(item => 
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
              placeholder="Search by role..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Interview Role</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium pl-6">
                      <Link href={`/dashboard/interview/result/${item.id}`} className="hover:underline">
                        {item.role}
                      </Link>
                    </TableCell>
                    <TableCell>{item.date}</TableCell>
                    <TableCell>{item.duration}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={
                          item.status === 'COMPLETED' 
                            ? 'bg-emerald-500/10 text-emerald-500' 
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {item.score > 0 ? `${item.score}%` : '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No interviews found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          <div className="flex items-center justify-end space-x-2 p-4 border-t">
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">Page 1 of 1</span>
            <Button variant="outline" size="sm" disabled>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
