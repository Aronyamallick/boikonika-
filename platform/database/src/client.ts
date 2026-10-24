import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Either the root database handle or an open transaction — services accept both. */
export type DbOrTx = Database | Transaction;

export interface PoolOptions {
  connectionString: string;
  max?: number;
  ssl?: boolean;
  applicationName?: string;
  statementTimeoutMs?: number;
}

export function createPool(options: PoolOptions): Pool {
  const config: PoolConfig = {
    connectionString: options.connectionString,
    max: options.max ?? 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: options.applicationName ?? 'boikonika',
    // A runaway query must never hold a connection forever.
    statement_timeout: options.statementTimeoutMs ?? 15_000,
    ssl: options.ssl ? { rejectUnauthorized: true } : undefined,
  };
  return new Pool(config);
}

export function createDb(pool: Pool): Database {
  return drizzle(pool, { schema, casing: 'snake_case' });
}
