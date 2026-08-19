import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { MeetingService } from '@/services/meeting.service';
import { createResponse } from '@/utils/response';

/**
 * POST /api/meetings/[id]/leave
 *
 * Marks the current user as having left the meeting.
 * Does NOT end the meeting for everyone — that is the host's responsibility.
 * The [id] segment here is the public meetingId string (e.g. "1a2b3c4d5e"),
 * not the internal MongoDB _id.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    
    // Attempt to read body for guestId. Not all leave requests will have a body.
    let guestId: string | undefined;
    try {
      const body = await _req.json();
      guestId = body?.guestId;
    } catch (e) {
      // Ignore JSON parse errors for empty bodies
    }

    if (!user && !guestId) {
      return createResponse(false, 'Unauthorized or missing guest info', null, 401);
    }

    const { id: meetingId } = await params;
    const meeting = await MeetingService.leaveMeeting(user?.userId, meetingId, guestId);
    return createResponse(true, 'Left meeting successfully', meeting);
  } catch (error: unknown) {
    console.error('POST /api/meetings/[id]/leave error:', error);
    const err = error as { statusCode?: number; message?: string };
    return createResponse(false, err.message || 'Internal Server Error', null, err.statusCode || 500);
  }
}
