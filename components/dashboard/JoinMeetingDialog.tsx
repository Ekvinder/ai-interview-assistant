/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { meetingClientService } from '@/services/client/meeting.service';
import { Loader2 } from 'lucide-react';

interface JoinMeetingDialogProps {
  trigger?: React.ReactElement;
}

export function JoinMeetingDialog({ trigger }: JoinMeetingDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestId] = useState(() => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
  const router = useRouter();

  useEffect(() => {
    if (open && isLoggedIn === null) {
      fetch('/api/auth/me', { cache: 'no-store' })
        .then(res => setIsLoggedIn(res.ok))
        .catch(() => setIsLoggedIn(false));
    }
  }, [open, isLoggedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingId.trim()) return;
    
    // Accept either a bare meeting ID or a full URL (e.g. pasted from clipboard).
    // Extract just the last path segment.
    let resolvedId = meetingId.trim();
    try {
      const url = new URL(resolvedId);
      // It's a valid URL — take the last non-empty path segment
      const segments = url.pathname.split('/').filter(Boolean);
      resolvedId = segments[segments.length - 1] ?? resolvedId;
    } catch {
      // Not a URL — use as-is
    }

    setLoading(true);
    setError(null);
    try {
      await meetingClientService.joinMeeting(resolvedId, isLoggedIn ? undefined : guestId, isLoggedIn ? undefined : guestName);
      
      // If guest, store the guestId and guestName in sessionStorage so other pages (like waiting room) can pick it up if they want.
      if (!isLoggedIn) {
        sessionStorage.setItem('meetspace_guest_id', guestId);
        sessionStorage.setItem('meetspace_guest_name', guestName);
      }
      
      setOpen(false);
      router.push(`/meeting/${resolvedId}`);
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('unauthorized')) {
        setIsLoggedIn(false);
        setError('Please provide a name to join as a guest');
      } else {
        setError(err.message || 'Failed to join meeting');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger || (<Button variant="outline">Join Meeting</Button>)} />
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Join a Meeting</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</div>}
          
          <div className="space-y-2">
            <Label htmlFor="meetingId">Meeting ID or Link</Label>
            <Input
              id="meetingId"
              required
              placeholder="e.g. 29af26bd68 or paste a meeting link"
              value={meetingId}
              onChange={e => setMeetingId(e.target.value)}
            />
          </div>

          {isLoggedIn === false && (
            <div className="space-y-2">
              <Label htmlFor="guestName">Your Name</Label>
              <Input
                id="guestName"
                required
                placeholder="Enter your name to join as guest"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !meetingId.trim()}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Join
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
