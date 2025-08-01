'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import { useSession } from 'next-auth/react'
import { io, Socket } from 'socket.io-client'
import type { Database } from 'sql.js'

const wasmUrl = "https://sql.js.org/dist/sql-wasm.wasm";

// Define the shape of the data and functions our context will provide
interface YjsContextType {
  doc: Y.Doc | null;
  currentDocumentId: string | null;
  switchDocument: (documentId: string) => Promise<void>;
  createDocument: (title?: string) => Promise<string | null>;
  isLoading: boolean;
  isConnected: boolean;
  connectedUsers: Set<string>;
}

// Create the React Context with a default value
const YjsContext = createContext<YjsContextType>({ 
  doc: null,
  currentDocumentId: null,
  switchDocument: async () => {},
  createDocument: async () => null,
  isLoading: false,
  isConnected: false,
  connectedUsers: new Set(),
});

// Create a custom hook to make it easy to access the context in other components
export const useYjs = () => useContext(YjsContext);

// Create the Provider component itself
export const YjsProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session, status } = useSession();
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [db, setDb] = useState<Database | null>(null);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<Set<string>>(new Set());
  
  // WebSocket connection ref
  const socketRef = useRef<Socket | null>(null);

  // Function to create a new document
  const createDocument = useCallback(async (title = "Untitled Document") => {
    if (!session?.user?.id) return null;
    
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      
      if (response.ok) {
        const { documentId } = await response.json();
        return documentId;
      }
      return null;
    } catch (error) {
      console.error('Failed to create document:', error);
      return null;
    }
  }, [session?.user?.id]);

  // Function to connect to WebSocket server
  const connectToSyncServer = useCallback(() => {
    console.log('Attempting to connect to sync server...', { 
      hasSession: !!session, 
      hasAccessToken: !!session?.accessToken,
      accessToken: session?.accessToken,
      userId: session?.user?.id,
      isConnected: socketRef.current?.connected 
    });

    if (!session?.user?.id || socketRef.current?.connected) {
      console.log('Connection skipped: missing user ID or already connected');
      return;
    }

    try {
      // Connect to sync server with authentication
      const syncServerUrl = process.env.NODE_ENV === 'production' 
        ? 'wss://your-sync-server.com'  // Replace with your production URL
        : 'ws://localhost:3001';

      console.log('Connecting to:', `${syncServerUrl}`);

      const socket = io(`${syncServerUrl}`, {
        auth: {
          token: session.user.id // Use user ID directly as token
        },
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        console.log('Connected to sync server');
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from sync server');
        setIsConnected(false);
        setConnectedUsers(new Set());
      });

      socket.on('auth_error', (error) => {
        console.error('Sync server authentication failed:', error);
        setIsConnected(false);
      });

      socket.on('join_error', (error) => {
        console.error('Failed to join document:', error);
      });

      socket.on('update_error', (error) => {
        console.error('Failed to process update:', error);
      });

      // Handle document synchronization
      socket.on('document_sync', (state: number[]) => {
        if (doc) {
          const update = new Uint8Array(state);
          Y.applyUpdate(doc, update);
          console.log('Document synchronized from server');
        }
      });

      // Handle real-time document updates
      socket.on('document_update', (data: { update: number[]; clientId: string; userId: string }) => {
        if (doc && data.clientId !== socket.id) {
          const update = new Uint8Array(data.update);
          Y.applyUpdate(doc, update);
        }
      });

      // Handle user presence
      socket.on('user_joined', (data: { userId: string; clientId: string }) => {
        setConnectedUsers(prev => new Set(prev).add(data.userId));
        console.log(`User ${data.userId} joined the document`);
      });

      socket.on('user_left', (data: { userId: string; clientId: string }) => {
        setConnectedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
        console.log(`User ${data.userId} left the document`);
      });

      socketRef.current = socket;
    } catch (error) {
      console.error('Failed to connect to sync server:', error);
      setIsConnected(false);
    }
  }, [session?.accessToken, doc]);

  // Function to disconnect from WebSocket server
  const disconnectFromSyncServer = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setConnectedUsers(new Set());
    }
  }, []);

  // Function to switch to a different document
  const switchDocument = useCallback(async (documentId: string) => {
    if (!session?.user?.id || !db) return;
    
    setIsLoading(true);
    
    try {
      // Leave current document room if connected
      if (socketRef.current?.connected && currentDocumentId) {
        // Socket will automatically handle leaving the room
      }
      
      // Save current document if it exists
      if (doc && currentDocumentId) {
        await saveDocumentToServer(currentDocumentId, doc);
      }
      
      // Load the new document
      const newDoc = await loadDocument(documentId);
      if (newDoc) {
        setCurrentDocumentId(documentId);
        
        // Join the new document room via WebSocket
        if (socketRef.current?.connected) {
          socketRef.current.emit('join_document', { documentId });
        }
      }
    } catch (error) {
      console.error('Failed to switch document:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, db, doc, currentDocumentId]);

  // Function to save document to server
  const saveDocumentToServer = useCallback(async (documentId: string, ydoc: Y.Doc) => {
    if (!session?.user?.id) return;
    
    try {
      const data = Y.encodeStateAsUpdate(ydoc);
      const base64Data = btoa(String.fromCharCode(...data));
      
      await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedContent: base64Data }),
      });
    } catch (error) {
      console.error('Failed to save document:', error);
    }
  }, [session?.user?.id]);

  // Function to load document from server
  const loadDocument = useCallback(async (documentId: string): Promise<Y.Doc | null> => {
    if (!session?.user?.id || !db) return null;
    
    try {
      // First try to load from server
      const response = await fetch(`/api/documents/${documentId}`);
      if (response.ok) {
        const document = await response.json();
        
        const ydoc = new Y.Doc();
        
        // Load from server if content exists
        if (document.encryptedContent) {
          const binaryData = Uint8Array.from(atob(document.encryptedContent), c => c.charCodeAt(0));
          Y.applyUpdate(ydoc, binaryData);
        } else {
          // Load from local SQLite as fallback
          const res = db.exec(`SELECT data FROM documents WHERE id = '${documentId}'`);
          if (res[0]?.values[0]?.[0]) {
            const dbState = res[0].values[0][0] as Uint8Array;
            Y.applyUpdate(ydoc, dbState);
          }
        }
        
        // Set up real-time synchronization for the document
        ydoc.on('update', (update: Uint8Array) => {
          // Send updates to sync server if connected
          if (socketRef.current?.connected && currentDocumentId === documentId) {
            socketRef.current.emit('document_update', {
              update: Array.from(update),
              documentId: documentId
            });
          }
          
          // Save to local SQLite for offline support
          if (db) {
            db.run("INSERT OR REPLACE INTO documents (id, data) VALUES (?, ?)", [documentId, update]);
            const binaryDb = db.export();
            localStorage.setItem('euplan-sqlite-db', JSON.stringify(Array.from(binaryDb)));
          }
        });
        
        setDoc(ydoc);
        return ydoc;
      }
      return null;
    } catch (error) {
      console.error('Failed to load document:', error);
      return null;
    }
  }, [session?.user?.id, db, currentDocumentId]);

  // Part 1: Initialize the SQLite Database
  useEffect(() => {
    const initDb = async () => {
      try {
        // Dynamically import sql.js only on the client side
        const initSqlJs = (await import('sql.js')).default;
        
        const SQL = await initSqlJs({ 
          locateFile: (file: string) => {
            if (file === 'sql-wasm.wasm') {
              return wasmUrl;
            }
            return file;
          }
        });
        
        const savedDb = localStorage.getItem('euplan-sqlite-db');
        let database;

        if (savedDb) {
          // If a saved database exists in localStorage, load it
          database = new SQL.Database(new Uint8Array(JSON.parse(savedDb)));
        } else {
          // Otherwise, create a new database
          database = new SQL.Database();
          // And create our table schema for local caching
          database.run("CREATE TABLE documents (id TEXT PRIMARY KEY, data BLOB);");
        }
        setDb(database);
      } catch (err) {
        console.error("Failed to initialize SQLite database:", err);
      }
    };
    
    // Only run on client side
    if (typeof window !== 'undefined') {
      initDb();
    }
  }, []); // Empty array ensures this runs only once on mount

  // Part 2: Handle WebSocket connection based on authentication
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      connectToSyncServer();
    } else if (status === 'unauthenticated') {
      disconnectFromSyncServer();
    }

    // Cleanup on unmount
    return () => {
      disconnectFromSyncServer();
    };
  }, [status, session?.user?.id, connectToSyncServer, disconnectFromSyncServer]);

  // Part 3: Handle authentication and document loading
  useEffect(() => {
    const initializeUserSession = async () => {
      if (!db || !session?.user?.id || status === 'loading') return;

      setIsLoading(true);
      
      try {
        // Get user's documents or create a default one
        const response = await fetch('/api/documents');
        if (response.ok) {
          const documents = await response.json();
          
          if (documents.length > 0) {
            // Load the most recent document
            const latestDoc = documents[0];
            await switchDocument(latestDoc.id);
          } else {
            // Create a new document for the user
            const newDocId = await createDocument();
            if (newDocId) {
              await switchDocument(newDocId);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize user session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Clear document when user logs out
    if (status === 'unauthenticated') {
      setDoc(null);
      setCurrentDocumentId(null);
      disconnectFromSyncServer();
    } else if (status === 'authenticated') {
      initializeUserSession();
    }
  }, [db, session?.user?.id, status]);

  // Part 4: Periodic server backup (less frequent than real-time sync)
  useEffect(() => {
    if (!doc || !currentDocumentId || !session?.user?.id) return;

    // Save to server every 30 seconds as backup (real-time sync happens via WebSocket)
    const interval = setInterval(async () => {
      await saveDocumentToServer(currentDocumentId, doc);
      console.log('Document backed up to server.');
    }, 30000);

    // This is the cleanup function
    return () => {
      clearInterval(interval);
      // Perform a final save before cleaning up
      saveDocumentToServer(currentDocumentId, doc);
    };
  }, [doc, currentDocumentId, session?.user?.id, saveDocumentToServer]);

  return (
    <YjsContext.Provider value={{ 
      doc, 
      currentDocumentId, 
      switchDocument, 
      createDocument, 
      isLoading,
      isConnected,
      connectedUsers
    }}>
      {children}
    </YjsContext.Provider>
  );
};