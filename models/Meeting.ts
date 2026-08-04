import mongoose, { Schema } from 'mongoose';
import { IMeeting } from '../types';

const ParticipantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['host', 'participant'], default: 'participant' },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    micEnabled: { type: Boolean, default: false },
    cameraEnabled: { type: Boolean, default: false },
    handRaised: { type: Boolean, default: false },
    isPresent: { type: Boolean, default: true },
  },
  { _id: false }
);

const JoinRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
    requestedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date },
  },
  { _id: false }
);

const MeetingSettingsSchema = new Schema(
  {
    allowChat: { type: Boolean, default: true },
    allowMic: { type: Boolean, default: true },
    allowCamera: { type: Boolean, default: true },
    allowScreenShare: { type: Boolean, default: true },
    waitingRoom: { type: Boolean, default: false },
  },
  { _id: false }
);

const MeetingSchema = new Schema<IMeeting>(
  {
    title: { type: String, required: true, trim: true },
    meetingId: { type: String, required: true, unique: true, index: true },
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    participants: [ParticipantSchema],
    // Kept separate from participants: pending guests must not be treated as joined.
    joinRequests: { type: [JoinRequestSchema], default: [] },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'ended'],
      default: 'scheduled',
      index: true,
    },
    scheduledFor: { type: Date, index: true },
    startedAt: { type: Date },
    endedAt: { type: Date },
    endedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    duration: { type: Number }, // in minutes
    isInstant: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    settings: { type: MeetingSettingsSchema, default: () => ({}) },
    /** Persisted whiteboard: base-64 PNG data URL. Stored outside GridFS to keep it simple. */
    whiteboardData: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Meeting =
  mongoose.models.Meeting || mongoose.model<IMeeting>('Meeting', MeetingSchema);
