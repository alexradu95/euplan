import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CollaborationGateway } from './collaboration.gateway';
import { DocumentsService } from '../documents/documents.service';
import { DatabaseModule } from '../database/database.module';
import { JwtService } from '../auth/jwt.service';
import { LoggerService } from '../common/logger.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [CollaborationGateway, DocumentsService, JwtService, LoggerService],
  exports: [CollaborationGateway, DocumentsService, JwtService, LoggerService],
})
export class CollaborationModule {}