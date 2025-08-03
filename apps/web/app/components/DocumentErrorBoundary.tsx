'use client'

import React from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import LoadingSpinner from './LoadingSpinner'

interface DocumentErrorBoundaryProps {
  children: React.ReactNode
}

export function DocumentErrorBoundary({ children }: DocumentErrorBoundaryProps) {
  const handleDocumentError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log document-specific error details
    console.error('Document error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    })

    // In a real app, you might send this to an error tracking service
    // trackError('document_error', error, errorInfo)
  }

  const DocumentErrorFallback = (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 border border-gray-300 rounded-lg bg-gray-50">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 text-red-500">
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Document Error
        </h3>
        
        <p className="text-gray-600 mb-6">
          We're having trouble loading your document. This might be due to a 
          network issue or a problem with the document data.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Reload Page
          </button>
          
          <button
            onClick={() => {
              // Clear any cached document data
              if (typeof window !== 'undefined') {
                localStorage.removeItem('documents')
                window.location.reload()
              }
            }}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Clear Cache & Reload
          </button>
        </div>
        
        <p className="text-sm text-gray-500 mt-4">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={DocumentErrorFallback}
      onError={handleDocumentError}
    >
      {children}
    </ErrorBoundary>
  )
}

export default DocumentErrorBoundary