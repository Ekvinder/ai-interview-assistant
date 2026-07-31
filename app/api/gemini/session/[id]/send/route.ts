/**
 * POST /api/gemini/session/[id]/send
 *
 * Send a text message from the user to the persistent Gemini Live session.
 * Body: { text: string }
 *
 * The response is delivered via the SSE stream, not this response body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sendMessage, hasActiveSession } from '@/lib/gemini/session-store';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: interviewId } = await params;

  if (!hasActiveSession(interviewId)) {
    return NextResponse.json(
      { success: false, message: 'No active Gemini session' },
      { status: 404 },
    );
  }

  let text = '';
  try {
    const body = await req.json();
    text = (body.text ?? '').toString().trim();
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Invalid request body');
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ success: false, message: 'text is required' }, { status: 400 });
  }

  try {
    sendMessage(interviewId, text);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Failed to send message');
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
