import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { MeetingService } from '@/services/meeting.service';
import { createResponse } from '@/utils/response';

/**
 * GET /api/meetings/[id]/whiteboard
 * Returns the persisted whiteboard data URL for a meeting.
 * [id] here is the public meetingId string (not the Mongo _id).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return createResponse(false, 'Unauthorized', null, 401);

    const { id } = await params;
    const result = await MeetingService.loadWhiteboard(id);
    return createResponse(true, 'Whiteboard loaded', result);
  } catch (error: unknown) {
    console.error('GET /api/meetings/[id]/whiteboard error:', error);
    const err = error as { statusCode?: number; message?: string };
    return createResponse(false, err.message ?? 'Internal Server Error', null, err.statusCode ?? 500);
  }
}

/**
 * PUT /api/meetings/[id]/whiteboard
 * Persists the whiteboard data URL.
 * Body: { dataUrl: string }
 * [id] here is the public meetingId string (not the Mongo _id).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return createResponse(false, 'Unauthorized', null, 401);

    const { id } = await params;
    const body = await req.json() as { dataUrl?: unknown };

    if (typeof body.dataUrl !== 'string' || !body.dataUrl.startsWith('data:image/')) {
      return createResponse(false, 'Invalid dataUrl', null, 400);
    }

    const result = await MeetingService.saveWhiteboard(id, body.dataUrl);
    return createResponse(true, 'Whiteboard saved', result);
  } catch (error: unknown) {
    console.error('PUT /api/meetings/[id]/whiteboard error:', error);
    const err = error as { statusCode?: number; message?: string };
    return createResponse(false, err.message ?? 'Internal Server Error', null, err.statusCode ?? 500);
  }
}
