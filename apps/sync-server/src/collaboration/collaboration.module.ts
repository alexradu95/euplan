import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CollaborationGateway } from './collaboration.gateway';
import { DocumentsService } from '../documents/documents.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [CollaborationGateway, DocumentsService],
  exports: [CollaborationGateway, DocumentsService],
})
export class CollaborationModule {}