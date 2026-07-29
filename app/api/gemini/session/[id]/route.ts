/**
 * POST /api/gemini/session/[id]
 *   Start a persistent Gemini Live session for the given interview.
 *   Body: { role, interviewType, difficulty, experience }
 *
 * DELETE /api/gemini/session/[id]
 *   Close and remove the Gemini Live session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  createSession,
  closeSession,
  hasActiveSession,
  getSessionEntry,
} from '@/lib/gemini/session-store';

type Params = { params: Promise<{ id: string }> };

// ─── POST — start session ──────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: interviewId } = await params;

  // Idempotent — if a healthy session already exists, return its current state
  if (hasActiveSession(interviewId)) {
    const entry = getSessionEntry(interviewId)!;
    return NextResponse.json({
      success: true,
      message: 'Session already active',
      status: entry.status,
    });
  }

  let role = 'Software Engineer';
  let interviewType = 'technical';
  let difficulty = 'medium';
  let experience = '1-2 years';

  try {
    const body = await req.json();
    if (body.role)          role          = body.role;
    if (body.interviewType) interviewType = body.interviewType;
    if (body.difficulty)    difficulty    = body.difficulty;
    if (body.experience)    experience    = body.experience;
  } catch { /* use defaults */ }

  try {
    // createSession is async — it resolves after ai.live.connect() returns
    // (i.e. after the WebSocket handshake, before the first message)
    await createSession(interviewId, { role, interviewType, difficulty, experience });

    return NextResponse.json({ success: true, message: 'Session started', status: 'connecting' });
  } catch (err: any) {
    console.error('[Gemini Session POST]', err);
    return NextResponse.json(
      { success: false, message: err.message ?? 'Failed to start Gemini session' },
      { status: 500 },
    );
  }
}

// ─── DELETE — close session ────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: interviewId } = await params;
  closeSession(interviewId);

  return NextResponse.json({ success: true, message: 'Session closed' });
}
