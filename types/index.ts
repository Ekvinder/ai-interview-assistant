import { Document } from 'mongoose';

export interface IUser extends Document {
  name?: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

export interface IInterview extends Document {
  userId: string;
  title: string;
  category: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  jobRole?: string;
  experienceLevel?: string;
  language?: string;
  durationMinutes?: number;
  roomName?: string;
  livekitRoomId?: string;
  transcriptId?: string;
  evaluationId?: string;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // in seconds (keeping legacy)
  overallScore?: number;
  promptVersion?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITranscript extends Document {
  interviewId: string;
  speaker: 'AI' | 'USER';
  text: string;
  sequence: number;
  timestamp: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEvaluation extends Document {
  interviewId: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  problemSolvingScore: number;
  overallScore: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  createdAt: Date;
  updatedAt: Date;
}
