'use client'

import React from 'react'
import { useDashboard, type PeriodType } from '../providers/DashboardProvider'

const periodButtons: { type: PeriodType; label: string }[] = [
  { type: 'daily', label: 'Daily' },
  { type: 'weekly', label: 'Weekly' },
  { type: 'monthly', label: 'Monthly' }
]

export default function PeriodViews() {
  const { currentPeriod, setPeriod } = useDashboard()

  return (
    <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
      <div className="flex items-center space-x-1">
        <svg className="w-4 h-4 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-medium text-gray-700">Planning Views</span>
      </div>
      
      <div className="flex items-center space-x-1 ml-4">
        {periodButtons.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => setPeriod(type)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              currentPeriod === type
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
        
        {/* Future period buttons - disabled for now */}
        <button 
          disabled
          className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-400 cursor-not-allowed"
        >
          Quarterly
        </button>
        <button 
          disabled
          className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-400 cursor-not-allowed"
        >
          Yearly
        </button>
        <button 
          disabled
          className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-400 cursor-not-allowed flex items-center"
        >
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          5 Year
        </button>
      </div>
    </div>
  )
}