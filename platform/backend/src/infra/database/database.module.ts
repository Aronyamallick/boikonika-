import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { createDb, createPool, type Database } from '@boikonika/database';
import type { Pool } from 'pg';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';

export const PG_POOL = Symbol('PG_POOL');
export const DB = Symbol('DB');
export type { Database };

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        createPool({ connectionString: config.DATABASE_URL, max: config.DATABASE_POOL_MAX, ssl: config.DATABASE_SSL, applicationName: 'boikonika-api' }),
    },
    { provide: DB, inject: [PG_POOL], useFactory: (pool: Pool) => createDb(pool) },
  ],
  exports: [PG_POOL, DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    this.pool.on('error', (err) => this.logger.error(`Idle PostgreSQL client error: ${err.message}`));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
