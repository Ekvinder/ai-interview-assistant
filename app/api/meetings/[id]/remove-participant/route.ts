import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { MeetingService } from '@/services/meeting.service';
import { livekitClient } from '@/lib/livekit';
import { createResponse } from '@/utils/response';

/**
 * POST /api/meetings/[id]/remove-participant
 * Body: { participantIdentity: string }
 *
 * Host-only. Removes a participant from the LiveKit room.
 * [id] here is the public meetingId string.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return createResponse(false, 'Unauthorized', null, 401);

    const { id: meetingId } = await params;
    const { participantIdentity } = await req.json() as { participantIdentity: string };

    if (!participantIdentity) {
      return createResponse(false, 'participantIdentity is required', null, 400);
    }

    // Verify caller is the host
    const meeting = await MeetingService.getMeetingByMeetingId(meetingId);
    const hostId = meeting.host._id?.toString() ?? meeting.host.toString();
    if (hostId !== user.userId) {
      return createResponse(false, 'Only the host can remove participants', null, 403);
    }

    // Remove via LiveKit server API
    await livekitClient.removeParticipant(meetingId, participantIdentity);

    return createResponse(true, 'Participant removed', null);
  } catch (error: unknown) {
    console.error('POST remove-participant error:', error);
    const err = error as { statusCode?: number; message?: string };
    return createResponse(false, err.message || 'Failed to remove participant', null, err.statusCode || 500);
  }
}
