'use client'

import React, { createContext, useContext } from 'react'
import { useDocument } from '../hooks/useDocument'

type DocumentContextType = ReturnType<typeof useDocument>

const DocumentContext = createContext<DocumentContextType | null>(null)

export function DocumentProvider({ children }: { children: React.ReactNode }) {
  const documentState = useDocument()
  
  return (
    <DocumentContext.Provider value={documentState}>
      {children}
    </DocumentContext.Provider>
  )
}

export function useDocumentContext() {
  const context = useContext(DocumentContext)
  if (!context) {
    throw new Error('useDocumentContext must be used within DocumentProvider')
  }
  return context
}
