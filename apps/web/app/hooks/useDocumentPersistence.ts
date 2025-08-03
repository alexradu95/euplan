import { useState, useEffect, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import { useSession } from 'next-auth/react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseDocumentPersistenceOptions {
  autoSaveDelay?: number
  onSaveSuccess?: () => void
  onSaveError?: (error: Error) => void
}

export function useDocumentPersistence(
  ydoc: Y.Doc | null,
  documentId: string | null,
  options: UseDocumentPersistenceOptions = {}
) {
  const { data: session } = useSession()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const {
    autoSaveDelay = 2000, // 2 seconds
    onSaveSuccess,
    onSaveError,
  } = options

  // Save function
  const saveDocument = useCallback(async () => {
    if (!ydoc || !documentId || !session?.user?.id) return

    setSaveStatus('saving')

    try {
      // Get Y.js document state as binary
      const state = Y.encodeStateAsUpdate(ydoc)
      
      // Convert to base64 for transmission
      const encryptedContent = btoa(String.fromCharCode(...state))

      const response = await fetch(`/api/documents/${documentId}/autosave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedContent }),
      })

      if (!response.ok) {
        throw new Error(`Save failed: ${response.statusText}`)
      }

      setSaveStatus('saved')
      setLastSaved(new Date())
      onSaveSuccess?.()

    } catch (error) {
      console.error('Document save error:', error)
      setSaveStatus('error')
      onSaveError?.(error as Error)
    }
  }, [ydoc, documentId, session, onSaveSuccess, onSaveError])

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument()
    }, autoSaveDelay)
  }, [saveDocument, autoSaveDelay])

  // Listen for Y.js document changes
  useEffect(() => {
    if (!ydoc || !documentId) return

    const handleUpdate = () => {
      debouncedSave()
    }

    ydoc.on('update', handleUpdate)

    return () => {
      ydoc.off('update', handleUpdate)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [ydoc, documentId, debouncedSave])

  // Manual save function
  const manualSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    await saveDocument()
  }, [saveDocument])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        // Note: Can't await in cleanup, so this is fire-and-forget
        if (ydoc && documentId && session?.user?.id) {
          saveDocument()
        }
      }
    }
  }, [ydoc, documentId, session, saveDocument])

  return {
    saveStatus,
    lastSaved,
    manualSave,
  }
}
