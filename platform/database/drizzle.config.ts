import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://boikonika:boikonika_dev_pw@127.0.0.1:5432/boikonika_dev' },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
