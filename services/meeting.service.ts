import { Types } from 'mongoose';
import { Meeting } from '../models/Meeting';
// User must be imported so Mongoose registers the schema before any query
// that calls .populate(...) with ref: 'User' executes.
import '../models/User';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../utils/constants';
import { connectToDatabase } from '../lib/mongodb';
import type { CreateMeetingInput, UpdateMeetingInput } from '../validators/meeting.validator';
import type { IParticipant, MeetingStatus } from '../types';
import crypto from 'crypto';

export class MeetingService {
  static async createMeeting(userId: string, input: CreateMeetingInput) {
    try {
      await connectToDatabase();
      
      const meetingId = crypto.randomBytes(5).toString('hex');
      
      const meeting = new Meeting({
        ...input,
        meetingId,
        host: new Types.ObjectId(userId),
        participants: [{
          user: new Types.ObjectId(userId),
          role: 'host',
          joinedAt: new Date(),
          isPresent: false
        }],
      });
      
      await meeting.save();
      return meeting;
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, err.message || 'Failed to create meeting');
    }
  }

  static async getMeetingById(id: string) {
    try {
      await connectToDatabase();
      
      if (!Types.ObjectId.isValid(id)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid meeting ID format');
      }
      
      const meeting = await Meeting.findById(id).populate('host', 'name email').populate('participants.user', 'name email');
      if (!meeting) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      }
      
      return meeting;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to fetch meeting');
    }
  }

  static async getMeetingByMeetingId(meetingId: string) {
    try {
      await connectToDatabase();
      
      // Use primary read preference to ensure we get the latest meeting data
      const meeting = await Meeting.findOne({ meetingId }).populate('host', 'name email').populate('participants.user', 'name email').read('primary');
      if (!meeting) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      }
      
      return meeting;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to fetch meeting');
    }
  }

  static async updateMeeting(userId: string, id: string, input: UpdateMeetingInput) {
    try {
      await connectToDatabase();
      
      if (!Types.ObjectId.isValid(id)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid meeting ID format');
      }
      
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      }
      
      if (meeting.host.toString() !== userId) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only host can update meeting');
      }
      
      Object.assign(meeting, input);
      await meeting.save();
      return meeting;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, err.message || 'Failed to update meeting');
    }
  }

  static async deleteMeeting(userId: string, id: string) {
    try {
      await connectToDatabase();
      
      if (!Types.ObjectId.isValid(id)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid meeting ID format');
      }
      
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      }
      
      if (meeting.host.toString() !== userId) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only host can delete meeting');
      }
      
      // Soft delete by ending the meeting
      meeting.status = 'ended';
      meeting.endedAt = new Date();
      meeting.endedBy = new Types.ObjectId(userId);
      await meeting.save();
      
      return meeting;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to delete meeting');
    }
  }

  static async joinMeeting(userId: string | undefined, meetingId: string, guestId?: string, guestName?: string) {
    try {
      await connectToDatabase();
      
      const meeting = await Meeting.findOne({ meetingId });      if (!meeting) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      }
      
      let existingParticipant;
      if (userId) {
        const userObjectId = new Types.ObjectId(userId);
        existingParticipant = meeting.participants.find(
          (p: { user?: Types.ObjectId; isPresent: boolean; leftAt?: Date; joinedAt?: Date }) => p.user?.toString() === userObjectId.toString()
        );
        
        if (!existingParticipant) {
          meeting.participants.push({
            user: userObjectId,
            role: meeting.host.toString() === userId ? 'host' : 'participant',
            joinedAt: new Date(),
            isPresent: true,
            micEnabled: meeting.settings?.allowMic ?? true,
            cameraEnabled: meeting.settings?.allowCamera ?? true,
            handRaised: false
          });
          await meeting.save();
        }
      } else if (guestId) {
        existingParticipant = meeting.participants.find(
          (p: { guestId?: string; isPresent: boolean; leftAt?: Date; joinedAt?: Date }) => p.guestId === guestId
        );
        
        if (!existingParticipant) {
          meeting.participants.push({
            guestId,
            guestName,
            role: 'participant',
            joinedAt: new Date(),
            isPresent: true,
            micEnabled: meeting.settings?.allowMic ?? true,
            cameraEnabled: meeting.settings?.allowCamera ?? true,
            handRaised: false
          });
          await meeting.save();
        }
      } else {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Must provide userId or guestId');
      }

      if (existingParticipant && !existingParticipant.isPresent) {
        existingParticipant.isPresent = true;
        existingParticipant.joinedAt = new Date();
        await meeting.save();
      }
      
      return meeting;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to join meeting');
    }
  }

  /**
   * Records a guest's request without admitting them to the meeting. The host is
   * admitted immediately because they own the room.
   */
  static async requestJoin(userId: string | undefined, meetingId: string, guestId?: string, guestName?: string) {
    await connectToDatabase();
    // Use primary read preference to avoid replication lag issues in production
    const meeting = await Meeting.findOne({ meetingId }).read('primary');
    if (!meeting) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
    if (meeting.status === 'ended') throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'This meeting has ended');

    if (userId && meeting.host.toString() === userId) {
      await this.joinMeeting(userId, meetingId);
      return { status: 'approved' as const };
    }

    let request;
    let participant;
    if (userId) {
      const userObjectId = new Types.ObjectId(userId);
      const requests = meeting.joinRequests ?? [];
      request = requests.find((r: { user?: Types.ObjectId }) => r.user?.toString() === userId);
      participant = meeting.participants.find((p: { user?: Types.ObjectId; isPresent: boolean }) => p.user?.toString() === userId);
      
      const needsNewApproval = request?.status === 'approved' && !participant?.isPresent;
      if (!request || request.status === 'denied' || needsNewApproval) {
        if (request) {
          request.status = 'pending';
          request.requestedAt = new Date();
          request.decidedAt = undefined;
        } else {
          meeting.joinRequests.push({ user: userObjectId, status: 'pending', requestedAt: new Date() });
        }
        await meeting.save();
        return { status: 'pending' as const };
      }
    } else if (guestId) {
      const requests = meeting.joinRequests ?? [];
      request = requests.find((r: { guestId?: string }) => r.guestId === guestId);
      participant = meeting.participants.find((p: { guestId?: string; isPresent: boolean }) => p.guestId === guestId);
      
      const needsNewApproval = request?.status === 'approved' && !participant?.isPresent;
      if (!request || request.status === 'denied' || needsNewApproval) {
        if (request) {
          request.status = 'pending';
          request.requestedAt = new Date();
          request.decidedAt = undefined;
          request.guestName = guestName;
        } else {
          meeting.joinRequests.push({ guestId, guestName, status: 'pending', requestedAt: new Date() });
        }
        await meeting.save();
        return { status: 'pending' as const };
      }
    } else {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Must provide userId or guestId');
    }
    return { status: request.status as 'pending' | 'approved' | 'denied' };
  }

  static async getJoinRequestStatus(userId: string | undefined, meetingId: string, guestId?: string) {
    await connectToDatabase();
    // Use primary read preference to avoid replication lag issues in production
    const meeting = await Meeting.findOne({ meetingId }).select('host joinRequests status').read('primary');
    if (!meeting) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
    if (userId && meeting.host.toString() === userId) return { status: 'approved' as const };
    
    let request;
    if (userId) {
      request = (meeting.joinRequests ?? []).find((r: { user?: Types.ObjectId }) => r.user?.toString() === userId);
    } else if (guestId) {
      request = (meeting.joinRequests ?? []).find((r: { guestId?: string }) => r.guestId === guestId);
    }
    return { status: (request?.status ?? 'pending') as 'pending' | 'approved' | 'denied' };
  }

  static async getPendingJoinRequests(hostUserId: string, meetingId: string) {
    await connectToDatabase();
    // Use primary read preference to avoid replication lag issues in production
    const meeting = await Meeting.findOne({ meetingId }).populate('joinRequests.user', 'name email').read('primary');
    if (!meeting) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
    if (meeting.host.toString() !== hostUserId) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only the host can view join requests');
    return (meeting.joinRequests ?? [])
      .filter((request: { status: string }) => request.status === 'pending')
      .map((request: any) => {
        let userIdStr = request.guestId;
        let nameStr = request.guestName || 'Guest';
        if (request.user) {
          if (request.user._id) {
            userIdStr = request.user._id.toString();
            nameStr = request.user.name || request.user.email || 'Guest';
          } else {
            userIdStr = request.user.toString();
          }
        }
        return {
          userId: userIdStr,
          name: nameStr,
          requestedAt: request.requestedAt,
        };
      });
  }

  static async decideJoinRequest(hostUserId: string, meetingId: string, guestUserId: string, approved: boolean) {
    await connectToDatabase();
    // Use primary read preference to avoid replication lag issues in production
    const meeting = await Meeting.findOne({ meetingId }).read('primary');
    if (!meeting) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
    if (meeting.host.toString() !== hostUserId) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only the host can decide join requests');
    const request = (meeting.joinRequests ?? []).find((r: { user?: Types.ObjectId; guestId?: string }) => r.user?.toString() === guestUserId || r.guestId === guestUserId);
    if (!request || request.status !== 'pending') throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Join request is no longer pending');

    request.status = approved ? 'approved' : 'denied';
    request.decidedAt = new Date();
    await meeting.save();
    
    if (approved) {
      if (request.user) {
        await this.joinMeeting(guestUserId, meetingId);
      } else {
        await this.joinMeeting(undefined, meetingId, request.guestId, request.guestName);
      }
    }
    return { status: request.status as 'approved' | 'denied' };
  }

  static async leaveMeeting(userId: string | undefined, meetingId: string, guestId?: string) {
    try {
      await connectToDatabase();
      
      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      }
      
      let participant;
      if (userId) {
        const userObjectId = new Types.ObjectId(userId);
        participant = meeting.participants.find(
          (p: { user?: Types.ObjectId; isPresent: boolean; leftAt?: Date; joinedAt?: Date }) => p.user?.toString() === userObjectId.toString()
        );
      } else if (guestId) {
        participant = meeting.participants.find(
          (p: { guestId?: string; isPresent: boolean; leftAt?: Date; joinedAt?: Date }) => p.guestId === guestId
        );
      }
      
      if (participant) {
        participant.isPresent = false;
        participant.leftAt = new Date();
      }

      if (!participant) {
        meeting.joinRequests = (meeting.joinRequests ?? []).filter(
          (request: { user?: Types.ObjectId; guestId?: string; status: string }) =>
            (userId && request.user?.toString() !== userId) || 
            (guestId && request.guestId !== guestId) || 
            request.status !== 'pending'
        );
      }
      await meeting.save();
      
      return meeting;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to leave meeting');
    }
  }

  static async endMeeting(userId: string, id: string) {
    try {
      await connectToDatabase();
      
      if (!Types.ObjectId.isValid(id)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid meeting ID format');
      }
      
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      }
      
      if (meeting.host.toString() !== userId) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only host can end meeting');
      }
      
      meeting.status = 'ended';
      meeting.endedAt = new Date();
      meeting.endedBy = new Types.ObjectId(userId);
      
      if (meeting.startedAt) {
        meeting.duration = Math.round((meeting.endedAt.getTime() - meeting.startedAt.getTime()) / 60000);
      }
      
      // Mark all participants as left
      meeting.participants.forEach((p: IParticipant) => {
        if (p.isPresent) {
          p.isPresent = false;
          p.leftAt = new Date();
        }
      });
      
      await meeting.save();
      
      return meeting;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to end meeting');
    }
  }

  static async getMeetingHistory(userId: string, page = 1, limit = 10) {
    try {
      await connectToDatabase();
      
      const skip = (page - 1) * limit;
      const userObjectId = new Types.ObjectId(userId);
      
      // Match meetings where user is host or participant
      const query = {
        $or: [{ host: userObjectId }, { 'participants.user': userObjectId }],
        status: 'ended' as MeetingStatus
      };
      
      const [meetings, total] = await Promise.all([
        Meeting.find(query)
          .sort({ endedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('host', 'name email')
          .lean(),
        Meeting.countDocuments(query)
      ]);
      
      return { meetings, total, page, limit, totalPages: Math.ceil(total / limit) };
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to fetch meeting history');
    }
  }

  static async saveWhiteboard(meetingId: string, dataUrl: string) {
    try {
      await connectToDatabase();
      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      }
      meeting.whiteboardData = dataUrl;
      await meeting.save();
      return { saved: true };
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to save whiteboard');
    }
  }

  static async loadWhiteboard(meetingId: string) {
    try {
      await connectToDatabase();
      const meeting = await Meeting.findOne({ meetingId }).select('whiteboardData');
      if (!meeting) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      }
      return { whiteboardData: meeting.whiteboardData ?? '' };
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to load whiteboard');
    }
  }

  static async getUpcomingMeetings(userId: string, page = 1, limit = 10) {
    try {
      await connectToDatabase();
      
      const skip = (page - 1) * limit;
      const userObjectId = new Types.ObjectId(userId);

      // Upcoming = scheduled/active meetings where user is host or participant.
      // Instant meetings have no scheduledFor, so we cannot require that field.
      const query = {
        $or: [{ host: userObjectId }, { 'participants.user': userObjectId }],
        status: { $in: ['scheduled', 'active'] as MeetingStatus[] },
      };
      
      const [meetings, total] = await Promise.all([
        Meeting.find(query)
          .sort({ scheduledFor: 1 })
          .skip(skip)
          .limit(limit)
          .populate('host', 'name email')
          .lean(),
        Meeting.countDocuments(query)
      ]);
      
      return { meetings, total, page, limit, totalPages: Math.ceil(total / limit) };
    } catch (error: unknown) {
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to fetch upcoming meetings');
    }
  }

  // --- Breakout Room Methods ---
  static async getBreakoutRooms(userId: string, meetingId: string) {
    try {
      await connectToDatabase();
      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');

      // READ is allowed for the host and any approved participant.
      // WRITE operations (create, assign, status) keep the host-only guard.
      const isHost = meeting.host.toString() === userId;
      const isParticipant = meeting.participants.some(
        (p: IParticipant) => p.user?.toString() === userId
      );
      if (!isHost && !isParticipant) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Not a member of this meeting');
      }

      return {
        breakoutRooms: meeting.breakoutRooms || [],
        breakoutRoomsActive: meeting.breakoutRoomsActive || false
      };
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to get breakout rooms');
    }
  }

  static async createBreakoutRooms(userId: string, meetingId: string, rooms: { id: string, name: string }[]) {
    try {
      await connectToDatabase();
      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      if (meeting.host.toString() !== userId) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only host can manage breakout rooms');

      meeting.breakoutRooms = rooms.map(r => ({ id: r.id, name: r.name, participants: [] }));
      meeting.breakoutRoomsActive = false;
      await meeting.save();
      return meeting.breakoutRooms;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to create breakout rooms');
    }
  }

  static async updateBreakoutRoomsStatus(userId: string, meetingId: string, isActive: boolean) {
    try {
      await connectToDatabase();
      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      if (meeting.host.toString() !== userId) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only host can manage breakout rooms');

      meeting.breakoutRoomsActive = isActive;
      await meeting.save();
      return { active: meeting.breakoutRoomsActive };
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to update breakout rooms status');
    }
  }

  static async assignParticipantToBreakoutRoom(userId: string, meetingId: string, breakoutRoomId: string, participantId: string) {
    try {
      await connectToDatabase();
      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      if (meeting.host.toString() !== userId) throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only host can manage breakout rooms');

      // Remove from all existing breakout rooms first
      (meeting.breakoutRooms ?? []).forEach((room: any) => {
        room.participants = room.participants.filter((p: Types.ObjectId) => p.toString() !== participantId);
      });

      if (breakoutRoomId && breakoutRoomId !== 'main') {
        const room = (meeting.breakoutRooms ?? []).find((r: any) => r.id === breakoutRoomId);
        if (!room) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Breakout room not found');
        room.participants.push(new Types.ObjectId(participantId));
      }

      await meeting.save();
      return meeting.breakoutRooms;
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      const err = error as { message?: string };
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Failed to assign participant to breakout room');
    }
  }
}
