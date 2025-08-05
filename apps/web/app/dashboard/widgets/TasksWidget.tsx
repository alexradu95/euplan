'use client'

import React, { useState, useEffect } from 'react'
import { useDashboard } from '../providers/DashboardProvider'
import { WidgetProps } from '../types/widget'
import BaseWidget from './BaseWidget'
import { WidgetApiService } from '@/lib/services/widget-api'

interface Task {
  id: string
  text: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  createdAt: Date
}

export default function TasksWidget({ widgetId, config, onRemove, onConfigure }: WidgetProps) {
  const { getCurrentPeriodId } = useDashboard()
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskText, setNewTaskText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const periodId = getCurrentPeriodId()

  // Load tasks when period changes
  useEffect(() => {
    const loadTasks = async () => {
      setIsLoading(true)
      try {
        const savedTasks = await WidgetApiService.loadWidgetData(widgetId, periodId)
        if (savedTasks && Array.isArray(savedTasks)) {
          const parsedTasks = savedTasks.map((task: any) => ({
            ...task,
            createdAt: typeof task.createdAt === 'string' ? new Date(task.createdAt) : task.createdAt
          }))
          setTasks(parsedTasks)
        } else {
          setTasks([])
        }
      } catch (error) {
        console.error('Failed to load tasks:', error)
        setTasks([])
      } finally {
        setIsLoading(false)
      }
    }

    loadTasks()
  }, [periodId, widgetId])

  // Save tasks to API
  const saveTasks = async (updatedTasks: Task[]) => {
    try {
      await WidgetApiService.saveWidgetData(widgetId, periodId, updatedTasks)
    } catch (error) {
      console.error('Failed to save tasks:', error)
    }
  }

  // Add new task
  const addTask = () => {
    if (newTaskText.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        text: newTaskText.trim(),
        completed: false,
        priority: 'medium',
        createdAt: new Date()
      }
      const updatedTasks = [newTask, ...tasks]
      setTasks(updatedTasks)
      saveTasks(updatedTasks)
      setNewTaskText('')
    }
  }

  // Toggle task completion
  const toggleTask = (taskId: string) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    )
    setTasks(updatedTasks)
    saveTasks(updatedTasks)
  }

  // Remove task
  const removeTask = (taskId: string) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId)
    setTasks(updatedTasks)
    saveTasks(updatedTasks)
  }

  // Change task priority
  const changePriority = (taskId: string, priority: Task['priority']) => {
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, priority } : task
    )
    setTasks(updatedTasks)
    saveTasks(updatedTasks)
  }

  // Handle enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addTask()
    }
  }

  // Get priority color
  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const completedTasks = tasks.filter(task => task.completed).length
  const totalTasks = tasks.length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <BaseWidget
      widgetId={widgetId}
      config={config}
      isLoading={isLoading}
      onRemove={onRemove}
      onConfigure={onConfigure}
    >
      <div className="p-4 h-full flex flex-col">
        {/* Progress indicator */}
        {totalTasks > 0 && (
          <div className="flex-shrink-0 mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>{completedTasks} of {totalTasks} completed</span>
              <span>{completionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionRate}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Add new task */}
        <div className="flex-shrink-0 mb-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Add a new task..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={addTask}
              disabled={!newTaskText.trim()}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tasks list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400 text-sm text-center">
                No tasks yet.<br />
                Add one above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-lg border group hover:border-gray-300 ${
                    task.completed ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center ${
                        task.completed
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 hover:border-blue-600'
                      }`}
                    >
                      {task.completed && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${
                        task.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                      }`}>
                        {task.text}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <select
                          value={task.priority}
                          onChange={(e) => changePriority(task.id, e.target.value as Task['priority'])}
                          className={`text-xs px-2 py-1 rounded-full border-0 ${getPriorityColor(task.priority)}`}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                        
                        <button
                          onClick={() => removeTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseWidget>
  )
}