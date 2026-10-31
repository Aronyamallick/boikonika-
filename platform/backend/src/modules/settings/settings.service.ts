import { Inject, Injectable } from '@nestjs/common';
import { systemSettings, type Database } from '@boikonika/database';
import { eq } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';

const CACHE_SECONDS = 60;

/** Typed access to admin-editable settings (system_settings), cached briefly in Redis. */
@Injectable()
export class SettingsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const cacheKey = `setting:${key}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      // fall through to the database
    }
    const [row] = await this.db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, key));
    const value = (row?.value as T | undefined) ?? fallback;
    await this.redis.set(cacheKey, JSON.stringify(value), 'EX', CACHE_SECONDS).catch(() => undefined);
    return value;
  }

  async number(key: string, fallback: number): Promise<number> {
    const value = Number(await this.get<unknown>(key, fallback));
    return Number.isFinite(value) ? value : fallback;
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.del(`setting:${key}`).catch(() => undefined);
  }
}
