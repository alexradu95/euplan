import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseDocumentPersistenceOptions {
  autoSaveDelay?: number
  onSaveSuccess?: () => void
  onSaveError?: (error: Error) => void
}

export function useDocumentPersistence(
  content: string | null,
  documentId: string | null,
  options: UseDocumentPersistenceOptions = {}
) {
  const { data: session } = useSession()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastContentRef = useRef<string | null>(null)
  
  const {
    autoSaveDelay = 2000, // 2 seconds
    onSaveSuccess,
    onSaveError,
  } = options

  // Save function
  const saveDocument = useCallback(async () => {
    if (!content || !documentId || !session?.user?.id) return

    setSaveStatus('saving')

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        throw new Error(`Save failed: ${response.statusText}`)
      }

      setSaveStatus('saved')
      setLastSaved(new Date())
      lastContentRef.current = content
      onSaveSuccess?.()

    } catch (error) {
      console.error('Document save error:', error)
      setSaveStatus('error')
      onSaveError?.(error as Error)
    }
  }, [content, documentId, session, onSaveSuccess, onSaveError])

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument()
    }, autoSaveDelay)
  }, [saveDocument, autoSaveDelay])

  // Auto-save when content changes
  useEffect(() => {
    if (!content || !documentId || content === lastContentRef.current) return

    debouncedSave()

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, documentId, debouncedSave])

  // Manual save function
  const manualSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    await saveDocument()
  }, [saveDocument])

  return {
    saveStatus,
    lastSaved,
    manualSave,
  }
}
