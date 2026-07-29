import { createResponse } from '../../../../utils/response';
import { COOKIE_NAME } from '../../../../lib/auth';

export async function POST() {
  const response = createResponse(true, 'Logged out successfully', null);

  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
