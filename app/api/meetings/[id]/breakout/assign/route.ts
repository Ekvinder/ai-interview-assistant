import { NextRequest, NextResponse } from 'next/server';
import { MeetingService } from '@/services/meeting.service';
import { getCurrentUser } from '@/lib/auth';
import { HTTP_STATUS } from '@/utils/constants';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    }

    const { id } = await params;
    const { breakoutRoomId, participantId } = await request.json();

    if (!breakoutRoomId || !participantId) {
      return NextResponse.json({ success: false, message: 'breakoutRoomId and participantId are required' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const breakoutRooms = await MeetingService.assignParticipantToBreakoutRoom(user.userId, id, breakoutRoomId, participantId);

    return NextResponse.json({
      success: true,
      message: 'Participant assigned successfully',
      data: breakoutRooms,
    });
  } catch (error: any) {
    console.error('Assign participant to breakout room error:', error);
    const status = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to assign participant' },
      { status }
    );
  }
}
