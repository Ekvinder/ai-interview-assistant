import { createResponse } from '../../../utils/response';
import { connectToDatabase } from '../../../lib/mongodb';

export async function GET() {
  try {
    await connectToDatabase();
    return createResponse(true, 'API is healthy and database is connected');
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Database connection failed');
    return createResponse(false, 'Database connection failed', { error: err.message }, 500);
  }
}
