import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export interface ApiError {
  message: string
  code: string
  status: number
  details?: unknown
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    details?: unknown
  }
}

/**
 * Standardized API error handler
 */
export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error)

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        },
      } satisfies ApiResponse<never>,
      { status: 400 }
    )
  }

  if (error instanceof Error) {
    // Don't expose internal error messages in production
    const isProduction = process.env.NODE_ENV === 'production'
    
    return NextResponse.json(
      {
        success: false,
        error: {
          message: isProduction 
            ? 'An internal server error occurred' 
            : error.message,
          code: 'INTERNAL_ERROR',
        },
      } satisfies ApiResponse<never>,
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
      },
    } satisfies ApiResponse<never>,
    { status: 500 }
  )
}

/**
 * Create a standardized success response
 */
export function createApiResponse<T>(
  data: T, 
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    } satisfies ApiResponse<T>,
    { status }
  )
}

/**
 * Create a standardized error response
 */
export function createApiError(
  message: string,
  code: string,
  status: number,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code,
        details,
      },
    } satisfies ApiResponse<never>,
    { status }
  )
}

/**
 * Higher-order function to wrap API handlers with standardized error handling
 */
export function withApiHandler<T extends unknown[], R>(
  handler: (...args: T) => Promise<NextResponse | R>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const result = await handler(...args)
      
      // If handler returns NextResponse, use it directly
      if (result instanceof NextResponse) {
        return result
      }
      
      // Otherwise, wrap the result in a success response
      return createApiResponse(result)
    } catch (error) {
      return handleApiError(error)
    }
  }
}

/**
 * Validate user authentication
 */
export function validateAuth(userId: string | undefined): asserts userId is string {
  if (!userId) {
    throw new Error('Authentication required')
  }
}

/**
 * Custom error classes for better error handling
 */
export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error {
  constructor(message = 'Insufficient permissions') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

/**
 * Enhanced error handler that recognizes custom error types
 */
export function handleApiErrorEnhanced(error: unknown): NextResponse {
  console.error('API Error:', error)

  if (error instanceof AuthenticationError) {
    return createApiError(error.message, 'AUTHENTICATION_ERROR', 401)
  }

  if (error instanceof AuthorizationError) {
    return createApiError(error.message, 'AUTHORIZATION_ERROR', 403)
  }

  if (error instanceof ValidationError) {
    return createApiError(error.message, 'VALIDATION_ERROR', 400, error.details)
  }

  if (error instanceof NotFoundError) {
    return createApiError(error.message, 'NOT_FOUND', 404)
  }

  if (error instanceof ZodError) {
    return createApiError(
      'Invalid request data',
      'VALIDATION_ERROR',
      400,
      error.issues
    )
  }

  if (error instanceof Error) {
    const isProduction = process.env.NODE_ENV === 'production'
    
    return createApiError(
      isProduction ? 'An internal server error occurred' : error.message,
      'INTERNAL_ERROR',
      500
    )
  }

  return createApiError('An unexpected error occurred', 'UNKNOWN_ERROR', 500)
}