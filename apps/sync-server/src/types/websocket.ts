/**
 * WebSocket message types for type-safe communication
 */
import type { Socket } from 'socket.io';
import type * as Y from 'yjs';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  documentId?: string;
  ydoc?: Y.Doc;
}

export interface JoinDocumentMessage {
  documentId: string;
}

export interface DocumentUpdateMessage {
  update: number[];
  documentId: string;
}

export interface AwarenessState {
  user?: {
    name?: string;
    color?: string;
    cursor?: {
      anchor: number;
      head: number;
    };
  };
  selection?: {
    anchor: number;
    head: number;
  };
  [key: string]: unknown; // Allow additional fields for extensibility
}

export interface AwarenessUpdateMessage {
  awareness: AwarenessState;
  documentId: string;
}

export interface WebSocketErrorResponse {
  message: string;
  code?: string;
  timestamp?: number;
}

export interface DocumentSyncResponse {
  documentId: string;
  state: number[];
}

export interface UserJoinedResponse {
  userId: string;
  clientId: string;
}

export interface UserLeftResponse {
  userId: string;
  clientId: string;
}

// Type-safe event handlers
export interface WebSocketEventHandlers {
  'join_document': (data: JoinDocumentMessage) => void;
  'document_update': (data: DocumentUpdateMessage) => void;
  'awareness_update': (data: AwarenessUpdateMessage) => void;
  'auth_error': (error: WebSocketErrorResponse) => void;
  'join_error': (error: WebSocketErrorResponse) => void;
  'update_error': (error: WebSocketErrorResponse) => void;
  'document_sync': (data: DocumentSyncResponse) => void;
  'user_joined': (data: UserJoinedResponse) => void;
  'user_left': (data: UserLeftResponse) => void;
}