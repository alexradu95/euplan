'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import * as Y from 'yjs'
import type { Database } from 'sql.js'
import { useDatabase } from './useDatabase'
import { useWebSocket } from './useWebSocket'
import { useDocuments } from './useDocuments'

export function useYjsDocument() {
  const { data: session, status } = useSession()
  const { db, isInitialized, saveDatabase } = useDatabase()
  const { isLoading: documentsLoading, loadDocument, saveDocumentToServer, createDocument, getUserDocuments } = useDocuments(db)
  
  const [documentState, setDocumentState] = useState<{
    doc: Y.Doc | null
    currentDocumentId: string | null
  }>({
    doc: null,
    currentDocumentId: null
  })
  const [isLoading, setIsLoading] = useState(false)
  
  const { doc, currentDocumentId } = documentState
  
  const docRef = useRef<Y.Doc | null>(null)
  const initializationRef = useRef<string | null>(null) // Track which user has been initialized

  // Update docRef whenever doc changes
  useEffect(() => {
    docRef.current = doc
  }, [doc])

  const handleDocumentSync = useCallback((state: number[]) => {
    if (docRef.current) {
      const update = new Uint8Array(state)
      Y.applyUpdate(docRef.current, update)
    }
  }, [])

  const handleDocumentUpdate = useCallback((data: { update: number[]; clientId: string; userId: string }) => {
    if (docRef.current) {
      const update = new Uint8Array(data.update)
      Y.applyUpdate(docRef.current, update)
    }
  }, [])

  const { isConnected, connectedUsers, joinDocument, sendUpdate } = useWebSocket({
    onDocumentSync: handleDocumentSync,
    onDocumentUpdate: handleDocumentUpdate
  })

  const setupDocumentSync = useCallback((ydoc: Y.Doc, documentId: string) => {
    // Set up real-time synchronization for the document
    ydoc.on('update', (update: Uint8Array) => {
      // Send updates to sync server if connected
      sendUpdate(update, documentId)
      
      // Save to local SQLite for offline support
      if (db) {
        db.run("INSERT OR REPLACE INTO documents (id, data) VALUES (?, ?)", [documentId, update])
        saveDatabase(db)
      }
    })
  }, [sendUpdate, db, saveDatabase])

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
        
        // Join the new document room via WebSocket
        joinDocument(documentId)
      }
    } catch (error) {
      // Silent fail - user can retry
    } finally {
      if (!skipLoadingState) {
        setIsLoading(false)
      }
    }
  }, [session?.user?.id, db, doc, currentDocumentId, loadDocument, saveDocumentToServer, setupDocumentSync, joinDocument])

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
    isLoading: isLoading || documentsLoading,
    isConnected,
    connectedUsers
  }
}