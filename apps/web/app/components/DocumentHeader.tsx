'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useYjs } from '../providers/YjsProvider'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { ChevronDown, Plus, LogOut, FileText } from 'lucide-react'

interface Document {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  accessLevel: 'read' | 'write' | 'owner'
}

export default function DocumentHeader() {
  const { data: session } = useSession()
  const { currentDocumentId, switchDocument, createDocument, isLoading } = useYjs()
  const [documents, setDocuments] = useState<Document[]>([])
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const handleTitleUpdate = (newTitle: string) => {
    setCurrentDocument(prev => prev ? { ...prev, title: newTitle } : null)
    setDocuments(prev => prev.map(doc => 
      doc.id === currentDocumentId 
        ? { ...doc, title: newTitle }
        : doc
    ))
  }

  const {
    isEditingTitle,
    editedTitle,
    setEditedTitle,
    startEditing,
    saveTitle,
    handleKeyDown,
  } = useDocumentTitle({
    currentDocument,
    currentDocumentId,
    onTitleUpdate: handleTitleUpdate,
  })

  // Fetch user's documents
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!session?.user?.id) return
      
      try {
        const response = await fetch('/api/documents')
        if (response.ok) {
          const docs = await response.json()
          setDocuments(docs)
          
          // Set current document
          if (currentDocumentId) {
            const current = docs.find((doc: Document) => doc.id === currentDocumentId)
            setCurrentDocument(current || null)
          }
        }
      } catch (error) {
        // Silent fail - UI will show empty state
      }
    }

    fetchDocuments()
  }, [session?.user?.id, currentDocumentId])

  const handleCreateDocument = async () => {
    setIsCreating(true)
    try {
      const newDocId = await createDocument('New Document')
      if (newDocId) {
        await switchDocument(newDocId)
        setShowDropdown(false)
        // Refresh documents list
        const response = await fetch('/api/documents')
        if (response.ok) {
          const docs = await response.json()
          setDocuments(docs)
        }
      }
    } catch (error) {
      // Silent fail - user can retry
    } finally {
      setIsCreating(false)
    }
  }

  const handleSwitchDocument = async (documentId: string) => {
    try {
      await switchDocument(documentId)
      setShowDropdown(false)
    } catch (error) {
      // Silent fail - user can retry
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/login' })
    } catch (error) {
      // Silent fail - likely already signed out
    }
  }

  if (!session) return null

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Document Selector */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={isLoading}
            className="flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            data-testid="create-document-button"
          >
            <FileText className="h-4 w-4" />
            {isEditingTitle ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={saveTitle}
                className="max-w-48 bg-transparent border-none outline-none text-sm font-medium text-gray-700"
                data-testid="document-title-input"
                autoFocus
              />
            ) : (
              <span 
                className="max-w-48 truncate cursor-pointer" 
                data-testid="document-title"
                onClick={startEditing}
              >
                {isLoading ? 'Loading...' : currentDocument?.title || 'Select Document'}
              </span>
            )}
            <ChevronDown className="h-4 w-4" />
          </button>

          {showDropdown && (
            <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="p-2">
                {/* Create New Document */}
                <button
                  onClick={handleCreateDocument}
                  disabled={isCreating}
                  className="flex w-full items-center space-x-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>{isCreating ? 'Creating...' : 'New Document'}</span>
                </button>

                {/* Document List */}
                <div className="mt-2 border-t border-gray-100 pt-2" data-testid="document-list">
                  {documents.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No documents found
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => handleSwitchDocument(doc.id)}
                        className={`flex w-full items-start space-x-2 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                          doc.id === currentDocumentId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                        data-testid="document-item"
                      >
                        <FileText className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{doc.title}</div>
                          <div className="truncate text-xs text-gray-500">
                            {doc.accessLevel} • {new Date(doc.updatedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="flex items-center space-x-4">
          {/* User Email */}
          <span className="text-sm text-gray-600" data-testid="user-menu">
            {session.user?.email}
          </span>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="logout-button"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </header>
  )
}