import { renderHook, waitFor } from '@testing-library/react'
import { useDocumentPersistence } from '../useDocumentPersistence'
import * as Y from 'yjs'

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
    const doc = new Y.Doc()
    const documentId = 'test-doc-id'

    const { result } = renderHook(() =>
      useDocumentPersistence(doc, documentId, { autoSaveDelay: 100 })
    )

    // Make a change to the document
    doc.getText().insert(0, 'Hello World')

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

    const doc = new Y.Doc()
    const documentId = 'test-doc-id'

    const { result } = renderHook(() =>
      useDocumentPersistence(doc, documentId, { autoSaveDelay: 100 })
    )

    // Make a change
    doc.getText().insert(0, 'Test')

    // Wait for error state
    await waitFor(() => {
      expect(result.current.saveStatus).toBe('error')
    }, { timeout: 3000 })
  })

  it('should support manual save', async () => {
    const doc = new Y.Doc()
    const documentId = 'test-doc-id'

    const { result } = renderHook(() =>
      useDocumentPersistence(doc, documentId)
    )

    doc.getText().insert(0, 'Manual save test')

    // Trigger manual save
    await result.current.manualSave()

    expect(fetch).toHaveBeenCalled()
    expect(result.current.saveStatus).toBe('saved')
  })

  it('should track last saved time', async () => {
    const doc = new Y.Doc()
    const documentId = 'test-doc-id'
    const mockSavedTime = new Date('2024-01-01T00:00:00Z')

    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, savedAt: mockSavedTime.toISOString() })
    })

    const { result } = renderHook(() =>
      useDocumentPersistence(doc, documentId, { autoSaveDelay: 100 })
    )

    doc.getText().insert(0, 'Test content')

    await waitFor(() => {
      expect(result.current.lastSaved).toEqual(mockSavedTime)
    }, { timeout: 3000 })
  })
})
