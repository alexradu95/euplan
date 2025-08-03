/**
 * API types for consistent request/response handling
 */

export interface DocumentUpdateRequest {
  encryptedContent?: string;
  title?: string;
}

export interface DocumentResponse {
  id: string;
  title: string;
  encryptedContent: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Removed accessLevel - all documents are owned by the user
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T = unknown> {
  data: T;
  message?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Type guards for API responses
export const isApiError = (response: ApiResponse): response is ApiErrorResponse => {
  return 'error' in response;
};

export const isApiSuccess = <T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> => {
  return 'data' in response;
};