import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HabitsWidget from './HabitsWidget'
import { WidgetApiService } from '@/lib/services/widget-api'

// Mock the WidgetApiService
jest.mock('@/lib/services/widget-api')
const mockWidgetApiService = WidgetApiService as jest.Mocked<typeof WidgetApiService>

// Mock the DashboardProvider
const mockUseDashboard = {
  getCurrentPeriodId: jest.fn(() => 'test-period'),
  currentPeriod: 'daily',
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

describe('HabitsWidget', () => {
  const defaultProps = {
    widgetId: 'test-widget',
    config: { title: 'Habits' },
    onRemove: jest.fn(),
    onConfigure: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseDashboard.currentPeriod = 'daily'
  })

  describe('habit loading', () => {
    it('should load existing habits from API on mount', async () => {
      const mockHabits = [
        {
          id: '1',
          name: 'Water',
          target: 8,
          unit: 'glasses',
          current: 3,
          color: '#3B82F6',
        },
      ]

      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockHabits)

      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Water')).toBeInTheDocument()
        expect(screen.getByText('3 / 8 glasses')).toBeInTheDocument()
      })

      expect(mockWidgetApiService.loadWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period'
      )
    })

    it('should use default habits when no data exists', async () => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)

      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Water (glasses)')).toBeInTheDocument()
        expect(screen.getByText('Exercise')).toBeInTheDocument()
        expect(screen.getByText('Reading')).toBeInTheDocument()
      })

      // Should save default habits to API
      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        expect.arrayContaining([
          expect.objectContaining({ name: 'Water (glasses)' }),
          expect.objectContaining({ name: 'Exercise' }),
          expect.objectContaining({ name: 'Reading' }),
        ])
      )
    })

    it('should handle API loading errors gracefully', async () => {
      mockWidgetApiService.loadWidgetData.mockRejectedValueOnce(
        new Error('API Error')
      )

      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/No habits tracked yet/)).toBeInTheDocument()
      })
    })
  })

  describe('habit progress tracking', () => {
    const mockHabits = [
      {
        id: '1',
        name: 'Water',
        target: 8,
        unit: 'glasses',
        current: 4,
        color: '#3B82F6',
      },
    ]

    beforeEach(() => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockHabits)
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)
    })

    it('should increment habit progress when plus button is clicked', async () => {
      const user = userEvent.setup()
      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('4 / 8 glasses')).toBeInTheDocument()
      })

      const plusButton = screen.getByRole('button', { name: /increment/i })
      await user.click(plusButton)

      expect(screen.getByText('5 / 8 glasses')).toBeInTheDocument()
      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            current: 5,
          }),
        ])
      )
    })

    it('should decrement habit progress when minus button is clicked', async () => {
      const user = userEvent.setup()
      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('4 / 8 glasses')).toBeInTheDocument()
      })

      const minusButton = screen.getByRole('button', { name: /decrement/i })
      await user.click(minusButton)

      expect(screen.getByText('3 / 8 glasses')).toBeInTheDocument()
      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            current: 3,
          }),
        ])
      )
    })

    it('should not allow negative progress', async () => {
      const mockHabitsZero = [
        {
          id: '1',
          name: 'Water',
          target: 8,
          unit: 'glasses',
          current: 0,
          color: '#3B82F6',
        },
      ]

      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockHabitsZero)

      const user = userEvent.setup()
      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('0 / 8 glasses')).toBeInTheDocument()
      })

      const minusButton = screen.getByRole('button', { name: /decrement/i })
      expect(minusButton).toBeDisabled()
    })

    it('should show completion status when target is reached', async () => {
      const completedHabits = [
        {
          id: '1',
          name: 'Water',
          target: 8,
          unit: 'glasses',
          current: 8,
          color: '#3B82F6',
        },
      ]

      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(completedHabits)

      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Water ✓')).toBeInTheDocument()
        expect(screen.getByText('100% complete')).toBeInTheDocument()
      })
    })
  })

  describe('habit management', () => {
    beforeEach(() => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)
    })

    it('should show add habit form when add button is clicked', async () => {
      const user = userEvent.setup()
      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('+ Add Habit')).toBeInTheDocument()
      })

      await user.click(screen.getByText('+ Add Habit'))

      expect(screen.getByPlaceholderText('Habit name...')).toBeInTheDocument()
      expect(screen.getByDisplayValue('1')).toBeInTheDocument() // target input
      expect(screen.getByDisplayValue('times')).toBeInTheDocument() // unit input
    })

    it('should add a new habit when form is submitted', async () => {
      const user = userEvent.setup()
      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('+ Add Habit')).toBeInTheDocument()
      })

      await user.click(screen.getByText('+ Add Habit'))

      const nameInput = screen.getByPlaceholderText('Habit name...')
      const targetInput = screen.getByDisplayValue('1')
      const unitInput = screen.getByDisplayValue('times')

      await user.clear(nameInput)
      await user.type(nameInput, 'Meditation')
      await user.clear(targetInput)
      await user.type(targetInput, '30')
      await user.clear(unitInput)
      await user.type(unitInput, 'minutes')

      await user.click(screen.getByText('Add'))

      expect(screen.getByText('Meditation')).toBeInTheDocument()
      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Meditation',
            target: 30,
            unit: 'minutes',
            current: 0,
          }),
        ])
      )
    })

    it('should cancel habit creation when cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('+ Add Habit')).toBeInTheDocument()
      })

      await user.click(screen.getByText('+ Add Habit'))
      expect(screen.getByPlaceholderText('Habit name...')).toBeInTheDocument()

      await user.click(screen.getByText('Cancel'))
      expect(screen.queryByPlaceholderText('Habit name...')).not.toBeInTheDocument()
      expect(screen.getByText('+ Add Habit')).toBeInTheDocument()
    })

    it('should remove a habit when delete button is clicked', async () => {
      const mockHabits = [
        {
          id: '1',
          name: 'Water',
          target: 8,
          unit: 'glasses',
          current: 4,
          color: '#3B82F6',
        },
      ]

      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockHabits)
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)

      const user = userEvent.setup()
      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Water')).toBeInTheDocument()
      })

      // Find the habit container and hover to show delete button
      const habitContainer = screen.getByText('Water').closest('div')!
      fireEvent.mouseEnter(habitContainer)

      // Find and click the delete button (X icon)
      const deleteButtons = screen.getAllByRole('button')
      const deleteButton = deleteButtons.find((button) => {
        const svg = button.querySelector('svg path[d*="6 18L18 6M6 6l12 12"]')
        return svg !== null
      })

      await user.click(deleteButton!)

      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        []
      )
      expect(screen.queryByText('Water')).not.toBeInTheDocument()
    })
  })

  describe('period-specific defaults', () => {
    it('should show weekly habits for weekly period', async () => {
      mockUseDashboard.currentPeriod = 'weekly'
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)

      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Gym Sessions')).toBeInTheDocument()
        expect(screen.getByText('Books Read')).toBeInTheDocument()
        expect(screen.getByText('Social Activities')).toBeInTheDocument()
      })
    })

    it('should show monthly habits for monthly period', async () => {
      mockUseDashboard.currentPeriod = 'monthly'
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)

      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('New Skills Learned')).toBeInTheDocument()
        expect(screen.getByText('Books Completed')).toBeInTheDocument()
        expect(screen.getByText('Networking Events')).toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('should handle API save errors gracefully', async () => {
      const mockHabits = [
        {
          id: '1',
          name: 'Water',
          target: 8,
          unit: 'glasses',
          current: 4,
          color: '#3B82F6',
        },
      ]

      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockHabits)
      mockWidgetApiService.saveWidgetData.mockRejectedValueOnce(
        new Error('Save failed')
      )

      // Mock console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const user = userEvent.setup()
      render(<HabitsWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('4 / 8 glasses')).toBeInTheDocument()
      })

      const plusButton = screen.getByRole('button', { name: /increment/i })
      await user.click(plusButton)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to save habits:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })
})