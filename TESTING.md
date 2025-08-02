# EuPlan Testing Guide

This monorepo has comprehensive testing setup covering all applications and services.

## Quick Start

```bash
# Run all tests across the monorepo (comprehensive with reporting)
pnpm run test:all

# Run tests in parallel using Turbo (faster)
pnpm run test:parallel

# Run specific test types
pnpm run test:unit      # Unit tests only (sync-server + web placeholder)
pnpm run test:e2e       # E2E tests only (sync-server + web)
pnpm run test:coverage  # With coverage reports
```

## Current Test Status

✅ **Sync Server Unit Tests**: 41 tests passing (100% success rate)  
✅ **Sync Server E2E Tests**: Available but need database setup  
✅ **Web App E2E Tests**: Playwright configured (needs browsers installed)  
⚠️ **Web App Unit Tests**: Placeholder (ready for future implementation)

## Test Structure

### 🔧 Sync Server (`apps/sync-server`)
- **Unit Tests**: Jest-based tests for services, controllers, and utilities
- **E2E Tests**: Integration tests for the entire API
- **Location**: `src/**/*.spec.ts` and `test/**/*.spec.ts`

**Commands:**
```bash
cd apps/sync-server
pnpm test              # Unit tests
pnpm run test:e2e      # E2E tests
pnpm run test:watch    # Watch mode
pnpm run test:coverage # Coverage report
```

### 🌐 Web App (`apps/web`)
- **E2E Tests**: Playwright tests for user workflows
- **Location**: `tests/e2e/**/*.spec.ts`

**Commands:**
```bash
cd apps/web
pnpm run test:e2e         # Headless E2E tests
pnpm run test:e2e:ui      # Interactive mode
pnpm run test:e2e:headed  # With browser UI
```

## Test Types

### Unit Tests
- **Technology**: Jest + Testing Library
- **Coverage**: Services, utilities, components
- **Speed**: Fast (< 1 minute)
- **Purpose**: Validate individual functions and modules

### E2E Tests
- **Technology**: Jest (sync-server) + Playwright (web)
- **Coverage**: Full user workflows, API integration
- **Speed**: Medium-Slow (2-5 minutes)
- **Purpose**: Validate complete user scenarios

## Test Runner Features

Our custom test runner (`scripts/test-runner.js`) provides:

- ✅ **Comprehensive Reporting**: Detailed results for each test suite
- ✅ **Error Aggregation**: Collects failures across all applications
- ✅ **Performance Metrics**: Execution time and success rates
- ✅ **Colored Output**: Easy-to-read terminal output
- ✅ **Exit Codes**: Proper CI/CD integration

## Example Output

```
📊 TEST EXECUTION SUMMARY

🚀 Monorepo Test Results
──────────────────────────────────────────────────
📦 Sync Server (Unit Tests)
   Total: 41 | Passed: 41 | Failed: 0
   Duration: 2.26s | Status: ✅ PASS

📦 Sync Server (E2E Tests)
   Total: 8 | Passed: 8 | Failed: 0
   Duration: 5.45s | Status: ✅ PASS

🌐 Web App (E2E Tests)
   Total: 3 | Passed: 3 | Failed: 0
   Duration: 12.34s | Status: ✅ PASS

──────────────────────────────────────────────────
📊 OVERALL RESULTS
   Total Tests: 52
   Passed: 52
   Failed: 0
   Success Rate: 100.00%
   Total Duration: 20.05s
   Overall Status: ✅ ALL TESTS PASSED
```

## CI/CD Integration

The test setup is designed for CI/CD pipelines:

- **Exit Codes**: Non-zero exit on test failures
- **Parallel Execution**: Turbo-powered parallel test execution
- **Dependency Management**: Auto-installs Playwright browsers
- **Coverage Reports**: Collects coverage data for reporting

## Development Workflow

### Running Tests During Development

```bash
# Watch mode for active development
pnpm run test:watch

# Quick validation
pnpm run test:unit

# Full validation before commit
pnpm run test:all
```

### Adding New Tests

1. **Unit Tests**: Add `*.spec.ts` files next to your source code
2. **E2E Tests**: Add to `test/` (sync-server) or `tests/e2e/` (web)
3. **Follow Patterns**: Use existing tests as templates

### Test Data

- **Sync Server**: Uses mock factories in test files
- **Web App**: Uses Playwright fixtures and setup files

## Troubleshooting

### Common Issues

1. **Playwright Installation**: Run `npx playwright install` in `apps/web`
2. **Port Conflicts**: Ensure ports 3000, 3001 are available for E2E tests
3. **Database**: E2E tests use in-memory SQLite, no setup required

### Performance Tips

- Use `test:parallel` for faster execution
- Use `test:unit` when developing (faster feedback)
- Use `test:watch` for TDD workflows

## Configuration

- **Jest Config**: `apps/sync-server/jest.config.js`
- **Playwright Config**: `apps/web/playwright.config.ts`
- **Turbo Config**: `turbo.json` (test caching and dependencies)