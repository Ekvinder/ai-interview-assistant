/**
 * Server-side store for persistent Gemini Live sessions.
 *
 * Keyed by interviewId. One session per interview — enforced here.
 * Lives in the Next.js server process memory for the duration of the interview.
 *
 * Reuses the same GoogleGenAI / ai.live.connect pattern as lib/gemini/live.ts.
 * No new client is introduced.
 */

import { GoogleGenAI, Modality } from '@google/genai';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GeminiSessionStatus =
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'disconnected'
  | 'error';

export interface GeminiMessage {
  speaker: 'ai' | 'user';
  text: string;
  timestamp: number;
}

export interface GeminiSessionEntry {
  /** The raw SDK session object. */
  session: any;
  status: GeminiSessionStatus;
  error: string | null;
  /** All transcript entries for this interview. */
  transcript: GeminiMessage[];
  /**
   * SSE subscribers: functions that receive serialised event strings.
   * Each streaming response registers one listener; it removes itself on close.
   */
  subscribers: Set<(data: string) => void>;
  /** Buffer for partial AI text chunks during a turn. */
  partialAiText: string;
}

// ─── Module-level store (singleton in server process) ─────────────────────────

// Use global to survive hot-reloads in dev without creating duplicate sessions
declare global {
  // eslint-disable-next-line no-var
  var __geminiSessions: Map<string, GeminiSessionEntry> | undefined;
}

if (!global.__geminiSessions) {
  global.__geminiSessions = new Map<string, GeminiSessionEntry>();
}

const store = global.__geminiSessions;

const LIVE_MODEL = 'gemini-2.0-flash-live-preview';

// Reuse a single GoogleGenAI client for all sessions — avoids re-initialising
// the SDK (and its internal HTTP agent) on every new interview.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { apiVersion: 'v1alpha' } });


