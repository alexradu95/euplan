'use client'

import React, { useState, useEffect } from 'react'
import { useDashboard } from '../providers/DashboardProvider'
import { WidgetProps } from '../types/widget'
import BaseWidget from './BaseWidget'
import TiptapEditor from '../../components/TiptapEditor'
import { WidgetApiService } from '@/lib/services/widget-api'

export default function PeriodicNoteWidget({ widgetId, config, onRemove, onConfigure }: WidgetProps) {
  const { currentPeriod, getCurrentPeriodId, getCurrentPeriodTitle } = useDashboard()
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const periodId = getCurrentPeriodId()
  const periodTitle = getCurrentPeriodTitle()

  // Load note content when period changes
  useEffect(() => {
    const loadNote = async () => {
      setIsLoading(true)
      try {
        const savedContent = await WidgetApiService.loadWidgetData(widgetId, periodId)
        setContent(savedContent || '')
      } catch (error) {
        console.error('Failed to load note:', error)
        setContent('')
      } finally {
        setIsLoading(false)
      }
    }

    loadNote()
  }, [periodId, widgetId])

  // Save note content
  const handleContentChange = async (newContent: string) => {
    setContent(newContent)
    
    try {
      await WidgetApiService.saveWidgetData(widgetId, periodId, newContent)
      setLastSaved(new Date())
    } catch (error) {
      console.error('Failed to save note:', error)
    }
  }

  // Get placeholder text based on period
  const getPlaceholderText = () => {
    switch (currentPeriod) {
      case 'daily':
        return 'What are your thoughts, plans, and reflections for today?'
      case 'weekly':
        return 'What are your goals, priorities, and reflections for this week?'
      case 'monthly':
        return 'What are your objectives, themes, and progress for this month?'
      default:
        return 'Start writing your notes...'
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
        {/* Period Info */}
        <div className="mb-4 flex-shrink-0">
          <p className="text-sm text-gray-600">
            {periodTitle}
          </p>
          {lastSaved && (
            <p className="text-xs text-gray-500 mt-1">
              Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0">
          {content === '' && !isLoading ? (
            <div className="relative h-full">
              <div className="absolute inset-0 flex items-start justify-start pt-4 pl-4 pointer-events-none z-10">
                <p className="text-gray-400 text-base">
                  {getPlaceholderText()}
                </p>
              </div>
              <div className="h-full">
                <TiptapEditor
                  documentId={`${widgetId}-${periodId}`}
                  initialContent={content}
                  onContentChange={handleContentChange}
                />
              </div>
            </div>
          ) : (
            <div className="h-full">
              <TiptapEditor
                documentId={`${widgetId}-${periodId}`}
                initialContent={content}
                onContentChange={handleContentChange}
              />
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  )
}