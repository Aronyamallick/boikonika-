import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { Public } from '../../common/decorators/public.decorator';
import { DB, type Database } from '../../infra/database/database.module';
import { REDIS } from '../../infra/redis/redis.module';

type Check = { status: 'up' | 'down'; latencyMs: number };

async function timed(fn: () => Promise<unknown>, timeoutMs = 2000): Promise<Check> {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([fn(), new Promise((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)))]);
    return { status: 'up', latencyMs: Date.now() - started };
  } catch {
    return { status: 'down', latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness/readiness probe with database and Redis checks' })
  @ApiResponse({ status: 200, description: 'Database reachable (status "ok", or "degraded" when only Redis is down)' })
  @ApiResponse({ status: 503, description: 'Database unreachable' })
  async check(@Res({ passthrough: true }) res: Response) {
    const [database, redis] = await Promise.all([timed(() => this.db.execute(sql`select 1`)), timed(() => this.redis.ping())]);
    const status = database.status === 'up' && redis.status === 'up' ? 'ok' : database.status === 'up' ? 'degraded' : 'down';
    // Load balancers take the instance out of rotation on 503; a Redis outage alone keeps it serving.
    if (status === 'down') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status,
      checks: { database, redis },
      version: process.env.npm_package_version ?? '0.1.0',
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
    };
  }
}
