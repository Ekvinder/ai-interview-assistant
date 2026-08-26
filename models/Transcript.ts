import mongoose, { Schema } from 'mongoose';
import { ITranscript } from '../types';

const TranscriptSchema = new Schema<ITranscript>(
  {
    interviewId: { type: Schema.Types.ObjectId, ref: 'Interview', required: false, index: true },
    meetingId: { type: String, required: false },
    speaker: { type: String, required: true },
    speakerName: { type: String, required: false },
    message: { type: String, required: true },
    timestamp: { type: Number, required: true },
  },
  {
    // Transcript entries are immutable; no updatedAt needed
    timestamps: { createdAt: true, updatedAt: false },
  }
);

TranscriptSchema.index({ meetingId: 1, timestamp: 1 });

export const Transcript =
  mongoose.models.Transcript || mongoose.model<ITranscript>('Transcript', TranscriptSchema);
