import mongoose, { Schema } from 'mongoose';
import { IInterview } from '../types';
import { INTERVIEW_STATUS } from '../utils/constants';

const InterviewSchema = new Schema<IInterview>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roomName: { type: String, required: true, unique: true },
    role: { type: String, required: true, trim: true },
    interviewType: { type: String, required: true, trim: true },
    difficulty: { type: String, required: true, trim: true },
    experience: { type: String, required: true, trim: true },
    duration: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(INTERVIEW_STATUS),
      default: INTERVIEW_STATUS.WAITING,
    },
    startedAt: { type: Date, required: false },
    endedAt: { type: Date, required: false },
    /** Actual duration in minutes, computed when the interview is completed. */
    actualDuration: { type: Number, required: false },
  },
  { timestamps: true }
);

export const Interview =
  mongoose.models.Interview || mongoose.model<IInterview>('Interview', InterviewSchema);
