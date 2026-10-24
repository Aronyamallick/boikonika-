import { existsSync } from 'node:fs';
import { createDb, createPool } from '../client';
import { seedSuperAdmin } from './admin';
import { seedContent } from './content';
import { seedDemo } from './demo';
import { seedCategories, seedGamification, seedGenres, seedRbac, seedSettings, seedShipping } from './reference';

/**
 * Idempotent seed: reference data (roles, permissions, categories, genres, badges, challenges,
 * shipping methods, settings), default CMS content, the first super admin (SEED_ADMIN_*), and with
 * --demo a fictional public-domain demo catalogue. Safe to run on every deploy.
 */
async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const demo = process.argv.includes('--demo');
  const pool = createPool({ connectionString: url, max: 2, applicationName: 'boikonika-seed', statementTimeoutMs: 60_000 });
  const db = createDb(pool);
  const log = (message: string) => console.log(`[seed] ${message}`);
  const started = Date.now();
  try {
    await seedRbac(db);
    log('roles and permissions');
    await seedCategories(db);
    await seedGenres(db);
    log('categories and genres');
    await seedGamification(db);
    log('badges and reading challenges');
    await seedShipping(db);
    await seedSettings(db);
    log('shipping methods and settings');
    await seedContent(db);
    log('CMS pages, homepage sections and FAQs');
    await seedSuperAdmin(db, log);
    if (demo) await seedDemo(db, log);
    log(`done in ${Date.now() - started}ms`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
