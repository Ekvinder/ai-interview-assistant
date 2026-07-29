import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { MeetingService } from '@/services/meeting.service';
import { createResponse } from '@/utils/response';
import { updateMeetingSchema } from '@/validators/meeting.validator';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const { id } = await params;
    
    // We try to fetch by internal _id first, if not found, we could fetch by meetingId 
    // but the service logic has two different methods. We'll assume the URL param is the `_id`.
    const meeting = await MeetingService.getMeetingById(id);
    return createResponse(true, 'Meeting fetched successfully', meeting);
  } catch (error: unknown) {
    console.error('GET /api/meetings/[id] error:', error);
    const err = error as { statusCode?: number, message?: string };
    const status = err.statusCode || 500;
    return createResponse(false, err.message || 'Internal Server Error', null, status);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = updateMeetingSchema.parse(body);

    const meeting = await MeetingService.updateMeeting(user.userId, id, validatedData);
    return createResponse(true, 'Meeting updated successfully', meeting);
  } catch (error: unknown) {
    console.error('PATCH /api/meetings/[id] error:', error);
    if (error instanceof z.ZodError) {
      return createResponse(false, 'Validation Error', error.issues, 400);
    }
    const err = error as { statusCode?: number, message?: string };
    const status = err.statusCode || 500;
    return createResponse(false, err.message || 'Internal Server Error', null, status);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const { id } = await params;
    await MeetingService.deleteMeeting(user.userId, id);
    return createResponse(true, 'Meeting deleted successfully');
  } catch (error: unknown) {
    console.error('DELETE /api/meetings/[id] error:', error);
    const err = error as { statusCode?: number, message?: string };
    const status = err.statusCode || 500;
    return createResponse(false, err.message || 'Internal Server Error', null, status);
  }
}
