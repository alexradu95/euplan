import { Module, OnModuleDestroy, Inject } from '@nestjs/common';
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
          
        console.log('Environment check:');
        console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
        console.log('- POSTGRES_URL:', process.env.POSTGRES_URL ? 'Set' : 'Not set');
        console.log('- ConfigService DATABASE_URL:', configService.get<string>('DATABASE_URL') ? 'Set' : 'Not set');
        console.log('- ConfigService POSTGRES_URL:', configService.get<string>('POSTGRES_URL') ? 'Set' : 'Not set');
          
        if (!connectionString) {
          throw new Error('Database connection string not found. Please set DATABASE_URL or POSTGRES_URL environment variable.');
        }
        
        console.log('Using database connection string:', connectionString.substring(0, 20) + '...');
        
        // Create a connection pool for better performance (like the web app)
        const pool = new Pool({
          connectionString: connectionString,
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