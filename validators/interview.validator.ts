import { z } from 'zod';

export const InterviewCreateSchema = z.object({
  role: z.string().min(1, 'Role is required').trim(),
  interviewType: z.string().min(1, 'Interview type is required').trim(),
  difficulty: z.string().min(1, 'Difficulty is required').trim(),
  experience: z.string().min(1, 'Experience is required').trim(),
  duration: z.number().int().positive('Duration must be a positive integer'),
});

export const InterviewUpdateSchema = z.object({
  status: z.enum(['waiting', 'active', 'completed', 'cancelled']).optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
}).refine(
  (data) => data.status !== undefined || data.startedAt !== undefined || data.endedAt !== undefined,
  { message: 'At least one of status, startedAt, or endedAt must be provided' }
);

export type InterviewCreateInput = z.infer<typeof InterviewCreateSchema>;
export type InterviewUpdateInput = z.infer<typeof InterviewUpdateSchema>;
