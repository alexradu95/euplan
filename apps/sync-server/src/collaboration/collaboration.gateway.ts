/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable prettier/prettier */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from '../documents/documents.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  documentId?: string;
  ydoc?: Y.Doc;
}

interface DocumentRoom {
  ydoc: Y.Doc;
  clients: Set<AuthenticatedSocket>;
  lastSaved: number;
}

@Injectable()
@WebSocketGateway({
  namespace: '/collaboration',
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-domain.com'] 
      : ['http://localhost:3000'],
    credentials: true,
  },
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private readonly documents = new Map<string, DocumentRoom>();
  private readonly saveInterval = 5000; // Save every 5 seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly documentsService: DocumentsService
  ) {
    this.logger.log('🔌 CollaborationGateway initialized');
    // Periodic save to database
    setInterval(() => this.saveAllDocuments(), this.saveInterval);
  }

  /**
   * Handle new client connections
   */
  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`New client connection attempt: ${client.id}`);
    this.logger.log(`Handshake auth:`, client.handshake.auth);
    this.logger.log(`Handshake query:`, client.handshake.query);
    
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      
      this.logger.log(`Extracted token: ${token}`);
      
      if (!token) {
        throw new UnauthorizedException('No authentication token provided');
      }

      // For now, use simple token validation (user ID directly)
      // In production, implement proper JWT verification or session validation
      if (typeof token === 'string' && token.length > 0) {
        client.userId = token;
        this.logger.log(`✅ Client ${client.id} authenticated with user ID: ${client.userId}`);
      } else {
        throw new UnauthorizedException('Invalid authentication token');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.logger.error('❌ Authentication failed:', errorMessage);
      client.emit('auth_error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnections
   */
  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.documentId && client.userId) {
      await this.leaveDocument(client, client.documentId);
      this.logger.log(`Client ${client.id} (user: ${client.userId}) disconnected`);
    }
  }

  /**
   * Handle client joining a document
   */
  @SubscribeMessage('join_document')
  async handleJoinDocument(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { documentId: string }
  ) {
    try {
      const { documentId } = data;
      
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to join document';
      this.logger.error('Failed to join document:', errorMessage);
      client.emit('join_error', { message: errorMessage });
    }
  }

  /**
   * Handle Y.js document updates from clients
   */
  @SubscribeMessage('document_update')
  async handleDocumentUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { update: number[]; documentId: string }
  ) {
    try {
      const { update, documentId } = data;
      
      console.log(`📝 Received document update from client ${client.id} for document ${documentId}`);
      console.log(`Update size: ${update.length} bytes`);
      
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

      console.log(`📡 Broadcasting update to ${room.clients.size - 1} other clients in room ${documentId}`);

      // Broadcast the update to all other clients in the room
      client.to(documentId).emit('document_update', { 
        update: update,
        clientId: client.id,
        userId: client.userId
      });

      // Mark as needing save
      room.lastSaved = Date.now();

      console.log(`✅ Update processed successfully for document ${documentId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process document update';
      this.logger.error('Failed to process document update:', errorMessage);
      client.emit('update_error', { message: errorMessage });
    }
  }

  /**
   * Handle client requesting awareness info (cursors, selections)
   */
  @SubscribeMessage('awareness_update')
  async handleAwarenessUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { awareness: any; documentId: string }
  ) {
    try {
      const { awareness, documentId } = data;
      
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
   * Leave a document room
   */
  private async leaveDocument(client: AuthenticatedSocket, documentId: string) {
    const room = this.documents.get(documentId);
    if (room) {
      room.clients.delete(client);
      
      // Clean up empty rooms
      if (room.clients.size === 0) {
        // Save before cleanup
        try {
          await this.documentsService.saveDocument(documentId, client.userId!, room.ydoc);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to save document';
          this.logger.error(`Failed to save document ${documentId}:`, errorMessage);
        }
        
        this.documents.delete(documentId);
        this.logger.log(`Cleaned up empty room for document: ${documentId}`);
      }
    }

    client.leave(documentId);
    
    // Notify other clients about disconnection
    client.to(documentId).emit('user_left', { 
      userId: client.userId, 
      clientId: client.id 
    });
  }

  /**
   * Periodically save all active documents
   */
  private async saveAllDocuments() {
    const now = Date.now();
    const savePromises: Promise<void>[] = [];

    for (const [documentId, room] of this.documents.entries()) {
      // Save if there's been activity and it's been at least 5 seconds
      if (room.clients.size > 0 && (now - room.lastSaved) >= this.saveInterval) {
        // Get any user from the room for saving (all have access)
        const anyClient = Array.from(room.clients)[0];
        if (anyClient?.userId) {
          const savePromise = (async () => {
            try {
              await this.documentsService.saveDocument(documentId, anyClient.userId!, room.ydoc);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Failed to auto-save document';
              this.logger.error(`Failed to auto-save document ${documentId}:`, errorMessage);
            }
          })();
          
          savePromises.push(savePromise);
        }
      }
    }

    if (savePromises.length > 0) {
      await Promise.all(savePromises);
      this.logger.debug(`Auto-saved ${savePromises.length} documents`);
    }
  }
}