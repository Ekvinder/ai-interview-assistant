import { NextResponse } from 'next/server';
import { createResponse } from '../../../utils/response';
import { connectToDatabase } from '../../../lib/mongodb';

export async function GET() {
  try {
    await connectToDatabase();
    return createResponse(true, 'API is healthy and database is connected');
  } catch (error: any) {
    return createResponse(false, 'Database connection failed', { error: error.message }, 500);
  }
}
