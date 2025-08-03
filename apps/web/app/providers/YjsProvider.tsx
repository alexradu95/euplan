'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as Y from 'yjs'
import { useSession } from 'next-auth/react'
import { useDocumentPersistence } from '../hooks/useDocumentPersistence'

interface YjsContextType {
  doc: Y.Doc | null
  currentDocumentId: string | null
  isLoading: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  lastSaved: Date | null
  switchDocument: (documentId: string) => Promise<void>
  createDocument: (title?: string) => Promise<string | null>
  manualSave: () => Promise<void>
}

const YjsContext = createContext<YjsContextType>({
  doc: null,
  currentDocumentId: null,
  isLoading: false,
  saveStatus: 'idle',
  lastSaved: null,
  switchDocument: async () => {},
  createDocument: async () => null,
  manualSave: async () => {},
})

export const useYjs = () => useContext(YjsContext)

export function YjsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [doc, setDoc] = useState<Y.Doc | null>(null)
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Auto-save functionality
  const { saveStatus, lastSaved, manualSave } = useDocumentPersistence(
    doc,
    currentDocumentId,
    {
      onSaveError: (error) => {
        console.error('Auto-save failed:', error)
        // Could show toast notification here
      },
    }
  )

  // Load document from server
  const loadDocument = useCallback(async (documentId: string): Promise<Y.Doc | null> => {
    if (!session?.user?.id) return null

    try {
      const response = await fetch(`/api/documents/${documentId}`)
      if (!response.ok) {
        throw new Error('Failed to load document')
      }

      const data = await response.json()
      const newDoc = new Y.Doc()

      // Load content if it exists
      if (data.encryptedContent) {
        try {
          // Convert base64 back to binary
          const binaryData = Uint8Array.from(
            atob(data.encryptedContent),
            c => c.charCodeAt(0)
          )
          // Apply the state to Y.js document
          Y.applyUpdate(newDoc, binaryData)
        } catch (error) {
          console.error('Failed to parse document content:', error)
          // Document will be empty, which is okay
        }
      }

      return newDoc
    } catch (error) {
      console.error('Failed to load document:', error)
      return null
    }
  }, [session])

  // Switch to different document
  const switchDocument = useCallback(async (documentId: string) => {
    setIsLoading(true)

    try {
      // Save current document if exists
      if (doc && currentDocumentId) {
        await manualSave()
      }

      // Load new document
      const newDoc = await loadDocument(documentId)
      if (newDoc) {
        setDoc(newDoc)
        setCurrentDocumentId(documentId)
      }
    } catch (error) {
      console.error('Failed to switch document:', error)
    } finally {
      setIsLoading(false)
    }
  }, [doc, currentDocumentId, manualSave, loadDocument])

  // Create new document
  const createDocument = useCallback(async (title = 'Untitled Document'): Promise<string | null> => {
    if (!session?.user?.id) return null

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })

      if (!response.ok) {
        throw new Error('Failed to create document')
      }

      const { id: documentId } = await response.json()
      await switchDocument(documentId)
      return documentId
    } catch (error) {
      console.error('Failed to create document:', error)
      return null
    }
  }, [session, switchDocument])

  const value: YjsContextType = {
    doc,
    currentDocumentId,
    isLoading,
    saveStatus,
    lastSaved,
    switchDocument,
    createDocument,
    manualSave,
  }

  return <YjsContext.Provider value={value}>{children}</YjsContext.Provider>
}