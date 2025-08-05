import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TasksWidget from './TasksWidget'
import { WidgetApiService } from '@/lib/services/widget-api'

// Mock the WidgetApiService
jest.mock('@/lib/services/widget-api')
const mockWidgetApiService = WidgetApiService as jest.Mocked<typeof WidgetApiService>

// Mock the DashboardProvider
const mockUseDashboard = {
  getCurrentPeriodId: jest.fn(() => 'test-period'),
}

jest.mock('../providers/DashboardProvider', () => ({
  useDashboard: () => mockUseDashboard,
}))

// Mock BaseWidget
jest.mock('./BaseWidget', () => {
  return function MockBaseWidget({ children, isLoading }: any) {
    if (isLoading) return <div>Loading...</div>
    return <div data-testid="base-widget">{children}</div>
  }
})

describe('TasksWidget', () => {
  const defaultProps = {
    widgetId: 'test-widget',
    config: { title: 'Tasks' },
    onRemove: jest.fn(),
    onConfigure: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('task loading', () => {
    it('should load existing tasks from API on mount', async () => {
      const mockTasks = [
        {
          id: '1',
          text: 'Test task',
          completed: false,
          priority: 'medium' as const,
          createdAt: new Date().toISOString(),
        },
      ]

      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockTasks)

      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task')).toBeInTheDocument()
      })

      expect(mockWidgetApiService.loadWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period'
      )
    })

    it('should handle empty task list from API', async () => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)

      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/No tasks yet/)).toBeInTheDocument()
      })
    })

    it('should handle API loading errors gracefully', async () => {
      mockWidgetApiService.loadWidgetData.mockRejectedValueOnce(
        new Error('API Error')
      )

      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/No tasks yet/)).toBeInTheDocument()
      })
    })
  })

  describe('task creation', () => {
    beforeEach(() => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)
    })

    it('should add a new task when user types and presses enter', async () => {
      const user = userEvent.setup()
      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a new task...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a new task...')
      await user.type(input, 'New task')
      await user.keyboard('{Enter}')

      expect(screen.getByText('New task')).toBeInTheDocument()
      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        expect.arrayContaining([
          expect.objectContaining({
            text: 'New task',
            completed: false,
            priority: 'medium',
          }),
        ])
      )
    })

    it('should add a new task when user clicks add button', async () => {
      const user = userEvent.setup()
      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a new task...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a new task...')
      const addButton = screen.getByRole('button')

      await user.type(input, 'Another task')
      await user.click(addButton)

      expect(screen.getByText('Another task')).toBeInTheDocument()
      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalled()
    })

    it('should not add empty tasks', async () => {
      const user = userEvent.setup()
      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a new task...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a new task...')
      await user.type(input, '   ')
      await user.keyboard('{Enter}')

      expect(mockWidgetApiService.saveWidgetData).not.toHaveBeenCalled()
    })
  })

  describe('task operations', () => {
    const mockTasks = [
      {
        id: '1',
        text: 'Task 1',
        completed: false,
        priority: 'high' as const,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        text: 'Task 2',
        completed: true,
        priority: 'low' as const,
        createdAt: new Date().toISOString(),
      },
    ]

    beforeEach(() => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockTasks)
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)
    })

    it('should toggle task completion status', async () => {
      const user = userEvent.setup()
      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument()
      })

      const checkboxes = screen.getAllByRole('button')
      const taskCheckbox = checkboxes.find(
        (button) => button.closest('div')?.textContent?.includes('Task 1')
      )

      await user.click(taskCheckbox!)

      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            completed: true,
          }),
        ])
      )
    })

    it('should remove a task when delete button is clicked', async () => {
      const user = userEvent.setup()
      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument()
      })

      // Find the task container and hover to show delete button
      const taskContainer = screen.getByText('Task 1').closest('div')!
      fireEvent.mouseEnter(taskContainer)

      // Find and click the delete button (trash icon)
      const deleteButtons = screen.getAllByRole('button')
      const deleteButton = deleteButtons.find((button) => {
        const svg = button.querySelector('svg path[d*="19 7l"]')
        return svg !== null
      })

      await user.click(deleteButton!)

      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        expect.arrayContaining([
          expect.objectContaining({
            id: '2',
          }),
        ])
      )
      expect(screen.queryByText('Task 1')).not.toBeInTheDocument()
    })

    it('should change task priority', async () => {
      const user = userEvent.setup()
      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument()
      })

      const prioritySelect = screen.getAllByRole('combobox')[0]
      await user.selectOptions(prioritySelect, 'low')

      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            priority: 'low',
          }),
        ])
      )
    })
  })

  describe('progress tracking', () => {
    it('should display correct completion progress', async () => {
      const mockTasks = [
        {
          id: '1',
          text: 'Task 1',
          completed: true,
          priority: 'medium' as const,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          text: 'Task 2',
          completed: false,
          priority: 'medium' as const,
          createdAt: new Date().toISOString(),
        },
      ]

      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockTasks)

      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('1 of 2 completed')).toBeInTheDocument()
        expect(screen.getByText('50%')).toBeInTheDocument()
      })
    })

    it('should not show progress bar when no tasks exist', async () => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)

      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.queryByText(/completed/)).not.toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('should handle API save errors gracefully', async () => {
      const user = userEvent.setup()
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)
      mockWidgetApiService.saveWidgetData.mockRejectedValueOnce(
        new Error('Save failed')
      )

      // Mock console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(<TasksWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a new task...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a new task...')
      await user.type(input, 'Test task')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to save tasks:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })
})