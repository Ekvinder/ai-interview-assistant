import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { MeetingService } from '@/services/meeting.service';
import { createResponse } from '@/utils/response';
import { paginatedResponse } from '@/utils/api-response';
import { createMeetingSchema } from '@/validators/meeting.validator';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    let result;
    if (type === 'history') {
      result = await MeetingService.getMeetingHistory(user.userId, page, limit);
    } else {
      result = await MeetingService.getUpcomingMeetings(user.userId, page, limit);
    }

    return paginatedResponse(result.meetings, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages
    }, 'Meetings fetched successfully');
  } catch (error: unknown) {
    console.error('GET /api/meetings error:', error);
    const err = error as { statusCode?: number, message?: string };
    const status = err.statusCode || 500;
    return createResponse(false, err.message || 'Internal Server Error', null, status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const body = await req.json();
    const validatedData = createMeetingSchema.parse(body);

    const meeting = await MeetingService.createMeeting(user.userId, validatedData);
    return createResponse(true, 'Meeting created successfully', meeting, 201);
  } catch (error: unknown) {
    console.error('POST /api/meetings error:', error);
    if (error instanceof z.ZodError) {
      return createResponse(false, 'Validation Error', error.issues, 400);
    }
    const err = error as { statusCode?: number, message?: string };
    const status = err.statusCode || 500;
    return createResponse(false, err.message || 'Internal Server Error', null, status);
  }
}
