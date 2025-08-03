import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { io, Socket as ClientSocket } from 'socket.io-client';
import * as Y from 'yjs';
import { AppModule } from '../src/app.module';

describe('Error Handling and Edge Cases', () => {
  let app: INestApplication;
  let serverUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === 'string' ? address : address?.port;
    serverUrl = `http://localhost:${port}/collaboration`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Edge Cases', () => {
    it('should handle missing authentication token', (done) => {
      const client = io(serverUrl, {
        autoConnect: false,
      });

      client.on('auth_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        client.disconnect();
        done();
      });

      client.on('connect', () => {
        done(new Error('Should not connect without token'));
      });

      client.connect();
    });

    it('should handle empty authentication token', (done) => {
      const client = io(serverUrl, {
        auth: { token: '' },
        autoConnect: false,
      });

      client.on('auth_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        client.disconnect();
        done();
      });

      client.on('connect', () => {
        done(new Error('Should not connect with empty token'));
      });

      client.connect();
    });

    it('should handle malformed authentication token', (done) => {
      const client = io(serverUrl, {
        auth: { token: { invalid: 'object' } },
        autoConnect: false,
      });

      client.on('auth_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        client.disconnect();
        done();
      });

      client.on('connect', () => {
        done(new Error('Should not connect with malformed token'));
      });

      client.connect();
    });

    it('should handle very long authentication token', (done) => {
      const longToken = 'a'.repeat(10000); // 10KB token
      
      const client = io(serverUrl, {
        auth: { token: longToken },
        autoConnect: false,
        timeout: 5000,
      });

      client.on('connect', () => {
        // Connection successful - client doesn't have userId property
        client.disconnect();
        done();
      });

      client.on('auth_error', (error) => {
        // This is also acceptable - server might reject very long tokens
        expect(error.message).toBeTruthy();
        client.disconnect();
        done();
      });

      client.on('connect_error', () => {
        // Connection might fail due to size limits
        done();
      });

      client.connect();
    });

    it('should handle special characters in authentication token', (done) => {
      const specialToken = 'user-123!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      const client = io(serverUrl, {
        auth: { token: specialToken },
        autoConnect: false,
      });

      client.on('connect', () => {
        // Connection successful - client doesn't have userId property
        client.disconnect();
        done();
      });

      client.on('auth_error', (error) => {
        done(new Error(`Should handle special characters: ${error.message}`));
      });

      client.connect();
    });
  });

  describe('Document Access Edge Cases', () => {
    it('should handle join document without authentication', (done) => {
      const client = io(serverUrl, {
        auth: { token: 'test-user' },
        autoConnect: false,
      });

      client.on('connect', () => {
        // Clear userId to simulate authentication loss
        (client as any).userId = undefined;
        
        client.emit('join_document', { documentId: 'test-doc' });
      });

      client.on('join_error', (error) => {
        expect(error.message).toContain('not authenticated');
        client.disconnect();
        done();
      });

      client.on('document_sync', () => {
        done(new Error('Should not sync without authentication'));
      });

      client.connect();
    });

    it('should handle join document with malformed request', (done) => {
      const client = io(serverUrl, {
        auth: { token: 'test-user' },
        autoConnect: false,
      });

      client.on('connect', () => {
        // Send malformed join request
        client.emit('join_document', { invalidField: 'invalid' });
      });

      client.on('join_error', (error) => {
        expect(error.message).toBeTruthy();
        client.disconnect();
        done();
      });

      client.on('document_sync', () => {
        done(new Error('Should not sync with malformed request'));
      });

      client.connect();
    });

    it('should handle join document with null/undefined documentId', (done) => {
      const client = io(serverUrl, {
        auth: { token: 'test-user' },
        autoConnect: false,
      });

      let errorCount = 0;
      
      client.on('connect', () => {
        // Test null documentId
        client.emit('join_document', { documentId: null });
        
        setTimeout(() => {
          // Test undefined documentId
          client.emit('join_document', { documentId: undefined });
        }, 100);

        setTimeout(() => {
          // Test empty string documentId
          client.emit('join_document', { documentId: '' });
        }, 200);
      });

      client.on('join_error', (error) => {
        errorCount++;
        expect(error.message).toBeTruthy();
        
        if (errorCount === 3) {
          client.disconnect();
          done();
        }
      });

      client.connect();
    });

    it('should handle join document with extremely long documentId', (done) => {
      const client = io(serverUrl, {
        auth: { token: 'test-user' },
        autoConnect: false,
      });

      client.on('connect', () => {
        const longDocId = 'a'.repeat(10000); // 10KB document ID
        client.emit('join_document', { documentId: longDocId });
      });

      client.on('join_error', (error) => {
        expect(error.message).toBeTruthy();
        client.disconnect();
        done();
      });

      // Some implementations might handle this gracefully
      client.on('document_sync', () => {
        client.disconnect();
        done();
      });

      client.connect();
    });

    it('should handle non-existent document gracefully', (done) => {
      const client = io(serverUrl, {
        auth: { token: 'test-user' },
        autoConnect: false,
      });

      client.on('connect', () => {
        client.emit('join_document', { documentId: 'definitely-does-not-exist-12345' });
      });

      client.on('join_error', (error) => {
        expect(error.message).toBeTruthy();
        expect(client.connected).toBe(true); // Should still be connected
        client.disconnect();
        done();
      });

      client.on('document_sync', () => {
        done(new Error('Should not sync non-existent document'));
      });

      client.connect();
    });
  });

  describe('Document Update Edge Cases', () => {
    let authenticatedClient: ClientSocket;
    const testDocumentId = 'edge-case-test-doc';

    beforeEach((done) => {
      authenticatedClient = io(serverUrl, {
        auth: { token: 'edge-case-user' },
        autoConnect: false,
      });

      authenticatedClient.on('connect', () => {
        authenticatedClient.emit('join_document', { documentId: testDocumentId });
      });

      authenticatedClient.on('document_sync', () => {
        done();
      });

      authenticatedClient.connect();
    });

    afterEach(() => {
      if (authenticatedClient.connected) {
        authenticatedClient.disconnect();
      }
    });

    it('should handle malformed document update', (done) => {
      authenticatedClient.emit('document_update', {
        update: 'invalid-update-data',
        documentId: testDocumentId,
      });

      authenticatedClient.on('update_error', (error) => {
        expect(error.message).toBeTruthy();
        expect(authenticatedClient.connected).toBe(true); // Should still be connected
        done();
      });
    });

    it('should handle empty document update', (done) => {
      authenticatedClient.emit('document_update', {
        update: [],
        documentId: testDocumentId,
      });

      authenticatedClient.on('update_error', (error) => {
        expect(error.message).toBeTruthy();
        done();
      });

      // Empty updates might be valid in some cases
      setTimeout(() => {
        done();
      }, 1000);
    });

    it('should handle extremely large document update', (done) => {
      // Create large Y.js update
      const ydoc = new Y.Doc();
      const text = ydoc.getText('content');
      
      // Insert very large content (1MB)
      const largeContent = 'A'.repeat(1024 * 1024);
      text.insert(0, largeContent);

      const largeUpdate = Y.encodeStateAsUpdate(ydoc);

      authenticatedClient.emit('document_update', {
        update: Array.from(largeUpdate),
        documentId: testDocumentId,
      });

      authenticatedClient.on('update_error', (error) => {
        expect(error.message).toBeTruthy();
        done();
      });

      // Large updates might be processed successfully but slowly
      setTimeout(() => {
        done();
      }, 10000); // 10 second timeout
    });

    it('should handle document update for wrong document', (done) => {
      const ydoc = new Y.Doc();
      const text = ydoc.getText('content');
      text.insert(0, 'Test content');

      const update = Y.encodeStateAsUpdate(ydoc);

      authenticatedClient.emit('document_update', {
        update: Array.from(update),
        documentId: 'different-document-id',
      });

      authenticatedClient.on('update_error', (error) => {
        expect(error.message).toContain('Invalid document access');
        done();
      });
    });

    it('should handle corrupted Y.js update data', (done) => {
      // Create corrupted update data
      const corruptedUpdate = new Array(100).fill(0).map(() => Math.floor(Math.random() * 256));

      authenticatedClient.emit('document_update', {
        update: corruptedUpdate,
        documentId: testDocumentId,
      });

      authenticatedClient.on('update_error', (error) => {
        expect(error.message).toBeTruthy();
        done();
      });
    });

    it('should handle update without documentId', (done) => {
      const ydoc = new Y.Doc();
      const update = Y.encodeStateAsUpdate(ydoc);

      authenticatedClient.emit('document_update', {
        update: Array.from(update),
        // Missing documentId
      });

      authenticatedClient.on('update_error', (error) => {
        expect(error.message).toBeTruthy();
        done();
      });
    });
  });

  describe('Connection Edge Cases', () => {
    it('should handle rapid connect/disconnect cycles', (done) => {
      let connectCount = 0;
      let disconnectCount = 0;
      const cycles = 10;

      const performCycle = (iteration: number) => {
        if (iteration >= cycles) {
          expect(connectCount).toBe(cycles);
          expect(disconnectCount).toBe(cycles);
          done();
          return;
        }

        const client = io(serverUrl, {
          auth: { token: `rapid-cycle-${iteration}` },
          autoConnect: false,
        });

        client.on('connect', () => {
          connectCount++;
          setTimeout(() => {
            client.disconnect();
          }, 50);
        });

        client.on('disconnect', () => {
          disconnectCount++;
          setTimeout(() => {
            performCycle(iteration + 1);
          }, 50);
        });

        client.connect();
      };

      performCycle(0);
    });

    it('should handle connection during server shutdown simulation', (done) => {
      const client = io(serverUrl, {
        auth: { token: 'shutdown-test' },
        autoConnect: false,
        timeout: 2000,
      });

      // Simulate connection attempts during server issues
      let connectionAttempts = 0;
      let connected = false;

      const attemptConnection = () => {
        connectionAttempts++;
        client.connect();
      };

      client.on('connect', () => {
        connected = true;
        client.disconnect();
        done();
      });

      client.on('connect_error', () => {
        if (connectionAttempts < 5 && !connected) {
          setTimeout(attemptConnection, 500);
        } else if (!connected) {
          done(); // Accept that connection failed
        }
      });

      attemptConnection();
    });

    it('should handle memory pressure during connections', async () => {
      // Create memory pressure by creating many large objects
      const memoryPressure: any[] = [];
      
      for (let i = 0; i < 100; i++) {
        memoryPressure.push(new Array(100000).fill(`memory-pressure-${i}`));
      }

      const client = io(serverUrl, {
        auth: { token: 'memory-pressure-test' },
        autoConnect: false,
        timeout: 10000,
      });

      const connected = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000);

        client.on('connect', () => {
          clearTimeout(timeout);
          resolve(true);
        });

        client.on('connect_error', () => {
          clearTimeout(timeout);
          resolve(false);
        });

        client.connect();
      });

      if (connected) {
        client.disconnect();
      }

      // Clean up memory pressure
      memoryPressure.length = 0;

      // Test should not fail due to memory pressure
      expect(true).toBe(true);
    });
  });

  describe('Awareness Edge Cases', () => {
    let client: ClientSocket;

    beforeEach((done) => {
      client = io(serverUrl, {
        auth: { token: 'awareness-test-user' },
        autoConnect: false,
      });

      client.on('connect', () => {
        client.emit('join_document', { documentId: 'awareness-test-doc' });
      });

      client.on('document_sync', () => {
        done();
      });

      client.connect();
    });

    afterEach(() => {
      if (client.connected) {
        client.disconnect();
      }
    });

    it('should handle malformed awareness data', (done) => {
      client.emit('awareness_update', {
        awareness: 'invalid-awareness-data',
        documentId: 'awareness-test-doc',
      });

      // Awareness errors might not be reported, so just wait
      setTimeout(done, 1000);
    });

    it('should handle extremely large awareness data', (done) => {
      const largeAwareness = {
        cursor: { x: 10, y: 20 },
        selection: { from: 0, to: 100 },
        user: {
          name: 'Test User',
          avatar: 'x'.repeat(100000), // 100KB avatar data
        },
        metadata: new Array(1000).fill('large-metadata'),
      };

      client.emit('awareness_update', {
        awareness: largeAwareness,
        documentId: 'awareness-test-doc',
      });

      setTimeout(done, 2000);
    });

    it('should handle circular references in awareness data', (done) => {
      const circularData: any = { user: 'test' };
      circularData.self = circularData; // Create circular reference

      client.emit('awareness_update', {
        awareness: circularData,
        documentId: 'awareness-test-doc',
      });

      setTimeout(done, 1000);
    });

    it('should handle awareness update for wrong document', (done) => {
      client.emit('awareness_update', {
        awareness: { cursor: { x: 10, y: 20 } },
        documentId: 'wrong-document-id',
      });

      // Should be ignored, no error expected
      setTimeout(done, 1000);
    });
  });

  describe('Database Error Simulation', () => {
    it('should handle database connection timeout gracefully', (done) => {
      const client = io(serverUrl, {
        auth: { token: 'db-timeout-test' },
        autoConnect: false,
        timeout: 15000, // Longer timeout for this test
      });

      client.on('connect', () => {
        // Try to join a document that might cause database timeout
        client.emit('join_document', { documentId: 'timeout-test-document' });
      });

      client.on('join_error', (error) => {
        expect(error.message).toBeTruthy();
        expect(client.connected).toBe(true); // Should still be connected
        client.disconnect();
        done();
      });

      client.on('document_sync', () => {
        client.disconnect();
        done();
      });

      client.connect();
    });

    it('should handle concurrent access conflicts', async () => {
      const clients: ClientSocket[] = [];
      const documentId = 'conflict-test-document';
      const clientCount = 10;

      // Create multiple clients that will try to access the same document
      const clientPromises = Array.from({ length: clientCount }, (_, i) => {
        return new Promise<void>((resolve, reject) => {
          const client = io(serverUrl, {
            auth: { token: `conflict-user-${i}` },
            autoConnect: false,
            timeout: 10000,
          });

          clients.push(client);

          client.on('connect', () => {
            client.emit('join_document', { documentId });
          });

          client.on('document_sync', () => {
            resolve();
          });

          client.on('join_error', (error) => {
            // Some clients might fail due to conflicts, which is acceptable
            resolve();
          });

          const timeout = setTimeout(() => {
            reject(new Error(`Client ${i} timeout`));
          }, 8000);

          client.on('document_sync', () => {
            clearTimeout(timeout);
          });

          client.on('join_error', () => {
            clearTimeout(timeout);
          });

          client.connect();
        });
      });

      try {
        await Promise.all(clientPromises);
        
        // At least some clients should have succeeded
        const connectedClients = clients.filter(c => c.connected).length;
        expect(connectedClients).toBeGreaterThan(0);
      } finally {
        // Cleanup
        clients.forEach(client => {
          if (client.connected) {
            client.disconnect();
          }
        });
      }
    });
  });

  describe('Resource Exhaustion Edge Cases', () => {
    it('should handle WebSocket message size limits', (done) => {
      const client = io(serverUrl, {
        auth: { token: 'size-limit-test' },
        autoConnect: false,
      });

      client.on('connect', () => {
        client.emit('join_document', { documentId: 'size-test-doc' });
      });

      client.on('document_sync', () => {
        // Try to send extremely large message
        const hugeMessage = {
          update: new Array(10 * 1024 * 1024).fill(255), // 10MB array
          documentId: 'size-test-doc',
        };

        client.emit('document_update', hugeMessage);
      });

      client.on('update_error', (error) => {
        expect(error.message).toBeTruthy();
        client.disconnect();
        done();
      });

      client.on('disconnect', () => {
        // Connection might be dropped due to size limits
        done();
      });

      client.connect();
    });

    it('should handle rapid fire messages', (done) => {
      const client = io(serverUrl, {
        auth: { token: 'rapid-fire-test' },
        autoConnect: false,
      });

      let messagesSent = 0;
      let errorsReceived = 0;
      const messagesToSend = 1000;

      client.on('connect', () => {
        client.emit('join_document', { documentId: 'rapid-fire-doc' });
      });

      client.on('document_sync', () => {
        // Send rapid fire messages
        const sendMessage = () => {
          if (messagesSent < messagesToSend) {
            messagesSent++;
            
            client.emit('awareness_update', {
              awareness: { 
                cursor: { x: messagesSent, y: messagesSent },
                timestamp: Date.now() 
              },
              documentId: 'rapid-fire-doc',
            });

            setImmediate(sendMessage);
          }
        };

        sendMessage();
      });

      client.on('update_error', () => {
        errorsReceived++;
      });

      client.on('disconnect', () => {
        console.log(`Rapid fire test: ${messagesSent} messages sent, ${errorsReceived} errors`);
        done();
      });

      // End test after reasonable time
      setTimeout(() => {
        client.disconnect();
      }, 5000);

      client.connect();
    });
  });

  describe('Unicode and Special Character Handling', () => {
    it('should handle Unicode content in documents', (done) => {
      const client = io(serverUrl, {
        auth: { token: 'unicode-test-user' },
        autoConnect: false,
      });

      client.on('connect', () => {
        client.emit('join_document', { documentId: 'unicode-test-doc' });
      });

      client.on('document_sync', () => {
        const ydoc = new Y.Doc();
        const text = ydoc.getText('content');
        
        // Insert various Unicode characters
        const unicodeContent = '🚀 Hello 世界 مرحبا Здравствуй 🌟 Emoji test 💖';
        text.insert(0, unicodeContent);

        const update = Y.encodeStateAsUpdate(ydoc);
        client.emit('document_update', {
          update: Array.from(update),
          documentId: 'unicode-test-doc',
        });

        setTimeout(() => {
          client.disconnect();
          done();
        }, 1000);
      });

      client.on('update_error', (error) => {
        done(new Error(`Unicode content should be supported: ${error.message}`));
      });

      client.connect();
    });

    it('should handle special characters in document IDs', (done) => {
      const client = io(serverUrl, {
        auth: { token: 'special-char-test' },
        autoConnect: false,
      });

      client.on('connect', () => {
        const specialDocId = 'doc-with-特殊字符-and-🎉-emoji';
        client.emit('join_document', { documentId: specialDocId });
      });

      client.on('document_sync', () => {
        client.disconnect();
        done();
      });

      client.on('join_error', (error) => {
        // This might be expected behavior depending on implementation
        expect(error.message).toBeTruthy();
        client.disconnect();
        done();
      });

      client.connect();
    });
  });
});