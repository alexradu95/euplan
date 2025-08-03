import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Injectable, Logger, UnauthorizedException, OnModuleDestroy } from '@nestjs/common';
import { LoggerService } from '../common/logger.service';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from '../documents/documents.service';
import { JwtService } from '../auth/jwt.service';
import { JoinDocumentSchema, DocumentUpdateSchema, AwarenessUpdateSchema } from '../validation/schemas';
import { ZodError } from 'zod';
import type { 
  AuthenticatedSocket, 
  JoinDocumentMessage, 
  DocumentUpdateMessage, 
  AwarenessUpdateMessage 
} from '../types/websocket';
import { config } from '../config/environment';
import { ErrorHandler } from '../common/error-handler';
import { RateLimiter } from '../security/rate-limiter';
import { PerformanceMonitor } from '../common/performance-monitor';


interface DocumentRoom {
  ydoc: Y.Doc;
  clients: Set<AuthenticatedSocket>;
  lastSaved: number;
}

@Injectable()
@WebSocketGateway({
  namespace: '/collaboration',
  cors: {
    origin: config.getAllowedOrigins(),
    credentials: true,
  },
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private readonly documents = new Map<string, DocumentRoom>();
  private readonly saveInterval = config.getNumber('WS_SAVE_INTERVAL');
  private readonly connectedClients = new Set<AuthenticatedSocket>();
  private saveIntervalTimer?: NodeJS.Timeout;
  
  // Rate limiters
  private readonly connectionRateLimit = RateLimiter.create('connection', {
    windowMs: 60000, // 1 minute
    maxRequests: 10, // 10 connections per minute
  });
  
  private readonly messageRateLimit = RateLimiter.create('message', {
    windowMs: 1000, // 1 second
    maxRequests: 30, // 30 messages per second
  });
  
  private readonly documentUpdateRateLimit = RateLimiter.create('document_update', {
    windowMs: 1000, // 1 second
    maxRequests: 10, // 10 updates per second
  });

  constructor(
    private readonly configService: ConfigService,
    private readonly documentsService: DocumentsService,
    private readonly jwtService: JwtService,
    private readonly loggerService: LoggerService
  ) {
    this.logger.log('🔌 CollaborationGateway initialized');
    // Periodic save to database with proper cleanup
    this.saveIntervalTimer = setInterval(() => this.saveAllDocuments(), this.saveInterval);
  }

  /**
   * Cleanup resources when the module is destroyed
   */
  onModuleDestroy() {
    this.logger.log('🧹 Cleaning up CollaborationGateway resources');
    
    // Clear the save interval timer
    if (this.saveIntervalTimer) {
      clearInterval(this.saveIntervalTimer);
      this.saveIntervalTimer = undefined;
    }
    
    // Disconnect all clients gracefully
    this.connectedClients.forEach(client => {
      try {
        client.disconnect(true);
      } catch (error) {
        this.logger.warn(`Failed to disconnect client ${client.id}:`, error);
      }
    });
    this.connectedClients.clear();
    
    // Save all documents before shutdown
    this.saveAllDocuments().catch(error => {
      this.logger.error('Failed to save documents during shutdown:', error);
    });
    
    // Clear document rooms
    this.documents.clear();
    
    this.logger.log('✅ CollaborationGateway cleanup completed');
  }

  /**
   * Handle new client connections
   */
  async handleConnection(client: AuthenticatedSocket) {
    // Rate limit connections
    if (!this.connectionRateLimit(client.id)) {
      this.logger.warn(`Connection rate limit exceeded for client ${client.id}`);
      client.emit('auth_error', {
        message: 'Too many connection attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        shouldRetry: true,
      });
      client.disconnect();
      return;
    }
    
    this.loggerService.wsLog('New client connection attempt', client.id);
    
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      
      if (!token) {
        throw new UnauthorizedException('No authentication token provided');
      }

      // Verify JWT token with performance tracking
      const payload = await PerformanceMonitor.trackOperation(
        'user_authentication',
        async () => this.jwtService.verifyToken(token),
        { clientId: client.id }
      );
      
      if (!payload) {
        throw new UnauthorizedException('Invalid or expired authentication token');
      }

      client.userId = payload.userId;
      
      // Track connected client for cleanup
      this.connectedClients.add(client);
      
      this.loggerService.authLog('Client authenticated successfully', payload.userId, {
        clientId: client.id,
        email: payload.email,
        totalConnections: this.connectedClients.size
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, {
        clientId: client.id,
        operation: 'authentication',
      });
      
      client.emit('auth_error', {
        message: errorResponse.message,
        code: errorResponse.code,
        shouldRetry: errorResponse.shouldRetry,
      });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnections
   */
  async handleDisconnect(client: AuthenticatedSocket) {
    // Remove from connected clients tracking
    this.connectedClients.delete(client);
    
    if (client.documentId && client.userId) {
      await this.leaveDocument(client, client.documentId);
      this.logger.log(`Client ${client.id} (user: ${client.userId}) disconnected. Remaining connections: ${this.connectedClients.size}`);
    } else {
      this.logger.log(`Unauthenticated client ${client.id} disconnected. Remaining connections: ${this.connectedClients.size}`);
    }
  }

  /**
   * Handle client joining a document
   */
  @SubscribeMessage('join_document')
  async handleJoinDocument(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: unknown
  ) {
    // Rate limit messages
    if (!this.messageRateLimit(client.id)) {
      client.emit('join_error', {
        message: 'Too many requests. Please slow down.',
        code: 'RATE_LIMIT_EXCEEDED',
        shouldRetry: true,
      });
      return;
    }
    
    try {
      // Validate input data
      const validatedData = JoinDocumentSchema.parse(data);
      const { documentId } = validatedData;
      
      if (!client.userId) {
        throw new UnauthorizedException('Client not authenticated');
      }

      // Load the document and check access
      const ydoc = await this.documentsService.loadDocument(documentId, client.userId);
      
      // Leave previous document if any
      if (client.documentId) {
        await this.leaveDocument(client, client.documentId);
      }

      // Join the new document room
      client.documentId = documentId;
      client.ydoc = ydoc;
      client.join(documentId);

      // Initialize or get document room
      if (!this.documents.has(documentId)) {
        this.documents.set(documentId, {
          ydoc: new Y.Doc(),
          clients: new Set(),
          lastSaved: Date.now(),
        });
        this.logger.log(`🏠 Created new document room for: ${documentId}`);
      }

      const room = this.documents.get(documentId)!;
      room.clients.add(client);

      this.logger.log(`👥 Room ${documentId} now has ${room.clients.size} clients connected`);

      // Sync the server document with the loaded document
      const serverState = Y.encodeStateAsUpdate(ydoc);
      Y.applyUpdate(room.ydoc, serverState);

      // Send current document state to the client
      const currentState = Y.encodeStateAsUpdate(room.ydoc);
      client.emit('document_sync', Array.from(currentState));

      this.logger.log(`✅ Client ${client.id} joined document: ${documentId}`);
      
      // Notify other clients about the new connection
      client.to(documentId).emit('user_joined', { 
        userId: client.userId, 
        clientId: client.id 
      });

      this.logger.log(`📢 Notified ${room.clients.size - 1} other clients about new user joining`);

    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, {
        clientId: client.id,
        userId: client.userId,
        operation: 'join_document',
      });
      
      client.emit('join_error', {
        message: errorResponse.message,
        code: errorResponse.code,
        shouldRetry: errorResponse.shouldRetry,
      });
    }
  }

  /**
   * Handle Y.js document updates from clients
   */
  @SubscribeMessage('document_update')
  async handleDocumentUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: unknown
  ) {
    return PerformanceMonitor.trackOperation(
      'websocket_message',
      async () => this.processDocumentUpdate(client, data),
      { 
        clientId: client.id, 
        userId: client.userId,
        messageType: 'document_update'
      }
    );
  }

  private async processDocumentUpdate(
    client: AuthenticatedSocket,
    data: unknown
  ) {
    // Rate limit document updates specifically
    if (!this.documentUpdateRateLimit(client.id)) {
      client.emit('update_error', {
        message: 'Too many document updates. Please slow down.',
        code: 'RATE_LIMIT_EXCEEDED',
        shouldRetry: true,
      });
      return;
    }
    
    try {
      // Validate input data
      const validatedData = DocumentUpdateSchema.parse(data);
      const { update, documentId } = validatedData;
      
      this.loggerService.wsLog('Received document update', client.id, {
        documentId,
        updateSize: update.length,
        userId: client.userId
      });
      
      if (!client.userId || client.documentId !== documentId) {
        throw new UnauthorizedException('Invalid document access');
      }

      // Check write access
      const hasAccess = await this.documentsService.hasWriteAccess(documentId, client.userId);
      if (!hasAccess) {
        throw new UnauthorizedException('No write access to document');
      }

      const room = this.documents.get(documentId);
      if (!room) {
        throw new Error('Document room not found');
      }

      // Apply the update to the server document
      const updateArray = new Uint8Array(update);
      Y.applyUpdate(room.ydoc, updateArray);

      this.loggerService.wsLog('Broadcasting update to clients', client.id, {
        documentId,
        clientCount: room.clients.size - 1,
        userId: client.userId
      });

      // Broadcast the update to all other clients in the room
      client.to(documentId).emit('document_update', { 
        update: update,
        clientId: client.id,
        userId: client.userId
      });

      // Mark as needing save
      room.lastSaved = Date.now();

      this.loggerService.wsLog('Update processed successfully', client.id, {
        documentId,
        userId: client.userId
      });

    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, {
        clientId: client.id,
        userId: client.userId,
        operation: 'document_update',
      });
      
      client.emit('update_error', {
        message: errorResponse.message,
        code: errorResponse.code,
        shouldRetry: errorResponse.shouldRetry,
      });
    }
  }

  /**
   * Handle client requesting awareness info (cursors, selections)
   */
  @SubscribeMessage('awareness_update')
  async handleAwarenessUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: unknown
  ) {
    try {
      // Validate input data
      const validatedData = AwarenessUpdateSchema.parse(data);
      const { awareness, documentId } = validatedData;
      
      if (client.documentId !== documentId) {
        return;
      }

      // Broadcast awareness update to other clients
      client.to(documentId).emit('awareness_update', {
        awareness,
        clientId: client.id,
        userId: client.userId
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process awareness update';
      this.logger.error('Failed to process awareness update:', errorMessage);
    }
  }

  /**
   * Leave a document room with comprehensive cleanup
   */
  private async leaveDocument(client: AuthenticatedSocket, documentId: string) {
    const room = this.documents.get(documentId);
    if (room) {
      room.clients.delete(client);
      
      this.logger.debug(`Client ${client.id} left document ${documentId}. Room now has ${room.clients.size} clients`);
      
      // Clean up empty rooms
      if (room.clients.size === 0) {
        this.logger.log(`📄 Document room ${documentId} is empty, saving and cleaning up`);
        
        // Save before cleanup
        try {
          if (client.userId) {
            await this.documentsService.saveDocument(documentId, client.userId, room.ydoc);
            this.logger.log(`💾 Saved document ${documentId} during room cleanup`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to save document';
          this.logger.error(`❌ Failed to save document ${documentId} during cleanup:`, errorMessage);
        }
        
        // Clear Y.js document to free memory
        room.ydoc.destroy();
        
        // Remove from documents map
        this.documents.delete(documentId);
        this.logger.log(`🧹 Cleaned up empty room for document: ${documentId}. Active rooms: ${this.documents.size}`);
      }
    }

    // Leave the socket.io room
    client.leave(documentId);
    
    // Notify other clients about disconnection
    if (client.userId) {
      client.to(documentId).emit('user_left', { 
        userId: client.userId, 
        clientId: client.id 
      });
    }
    
    // Clear client document state
    client.documentId = undefined;
    client.ydoc = undefined;
  }

  /**
   * Periodically save all active documents with performance monitoring
   */
  private async saveAllDocuments() {
    const startTime = Date.now();
    const savePromises: Promise<void>[] = [];
    const now = Date.now();

    this.logger.debug(`🔄 Starting auto-save cycle. Active rooms: ${this.documents.size}, Connected clients: ${this.connectedClients.size}`);

    for (const [documentId, room] of this.documents.entries()) {
      // Save if there's been activity and it's been at least the save interval
      if (room.clients.size > 0 && (now - room.lastSaved) >= this.saveInterval) {
        // Get any user from the room for saving (all have access)
        const anyClient = Array.from(room.clients)[0];
        if (anyClient?.userId) {
          const savePromise = (async () => {
            try {
              await this.documentsService.saveDocument(documentId, anyClient.userId!, room.ydoc);
              room.lastSaved = now; // Update last saved timestamp
              this.logger.debug(`💾 Auto-saved document ${documentId}`);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to auto-save document';
              this.logger.error(`❌ Failed to auto-save document ${documentId}:`, errorMessage);
            }
          })();
          
          savePromises.push(savePromise);
        }
      }
    }

    if (savePromises.length > 0) {
      await Promise.all(savePromises);
      const duration = Date.now() - startTime;
      this.logger.log(`💾 Auto-saved ${savePromises.length} documents in ${duration}ms`);
    } else {
      this.logger.debug(`ℹ️ No documents needed saving`);
    }
  }

  /**
   * Get gateway health status
   */
  getHealthStatus() {
    return {
      connectedClients: this.connectedClients.size,
      activeDocuments: this.documents.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
}