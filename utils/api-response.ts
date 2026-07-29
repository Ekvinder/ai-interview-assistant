import { NextResponse } from "next/server";
import type { ApiResponse, PaginatedResponse } from "@/types";

/** Build a successful JSON response with the standard envelope. */
export function successResponse<T>(
  data: T,
  message = "Success",
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, message, data }, { status });
}

/** Build an error JSON response with the standard envelope. */
export function errorResponse(
  message: string,
  status = 500
): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ success: false, message, data: null }, { status });
}

/** Build a paginated JSON response. */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginatedResponse<T>["pagination"],
  message = "Success"
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({ success: true, message, data, pagination });
}
