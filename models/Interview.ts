import mongoose, { Schema } from 'mongoose';
import { IInterview } from '../types';
import { INTERVIEW_STATUS } from '../utils/constants';

const InterviewSchema = new Schema<IInterview>(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD'], default: 'MEDIUM' },
    jobRole: { type: String, required: false },
    experienceLevel: { type: String, required: false },
    language: { type: String, required: false },
    durationMinutes: { type: Number, required: false },
    status: {
      type: String,
      enum: Object.values(INTERVIEW_STATUS),
      default: INTERVIEW_STATUS.PENDING,
    },
    roomName: { type: String, required: false },
    livekitRoomId: { type: String, required: false },
    transcriptId: { type: String, required: false },
    evaluationId: { type: String, required: false },
    startedAt: { type: Date, required: false },
    endedAt: { type: Date, required: false },
    duration: { type: Number, required: false },
    overallScore: { type: Number, required: false },
    promptVersion: { type: String, required: false },
    failureReason: { type: String, required: false },
  },
  { timestamps: true }
);

export const Interview = mongoose.models.Interview || mongoose.model<IInterview>('Interview', InterviewSchema);
