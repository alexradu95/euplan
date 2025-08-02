import { ConfigService } from '@nestjs/config';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/euplan_test';
  
  // Configure test timeouts
  jest.setTimeout(30000);
  
  console.log('🧪 Test environment initialized');
});

// Global test teardown
afterAll(async () => {
  // Clean up any global resources
  console.log('🧹 Test environment cleaned up');
});

// Mock external dependencies
jest.mock('@nestjs/config');

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Declare custom matcher types
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Mock WebSocket for testing
global.WebSocket = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
})) as any;

// Mock console methods for cleaner test output
const originalConsole = console;
global.console = {
  ...originalConsole,
  // Suppress console.log in tests unless explicitly needed
  log: process.env.TEST_VERBOSE ? originalConsole.log : jest.fn(),
  debug: process.env.TEST_VERBOSE ? originalConsole.debug : jest.fn(),
  info: originalConsole.info,
  warn: originalConsole.warn,
  error: originalConsole.error,
};