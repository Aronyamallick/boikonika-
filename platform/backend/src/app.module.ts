import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { EnvelopeInterceptor } from './common/http/envelope.interceptor';
import { RequestIdMiddleware } from './common/http/request-id.middleware';
import { DatabaseModule } from './infra/database/database.module';
import { RedisModule } from './infra/redis/redis.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [ConfigModule, DatabaseModule, RedisModule, ScheduleModule.forRoot(), HealthModule],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
