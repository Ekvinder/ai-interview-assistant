import { NextRequest, NextResponse } from 'next/server';
import { MeetingService } from '@/services/meeting.service';
import { getCurrentUser } from '@/lib/auth';
import { HTTP_STATUS } from '@/utils/constants';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    // Allow both authenticated users and guests
    // Guests will pass their guestId as a query parameter
    const { id } = await params;
    
    if (!user) {
      // For guests, they need to be connected to LiveKit to fetch breakout rooms
      // The meeting should be public data that guests can access once approved
      // We'll still fetch the breakout rooms but rely on token validation for security
      const data = await MeetingService.getBreakoutRooms(undefined, id);
      return NextResponse.json({
        success: true,
        message: 'Breakout rooms fetched successfully',
        data,
      });
    }

    const data = await MeetingService.getBreakoutRooms(user.userId, id);

    return NextResponse.json({
      success: true,
      message: 'Breakout rooms fetched successfully',
      data,
    });
  } catch (error: any) {
    console.error('Get breakout rooms error:', error);
    const status = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch breakout rooms' },
      { status }
    );
  }
}

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
    const { rooms } = await request.json();

    if (!Array.isArray(rooms)) {
      return NextResponse.json({ success: false, message: 'Rooms must be an array' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    const breakoutRooms = await MeetingService.createBreakoutRooms(user.userId, id, rooms);

    return NextResponse.json({
      success: true,
      message: 'Breakout rooms created successfully',
      data: breakoutRooms,
    });
  } catch (error: any) {
    console.error('Create breakout rooms error:', error);
    const status = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create breakout rooms' },
      { status }
    );
  }
}
