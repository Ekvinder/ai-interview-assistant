import { Document, Types } from 'mongoose';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
// ─── User ─────────────────────────────────────────────────────────────────────

export interface IUser extends Document {
  name?: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Interview ────────────────────────────────────────────────────────────────

export type InterviewStatus = 'waiting' | 'active' | 'completed' | 'cancelled';

export interface IInterview extends Document {
  userId: Types.ObjectId;
  roomName: string;
  role: string;
  interviewType: string;
  difficulty: string;
  experience: string;
  /** Planned duration in minutes — chosen before the interview. Never overwritten. */
  duration: number;
  status: InterviewStatus;
  startedAt?: Date;
  endedAt?: Date;
  /** Actual duration in minutes — computed from endedAt - startedAt when the interview ends. */
  actualDuration?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Transcript ───────────────────────────────────────────────────────────────

export interface ITranscript extends Document {
  interviewId: Types.ObjectId;
  speaker: 'ai' | 'user';
  message: string;
  timestamp: number;
  createdAt: Date;
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

export interface IEvaluation extends Document {
  interviewId: Types.ObjectId;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  problemSolvingScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  summary: string;
  createdAt: Date;
}

// ─── Meeting ──────────────────────────────────────────────────────────────────

export type MeetingStatus = 'scheduled' | 'active' | 'ended';

export interface IParticipant {
  user: Types.ObjectId;
  role: 'host' | 'participant';
  joinedAt: Date;
  leftAt?: Date;
  micEnabled: boolean;
  cameraEnabled: boolean;
  handRaised: boolean;
  isPresent: boolean;
}

export interface IMeetingSettings {
  allowChat: boolean;
  allowMic: boolean;
  allowCamera: boolean;
  allowScreenShare: boolean;
  waitingRoom: boolean;
}

export interface IMeeting extends Document {
  title: string;
  meetingId: string;
  host: Types.ObjectId;
  participants: IParticipant[];
  status: MeetingStatus;
  scheduledFor?: Date;
  startedAt?: Date;
  endedAt?: Date;
  endedBy?: Types.ObjectId;
  duration?: number;
  isInstant: boolean;
  isPrivate: boolean;
  settings: IMeetingSettings;
  createdAt: Date;
  updatedAt: Date;
}
