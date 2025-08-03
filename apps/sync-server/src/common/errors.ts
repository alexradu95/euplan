/**
 * Custom error types for better error handling
 */

export class DocumentError extends Error {
  constructor(
    message: string,
    public readonly documentId?: string,
    public readonly userId?: string
  ) {
    super(message);
    this.name = 'DocumentError';
  }
}

export class AccessDeniedError extends DocumentError {
  constructor(documentId: string, userId: string, operation: string) {
    super(`Access denied for ${operation} operation on document ${documentId}`, documentId, userId);
    this.name = 'AccessDeniedError';
  }
}

export class DocumentNotFoundError extends DocumentError {
  constructor(documentId: string) {
    super(`Document not found: ${documentId}`, documentId);
    this.name = 'DocumentNotFoundError';
  }
}

export class CollaborationError extends Error {
  constructor(
    message: string,
    public readonly clientId?: string,
    public readonly documentId?: string
  ) {
    super(message);
    this.name = 'CollaborationError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const isCustomError = (error: unknown): error is DocumentError | CollaborationError | ValidationError => {
  return error instanceof DocumentError || 
         error instanceof CollaborationError || 
         error instanceof ValidationError;
};