import { NextRequest, NextResponse } from "next/server";
import { generateLiveKitToken } from "@/services/livekit.service";
import { getCurrentUser } from '@/lib/auth';
import { MeetingService } from '@/services/meeting.service';

export async function POST(request: NextRequest) {
  try {
    const { roomName, identity, name, metadata } = await request.json();
    // This endpoint is also used by the separate interview feature. Apply the
    // admission check only when roomName identifies a MeetSpace meeting.
    try {
      const meeting = await MeetingService.getMeetingByMeetingId(roomName);
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      if (identity !== user.userId) {
        return NextResponse.json({ success: false, message: 'Invalid room identity' }, { status: 403 });
      }
      // A JWT is the capability to enter a LiveKit room. Never mint one for a
      // pending or denied guest, even if they call this endpoint directly.
      const hostId = meeting.host._id?.toString() ?? meeting.host.toString();
      if (hostId !== user.userId) {
        const { status } = await MeetingService.getJoinRequestStatus(user.userId, roomName);
        if (status !== 'approved') {
          return NextResponse.json({ success: false, message: 'Waiting for host approval' }, { status: 403 });
        }
      }
    } catch (error) {
      // A missing meeting means this is an interview room, whose existing token
      // semantics are intentionally unchanged. Re-throw operational failures.
      const err = error as { statusCode?: number };
      if (err.statusCode && err.statusCode !== 404) throw error;
    }

    const token = await generateLiveKitToken({
      roomName,
      identity,
      name,
      metadata,
    });

    return NextResponse.json({
      success: true,
      token,
      url: process.env.LIVEKIT_URL,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to generate token",
      },
      {
        status: 500,
      }
    );
  }
}
