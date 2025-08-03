'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useDocuments } from './useDocuments'
import { useDocumentPersistence } from './useDocumentPersistence'

interface DocumentState {
  currentDocumentId: string | null
  content: string
  title: string
}

export function useDocument() {
  const { data: session, status } = useSession()
  const { isLoading: documentsLoading, loadDocument, saveDocumentToServer, createDocument } = useDocuments()
  
  const [documentState, setDocumentState] = useState<DocumentState>({
    currentDocumentId: null,
    content: '',
    title: 'Untitled Document'
  })
  
  const [isLoading, setIsLoading] = useState(false)
  
  const { currentDocumentId, content, title } = documentState

  // Auto-save functionality
  const { saveStatus, lastSaved, manualSave } = useDocumentPersistence(
    content,
    currentDocumentId,
    {
      onSaveError: (error) => {
        console.error('Auto-save failed:', error)
        // Could show toast notification here
      },
    }
  )

  // Load a document
  const switchDocument = useCallback(async (documentId: string) => {
    if (isLoading || documentId === currentDocumentId) return

    setIsLoading(true)
    try {
      const document = await loadDocument(documentId)
      if (document) {
        setDocumentState({
          currentDocumentId: documentId,
          content: document.content || '',
          title: document.title
        })
      }
    } catch (error) {
      console.error('Failed to load document:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, currentDocumentId, loadDocument])

  // Create a new document
  const createNewDocument = useCallback(async (title?: string) => {
    if (isLoading) return null

    setIsLoading(true)
    try {
      const documentId = await createDocument(title)
      if (documentId) {
        setDocumentState({
          currentDocumentId: documentId,
          content: '',
          title: title || 'Untitled Document'
        })
        return documentId
      }
    } catch (error) {
      console.error('Failed to create document:', error)
    } finally {
      setIsLoading(false)
    }
    return null
  }, [isLoading, createDocument])

  // Update content
  const updateContent = useCallback((newContent: string) => {
    setDocumentState(prev => ({
      ...prev,
      content: newContent
    }))
  }, [])

  // Update title
  const updateTitle = useCallback(async (newTitle: string) => {
    if (!currentDocumentId) return

    setDocumentState(prev => ({
      ...prev,
      title: newTitle
    }))

    // Save title to server immediately
    try {
      await fetch(`/api/documents/${currentDocumentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })
    } catch (error) {
      console.error('Failed to update title:', error)
    }
  }, [currentDocumentId])

  return {
    // Document state
    currentDocumentId,
    content,
    title,
    isLoading: isLoading || documentsLoading,
    
    // Actions
    switchDocument,
    createDocument: createNewDocument,
    updateContent,
    updateTitle,
    manualSave,
    
    // Auto-save status
    saveStatus,
    lastSaved,
  }
}
    docRef.current = doc
  }, [doc])

  const setupDocumentSync = useCallback((ydoc: Y.Doc, documentId: string) => {
    // Set up local persistence for the document
    ydoc.on('update', (update: Uint8Array) => {
      // Save to local SQLite for offline support
      if (db) {
        db.run("INSERT OR REPLACE INTO documents (id, data) VALUES (?, ?)", [documentId, update])
        saveDatabase(db)
      }
    })
  }, [db, saveDatabase])

  const switchDocument = useCallback(async (documentId: string, skipLoadingState = false) => {
    if (!session?.user?.id || !db) return
    
    if (!skipLoadingState) {
      setIsLoading(true)
    }
    
    try {
      // Save current document if it exists
      if (doc && currentDocumentId) {
        await saveDocumentToServer(currentDocumentId, doc)
      }
      
      // Load the new document first
      const newDoc = await loadDocument(documentId)
      if (newDoc) {
        setupDocumentSync(newDoc, documentId)
        
        // Set both states atomically to reduce renders
        setDocumentState({
          doc: newDoc,
          currentDocumentId: documentId
        })
      }
    } catch (error) {
      // Silent fail - user can retry
    } finally {
      if (!skipLoadingState) {
        setIsLoading(false)
      }
    }
  }, [session?.user?.id, db, doc, currentDocumentId, loadDocument, saveDocumentToServer, setupDocumentSync])

  // Handle user logout - separate effect to prevent dependency issues
  useEffect(() => {
    if (status === 'unauthenticated') {
      setDocumentState({
        doc: null,
        currentDocumentId: null
      })
      initializationRef.current = null
    }
  }, [status])

  // Initialize user session and load first document
  useEffect(() => {
    const initializeUserSession = async () => {
      const userId = session?.user?.id
      if (!db || !userId || status !== 'authenticated') return
      
      // Check if we've already initialized for this user
      if (initializationRef.current === userId) return
      
      setIsLoading(true)
      initializationRef.current = userId
      
      try {
        const documents = await getUserDocuments()
        
        // Debug: Log what's happening
        if (typeof window !== 'undefined') {
          console.log('[DEBUG] Initialization - documents found:', documents.length)
          console.log('[DEBUG] Current user:', userId)
          console.log('[DEBUG] Previous init user:', initializationRef.current)
        }
        
        if (documents.length > 0) {
          // Load the most recent document
          const latestDoc = documents[0]
          if (typeof window !== 'undefined') {
            console.log('[DEBUG] Loading existing document:', latestDoc.id)
          }
          await switchDocument(latestDoc.id, true) // Skip loading state since we're already loading
        } else {
          // Create a new document for the user
          if (typeof window !== 'undefined') {
            console.log('[DEBUG] Creating new document')
          }
          const newDocId = await createDocument()
          if (newDocId) {
            await switchDocument(newDocId, true) // Skip loading state since we're already loading
          }
        }
      } catch (error) {
        // Failed to initialize session - reset initialization flag
        initializationRef.current = null
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'authenticated' && isInitialized) {
      initializeUserSession()
    }
  }, [db, session?.user?.id, status, isInitialized, switchDocument, createDocument, getUserDocuments])

  // Periodic server backup
  useEffect(() => {
    if (!doc || !currentDocumentId || !session?.user?.id) return

    // Save to server every 30 seconds as backup
    const interval = setInterval(async () => {
      await saveDocumentToServer(currentDocumentId, doc)
    }, 30000)

    return () => {
      clearInterval(interval)
      // Perform a final save before cleaning up
      saveDocumentToServer(currentDocumentId, doc)
    }
  }, [doc, currentDocumentId, session?.user?.id, saveDocumentToServer])

  return {
    doc,
    currentDocumentId,
    switchDocument,
    createDocument,
    isLoading: isLoading || documentsLoading
  }
}