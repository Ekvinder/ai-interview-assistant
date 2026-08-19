import { z } from 'zod';

export const createMeetingSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title cannot exceed 120 characters'),
  isInstant: z.boolean().optional().default(false),
  isPrivate: z.boolean().optional().default(false),
  scheduledFor: z.string().datetime().optional(),
  duration: z.number().int().min(5, 'Duration must be at least 5 minutes').max(240, 'Duration cannot exceed 240 minutes').optional(),
  settings: z.object({
    allowChat: z.boolean().optional().default(true),
    allowScreenShare: z.boolean().optional().default(true),
    allowMic: z.boolean().optional().default(true),
    allowCamera: z.boolean().optional().default(true),
    waitingRoom: z.boolean().optional().default(false),
  }).optional().default({
    allowChat: true,
    allowScreenShare: true,
    allowMic: true,
    allowCamera: true,
    waitingRoom: false,
  }),
});

export const updateMeetingSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  status: z.enum(['scheduled', 'active', 'ended']).optional(),
  isPrivate: z.boolean().optional(),
  scheduledFor: z.string().datetime().optional(),
  duration: z.number().int().min(5).max(240).optional(),
  settings: z.object({
    allowChat: z.boolean().optional(),
    allowScreenShare: z.boolean().optional(),
    allowMic: z.boolean().optional(),
    allowCamera: z.boolean().optional(),
    waitingRoom: z.boolean().optional(),
  }).optional(),
});

export const joinMeetingSchema = z.object({
  meetingId: z.string().min(1, 'Meeting ID is required').trim(),
  guestName: z.string().trim().optional(),
  guestId: z.string().trim().optional(),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type JoinMeetingInput = z.infer<typeof joinMeetingSchema>;
