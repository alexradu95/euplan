import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PerformanceMonitor } from './common/performance-monitor';
import { config } from './config/environment';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    const systemHealth = PerformanceMonitor.getSystemHealth();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.get('NODE_ENV'),
      version: process.env.npm_package_version || '1.0.0',
      uptime: systemHealth.uptime,
      memory: systemHealth.memory,
      performanceMonitoring: config.getBoolean('ENABLE_METRICS'),
      recentIssues: {
        slowOperations: systemHealth.performance.slowOperations.length,
        recentErrors: systemHealth.performance.recentErrors.length,
      },
    };
  }

  @Get('metrics')
  getMetrics() {
    if (!config.getBoolean('ENABLE_METRICS')) {
      return {
        error: 'Metrics collection is disabled',
        message: 'Set ENABLE_METRICS=true to enable metrics collection',
      };
    }

    const operations = [
      'database_query',
      'document_load', 
      'document_save',
      'websocket_message',
      'user_authentication'
    ];

    const operationStats = operations.reduce((acc, operation) => {
      const stats = PerformanceMonitor.getOperationStats(operation);
      if (stats) {
        acc[operation] = stats;
      }
      return acc;
    }, {} as Record<string, ReturnType<typeof PerformanceMonitor.getOperationStats>>);

    const systemHealth = PerformanceMonitor.getSystemHealth();

    return {
      timestamp: new Date().toISOString(),
      systemHealth,
      operationStats,
      summary: {
        totalOperations: Object.values(operationStats).reduce((sum, stat) => sum + (stat?.count || 0), 0),
        avgSuccessRate: Object.values(operationStats).length > 0 
          ? Object.values(operationStats).reduce((sum, stat) => sum + (stat?.successRate || 0), 0) / Object.values(operationStats).length
          : 1,
      },
    };
  }
}
