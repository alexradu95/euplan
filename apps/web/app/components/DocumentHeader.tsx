'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useYjs } from '../providers/YjsProvider'
import { ChevronDown, LogOut, Check, Loader, AlertCircle, Save } from 'lucide-react'

export default function DocumentHeader() {
  const { data: session } = useSession()
  const { saveStatus, lastSaved, manualSave } = useYjs()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Document Title */}
        <div className="flex items-center space-x-4">
          {isEditingTitle ? (
            <input
              type="text"
              defaultValue="My Document"
              className="text-lg font-semibold bg-transparent border-none outline-none focus:bg-gray-50 px-2 py-1 rounded"
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingTitle(false)
                }
              }}
              autoFocus
            />
          ) : (
            <h1
              className="text-lg font-semibold cursor-pointer hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-50"
              onClick={() => setIsEditingTitle(true)}
            >
              My Document
            </h1>
          )}
        </div>

        {/* Save Status and User Menu */}
        <div className="flex items-center space-x-4">
          {/* Save Status Indicator */}
          <div className="flex items-center space-x-2">
            {saveStatus === 'saving' && (
              <div className="flex items-center space-x-1 text-blue-600">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-sm">Saving...</span>
              </div>
            )}
            
            {saveStatus === 'saved' && lastSaved && (
              <div className="flex items-center space-x-1 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-sm">
                  Saved {formatRelativeTime(lastSaved)}
                </span>
              </div>
            )}
            
            {saveStatus === 'error' && (
              <div className="flex items-center space-x-1 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Save failed</span>
              </div>
            )}
            
            {saveStatus === 'idle' && (
              <span className="text-sm text-gray-500">Ready</span>
            )}
          </div>

          {/* Manual Save Button */}
          <button
            onClick={() => manualSave()}
            disabled={saveStatus === 'saving'}
            className="flex items-center space-x-1 px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            <span>Save</span>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800"
              data-testid="user-menu"
            >
              <span>{session?.user?.email}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => signOut()}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
