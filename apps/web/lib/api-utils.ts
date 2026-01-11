import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * API Error class for standardized error responses
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...(details && { details }),
    },
    { status }
  );
}

/**
 * Handle errors and return appropriate responses
 */
export function handleError(error: unknown): NextResponse {
  // Only log errors in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    console.error('API Error:', error);
  }

  if (error instanceof ZodError) {
    return errorResponse(
      'Validation error',
      400,
      error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }))
    );
  }

  if (error instanceof ApiError) {
    return errorResponse(error.message, error.statusCode);
  }

  if (error instanceof Error) {
    // Supabase not found error
    if (error.message.includes('PGRST116') || error.message.includes('no rows')) {
      return errorResponse('Resource not found', 404);
    }

    // JSON parse error
    if (error.message.includes('JSON') || error.name === 'SyntaxError') {
      return errorResponse('Invalid JSON in request body', 400);
    }

    // Don't leak internal error details in production
    const message =
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error';

    return errorResponse(message, 500);
  }

  return errorResponse('Internal server error', 500);
}

/**
 * Parse query parameters from URL
 */
export function getQueryParams(request: Request): URLSearchParams {
  const url = new URL(request.url);
  return url.searchParams;
}

/**
 * Convert URLSearchParams to a plain object
 */
export function searchParamsToObject(
  params: URLSearchParams
): Record<string, string> {
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}
