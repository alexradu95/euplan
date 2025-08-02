import { Injectable, Logger as NestLogger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface LogContext {
  [key: string]: any;
}

@Injectable()
export class LoggerService {
  private readonly nestLogger = new NestLogger();
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';
  }

  private formatContext(context?: LogContext): string {
    if (!context || Object.keys(context).length === 0) {
      return '';
    }
    return ` ${JSON.stringify(context)}`;
  }

  debug(message: string, context?: LogContext, contextName?: string): void {
    if (this.isDevelopment) {
      this.nestLogger.debug(`${message}${this.formatContext(context)}`, contextName);
    }
  }

  log(message: string, context?: LogContext, contextName?: string): void {
    this.nestLogger.log(`${message}${this.formatContext(context)}`, contextName);
  }

  warn(message: string, context?: LogContext, contextName?: string): void {
    this.nestLogger.warn(`${message}${this.formatContext(context)}`, contextName);
  }

  error(message: string, error?: Error | string, context?: LogContext, contextName?: string): void {
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : { error };

    const fullContext = {
      ...context,
      ...(error && { error: errorDetails })
    };

    this.nestLogger.error(`${message}${this.formatContext(fullContext)}`, '', contextName);
  }

  // Specific methods for different contexts
  authLog(message: string, userId?: string, context?: LogContext): void {
    this.log(message, { ...context, userId }, 'AuthService');
  }

  authError(message: string, error?: Error, userId?: string, context?: LogContext): void {
    this.error(message, error, { ...context, userId }, 'AuthService');
  }

  wsLog(message: string, clientId?: string, context?: LogContext): void {
    this.log(message, { ...context, clientId }, 'WebSocket');
  }

  wsError(message: string, error?: Error, clientId?: string, context?: LogContext): void {
    this.error(message, error, { ...context, clientId }, 'WebSocket');
  }

  dbLog(message: string, query?: string, context?: LogContext): void {
    this.log(message, { ...context, query }, 'Database');
  }

  dbError(message: string, error?: Error, query?: string, context?: LogContext): void {
    this.error(message, error, { ...context, query }, 'Database');
  }
}