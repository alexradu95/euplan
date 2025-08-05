import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuickNotesWidget from './QuickNotesWidget'
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

describe('QuickNotesWidget', () => {
  const defaultProps = {
    widgetId: 'test-widget',
    config: { title: 'Quick Notes' },
    onRemove: jest.fn(),
    onConfigure: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('note loading', () => {
    it('should load existing notes from API on mount', async () => {
      const mockNotes = [
        {
          id: '1',
          text: 'Test note',
          timestamp: new Date().toISOString(),
        },
      ]

      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockNotes)

      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test note')).toBeInTheDocument()
      })

      expect(mockWidgetApiService.loadWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period'
      )
    })

    it('should handle empty note list from API', async () => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)

      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/No quick notes yet/)).toBeInTheDocument()
      })
    })

    it('should handle API loading errors gracefully', async () => {
      mockWidgetApiService.loadWidgetData.mockRejectedValueOnce(
        new Error('API Error')
      )

      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/No quick notes yet/)).toBeInTheDocument()
      })
    })
  })

  describe('note creation', () => {
    beforeEach(() => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)
    })

    it('should add a new note when user types and presses enter', async () => {
      const user = userEvent.setup()
      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a quick note...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a quick note...')
      await user.type(input, 'New quick note')
      await user.keyboard('{Enter}')

      expect(screen.getByText('New quick note')).toBeInTheDocument()
      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        expect.arrayContaining([
          expect.objectContaining({
            text: 'New quick note',
          }),
        ])
      )
    })

    it('should add a new note when user clicks add button', async () => {
      const user = userEvent.setup()
      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a quick note...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a quick note...')
      const addButton = screen.getByRole('button')

      await user.type(input, 'Another note')
      await user.click(addButton)

      expect(screen.getByText('Another note')).toBeInTheDocument()
      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalled()
    })

    it('should not add empty notes', async () => {
      const user = userEvent.setup()
      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a quick note...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a quick note...')
      await user.type(input, '   ')
      await user.keyboard('{Enter}')

      expect(mockWidgetApiService.saveWidgetData).not.toHaveBeenCalled()
    })

    it('should clear input after adding a note', async () => {
      const user = userEvent.setup()
      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a quick note...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a quick note...') as HTMLInputElement
      await user.type(input, 'Test note')
      await user.keyboard('{Enter}')

      expect(input.value).toBe('')
    })
  })

  describe('note operations', () => {
    const mockNotes = [
      {
        id: '1',
        text: 'First note',
        timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
      },
      {
        id: '2',
        text: 'Second note',
        timestamp: new Date('2024-01-01T11:00:00Z').toISOString(),
      },
    ]

    beforeEach(() => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockNotes)
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)
    })

    it('should remove a note when delete button is clicked', async () => {
      const user = userEvent.setup()
      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('First note')).toBeInTheDocument()
      })

      // Find the note container and hover to show delete button
      const noteContainer = screen.getByText('First note').closest('div')!
      fireEvent.mouseEnter(noteContainer)

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
        expect.arrayContaining([
          expect.objectContaining({
            id: '2',
            text: 'Second note',
          }),
        ])
      )
      expect(screen.queryByText('First note')).not.toBeInTheDocument()
    })

    it('should display note timestamps correctly', async () => {
      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('First note')).toBeInTheDocument()
      })

      // Check that timestamps are displayed (exact format may vary)
      const timestampElements = screen.getAllByText(/Jan|10:|11:/)
      expect(timestampElements.length).toBeGreaterThan(0)
    })
  })

  describe('note ordering', () => {
    it('should display notes with newest first', async () => {
      const mockNotes = [
        {
          id: '1',
          text: 'Older note',
          timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
        },
        {
          id: '2',
          text: 'Newer note',
          timestamp: new Date('2024-01-01T11:00:00Z').toISOString(),
        },
      ]

      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockNotes)

      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Newer note')).toBeInTheDocument()
      })

      const noteTexts = screen.getAllByText(/note$/)
      expect(noteTexts[0]).toHaveTextContent('Newer note')
      expect(noteTexts[1]).toHaveTextContent('Older note')
    })

    it('should add new notes to the top of the list', async () => {
      const user = userEvent.setup()
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce([
        {
          id: '1',
          text: 'Existing note',
          timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
        },
      ])
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)

      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Existing note')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a quick note...')
      await user.type(input, 'New note')
      await user.keyboard('{Enter}')

      const noteTexts = screen.getAllByText(/note$/)
      expect(noteTexts[0]).toHaveTextContent('New note')
      expect(noteTexts[1]).toHaveTextContent('Existing note')
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

      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a quick note...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a quick note...')
      await user.type(input, 'Test note')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to save quick notes:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })

  describe('keyboard shortcuts', () => {
    beforeEach(() => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)
    })

    it('should not add note when Shift+Enter is pressed', async () => {
      const user = userEvent.setup()
      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a quick note...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a quick note...')
      await user.type(input, 'Test note')
      await user.keyboard('{Shift>}{Enter}{/Shift}')

      expect(mockWidgetApiService.saveWidgetData).not.toHaveBeenCalled()
    })

    it('should add note when Enter is pressed without Shift', async () => {
      const user = userEvent.setup()
      render(<QuickNotesWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a quick note...')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Add a quick note...')
      await user.type(input, 'Test note')
      await user.keyboard('{Enter}')

      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalled()
    })
  })
})