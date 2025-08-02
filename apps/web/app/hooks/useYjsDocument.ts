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
  
  const [doc, setDoc] = useState<Y.Doc | null>(null)
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const docRef = useRef<Y.Doc | null>(null)

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

  const switchDocument = useCallback(async (documentId: string) => {
    if (!session?.user?.id || !db) return
    
    setIsLoading(true)
    
    try {
      // Save current document if it exists
      if (doc && currentDocumentId) {
        await saveDocumentToServer(currentDocumentId, doc)
      }
      
      // Set the current document ID BEFORE loading the document
      setCurrentDocumentId(documentId)
      
      // Load the new document
      const newDoc = await loadDocument(documentId)
      if (newDoc) {
        setupDocumentSync(newDoc, documentId)
        setDoc(newDoc)
        
        // Join the new document room via WebSocket
        joinDocument(documentId)
      }
    } catch (error) {
      console.error('Failed to switch document:', error)
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id, db, doc, currentDocumentId, loadDocument, saveDocumentToServer, setupDocumentSync, joinDocument])

  // Initialize user session and load first document
  useEffect(() => {
    const initializeUserSession = async () => {
      if (!db || !session?.user?.id || status === 'loading') return

      setIsLoading(true)
      
      try {
        const documents = await getUserDocuments()
        
        if (documents.length > 0) {
          // Load the most recent document
          const latestDoc = documents[0]
          await switchDocument(latestDoc.id)
        } else {
          // Create a new document for the user
          const newDocId = await createDocument()
          if (newDocId) {
            await switchDocument(newDocId)
          }
        }
      } catch (error) {
        console.error('Failed to initialize user session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Clear document when user logs out
    if (status === 'unauthenticated') {
      setDoc(null)
      setCurrentDocumentId(null)
    } else if (status === 'authenticated' && isInitialized) {
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