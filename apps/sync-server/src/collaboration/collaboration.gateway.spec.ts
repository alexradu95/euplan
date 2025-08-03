import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import { CollaborationGateway } from './collaboration.gateway';
import { DocumentsService } from '../documents/documents.service';
import { LoggerService } from '../common/logger.service';
import { JwtService } from '../auth/jwt.service';
import type { AuthenticatedSocket } from '../types/websocket';

interface MockSocket extends Partial<AuthenticatedSocket> {
  id: string;
  userId?: string;
  documentId?: string;
  ydoc?: Y.Doc;
  handshake: any;
  emit: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
  to: jest.Mock;
  disconnect: jest.Mock;
}

const createMockSocket = (overrides?: Partial<MockSocket>): AuthenticatedSocket => {
  const toMock = {
    emit: jest.fn(),
  };

  return {
    id: 'socket123',
    handshake: { auth: {}, query: {} } as any,
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    to: jest.fn().mockReturnValue(toMock),
    disconnect: jest.fn(),
    ...overrides,
  } as unknown as AuthenticatedSocket;
};

const createMockDocumentsService = () => ({
  loadDocument: jest.fn(),
  saveDocument: jest.fn(),
  hasWriteAccess: jest.fn(),
  getUserDocuments: jest.fn(),
});

const createMockConfigService = () => ({
  get: jest.fn(),
});

const createMockLoggerService = () => ({
  wsLog: jest.fn(),
  authLog: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
});

const createMockJwtService = () => ({
  verifyToken: jest.fn(),
  extractTokenFromHeader: jest.fn(),
});

