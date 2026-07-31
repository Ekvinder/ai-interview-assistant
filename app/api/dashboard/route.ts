import { getCurrentUser } from '../../../lib/auth';
import { InterviewService } from '../../../services/interview.service';
import { createResponse } from '../../../utils/response';
import { ApiError } from '../../../utils/apiError';

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const stats = await InterviewService.getDashboardStats(currentUser.userId);

    return createResponse(true, 'Dashboard stats fetched successfully', stats);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return createResponse(false, error.message, null, error.statusCode);
    }
    console.error('[GET /api/dashboard]', error);
    return createResponse(false, 'Internal server error', null, 500);
  }
}
