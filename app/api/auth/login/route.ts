import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '../../../../lib/mongodb';
import { User } from '../../../../models/User';
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE } from '../../../../lib/auth';
import { createResponse } from '../../../../utils/response';
import { LoginSchema } from '../../../../validators/user.validator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = LoginSchema.parse(body);

    await connectToDatabase();

    // Explicitly select password since the field has select: false on the model
    const user = await User.findOne({ email: validatedData.email }).select('+password');
    if (!user) {
      return createResponse(false, 'Invalid email or password', null, 401);
    }

    const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
    if (!isPasswordValid) {
      return createResponse(false, 'Invalid email or password', null, 401);
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const response = createResponse(true, 'Logged in successfully', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    return response;
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return createResponse(false, 'Validation failed', error.issues, 400);
    }
    return createResponse(false, 'Internal server error', null, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
