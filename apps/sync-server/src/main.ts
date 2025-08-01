import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] 
        : ['http://localhost:3000'],
      credentials: true,
    }
  });
  
  await app.listen(process.env.PORT ?? 3001);
  console.log(`🚀 Sync server running on port ${process.env.PORT ?? 3001}`);
}
bootstrap();
