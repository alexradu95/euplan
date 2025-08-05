'use client'

import React, { useState, useEffect } from 'react'
import { useDashboard } from '../providers/DashboardProvider'
import { WidgetProps } from '../types/widget'
import BaseWidget from './BaseWidget'
import { WidgetApiService } from '@/lib/services/widget-api'

interface Habit {
  id: string
  name: string
  target: number
  unit: string
  current: number
  color: string
}

export default function HabitsWidget({ widgetId, config, onRemove, onConfigure }: WidgetProps) {
  const { getCurrentPeriodId, currentPeriod } = useDashboard()
  const [habits, setHabits] = useState<Habit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newHabit, setNewHabit] = useState({
    name: '',
    target: 1,
    unit: 'times',
    color: '#3B82F6'
  })

  const periodId = getCurrentPeriodId()

  // Default habits for different periods
  const getDefaultHabits = (): Habit[] => {
    switch (currentPeriod) {
      case 'daily':
        return [
          { id: '1', name: 'Water (glasses)', target: 8, unit: 'glasses', current: 0, color: '#3B82F6' },
          { id: '2', name: 'Exercise', target: 30, unit: 'minutes', current: 0, color: '#10B981' },
          { id: '3', name: 'Reading', target: 20, unit: 'minutes', current: 0, color: '#8B5CF6' }
        ]
      case 'weekly':
        return [
          { id: '1', name: 'Gym Sessions', target: 3, unit: 'sessions', current: 0, color: '#10B981' },
          { id: '2', name: 'Books Read', target: 1, unit: 'books', current: 0, color: '#8B5CF6' },
          { id: '3', name: 'Social Activities', target: 2, unit: 'activities', current: 0, color: '#F59E0B' }
        ]
      case 'monthly':
        return [
          { id: '1', name: 'New Skills Learned', target: 1, unit: 'skills', current: 0, color: '#8B5CF6' },
          { id: '2', name: 'Books Completed', target: 2, unit: 'books', current: 0, color: '#10B981' },
          { id: '3', name: 'Networking Events', target: 4, unit: 'events', current: 0, color: '#F59E0B' }
        ]
      default:
        return []
    }
  }

  // Load habits when period changes
  useEffect(() => {
    const loadHabits = async () => {
      setIsLoading(true)
      try {
        const savedHabits = await WidgetApiService.loadWidgetData(widgetId, periodId)
        if (savedHabits && Array.isArray(savedHabits)) {
          setHabits(savedHabits)
        } else {
          // Use default habits for new periods
          const defaultHabits = getDefaultHabits()
          setHabits(defaultHabits)
          if (defaultHabits.length > 0) {
            await WidgetApiService.saveWidgetData(widgetId, periodId, defaultHabits)
          }
        }
      } catch (error) {
        console.error('Failed to load habits:', error)
        setHabits([])
      } finally {
        setIsLoading(false)
      }
    }

    loadHabits()
  }, [periodId, widgetId, currentPeriod])

  // Save habits to API
  const saveHabits = async (updatedHabits: Habit[]) => {
    try {
      await WidgetApiService.saveWidgetData(widgetId, periodId, updatedHabits)
      setHabits(updatedHabits)
    } catch (error) {
      console.error('Failed to save habits:', error)
    }
  }

  // Update habit progress
  const updateHabitProgress = (habitId: string, change: number) => {
    const updatedHabits = habits.map(habit => {
      if (habit.id === habitId) {
        const newCurrent = Math.max(0, habit.current + change)
        return { ...habit, current: newCurrent }
      }
      return habit
    })
    saveHabits(updatedHabits)
  }

  // Add new habit
  const addHabit = () => {
    if (newHabit.name.trim()) {
      const habit: Habit = {
        id: Date.now().toString(),
        name: newHabit.name.trim(),
        target: newHabit.target,
        unit: newHabit.unit,
        current: 0,
        color: newHabit.color
      }
      const updatedHabits = [...habits, habit]
      saveHabits(updatedHabits)
      setNewHabit({ name: '', target: 1, unit: 'times', color: '#3B82F6' })
      setShowAddForm(false)
    }
  }

  // Remove habit
  const removeHabit = (habitId: string) => {
    const updatedHabits = habits.filter(habit => habit.id !== habitId)
    saveHabits(updatedHabits)
  }

  // Get progress percentage
  const getProgressPercentage = (habit: Habit) => {
    return Math.min(100, Math.round((habit.current / habit.target) * 100))
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
        {/* Add habit button */}
        <div className="flex-shrink-0 mb-4">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
            >
              + Add Habit
            </button>
          ) : (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="text"
                value={newHabit.name}
                onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                placeholder="Habit name..."
                className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={newHabit.target}
                  onChange={(e) => setNewHabit({ ...newHabit, target: parseInt(e.target.value) || 1 })}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
                <input
                  type="text"
                  value={newHabit.unit}
                  onChange={(e) => setNewHabit({ ...newHabit, unit: e.target.value })}
                  placeholder="unit"
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="color"
                  value={newHabit.color}
                  onChange={(e) => setNewHabit({ ...newHabit, color: e.target.value })}
                  className="w-8 h-7 border border-gray-300 rounded cursor-pointer"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={addHabit}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Habits list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {habits.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400 text-sm text-center">
                No habits tracked yet.<br />
                Add one above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {habits.map((habit) => {
                const progressPercentage = getProgressPercentage(habit)
                const isCompleted = habit.current >= habit.target
                
                return (
                  <div
                    key={habit.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 group hover:border-gray-300"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`text-sm font-medium ${isCompleted ? 'text-green-700' : 'text-gray-900'}`}>
                        {habit.name}
                        {isCompleted && (
                          <span className="ml-2 text-green-600">✓</span>
                        )}
                      </h4>
                      <button
                        onClick={() => removeHabit(habit.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center space-x-2 mb-2">
                      <button
                        onClick={() => updateHabitProgress(habit.id, -1)}
                        disabled={habit.current <= 0}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      
                      <span className="flex-1 text-center text-sm font-medium">
                        {habit.current} / {habit.target} {habit.unit}
                      </span>
                      
                      <button
                        onClick={() => updateHabitProgress(habit.id, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${progressPercentage}%`,
                          backgroundColor: habit.color
                        }}
                      ></div>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      {progressPercentage}% complete
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  )
}