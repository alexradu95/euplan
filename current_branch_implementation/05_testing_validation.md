# Phase 5: Testing & Validation
**Timeline:** Day 3 Afternoon (3 hours)
**Goal:** Update test suite and validate all functionality works

## Step 5.1: Clean Up Test Files (45 minutes)

### 5.1.1 Remove Collaboration Tests
```bash
cd apps/web

# Find and remove collaboration-related tests
find . -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" | xargs grep -l "collaboration\|websocket\|socket\.io" | head -10

# Common files to remove or clean:
rm tests/collaboration.test.ts
rm tests/websocket.test.ts
rm tests/realtime-sync.test.ts
rm components/__tests__/CollaborationIndicator.test.tsx
rm components/__tests__/UserPresence.test.tsx
```

### 5.1.2 Update Existing Test Files
Look for collaboration imports and logic in remaining tests:

```bash
# Find tests that might need updating
grep -r "useWebSocket\|CollaborationCursor\|y-websocket" tests/ components/__tests__/
```

**Update test files to remove:**
- WebSocket mocking
- Collaboration extension testing
- Multi-user scenarios
- Real-time sync testing

## Step 5.2: Create New Simplified Tests (90 minutes)

### 5.2.1 Test Document Persistence Hook
**File:** `apps/web/hooks/__tests__/useDocumentPersistence.test.ts`

```typescript
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
      json: () => Promise.resolve({ success: true })
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
      `/api/documents/${documentId}/autosave`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('encryptedContent')
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
})
```

### 5.2.2 Test YjsProvider
**File:** `apps/web/providers/__tests__/YjsProvider.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { YjsProvider, useYjs } from '../YjsProvider'
import { SessionProvider } from 'next-auth/react'

// Mock next-auth
const mockSession = {
  user: { id: 'test-user', email: 'test@example.com' }
}

// Mock fetch
global.fetch = jest.fn()

// Test component that uses YjsProvider
function TestComponent() {
  const { doc, currentDocumentId, isLoading, switchDocument } = useYjs()

  if (isLoading) return <div>Loading...</div>
  if (!doc) return <div>No document</div>

  return (
    <div>
      <div data-testid="document-id">{currentDocumentId}</div>
      <button onClick={() => switchDocument('new-doc-id')}>
        Switch Document
      </button>
    </div>
  )
}

describe('YjsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'test-doc',
        title: 'Test Document',
        encryptedContent: ''
      })
    })
  })

  it('should provide document context', async () => {
    render(
      <SessionProvider session={mockSession}>
        <YjsProvider>
          <TestComponent />
        </YjsProvider>
      </SessionProvider>
    )

    expect(screen.getByText('No document')).toBeInTheDocument()
  })

  it('should load document when switching', async () => {
    render(
      <SessionProvider session={mockSession}>
        <YjsProvider>
          <TestComponent />
        </YjsProvider>
      </SessionProvider>
    )

    const switchButton = screen.getByText('Switch Document')
    switchButton.click()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/documents/new-doc-id')
    })
  })
})
```

### 5.2.3 Test API Routes
**File:** `apps/web/app/api/documents/__tests__/route.test.ts`

```typescript
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// Mock dependencies
jest.mock('@/lib/auth')
jest.mock('@/lib/db')

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn(),
}

Object.assign(db, mockDb)

describe('/api/documents', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return user documents', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'test-user-id' }
      } as any)

      mockDb.returning.mockResolvedValue([
        { id: 'doc1', title: 'Document 1' },
        { id: 'doc2', title: 'Document 2' }
      ])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(data[0].title).toBe('Document 1')
    })

    it('should return 401 for unauthenticated users', async () => {
      mockAuth.mockResolvedValue(null)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('POST', () => {
    it('should create new document', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'test-user-id' }
      } as any)

      mockDb.returning.mockResolvedValue([
        { id: 'new-doc-id' }
      ])

      const request = new NextRequest('http://localhost/api/documents', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Document' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('new-doc-id')
    })
  })
})
```

## Step 5.3: Update E2E Tests (60 minutes)

### 5.3.1 Update Playwright Tests
**File:** `apps/web/tests/e2e/user-workflows.spec.ts`

