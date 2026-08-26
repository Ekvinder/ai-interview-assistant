'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Clock, FileText } from 'lucide-react';
import { MeetingTranscript } from './MeetingTranscript';

interface MeetingEndedViewProps {
  meetingId: string;
}

export function MeetingEndedView({ meetingId }: MeetingEndedViewProps) {
  const [showTranscript, setShowTranscript] = useState(false);

  if (showTranscript) {
    return (
      <div className="flex flex-col flex-1 p-4 md:p-8 space-y-4">
        <div className="flex justify-between items-center max-w-3xl mx-auto w-full">
          <Button variant="ghost" onClick={() => setShowTranscript(false)}>
            &larr; Back
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">Dashboard</Button>
          </Link>
        </div>
        <MeetingTranscript meetingId={meetingId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center h-screen">
      <Clock className="w-12 h-12 text-muted-foreground opacity-40" />
      <h1 className="text-2xl font-bold">Meeting Ended</h1>
      <p className="text-muted-foreground text-sm max-w-sm mb-4">
        This meeting has already ended and is no longer available to join.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => setShowTranscript(true)}>
          <FileText className="w-4 h-4 mr-2" />
          View Transcript
        </Button>
        <Link href="/dashboard">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
