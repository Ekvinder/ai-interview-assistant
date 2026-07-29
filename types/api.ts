/**
 * Shared API response types used across all route handlers.
 * Enforces a consistent response envelope throughout the entire API.
 */

/** Standard API response envelope returned by every endpoint. */
export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data: T | null;
}

/** Extended envelope for list endpoints that support pagination. */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
