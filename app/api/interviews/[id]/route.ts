import { NextRequest } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { InterviewService } from '../../../../services/interview.service';
import { createResponse } from '../../../../utils/response';
import { ApiError } from '../../../../utils/apiError';
import { InterviewUpdateSchema } from '../../../../validators/interview.validator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const { id } = await params;
    const interview = await InterviewService.getInterviewById(id, currentUser.userId);

    return createResponse(true, 'Interview fetched successfully', interview);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return createResponse(false, error.message, null, error.statusCode);
    }
    console.error('[GET /api/interviews/[id]]', error);
    return createResponse(false, 'Internal server error', null, 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = InterviewUpdateSchema.parse(body);

    const interview = await InterviewService.updateInterview(id, currentUser.userId, validatedData);

    return createResponse(true, 'Interview updated successfully', interview);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      return createResponse(false, 'Validation failed', (error as { issues?: unknown }).issues, 400);
    }
    if (error instanceof ApiError) {
      return createResponse(false, error.message, null, error.statusCode);
    }
    console.error('[PATCH /api/interviews/[id]]', error);
    return createResponse(false, 'Internal server error', null, 500);
  }
}
