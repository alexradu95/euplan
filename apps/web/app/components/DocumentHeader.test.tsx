import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSession } from 'next-auth/react'
import { useYjs } from '../providers/YjsProvider'
import DocumentHeader from './DocumentHeader'

// Mock dependencies
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}))

jest.mock('../providers/YjsProvider', () => ({
  useYjs: jest.fn(),
}))

// Mock fetch globally
global.fetch = jest.fn()

const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
  },
}

const mockYjsContext = {
  currentDocumentId: 'doc-123',
  switchDocument: jest.fn(),
  createDocument: jest.fn(),
  isLoading: false,
  isConnected: true,
  connectedUsers: new Set(['user-123']),
}

const mockDocument = {
  id: 'doc-123',
  title: 'Test Document',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  accessLevel: 'owner' as const,
}

describe('DocumentHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useSession as jest.Mock).mockReturnValue({ data: mockSession })
    ;(useYjs as jest.Mock).mockReturnValue(mockYjsContext)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([mockDocument]),
    })
  })

  describe('Document title editing', () => {
    it('should allow editing document title when clicked', async () => {
      const user = userEvent.setup()
      render(<DocumentHeader />)

      // Wait for component to load and display the document title
      await waitFor(() => {
        expect(screen.getByTestId('document-title')).toHaveTextContent('Test Document')
      })

      // Click on the document title to start editing
      const titleElement = screen.getByTestId('document-title')
      await user.click(titleElement)

      // Should show an input field with the current title
      const titleInput = screen.getByTestId('document-title-input')
      expect(titleInput).toBeInTheDocument()
      expect(titleInput).toHaveValue('Test Document')
    })

    it('should save the new title when Enter is pressed', async () => {
      const user = userEvent.setup()
      
      // Mock the PATCH request for updating title
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([mockDocument]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ message: 'Document updated successfully' }),
        })

      render(<DocumentHeader />)

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('document-title')).toHaveTextContent('Test Document')
      })

      // Click on title to edit
      const titleElement = screen.getByTestId('document-title')
      await user.click(titleElement)

      // Type new title
      const titleInput = screen.getByTestId('document-title-input')
      await user.clear(titleInput)
      await user.type(titleInput, 'New Document Title')

      // Press Enter to save
      await user.keyboard('{Enter}')

      // Should call the API to update the title
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/documents/doc-123',
          expect.objectContaining({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Document Title' }),
          })
        )
      })
    })

    it('should cancel editing when Escape is pressed', async () => {
      const user = userEvent.setup()
      render(<DocumentHeader />)

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('document-title')).toHaveTextContent('Test Document')
      })

      // Click on title to edit
      const titleElement = screen.getByTestId('document-title')
      await user.click(titleElement)

      // Type new title
      const titleInput = screen.getByTestId('document-title-input')
      await user.clear(titleInput)
      await user.type(titleInput, 'New Title')

      // Press Escape to cancel
      await user.keyboard('{Escape}')

      // Should revert to original title and hide input
      expect(screen.queryByTestId('document-title-input')).not.toBeInTheDocument()
      expect(screen.getByTestId('document-title')).toHaveTextContent('Test Document')
    })

    it('should save when clicking outside the input field', async () => {
      const user = userEvent.setup()
      
      // Mock the PATCH request for updating title
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([mockDocument]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ message: 'Document updated successfully' }),
        })

      render(<DocumentHeader />)

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('document-title')).toHaveTextContent('Test Document')
      })

      // Click on title to edit
      const titleElement = screen.getByTestId('document-title')
      await user.click(titleElement)

      // Type new title
      const titleInput = screen.getByTestId('document-title-input')
      await user.clear(titleInput)
      await user.type(titleInput, 'Updated Title')

      // Click outside the input (on the header itself)
      const header = screen.getByRole('banner')
      await user.click(header)

      // Should save the title
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/documents/doc-123',
          expect.objectContaining({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Updated Title' }),
          })
        )
      })
    })

    it('should not allow editing if user has read-only access', async () => {
      const user = userEvent.setup()
      
      const readOnlyDocument = { ...mockDocument, accessLevel: 'read' as const }
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([readOnlyDocument]),
      })

      render(<DocumentHeader />)

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('document-title')).toHaveTextContent('Test Document')
      })

      // Try to click on title - should not become editable
      const titleElement = screen.getByTestId('document-title')
      await user.click(titleElement)

      // Should not show input field
      expect(screen.queryByTestId('document-title-input')).not.toBeInTheDocument()
    })

    it('should show error state if title update fails', async () => {
      const user = userEvent.setup()
      
      // Mock successful initial load, then failed update
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([mockDocument]),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Failed to update' }),
        })

      render(<DocumentHeader />)

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('document-title')).toHaveTextContent('Test Document')
      })

      // Click on title to edit
      const titleElement = screen.getByTestId('document-title')
      await user.click(titleElement)

      // Type new title and save
      const titleInput = screen.getByTestId('document-title-input')
      await user.clear(titleInput)
      await user.type(titleInput, 'New Title')
      await user.keyboard('{Enter}')

      // Should revert to original title on error
      await waitFor(() => {
        expect(screen.getByTestId('document-title')).toHaveTextContent('Test Document')
      })
    })
  })
})