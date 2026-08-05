import { NextRequest, NextResponse } from 'next/server';
import { MeetingService } from '@/services/meeting.service';
import { getCurrentUser } from '@/lib/auth';
import { HTTP_STATUS } from '@/utils/constants';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
    }

    const { id } = await params;
    const { isActive } = await request.json();

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ success: false, message: 'isActive must be a boolean' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const result = await MeetingService.updateBreakoutRoomsStatus(user.userId, id, isActive);

    return NextResponse.json({
      success: true,
      message: 'Breakout rooms status updated',
      data: result,
    });
  } catch (error: any) {
    console.error('Update breakout rooms status error:', error);
    const status = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update breakout rooms status' },
      { status }
    );
  }
}
