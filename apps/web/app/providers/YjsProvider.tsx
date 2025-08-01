'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { useSession } from 'next-auth/react'
import type { Database } from 'sql.js'

const wasmUrl = "https://sql.js.org/dist/sql-wasm.wasm";

// Define the shape of the data and functions our context will provide
interface YjsContextType {
  doc: Y.Doc | null;
  currentDocumentId: string | null;
  switchDocument: (documentId: string) => Promise<void>;
  createDocument: (title?: string) => Promise<string | null>;
  isLoading: boolean;
}

// Create the React Context with a default value
const YjsContext = createContext<YjsContextType>({ 
  doc: null,
  currentDocumentId: null,
  switchDocument: async () => {},
  createDocument: async () => null,
  isLoading: false,
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

  // Function to switch to a different document
  const switchDocument = useCallback(async (documentId: string) => {
    if (!session?.user?.id || !db) return;
    
    setIsLoading(true);
    
    try {
      // Save current document if it exists
      if (doc && currentDocumentId) {
        await saveDocumentToServer(currentDocumentId, doc);
      }
      
      // Load the new document
      await loadDocument(documentId);
      setCurrentDocumentId(documentId);
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
  const loadDocument = useCallback(async (documentId: string) => {
    if (!session?.user?.id || !db) return;
    
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
        
        setDoc(ydoc);
        return ydoc;
      }
    } catch (error) {
      console.error('Failed to load document:', error);
    }
  }, [session?.user?.id, db]);

  // Part 1: Initialize the SQLite Database
  useEffect(() => {
    const initDb = async () => {
      try {
        // Dynamically import sql.js only on the client side
        // This tells webpack: "Don't bundle this at build time, load it at runtime!"
        // As SqlJS needs access to fs path which is not available in the browser
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

  // Part 2: Handle authentication and document loading
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
            await loadDocument(latestDoc.id);
            setCurrentDocumentId(latestDoc.id);
          } else {
            // Create a new document for the user
            const newDocId = await createDocument();
            if (newDocId) {
              await loadDocument(newDocId);
              setCurrentDocumentId(newDocId);
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
    } else if (status === 'authenticated') {
      initializeUserSession();
    }
  }, [db, session?.user?.id, status, loadDocument, createDocument]);

  // Part 3: Auto-save document changes
  useEffect(() => {
    if (!doc || !currentDocumentId || !session?.user?.id) return;

    const saveToLocalAndServer = async () => {
      if (!db || !doc || !currentDocumentId) return;
      
      // Save to local SQLite for offline access
      const data = Y.encodeStateAsUpdate(doc);
      db.run("INSERT OR REPLACE INTO documents (id, data) VALUES (?, ?)", [currentDocumentId, data]);
      
      // Persist SQLite to localStorage
      const binaryDb = db.export();
      localStorage.setItem('euplan-sqlite-db', JSON.stringify(Array.from(binaryDb)));
      
      // Save to server
      await saveDocumentToServer(currentDocumentId, doc);
      
      console.log('Document saved locally and to server.');
    };

    // Set up an interval to automatically save every 5 seconds
    const interval = setInterval(saveToLocalAndServer, 5000);

    // This is the cleanup function
    return () => {
      clearInterval(interval);
      // Perform a final save before cleaning up
      saveToLocalAndServer();
    };
  }, [doc, currentDocumentId, session?.user?.id, db, saveDocumentToServer]);

  return (
    <YjsContext.Provider value={{ 
      doc, 
      currentDocumentId, 
      switchDocument, 
      createDocument, 
      isLoading 
    }}>
      {children}
    </YjsContext.Provider>
  );
};