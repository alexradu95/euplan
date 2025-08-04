'use client'

import React, { useState } from 'react'
import { useDashboard } from '../providers/DashboardProvider'
import { WIDGET_REGISTRY } from '../widgets/WidgetRegistry'

export default function WidgetManager() {
  const { addWidget, currentPeriod } = useDashboard()
  const [showAddWidget, setShowAddWidget] = useState(false)

  // Filter widgets that support the current period
  const availableWidgets = WIDGET_REGISTRY.filter(widget =>
    widget.config.supportedPeriods.includes(currentPeriod)
  )

  const handleAddWidget = (widgetType: string) => {
    addWidget(widgetType)
    setShowAddWidget(false)
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      'notes': (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      'productivity': (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      'habits': (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      'analytics': (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      'planning': (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    }
    return icons[category] || icons['notes']
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowAddWidget(!showAddWidget)}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Add Widget</span>
      </button>

      {showAddWidget && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-25 z-40"
            onClick={() => setShowAddWidget(false)}
          />
          
          {/* Widget Selector */}
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add Widget</h3>
                <button
                  onClick={() => setShowAddWidget(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Choose widgets for your {currentPeriod} dashboard
              </p>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              {availableWidgets.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No widgets available for {currentPeriod} view
                </p>
              ) : (
                <div className="space-y-3">
                  {availableWidgets.map(widget => (
                    <button
                      key={widget.config.id}
                      onClick={() => handleAddWidget(widget.config.type)}
                      className="w-full p-3 text-left bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors group"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 group-hover:text-blue-600 group-hover:border-blue-200">
                          {getCategoryIcon(widget.config.category)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-900">
                            {widget.config.title}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {widget.config.description}
                          </p>
                          
                          <div className="flex items-center mt-2 space-x-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              widget.config.category === 'notes' ? 'bg-purple-100 text-purple-800' :
                              widget.config.category === 'productivity' ? 'bg-green-100 text-green-800' :
                              widget.config.category === 'habits' ? 'bg-blue-100 text-blue-800' :
                              widget.config.category === 'analytics' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {widget.config.category}
                            </span>
                            
                            <span className="text-xs text-gray-400">
                              {widget.config.minDimensions.w}×{widget.config.minDimensions.h} min
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0">
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-lg">
              <p className="text-xs text-gray-500">
                Widgets can be moved and resized after adding. Remove widgets using the × button in their header.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}