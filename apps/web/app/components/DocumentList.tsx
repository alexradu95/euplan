'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useDocumentContext } from '../providers/DocumentProvider'
import { useDocuments } from '../hooks/useDocuments'

interface Document {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

// Simple date formatting helper
function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

export default function DocumentList() {
  const { data: session } = useSession()
  const { currentDocumentId, switchDocument, createDocument, isLoading: documentLoading } = useDocumentContext()
  const { getUserDocuments, deleteDocument, isLoading: documentsLoading } = useDocuments()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = async () => {
    if (!session?.user?.id) return

    try {
      setIsLoading(true)
      const docs = await getUserDocuments()
      setDocuments(docs)
      setError(null)
    } catch (err) {
      setError('Failed to load documents')
      console.error('Error loading documents:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [session?.user?.id])

  const handleCreateDocument = async () => {
    const newDocId = await createDocument('New Document')
    if (newDocId) {
      await loadDocuments() // Refresh the list
    }
  }

  const handleDeleteDocument = async (documentId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent document selection
    
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        const success = await deleteDocument(documentId)
        if (success) {
          await loadDocuments() // Refresh the list
          // If we deleted the current document, clear selection
          if (documentId === currentDocumentId) {
            // The document hook should handle this
          }
        }
      } catch (err) {
        console.error('Error deleting document:', err)
      }
    }
  }

  const handleDocumentClick = (documentId: string) => {
    switchDocument(documentId)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <p className="text-red-500">{error}</p>
        <button 
          onClick={loadDocuments}
          className="mt-2 text-blue-500 hover:text-blue-700"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4" data-testid="document-list">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <button
          onClick={handleCreateDocument}
          disabled={documentLoading}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          data-testid="create-document-btn"
        >
          {documentLoading ? 'Creating...' : 'New'}
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No documents yet</p>
          <button
            onClick={handleCreateDocument}
            disabled={documentLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Create your first document
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => handleDocumentClick(doc.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors group ${
                currentDocumentId === doc.id
                  ? 'bg-blue-50 border-blue-200'
                  : 'hover:bg-gray-50 border-gray-200'
              }`}
              data-testid={`document-item-${doc.id}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {doc.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {formatDate(doc.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteDocument(doc.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 transition-opacity"
                  data-testid={`delete-document-${doc.id}`}
                  title="Delete document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}