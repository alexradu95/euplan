#!/usr/bin/env node

/**
 * Comprehensive Test Runner for EuPlan Monorepo
 * 
 * This script runs all tests across the monorepo and provides
 * detailed reporting with summary statistics.
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.bold}${colors.blue}📊 ${msg}${colors.reset}\n`),
  command: (msg) => console.log(`${colors.magenta}🔧 Running: ${msg}${colors.reset}`)
};

class TestRunner {
  constructor() {
    this.results = {
      sync_server_unit: null,
      sync_server_e2e: null,
      web_e2e: null,
      total_duration: 0,
      start_time: Date.now()
    };
  }

  async runCommand(command, cwd = process.cwd()) {
    return new Promise((resolve) => {
      log.command(command);
      
      const startTime = Date.now();
      const child = spawn('pnpm', command.split(' ').slice(1), {
        cwd,
        stdio: 'pipe',
        shell: process.platform === 'win32'
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(output);
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output);
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        resolve({
          success: code === 0,
          duration,
          stdout,
          stderr,
          exitCode: code
        });
      });
    });
  }

  parseTestResults(output, type) {
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      success: false
    };

    try {
      if (type === 'jest') {
        // Parse Jest output
        const testMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
        if (testMatch) {
          results.failed = parseInt(testMatch[1]);
          results.passed = parseInt(testMatch[2]);
          results.total = parseInt(testMatch[3]);
          results.success = results.failed === 0;
        }

        const timeMatch = output.match(/Time:\s+([\d.]+)\s*s/);
        if (timeMatch) {
          results.duration = parseFloat(timeMatch[1]) * 1000;
        }
      } else if (type === 'playwright') {
        // Parse Playwright output
        const testMatch = output.match(/(\d+)\s+passed.*?(\d+)\s+failed.*?(\d+)\s+total/);
        if (testMatch) {
          results.passed = parseInt(testMatch[1]);
          results.failed = parseInt(testMatch[2]);
          results.total = parseInt(testMatch[3]);
          results.success = results.failed === 0;
        }
      }
    } catch (error) {
      log.warning(`Failed to parse test results: ${error.message}`);
    }

    return results;
  }

  generateSummary() {
    const totalDuration = Date.now() - this.results.start_time;
    
    log.section('TEST EXECUTION SUMMARY');
    
    console.log(`${colors.bold}🚀 Monorepo Test Results${colors.reset}`);
    console.log('─'.repeat(50));
    
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let allSuccess = true;

    // Sync Server Unit Tests
    if (this.results.sync_server_unit) {
      const r = this.results.sync_server_unit;
      console.log(`${colors.cyan}📦 Sync Server (Unit Tests)${colors.reset}`);
      console.log(`   Total: ${r.total} | Passed: ${colors.green}${r.passed}${colors.reset} | Failed: ${r.failed > 0 ? colors.red : colors.green}${r.failed}${colors.reset}`);
      console.log(`   Duration: ${(r.duration / 1000).toFixed(2)}s | Status: ${r.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
      
      totalTests += r.total;
      totalPassed += r.passed;
      totalFailed += r.failed;
      allSuccess = allSuccess && r.success;
    }

    // Sync Server E2E Tests
    if (this.results.sync_server_e2e) {
      const r = this.results.sync_server_e2e;
      console.log(`${colors.cyan}📦 Sync Server (E2E Tests)${colors.reset}`);
      console.log(`   Total: ${r.total} | Passed: ${colors.green}${r.passed}${colors.reset} | Failed: ${r.failed > 0 ? colors.red : colors.green}${r.failed}${colors.reset}`);
      console.log(`   Duration: ${(r.duration / 1000).toFixed(2)}s | Status: ${r.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
      
      totalTests += r.total;
      totalPassed += r.passed;
      totalFailed += r.failed;
      allSuccess = allSuccess && r.success;
    }

    // Web E2E Tests
    if (this.results.web_e2e) {
      const r = this.results.web_e2e;
      console.log(`${colors.cyan}🌐 Web App (E2E Tests)${colors.reset}`);
      console.log(`   Total: ${r.total} | Passed: ${colors.green}${r.passed}${colors.reset} | Failed: ${r.failed > 0 ? colors.red : colors.green}${r.failed}${colors.reset}`);
      console.log(`   Duration: ${(r.duration / 1000).toFixed(2)}s | Status: ${r.success ? colors.green + '✅ PASS' : colors.red + '❌ FAIL'}${colors.reset}`);
      
      totalTests += r.total;
      totalPassed += r.passed;
      totalFailed += r.failed;
      allSuccess = allSuccess && r.success;
    }

    console.log('─'.repeat(50));
    console.log(`${colors.bold}📊 OVERALL RESULTS${colors.reset}`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${colors.green}${totalPassed}${colors.reset}`);
    console.log(`   Failed: ${totalFailed > 0 ? colors.red : colors.green}${totalFailed}${colors.reset}`);
    console.log(`   Success Rate: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : 0}%`);
    console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   Overall Status: ${allSuccess ? colors.green + '✅ ALL TESTS PASSED' : colors.red + '❌ SOME TESTS FAILED'}${colors.reset}`);
    
    if (!allSuccess) {
      process.exit(1);
    }
  }

  async runAllTests() {
    log.section('EUPLAN MONOREPO TEST EXECUTION');
    
    try {
      // 1. Run Sync Server Unit Tests
      log.info('Running Sync Server unit tests...');
      const syncServerUnitResult = await this.runCommand(
        'pnpm run test:unit',
        path.join(process.cwd(), 'apps', 'sync-server')
      );
      this.results.sync_server_unit = this.parseTestResults(syncServerUnitResult.stdout, 'jest');
      this.results.sync_server_unit.success = syncServerUnitResult.success;

      // 2. Run Sync Server E2E Tests
      log.info('Running Sync Server E2E tests...');
      const syncServerE2eResult = await this.runCommand(
        'pnpm run test:e2e',
        path.join(process.cwd(), 'apps', 'sync-server')
      );
      this.results.sync_server_e2e = this.parseTestResults(syncServerE2eResult.stdout, 'jest');
      this.results.sync_server_e2e.success = syncServerE2eResult.success;

      // 3. Install Playwright if needed and run Web E2E Tests
      log.info('Installing Playwright browsers if needed...');
      await this.runCommand(
        'pnpm install',
        path.join(process.cwd(), 'apps', 'web')
      );

      try {
        await this.runCommand(
          'npx playwright install',
          path.join(process.cwd(), 'apps', 'web')
        );
      } catch (error) {
        log.warning('Playwright install failed, continuing with existing installation');
      }

      log.info('Running Web E2E tests...');
      const webE2eResult = await this.runCommand(
        'pnpm run test:e2e',
        path.join(process.cwd(), 'apps', 'web')
      );
      this.results.web_e2e = this.parseTestResults(webE2eResult.stdout, 'playwright');
      this.results.web_e2e.success = webE2eResult.success;

    } catch (error) {
      log.error(`Test execution failed: ${error.message}`);
    }

    this.generateSummary();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const runner = new TestRunner();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.bold}EuPlan Monorepo Test Runner${colors.reset}

Usage: node scripts/test-runner.js [options]

Options:
  --help, -h     Show this help message
  
This script runs all tests across the monorepo:
  - Sync Server unit tests (Jest)
  - Sync Server E2E tests (Jest)
  - Web App E2E tests (Playwright)

Examples:
  node scripts/test-runner.js              # Run all tests
  pnpm run test:all                        # Using npm script
    `);
    return;
  }

  await runner.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    log.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = TestRunner;