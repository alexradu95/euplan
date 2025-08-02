import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Setup test database
    console.log('Setting up test database...');
    
    // Wait for services to be ready
    console.log('Waiting for services to start...');
    
    // Check if web server is ready
    let webReady = false;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!webReady && attempts < maxAttempts) {
      try {
        const response = await page.goto('http://localhost:3000', { 
          waitUntil: 'networkidle',
          timeout: 5000 
        });
        if (response?.status() === 200) {
          webReady = true;
          console.log('Web server is ready');
        }
      } catch (error) {
        attempts++;
        console.log(`Waiting for web server... (attempt ${attempts}/${maxAttempts})`);
        await page.waitForTimeout(2000);
      }
    }

    if (!webReady) {
      throw new Error('Web server failed to start');
    }

    // Check if sync server is ready
    let syncReady = false;
    attempts = 0;
    
    while (!syncReady && attempts < maxAttempts) {
      try {
        const response = await page.goto('http://localhost:3001', { 
          timeout: 5000 
        });
        if (response?.status() === 200) {
          syncReady = true;
          console.log('Sync server is ready');
        }
      } catch (error) {
        attempts++;
        console.log(`Waiting for sync server... (attempt ${attempts}/${maxAttempts})`);
        await page.waitForTimeout(2000);
      }
    }

    if (!syncReady) {
      console.warn('Sync server not ready, but continuing with tests');
    }

    // Create test users if needed
    console.log('Setting up test data...');
    
    // Navigate to signup page and create test users
    await page.goto('http://localhost:3000/signup');
    
    const testUsers = [
      { name: 'Test User 1', email: 'test1@example.com', password: 'password123' },
      { name: 'Test User 2', email: 'test2@example.com', password: 'password123' },
    ];

    for (const user of testUsers) {
      try {
        await page.fill('[data-testid="name-input"]', user.name);
        await page.fill('[data-testid="email-input"]', user.email);
        await page.fill('[data-testid="password-input"]', user.password);
        await page.fill('[data-testid="confirm-password-input"]', user.password);
        await page.click('[data-testid="signup-button"]');
        
        // Handle potential redirect or error
        await page.waitForTimeout(2000);
        
        // Go back to signup for next user
        await page.goto('http://localhost:3000/signup');
      } catch (error) {
        console.log(`User ${user.email} might already exist, continuing...`);
      }
    }

    console.log('Global setup completed successfully');

  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;