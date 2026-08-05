import { NextRequest, NextResponse } from "next/server";
import { generateLiveKitToken, getLiveKitRoomName } from "@/services/livekit.service";
import { getCurrentUser } from '@/lib/auth';
import { MeetingService } from '@/services/meeting.service';

export async function POST(request: NextRequest) {
  try {
    const { roomName, identity, name, metadata, meetingId, breakoutRoomId } = await request.json();
    const actualMeetingId = meetingId || roomName;
    
    let targetRoomName = roomName; // default to passed roomName
    let finalMetadata = metadata;
    
    // This endpoint is also used by the separate interview feature. Apply the
    // admission check only when actualMeetingId identifies a MeetSpace meeting.
    try {
      const meeting = await MeetingService.getMeetingByMeetingId(actualMeetingId);
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      if (identity !== user.userId) {
        return NextResponse.json({ success: false, message: 'Invalid room identity' }, { status: 403 });
      }
      
      const hostId = meeting.host._id?.toString() ?? meeting.host.toString();
      const isHost = (hostId === user.userId);
      
      // A JWT is the capability to enter a LiveKit room. Never mint one for a
      // pending or denied guest, even if they call this endpoint directly.
      if (!isHost) {
        const { status } = await MeetingService.getJoinRequestStatus(user.userId, actualMeetingId);
        if (status !== 'approved') {
          return NextResponse.json({ success: false, message: 'Waiting for host approval' }, { status: 403 });
        }
      }
      
      // --- Breakout Rooms Validation ---
      if (breakoutRoomId && breakoutRoomId !== 'main') {
        if (!meeting.breakoutRoomsActive) {
          return NextResponse.json({ success: false, message: 'Breakout rooms are not active' }, { status: 403 });
        }
        const breakoutRoom = meeting.breakoutRooms?.find((r: any) => r.id === breakoutRoomId);
        if (!breakoutRoom) {
          return NextResponse.json({ success: false, message: 'Breakout room not found' }, { status: 404 });
        }
        
        const isParticipant = breakoutRoom.participants?.some(
          (p: any) => p.toString() === user.userId,
        );
        if (!isHost && !isParticipant) {
          return NextResponse.json({ success: false, message: 'Not assigned to this breakout room' }, { status: 403 });
        }
        
        targetRoomName = getLiveKitRoomName(actualMeetingId, breakoutRoomId);
      }
      
      // Inject Breakout Metadata
      let parsedMetadata: any = {};
      try {
        if (metadata) parsedMetadata = JSON.parse(metadata);
      } catch (e) {
        // ignore parse errors if metadata isn't JSON
      }
      
      parsedMetadata = {
        ...parsedMetadata,
        meetingId: actualMeetingId,
        breakoutId: breakoutRoomId || 'main',
        isHost,
        participantRole: isHost ? 'host' : 'participant',
      };
      
      finalMetadata = JSON.stringify(parsedMetadata);
      
    } catch (error) {
      // A missing meeting means this is an interview room, whose existing token
      // semantics are intentionally unchanged. Re-throw operational failures.
      const err = error as { statusCode?: number };
      if (err.statusCode && err.statusCode !== 404) throw error;
    }

    const token = await generateLiveKitToken({
      roomName: targetRoomName,
      identity,
      name,
      metadata: finalMetadata,
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
