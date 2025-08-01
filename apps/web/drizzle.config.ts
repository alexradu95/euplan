import { defineConfig } from 'drizzle-kit';
import * as dotenv from "dotenv";

// Load environment variables from the web app
dotenv.config({ path: './apps/web/.env.local' });

export default defineConfig({
  schema: './apps/web/lib/db/schema.ts',
  out: './apps/web/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});