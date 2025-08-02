import { test, expect, Page, BrowserContext } from '@playwright/test';

type AuthenticatedUser = {
  page: Page;
  userId: string;
  email: string;
};

const TEST_USERS = {
  user1: { email: 'test1@example.com', password: 'password123', userId: 'user1' },
  user2: { email: 'test2@example.com', password: 'password123', userId: 'user2' },
};

async function authenticateUser(page: Page, user: typeof TEST_USERS.user1): Promise<void> {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.click('[data-testid="login-button"]');
  
  // Wait for redirect or check for success indicators
  try {
    await page.waitForURL('/', { timeout: 10000 });
  } catch (e) {
    // If direct URL wait fails, try waiting for the dashboard element
    await page.waitForSelector('[data-testid="user-dashboard"]', { timeout: 10000 });
  }
}

async function createDocument(page: Page, title: string): Promise<string> {
  await page.click('[data-testid="create-document-button"]');
  await page.fill('[data-testid="document-title-input"]', title);
  await page.click('[data-testid="create-button"]');
  await page.waitForURL(/\/editor\/.*$/);
  
  // Extract document ID from URL
  const url = page.url();
  const documentId = url.split('/').pop() || '';
  return documentId;
}

test.describe('User Authentication and Onboarding', () => {
  test('should allow new user registration', async ({ page }) => {
    await page.goto('/signup');
    
    const uniqueEmail = `test-${Date.now()}@example.com`;
    await page.fill('[data-testid="name-input"]', 'Test User');
    await page.fill('[data-testid="email-input"]', uniqueEmail);
    await page.fill('[data-testid="password-input"]', 'securePassword123');
    await page.fill('[data-testid="confirm-password-input"]', 'securePassword123');
    
    await page.click('[data-testid="signup-button"]');
    
    // Should redirect to login or dashboard
    await expect(page).toHaveURL(/\/(login|dashboard)/);
  });

  test('should authenticate existing user', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    
    // Should be redirected to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid="user-dashboard"]')).toBeVisible();
  });

  test('should reject invalid login credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
  });

  test('should handle logout correctly', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    
    // Should redirect to login page
    await expect(page).toHaveURL('/login');
    
    // Verify session is cleared by trying to access protected route
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Document Management', () => {
  test('should create new document', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    
    const documentId = await createDocument(page, 'Test Document');
    
    expect(documentId).toBeTruthy();
    await expect(page.locator('[data-testid="document-title"]')).toContainText('Test Document');
    await expect(page.locator('[data-testid="editor-content"]')).toBeVisible();
  });

  test('should list user documents on dashboard', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    
    // Create a document first
    await createDocument(page, 'Dashboard Test Document');
    
    // Navigate back to dashboard
    await page.goto('/');
    
    await expect(page.locator('[data-testid="document-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="document-item"]')).toContainText('Dashboard Test Document');
  });

  test('should open existing document', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    
    // Create document first
    const documentId = await createDocument(page, 'Existing Document Test');
    
    // Go back to dashboard
    await page.goto('/');
    
    // Open the document from list
    await page.click(`[data-testid="document-item-${documentId}"]`);
    
    await expect(page).toHaveURL(`/editor/${documentId}`);
    await expect(page.locator('[data-testid="document-title"]')).toContainText('Existing Document Test');
  });

  test('should delete document', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    
    const documentId = await createDocument(page, 'Document to Delete');
    
    // Go back to dashboard
    await page.goto('/');
    
    // Delete the document
    await page.click(`[data-testid="document-menu-${documentId}"]`);
    await page.click(`[data-testid="delete-document-${documentId}"]`);
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify document is removed from list
    await expect(page.locator(`[data-testid="document-item-${documentId}"]`)).not.toBeVisible();
  });

  test('should handle document access permissions', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    
    const documentId = await createDocument(page, 'Private Document');
    
    // Logout and login as different user
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    await authenticateUser(page, TEST_USERS.user2);
    
    // Try to access the document directly
    await page.goto(`/editor/${documentId}`);
    
    // Should show access denied or redirect
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
  });
});

