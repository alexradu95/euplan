/**
 * API types for consistent request/response handling
 */

export interface DocumentUpdateRequest {
  content?: string;
  title?: string;
}

export interface DocumentResponse {
  id: string;
  title: string;
  content: string | null;
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

// Dashboard API types
export interface DashboardConfigRequest {
  period: 'daily' | 'weekly' | 'monthly';
  layout: string; // JSON string of widget layout configuration
}

export interface DashboardConfigResponse {
  id: string;
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  layout: string; // JSON string of widget layout configuration
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetRequest {
  configId: string;
  type: string;
  position: string; // JSON string of position data
  settings?: string; // JSON string of widget settings
}

export interface WidgetResponse {
  id: string;
  userId: string;
  configId: string;
  type: string;
  position: string;
  settings: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetDataRequest {
  widgetId: string;
  periodId: string;
  data: string; // Encrypted JSON string of widget content
}

export interface WidgetDataResponse {
  id: string;
  widgetId: string;
  userId: string;
  periodId: string;
  data: string | null; // Encrypted JSON string of widget content
  createdAt: Date;
  updatedAt: Date;
}