function publishTranscriptMessage(interviewId: string, speaker: 'ai' | 'user', text: string): void {
  const entry = store.get(interviewId);
  if (!entry) return;

  const msg: GeminiMessage = {
    speaker,
    text,
    timestamp: Date.now(),
  };
  entry.transcript.push(msg);
  publishEvent(interviewId, { type: 'message', speaker, text, timestamp: msg.timestamp });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns the session entry for an interview, or undefined if none exists. */
export function getSessionEntry(interviewId: string): GeminiSessionEntry | undefined {
  return store.get(interviewId);
}

/** Returns true when a live (non-error, non-disconnected) session exists. */
export function hasActiveSession(interviewId: string): boolean {
  const entry = store.get(interviewId);
  if (!entry) return false;
  return entry.status !== 'disconnected' && entry.status !== 'error';
}

/**
 * Creates and stores a new Gemini Live session for the given interview.
 * Throws if a session already exists (caller must check hasActiveSession first).
 *
 * The session stays open until closeSession() is called.
 */
export async function createSession(
  interviewId: string,
  params: {
    role: string;
    interviewType: string;
    difficulty: string;
    experience: string;
  },
): Promise<void> {
  if (hasActiveSession(interviewId)) {
    throw new Error(`Session already exists for interview ${interviewId}`);
  }

  const systemInstruction =
    `You are a professional AI interviewer conducting a ${params.difficulty} ` +
    `${params.interviewType} interview for a ${params.role} position. ` +
    `The candidate has ${params.experience} of experience. ` +
    `Start by warmly welcoming the candidate and introducing yourself as an AI interviewer. ` +
    `Then ask the candidate to briefly introduce themselves. ` +
    `After that, conduct the interview naturally — ask relevant ${params.interviewType} questions ` +
    `appropriate for a ${params.difficulty} level ${params.role}. ` +
    `Wait for the candidate's response before asking the next question. ` +
    `Keep the conversation professional and encouraging.`;

  // Placeholder entry — marks as "connecting" so no duplicate can start
  const entry: GeminiSessionEntry = {
    session: null,
    status: 'connecting',
    error: null,
    transcript: [],
    subscribers: new Set(),
    partialAiText: '',
  };
  store.set(interviewId, entry);

  try {
    const session = await Promise.race([
      ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.TEXT],
          systemInstruction,
        },
        callbacks: {
        onopen: () => {
          console.log(`[Gemini] Session opened for interview ${interviewId}`);
          const e = store.get(interviewId);
          if (e) {
            e.status = 'connected';
            publishEvent(interviewId, { type: 'status', status: 'connected' });
          }
        },

        onmessage: (message: any) => {
          const e = store.get(interviewId);
          if (!e) return;

          // ── Collect AI text chunks ────────────────────────────────
          const parts: any[] = message.serverContent?.modelTurn?.parts ?? [];
          let chunkText = '';
          for (const part of parts) {
            if (part.text) chunkText += part.text;
          }
          // Also from outputTranscription
          const transcriptChunk = message.serverContent?.outputTranscription?.text ?? '';
          chunkText += transcriptChunk;

          if (chunkText) {
            e.partialAiText += chunkText;
            e.status = 'speaking';
            publishEvent(interviewId, { type: 'status', status: 'speaking' });
            // Stream the chunk to subscribers immediately
            publishEvent(interviewId, { type: 'chunk', speaker: 'ai', text: chunkText });
          }

          // ── Turn complete — finalise the AI message ───────────────
          if (message.serverContent?.turnComplete) {
            const fullText = e.partialAiText.trim();
            e.partialAiText = '';

            if (fullText) {
              const msg: GeminiMessage = {
                speaker: 'ai',
                text: fullText,
                timestamp: Date.now(),
              };
              e.transcript.push(msg);
              publishEvent(interviewId, { type: 'message', speaker: 'ai', text: fullText, timestamp: msg.timestamp });
            }

            e.status = 'listening';
            publishEvent(interviewId, { type: 'status', status: 'listening' });
          }
        },

        onerror: (error: any) => {
          console.error(`[Gemini] Error for interview ${interviewId}:`, error);
          const e = store.get(interviewId);
          if (e) {
            e.status = 'error';
            e.error = error?.message ?? 'Gemini connection error';
            publishEvent(interviewId, { type: 'error', message: e.error });
          }
        },

        onclose: (event: any) => {
          console.log(`[Gemini] Closed for interview ${interviewId}:`, event?.reason ?? '');
          const e = store.get(interviewId);
          if (e) {
            // Only mark disconnected if not already in error state
            if (e.status !== 'error') {
              e.status = 'disconnected';
            }
            publishEvent(interviewId, { type: 'status', status: e.status });
            publishEvent(interviewId, { type: 'close' });
          }
        },
      },
    }),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Live connection timed out')), 15000))
    ]);

    // Attach the real session object
    entry.session = session;

    // Send the greeting trigger — Gemini will respond with an introduction
    session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text: 'Begin the interview.' }] }],
      turnComplete: true,
    });

    entry.status = 'thinking';
    publishEvent(interviewId, { type: 'status', status: 'thinking' });

  } catch (err: any) {
    console.error(`[Gemini] Connection failed for ${interviewId}:`, err?.message ?? err);
    entry.session = null;
    entry.status = 'error';
    entry.error = err?.message ?? 'Live connection failed';
    publishEvent(interviewId, { type: 'error', message: entry.error });
    throw err;
  }
}

/**
 * Sends a user text message through the existing session.
 * Adds the message to the transcript and notifies subscribers.
 */
export function sendMessage(interviewId: string, text: string): void {
  const entry = store.get(interviewId);
  if (!entry) throw new Error('No active Gemini session');
  if (entry.status === 'error') {
    throw new Error('Gemini session is not active');
  }

  const msg: GeminiMessage = { speaker: 'user', text, timestamp: Date.now() };
  entry.transcript.push(msg);
  publishEvent(interviewId, { type: 'message', speaker: 'user', text, timestamp: msg.timestamp });

  entry.status = 'thinking';
  publishEvent(interviewId, { type: 'status', status: 'thinking' });

  if (!entry.session) {
    throw new Error('Gemini session is not connected');
  }

  entry.session.sendClientContent({
    turns: [{ role: 'user', parts: [{ text }] }],
    turnComplete: true,
  });
}

/**
 * Closes the Gemini Live session and removes it from the store.
 * Safe to call multiple times (idempotent).
 */
export function closeSession(interviewId: string): void {
  const entry = store.get(interviewId);
  if (!entry) return;

  try {
    if (entry.session) {
      entry.session.close();
    }
  } catch (err) {
    console.warn(`[Gemini] Error closing session for ${interviewId}:`, err);
  }

  publishEvent(interviewId, { type: 'close' });
  store.delete(interviewId);
  console.log(`[Gemini] Session closed and removed for interview ${interviewId}`);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function publishEvent(interviewId: string, payload: object): void {
  const entry = store.get(interviewId);
  if (!entry) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const fn of entry.subscribers) {
    try { fn(data); } catch { /* subscriber already gone */ }
  }
}