describe('CollaborationGateway', () => {
  let gateway: CollaborationGateway;
  let mockDocumentsService: ReturnType<typeof createMockDocumentsService>;
  let mockConfigService: ReturnType<typeof createMockConfigService>;
  let mockLoggerService: ReturnType<typeof createMockLoggerService>;
  let mockJwtService: ReturnType<typeof createMockJwtService>;

  beforeEach(async () => {
    mockDocumentsService = createMockDocumentsService();
    mockConfigService = createMockConfigService();
    mockLoggerService = createMockLoggerService();
    mockJwtService = createMockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationGateway,
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    gateway = module.get<CollaborationGateway>(CollaborationGateway);

    // Mock the server property
    gateway.server = {
      emit: jest.fn(),
    } as unknown as Server;
  });

  describe('handleConnection', () => {
    it('should authenticate client with valid token', async () => {
      const mockSocket = createMockSocket({
        handshake: { auth: { token: 'valid-token' } },
      });

      mockJwtService.verifyToken.mockReturnValue({
        userId: 'user123',
        email: 'test@example.com',
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.userId).toBe('user123');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should authenticate client with token in query', async () => {
      const mockSocket = createMockSocket({
        handshake: { query: { token: 'valid-token' } },
      });

      mockJwtService.verifyToken.mockReturnValue({
        userId: 'user456',
        email: 'test@example.com',
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.userId).toBe('user456');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect client with no token', async () => {
      const mockSocket = createMockSocket({
        handshake: { auth: {}, query: {} },
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('auth_error', {
        message: expect.stringContaining('No authentication token provided'),
        code: expect.any(String),
        shouldRetry: expect.any(Boolean),
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should disconnect client with empty token', async () => {
      const mockSocket = createMockSocket({
        handshake: { auth: { token: '' } },
      });

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('auth_error', {
        message: expect.stringContaining('No authentication token provided'),
        code: expect.any(String),
        shouldRetry: expect.any(Boolean),
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should prioritize auth token over query token', async () => {
      const mockSocket = createMockSocket({
        handshake: { 
          auth: { token: 'auth-token' },
          query: { token: 'query-token' }
        },
      });

      mockJwtService.verifyToken.mockReturnValue({
        userId: 'auth-user',
        email: 'test@example.com',
      });

      await gateway.handleConnection(mockSocket);

      expect(mockJwtService.verifyToken).toHaveBeenCalledWith('auth-token');
      expect(mockSocket.userId).toBe('auth-user');
    });
  });

  describe('handleJoinDocument', () => {
    it('should allow authenticated user to join document with access', async () => {
      const mockYDoc = new Y.Doc();
      const mockSocket = createMockSocket({ userId: 'user123' });
      
      mockDocumentsService.loadDocument.mockResolvedValue(mockYDoc);

      await gateway.handleJoinDocument(mockSocket, { documentId: 'doc123' });

      expect(mockSocket.documentId).toBe('doc123');
      expect(mockSocket.ydoc).toBe(mockYDoc);
      expect(mockSocket.join).toHaveBeenCalledWith('doc123');
      expect(mockSocket.emit).toHaveBeenCalledWith('document_sync', expect.any(Array));
    });

    it('should reject unauthenticated user', async () => {
      const mockSocket = createMockSocket({ userId: undefined });

      await gateway.handleJoinDocument(mockSocket, { documentId: 'doc123' });

      expect(mockSocket.emit).toHaveBeenCalledWith('join_error', {
        message: expect.stringContaining('not authenticated'),
        code: expect.any(String),
        shouldRetry: expect.any(Boolean),
      });
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('should handle document load error', async () => {
      const mockSocket = createMockSocket({ userId: 'user123' });
      
      mockDocumentsService.loadDocument.mockRejectedValue(
        new Error('Document not found')
      );

      await gateway.handleJoinDocument(mockSocket, { documentId: 'doc123' });

      expect(mockSocket.emit).toHaveBeenCalledWith('join_error', {
        message: expect.stringContaining('Document not found'),
        code: expect.any(String),
        shouldRetry: expect.any(Boolean),
      });
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('should leave previous document when joining new one', async () => {
      const mockYDoc = new Y.Doc();
      const mockSocket = createMockSocket({ 
        userId: 'user123',
        documentId: 'old-doc',
      });
      
      mockDocumentsService.loadDocument.mockResolvedValue(mockYDoc);

      await gateway.handleJoinDocument(mockSocket, { documentId: 'new-doc' });

      expect(mockSocket.leave).toHaveBeenCalledWith('old-doc');
      expect(mockSocket.documentId).toBe('new-doc');
    });

    it('should notify other clients when user joins', async () => {
      const mockYDoc = new Y.Doc();
      const mockSocket = createMockSocket({ userId: 'user123' });
      
      mockDocumentsService.loadDocument.mockResolvedValue(mockYDoc);

      await gateway.handleJoinDocument(mockSocket, { documentId: 'doc123' });

      expect(mockSocket.to).toHaveBeenCalledWith('doc123');
      expect(mockSocket.to('doc123').emit).toHaveBeenCalledWith('user_joined', {
        userId: 'user123',
        clientId: 'socket123',
      });
    });
  });

  describe('handleDocumentUpdate', () => {
    it('should process valid document update from authenticated user', async () => {
      const mockSocket = createMockSocket({ 
        userId: 'user123',
        documentId: 'doc123',
      });
      
      mockDocumentsService.hasWriteAccess.mockResolvedValue(true);
      mockDocumentsService.loadDocument.mockResolvedValue(new Y.Doc());

      // Set up document room (normally done in handleJoinDocument)
      await gateway.handleJoinDocument(mockSocket, { documentId: 'doc123' });

      // Reset mocks to focus on the document update behavior
      (mockSocket.to as jest.Mock).mockClear();
      const toMock = {
        emit: jest.fn(),
      };
      (mockSocket.to as jest.Mock).mockReturnValue(toMock);
      mockDocumentsService.hasWriteAccess.mockResolvedValue(true);

      // Create a valid Y.js update
      const testDoc = new Y.Doc();
      testDoc.getText('content').insert(0, 'test');
      const validUpdate = Array.from(Y.encodeStateAsUpdate(testDoc));

      const updateData = {
        update: validUpdate,
        documentId: 'doc123',
      };

      await gateway.handleDocumentUpdate(mockSocket, updateData);

      expect(mockSocket.to).toHaveBeenCalledWith('doc123');
      expect(mockSocket.to('doc123').emit).toHaveBeenCalledWith('document_update', {
        update: updateData.update,
        clientId: 'socket123',
        userId: 'user123',
      });
    });

    it('should reject update from unauthenticated user', async () => {
      const mockSocket = createMockSocket({ userId: undefined });

      const updateData = {
        update: [1, 2, 3, 4],
        documentId: 'doc123',
      };

      await gateway.handleDocumentUpdate(mockSocket, updateData);

      expect(mockSocket.emit).toHaveBeenCalledWith('update_error', {
        message: expect.stringContaining('Invalid document access'),
      });
    });

    it('should reject update for wrong document', async () => {
      const mockSocket = createMockSocket({ 
        userId: 'user123',
        documentId: 'doc456', // Different document
      });

      const updateData = {
        update: [1, 2, 3, 4],
        documentId: 'doc123',
      };

      await gateway.handleDocumentUpdate(mockSocket, updateData);

      expect(mockSocket.emit).toHaveBeenCalledWith('update_error', {
        message: expect.stringContaining('Invalid document access'),
      });
    });

    it('should reject update from user without write access', async () => {
      const mockSocket = createMockSocket({ 
        userId: 'user123',
        documentId: 'doc123',
      });
      
      mockDocumentsService.hasWriteAccess.mockResolvedValue(false);

      const updateData = {
        update: [1, 2, 3, 4],
        documentId: 'doc123',
      };

      await gateway.handleDocumentUpdate(mockSocket, updateData);

      expect(mockSocket.emit).toHaveBeenCalledWith('update_error', {
        message: expect.stringContaining('No write access'),
      });
    });

    it('should handle document room not found', async () => {
      const mockSocket = createMockSocket({ 
        userId: 'user123',
        documentId: 'doc123',
      });
      
      mockDocumentsService.hasWriteAccess.mockResolvedValue(true);

      const updateData = {
        update: [1, 2, 3, 4],
        documentId: 'doc123',
      };

      await gateway.handleDocumentUpdate(mockSocket, updateData);

      expect(mockSocket.emit).toHaveBeenCalledWith('update_error', {
        message: expect.stringContaining('Document room not found'),
      });
    });
  });

  describe('handleAwarenessUpdate', () => {
    it('should broadcast awareness update to other clients', async () => {
      const mockSocket = createMockSocket({ 
        userId: 'user123',
        documentId: 'doc123',
      });

      const awarenessData = {
        awareness: { cursor: { x: 10, y: 20 } },
        documentId: 'doc123',
      };

      await gateway.handleAwarenessUpdate(mockSocket, awarenessData);

      expect(mockSocket.to).toHaveBeenCalledWith('doc123');
      expect(mockSocket.to('doc123').emit).toHaveBeenCalledWith('awareness_update', {
        awareness: awarenessData.awareness,
        clientId: 'socket123',
        userId: 'user123',
      });
    });

    it('should ignore awareness update for wrong document', async () => {
      const mockSocket = createMockSocket({ 
        userId: 'user123',
        documentId: 'doc456', // Different document
      });

      const awarenessData = {
        awareness: { cursor: { x: 10, y: 20 } },
        documentId: 'doc123',
      };

      await gateway.handleAwarenessUpdate(mockSocket, awarenessData);

      // Should not broadcast anything
      expect(mockSocket.to).not.toHaveBeenCalled();
    });

    it('should handle awareness update errors gracefully', async () => {
      const mockSocket = createMockSocket({ 
        userId: 'user123',
        documentId: 'doc123',
      });

      // Mock to() to throw an error
      mockSocket.to = jest.fn().mockImplementation(() => {
        throw new Error('Broadcast error');
      });

      const awarenessData = {
        awareness: { cursor: { x: 10, y: 20 } },
        documentId: 'doc123',
      };

      // Should not throw error
      await expect(gateway.handleAwarenessUpdate(mockSocket, awarenessData))
        .resolves
        .toBeUndefined();
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up when authenticated user disconnects', async () => {
      const mockSocket = createMockSocket({ 
        userId: 'user123',
        documentId: 'doc123',
      });

      // Mock the private leaveDocument method behavior
      jest.spyOn(gateway as any, 'leaveDocument').mockResolvedValue(undefined);

      await gateway.handleDisconnect(mockSocket);

      expect((gateway as any).leaveDocument).toHaveBeenCalledWith(mockSocket, 'doc123');
    });

    it('should handle disconnect for unauthenticated user', async () => {
      const mockSocket = createMockSocket({ 
        userId: undefined,
        documentId: undefined,
      });

      // Should not throw error
      await expect(gateway.handleDisconnect(mockSocket))
        .resolves
        .toBeUndefined();
    });
  });

  describe('real-time collaboration scenarios', () => {
    it('should handle multiple clients joining same document', async () => {
      const mockYDoc = new Y.Doc();
      const client1 = createMockSocket({ id: 'client1', userId: 'user1' });
      const client2 = createMockSocket({ id: 'client2', userId: 'user2' });
      
      mockDocumentsService.loadDocument.mockResolvedValue(mockYDoc);

      // First client joins
      await gateway.handleJoinDocument(client1, { documentId: 'doc123' });
      
      // Second client joins
      await gateway.handleJoinDocument(client2, { documentId: 'doc123' });

      // Both clients should be notified about each other
      expect(client1.to).toHaveBeenCalledWith('doc123');
      expect(client2.to).toHaveBeenCalledWith('doc123');
    });

    it('should synchronize Y.js updates between clients', async () => {
      const mockSocket1 = createMockSocket({ 
        id: 'client1',
        userId: 'user1',
        documentId: 'doc123',
      });
      const mockSocket2 = createMockSocket({ 
        id: 'client2',
        userId: 'user2',
        documentId: 'doc123',
      });
      
      mockDocumentsService.hasWriteAccess.mockResolvedValue(true);

      // Create Y.js document and apply some changes
      const ydoc = new Y.Doc();
      const text = ydoc.getText('content');
      text.insert(0, 'Hello');
      
      // Mock the document room with the Y.js document
      const documentRoom = {
        ydoc: ydoc,
        clients: new Set([mockSocket1, mockSocket2]),
        lastSaved: Date.now(),
      };
      
      // Access private documents map to set up the room
      (gateway as any).documents.set('doc123', documentRoom);

      const updateData = {
        update: Array.from(Y.encodeStateAsUpdate(ydoc)),
        documentId: 'doc123',
      };

      await gateway.handleDocumentUpdate(mockSocket1, updateData);

      // Update should be broadcast to other clients
      expect(mockSocket1.to).toHaveBeenCalledWith('doc123');
      expect(mockSocket1.to('doc123').emit).toHaveBeenCalledWith('document_update', {
        update: updateData.update,
        clientId: 'client1',
        userId: 'user1',
      });
    });
  });
});