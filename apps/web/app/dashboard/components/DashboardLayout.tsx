'use client'

import React from 'react'
import DashboardHeader from './DashboardHeader'
import PeriodViews from './PeriodViews'
import GridDashboard from './GridDashboard'
import WidgetManager from './WidgetManager'

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <PeriodViews />
            <WidgetManager />
          </div>
          
          <div className="mt-8">
            <GridDashboard />
          </div>
        </div>
      </main>
    </div>
  )
}