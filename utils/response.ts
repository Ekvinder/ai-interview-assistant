import { NextResponse } from 'next/server';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
}

/**
 * Creates a standard JSON response following the uniform structure.
 * @param success boolean indicating if the request was successful
 * @param message A string describing the result
 * @param data The payload data (optional)
 * @param status HTTP status code (default: 200)
 */
export function createResponse<T>(
  success: boolean,
  message: string,
  data: T | null = null,
  status: number = 200
) {
  const payload: ApiResponse<T> = { success, message, data };
  return NextResponse.json(payload, { status });
}