Remove collaboration scenarios and focus on single-user workflows:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Document Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Login user
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password')
    await page.click('[data-testid="login-button"]')
    await expect(page).toHaveURL('/')
  })

  test('should create and edit document', async ({ page }) => {
    // Create new document
    await page.click('[data-testid="create-document"]')
    await expect(page).toHaveURL(/\/editor\//)

    // Edit document
    const editor = page.locator('[data-testid="editor"]')
    await editor.click()
    await editor.type('This is my test document content.')

    // Wait for auto-save
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Saved')

    // Reload page to verify persistence
    await page.reload()
    await expect(editor).toContainText('This is my test document content.')
  })

  test('should show document list', async ({ page }) => {
    await page.goto('/')
    
    // Should show user's documents
    await expect(page.locator('[data-testid="document-list"]')).toBeVisible()
    
    // Should be able to create new document
    await expect(page.locator('[data-testid="create-document"]')).toBeVisible()
  })

  test('should handle save errors gracefully', async ({ page }) => {
    // Intercept API calls to simulate error
    await page.route('**/api/documents/*/autosave', route => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
    })

    await page.goto('/editor/test-doc-id')
    
    const editor = page.locator('[data-testid="editor"]')
    await editor.type('This should fail to save')

    // Should show error status
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Save failed')
  })

  test('should support undo/redo', async ({ page }) => {
    await page.goto('/editor/test-doc-id')
    
    const editor = page.locator('[data-testid="editor"]')
    await editor.type('First line')
    await editor.press('Enter')
    await editor.type('Second line')

    // Test undo (Ctrl+Z)
    await page.keyboard.press('Control+z')
    await expect(editor).not.toContainText('Second line')
    await expect(editor).toContainText('First line')

    // Test redo (Ctrl+Y)
    await page.keyboard.press('Control+y')
    await expect(editor).toContainText('Second line')
  })
})

// Remove these test suites:
// test.describe('Real-time Collaboration') - DELETE
// test.describe('WebSocket Connection') - DELETE  
// test.describe('Multi-user Editing') - DELETE
```

### 5.3.2 Update Test Configuration
**File:** `apps/web/playwright.config.ts`

Remove any collaboration-specific test setup:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

## Step 5.4: Run Test Suite (30 minutes)

### 5.4.1 Run Unit Tests
```bash
cd apps/web

# Run all unit tests
pnpm test

# Run specific test files
pnpm test hooks/useDocumentPersistence.test.ts
pnpm test providers/YjsProvider.test.tsx
pnpm test app/api/documents
```

### 5.4.2 Run E2E Tests
```bash
# Install Playwright browsers if needed
npx playwright install

# Run E2E tests
pnpm test:e2e

# Run specific E2E tests
npx playwright test user-workflows.spec.ts
```

### 5.4.3 Fix Any Failing Tests
Address test failures by:
- Updating imports for removed components
- Fixing mocks for simplified API
- Removing collaboration assertions
- Updating test data to match new schema

## Step 5.5: Manual Testing Checklist (15 minutes)

### 5.5.1 Complete Manual Test
Test the following user flows manually:

```bash
pnpm dev
```

**Authentication Flow:**
- [ ] Can login successfully
- [ ] Can logout successfully
- [ ] Redirects to login when not authenticated

**Document Management:**
- [ ] Can create new document
- [ ] Can see list of own documents
- [ ] Can switch between documents
- [ ] Document title is editable

**Editor Functionality:**
- [ ] Can type and edit content
- [ ] Undo/redo works (Ctrl+Z, Ctrl+Y)
- [ ] Formatting tools work (bold, italic, etc.)
- [ ] Editor loads existing content correctly

**Auto-save Functionality:**
- [ ] Shows "Saving..." when typing
- [ ] Shows "Saved" after auto-save completes
- [ ] Shows save timestamp
- [ ] Manual save button works
- [ ] Content persists after page reload

**Error Handling:**
- [ ] Shows error message when save fails
- [ ] Gracefully handles network issues
- [ ] Provides clear feedback to user

## ✅ Validation Checklist

After completing Phase 5:

- [ ] All collaboration tests removed
- [ ] New tests for simplified functionality created
- [ ] Unit tests passing
- [ ] E2E tests passing
- [ ] Manual testing completed successfully
- [ ] No WebSocket or collaboration functionality visible
- [ ] All core editor features working

## 🧪 Final Testing Results

**Expected Test Results:**
- ✅ Unit tests: All passing
- ✅ E2E tests: All passing  
- ✅ Manual tests: All functionality working
- ✅ No collaboration features present
- ✅ Y.js editor features intact
- ✅ Auto-save working reliably

## 📝 Commit Your Progress

```bash
git add .
git commit -m "Phase 5: Update test suite for simplified architecture

- Removed all collaboration and WebSocket tests
- Created new tests for useDocumentPersistence hook
- Updated YjsProvider tests for single-user workflow
- Created API route tests for simplified schema
- Updated E2E tests to focus on single-user workflows
- All tests passing with new simplified architecture
- Manual testing confirms all functionality works"
```

---
**Next:** Proceed to `06_final_cleanup.md` for documentation updates and final optimizations.