import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Create a connection pool for better performance
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL!,
});

// Export the database instance with schema
export const db = drizzle(pool, { schema });