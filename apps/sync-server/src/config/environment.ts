/**
 * Environment configuration with validation and type safety
 */
import { z } from 'zod';

const environmentSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/, 'Port must be a number').default('3001'),
  
  // Database
  DATABASE_URL: z.string().url('Invalid database URL'),
  POSTGRES_URL: z.string().url('Invalid postgres URL').optional(),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  
  // CORS Origins (comma-separated list)
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Performance
  DB_POOL_MIN: z.string().regex(/^\d+$/).default('5'),
  DB_POOL_MAX: z.string().regex(/^\d+$/).default('20'),
  WS_SAVE_INTERVAL: z.string().regex(/^\d+$/).default('5000'),
  
  // Monitoring
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_METRICS: z.string().default('false'),
});

export type Environment = z.infer<typeof environmentSchema>;

class ConfigService {
  private config: Environment;

  constructor() {
    const result = environmentSchema.safeParse(process.env);
    
    if (!result.success) {
      console.error('❌ Invalid environment configuration:');
      result.error.issues.forEach(issue => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      process.exit(1);
    }
    
    this.config = result.data;
    console.log('✅ Environment configuration validated');
  }

  get<K extends keyof Environment>(key: K): Environment[K] {
    return this.config[key];
  }

  getNumber(key: keyof Environment): number {
    const value = this.config[key];
    if (value === undefined) {
      throw new Error(`Configuration value for ${String(key)} is undefined`);
    }
    return typeof value === 'string' ? parseInt(value, 10) : value as number;
  }

  getBoolean(key: keyof Environment): boolean {
    const value = this.config[key];
    return typeof value === 'string' ? value.toLowerCase() === 'true' : Boolean(value);
  }

  getAllowedOrigins(): string[] {
    return this.get('ALLOWED_ORIGINS').split(',').map(origin => origin.trim());
  }

  isDevelopment(): boolean {
    return this.get('NODE_ENV') === 'development';
  }

  isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }
}

export const config = new ConfigService();