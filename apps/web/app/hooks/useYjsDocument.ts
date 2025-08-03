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
  
  // Change detection for optimized server backups
  const changeDetectionRef = useRef<{
    hasChanges: boolean
    lastSavedStateVector: Uint8Array | null
    lastBackupTime: number
  }>({
    hasChanges: false,
    lastSavedStateVector: null,
    lastBackupTime: 0
  })

  // Update docRef whenever doc changes
  useEffect(() => {
    docRef.current = doc
    // Reset change detection when document changes
    if (doc) {
      changeDetectionRef.current = {
        hasChanges: false,
        lastSavedStateVector: Y.encodeStateVector(doc),
        lastBackupTime: Date.now()
      }
    }
  }, [doc])

  // Check if document has changes since last save
  const hasDocumentChanged = useCallback((ydoc: Y.Doc): boolean => {
    if (!changeDetectionRef.current.lastSavedStateVector) {
      return true // No previous state, consider it changed
    }
    
    const currentStateVector = Y.encodeStateVector(ydoc)
    
    // Compare state vectors to detect changes
    if (currentStateVector.length !== changeDetectionRef.current.lastSavedStateVector.length) {
      return true
    }
    
    for (let i = 0; i < currentStateVector.length; i++) {
      if (currentStateVector[i] !== changeDetectionRef.current.lastSavedStateVector[i]) {
        return true
      }
    }
    
    return false
  }, [])

  // Mark document as having changes
  const markDocumentChanged = useCallback(() => {
    changeDetectionRef.current.hasChanges = true
  }, [])

  // Mark document as saved and update state vector
  const markDocumentSaved = useCallback((ydoc: Y.Doc) => {
    changeDetectionRef.current.hasChanges = false
    changeDetectionRef.current.lastSavedStateVector = Y.encodeStateVector(ydoc)
    changeDetectionRef.current.lastBackupTime = Date.now()
  }, [])

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
      // Mark that document has changes for optimized server backup
      markDocumentChanged()
      
      // Send updates to sync server if connected
      sendUpdate(update, documentId)
      
      // Save to local SQLite for offline support
      if (db) {
        db.run("INSERT OR REPLACE INTO documents (id, data) VALUES (?, ?)", [documentId, update])
        saveDatabase(db)
      }
    })
  }, [sendUpdate, db, saveDatabase, markDocumentChanged])

  const switchDocument = useCallback(async (documentId: string, skipLoadingState = false) => {
    if (!session?.user?.id || !db) return
    
    if (!skipLoadingState) {
      setIsLoading(true)
    }
    
    try {
      // Save current document if it exists
      if (doc && currentDocumentId) {
        await saveDocumentToServer(currentDocumentId, doc)
        markDocumentSaved(doc)
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
  }, [session?.user?.id, db, doc, currentDocumentId, loadDocument, saveDocumentToServer, setupDocumentSync, joinDocument, markDocumentSaved])

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
        
        
        if (documents.length > 0) {
          // Load the most recent document
          const latestDoc = documents[0]
          await switchDocument(latestDoc.id, true) // Skip loading state since we're already loading
        } else {
          // Create a new document for the user
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

  // Optimized periodic server backup with change detection
  useEffect(() => {
    if (!doc || !currentDocumentId || !session?.user?.id) return

    // Check for changes and save every 30 seconds (only if needed)
    const interval = setInterval(async () => {
      const now = Date.now()
      const timeSinceLastBackup = now - changeDetectionRef.current.lastBackupTime
      
      // Save if:
      // 1. Document has marked changes, OR
      // 2. Document has actual changes (detected via state vector), OR  
      // 3. It's been more than 5 minutes since last backup (safety backup)
      const shouldSave = 
        changeDetectionRef.current.hasChanges || 
        hasDocumentChanged(doc) ||
        timeSinceLastBackup > 5 * 60 * 1000 // 5 minutes safety backup
      
      if (shouldSave) {
        try {
          await saveDocumentToServer(currentDocumentId, doc)
          markDocumentSaved(doc)
        } catch (error) {
          // Silent fail for backup - user can retry manual save
          console.warn('Backup save failed:', error)
        }
      }
    }, 30000) // Check every 30 seconds

    return () => {
      clearInterval(interval)
      // Perform a final save before cleaning up if there are changes
      if (changeDetectionRef.current.hasChanges || hasDocumentChanged(doc)) {
        saveDocumentToServer(currentDocumentId, doc).then(() => {
          markDocumentSaved(doc)
        }).catch(() => {
          // Silent fail on cleanup
        })
      }
    }
  }, [doc, currentDocumentId, session?.user?.id, saveDocumentToServer, hasDocumentChanged, markDocumentSaved])

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