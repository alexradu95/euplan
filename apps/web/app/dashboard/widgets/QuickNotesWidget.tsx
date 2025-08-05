'use client'

import React, { useState, useEffect } from 'react'
import { useDashboard } from '../providers/DashboardProvider'
import { WidgetProps } from '../types/widget'
import BaseWidget from './BaseWidget'
import { WidgetApiService } from '@/lib/services/widget-api'

interface QuickNote {
  id: string
  text: string
  timestamp: Date
}

export default function QuickNotesWidget({ widgetId, config, onRemove, onConfigure }: WidgetProps) {
  const { getCurrentPeriodId } = useDashboard()
  const [notes, setNotes] = useState<QuickNote[]>([])
  const [newNoteText, setNewNoteText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const periodId = getCurrentPeriodId()

  // Load notes when period changes
  useEffect(() => {
    const loadNotes = async () => {
      setIsLoading(true)
      try {
        const savedNotes = await WidgetApiService.loadWidgetData(widgetId, periodId)
        if (savedNotes && Array.isArray(savedNotes)) {
          const parsedNotes = savedNotes.map((note: any) => ({
            ...note,
            timestamp: typeof note.timestamp === 'string' ? new Date(note.timestamp) : note.timestamp
          }))
          setNotes(parsedNotes)
        } else {
          setNotes([])
        }
      } catch (error) {
        console.error('Failed to load quick notes:', error)
        setNotes([])
      } finally {
        setIsLoading(false)
      }
    }

    loadNotes()
  }, [periodId, widgetId])

  // Save notes to API
  const saveNotes = async (updatedNotes: QuickNote[]) => {
    try {
      await WidgetApiService.saveWidgetData(widgetId, periodId, updatedNotes)
    } catch (error) {
      console.error('Failed to save quick notes:', error)
    }
  }

  // Add new note
  const addNote = () => {
    if (newNoteText.trim()) {
      const newNote: QuickNote = {
        id: Date.now().toString(),
        text: newNoteText.trim(),
        timestamp: new Date()
      }
      const updatedNotes = [newNote, ...notes]
      setNotes(updatedNotes)
      saveNotes(updatedNotes)
      setNewNoteText('')
    }
  }

  // Remove note
  const removeNote = (noteId: string) => {
    const updatedNotes = notes.filter(note => note.id !== noteId)
    setNotes(updatedNotes)
    saveNotes(updatedNotes)
  }

  // Handle enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addNote()
    }
  }

  return (
    <BaseWidget
      widgetId={widgetId}
      config={config}
      isLoading={isLoading}
      onRemove={onRemove}
      onConfigure={onConfigure}
    >
      <div className="p-4 h-full flex flex-col">
        {/* Add new note */}
        <div className="flex-shrink-0 mb-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Add a quick note..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={addNote}
              disabled={!newNoteText.trim()}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400 text-sm text-center">
                No quick notes yet.<br />
                Add one above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200 group hover:border-gray-300"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-gray-900 flex-1 mr-2">{note.text}</p>
                    <button
                      onClick={() => removeNote(note.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {note.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  )
}