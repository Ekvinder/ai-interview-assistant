import mongoose, { Schema } from 'mongoose';
import { IEvaluation } from '../types';

const EvaluationSchema = new Schema<IEvaluation>(
  {
    interviewId: { type: Schema.Types.ObjectId, ref: 'Interview', required: true, unique: true },
    overallScore: { type: Number, required: true },
    technicalScore: { type: Number, required: true },
    communicationScore: { type: Number, required: true },
    confidenceScore: { type: Number, required: true },
    problemSolvingScore: { type: Number, required: true },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    summary: { type: String, required: true },
  },
  {
    // Evaluations are created once; no updatedAt needed
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Evaluation =
  mongoose.models.Evaluation || mongoose.model<IEvaluation>('Evaluation', EvaluationSchema);
