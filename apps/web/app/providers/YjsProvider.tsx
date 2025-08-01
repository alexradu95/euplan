'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import * as Y from 'yjs'
import type { Database } from 'sql.js'

const wasmUrl = "https://sql.js.org/dist/sql-wasm.wasm";

// Define the shape of the data and functions our context will provide
interface YjsContextType {
  doc: Y.Doc | null;
}

// Create the React Context with a default value
const YjsContext = createContext<YjsContextType>({ doc: null });

// Create a custom hook to make it easy to access the context in other components
export const useYjs = () => useContext(YjsContext);

// Create the Provider component itself
export const YjsProvider = ({ children }: { children: React.ReactNode }) => {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [db, setDb] = useState<Database | null>(null);

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
          // And create our table schema
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

  // Part 2: Load the Y.Doc from the DB and set up autosaving
  useEffect(() => {
    // This effect runs only after the database has been initialized
    if (!db) return;

    const ydoc = new Y.Doc();
    const docId = 'main-document'; // For now, we'll use a single, hardcoded document ID

    // Load the document data from the database
    const res = db.exec(`SELECT data FROM documents WHERE id = '${docId}'`);
    if (res[0]?.values[0]?.[0]) {
      const dbState = res[0].values[0][0] as Uint8Array;
      // Apply the saved state to our in-memory Y.js document
      Y.applyUpdate(ydoc, dbState);
    }

    // This function handles saving the document
    const saveToDb = () => {
      if (!db) return;
      // Encode the entire Y.js document state into a single binary blob
      const data = Y.encodeStateAsUpdate(ydoc);
      // Save the blob into our SQLite table, replacing the old entry
      db.run("INSERT OR REPLACE INTO documents (id, data) VALUES (?, ?)", [docId, data]);
      
      // Persist the entire database file to localStorage for the next session
      const binaryDb = db.export();
      localStorage.setItem('euplan-sqlite-db', JSON.stringify(Array.from(binaryDb)));
      console.log('Document saved to SQLite.');
    };

    // Set up an interval to automatically save every 3 seconds
    const interval = setInterval(saveToDb, 3000);

    // Make the document available to the rest of the app
    setDoc(ydoc);

    // This is the cleanup function that runs when the component unmounts
    return () => {
      clearInterval(interval);
      saveToDb(); // Perform a final save before closing
      ydoc.destroy();
      db.close();
    };
  }, [db]); // This effect depends on the `db` state

  return (
    <YjsContext.Provider value={{ doc }}>
      {children}
    </YjsContext.Provider>
  );
};