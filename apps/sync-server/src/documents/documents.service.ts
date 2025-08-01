/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */
import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as Y from 'yjs';
import { DATABASE_CONNECTION } from '../database/database.module';
import { documents, documentAccess } from '../database/schema';
import { and, eq } from 'drizzle-orm/sql';

export interface DocumentPersistenceService {
  loadDocument(documentId: string, userId: string): Promise<Y.Doc>;
  saveDocument(documentId: string, userId: string, ydoc: Y.Doc): Promise<void>;
  hasWriteAccess(documentId: string, userId: string): Promise<boolean>;
}

@Injectable()
export class DocumentsService implements DocumentPersistenceService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: any
  ) {}

  /**
   * Load a Y.js document from PostgreSQL
   */
  async loadDocument(documentId: string, userId: string): Promise<Y.Doc> {
    // Check if user has access to this document
    const userAccess = await this.db
      .select({
        document: {
          id: documents.id,
          encryptedContent: documents.encryptedContent,
        },
        accessLevel: documentAccess.accessLevel,
      })
      .from(documents)
      .innerJoin(documentAccess, eq(documents.id, documentAccess.documentId))
      .where(
        and(
          eq(documents.id, documentId),
          eq(documentAccess.userId, userId)
        )
      )
      .limit(1);

    if (userAccess.length === 0) {
      throw new NotFoundException('Document not found or access denied');
    }

    const ydoc = new Y.Doc();

    // Load document content if it exists
    if (userAccess[0].document.encryptedContent) {
      try {
        const binaryData = Uint8Array.from(
          atob(userAccess[0].document.encryptedContent), 
          c => c.charCodeAt(0)
        );
        Y.applyUpdate(ydoc, binaryData);
      } catch (error) {
        console.error('Failed to load document content:', error);
      }
    }

    return ydoc;
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

      console.log(`Document ${documentId} saved for user ${userId}`);
    } catch (error) {
      console.error('Failed to save document:', error);
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