'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useYjs } from '../providers/YjsProvider'
import { ChevronDown, Plus, LogOut, FileText, Wifi, WifiOff, Users } from 'lucide-react'

interface Document {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  accessLevel: 'read' | 'write' | 'owner'
}

export default function DocumentHeader() {
  const { data: session } = useSession()
  const { currentDocumentId, switchDocument, createDocument, isLoading, isConnected, connectedUsers } = useYjs()
  const [documents, setDocuments] = useState<Document[]>([])
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

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
        console.error('Failed to fetch documents:', error)
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
      console.error('Failed to create document:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleSwitchDocument = async (documentId: string) => {
    try {
      await switchDocument(documentId)
      setShowDropdown(false)
    } catch (error) {
      console.error('Failed to switch document:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/login' })
    } catch (error) {
      console.error('Failed to sign out:', error)
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
          >
            <FileText className="h-4 w-4" />
            <span className="max-w-48 truncate">
              {isLoading ? 'Loading...' : currentDocument?.title || 'Select Document'}
            </span>
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
                <div className="mt-2 border-t border-gray-100 pt-2">
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

        {/* Connection Status and User Info */}
        <div className="flex items-center space-x-4">
          {/* Real-time Sync Status */}
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <div className="flex items-center space-x-1 text-green-600">
                <Wifi className="h-4 w-4" />
                <span className="text-xs font-medium">Live</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-gray-400">
                <WifiOff className="h-4 w-4" />
                <span className="text-xs font-medium">Offline</span>
              </div>
            )}
          </div>

          {/* Connected Users Count */}
          {connectedUsers.size > 0 && (
            <div className="flex items-center space-x-1 text-blue-600">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">
                {connectedUsers.size} {connectedUsers.size === 1 ? 'user' : 'users'}
              </span>
            </div>
          )}

          {/* User Email */}
          <span className="text-sm text-gray-600">
            {session.user?.email}
          </span>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
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