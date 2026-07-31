import { Types } from 'mongoose';
import { Meeting } from '../models/Meeting';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../utils/constants';
import { connectToDatabase } from '../lib/mongodb';
import type { CreateMeetingInput, UpdateMeetingInput } from '../validators/meeting.validator';
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
      
      const meeting = await Meeting.findOne({ meetingId }).populate('host', 'name email').populate('participants.user', 'name email');
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

  static async joinMeeting(userId: string, meetingId: string) {
    try {
      await connectToDatabase();
      
      const meeting = await Meeting.findOne({ meetingId });      if (!meeting) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      }
      
      const userObjectId = new Types.ObjectId(userId);
      
      // Check if user is already a participant
      const existingParticipant = meeting.participants.find(
        (p: { user: Types.ObjectId; isPresent: boolean; leftAt?: Date; joinedAt?: Date }) => p.user.toString() === userObjectId.toString()
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
      } else if (!existingParticipant.isPresent) {
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

  static async leaveMeeting(userId: string, meetingId: string) {
    try {
      await connectToDatabase();
      
      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Meeting not found');
      }
      
      const userObjectId = new Types.ObjectId(userId);
      const participant = meeting.participants.find(
        (p: { user: Types.ObjectId; isPresent: boolean; leftAt?: Date; joinedAt?: Date }) => p.user.toString() === userObjectId.toString()
      );
      
      if (participant) {
        participant.isPresent = false;
        participant.leftAt = new Date();
        await meeting.save();
      }
      
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
      meeting.participants.forEach((p: { user: Types.ObjectId; isPresent: boolean; leftAt?: Date; joinedAt?: Date }) => {
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
        status: 'ended'
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

  static async getUpcomingMeetings(userId: string, page = 1, limit = 10) {
    try {
      await connectToDatabase();
      
      const skip = (page - 1) * limit;
      const userObjectId = new Types.ObjectId(userId);

      // Upcoming = scheduled/active meetings where user is host or participant.
      // Instant meetings have no scheduledFor, so we cannot require that field.
      const query = {
        $or: [{ host: userObjectId }, { 'participants.user': userObjectId }],
        status: { $in: ['scheduled', 'active'] },
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
}