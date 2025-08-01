'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import * as Y from 'yjs'

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

  // This useEffect hook runs once when the component mounts
  useEffect(() => {
    // Create a new Y.js document
    const ydoc = new Y.Doc();
    
    // Store the document in our state
    setDoc(ydoc);

    // When the component unmounts (e.g., user closes the tab),
    // we destroy the document to clean up resources.
    return () => {
      ydoc.destroy();
    };
  }, []); // The empty dependency array [] ensures this runs only once.

  return (
    <YjsContext.Provider value={{ doc }}>
      {children}
    </YjsContext.Provider>
  );
};
