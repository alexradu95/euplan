/**
 * Centralized error handling with structured logging
 */
import { Logger, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ZodError } from 'zod';
import { DocumentError, CollaborationError, ValidationError, isCustomError } from './errors';

export interface ErrorContext {
  userId?: string;
  documentId?: string;
  clientId?: string;
  operation?: string;
  timestamp: number;
  correlationId?: string;
}

export interface StructuredError {
  name: string;
  message: string;
  code: string;
  context: ErrorContext;
  stack?: string;
  details?: unknown;
}

export class ErrorHandler {
  private static readonly logger = new Logger('ErrorHandler');

  /**
   * Convert any error to a structured format
   */
  static structureError(
    error: unknown, 
    context: Partial<ErrorContext> = {}
  ): StructuredError {
    const baseContext: ErrorContext = {
      timestamp: Date.now(),
      correlationId: this.generateCorrelationId(),
      ...context,
    };

    if (isCustomError(error)) {
      const documentId = (error instanceof DocumentError || error instanceof CollaborationError) 
        ? error.documentId || context.documentId 
        : context.documentId;
      
      const userId = error instanceof DocumentError 
        ? error.userId || context.userId 
        : context.userId;

      return {
        name: error.name,
        message: error.message,
        code: this.getErrorCode(error),
        context: {
          ...baseContext,
          documentId,
          userId,
        },
        stack: error.stack,
      };
    }

    if (error instanceof ZodError) {
      return {
        name: 'ValidationError',
        message: 'Input validation failed',
        code: 'VALIDATION_FAILED',
        context: baseContext,
        details: error.issues,
      };
    }

    if (error instanceof UnauthorizedException) {
      return {
        name: error.name,
        message: error.message,
        code: 'AUTHENTICATION_ERROR',
        context: baseContext,
        stack: error.stack,
      };
    }

    if (error instanceof ForbiddenException) {
      return {
        name: error.name,
        message: error.message,
        code: 'ACCESS_DENIED',
        context: baseContext,
        stack: error.stack,
      };
    }

    if (error instanceof NotFoundException) {
      return {
        name: error.name,
        message: error.message,
        code: 'DOCUMENT_NOT_FOUND',
        context: baseContext,
        stack: error.stack,
      };
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        code: 'UNKNOWN_ERROR',
        context: baseContext,
        stack: error.stack,
      };
    }

    return {
      name: 'UnknownError',
      message: String(error),
      code: 'UNKNOWN_ERROR',
      context: baseContext,
    };
  }

  /**
   * Log error with appropriate level and context
   */
  static logError(structuredError: StructuredError): void {
    const { name, message, code, context, stack, details } = structuredError;
    
    const logData = {
      error: name,
      message,
      code,
      ...context,
      ...(details ? { details } : {}),
    };

    // Log with appropriate level based on error type
    if (this.isCriticalError(code)) {
      this.logger.error(`💥 CRITICAL: ${message}`, logData);
      if (stack) {
        this.logger.error(stack);
      }
    } else if (this.isUserError(code)) {
      this.logger.warn(`⚠️  USER ERROR: ${message}`, logData);
    } else {
      this.logger.error(`❌ ERROR: ${message}`, logData);
      if (stack) {
        this.logger.debug(stack);
      }
    }
  }

  /**
   * Handle error and return safe response for client
   */
  static handleError(
    error: unknown,
    context: Partial<ErrorContext> = {}
  ): { message: string; code: string; shouldRetry: boolean } {
    const structuredError = this.structureError(error, context);
    this.logError(structuredError);

    return {
      message: this.getSafeMessage(structuredError),
      code: structuredError.code,
      shouldRetry: this.shouldRetry(structuredError.code),
    };
  }

  private static getErrorCode(error: DocumentError | CollaborationError | ValidationError): string {
    switch (error.name) {
      case 'DocumentNotFoundError':
        return 'DOCUMENT_NOT_FOUND';
      case 'AccessDeniedError':
        return 'ACCESS_DENIED';
      case 'CollaborationError':
        return 'COLLABORATION_ERROR';
      case 'ValidationError':
        return 'VALIDATION_ERROR';
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  private static isCriticalError(code: string): boolean {
    const criticalCodes = [
      'DATABASE_CONNECTION_FAILED',
      'SYSTEM_FAILURE',
      'CORRUPTION_DETECTED',
    ];
    return criticalCodes.includes(code);
  }

  private static isUserError(code: string): boolean {
    const userErrorCodes = [
      'VALIDATION_FAILED',
      'ACCESS_DENIED',
      'AUTHENTICATION_ERROR',
      'DOCUMENT_NOT_FOUND',
      'INSUFFICIENT_PERMISSIONS',
    ];
    return userErrorCodes.includes(code);
  }

  private static getSafeMessage(error: StructuredError): string {
    // Return safe messages that don't expose internal details
    const safeMsgMap: Record<string, string> = {
      'DOCUMENT_NOT_FOUND': 'Document not found or access denied',
      'ACCESS_DENIED': 'Access denied',
      'AUTHENTICATION_ERROR': error.message, // Pass through original auth error messages
      'VALIDATION_FAILED': 'Invalid input provided',
      'COLLABORATION_ERROR': 'Collaboration service temporarily unavailable',
      'DATABASE_CONNECTION_FAILED': 'Service temporarily unavailable',
      'UNKNOWN_ERROR': error.message, // Pass through original error messages for unknown errors
    };

    return safeMsgMap[error.code] || 'An unexpected error occurred';
  }

  private static shouldRetry(code: string): boolean {
    const retryableCodes = [
      'DATABASE_CONNECTION_FAILED',
      'COLLABORATION_ERROR',
      'NETWORK_ERROR',
    ];
    return retryableCodes.includes(code);
  }

  private static generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}