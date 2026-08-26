import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { MeetingService } from '@/services/meeting.service';
import { TranscriptService } from '@/services/transcript.service';
import { createResponse } from '@/utils/response';
import { z } from 'zod';

const transcriptSchema = z.object({
  speakerId: z.string(),
  speakerName: z.string(),
  message: z.string(),
  timestamp: z.number(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const { id } = await params;
    
    // Verify user has access to this meeting (host or participant)
    const meeting = await MeetingService.getMeetingByMeetingId(id);
    const isHost = meeting.host.toString() === user.userId;
    const isParticipant = meeting.participants.some(
      (p: any) => p.user?.toString() === user.userId
    );

    if (!isHost && !isParticipant) {
      return createResponse(false, 'Forbidden', null, 403);
    }

    const transcripts = await TranscriptService.getMeetingTranscript(id);
    return createResponse(true, 'Transcripts fetched successfully', transcripts);
  } catch (error: unknown) {
    console.error('GET /api/meetings/[id]/transcript error:', error);
    const err = error as { statusCode?: number, message?: string };
    const status = err.statusCode || 500;
    return createResponse(false, err.message || 'Internal Server Error', null, status);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const { id } = await params;
    
    const meeting = await MeetingService.getMeetingByMeetingId(id);
    const isHost = meeting.host.toString() === user.userId;
    const isParticipant = meeting.participants.some(
      (p: any) => p.user?.toString() === user.userId
    );

    if (!isHost && !isParticipant) {
      return createResponse(false, 'Forbidden', null, 403);
    }

    const body = await req.json();
    const validatedData = transcriptSchema.parse(body);

    const transcript = await TranscriptService.appendMeetingTranscript(
      id,
      validatedData.speakerId,
      validatedData.speakerName,
      validatedData.message,
      validatedData.timestamp
    );

    return createResponse(true, 'Transcript appended successfully', transcript);
  } catch (error: unknown) {
    console.error('POST /api/meetings/[id]/transcript error:', error);
    if (error instanceof z.ZodError) {
      return createResponse(false, 'Validation Error', error.issues, 400);
    }
    const err = error as { statusCode?: number, message?: string };
    const status = err.statusCode || 500;
    return createResponse(false, err.message || 'Internal Server Error', null, status);
  }
}
