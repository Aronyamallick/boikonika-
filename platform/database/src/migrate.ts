import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createPool } from './client';

/**
 * Applies every pending migration in ./migrations inside a transaction and records it in
 * drizzle.__drizzle_migrations. Used for development, test and production (CI/CD runs it
 * before starting the new release). Never edit an applied migration — add a new one.
 */
async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = createPool({ connectionString: url, max: 1, ssl: process.env.DATABASE_SSL === 'true', applicationName: 'boikonika-migrate', statementTimeoutMs: 0 });
  try {
    const started = Date.now();
    await migrate(createDb(pool), { migrationsFolder: join(__dirname, '..', 'migrations') });
    console.log(`Migrations applied to ${new URL(url).pathname.slice(1)} in ${Date.now() - started}ms`);
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
