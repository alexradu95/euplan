/**
 * Custom test results processor for enhanced reporting
 */
module.exports = (results) => {
  const { testResults, numTotalTests, numPassedTests, numFailedTests } = results;
  
  console.log('\n📊 Test Results Summary:');
  console.log(`Total tests: ${numTotalTests}`);
  console.log(`Passed: ${numPassedTests}`);
  console.log(`Failed: ${numFailedTests}`);
  console.log(`Success rate: ${((numPassedTests / numTotalTests) * 100).toFixed(2)}%`);
  
  // Performance analysis
  const slowTests = testResults
    .flatMap(result => result.testResults)
    .filter(test => test.duration > 5000) // Tests slower than 5 seconds
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5); // Top 5 slowest tests
  
  if (slowTests.length > 0) {
    console.log('\n⚠️  Slowest Tests:');
    slowTests.forEach(test => {
      console.log(`  ${test.fullName}: ${test.duration}ms`);
    });
  }
  
  // Error analysis
  const failedTests = testResults
    .flatMap(result => result.testResults)
    .filter(test => test.status === 'failed');
  
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`  ${test.fullName}`);
      if (test.failureMessages && test.failureMessages.length > 0) {
        console.log(`    Error: ${test.failureMessages[0].split('\n')[0]}`);
      }
    });
  }
  
  // Coverage analysis (if available)
  if (results.coverageMap) {
    const coverage = results.coverageMap.getCoverageSummary();
    console.log('\n📈 Coverage Summary:');
    console.log(`Lines: ${coverage.lines.pct}%`);
    console.log(`Functions: ${coverage.functions.pct}%`);
    console.log(`Branches: ${coverage.branches.pct}%`);
    console.log(`Statements: ${coverage.statements.pct}%`);
  }
  
  // Performance metrics
  const totalDuration = testResults.reduce((sum, result) => {
    return sum + (result.perfStats?.end - result.perfStats?.start || 0);
  }, 0);
  
  console.log('\n⏱️  Performance Metrics:');
  console.log(`Total test duration: ${totalDuration}ms`);
  console.log(`Average test duration: ${(totalDuration / numTotalTests).toFixed(2)}ms`);
  
  // Memory usage (if available)
  if (process.memoryUsage) {
    const memory = process.memoryUsage();
    console.log('\n💾 Memory Usage:');
    console.log(`Heap Used: ${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Heap Total: ${(memory.heapTotal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`RSS: ${(memory.rss / 1024 / 1024).toFixed(2)}MB`);
  }
  
  // Write detailed results to file for CI
  if (process.env.CI) {
    const fs = require('fs');
    const path = require('path');
    
    const detailedResults = {
      timestamp: new Date().toISOString(),
      summary: {
        total: numTotalTests,
        passed: numPassedTests,
        failed: numFailedTests,
        successRate: (numPassedTests / numTotalTests) * 100,
      },
      performance: {
        totalDuration,
        averageDuration: totalDuration / numTotalTests,
        slowTests: slowTests.map(test => ({
          name: test.fullName,
          duration: test.duration,
        })),
      },
      failures: failedTests.map(test => ({
        name: test.fullName,
        error: test.failureMessages?.[0] || 'Unknown error',
      })),
    };
    
    const resultsPath = path.join(process.cwd(), 'test-results', 'detailed-results.json');
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify(detailedResults, null, 2));
    
    console.log(`\n📄 Detailed results written to: ${resultsPath}`);
  }
  
  console.log('\n');
  return results;
};