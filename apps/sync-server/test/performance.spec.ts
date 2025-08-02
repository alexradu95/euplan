import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { io, Socket as ClientSocket } from 'socket.io-client';
import * as Y from 'yjs';
import { AppModule } from '../src/app.module';

describe('Performance and Load Tests', () => {
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

  describe('WebSocket Connection Performance', () => {
    it('should handle multiple concurrent connections', async () => {
      const connectionCount = 50;
      const clients: ClientSocket[] = [];
      const connectionPromises: Promise<void>[] = [];

      const startTime = Date.now();

      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const client = io(serverUrl, {
          auth: { token: `load-test-user-${i}` },
          autoConnect: false,
        });

        clients.push(client);

        const connectionPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Connection ${i} timeout`));
          }, 10000);

          client.on('connect', () => {
            clearTimeout(timeout);
            resolve();
          });

          client.on('connect_error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        connectionPromises.push(connectionPromise);
        client.connect();
      }

      // Wait for all connections
      await Promise.all(connectionPromises);
      const connectionTime = Date.now() - startTime;

      // All clients should be connected
      expect(clients.every(client => client.connected)).toBe(true);
      
      // Should connect within reasonable time (2 seconds per connection on average)
      expect(connectionTime).toBeLessThan(connectionCount * 40); // 40ms per connection max
      
      console.log(`Connected ${connectionCount} clients in ${connectionTime}ms`);
      console.log(`Average connection time: ${connectionTime / connectionCount}ms`);

      // Cleanup
      clients.forEach(client => client.disconnect());
    });

    it('should maintain connection stability under load', async () => {
      const clientCount = 20;
      const clients: ClientSocket[] = [];
      const testDuration = 10000; // 10 seconds
      let disconnectionCount = 0;

      // Create clients
      for (let i = 0; i < clientCount; i++) {
        const client = io(serverUrl, {
          auth: { token: `stability-test-user-${i}` },
          autoConnect: false,
        });

        client.on('disconnect', () => {
          disconnectionCount++;
        });

        clients.push(client);
      }

      // Connect all clients
      const connectionPromises = clients.map(client => {
        return new Promise<void>((resolve) => {
          client.on('connect', resolve);
          client.connect();
        });
      });

      await Promise.all(connectionPromises);

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration));

      // Check connection stability
      const connectedClients = clients.filter(client => client.connected).length;
      
      expect(connectedClients).toBeGreaterThan(clientCount * 0.9); // 90% should still be connected
      expect(disconnectionCount).toBeLessThan(clientCount * 0.1); // Less than 10% disconnections

      console.log(`After ${testDuration}ms: ${connectedClients}/${clientCount} clients still connected`);
      console.log(`Disconnections: ${disconnectionCount}`);

      // Cleanup
      clients.forEach(client => client.disconnect());
    });
  });

  describe('Document Collaboration Performance', () => {
    it('should handle multiple users joining same document efficiently', async () => {
      const userCount = 30;
      const documentId = 'performance-test-document';
      const clients: ClientSocket[] = [];
      const joinTimes: number[] = [];

      // Create and connect clients
      for (let i = 0; i < userCount; i++) {
        const client = io(serverUrl, {
          auth: { token: `perf-user-${i}` },
          autoConnect: false,
        });

        clients.push(client);

        await new Promise<void>((resolve) => {
          client.on('connect', resolve);
          client.connect();
        });
      }

      // Measure document join performance
      const joinPromises = clients.map((client, index) => {
        return new Promise<void>((resolve) => {
          const startTime = Date.now();
          
          client.on('document_sync', () => {
            const joinTime = Date.now() - startTime;
            joinTimes.push(joinTime);
            resolve();
          });

          client.emit('join_document', { documentId });
        });
      });

      await Promise.all(joinPromises);

      // Analyze performance
      const avgJoinTime = joinTimes.reduce((sum, time) => sum + time, 0) / joinTimes.length;
      const maxJoinTime = Math.max(...joinTimes);
      const minJoinTime = Math.min(...joinTimes);

      console.log(`Document join performance for ${userCount} users:`);
      console.log(`Average: ${avgJoinTime}ms`);
      console.log(`Min: ${minJoinTime}ms, Max: ${maxJoinTime}ms`);

      // Performance expectations
      expect(avgJoinTime).toBeLessThan(1000); // Average under 1 second
      expect(maxJoinTime).toBeLessThan(3000); // No join should take more than 3 seconds

      // Cleanup
      clients.forEach(client => client.disconnect());
    });

    it('should handle high-frequency document updates', async () => {
      const clientCount = 10;
      const updatesPerClient = 50;
      const clients: ClientSocket[] = [];
      const receivedUpdates: number[] = new Array(clientCount).fill(0);

      // Setup clients
      for (let i = 0; i < clientCount; i++) {
        const client = io(serverUrl, {
          auth: { token: `update-test-user-${i}` },
          autoConnect: false,
        });

        client.on('document_update', () => {
          receivedUpdates[i]++;
        });

        clients.push(client);
      }

      // Connect all clients
      const connectionPromises = clients.map(client => {
        return new Promise<void>((resolve) => {
          client.on('connect', resolve);
          client.connect();
        });
      });

      await Promise.all(connectionPromises);

      // Join document
      const documentId = 'high-frequency-test';
      const joinPromises = clients.map(client => {
        return new Promise<void>((resolve) => {
          client.on('document_sync', resolve);
          client.emit('join_document', { documentId });
        });
      });

      await Promise.all(joinPromises);

      // Send rapid updates
      const startTime = Date.now();
      const updatePromises: Promise<void>[] = [];

      clients.forEach((client, clientIndex) => {
        for (let updateIndex = 0; updateIndex < updatesPerClient; updateIndex++) {
          const promise = new Promise<void>((resolve) => {
            setTimeout(() => {
              const ydoc = new Y.Doc();
              const text = ydoc.getText('content');
              text.insert(0, `Client${clientIndex}-Update${updateIndex} `);
              
              const update = Y.encodeStateAsUpdate(ydoc);
              client.emit('document_update', {
                update: Array.from(update),
                documentId,
              });
              resolve();
            }, updateIndex * 10); // Stagger updates by 10ms
          });
          updatePromises.push(promise);
        }
      });

      await Promise.all(updatePromises);

      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 2000));

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const totalUpdatesSent = clientCount * updatesPerClient;
      const totalUpdatesReceived = receivedUpdates.reduce((sum, count) => sum + count, 0);

      console.log(`High-frequency update test results:`);
      console.log(`Total updates sent: ${totalUpdatesSent}`);
      console.log(`Total updates received: ${totalUpdatesReceived}`);
      console.log(`Time taken: ${totalTime}ms`);
      console.log(`Updates per second: ${(totalUpdatesSent / totalTime * 1000).toFixed(2)}`);

      // Each client should receive updates from other clients
      const expectedUpdatesPerClient = (clientCount - 1) * updatesPerClient;
      receivedUpdates.forEach((count, index) => {
        expect(count).toBeGreaterThan(expectedUpdatesPerClient * 0.8); // Allow 20% loss
      });

      // Cleanup
      clients.forEach(client => client.disconnect());
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory with repeated connections', async () => {
      const iterations = 100;
      const initialMemory = process.memoryUsage();

      for (let i = 0; i < iterations; i++) {
        const client = io(serverUrl, {
          auth: { token: `memory-test-${i}` },
          autoConnect: false,
        });

        await new Promise<void>((resolve) => {
          client.on('connect', () => {
            client.emit('join_document', { documentId: 'memory-test' });
            client.on('document_sync', () => {
              client.disconnect();
              resolve();
            });
          });
          client.connect();
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerConnection = memoryIncrease / iterations;

      console.log(`Memory usage after ${iterations} connections:`);
      console.log(`Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Per connection: ${(memoryIncreasePerConnection / 1024).toFixed(2)}KB`);

      // Memory increase should be reasonable (less than 50KB per connection)
      expect(memoryIncreasePerConnection).toBeLessThan(50 * 1024);
    });

    it('should handle large document content efficiently', async () => {
      const client = io(serverUrl, {
        auth: { token: 'large-doc-test' },
        autoConnect: false,
      });

      await new Promise<void>((resolve) => {
        client.on('connect', resolve);
        client.connect();
      });

      await new Promise<void>((resolve) => {
        client.on('document_sync', resolve);
        client.emit('join_document', { documentId: 'large-document-test' });
      });

      // Create large document content
      const ydoc = new Y.Doc();
      const text = ydoc.getText('content');
      
      const largeContent = 'A'.repeat(100000); // 100KB of content
      text.insert(0, largeContent);

      const startTime = Date.now();
      
      // Send large update
      const update = Y.encodeStateAsUpdate(ydoc);
      client.emit('document_update', {
        update: Array.from(update),
        documentId: 'large-document-test',
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log(`Large document (${largeContent.length} chars) processing time: ${processingTime}ms`);

      // Should process within reasonable time
      expect(processingTime).toBeLessThan(5000); // 5 seconds max

      client.disconnect();
    });
  });

  describe('Database Performance', () => {
    it('should handle concurrent document saves efficiently', async () => {
      const concurrentSaves = 20;
      const savePromises: Promise<void>[] = [];

      for (let i = 0; i < concurrentSaves; i++) {
        const promise = new Promise<void>((resolve, reject) => {
          const client = io(serverUrl, {
            auth: { token: `concurrent-save-${i}` },
            autoConnect: false,
          });

          client.on('connect', () => {
            client.emit('join_document', { documentId: `concurrent-doc-${i}` });
          });

          client.on('document_sync', () => {
            const ydoc = new Y.Doc();
            const text = ydoc.getText('content');
            text.insert(0, `Concurrent save test ${i} - ${Date.now()}`);

            const update = Y.encodeStateAsUpdate(ydoc);
            client.emit('document_update', {
              update: Array.from(update),
              documentId: `concurrent-doc-${i}`,
            });

            // Wait a bit then disconnect (triggering save)
            setTimeout(() => {
              client.disconnect();
              resolve();
            }, 500);
          });

          client.on('update_error', (error) => {
            reject(new Error(`Save failed: ${error.message}`));
          });

          const timeout = setTimeout(() => {
            reject(new Error(`Timeout for save ${i}`));
          }, 10000);

          client.on('disconnect', () => {
            clearTimeout(timeout);
          });

          client.connect();
        });

        savePromises.push(promise);
      }

      const startTime = Date.now();
      await Promise.all(savePromises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      console.log(`${concurrentSaves} concurrent saves completed in ${totalTime}ms`);
      console.log(`Average time per save: ${totalTime / concurrentSaves}ms`);

      // Should complete all saves within reasonable time
      expect(totalTime).toBeLessThan(concurrentSaves * 1000); // 1 second per save max
    });

    it('should maintain performance with document history', async () => {
      const client = io(serverUrl, {
        auth: { token: 'history-performance-test' },
        autoConnect: false,
      });

      await new Promise<void>((resolve) => {
        client.on('connect', resolve);
        client.connect();
      });

      const documentId = 'history-performance-doc';
      
      await new Promise<void>((resolve) => {
        client.on('document_sync', resolve);
        client.emit('join_document', { documentId });
      });

      // Simulate document evolution with many updates
      const updateCount = 100;
      const updateTimes: number[] = [];

      for (let i = 0; i < updateCount; i++) {
        const startTime = Date.now();
        
        const ydoc = new Y.Doc();
        const text = ydoc.getText('content');
        text.insert(0, `Update ${i}: ${new Date().toISOString()} `);

        const update = Y.encodeStateAsUpdate(ydoc);
        client.emit('document_update', {
          update: Array.from(update),
          documentId,
        });

        // Small delay between updates
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const endTime = Date.now();
        updateTimes.push(endTime - startTime);
      }

      const avgUpdateTime = updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;
      const maxUpdateTime = Math.max(...updateTimes);

      console.log(`Document history performance (${updateCount} updates):`);
      console.log(`Average update time: ${avgUpdateTime}ms`);
      console.log(`Max update time: ${maxUpdateTime}ms`);

      // Performance should not degrade significantly
      expect(avgUpdateTime).toBeLessThan(100); // Average under 100ms
      expect(maxUpdateTime).toBeLessThan(500); // No update over 500ms

      client.disconnect();
    });
  });

  describe('Stress Testing', () => {
    it('should handle burst traffic without failures', async () => {
      const burstSize = 100;
      const clients: ClientSocket[] = [];
      const errors: string[] = [];
      const successes: number[] = [];

      // Create burst of connections
      const connectionPromises = Array.from({ length: burstSize }, (_, i) => {
        return new Promise<void>((resolve, reject) => {
          const client = io(serverUrl, {
            auth: { token: `burst-test-${i}` },
            autoConnect: false,
            timeout: 5000,
          });

          const startTime = Date.now();

          client.on('connect', () => {
            const connectionTime = Date.now() - startTime;
            successes.push(connectionTime);
            resolve();
          });

          client.on('connect_error', (error) => {
            errors.push(`Client ${i}: ${error.message}`);
            reject(error);
          });

          clients.push(client);
          client.connect();
        });
      });

      const startTime = Date.now();
      
      // Use allSettled to capture both successes and failures
      const results = await Promise.allSettled(connectionPromises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      console.log(`Burst test results (${burstSize} simultaneous connections):`);
      console.log(`Successful connections: ${successCount}`);
      console.log(`Failed connections: ${failureCount}`);
      console.log(`Total time: ${totalTime}ms`);
      console.log(`Success rate: ${(successCount / burstSize * 100).toFixed(2)}%`);

      if (successes.length > 0) {
        const avgConnectionTime = successes.reduce((sum, time) => sum + time, 0) / successes.length;
        console.log(`Average connection time: ${avgConnectionTime}ms`);
      }

      // At least 80% should succeed under burst load
      expect(successCount / burstSize).toBeGreaterThan(0.8);

      // Cleanup successful connections
      clients.forEach(client => {
        if (client.connected) {
          client.disconnect();
        }
      });
    });
  });
});