test.describe('Document Editing', () => {
  test('should allow text editing in document', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    await createDocument(page, 'Text Editing Test');
    
    const editor = page.locator('[data-testid="editor-content"]');
    await editor.click();
    await editor.fill('This is a test document with some content.');
    
    // Verify content is entered
    await expect(editor).toContainText('This is a test document with some content.');
    
    // Test basic formatting
    await editor.selectText('test document');
    await page.click('[data-testid="bold-button"]');
    
    // Verify bold formatting is applied
    await expect(page.locator('strong')).toContainText('test document');
  });

  test('should save document automatically', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    const documentId = await createDocument(page, 'Auto Save Test');
    
    const editor = page.locator('[data-testid="editor-content"]');
    await editor.click();
    await editor.fill('Content that should be auto-saved');
    
    // Wait for auto-save indicator
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Saved');
    
    // Refresh page and verify content persists
    await page.reload();
    await expect(editor).toContainText('Content that should be auto-saved');
  });

  test('should support rich text formatting', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    await createDocument(page, 'Rich Text Test');
    
    const editor = page.locator('[data-testid="editor-content"]');
    await editor.click();
    await editor.fill('Bold text, italic text, and underlined text.');
    
    // Test bold formatting
    await editor.selectText('Bold text');
    await page.click('[data-testid="bold-button"]');
    await expect(page.locator('strong')).toContainText('Bold text');
    
    // Test italic formatting
    await editor.selectText('italic text');
    await page.click('[data-testid="italic-button"]');
    await expect(page.locator('em')).toContainText('italic text');
    
    // Test list creation
    await editor.focus();
    await page.keyboard.press('Enter');
    await page.click('[data-testid="bullet-list-button"]');
    await editor.type('First bullet point');
    await page.keyboard.press('Enter');
    await editor.type('Second bullet point');
    
    await expect(page.locator('ul li')).toHaveCount(2);
  });

  test('should handle document history and undo/redo', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    await createDocument(page, 'History Test');
    
    const editor = page.locator('[data-testid="editor-content"]');
    await editor.click();
    await editor.fill('Original text');
    
    await page.keyboard.press('Enter');
    await editor.type('Additional text');
    
    // Test undo
    await page.keyboard.press('Control+z');
    await expect(editor).not.toContainText('Additional text');
    await expect(editor).toContainText('Original text');
    
    // Test redo
    await page.keyboard.press('Control+y');
    await expect(editor).toContainText('Additional text');
  });
});

test.describe('Real-time Collaboration', () => {
  test('should show multiple users editing same document', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Authenticate both users
    await authenticateUser(page1, TEST_USERS.user1);
    await authenticateUser(page2, TEST_USERS.user2);
    
    // User 1 creates document
    const documentId = await createDocument(page1, 'Collaboration Test');
    
    // Share document with user 2 (assuming sharing functionality exists)
    await page1.click('[data-testid="share-button"]');
    await page1.fill('[data-testid="share-email"]', TEST_USERS.user2.email);
    await page1.click('[data-testid="send-invite"]');
    
    // User 2 opens the shared document
    await page2.goto(`/editor/${documentId}`);
    
    // Verify both users can see each other
    await expect(page1.locator('[data-testid="collaborator-list"]')).toContainText('test2@example.com');
    await expect(page2.locator('[data-testid="collaborator-list"]')).toContainText('test1@example.com');
    
    // User 1 types
    const editor1 = page1.locator('[data-testid="editor-content"]');
    await editor1.click();
    await editor1.fill('User 1 typing: ');
    
    // User 2 should see the text
    const editor2 = page2.locator('[data-testid="editor-content"]');
    await expect(editor2).toContainText('User 1 typing: ');
    
    // User 2 adds text
    await editor2.click();
    await page2.keyboard.press('End');
    await editor2.type('User 2 adding text');
    
    // User 1 should see both texts
    await expect(editor1).toContainText('User 1 typing: User 2 adding text');
    
    await context1.close();
    await context2.close();
  });

  test('should show real-time cursor positions', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    await authenticateUser(page1, TEST_USERS.user1);
    await authenticateUser(page2, TEST_USERS.user2);
    
    const documentId = await createDocument(page1, 'Cursor Test');
    
    // Share and open document in second browser
    await page1.click('[data-testid="share-button"]');
    await page1.fill('[data-testid="share-email"]', TEST_USERS.user2.email);
    await page1.click('[data-testid="send-invite"]');
    await page2.goto(`/editor/${documentId}`);
    
    // Add some content first
    const editor1 = page1.locator('[data-testid="editor-content"]');
    await editor1.click();
    await editor1.fill('This is a test document for cursor tracking.');
    
    // Move cursor in editor 1
    await editor1.click();
    await page1.keyboard.press('Home');
    
    // User 2 should see user 1's cursor
    await expect(page2.locator('[data-testid="user-cursor-user1"]')).toBeVisible();
    
    // Move cursor to different position
    await page1.keyboard.press('Control+Right'); // Move to next word
    
    // Cursor position should update for user 2
    // Note: This would require implementing cursor position tracking in the app
    
    await context1.close();
    await context2.close();
  });

  test('should handle conflict resolution in concurrent edits', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    await authenticateUser(page1, TEST_USERS.user1);
    await authenticateUser(page2, TEST_USERS.user2);
    
    const documentId = await createDocument(page1, 'Conflict Test');
    
    // Set up collaboration
    await page1.click('[data-testid="share-button"]');
    await page1.fill('[data-testid="share-email"]', TEST_USERS.user2.email);
    await page1.click('[data-testid="send-invite"]');
    await page2.goto(`/editor/${documentId}`);
    
    const editor1 = page1.locator('[data-testid="editor-content"]');
    const editor2 = page2.locator('[data-testid="editor-content"]');
    
    // Both users edit at the same time
    await editor1.click();
    await editor1.fill('User 1: ');
    
    await editor2.click();
    await editor2.fill('User 2: ');
    
    // Wait for synchronization
    await page1.waitForTimeout(1000);
    await page2.waitForTimeout(1000);
    
    // Both editors should show merged content (order may vary due to Y.js conflict resolution)
    const finalContent1 = await editor1.textContent();
    const finalContent2 = await editor2.textContent();
    
    expect(finalContent1).toBe(finalContent2);
    expect(finalContent1).toContain('User 1');
    expect(finalContent1).toContain('User 2');
    
    await context1.close();
    await context2.close();
  });
});

