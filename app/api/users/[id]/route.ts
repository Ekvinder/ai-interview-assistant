import { NextRequest } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth';
import { UserService } from '../../../../services/user.service';
import { createResponse } from '../../../../utils/response';
import { ApiError } from '../../../../utils/apiError';
import { UserUpdateSchema } from '../../../../validators/user.validator';

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

    // Users can only fetch their own profile
    if (currentUser.userId !== id) {
      return createResponse(false, 'Forbidden', null, 403);
    }

    const user = await UserService.getUserById(id);

    return createResponse(true, 'User fetched successfully', user);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return createResponse(false, error.message, null, error.statusCode);
    }
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

    if (currentUser.userId !== id) {
      return createResponse(false, 'Forbidden', null, 403);
    }

    const body = await req.json();
    const validatedData = UserUpdateSchema.parse(body);

    const user = await UserService.updateUser(id, validatedData);

    return createResponse(true, 'User updated successfully', user);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      return createResponse(false, 'Validation failed', (error as { issues?: unknown }).issues, 400);
    }
    if (error instanceof ApiError) {
      return createResponse(false, error.message, null, error.statusCode);
    }
    return createResponse(false, 'Internal server error', null, 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return createResponse(false, 'Unauthorized', null, 401);
    }

    const { id } = await params;

    if (currentUser.userId !== id) {
      return createResponse(false, 'Forbidden', null, 403);
    }

    await UserService.deleteUser(id);

    return createResponse(true, 'User deleted successfully', null);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return createResponse(false, error.message, null, error.statusCode);
    }
    return createResponse(false, 'Internal server error', null, 500);
  }
}
