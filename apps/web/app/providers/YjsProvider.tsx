'use client'

import React, { createContext, useContext, memo, useCallback } from 'react'
import * as Y from 'yjs'
import { useYjsDocument } from '../hooks/useYjsDocument'
import ErrorBoundary from '../components/ErrorBoundary'

// Define the shape of the data and functions our context will provide
interface YjsContextType {
  doc: Y.Doc | null
  currentDocumentId: string | null
  switchDocument: (documentId: string) => Promise<void>
  createDocument: (title?: string) => Promise<string | null>
  isLoading: boolean
  isConnected: boolean
  connectedUsers: Set<string>
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
})

// Create a custom hook to make it easy to access the context in other components
export const useYjs = () => useContext(YjsContext)

// Create the Provider component itself - memoized to prevent unnecessary re-renders
export const YjsProvider = memo<{ children: React.ReactNode }>(({ children }) => {
  const yjsDocument = useYjsDocument()

  // Memoize error handler to prevent function recreation
  const handleProviderError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    console.error('YjsProvider error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    })
  }, [])

  return (
    <ErrorBoundary onError={handleProviderError}>
      <YjsContext.Provider value={yjsDocument}>
        {children}
      </YjsContext.Provider>
    </ErrorBoundary>
  )
})

YjsProvider.displayName = 'YjsProvider'