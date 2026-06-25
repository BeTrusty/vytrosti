import { loadEnvConfig } from '@next/env';

// Load Next.js environment variables (including .env.local)
loadEnvConfig(process.cwd());
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { pool: Pool | undefined };

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is not set in production');
}

// Fallback to empty string for migrations generation and local CLI operations where dotenv is loaded separately
const pool = globalForDb.pool ?? new Pool({
  connectionString: connectionString || 'postgres://localhost/dummy',
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
