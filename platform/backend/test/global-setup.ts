import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/** Brings the test database to the latest migration and loads reference data once per run. */
export default function globalSetup(): void {
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://boikonika:boikonika_dev_pw@127.0.0.1:5432/boikonika_test' };
  const dist = join(__dirname, '..', '..', 'database', 'dist');
  execFileSync('node', [join(dist, 'migrate.js')], { env, stdio: 'inherit' });
  execFileSync('node', [join(dist, 'seed', 'index.js')], { env, stdio: 'ignore' });
}
