'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useYjs } from '../providers/YjsProvider'

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
  const { currentDocumentId, switchDocument, createDocument, isLoading: yjsLoading } = useYjs()
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = async () => {
    if (!session?.user?.id) return

    try {
      setIsLoading(true)
      const response = await fetch('/api/documents')
      
      if (!response.ok) {
        throw new Error('Failed to load documents')
      }

      const docs = await response.json()
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

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadDocuments() // Refresh the list
        // If we deleted the current document, create a new one
        if (documentId === currentDocumentId) {
          await handleCreateDocument()
        }
      } else {
        throw new Error('Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Failed to delete document')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading documents...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-500">{error}</div>
        <button 
          onClick={loadDocuments}
          className="ml-2 text-blue-600 hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Your Documents</h2>
          <button
            onClick={handleCreateDocument}
            disabled={yjsLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {yjsLoading ? 'Creating...' : 'New Document'}
          </button>
        </div>
      </div>

      <div className="divide-y">
        {documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No documents yet.</p>
            <button
              onClick={handleCreateDocument}
              className="mt-2 text-blue-600 hover:underline"
            >
              Create your first document
            </button>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                doc.id === currentDocumentId ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
              onClick={() => switchDocument(doc.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{doc.title}</h3>
                  <p className="text-sm text-gray-500">
                    Updated {formatDate(doc.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {doc.id === currentDocumentId && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      Current
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteDocument(doc.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete document"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
