import { NextResponse } from 'next/server';
import { logger } from './logger';

export interface ErrorResponse {
  error: string;
  code: string;
  stack?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createErrorResponse(
  error: ApiError,
  isDevelopment: boolean = process.env.NODE_ENV !== 'production'
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    error: error.message,
    code: error.code,
  };

  if (isDevelopment && error.stack) {
    response.stack = error.stack;
  }

  return NextResponse.json(response, { status: error.statusCode });
}

export function handleApiError(error: unknown, context?: string): NextResponse<ErrorResponse> {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  // ApiError instances should use their statusCode
  if (error instanceof ApiError) {
    logger.error(`API Error${context ? ` in ${context}` : ''}`, {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    return createErrorResponse(error, isDevelopment);
  }

  if (error instanceof Error) {
    logger.error(`API Error${context ? ` in ${context}` : ''}`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    const response: ErrorResponse = {
      error: error.message,
      code: error.name || 'INTERNAL_ERROR',
    };

    if (isDevelopment && error.stack) {
      response.stack = error.stack;
    }

    return NextResponse.json(response, { status: 500 });
  }

  logger.error(`Unknown error${context ? ` in ${context}` : ''}`, { error });

  const response: ErrorResponse = {
    error: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
  };

  return NextResponse.json(response, { status: 500 });
}
