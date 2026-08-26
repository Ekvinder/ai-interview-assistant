'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Mic } from 'lucide-react';
import { TranscriptEvent } from '@/services/transcription/LiveKitTranscriptionService';

export interface TranscriptEntry {
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface TranscriptPanelProps {
  onClose: () => void;
  finalTranscripts: TranscriptEntry[];
  currentInterims: Map<string, TranscriptEntry>;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export default function TranscriptPanel({ onClose, finalTranscripts, currentInterims }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolledUp = useRef(false);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // If we are more than 50px away from the bottom, consider it scrolled up
    isScrolledUp.current = scrollHeight - scrollTop - clientHeight > 50;
  };

  // Auto-scroll to bottom on new transcripts
  useEffect(() => {
    if (!isScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [finalTranscripts.length, currentInterims.size]);

  const interims = Array.from(currentInterims.values()).filter(t => t.text.trim().length > 0);

  return (
    <div className="flex flex-col h-full bg-background border-l w-72 sm:w-80 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-sm">Transcript</h2>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose} aria-label="Close transcript">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Transcript list */}
      <div 
        className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {finalTranscripts.length === 0 && interims.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-8">No transcripts yet. Start speaking to see live transcriptions.</p>
        ) : (
          <>
            {finalTranscripts.map((entry, i) => (
              <div key={`final-${i}-${entry.timestamp}`} className="flex flex-col gap-0.5 items-start">
                <div className="flex items-baseline gap-2 text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">{entry.speakerName}</span>
                  <span>{formatTime(entry.timestamp)}</span>
                </div>
                <div className="text-sm text-foreground">
                  {entry.text}
                </div>
              </div>
            ))}
            {interims.map((entry, i) => (
              <div key={`interim-${entry.speakerId}`} className="flex flex-col gap-0.5 items-start opacity-70">
                <div className="flex items-baseline gap-2 text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">{entry.speakerName}</span>
                  <span>{formatTime(entry.timestamp)}</span>
                </div>
                <div className="text-sm text-foreground italic">
                  {entry.text}...
                </div>
              </div>
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer / Status */}
      <div className="border-t p-3 shrink-0 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>Live transcription</span>
        </div>
      </div>
    </div>
  );
}
