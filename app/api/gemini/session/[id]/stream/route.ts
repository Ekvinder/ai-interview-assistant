/**
 * GET /api/gemini/session/[id]/stream
 *
 * Server-Sent Events stream that forwards Gemini Live events to the browser.
 * The client opens this endpoint once and keeps it open for the interview duration.
 *
 * Event shapes (JSON in data field):
 *   { type: 'status',  status: GeminiSessionStatus }
 *   { type: 'message', speaker: 'ai'|'user', text: string, timestamp: number }
 *   { type: 'chunk',   speaker: 'ai', text: string }        ← streaming partial text
 *   { type: 'error',   message: string }
 *   { type: 'close' }
 *   { type: 'sync',    transcript: GeminiMessage[], status: GeminiSessionStatus } ← initial catchup
 */

import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSessionEntry } from '@/lib/gemini/session-store';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id: interviewId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Controller already closed
        }
      };

      // Send a sync event immediately so the client can catch up with any
      // messages that arrived before the SSE connection was established.
      const entry = getSessionEntry(interviewId);
      if (entry) {
        send(`data: ${JSON.stringify({
          type: 'sync',
          transcript: entry.transcript,
          status: entry.status,
        })}\n\n`);
      } else {
        send(`data: ${JSON.stringify({ type: 'error', message: 'No Gemini session found' })}\n\n`);
      }

      // Register this SSE connection as a subscriber
      const subscriber = (data: string) => send(data);

      if (entry) {
        entry.subscribers.add(subscriber);
      }

      // Cleanup when client disconnects
      req.signal.addEventListener('abort', () => {
        if (entry) entry.subscribers.delete(subscriber);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',  // Disable nginx buffering if present
    },
  });
}
