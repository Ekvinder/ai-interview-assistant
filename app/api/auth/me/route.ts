import { getCurrentUser } from '../../../../lib/auth';
import { connectToDatabase } from '../../../../lib/mongodb';
import { User } from '../../../../models/User';
import { createResponse } from '../../../../utils/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    await connectToDatabase();

    const user = await User.findById(currentUser.userId).select('-password');
    if (!user) {
      return createResponse(false, 'User not found', null, 404);
    }

    return createResponse(true, 'Authenticated user fetched', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch {
    return createResponse(false, 'Internal server error', null, 500);
  }
}
