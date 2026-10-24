import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        const logger = new Logger('Redis');
        const client = new Redis(config.REDIS_URL, {
          maxRetriesPerRequest: 2,
          enableOfflineQueue: true,
          lazyConnect: false,
          retryStrategy: (times) => Math.min(times * 200, 5000),
        });
        client.on('error', (err) => logger.warn(`Redis error: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
