import { ComponentType } from 'react'
import { PeriodType } from '../providers/DashboardProvider'

export interface WidgetLayout {
  i: string // unique widget id
  x: number
  y: number
  w: number // width in grid units
  h: number // height in grid units
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  isDraggable?: boolean
  isResizable?: boolean
}

export interface WidgetConfig {
  id: string
  type: string
  title: string
  description: string
  icon?: string
  category: 'productivity' | 'notes' | 'planning' | 'analytics' | 'habits'
  supportedPeriods: PeriodType[]
  defaultLayout: Omit<WidgetLayout, 'i'>
  minDimensions: { w: number; h: number }
  maxDimensions?: { w: number; h: number }
}

export interface WidgetProps {
  widgetId: string
  config: WidgetConfig
  onRemove?: (widgetId: string) => void
  onConfigure?: (widgetId: string) => void
}

export interface WidgetDefinition {
  config: WidgetConfig
  component: ComponentType<WidgetProps>
}

export interface DashboardState {
  widgets: WidgetLayout[]
  availableWidgets: WidgetDefinition[]
  periodLayouts: Record<PeriodType, WidgetLayout[]>
}

export interface WidgetData {
  [key: string]: any
}

export interface WidgetInstance {
  id: string
  type: string
  layout: WidgetLayout
  data: WidgetData
}