import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { REDIS } from './redis.module';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

// Fixed window counter + block key, atomically. Returns {hits, ttlMs, blocked, blockTtlMs}.
const SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  return {hits, redis.call('PTTL', KEYS[1]), 1, blockTtl}
end
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return {hits, ttl, 1, tonumber(ARGV[3])}
end
return {hits, ttl, 0, 0}
`;

/**
 * Rate-limit counters in Redis so limits hold across every API instance. If Redis is unreachable the
 * request is allowed (and logged): availability wins, and account-level lockouts live in PostgreSQL.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger('RateLimit');

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    const base = `rl:${throttlerName}:${key}`;
    try {
      const [hits, ttlMs, blocked, blockTtlMs] = (await this.redis.eval(SCRIPT, 2, `${base}:hits`, `${base}:block`, ttl, limit, blockDuration || ttl)) as number[];
      return {
        totalHits: hits!,
        timeToExpire: Math.max(1, Math.ceil(ttlMs! / 1000)),
        isBlocked: blocked === 1,
        timeToBlockExpire: blocked === 1 ? Math.max(1, Math.ceil(blockTtlMs! / 1000)) : 0,
      };
    } catch (error) {
      this.logger.warn(`Rate limiter unavailable, allowing request: ${(error as Error).message}`);
      return { totalHits: 0, timeToExpire: Math.ceil(ttl / 1000), isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
