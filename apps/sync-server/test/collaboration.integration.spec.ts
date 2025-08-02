import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { io, Socket as ClientSocket } from 'socket.io-client';
import * as Y from 'yjs';
import { AppModule } from '../src/app.module';

describe('Collaboration Integration Tests', () => {
  let app: INestApplication;
  let client1: ClientSocket;
  let client2: ClientSocket;
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
    await app.listen(0); // Use random port

    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === 'string' ? address : address?.port;
    serverUrl = `http://localhost:${port}/collaboration`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    client1 = io(serverUrl, {
      auth: { token: 'test-user-1' },
      autoConnect: false,
    });

    client2 = io(serverUrl, {
      auth: { token: 'test-user-2' },
      autoConnect: false,
    });
  });

  afterEach(() => {
    if (client1.connected) client1.disconnect();
    if (client2.connected) client2.disconnect();
  });

  describe('WebSocket authentication', () => {
    it('should accept connection with valid token', (done) => {
      client1.on('connect', () => {
        expect(client1.connected).toBe(true);
        done();
      });

      client1.on('auth_error', (error) => {
        done(new Error(`Unexpected auth error: ${error.message}`));
      });

      client1.connect();
    });

    it('should reject connection without token', (done) => {
      const noAuthClient = io(serverUrl, {
        autoConnect: false,
      });

      noAuthClient.on('auth_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        noAuthClient.disconnect();
        done();
      });

      noAuthClient.on('connect', () => {
        done(new Error('Should not connect without authentication'));
      });

      noAuthClient.connect();
    });

    it('should reject connection with invalid token', (done) => {
      const invalidAuthClient = io(serverUrl, {
        auth: { token: '' },
        autoConnect: false,
      });

      invalidAuthClient.on('auth_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        invalidAuthClient.disconnect();
        done();
      });

      invalidAuthClient.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });

      invalidAuthClient.connect();
    });
  });

  describe('Document collaboration', () => {
    const testDocumentId = 'test-collaboration-doc';

    it('should allow multiple users to join same document', (done) => {
      let client1Joined = false;
      let client2Joined = false;

      const checkBothJoined = () => {
        if (client1Joined && client2Joined) {
          done();
        }
      };

      client1.on('connect', () => {
        client1.emit('join_document', { documentId: testDocumentId });
      });

      client1.on('document_sync', () => {
        client1Joined = true;
        
        // Now connect second client
        client2.on('connect', () => {
          client2.emit('join_document', { documentId: testDocumentId });
        });

        client2.on('document_sync', () => {
          client2Joined = true;
          checkBothJoined();
        });

        client2.connect();
      });

      client1.on('join_error', (error) => {
        done(new Error(`Client1 join failed: ${error.message}`));
      });

      client2.on('join_error', (error) => {
        done(new Error(`Client2 join failed: ${error.message}`));
      });

      client1.connect();
    });

    it('should notify users when someone joins document', (done) => {
      client1.on('connect', () => {
        client1.emit('join_document', { documentId: testDocumentId });
      });

      client1.on('document_sync', () => {
        // Client1 is in the room, now add client2
        client1.on('user_joined', (data) => {
          expect(data.userId).toBe('test-user-2');
          expect(data.clientId).toBeTruthy();
          done();
        });

        client2.on('connect', () => {
          client2.emit('join_document', { documentId: testDocumentId });
        });

        client2.connect();
      });

      client1.connect();
    });

    it('should notify users when someone leaves document', (done) => {
      let bothConnected = false;

      client1.on('connect', () => {
        client1.emit('join_document', { documentId: testDocumentId });
      });

      client1.on('document_sync', () => {
        if (!bothConnected) {
          client2.on('connect', () => {
            client2.emit('join_document', { documentId: testDocumentId });
          });

          client2.on('document_sync', () => {
            bothConnected = true;
            // Now disconnect client2
            client2.disconnect();
          });

          client2.connect();
        }
      });

      client1.on('user_left', (data) => {
        expect(data.userId).toBe('test-user-2');
        done();
      });

      client1.connect();
    });

    it('should synchronize document updates between clients', (done) => {
      const ydoc1 = new Y.Doc();
      const ydoc2 = new Y.Doc();
      
      let client1Ready = false;
      let client2Ready = false;

      const checkReady = () => {
        if (client1Ready && client2Ready) {
          // Both clients ready, now test synchronization
          const text1 = ydoc1.getText('content');
          text1.insert(0, 'Hello from client 1');

          const update = Y.encodeStateAsUpdate(ydoc1);
          client1.emit('document_update', {
            update: Array.from(update),
            documentId: testDocumentId,
          });
        }
      };

      client1.on('connect', () => {
        client1.emit('join_document', { documentId: testDocumentId });
      });

      client1.on('document_sync', (data) => {
        const serverState = new Uint8Array(data);
        Y.applyUpdate(ydoc1, serverState);
        client1Ready = true;
        checkReady();
      });

      client2.on('connect', () => {
        client2.emit('join_document', { documentId: testDocumentId });
      });

      client2.on('document_sync', (data) => {
        const serverState = new Uint8Array(data);
        Y.applyUpdate(ydoc2, serverState);
        client2Ready = true;
        checkReady();
      });

      client2.on('document_update', (data) => {
        const update = new Uint8Array(data.update);
        Y.applyUpdate(ydoc2, update);

        const text2 = ydoc2.getText('content');
        expect(text2.toString()).toBe('Hello from client 1');
        expect(data.userId).toBe('test-user-1');
        done();
      });

      client1.connect();
      client2.connect();
    });

    it('should handle awareness updates (cursors and selections)', (done) => {
      let bothJoined = false;

      client1.on('connect', () => {
        client1.emit('join_document', { documentId: testDocumentId });
      });

      client1.on('document_sync', () => {
        if (!bothJoined) {
          client2.on('connect', () => {
            client2.emit('join_document', { documentId: testDocumentId });
          });

          client2.on('document_sync', () => {
            bothJoined = true;
            
            // Send awareness update from client1
            client1.emit('awareness_update', {
              awareness: {
                cursor: { line: 1, col: 5 },
                selection: { from: 0, to: 10 },
                user: { name: 'User 1', color: '#ff0000' },
              },
              documentId: testDocumentId,
            });
          });

          client2.connect();
        }
      });

      client2.on('awareness_update', (data) => {
        expect(data.awareness.cursor).toEqual({ line: 1, col: 5 });
        expect(data.awareness.user.name).toBe('User 1');
        expect(data.userId).toBe('test-user-1');
        done();
      });

      client1.connect();
    });

    it('should reject document access for unauthorized users', (done) => {
      const unauthorizedClient = io(serverUrl, {
        auth: { token: 'unauthorized-user' },
        autoConnect: false,
      });

      unauthorizedClient.on('connect', () => {
        unauthorizedClient.emit('join_document', { 
          documentId: 'restricted-document' 
        });
      });

      unauthorizedClient.on('join_error', (error) => {
        expect(error.message).toBeTruthy();
        unauthorizedClient.disconnect();
        done();
      });

      unauthorizedClient.on('document_sync', () => {
        done(new Error('Should not receive document sync for unauthorized access'));
      });

      unauthorizedClient.connect();
    });
  });

  describe('Real-time conflict resolution', () => {
    const testDocumentId = 'conflict-test-doc';

    it('should handle concurrent edits without data loss', (done) => {
      const ydoc1 = new Y.Doc();
      const ydoc2 = new Y.Doc();
      let bothReady = false;
      let updatesReceived = 0;

      const checkComplete = () => {
        updatesReceived++;
        if (updatesReceived >= 2) {
          // Both updates processed, verify final state
          const text1 = ydoc1.getText('content');
          const text2 = ydoc2.getText('content');
          
          // Both documents should have the same final state
          expect(text1.toString()).toBe(text2.toString());
          expect(text1.toString().includes('Client 1')).toBe(true);
          expect(text1.toString().includes('Client 2')).toBe(true);
          done();
        }
      };

      const setupClients = () => {
        if (bothReady) {
          // Apply concurrent edits
          const text1 = ydoc1.getText('content');
          const text2 = ydoc2.getText('content');
          
          text1.insert(0, 'Client 1 edit: ');
          text2.insert(0, 'Client 2 edit: ');

          // Send updates simultaneously
          const update1 = Y.encodeStateAsUpdate(ydoc1);
          const update2 = Y.encodeStateAsUpdate(ydoc2);

          client1.emit('document_update', {
            update: Array.from(update1),
            documentId: testDocumentId,
          });

          client2.emit('document_update', {
            update: Array.from(update2),
            documentId: testDocumentId,
          });
        }
      };

      client1.on('connect', () => {
        client1.emit('join_document', { documentId: testDocumentId });
      });

      client1.on('document_sync', () => {
        bothReady = true;
        setupClients();
      });

      client1.on('document_update', (data) => {
        const update = new Uint8Array(data.update);
        Y.applyUpdate(ydoc1, update);
        checkComplete();
      });

      client2.on('connect', () => {
        client2.emit('join_document', { documentId: testDocumentId });
      });

      client2.on('document_update', (data) => {
        const update = new Uint8Array(data.update);
        Y.applyUpdate(ydoc2, update);
        checkComplete();
      });

      client1.connect();
      client2.connect();
    });
  });

  describe('Performance and reliability', () => {
    it('should handle rapid sequential updates', (done) => {
      const ydoc = new Y.Doc();
      let updateCount = 0;
      const totalUpdates = 10;

      client1.on('connect', () => {
        client1.emit('join_document', { documentId: 'performance-test' });
      });

      client1.on('document_sync', () => {
        // Send rapid updates
        const text = ydoc.getText('content');
        
        for (let i = 0; i < totalUpdates; i++) {
          text.insert(text.length, `Update ${i} `);
          const update = Y.encodeStateAsUpdate(ydoc);
          
          client1.emit('document_update', {
            update: Array.from(update),
            documentId: 'performance-test',
          });
        }
      });

      client2.on('connect', () => {
        client2.emit('join_document', { documentId: 'performance-test' });
      });

      client2.on('document_update', () => {
        updateCount++;
        if (updateCount === totalUpdates) {
          done();
        }
      });

      client1.connect();
      client2.connect();
    });

    it('should maintain connection stability under load', (done) => {
      let messagesSent = 0;
      let messagesReceived = 0;
      const messageCount = 50;

      client1.on('connect', () => {
        client1.emit('join_document', { documentId: 'stability-test' });
      });

      client1.on('document_sync', () => {
        // Send awareness updates rapidly
        const sendAwareness = () => {
          if (messagesSent < messageCount) {
            client1.emit('awareness_update', {
              awareness: { 
                cursor: { x: messagesSent, y: messagesSent },
                timestamp: Date.now() 
              },
              documentId: 'stability-test',
            });
            messagesSent++;
            setTimeout(sendAwareness, 10); // 10ms interval
          }
        };
        sendAwareness();
      });

      client2.on('connect', () => {
        client2.emit('join_document', { documentId: 'stability-test' });
      });

      client2.on('awareness_update', () => {
        messagesReceived++;
        if (messagesReceived === messageCount) {
          expect(client1.connected).toBe(true);
          expect(client2.connected).toBe(true);
          done();
        }
      });

      client1.connect();
      client2.connect();
    });

    it('should handle client disconnection gracefully', (done) => {
      client1.on('connect', () => {
        client1.emit('join_document', { documentId: 'disconnect-test' });
      });

      client1.on('document_sync', () => {
        client2.on('connect', () => {
          client2.emit('join_document', { documentId: 'disconnect-test' });
        });

        client2.on('document_sync', () => {
          // Abruptly disconnect client2
          client2.disconnect();
        });

        client2.connect();
      });

      client1.on('user_left', (data) => {
        expect(data.userId).toBe('test-user-2');
        
        // Verify client1 is still connected and functional
        expect(client1.connected).toBe(true);
        
        // Test that client1 can still send updates
        client1.emit('awareness_update', {
          awareness: { test: 'after_disconnect' },
          documentId: 'disconnect-test',
        });
        
        // If no errors occur, test passes
        setTimeout(done, 100);
      });

      client1.connect();
    });
  });

  describe('Error handling', () => {
    it('should handle malformed document updates', (done) => {
      client1.on('connect', () => {
        client1.emit('join_document', { documentId: 'error-test' });
      });

      client1.on('document_sync', () => {
        // Send malformed update
        client1.emit('document_update', {
          update: 'invalid-update-data',
          documentId: 'error-test',
        });
      });

      client1.on('update_error', (error) => {
        expect(error.message).toBeTruthy();
        expect(client1.connected).toBe(true); // Should still be connected
        done();
      });

      client1.connect();
    });

    it('should handle attempts to access non-existent documents', (done) => {
      client1.on('connect', () => {
        client1.emit('join_document', { documentId: 'non-existent-doc' });
      });

      client1.on('join_error', (error) => {
        expect(error.message).toBeTruthy();
        expect(client1.connected).toBe(true); // Should still be connected
        done();
      });

      client1.on('document_sync', () => {
        done(new Error('Should not sync non-existent document'));
      });

      client1.connect();
    });
  });
});