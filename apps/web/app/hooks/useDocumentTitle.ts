'use client'

import { useState } from 'react'

type Document = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  accessLevel: 'read' | 'write' | 'owner'
}

type UseDocumentTitleOptions = {
  currentDocument: Document | null
  currentDocumentId: string | null
  onTitleUpdate: (title: string) => void
}

export function useDocumentTitle({ 
  currentDocument, 
  currentDocumentId, 
  onTitleUpdate 
}: UseDocumentTitleOptions) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')

  const canEditTitle = currentDocument && currentDocument.accessLevel !== 'read'

  const startEditing = () => {
    if (canEditTitle) {
      setIsEditingTitle(true)
      setEditedTitle(currentDocument.title)
    }
  }

  const saveTitle = async () => {
    if (!currentDocumentId || !editedTitle.trim()) {
      setIsEditingTitle(false)
      return
    }

    try {
      const response = await fetch(`/api/documents/${currentDocumentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editedTitle.trim() }),
      })

      if (response.ok) {
        onTitleUpdate(editedTitle.trim())
      } else {
        // Revert on error
        setEditedTitle(currentDocument?.title || '')
      }
    } catch (error) {
      // Revert on error
      setEditedTitle(currentDocument?.title || '')
    }

    setIsEditingTitle(false)
  }

  const cancelEditing = () => {
    setEditedTitle(currentDocument?.title || '')
    setIsEditingTitle(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveTitle()
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  return {
    isEditingTitle,
    editedTitle,
    setEditedTitle,
    canEditTitle,
    startEditing,
    saveTitle,
    cancelEditing,
    handleKeyDown,
  }
}