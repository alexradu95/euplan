/**
 * Performance monitoring and metrics collection
 */
import { Logger } from '@nestjs/common';
import { config } from '../config/environment';

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  context?: Record<string, unknown>;
  success: boolean;
}

export interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  activeConnections: number;
  documentRooms: number;
  timestamp: number;
}

export class PerformanceMonitor {
  private static readonly logger = new Logger('PerformanceMonitor');
  private static metrics: PerformanceMetric[] = [];
  private static readonly MAX_METRICS = 1000; // Keep last 1000 metrics in memory
  private static systemMetricsInterval?: NodeJS.Timeout;

  static initialize(): void {
    if (config.getBoolean('ENABLE_METRICS')) {
      this.logger.log('📊 Performance monitoring enabled');
      this.startSystemMetricsCollection();
    }
  }

  /**
   * Track operation performance
   */
  static async trackOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    const startTime = process.hrtime.bigint();
    let success = true;
    
    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      this.recordMetric({
        operation,
        duration,
        timestamp: Date.now(),
        context,
        success,
      });

      // Log slow operations
      if (duration > this.getSlowOperationThreshold(operation)) {
        this.logger.warn(`🐌 Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`, {
          operation,
          duration,
          context,
        });
      }
    }
  }

  /**
   * Track synchronous operation performance
   */
  static trackSync<T>(
    operation: string,
    fn: () => T,
    context?: Record<string, unknown>
  ): T {
    const startTime = process.hrtime.bigint();
    let success = true;
    
    try {
      const result = fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      this.recordMetric({
        operation,
        duration,
        timestamp: Date.now(),
        context,
        success,
      });
    }
  }

  /**
   * Get performance statistics for an operation
   */
  static getOperationStats(operation: string): {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
  } | null {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    
    if (operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics.map(m => m.duration);
    const successCount = operationMetrics.filter(m => m.success).length;

    return {
      count: operationMetrics.length,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: successCount / operationMetrics.length,
    };
  }

  /**
   * Get system health metrics
   */
  static getSystemHealth(): {
    memory: NodeJS.MemoryUsage;
    uptime: number;
    performance: {
      slowOperations: PerformanceMetric[];
      recentErrors: PerformanceMetric[];
    };
  } {
    const slowOperations = this.metrics.filter(m => 
      m.duration > this.getSlowOperationThreshold(m.operation)
    ).slice(-10); // Last 10 slow operations

    const recentErrors = this.metrics.filter(m => 
      !m.success && Date.now() - m.timestamp < 300000 // Last 5 minutes
    ).slice(-10); // Last 10 errors

    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      performance: {
        slowOperations,
        recentErrors,
      },
    };
  }

  /**
   * Clean up old metrics
   */
  static cleanup(): void {
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  private static recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Periodic cleanup
    if (this.metrics.length % 100 === 0) {
      this.cleanup();
    }
  }

  private static getSlowOperationThreshold(operation: string): number {
    // Define thresholds for different operations
    const thresholds: Record<string, number> = {
      'database_query': 100,
      'document_load': 200,
      'document_save': 300,
      'websocket_message': 50,
      'user_authentication': 150,
    };

    return thresholds[operation] || 500; // Default 500ms
  }

  private static startSystemMetricsCollection(): void {
    this.systemMetricsInterval = setInterval(() => {
      const metrics = process.memoryUsage();
      
      // Log if memory usage is high
      const heapUsedMB = metrics.heapUsed / 1024 / 1024;
      if (heapUsedMB > 500) { // 500MB threshold
        this.logger.warn(`🚨 High memory usage: ${heapUsedMB.toFixed(2)}MB`, {
          memory: metrics,
          uptime: process.uptime(),
        });
      }
    }, 60000); // Every minute
  }

  static shutdown(): void {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    this.logger.log('📊 Performance monitoring stopped');
  }
}