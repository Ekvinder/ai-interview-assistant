import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { MeetingService } from '@/services/meeting.service';
import { createResponse } from '@/utils/response';

/**
 * GET is deliberately dual-purpose: hosts receive pending requests; guests
 * receive only their own decision. No LiveKit connection is involved here.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(_req.url);
    const guestId = searchParams.get('guestId') ?? undefined;

    if (!user && !guestId) return createResponse(false, 'Unauthorized', null, 401);
    
    const { id: meetingId } = await params;
    const meeting = await MeetingService.getMeetingByMeetingId(meetingId);
    
    // Only a logged in user can be the host
    if (user) {
      const hostId = meeting.host._id?.toString() ?? meeting.host.toString();
      if (hostId === user.userId) {
        return createResponse(true, 'Pending join requests fetched', await MeetingService.getPendingJoinRequests(user.userId, meetingId));
      }
    }
    
    return createResponse(true, 'Join request status fetched', await MeetingService.getJoinRequestStatus(user?.userId, meetingId, guestId));
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    return createResponse(false, err.message || 'Failed to fetch join request', null, err.statusCode || 500);
  }
}

/** Host-only decision endpoint. Server validation is the admission boundary. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return createResponse(false, 'Unauthorized', null, 401);
    const { id: meetingId } = await params;
    const { userId, approved } = await req.json() as { userId?: string; approved?: boolean };
    if (!userId || typeof approved !== 'boolean') return createResponse(false, 'userId and approved are required', null, 400);
    const decision = await MeetingService.decideJoinRequest(user.userId, meetingId, userId, approved);
    return createResponse(true, approved ? 'Join request approved' : 'Join request denied', decision);
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    return createResponse(false, err.message || 'Failed to decide join request', null, err.statusCode || 500);
  }
}
