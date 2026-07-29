/**
 * Shared enums used across models, validators, and services.
 * Centralising here avoids magic strings scattered through the codebase.
 */

export type UserRole = "user" | "admin";

export type InterviewStatus =
  | "PENDING"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type InterviewCategory =
  | "technical"
  | "behavioral"
  | "system-design"
  | "mixed";

export type InterviewDifficulty = "easy" | "medium" | "hard";

export type TranscriptSpeaker = "user" | "ai";
