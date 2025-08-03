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
  const { isLoading: documentsLoading, loadDocument, createDocument } = useDocuments()
  
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
