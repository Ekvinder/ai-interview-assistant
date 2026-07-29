import mongoose, { Schema } from 'mongoose';
import { IEvaluation } from '../types';

const EvaluationSchema = new Schema<IEvaluation>(
  {
    interviewId: { type: String, required: true, unique: true },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    suggestions: { type: [String], default: [] },
    technicalScore: { type: Number, required: true },
    communicationScore: { type: Number, required: true },
    confidenceScore: { type: Number, required: true },
    problemSolvingScore: { type: Number, required: true },
    overallScore: { type: Number, required: true },
    promptTokens: { type: Number, required: false },
    completionTokens: { type: Number, required: false },
    totalTokens: { type: Number, required: false },
  },
  { timestamps: true }
);

export const Evaluation = mongoose.models.Evaluation || mongoose.model<IEvaluation>('Evaluation', EvaluationSchema);
