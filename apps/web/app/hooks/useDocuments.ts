'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface Document {
  id: string
  title: string
  content: string | null
  createdAt: string
  updatedAt: string
}

export function useDocuments() {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const createDocument = useCallback(async (title = "Untitled Document") => {
    if (!session?.user?.id) return null
    
    try {
      setIsLoading(true)
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      
      if (response.ok) {
        const { documentId } = await response.json()
        return documentId
      }
      return null
    } catch (error) {
      console.error('Error creating document:', error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id])

  const loadDocument = useCallback(async (documentId: string): Promise<Document | null> => {
    if (!session?.user?.id) return null

    try {
      setIsLoading(true)
      const response = await fetch(`/api/documents/${documentId}`)
      
      if (response.ok) {
        const document = await response.json()
        return document
      }
      return null
    } catch (error) {
      console.error('Error loading document:', error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id])

  const getUserDocuments = useCallback(async (): Promise<Document[]> => {
    if (!session?.user?.id) return []

    try {
      setIsLoading(true)
      const response = await fetch('/api/documents')
      
      if (response.ok) {
        const documents = await response.json()
        return documents
      }
      return []
    } catch (error) {
      console.error('Error fetching documents:', error)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id])

  const deleteDocument = useCallback(async (documentId: string): Promise<boolean> => {
    if (!session?.user?.id) return false

    try {
      setIsLoading(true)
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })
      
      return response.ok
    } catch (error) {
      console.error('Error deleting document:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id])

  return {
    isLoading,
    createDocument,
    loadDocument,
    getUserDocuments,
    deleteDocument,
  }
}