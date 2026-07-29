import { Interview } from '../models/Interview';
import { ApiError } from '../utils/apiError';
import { HTTP_STATUS, INTERVIEW_STATUS } from '../utils/constants';
import { connectToDatabase } from '../lib/mongodb';

export class InterviewService {
  static async createInterview(userId: string, data: { title: string; category: string; difficulty: string }) {
    await connectToDatabase();
    const interview = new Interview({
      userId,
      ...data,
      status: INTERVIEW_STATUS.PENDING,
    });
    await interview.save();
    return interview;
  }

  static async getInterviewById(interviewId: string, userId: string) {
    await connectToDatabase();
    const interview = await Interview.findOne({ _id: interviewId, userId });
    if (!interview) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Interview not found');
    }
    return interview;
  }

  static async listInterviews(userId: string) {
    await connectToDatabase();
    const interviews = await Interview.find({ userId }).sort({ createdAt: -1 });
    return interviews;
  }

  static async updateStatus(interviewId: string, userId: string, status: string) {
    await connectToDatabase();
    const interview = await Interview.findOneAndUpdate(
      { _id: interviewId, userId },
      { status },
      { new: true }
    );
    if (!interview) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Interview not found');
    }
    return interview;
  }
}