test.describe('Offline and Network Resilience', () => {
  test('should handle network disconnection gracefully', async ({ page, context }) => {
    await authenticateUser(page, TEST_USERS.user1);
    const documentId = await createDocument(page, 'Offline Test');
    
    const editor = page.locator('[data-testid="editor-content"]');
    await editor.click();
    await editor.fill('Content before going offline');
    
    // Wait for initial save
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Saved');
    
    // Simulate network disconnection
    await context.setOffline(true);
    
    // Continue editing offline
    await editor.type(' - offline content');
    
    // Should show offline indicator
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Offline');
    
    // Reconnect
    await context.setOffline(false);
    
    // Should sync changes
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Online');
    await expect(page.locator('[data-testid="save-status"]')).toContainText('Saved');
    
    // Verify content persisted
    await page.reload();
    await expect(editor).toContainText('Content before going offline - offline content');
  });

  test('should recover from server disconnection', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    await createDocument(page, 'Server Recovery Test');
    
    const editor = page.locator('[data-testid="editor-content"]');
    await editor.click();
    await editor.fill('Initial content');
    
    // Simulate WebSocket disconnection by intercepting and blocking WebSocket requests
    await page.route('ws://localhost:**/collaboration', (route) => {
      route.abort();
    });
    
    // Continue editing
    await editor.type(' - added during disconnection');
    
    // Should show connection issues
    await expect(page.locator('[data-testid="connection-status"]')).toContainText(/Disconnected|Reconnecting/);
    
    // Remove route block to allow reconnection
    await page.unroute('ws://localhost:**/collaboration');
    
    // Should reconnect automatically
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
    
    // Changes should be preserved
    await expect(editor).toContainText('Initial content - added during disconnection');
  });
});

test.describe('Performance and User Experience', () => {
  test('should load documents quickly', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    
    const startTime = Date.now();
    await createDocument(page, 'Performance Test Document');
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    
    // Editor should be ready for input
    const editor = page.locator('[data-testid="editor-content"]');
    await expect(editor).toBeVisible();
    await expect(editor).toBeFocused();
  });

  test('should handle large documents efficiently', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    await createDocument(page, 'Large Document Test');
    
    const editor = page.locator('[data-testid="editor-content"]');
    await editor.click();
    
    // Insert large amount of content
    const largeContent = 'This is a large document. '.repeat(1000); // ~25KB of text
    await editor.fill(largeContent);
    
    // Should remain responsive
    await editor.type('Additional text at the end.');
    
    // Verify content is there
    await expect(editor).toContainText('Additional text at the end.');
    
    // Scrolling should be smooth
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Control+End');
    
    // Editor should still be responsive
    await editor.type(' More text.');
    await expect(editor).toContainText('More text.');
  });

  test('should provide good user feedback for actions', async ({ page }) => {
    await authenticateUser(page, TEST_USERS.user1);
    await createDocument(page, 'Feedback Test');
    
    const editor = page.locator('[data-testid="editor-content"]');
    await editor.click();
    await editor.fill('Test content for feedback');
    
    // Should show saving indicator
    await expect(page.locator('[data-testid="save-status"]')).toContainText(/Saving|Saved/);
    
    // Format text and verify feedback
    await editor.selectText('Test content');
    await page.click('[data-testid="bold-button"]');
    
    // Bold button should show active state
    await expect(page.locator('[data-testid="bold-button"]')).toHaveClass(/active|selected/);
    
    // Test error feedback
    await page.click('[data-testid="share-button"]');
    await page.fill('[data-testid="share-email"]', 'invalid-email');
    await page.click('[data-testid="send-invite"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid email');
  });
});