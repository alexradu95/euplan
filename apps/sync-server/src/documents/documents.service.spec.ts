import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as Y from 'yjs';
import { DocumentsService } from './documents.service';
import { DATABASE_CONNECTION } from '../database/database.module';

type MockDatabase = {
  select: jest.Mock;
  update: jest.Mock;
  insert: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  limit: jest.Mock;
  innerJoin: jest.Mock;
  set: jest.Mock;
  returning: jest.Mock;
  values: jest.Mock;
};

const createMockDatabase = (): MockDatabase => {
  const mockDb = {
    select: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    innerJoin: jest.fn(),
    set: jest.fn(),
    returning: jest.fn(),
    values: jest.fn(),
  };

  // Chain methods properly
  Object.keys(mockDb).forEach(key => {
    mockDb[key].mockReturnValue(mockDb);
  });

  return mockDb;
};

const getMockDocument = (overrides?: {
  id?: string;
  encryptedContent?: string | null;
}) => ({
  id: 'doc123',
  encryptedContent: null,
  ...overrides,
});

const getMockDocumentAccess = (overrides?: {
  accessLevel?: 'read' | 'write' | 'owner';
  userId?: string;
  documentId?: string;
}) => ({
  accessLevel: 'write' as const,
  userId: 'user123',
  documentId: 'doc123',
  ...overrides,
});

