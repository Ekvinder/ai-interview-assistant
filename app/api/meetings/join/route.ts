import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { MeetingService } from '@/services/meeting.service';
import { createResponse } from '@/utils/response';
import { joinMeetingSchema } from '@/validators/meeting.validator';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const validatedData = joinMeetingSchema.parse(body);

    if (!user && (!validatedData.guestName || !validatedData.guestId)) {
      return createResponse(false, 'Unauthorized or missing guest info', null, 401);
    }

    const request = await MeetingService.requestJoin(
      user?.userId,
      validatedData.meetingId,
      validatedData.guestId,
      validatedData.guestName
    );
    return createResponse(true, request.status === 'approved' ? 'Join approved' : 'Join request submitted', request);
  } catch (error: unknown) {
    console.error('POST /api/meetings/join error:', error);
    if (error instanceof z.ZodError) {
      return createResponse(false, 'Validation Error', error.issues, 400);
    }
    const err = error as { statusCode?: number, message?: string };
    const status = err.statusCode || 500;
    return createResponse(false, err.message || 'Internal Server Error', null, status);
  }
}
