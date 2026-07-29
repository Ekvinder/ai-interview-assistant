import mongoose, { Schema } from 'mongoose';
import { ITranscript } from '../types';

const TranscriptSchema = new Schema<ITranscript>(
  {
    interviewId: { type: String, required: true, index: true },
    speaker: { type: String, enum: ['AI', 'USER'], required: true },
    text: { type: String, required: true },
    sequence: { type: Number, required: true },
    timestamp: { type: Number, required: true },
  },
  { timestamps: true }
);

export const Transcript = mongoose.models.Transcript || mongoose.model<ITranscript>('Transcript', TranscriptSchema);
