import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { Logger } from '@nestjs/common';
import { config } from './config/environment';
import { PerformanceMonitor } from './common/performance-monitor';

class SocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): unknown {
    const cors = {
      origin: config.getAllowedOrigins(),
      credentials: true,
    };
    
    const optionsWithCors = {
      cors,
      ...(options || {}),
    } as ServerOptions;

    return super.createIOServer(port, optionsWithCors);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Initialize performance monitoring
  PerformanceMonitor.initialize();
  
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: config.getAllowedOrigins(),
      credentials: true,
    }
  });
  
  // Configure WebSocket adapter with CORS
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  
  const port = config.getNumber('PORT');
  await app.listen(port);
  
  logger.log('Sync server started successfully', {
    port,
    environment: config.get('NODE_ENV'),
    websocketEnabled: true,
    allowedOrigins: config.getAllowedOrigins(),
    performanceMonitoring: config.getBoolean('ENABLE_METRICS')
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    logger.log('SIGTERM received, shutting down gracefully');
    PerformanceMonitor.shutdown();
    process.exit(0);
  });
}
bootstrap();
