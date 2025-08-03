import { Injectable, Inject, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { DATABASE_CONNECTION } from '../database/database.module';
import { documents, documentAccess } from '../database/schema';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';

export interface DocumentPersistenceService {
  loadDocument(documentId: string, userId: string): Promise<Y.Doc>;
  saveDocument(documentId: string, userId: string, ydoc: Y.Doc): Promise<void>;
  hasWriteAccess(documentId: string, userId: string): Promise<boolean>;
}

@Injectable()
export class DocumentsService implements DocumentPersistenceService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>
  ) {}

  /**
   * Load a Y.js document from PostgreSQL
   */
  async loadDocument(documentId: string, userId: string): Promise<Y.Doc> {
    const startTime = Date.now();
    try {
      this.logger.debug('Loading document', { documentId, userId });
      
      // First, check if the document exists
      const document = await this.db
        .select({
          id: documents.id,
          encryptedContent: documents.encryptedContent,
        })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);

      this.logger.debug('Document query completed', { 
        documentId, 
        found: document.length > 0,
        hasContent: !!document[0]?.encryptedContent 
      });

      if (document.length === 0) {
        throw new NotFoundException('Document not found');
      }

      // Then check if user has access
      const accessCheck = await this.db
        .select({
          accessLevel: documentAccess.accessLevel,
        })
        .from(documentAccess)
        .where(
          and(
            eq(documentAccess.documentId, documentId),
            eq(documentAccess.userId, userId)
          )
        )
        .limit(1);

      this.logger.debug('Access check completed', { 
        documentId, 
        userId, 
        hasAccess: accessCheck.length > 0,
        accessLevel: accessCheck[0]?.accessLevel 
      });

      if (accessCheck.length === 0) {
        throw new NotFoundException('Access denied');
      }

      const ydoc = new Y.Doc();

      // Load document content if it exists
      if (document[0].encryptedContent) {
        try {
          const binaryData = Uint8Array.from(
            atob(document[0].encryptedContent), 
            c => c.charCodeAt(0)
          );
          Y.applyUpdate(ydoc, binaryData);
        } catch (error) {
          this.logger.error('Failed to load document content', error instanceof Error ? error : new Error(String(error)), { documentId, userId });
        }
      }

      this.logger.debug('Document loaded successfully', { 
        documentId, 
        userId, 
        loadTimeMs: Date.now() - startTime,
        hasContent: !!document[0]?.encryptedContent 
      });
      
      return ydoc;
    } catch (error) {
      this.logger.error('Error in loadDocument', error instanceof Error ? error : new Error(String(error)), { 
        documentId, 
        userId, 
        loadTimeMs: Date.now() - startTime 
      });
      throw error;
    }
  }

  /**
   * Save a Y.js document to PostgreSQL
   */
  async saveDocument(documentId: string, userId: string, ydoc: Y.Doc): Promise<void> {
    // Check if user has write access
    if (!(await this.hasWriteAccess(documentId, userId))) {
      throw new ForbiddenException('Insufficient permissions to save document');
    }

    try {
      // Encode the Y.js document as binary data
      const data = Y.encodeStateAsUpdate(ydoc);
      const base64Data = btoa(String.fromCharCode(...data));

      // Update the document in the database
      await this.db
        .update(documents)
        .set({
          encryptedContent: base64Data,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));

      this.logger.debug('Document saved successfully', { documentId, userId });
    } catch (error) {
      this.logger.error('Failed to save document', error instanceof Error ? error : new Error(String(error)), { documentId, userId });
      throw error;
    }
  }

  /**
   * Check if user has write access to a document
   */
  async hasWriteAccess(documentId: string, userId: string): Promise<boolean> {
    const userAccess = await this.db
      .select({ accessLevel: documentAccess.accessLevel })
      .from(documentAccess)
      .where(
        and(
          eq(documentAccess.documentId, documentId),
          eq(documentAccess.userId, userId)
        )
      )
      .limit(1);

    if (userAccess.length === 0) {
      return false;
    }

    return userAccess[0].accessLevel === 'write' || userAccess[0].accessLevel === 'owner';
  }

  /**
   * Get all document IDs a user has access to
   */
  async getUserDocuments(userId: string): Promise<string[]> {
    const userDocuments = await this.db
      .select({ id: documents.id })
      .from(documents)
      .innerJoin(documentAccess, eq(documents.id, documentAccess.documentId))
      .where(eq(documentAccess.userId, userId));

    return userDocuments.map(doc => doc.id);
  }
}