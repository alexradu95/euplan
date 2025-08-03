import { render, screen } from '@testing-library/react'
import DocumentHeader from './DocumentHeader'

// Mock the useYjs hook
jest.mock('../providers/YjsProvider', () => ({
  useYjs: () => ({
    currentDocumentId: 'test-doc',
    saveStatus: 'idle',
    lastSaved: new Date('2024-01-01'),
    saveDocument: jest.fn(),
  }),
}))

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user', name: 'Test User' } },
    status: 'authenticated',
  }),
}))

describe('DocumentHeader', () => {
  it('renders without crashing', () => {
    render(<DocumentHeader />)
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })
})