import { ZodError } from "zod";
import { errorResponse } from "./api-response";

/**
 * Central error handler for API route catch blocks.
 * Maps known error types to appropriate HTTP status codes.
 */
import type { ZodIssue } from 'zod';

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    const message = error.issues
      .map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    return errorResponse(`Validation error: ${message}`, 422);
  }

  if (error instanceof Error) {
    console.error("[API Error]", error.message);
    return errorResponse(error.message, 500);
  }

  console.error("[API Error] Unknown error", error);
  return errorResponse("An unexpected error occurred", 500);
}
