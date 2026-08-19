/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
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
import { toast } from 'sonner';

interface CreateMeetingDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactElement;
}

const DEFAULT_SETTINGS = {
  allowChat: true,
  allowCamera: true,
  allowMic: true,
  allowScreenShare: true,
  waitingRoom: false,
};

export function CreateMeetingDialog({ onSuccess, trigger }: CreateMeetingDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  // 'instant' | 'scheduled' — clearer than a boolean checkbox
  const [meetingType, setMeetingType] = useState<'instant' | 'scheduled'>('instant');
  const [scheduledFor, setScheduledFor] = useState('');
  const [scheduledForError, setScheduledForError] = useState<string | null>(null);

  const [isPrivate, setIsPrivate] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const resetForm = () => {
    setTitle('');
    setMeetingType('instant');
    setScheduledFor('');
    setScheduledForError(null);
    // setDuration(30);
    setIsPrivate(false);
    setSettings(DEFAULT_SETTINGS);
    setError(null);
  };

  const validate = (): boolean => {
    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters.');
      return false;
    }
    if (meetingType === 'scheduled') {
      if (!scheduledFor) {
        setScheduledForError('Please select a date and time.');
        return false;
      }
      const picked = new Date(scheduledFor);
      if (isNaN(picked.getTime())) {
        setScheduledForError('Invalid date and time.');
        return false;
      }
      if (picked <= new Date()) {
        setScheduledForError('Scheduled time must be in the future.');
        return false;
      }
    }
    setScheduledForError(null);
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);
    try {
      await meetingClientService.createMeeting({
        title: title.trim(),
        isInstant: meetingType === 'instant',
        isPrivate,
        duration: undefined,
        scheduledFor:
          meetingType === 'scheduled' && scheduledFor
            ? new Date(scheduledFor).toISOString()
            : undefined,
        settings,
      });
      toast.success('Meeting created successfully!');
      setOpen(false);
      resetForm();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      if (Array.isArray(err)) {
        const msg = err.map((e: any) => e.message).join(', ');
        setError(msg);
        toast.error(msg);
      } else {
        const msg = err.message || 'Failed to create meeting';
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger render={trigger || (<Button id="create-meeting-trigger">Create Meeting</Button>)} />
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create a Meeting</DialogTitle>
        </DialogHeader>

        {/* noValidate disables browser native validation — we handle it ourselves */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              placeholder="e.g. Weekly Sync"
              value={title}
              onChange={e => { setTitle(e.target.value); setError(null); }}
            />
          </div>

          {/* Meeting type — radio buttons, not confusing checkboxes */}
          <div className="space-y-2">
            <Label>Meeting Type</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="meetingType"
                  value="instant"
                  checked={meetingType === 'instant'}
                  onChange={() => { setMeetingType('instant'); setScheduledForError(null); }}
                />
                Instant (start now)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="meetingType"
                  value="scheduled"
                  checked={meetingType === 'scheduled'}
                  onChange={() => setMeetingType('scheduled')}
                />
                Schedule for later
              </label>
            </div>
          </div>

          {/* Date/time — only shown for scheduled, never required by browser */}
          {meetingType === 'scheduled' && (
            <div className="space-y-2">
              <Label htmlFor="scheduledFor">Date &amp; Time</Label>
              <Input
                id="scheduledFor"
                type="datetime-local"
                value={scheduledFor}
                onChange={e => { setScheduledFor(e.target.value); setScheduledForError(null); }}
              />
              {scheduledForError && (
                <p className="text-xs text-red-500">{scheduledForError}</p>
              )}
            </div>
          )}

          {/* Private toggle */}
          {/* <div className="flex items-center gap-2">
            <input
              id="isPrivate"
              type="checkbox"
              checked={isPrivate}
              onChange={e => setIsPrivate(e.target.checked)}
              className="cursor-pointer"
            />
            <Label htmlFor="isPrivate" className="cursor-pointer font-normal">
              Private meeting
            </Label>
          </div> */}

          {/* Settings */}
          {/* <div className="border-t pt-4 space-y-2">
            <Label>Settings</Label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(Object.entries(settings) as [keyof typeof settings, boolean][]).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={e =>
                      setSettings(prev => ({ ...prev, [key]: e.target.checked }))
                    }
                  />
                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                </label>
              ))}
            </div>
          </div> */}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
