import { Module, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';
export const DATABASE_POOL = 'DATABASE_POOL';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Try multiple environment variable names to match the web app
        const connectionString = 
          configService.get<string>('DATABASE_URL') ||
          configService.get<string>('POSTGRES_URL') ||
          process.env.DATABASE_URL ||
          process.env.POSTGRES_URL;
          
        const logger = new Logger('DatabaseModule');
        logger.debug('Environment check', {
          DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
          POSTGRES_URL: process.env.POSTGRES_URL ? 'Set' : 'Not set',
          configDatabaseUrl: configService.get<string>('DATABASE_URL') ? 'Set' : 'Not set',
          configPostgresUrl: configService.get<string>('POSTGRES_URL') ? 'Set' : 'Not set'
        });
          
        if (!connectionString) {
          throw new Error('Database connection string not found. Please set DATABASE_URL or POSTGRES_URL environment variable.');
        }
        
        logger.log('Database connection established', {
          connectionPrefix: connectionString.substring(0, 20) + '...'
        });
        
        // Create a connection pool with optimized configuration
        const pool = new Pool({
          connectionString: connectionString,
          // Performance optimizations
          max: 20, // Maximum number of clients in the pool
          min: 5,  // Minimum number of clients in the pool
          idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
          connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
          maxUses: 7500, // Close (and replace) a connection after it has been used 7500 times
          // Connection validation
          keepAlive: true,
          keepAliveInitialDelayMillis: 0,
        });
        
        return pool;
      },
    },
    {
      provide: DATABASE_CONNECTION,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => {
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DATABASE_CONNECTION, DATABASE_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
  ) {}

  async onModuleDestroy() {
    await this.pool.end();
  }
}