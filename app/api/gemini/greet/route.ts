import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';
import { getCurrentUser } from '@/lib/auth';

/**
 * POST /api/gemini/greet
 *
 * Creates a Gemini Live session, sends the interviewer greeting prompt,
 * collects the full text transcript, closes the session, and returns the text.
 *
 * Reuses the same GoogleGenAI pattern as lib/gemini/live.ts — no new client created.
 * Called by the Interview Room after LiveKit connects.
 *
 * Body: { role: string; interviewType: string; difficulty: string; experience: string }
 * Response: { success: true; greeting: string }
 */
export async function POST(req: NextRequest) {
  // Auth guard
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let role = 'Software Engineer';
  let interviewType = 'technical';
  let difficulty = 'medium';
  let experience = '1-2 years';

  try {
    const body = await req.json();
    if (body.role) role = body.role;
    if (body.interviewType) interviewType = body.interviewType;
    if (body.difficulty) difficulty = body.difficulty;
    if (body.experience) experience = body.experience;
  } catch {
    // use defaults if body is missing
  }

  const greetingPrompt =
    `You are a professional AI interviewer conducting a ${difficulty} ${interviewType} interview ` +
    `for a ${role} position. The candidate has ${experience} of experience. ` +
    `Welcome the candidate warmly, introduce yourself briefly as an AI interviewer, ` +
    `and ask the candidate to briefly introduce themselves. Keep it to 3-4 sentences. ` +
    `Do not ask any technical questions yet.`;

  try {
    const greeting = await collectGeminiGreeting(greetingPrompt);
    return NextResponse.json({ success: true, greeting });
  } catch (error) {
    console.error('[Gemini Greet]', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Gemini failed to respond',
      },
      { status: 500 },
    );
  }
}

/**
 * Opens a Gemini Live session, sends the prompt, waits for the complete
 * text transcript, closes the session, and resolves with the text.
 */
function collectGeminiGreeting(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { apiVersion: 'v1alpha' } });

    // Accumulate transcript chunks across multiple onmessage calls
    let accumulated = '';
    let turnComplete = false;
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Gemini greeting timed out after 20 seconds'));
      }
    }, 20_000);

    const finish = (text: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve(text.trim() || 'Hello! Welcome to your interview. Could you please introduce yourself?');
    };

    ai.live
      .connect({
        model: 'gemini-2.0-flash-live-preview',
        config: {
          // Request text output so we can return it as JSON
          responseModalities: [Modality.TEXT],
          systemInstruction: prompt,
        },
        callbacks: {
          onopen: () => {
            console.log('[Gemini Greet] Connected');
          },

          onmessage: (message) => {
            // Collect text from modelTurn parts
            const parts = message.serverContent?.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.text) {
                accumulated += part.text;
              }
            }

            // Also collect from outputTranscription (audio transcription path)
            const transcription = message.serverContent?.outputTranscription;
            if (transcription?.text) {
              accumulated += transcription.text;
            }

            // When the turn is complete, close and resolve
            if (message.serverContent?.turnComplete && !turnComplete) {
              turnComplete = true;
              finish(accumulated);
              // Session will close naturally; no explicit close method available
            }
          },

          onerror: (error) => {
            console.error('[Gemini Greet] Error:', error);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              reject(new Error('Gemini Live connection error'));
            }
          },

          onclose: (event) => {
            console.log('[Gemini Greet] Closed:', event?.reason ?? '');
            // If closed before we resolved, resolve with whatever we have
            if (!resolved) {
              finish(accumulated);
            }
          },
        },
      })
      .then((session) => {
        // Send the greeting trigger after session opens
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: 'Begin the interview.' }] }],
          turnComplete: true,
        });
      })
      .catch((err) => {
        console.warn('[Gemini Greet] Live connect unavailable, using fallback greeting:', err);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(prompt.length > 0 ? 'Hello! Welcome to your interview. I’m your AI interviewer, and I’ll guide you through the conversation. Please introduce yourself briefly.' : 'Hello! Welcome to your interview. Please introduce yourself briefly.');
        }
      });
  });
}
