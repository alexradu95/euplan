// Client-side logging utility
interface LogContext {
  [key: string]: any
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isClient = typeof window !== 'undefined'

  private shouldLog(level: LogLevel): boolean {
    // In production, only log warnings and errors from client
    if (!this.isDevelopment && this.isClient) {
      return level >= LogLevel.WARN
    }
    return true
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return
    
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.INFO)) return
    
    if (this.isDevelopment) {
      console.info(this.formatMessage('info', message, context))
    }
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.WARN)) return
    
    console.warn(this.formatMessage('warn', message, context))
    
    // In production, could send to monitoring service
    if (!this.isDevelopment && this.isClient) {
      this.sendToMonitoring('warn', message, context)
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog(LogLevel.ERROR)) return
    
    const errorContext = {
      ...context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      })
    }
    
    console.error(this.formatMessage('error', message, errorContext))
    
    // In production, always send errors to monitoring
    if (!this.isDevelopment && this.isClient) {
      this.sendToMonitoring('error', message, errorContext)
    }
  }

  private sendToMonitoring(level: string, message: string, context?: LogContext): void {
    // Placeholder for monitoring service integration
    // Could integrate with Sentry, LogRocket, etc.
    if (typeof window !== 'undefined' && window.fetch) {
      fetch('/api/logging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          message,
          context,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(() => {
        // Silently fail - don't log errors about logging
      })
    }
  }
}

export const logger = new Logger()

// Convenience exports
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context)
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context)
export const logWarn = (message: string, context?: LogContext) => logger.warn(message, context)
export const logError = (message: string, error?: Error, context?: LogContext) => logger.error(message, error, context)