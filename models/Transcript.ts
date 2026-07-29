import mongoose, { Schema } from 'mongoose';
import { ITranscript } from '../types';

const TranscriptSchema = new Schema<ITranscript>(
  {
    interviewId: { type: Schema.Types.ObjectId, ref: 'Interview', required: true, index: true },
    speaker: { type: String, enum: ['ai', 'user'], required: true },
    message: { type: String, required: true },
    timestamp: { type: Number, required: true },
  },
  {
    // Transcript entries are immutable; no updatedAt needed
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const Transcript =
  mongoose.models.Transcript || mongoose.model<ITranscript>('Transcript', TranscriptSchema);
