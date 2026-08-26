'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TranscriptEntry {
  speakerId: string;
  speakerName: string;
  message: string;
  timestamp: number;
}

interface MeetingTranscriptProps {
  meetingId: string;
}

export function MeetingTranscript({ meetingId }: MeetingTranscriptProps) {
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTranscripts = async () => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/transcript`);
        const json = await res.json();
        
        if (!json.success) {
          throw new Error(json.message || 'Failed to fetch transcript');
        }
        
        setTranscripts(json.data || []);
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading transcripts');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTranscripts();
  }, [meetingId]);

  if (loading) {
    return (
      <Card className="w-full max-w-3xl mx-auto h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle>Meeting Transcript</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-3xl mx-auto flex flex-col p-8 items-center text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-xl font-semibold mb-2">Transcription Unavailable</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </Card>
    );
  }

  if (transcripts.length === 0) {
    return (
      <Card className="w-full max-w-3xl mx-auto flex flex-col p-12 items-center text-center">
        <FileText className="w-16 h-16 text-muted-foreground opacity-20 mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Transcript Found</h3>
        <p className="text-muted-foreground">
          There are no transcript records for this meeting.
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto h-[70vh] flex flex-col border shadow-sm">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Meeting Transcript
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-background">
        {transcripts.map((entry, index) => {
          const date = new Date(entry.timestamp);
          const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          
          const isConsecutive = index > 0 && transcripts[index - 1].speakerId === entry.speakerId;
          
          return (
            <div key={`${entry.speakerId}-${entry.timestamp}-${index}`} className={`flex flex-col ${isConsecutive ? 'mt-2' : 'mt-6'}`}>
              {!isConsecutive && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-foreground">{entry.speakerName}</span>
                  <span className="text-xs text-muted-foreground">{timeString}</span>
                </div>
              )}
              <div className="text-sm text-foreground/90 pl-[1px]">
                {entry.message}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
