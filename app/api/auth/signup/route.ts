import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '../../../../lib/mongodb';
import { User } from '../../../../models/User';
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE } from '../../../../lib/auth';
import { createResponse } from '../../../../utils/response';
import { SignupSchema } from '../../../../validators/user.validator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = SignupSchema.parse(body);

    await connectToDatabase();

    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      return createResponse(false, 'Email already in use', null, 409);
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    const user = await User.create({
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
    });

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const response = createResponse(
      true,
      'Account created successfully',
      { id: user._id, name: user.name, email: user.email, role: user.role },
      201
    );

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
    console.error(error); return createResponse(false, 'Internal server error', null, 500);
  }
}
