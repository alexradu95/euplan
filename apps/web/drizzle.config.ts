import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './.env.local' });

export default defineConfig({
  schema: './lib/db/schema.ts',  // Changed from './apps/web/lib/db/schema.ts'
  out: './lib/db/migrations',     // Changed from './apps/web/lib/db/migrations'
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});