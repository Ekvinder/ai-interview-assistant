import { NextRequest } from 'next/server';
import { getCurrentUser } from '../../../lib/auth';
import { InterviewService } from '../../../services/interview.service';
import { createResponse } from '../../../utils/response';
import { ApiError } from '../../../utils/apiError';
import { InterviewCreateSchema } from '../../../validators/interview.validator';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const body = await req.json();
    const validatedData = InterviewCreateSchema.parse(body);

    const interview = await InterviewService.createInterview(currentUser.userId, validatedData);

    return createResponse(true, 'Interview created successfully', interview, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return createResponse(false, 'Validation failed', error.issues, 400);
    }
    if (error instanceof ApiError) {
      return createResponse(false, error.message, null, error.statusCode);
    }
    console.error('[POST /api/interviews]', error);
    return createResponse(false, 'Internal server error', null, 500);
  }
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const interviews = await InterviewService.listInterviews(currentUser.userId);

    return createResponse(true, 'Interviews fetched successfully', interviews);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return createResponse(false, error.message, null, error.statusCode);
    }
    console.error('[GET /api/interviews]', error);
    return createResponse(false, 'Internal server error', null, 500);
  }
}
