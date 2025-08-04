'use client'

import { WidgetDefinition } from '../types/widget'
import PeriodicNoteWidget from './PeriodicNoteWidget'
import QuickNotesWidget from './QuickNotesWidget'
import TasksWidget from './TasksWidget'
import HabitsWidget from './HabitsWidget'

// Widget Registry - Add new widgets here
export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    config: {
      id: 'periodic-note',
      type: 'periodic-note',
      title: 'Periodic Note',
      description: 'Rich text editor for daily, weekly, or monthly notes',
      icon: 'edit',
      category: 'notes',
      supportedPeriods: ['daily', 'weekly', 'monthly'],
      defaultLayout: {
        x: 0,
        y: 0,
        w: 8,
        h: 8,
        isDraggable: true,
        isResizable: true
      },
      minDimensions: { w: 4, h: 4 },
      maxDimensions: { w: 12, h: 12 }
    },
    component: PeriodicNoteWidget
  },
  {
    config: {
      id: 'quick-notes',
      type: 'quick-notes',
      title: 'Quick Notes',
      description: 'Simple text notes with timestamps',
      icon: 'sticky-note',
      category: 'notes', 
      supportedPeriods: ['daily', 'weekly', 'monthly'],
      defaultLayout: {
        x: 8,
        y: 0,
        w: 4,
        h: 6,
        isDraggable: true,
        isResizable: true
      },
      minDimensions: { w: 3, h: 4 },
      maxDimensions: { w: 6, h: 8 }
    },
    component: QuickNotesWidget
  },
  {
    config: {
      id: 'tasks',
      type: 'tasks',
      title: 'Tasks',
      description: 'Task list with priorities and due dates',
      icon: 'check-square',
      category: 'productivity',
      supportedPeriods: ['daily', 'weekly', 'monthly'],
      defaultLayout: {
        x: 0,
        y: 8,
        w: 6,
        h: 6,
        isDraggable: true,
        isResizable: true
      },
      minDimensions: { w: 4, h: 4 },
      maxDimensions: { w: 8, h: 10 }
    },
    component: TasksWidget
  },
  {
    config: {
      id: 'habits',
      type: 'habits',
      title: 'Habit Tracker',
      description: 'Track daily habits and streaks',
      icon: 'target',
      category: 'habits',
      supportedPeriods: ['daily', 'weekly', 'monthly'],
      defaultLayout: {
        x: 6,
        y: 8,
        w: 6,
        h: 4,
        isDraggable: true,
        isResizable: true
      },
      minDimensions: { w: 4, h: 3 },
      maxDimensions: { w: 8, h: 6 }
    },
    component: HabitsWidget
  }
]

// Helper functions
export const getWidgetById = (id: string): WidgetDefinition | undefined => {
  return WIDGET_REGISTRY.find(widget => widget.config.id === id)
}

export const getWidgetsByCategory = (category: string): WidgetDefinition[] => {
  return WIDGET_REGISTRY.filter(widget => widget.config.category === category)
}

export const getWidgetsByPeriod = (period: string): WidgetDefinition[] => {
  return WIDGET_REGISTRY.filter(widget => 
    widget.config.supportedPeriods.includes(period as any)
  )
}