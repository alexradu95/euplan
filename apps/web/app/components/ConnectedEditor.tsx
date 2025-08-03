'use client'

import React from 'react'
import TiptapEditor from './TiptapEditor'
import { useDocumentContext } from '../providers/DocumentProvider'

export default function ConnectedEditor() {
  const { currentDocumentId, content, updateContent, isLoading, title } = useDocumentContext()

  if (!currentDocumentId) {
    return (
      <div className="relative border border-gray-300 rounded-lg p-4 min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome!</h3>
          <p className="text-gray-500">Select a document from the sidebar or create a new one to start writing.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="relative border border-gray-300 rounded-lg p-4 min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading document...</p>
        </div>
      </div>
    )
  }

  return (
    <TiptapEditor
      documentId={currentDocumentId}
      initialContent={content}
      onContentChange={updateContent}
    />
  )
}
