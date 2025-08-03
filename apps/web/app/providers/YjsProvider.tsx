'use client'

import React, { createContext, useContext } from 'react'
import * as Y from 'yjs'
import { useYjsDocument } from '../hooks/useYjsDocument'

// Define the shape of the data and functions our context will provide
interface YjsContextType {
  doc: Y.Doc | null
  currentDocumentId: string | null
  switchDocument: (documentId: string) => Promise<void>
  createDocument: (title?: string) => Promise<string | null>
  isLoading: boolean
}

// Create the React Context with a default value
const YjsContext = createContext<YjsContextType>({ 
  doc: null,
  currentDocumentId: null,
  switchDocument: async () => {},
  createDocument: async () => null,
  isLoading: false,
})

// Create a custom hook to make it easy to access the context in other components
export const useYjs = () => useContext(YjsContext)

// Create the Provider component itself
export const YjsProvider = ({ children }: { children: React.ReactNode }) => {
  const yjsDocument = useYjsDocument()

  return (
    <YjsContext.Provider value={yjsDocument}>
      {children}
    </YjsContext.Provider>
  )
}