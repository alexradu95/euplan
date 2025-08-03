/**
 * Rate limiting for WebSocket connections and API endpoints
 */
import { Logger } from '@nestjs/common';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
}

export interface RateLimitEntry {
  requests: number;
  resetTime: number;
  blocked: boolean;
}

export class RateLimiter {
  private static readonly logger = new Logger('RateLimiter');
  private static readonly stores = new Map<string, Map<string, RateLimitEntry>>();
  
  /**
   * Create a rate limiter for a specific operation
   */
  static create(operation: string, config: RateLimitConfig): (clientId: string) => boolean {
    if (!this.stores.has(operation)) {
      this.stores.set(operation, new Map());
    }

    return (clientId: string): boolean => {
      return this.checkRateLimit(operation, clientId, config);
    };
  }

  /**
   * Check if a client has exceeded rate limits
   */
  private static checkRateLimit(
    operation: string,
    clientId: string,
    config: RateLimitConfig
  ): boolean {
    const store = this.stores.get(operation)!;
    const now = Date.now();
    const entry = store.get(clientId);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance to trigger cleanup
      this.cleanup(store, now);
    }

    if (!entry || now > entry.resetTime) {
      // New window or expired entry
      store.set(clientId, {
        requests: 1,
        resetTime: now + config.windowMs,
        blocked: false,
      });
      return true;
    }

    if (entry.blocked) {
      return false;
    }

    entry.requests++;

    if (entry.requests > config.maxRequests) {
      entry.blocked = true;
      this.logger.warn(`🚨 Rate limit exceeded for client ${clientId} on operation ${operation}`, {
        operation,
        clientId,
        requests: entry.requests,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
      });
      return false;
    }

    return true;
  }

  /**
   * Clean up expired entries
   */
  private static cleanup(store: Map<string, RateLimitEntry>, now: number): void {
    for (const [clientId, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(clientId);
      }
    }
  }

  /**
   * Get rate limit status for a client
   */
  static getStatus(operation: string, clientId: string): RateLimitEntry | null {
    const store = this.stores.get(operation);
    return store?.get(clientId) || null;
  }

  /**
   * Reset rate limit for a client (admin function)
   */
  static reset(operation: string, clientId: string): void {
    const store = this.stores.get(operation);
    if (store) {
      store.delete(clientId);
      this.logger.log(`Rate limit reset for client ${clientId} on operation ${operation}`);
    }
  }
}