describe('DocumentsService', () => {
  let service: DocumentsService;
  let mockDb: MockDatabase;

  beforeEach(async () => {
    mockDb = createMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  describe('loadDocument', () => {
    it('should load document when user has access', async () => {
      const documentData = getMockDocument({
        id: 'doc123',
        encryptedContent: btoa('test content'),
      });
      const accessData = getMockDocumentAccess();

      // Mock document query
      mockDb.limit.mockResolvedValueOnce([documentData]);
      // Mock access query  
      mockDb.limit.mockResolvedValueOnce([accessData]);

      const result = await service.loadDocument('doc123', 'user123');

      expect(result).toBeInstanceOf(Y.Doc);
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when document does not exist', async () => {
      mockDb.limit.mockResolvedValueOnce([]); // No document found

      await expect(service.loadDocument('nonexistent', 'user123'))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user has no access', async () => {
      const documentData = getMockDocument();
      
      mockDb.limit.mockResolvedValueOnce([documentData]); // Document exists
      mockDb.limit.mockResolvedValueOnce([]); // No access

      await expect(service.loadDocument('doc123', 'unauthorized-user'))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should create empty document when no content exists', async () => {
      const documentData = getMockDocument({ encryptedContent: null });
      const accessData = getMockDocumentAccess();

      mockDb.limit.mockResolvedValueOnce([documentData]);
      mockDb.limit.mockResolvedValueOnce([accessData]);

      const result = await service.loadDocument('doc123', 'user123');

      expect(result).toBeInstanceOf(Y.Doc);
      // Empty Y.js document should have minimal state representation
      const update = Y.encodeStateAsUpdate(result);
      expect(update).toEqual(new Uint8Array([0, 0]));
    });

    it('should handle corrupted document content gracefully', async () => {
      const documentData = getMockDocument({ 
        encryptedContent: 'invalid-base64-content' 
      });
      const accessData = getMockDocumentAccess();

      mockDb.limit.mockResolvedValueOnce([documentData]);
      mockDb.limit.mockResolvedValueOnce([accessData]);

      // Should not throw, but log error and return empty document
      const result = await service.loadDocument('doc123', 'user123');

      expect(result).toBeInstanceOf(Y.Doc);
    });
  });

  describe('saveDocument', () => {
    it('should save document when user has write access', async () => {
      const accessData = getMockDocumentAccess({ accessLevel: 'write' });
      mockDb.limit.mockResolvedValueOnce([accessData]);

      const ydoc = new Y.Doc();
      const text = ydoc.getText('content');
      text.insert(0, 'Hello World');

      await service.saveDocument('doc123', 'user123', ydoc);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({
        encryptedContent: expect.any(String),
        updatedAt: expect.any(Date),
      });
    });

    it('should save document when user is owner', async () => {
      const accessData = getMockDocumentAccess({ accessLevel: 'owner' });
      mockDb.limit.mockResolvedValueOnce([accessData]);

      const ydoc = new Y.Doc();
      await service.saveDocument('doc123', 'user123', ydoc);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user has only read access', async () => {
      const accessData = getMockDocumentAccess({ accessLevel: 'read' });
      mockDb.limit.mockResolvedValueOnce([accessData]);

      const ydoc = new Y.Doc();

      await expect(service.saveDocument('doc123', 'user123', ydoc))
        .rejects
        .toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user has no access', async () => {
      mockDb.limit.mockResolvedValueOnce([]); // No access

      const ydoc = new Y.Doc();

      await expect(service.saveDocument('doc123', 'user123', ydoc))
        .rejects
        .toThrow(ForbiddenException);
    });

    it('should encode Y.js document content correctly', async () => {
      const accessData = getMockDocumentAccess({ accessLevel: 'write' });
      mockDb.limit.mockResolvedValueOnce([accessData]);

      const ydoc = new Y.Doc();
      const text = ydoc.getText('content');
      text.insert(0, 'Test content');

      await service.saveDocument('doc123', 'user123', ydoc);

      const capturedCall = mockDb.set.mock.calls[0][0];
      expect(capturedCall.encryptedContent).toBeTruthy();
      
      // Verify we can decode the content back
      const decodedContent = atob(capturedCall.encryptedContent);
      expect(decodedContent).toBeTruthy();
    });
  });

  describe('hasWriteAccess', () => {
    it('should return true for write access', async () => {
      const accessData = getMockDocumentAccess({ accessLevel: 'write' });
      mockDb.limit.mockResolvedValueOnce([accessData]);

      const result = await service.hasWriteAccess('doc123', 'user123');

      expect(result).toBe(true);
    });

    it('should return true for owner access', async () => {
      const accessData = getMockDocumentAccess({ accessLevel: 'owner' });
      mockDb.limit.mockResolvedValueOnce([accessData]);

      const result = await service.hasWriteAccess('doc123', 'user123');

      expect(result).toBe(true);
    });

    it('should return false for read access', async () => {
      const accessData = getMockDocumentAccess({ accessLevel: 'read' });
      mockDb.limit.mockResolvedValueOnce([accessData]);

      const result = await service.hasWriteAccess('doc123', 'user123');

      expect(result).toBe(false);
    });

    it('should return false when user has no access', async () => {
      mockDb.limit.mockResolvedValueOnce([]); // No access

      const result = await service.hasWriteAccess('doc123', 'user123');

      expect(result).toBe(false);
    });
  });

  describe('getUserDocuments', () => {
    it('should return list of document IDs user has access to', async () => {
      const mockDocuments = [
        { id: 'doc1' },
        { id: 'doc2' },
        { id: 'doc3' },
      ];
      
      mockDb.where.mockResolvedValueOnce(mockDocuments);

      const result = await service.getUserDocuments('user123');

      expect(result).toEqual(['doc1', 'doc2', 'doc3']);
      expect(mockDb.innerJoin).toHaveBeenCalled();
    });

    it('should return empty array when user has no documents', async () => {
      mockDb.where.mockResolvedValueOnce([]);

      const result = await service.getUserDocuments('user123');

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.where.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.getUserDocuments('user123'))
        .rejects
        .toThrow('Database error');
    });
  });

  describe('Y.js document handling', () => {
    it('should preserve document structure through save and load cycle', async () => {
      // Mock successful access checks
      const accessData = getMockDocumentAccess({ accessLevel: 'write' });
      mockDb.limit.mockResolvedValue([accessData]);

      // Create a complex Y.js document
      const originalDoc = new Y.Doc();
      const text = originalDoc.getText('content');
      const map = originalDoc.getMap('metadata');
      
      text.insert(0, 'Hello World');
      map.set('title', 'Test Document');
      map.set('author', 'Test User');

      // Capture the encoded content during save
      let savedContent: string;
      mockDb.set.mockImplementation((data) => {
        savedContent = data.encryptedContent;
        return mockDb;
      });

      await service.saveDocument('doc123', 'user123', originalDoc);

      // Mock the document query to return our saved content
      const documentData = getMockDocument({
        encryptedContent: savedContent,
      });
      mockDb.limit.mockResolvedValueOnce([documentData]);
      mockDb.limit.mockResolvedValueOnce([accessData]);

      // Load the document back
      const loadedDoc = await service.loadDocument('doc123', 'user123');

      // Verify content is preserved
      const loadedText = loadedDoc.getText('content');
      const loadedMap = loadedDoc.getMap('metadata');

      expect(loadedText.toString()).toBe('Hello World');
      expect(loadedMap.get('title')).toBe('Test Document');
      expect(loadedMap.get('author')).toBe('Test User');
    });
  });
});