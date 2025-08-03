import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { Logger } from '@nestjs/common';

class SocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): unknown {
    const cors = {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] 
        : ['http://localhost:3000'],
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
  
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] 
        : ['http://localhost:3000'],
      credentials: true,
    }
  });
  
  // Configure WebSocket adapter with CORS
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port);
  
  logger.log('Sync server started successfully', {
    port,
    environment: process.env.NODE_ENV || 'development',
    websocketEnabled: true
  });
}
bootstrap();
