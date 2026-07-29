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

interface CreateMeetingDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactElement;
}

export function CreateMeetingDialog({ onSuccess, trigger }: CreateMeetingDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [isInstant, setIsInstant] = useState(true);
  const [scheduledFor, setScheduledFor] = useState('');
  const [duration, setDuration] = useState(30);
  const [isPrivate, setIsPrivate] = useState(false);
  const [settings, setSettings] = useState({
    allowChat: true,
    allowCamera: true,
    allowMic: true,
    allowScreenShare: true,
    waitingRoom: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await meetingClientService.createMeeting({
        title,
        isInstant,
        isPrivate,
        duration: Number(duration),
        scheduledFor: !isInstant && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        settings
      });
      alert('Meeting created successfully!');
      setOpen(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      // If validation error from Zod, it might be an array
      if (Array.isArray(err)) {
        setError(err.map(e => e.message).join(', '));
      } else {
        setError(err.message || 'Failed to create meeting');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger || (<Button id="create-meeting-trigger">Create Meeting</Button>)} />
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create a Meeting</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</div>}
          
          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              required
              minLength={3}
              maxLength={120}
              placeholder="e.g. Weekly Sync"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isInstant}
                onChange={e => setIsInstant(e.target.checked)}
              />
              Instant Meeting
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={e => setIsPrivate(e.target.checked)}
              />
              Private
            </label>
          </div>

          {!isInstant && (
            <div className="space-y-2">
              <Label htmlFor="scheduledFor">Schedule For</Label>
              <Input
                id="scheduledFor"
                type="datetime-local"
                required={!isInstant}
                value={scheduledFor}
                onChange={e => setScheduledFor(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min={5}
              max={240}
              required
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
            />
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>Settings</Label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(settings).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.checked }))}
                  />
                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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
