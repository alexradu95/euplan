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
  const { data: session, status } = useSession()
  const [doc, setDoc] = useState<Y.Doc | null>(null)
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true) // Start with loading true
  const [isInitialized, setIsInitialized] = useState(false) // Track if we've initialized

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

  // Auto-load user's documents when authenticated
  useEffect(() => {
    const initializeUserDocuments = async () => {
      // Prevent re-initialization
      if (isInitialized || status === 'loading') return
      
      if (status === 'unauthenticated') {
        setIsLoading(false)
        return
      }

      if (!session?.user?.id) {
        setIsLoading(false)
        return
      }

      setIsInitialized(true) // Mark as initializing
      
      try {
        // Get user's documents
        const response = await fetch('/api/documents')
        if (!response.ok) {
          throw new Error('Failed to fetch documents')
        }

        const documents = await response.json()
        
        if (documents.length > 0) {
          // Load the most recent document - inline the logic to avoid dependency issues
          setIsLoading(true)
          try {
            const newDoc = await loadDocument(documents[0].id)
            if (newDoc) {
              setDoc(newDoc)
              setCurrentDocumentId(documents[0].id)
            }
          } catch (error) {
            console.error('Failed to load initial document:', error)
          } finally {
            setIsLoading(false)
          }
        } else {
          // Create a new document for the user - inline the logic
          try {
            const response = await fetch('/api/documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: 'Untitled Document' }),
            })

            if (response.ok) {
              const { id: documentId } = await response.json()
              const newDoc = await loadDocument(documentId)
              if (newDoc) {
                setDoc(newDoc)
                setCurrentDocumentId(documentId)
              }
            } else {
              console.error('Failed to create initial document')
            }
          } catch (error) {
            console.error('Failed to create initial document:', error)
          }
        }
      } catch (error) {
        console.error('Failed to initialize documents:', error)
        setIsInitialized(false) // Reset on error to allow retry
      } finally {
        setIsLoading(false)
      }
    }

    initializeUserDocuments()
  }, [session?.user?.id, status, isInitialized]) // Removed switchDocument and createDocument from deps

  // Reset initialization when user changes
  useEffect(() => {
    if (status === 'unauthenticated') {
      setIsInitialized(false)
      setDoc(null)
      setCurrentDocumentId(null)
    }
  }, [status])

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