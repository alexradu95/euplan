'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { WidgetLayout, WidgetInstance } from '../types/widget'
import { WIDGET_REGISTRY, getWidgetById } from '../widgets/WidgetRegistry'
import { dashboardService } from '@/lib/services/dashboardService'

export type PeriodType = 'daily' | 'weekly' | 'monthly'

interface DashboardState {
  currentPeriod: PeriodType
  currentDate: Date
  widgets: Record<PeriodType, WidgetInstance[]>
  layouts: Record<PeriodType, WidgetLayout[]>
  isLoading: boolean
  error: string | null
}

interface DashboardContextType extends DashboardState {
  setPeriod: (period: PeriodType) => void
  setDate: (date: Date) => void
  navigateDate: (direction: 'prev' | 'next') => void
  getCurrentPeriodId: () => string
  getCurrentPeriodTitle: () => string
  addWidget: (widgetType: string) => void
  removeWidget: (widgetId: string) => void
  updateLayout: (layout: WidgetLayout[]) => void
  getCurrentWidgets: () => WidgetInstance[]
  getCurrentLayout: () => WidgetLayout[]
}

const DashboardContext = createContext<DashboardContextType | null>(null)

// Default widgets for each period
const getDefaultWidgets = (period: PeriodType): WidgetInstance[] => {
  const defaultConfigs = [
    { type: 'periodic-note', x: 0, y: 0, w: 8, h: 8 },
    { type: 'quick-notes', x: 8, y: 0, w: 4, h: 6 },
    { type: 'tasks', x: 0, y: 8, w: 6, h: 6 },
    { type: 'habits', x: 6, y: 8, w: 6, h: 4 }
  ]

  return defaultConfigs.map((config, index) => {
    const widgetDef = getWidgetById(config.type)
    if (!widgetDef) return null
    
    return {
      id: `${config.type}-${period}-${index}`,
      type: config.type,
      layout: {
        i: `${config.type}-${period}-${index}`,
        x: config.x,
        y: config.y,
        w: config.w,
        h: config.h,
        isDraggable: true,
        isResizable: true,
        minW: widgetDef.config.minDimensions.w,
        minH: widgetDef.config.minDimensions.h,
        maxW: widgetDef.config.maxDimensions?.w,
        maxH: widgetDef.config.maxDimensions?.h
      },
      data: {}
    }
  }).filter(Boolean) as WidgetInstance[]
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [state, setState] = useState<DashboardState>(() => ({
    currentPeriod: 'daily' as PeriodType,
    currentDate: new Date(),
    widgets: {
      daily: [],
      weekly: [],
      monthly: []
    },
    layouts: {
      daily: [],
      weekly: [],
      monthly: []
    },
    isLoading: true,
    error: null
  }))

  // Load dashboard state from API when session is available
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      loadDashboardState()
    } else if (status === 'unauthenticated') {
      // Load from localStorage as fallback when not authenticated
      loadFromLocalStorage()
    }
  }, [status, session?.user?.id])

  const loadDashboardState = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      // Load configs for all periods
      const configs = await dashboardService.getDashboardConfigs()
      
      // If no configs exist, create default ones
      if (configs.length === 0) {
        await initializeDefaultDashboard()
        return
      }

      // Load widgets and layouts from configs
      const newState: Partial<DashboardState> = {
        widgets: { daily: [], weekly: [], monthly: [] },
        layouts: { daily: [], weekly: [], monthly: [] }
      }

      for (const config of configs) {
        const period = config.period as PeriodType
        const layout = JSON.parse(config.layout)
        
        newState.layouts![period] = layout
        
        // Convert layout to widget instances
        const widgets = layout.map((layoutItem: WidgetLayout) => {
          const widgetType = layoutItem.i.split('-')[0] // Extract type from id
          return {
            id: layoutItem.i,
            type: widgetType,
            layout: layoutItem,
            data: {}
          }
        })
        
        newState.widgets![period] = widgets
      }

      setState(prev => ({
        ...prev,
        ...newState,
        isLoading: false
      }))
    } catch (error) {
      console.error('Failed to load dashboard state from API:', error)
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load dashboard', 
        isLoading: false 
      }))
      
      // Fallback to localStorage
      loadFromLocalStorage()
    }
  }

  const initializeDefaultDashboard = async () => {
    try {
      const periods: PeriodType[] = ['daily', 'weekly', 'monthly']
      
      for (const period of periods) {
        const defaultWidgets = getDefaultWidgets(period)
        const layout = defaultWidgets.map(w => w.layout)
        
        await dashboardService.saveDashboardConfig({
          period,
          layout: JSON.stringify(layout)
        })
      }
      
      // Reload state after initialization
      await loadDashboardState()
    } catch (error) {
      console.error('Failed to initialize default dashboard:', error)
      // Fall back to localStorage defaults
      loadFromLocalStorage()
    }
  }

  const loadFromLocalStorage = () => {
    try {
      const savedState = dashboardService.loadFromLocalStorage('dashboard-state')
      if (savedState) {
        setState(prev => ({
          ...prev,
          ...savedState,
          currentDate: new Date(savedState.currentDate),
          isLoading: false,
          error: null
        }))
        return
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
    }

    // Initialize with defaults
    const defaultWidgets = {
      daily: getDefaultWidgets('daily'),
      weekly: getDefaultWidgets('weekly'),
      monthly: getDefaultWidgets('monthly')
    }
    
    const defaultLayouts = {
      daily: defaultWidgets.daily.map(w => w.layout),
      weekly: defaultWidgets.weekly.map(w => w.layout),
      monthly: defaultWidgets.monthly.map(w => w.layout)
    }

    setState(prev => ({
      ...prev,
      widgets: defaultWidgets,
      layouts: defaultLayouts,
      isLoading: false
    }))
  }

  // Save state to both API and localStorage
  const saveState = async (newState: Partial<DashboardState>) => {
    setState(prev => ({ ...prev, ...newState }))
    
    // Save to localStorage immediately for offline access
    try {
      const stateToSave = { ...state, ...newState }
      dashboardService.saveToLocalStorage('dashboard-state', stateToSave)
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }

    // Save to API if authenticated
    if (session?.user?.id && newState.layouts) {
      try {
        for (const [period, layout] of Object.entries(newState.layouts)) {
          await dashboardService.saveDashboardConfig({
            period: period as PeriodType,
            layout: JSON.stringify(layout)
          })
        }
      } catch (error) {
        console.error('Failed to save to API:', error)
      }
    }
  }

  const setPeriod = useCallback((period: PeriodType) => {
    setState(prev => ({ ...prev, currentPeriod: period }))
  }, [])

  const setDate = useCallback((date: Date) => {
    setState(prev => ({ ...prev, currentDate: date }))
  }, [])

  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    setState(prev => {
      const newDate = new Date(prev.currentDate)
      
      switch (prev.currentPeriod) {
        case 'daily':
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
          break
        case 'weekly':
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
          break
        case 'monthly':
          newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
          break
      }
      
      return { ...prev, currentDate: newDate }
    })
  }, [])

  const getCurrentPeriodId = useCallback(() => {
    const date = state.currentDate
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    switch (state.currentPeriod) {
      case 'daily':
        return `daily-${year}-${month}-${day}`
      case 'weekly':
        // Get Monday of the week
        const monday = new Date(date)
        monday.setDate(date.getDate() - date.getDay() + 1)
        const weekMonth = String(monday.getMonth() + 1).padStart(2, '0')
        const weekDay = String(monday.getDate()).padStart(2, '0')
        return `weekly-${monday.getFullYear()}-${weekMonth}-${weekDay}`
      case 'monthly':
        return `monthly-${year}-${month}`
      default:
        return `daily-${year}-${month}-${day}`
    }
  }, [state.currentDate, state.currentPeriod])

  const getCurrentPeriodTitle = useCallback(() => {
    const date = state.currentDate
    
    switch (state.currentPeriod) {
      case 'daily':
        return date.toLocaleDateString('en-US', { 
          weekday: 'long',
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      case 'weekly':
        const monday = new Date(date)
        monday.setDate(date.getDate() - date.getDay() + 1)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        return `Week of ${monday.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric' 
        })} - ${sunday.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        })}`
      case 'monthly':
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        })
      default:
        return ''
    }
  }, [state.currentDate, state.currentPeriod])

  // Widget management methods
  const addWidget = useCallback((widgetType: string) => {
    const widgetDef = getWidgetById(widgetType)
    if (!widgetDef) return

    const newId = `${widgetType}-${state.currentPeriod}-${Date.now()}`
    const newWidget: WidgetInstance = {
      id: newId,
      type: widgetType,
      layout: {
        i: newId,
        ...widgetDef.config.defaultLayout,
        minW: widgetDef.config.minDimensions.w,
        minH: widgetDef.config.minDimensions.h,
        maxW: widgetDef.config.maxDimensions?.w,
        maxH: widgetDef.config.maxDimensions?.h
      },
      data: {}
    }

    const newState = {
      widgets: {
        ...state.widgets,
        [state.currentPeriod]: [...state.widgets[state.currentPeriod], newWidget]
      },
      layouts: {
        ...state.layouts,
        [state.currentPeriod]: [...state.layouts[state.currentPeriod], newWidget.layout]
      }
    }

    saveState(newState)
  }, [state.currentPeriod, state.widgets, state.layouts, saveState])

  const removeWidget = useCallback((widgetId: string) => {
    const newState = {
      widgets: {
        ...state.widgets,
        [state.currentPeriod]: state.widgets[state.currentPeriod].filter(w => w.id !== widgetId)
      },
      layouts: {
        ...state.layouts,
        [state.currentPeriod]: state.layouts[state.currentPeriod].filter(l => l.i !== widgetId)
      }
    }

    saveState(newState)
  }, [state.currentPeriod, state.widgets, state.layouts, saveState])

  const updateLayout = useCallback((layout: WidgetLayout[]) => {
    const newState = {
      layouts: {
        ...state.layouts,
        [state.currentPeriod]: layout
      },
      widgets: {
        ...state.widgets,
        [state.currentPeriod]: state.widgets[state.currentPeriod].map(widget => {
          const layoutItem = layout.find(l => l.i === widget.id)
          return layoutItem ? { ...widget, layout: layoutItem } : widget
        })
      }
    }
    
    saveState(newState)
  }, [state.currentPeriod, state.layouts, state.widgets, saveState])

  const getCurrentWidgets = useCallback(() => {
    return state.widgets[state.currentPeriod] || []
  }, [state.widgets, state.currentPeriod])

  const getCurrentLayout = useCallback(() => {
    return state.layouts[state.currentPeriod] || []
  }, [state.layouts, state.currentPeriod])

  const contextValue: DashboardContextType = {
    ...state,
    setPeriod,
    setDate,
    navigateDate,
    getCurrentPeriodId,
    getCurrentPeriodTitle,
    addWidget,
    removeWidget,
    updateLayout,
    getCurrentWidgets,
    getCurrentLayout
  }

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider')
  }
  return context
}