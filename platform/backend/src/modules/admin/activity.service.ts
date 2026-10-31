import { Inject, Injectable } from '@nestjs/common';
import { type Database } from '@boikonika/database';
import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DB } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';

/** Bangladesh calendar day, which is what "daily active" means here. */
const dhakaDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());

/**
 * Counts a signed-in user as active for the day — one row per user per day, nothing about what they
 * did — for DAU/MAU. Redis makes it one database write per user per day at most.
 */
@Injectable()
export class ActivityService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  touch(userId: string, platform: 'web' | 'android' | 'ios'): void {
    const day = dhakaDay();
    void this.redis
      .set(`active:${day}:${userId}`, '1', 'EX', 2 * 86_400, 'NX')
      .then((first) => (first ? this.db.execute(sql`insert into user_activity_days (user_id, day, platform) values (${userId}, ${day}, ${platform}) on conflict do nothing`) : null))
      .catch(() => undefined);
  }
}
