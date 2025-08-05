import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PeriodicNoteWidget from './PeriodicNoteWidget'
import { WidgetApiService } from '@/lib/services/widget-api'

// Mock the WidgetApiService
jest.mock('@/lib/services/widget-api')
const mockWidgetApiService = WidgetApiService as jest.Mocked<typeof WidgetApiService>

// Mock the DashboardProvider
const mockUseDashboard = {
  getCurrentPeriodId: jest.fn(() => 'test-period'),
  getCurrentPeriodTitle: jest.fn(() => 'Today, January 1st'),
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

// Mock TiptapEditor
jest.mock('../../components/TiptapEditor', () => {
  return function MockTiptapEditor({ initialContent, onContentChange }: any) {
    return (
      <div data-testid="tiptap-editor">
        <textarea
          data-testid="editor-textarea"
          defaultValue={initialContent}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Start typing..."
        />
      </div>
    )
  }
})

describe('PeriodicNoteWidget', () => {
  const defaultProps = {
    widgetId: 'test-widget',
    config: { title: 'Periodic Note' },
    onRemove: jest.fn(),
    onConfigure: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('note loading', () => {
    it('should load existing note content from API on mount', async () => {
      const mockContent = 'This is my daily note content'
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(mockContent)

      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        const textarea = screen.getByTestId('editor-textarea') as HTMLTextAreaElement
        expect(textarea.value).toBe(mockContent)
      })

      expect(mockWidgetApiService.loadWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period'
      )
    })

    it('should handle empty content from API', async () => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce(null)

      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        const textarea = screen.getByTestId('editor-textarea') as HTMLTextAreaElement
        expect(textarea.value).toBe('')
      })
    })

    it('should handle API loading errors gracefully', async () => {
      mockWidgetApiService.loadWidgetData.mockRejectedValueOnce(
        new Error('API Error')
      )

      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        const textarea = screen.getByTestId('editor-textarea') as HTMLTextAreaElement
        expect(textarea.value).toBe('')
      })
    })
  })

  describe('note saving', () => {
    beforeEach(() => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('')
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)
    })

    it('should save content when user types in editor', async () => {
      const user = userEvent.setup()
      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toBeInTheDocument()
      })

      const textarea = screen.getByTestId('editor-textarea')
      await user.type(textarea, 'New content for my note')

      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        'New content for my note'
      )
    })

    it('should show last saved timestamp', async () => {
      const user = userEvent.setup()
      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toBeInTheDocument()
      })

      const textarea = screen.getByTestId('editor-textarea')
      await user.type(textarea, 'Some content')

      await waitFor(() => {
        expect(screen.getByText(/Saved/)).toBeInTheDocument()
      })
    })
  })

  describe('period information', () => {
    it('should display current period title', async () => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('')

      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Today, January 1st')).toBeInTheDocument()
      })
    })

    it('should show appropriate placeholder for daily period', async () => {
      mockUseDashboard.currentPeriod = 'daily'
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('')

      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/thoughts, plans, and reflections for today/)).toBeInTheDocument()
      })
    })

    it('should show appropriate placeholder for weekly period', async () => {
      mockUseDashboard.currentPeriod = 'weekly'
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('')

      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/goals, priorities, and reflections for this week/)).toBeInTheDocument()
      })
    })

    it('should show appropriate placeholder for monthly period', async () => {
      mockUseDashboard.currentPeriod = 'monthly'
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('')

      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/objectives, themes, and progress for this month/)).toBeInTheDocument()
      })
    })
  })

  describe('editor integration', () => {
    beforeEach(() => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('Initial content')
      mockWidgetApiService.saveWidgetData.mockResolvedValueOnce(undefined)
    })

    it('should pass correct props to TiptapEditor', async () => {
      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument()
      })

      const textarea = screen.getByTestId('editor-textarea') as HTMLTextAreaElement
      expect(textarea.value).toBe('Initial content')
    })

    it('should handle content changes from editor', async () => {
      const user = userEvent.setup()
      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toBeInTheDocument()
      })

      const textarea = screen.getByTestId('editor-textarea')
      await user.clear(textarea)
      await user.type(textarea, 'Updated content')

      expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'test-period',
        'Updated content'
      )
    })
  })

  describe('placeholder behavior', () => {
    it('should show placeholder when content is empty and not loading', async () => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('')

      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/thoughts, plans, and reflections for today/)).toBeInTheDocument()
      })
    })

    it('should hide placeholder when content exists', async () => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('Some existing content')

      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.queryByText(/thoughts, plans, and reflections for today/)).not.toBeInTheDocument()
      })
    })

    it('should hide placeholder when loading', async () => {
      // Mock a slow loading response
      mockWidgetApiService.loadWidgetData.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve(''), 100))
      )

      render(<PeriodicNoteWidget {...defaultProps} />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.queryByText(/thoughts, plans, and reflections for today/)).not.toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('should handle API save errors gracefully', async () => {
      const user = userEvent.setup()
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('')
      mockWidgetApiService.saveWidgetData.mockRejectedValueOnce(
        new Error('Save failed')
      )

      // Mock console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toBeInTheDocument()
      })

      const textarea = screen.getByTestId('editor-textarea')
      await user.type(textarea, 'Test content')

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to save note:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })

    it('should continue working after save errors', async () => {
      const user = userEvent.setup()
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('')
      mockWidgetApiService.saveWidgetData
        .mockRejectedValueOnce(new Error('Save failed'))
        .mockResolvedValueOnce(undefined)

      // Mock console.error to suppress error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('editor-textarea')).toBeInTheDocument()
      })

      const textarea = screen.getByTestId('editor-textarea')
      
      // First save fails
      await user.type(textarea, 'First')
      
      // Second save should work
      await user.type(textarea, ' Second')

      await waitFor(() => {
        expect(mockWidgetApiService.saveWidgetData).toHaveBeenCalledWith(
          'test-widget',
          'test-period',
          'First Second'
        )
      })

      consoleSpy.mockRestore()
    })
  })

  describe('period changes', () => {
    it('should reload content when period changes', async () => {
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('Period 1 content')

      const { rerender } = render(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        const textarea = screen.getByTestId('editor-textarea') as HTMLTextAreaElement
        expect(textarea.value).toBe('Period 1 content')
      })

      // Change period
      mockUseDashboard.getCurrentPeriodId.mockReturnValue('new-period')
      mockWidgetApiService.loadWidgetData.mockResolvedValueOnce('Period 2 content')

      rerender(<PeriodicNoteWidget {...defaultProps} />)

      await waitFor(() => {
        const textarea = screen.getByTestId('editor-textarea') as HTMLTextAreaElement
        expect(textarea.value).toBe('Period 2 content')
      })

      expect(mockWidgetApiService.loadWidgetData).toHaveBeenCalledWith(
        'test-widget',
        'new-period'
      )
    })
  })
})