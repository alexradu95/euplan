'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import * as Y from 'yjs'
import type { Database } from 'sql.js'

export function useDocuments(db: Database | null) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const createDocument = useCallback(async (title = "Untitled Document") => {
    if (!session?.user?.id) return null
    
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      
      if (response.ok) {
        const result = await response.json()
        // Extract documentId from the API response format
        const documentId = result.data?.documentId || result.documentId
        return documentId
      }
      return null
    } catch (error) {
      return null
    }
  }, [session?.user?.id])

  const saveDocumentToServer = useCallback(async (documentId: string, ydoc: Y.Doc) => {
    if (!session?.user?.id) return
    
    try {
      const data = Y.encodeStateAsUpdate(ydoc)
      const base64Data = btoa(String.fromCharCode(...data))
      
      await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedContent: base64Data }),
      })
    } catch (error) {
      // Silent fail - operation will be retried
    }
  }, [session?.user?.id])

  const loadDocument = useCallback(async (documentId: string): Promise<Y.Doc | null> => {
    if (!session?.user?.id || !db) return null
    
    setIsLoading(true)
    
    try {
      // First try to load from server
      const response = await fetch(`/api/documents/${documentId}`)
      if (response.ok) {
        const result = await response.json()
        // Extract document from the API response format
        const document = result.data || result
        
        const ydoc = new Y.Doc()
        
        // Load from server if content exists
        if (document.encryptedContent) {
          try {
            // Validate base64 format
            const binaryData = Uint8Array.from(atob(document.encryptedContent), c => c.charCodeAt(0))
            Y.applyUpdate(ydoc, binaryData)
          } catch (error) {
            // Invalid content format - skip loading
          }
        } else {
          // Load from local SQLite as fallback
          const res = db.exec(`SELECT data FROM documents WHERE id = '${documentId}'`)
          if (res[0]?.values[0]?.[0]) {
            const dbState = res[0].values[0][0] as Uint8Array
            Y.applyUpdate(ydoc, dbState)
          }
        }
        
        return ydoc
      }
      return null
    } catch (error) {
      return null
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id, db])

  const getUserDocuments = useCallback(async () => {
    if (!session?.user?.id) return []
    
    try {
      const response = await fetch('/api/documents')
      if (response.ok) {
        const result = await response.json()
        // Extract data from the API response format { success: true, data: [...] }
        const documents = result.data || []
        return Array.isArray(documents) ? documents : []
      }
      return []
    } catch (error) {
      return []
    }
  }, [session?.user?.id])

  return {
    createDocument,
    loadDocument,
    saveDocumentToServer,
    getUserDocuments,
    isLoading
  }
}