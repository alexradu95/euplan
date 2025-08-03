import { renderHook, waitFor } from '@testing-library/react'
import { useDocumentPersistence } from '../useDocumentPersistence'

// Mock fetch
global.fetch = jest.fn()

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user-id' } }
  })
}))

describe('useDocumentPersistence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, savedAt: new Date().toISOString() })
    })
  })

  it('should save document after changes', async () => {
    const content = 'Initial content'
    const documentId = 'test-doc-id'

    const { result } = renderHook(() =>
      useDocumentPersistence(content, documentId, { autoSaveDelay: 100 })
    )

    // Make a change to the document
        // Simulate content change by updating the content
    const { rerender } = renderHook(
      (props) => useDocumentPersistence(props.content, props.documentId, { autoSaveDelay: 100 }),
      { initialProps: { content: 'Initial content', documentId } }
    )

    // Change content to trigger save
    rerender({ content: 'Hello World', documentId })

    // Wait for auto-save
    await waitFor(() => {
      expect(result.current.saveStatus).toBe('saved')
    }, { timeout: 3000 })

    // Verify fetch was called
    expect(fetch).toHaveBeenCalledWith(
      `/api/documents/${documentId}`,
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('content')
      })
    )
  })

  it('should handle save errors gracefully', async () => {
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error'
    })

    const content = 'Test content'
    const documentId = 'test-doc-id'

    const { result } = renderHook(() =>
      useDocumentPersistence(content, documentId, { autoSaveDelay: 100 })
    )

    // Trigger manual save to test error handling
    await result.current.manualSave()

    // Wait for error state
    await waitFor(() => {
      expect(result.current.saveStatus).toBe('error')
    }, { timeout: 3000 })
  })

  it('should support manual save', async () => {
    const content = 'Manual save test'
    const documentId = 'test-doc-id'

    const { result } = renderHook(() =>
      useDocumentPersistence(content, documentId)
    )

    // Trigger manual save
    await result.current.manualSave()

    expect(fetch).toHaveBeenCalled()
    
    await waitFor(() => {
      expect(result.current.saveStatus).toBe('saved')
    })
  })

  it('should track last saved time', async () => {
    const content = 'Test content'
    const documentId = 'test-doc-id'

    const { result } = renderHook(() =>
      useDocumentPersistence(content, documentId, { autoSaveDelay: 100 })
    )

    // Trigger manual save
    await result.current.manualSave()

    await waitFor(() => {
      expect(result.current.lastSaved).toBeInstanceOf(Date)
    }, { timeout: 3000 })
  })
})
