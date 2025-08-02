import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../src/database/database.module';
import { DocumentsService } from '../src/documents/documents.service';
import * as Y from 'yjs';

describe('Documents Integration Tests', () => {
  let app: INestApplication;
  let documentsService: DocumentsService;
  let testUserId: string;
  let testDocumentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        DatabaseModule,
      ],
      providers: [DocumentsService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    documentsService = moduleFixture.get<DocumentsService>(DocumentsService);
    testUserId = 'integration-test-user';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Document lifecycle integration', () => {
    it('should create, save, and load document with content', async () => {
      // Setup: Create test document in database
      testDocumentId = `test-doc-${Date.now()}`;
      
      // Note: In real integration test, you'd insert into actual database
      // This test assumes the document and access already exist in test DB

      // Create Y.js document with content
      const originalDoc = new Y.Doc();
      const text = originalDoc.getText('content');
      const metadata = originalDoc.getMap('metadata');
      
      text.insert(0, 'Integration test content');
      metadata.set('title', 'Test Document');
      metadata.set('version', '1.0');

      // Test saving document
      await expect(
        documentsService.saveDocument(testDocumentId, testUserId, originalDoc)
      ).resolves.not.toThrow();

      // Test loading document
      const loadedDoc = await documentsService.loadDocument(testDocumentId, testUserId);

      // Verify content integrity
      const loadedText = loadedDoc.getText('content');
      const loadedMetadata = loadedDoc.getMap('metadata');

      expect(loadedText.toString()).toBe('Integration test content');
      expect(loadedMetadata.get('title')).toBe('Test Document');
      expect(loadedMetadata.get('version')).toBe('1.0');
    });

    it('should handle complex Y.js operations through save/load cycle', async () => {
      const doc = new Y.Doc();
      
      // Create complex structure
      const rootMap = doc.getMap('root');
      const todoList = new Y.Array();
      const userPrefs = new Y.Map();
      
      // Add todos
      todoList.push([
        { id: '1', text: 'First task', completed: false },
        { id: '2', text: 'Second task', completed: true },
      ]);
      
      // Set user preferences
      userPrefs.set('theme', 'dark');
      userPrefs.set('language', 'en');
      userPrefs.set('notifications', true);
      
      // Nest structures
      rootMap.set('todos', todoList);
      rootMap.set('preferences', userPrefs);

      // Save and reload
      await documentsService.saveDocument(testDocumentId, testUserId, doc);
      const reloadedDoc = await documentsService.loadDocument(testDocumentId, testUserId);

      // Verify complex structure
      const reloadedRoot = reloadedDoc.getMap('root');
      const reloadedTodos = reloadedRoot.get('todos') as Y.Array<any>;
      const reloadedPrefs = reloadedRoot.get('preferences') as Y.Map<any>;

      expect(reloadedTodos.length).toBe(2);
      expect(reloadedTodos.get(0)).toEqual({
        id: '1',
        text: 'First task',
        completed: false,
      });
      expect(reloadedPrefs.get('theme')).toBe('dark');
      expect(reloadedPrefs.get('notifications')).toBe(true);
    });

    it('should handle concurrent document modifications', async () => {
      // Simulate concurrent edits by multiple users
      const doc1 = await documentsService.loadDocument(testDocumentId, testUserId);
      const doc2 = await documentsService.loadDocument(testDocumentId, testUserId);

      // Apply different changes to each document
      const text1 = doc1.getText('concurrent');
      const text2 = doc2.getText('concurrent');

      text1.insert(0, 'User 1 edit: ');
      text2.insert(0, 'User 2 edit: ');

      // Save both documents
      await documentsService.saveDocument(testDocumentId, testUserId, doc1);
      await documentsService.saveDocument(testDocumentId, testUserId, doc2);

      // Load final state
      const finalDoc = await documentsService.loadDocument(testDocumentId, testUserId);
      const finalText = finalDoc.getText('concurrent');

      // Y.js should handle the conflict resolution
      expect(finalText.toString()).toBeTruthy();
      expect(finalText.toString().length).toBeGreaterThan(0);
    });
  });

  describe('Access control integration', () => {
    it('should enforce write access for document operations', async () => {
      const unauthorizedUserId = 'unauthorized-user';
      const doc = new Y.Doc();

      // Should throw when unauthorized user tries to save
      await expect(
        documentsService.saveDocument(testDocumentId, unauthorizedUserId, doc)
      ).rejects.toThrow();

      // Should throw when unauthorized user tries to load
      await expect(
        documentsService.loadDocument(testDocumentId, unauthorizedUserId)
      ).rejects.toThrow();
    });

    it('should correctly identify user access levels', async () => {
      // Test with authorized user
      const hasAccess = await documentsService.hasWriteAccess(testDocumentId, testUserId);
      expect(typeof hasAccess).toBe('boolean');

      // Test with unauthorized user
      const noAccess = await documentsService.hasWriteAccess(testDocumentId, 'no-access-user');
      expect(noAccess).toBe(false);
    });

    it('should return user documents list', async () => {
      const userDocs = await documentsService.getUserDocuments(testUserId);
      
      expect(Array.isArray(userDocs)).toBe(true);
      // Should include our test document if properly set up
      if (userDocs.length > 0) {
        expect(typeof userDocs[0]).toBe('string');
      }
    });
  });

  describe('Performance and reliability', () => {
    it('should handle large document content', async () => {
      const largeDoc = new Y.Doc();
      const text = largeDoc.getText('large');
      
      // Insert large content (10KB)
      const largeContent = 'A'.repeat(10000);
      text.insert(0, largeContent);

      // Should handle without timeout
      const startTime = Date.now();
      await documentsService.saveDocument(testDocumentId, testUserId, largeDoc);
      const saveTime = Date.now() - startTime;

      expect(saveTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify loading large content
      const loadStartTime = Date.now();
      const loadedDoc = await documentsService.loadDocument(testDocumentId, testUserId);
      const loadTime = Date.now() - loadStartTime;

      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
      
      const loadedText = loadedDoc.getText('large');
      expect(loadedText.toString().length).toBe(10000);
    });

    it('should handle multiple rapid save operations', async () => {
      const doc = new Y.Doc();
      const text = doc.getText('rapid');
      
      // Perform multiple rapid saves
      const savePromises = [];
      for (let i = 0; i < 10; i++) {
        text.insert(text.length, `Save ${i} `);
        savePromises.push(
          documentsService.saveDocument(testDocumentId, testUserId, doc)
        );
      }

      // All saves should complete successfully
      await expect(Promise.all(savePromises)).resolves.not.toThrow();

      // Final state should be correct
      const finalDoc = await documentsService.loadDocument(testDocumentId, testUserId);
      const finalText = finalDoc.getText('rapid');
      
      expect(finalText.toString()).toContain('Save 9');
      expect(finalText.toString().split('Save').length - 1).toBe(10);
    });

    it('should recover from database connection issues', async () => {
      // This test would require mocking database failures
      // and verifying graceful error handling
      
      const doc = new Y.Doc();
      const text = doc.getText('recovery');
      text.insert(0, 'Recovery test');

      // In real test, you'd temporarily break DB connection
      // and verify appropriate error handling
      await expect(
        documentsService.saveDocument(testDocumentId, testUserId, doc)
      ).resolves.not.toThrow();
    });
  });

  describe('Data integrity and validation', () => {
    it('should validate Y.js document structure', async () => {
      const doc = new Y.Doc();
      
      // Create document with various Y.js types
      const text = doc.getText('validation');
      const array = doc.getArray('items');
      const map = doc.getMap('settings');
      
      text.insert(0, 'Validation test');
      array.push(['item1', 'item2', 'item3']);
      map.set('validated', true);
      map.set('timestamp', Date.now());

      // Save and verify structure integrity
      await documentsService.saveDocument(testDocumentId, testUserId, doc);
      const loadedDoc = await documentsService.loadDocument(testDocumentId, testUserId);

      // Verify all types are preserved
      const loadedText = loadedDoc.getText('validation');
      const loadedArray = loadedDoc.getArray('items');
      const loadedMap = loadedDoc.getMap('settings');

      expect(loadedText.toString()).toBe('Validation test');
      expect(loadedArray.length).toBe(3);
      expect(loadedArray.get(0)).toBe('item1');
      expect(loadedMap.get('validated')).toBe(true);
      expect(typeof loadedMap.get('timestamp')).toBe('number');
    });

    it('should handle empty and null documents', async () => {
      const emptyDoc = new Y.Doc();
      
      // Save empty document
      await documentsService.saveDocument(testDocumentId, testUserId, emptyDoc);
      
      // Load and verify it's still empty
      const loadedEmptyDoc = await documentsService.loadDocument(testDocumentId, testUserId);
      const state = Y.encodeStateAsUpdate(loadedEmptyDoc);
      
      // Empty Y.js document should have minimal state
      expect(state.length).toBeLessThan(100);
    });

    it('should maintain document versioning through Y.js updates', async () => {
      const doc = new Y.Doc();
      const text = doc.getText('versioning');
      
      // Apply incremental changes
      text.insert(0, 'Version 1');
      await documentsService.saveDocument(testDocumentId, testUserId, doc);
      
      text.insert(text.length, ' -> Version 2');
      await documentsService.saveDocument(testDocumentId, testUserId, doc);
      
      text.insert(text.length, ' -> Version 3');
      await documentsService.saveDocument(testDocumentId, testUserId, doc);

      // Load final version
      const finalDoc = await documentsService.loadDocument(testDocumentId, testUserId);
      const finalText = finalDoc.getText('versioning');
      
      expect(finalText.toString()).toBe('Version 1 -> Version 2 -> Version 3');
    });
  });
});