import { Types } from 'mongoose';
import { Interview } from '../models/Interview';
import { Evaluation } from '../models/Evaluation';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS } from '../utils/constants';
import { connectToDatabase } from '../lib/mongodb';
import type { InterviewCreateInput, InterviewUpdateInput } from '../validators/interview.validator';

/** Generate a unique room name for a LiveKit room. */
function generateRoomName(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `interview-${timestamp}-${random}`;
}

export class InterviewService {
  /** Create a new interview for the given user. Status defaults to "waiting". */
  static async createInterview(userId: string, data: InterviewCreateInput) {
    await connectToDatabase();

    // Ensure roomName is unique (retry once on collision — astronomically unlikely)
    let roomName = generateRoomName();
    const existing = await Interview.findOne({ roomName });
    if (existing) {
      roomName = generateRoomName();
    }

    const interview = await Interview.create({
      userId: new Types.ObjectId(userId),
      roomName,
      role: data.role,
      interviewType: data.interviewType,
      difficulty: data.difficulty,
      experience: data.experience,
      duration: data.duration,
      status: 'waiting',
    });

    return interview;
  }

  /** Return all interviews belonging to the user, newest first. */
  static async listInterviews(userId: string) {
    await connectToDatabase();
    const interviews = await Interview.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
    return interviews;
  }

  /** Return a single interview, verifying ownership. */
  static async getInterviewById(interviewId: string, userId: string) {
    await connectToDatabase();

    if (!Types.ObjectId.isValid(interviewId)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid interview ID');
    }

    const interview = await Interview.findOne({
      _id: new Types.ObjectId(interviewId),
      userId: new Types.ObjectId(userId),
    }).lean();

    if (!interview) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Interview not found');
    }

    return interview;
  }

  /** Update status and/or startedAt/endedAt timestamps. Verifies ownership.
   *  When endedAt is provided alongside an existing startedAt, actualDuration
   *  (in minutes, rounded to the nearest minute, minimum 1) is computed automatically.
   */
  static async updateInterview(interviewId: string, userId: string, updates: InterviewUpdateInput) {
    await connectToDatabase();

    if (!Types.ObjectId.isValid(interviewId)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid interview ID');
    }

    const patch: Record<string, unknown> = {};
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.startedAt !== undefined) patch.startedAt = new Date(updates.startedAt);
    if (updates.endedAt !== undefined) patch.endedAt = new Date(updates.endedAt);

    // Auto-compute actualDuration when endedAt is being set
    if (updates.endedAt !== undefined) {
      const endedAt = new Date(updates.endedAt);

      // Pull startedAt from the patch or from the existing document
      let startedAt: Date | undefined;
      if (updates.startedAt !== undefined) {
        startedAt = new Date(updates.startedAt);
      } else {
        const existing = await Interview.findOne({
          _id: new Types.ObjectId(interviewId),
          userId: new Types.ObjectId(userId),
        }).select('startedAt').lean();
        if (existing?.startedAt) {
          startedAt = new Date(existing.startedAt);
        }
      }

      if (startedAt) {
        const diffMs = endedAt.getTime() - startedAt.getTime();
        // Convert to minutes, minimum 1
        patch.actualDuration = Math.max(1, Math.round(diffMs / 60_000));
      }
    }

    const interview = await Interview.findOneAndUpdate(
      { _id: new Types.ObjectId(interviewId), userId: new Types.ObjectId(userId) },
      { $set: patch },
      { new: true, lean: true }
    );

    if (!interview) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Interview not found');
    }

    return interview;
  }

  /** Return dashboard stats for a user. */
  static async getDashboardStats(userId: string) {
    await connectToDatabase();

    const userObjectId = new Types.ObjectId(userId);

    // Run all independent queries in parallel
    const [totalInterviews, completedCount, recentInterviews, scoreAgg] = await Promise.all([
      Interview.countDocuments({ userId: userObjectId }),
      Interview.countDocuments({ userId: userObjectId, status: 'completed' }),
      Interview.find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      // Single aggregation: join interviews → evaluations and compute stats
      Interview.aggregate([
        { $match: { userId: userObjectId, status: 'completed' } },
        {
          $lookup: {
            from: 'evaluations',
            localField: '_id',
            foreignField: 'interviewId',
            as: 'evaluation',
          },
        },
        { $unwind: { path: '$evaluation', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$evaluation.overallScore' },
            bestScore: { $max: '$evaluation.overallScore' },
          },
        },
      ]),
    ]);

    const averageScore =
      scoreAgg.length > 0 ? Math.round(scoreAgg[0].averageScore) : null;
    const bestScore =
      scoreAgg.length > 0 ? scoreAgg[0].bestScore : null;

    return {
      totalInterviews,
      completed: completedCount,
      averageScore,
      bestScore,
      recentInterviews,
    };
  }
}
