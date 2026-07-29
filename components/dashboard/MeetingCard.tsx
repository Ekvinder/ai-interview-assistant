import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, User } from 'lucide-react';
import React from 'react';

interface MeetingCardProps {
  title: string;
  date: string;
  time: string;
  status: string;
  host: string;
  participantCount: number;
  actions?: React.ReactNode;
}

export function statusBadgeClass(status: string) {
  switch (status) {
    case 'completed':
    case 'ended':
      return 'bg-emerald-500/10 text-emerald-500';
    case 'active':
      return 'bg-blue-500/10 text-blue-500';
    case 'cancelled':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-yellow-500/10 text-yellow-500';
  }
}

export function MeetingCard({
  title,
  date,
  time,
  status,
  host,
  participantCount,
  actions
}: MeetingCardProps) {
  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <CardTitle className="text-lg font-semibold line-clamp-1" title={title}>
          {title}
        </CardTitle>
        <Badge variant="outline" className={`ml-2 capitalize ${statusBadgeClass(status)}`}>
          {status}
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pt-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>{time}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <span className="line-clamp-1">Host: {host}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>{participantCount} Participant{participantCount !== 1 ? 's' : ''}</span>
        </div>
      </CardContent>
      {actions && (
        <CardFooter className="pt-4 border-t gap-2 flex-wrap">
          {actions}
        </CardFooter>
      )}
    </Card>
  );
}
