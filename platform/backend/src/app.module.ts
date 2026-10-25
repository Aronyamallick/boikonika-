import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { AUTH_THROTTLED } from './common/decorators/throttle.decorators';
import { AuthGuard } from './common/guards/auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { EnvelopeInterceptor } from './common/http/envelope.interceptor';
import { RequestIdMiddleware } from './common/http/request-id.middleware';
import { APP_CONFIG, ConfigModule, type AppConfig } from './config/config.module';
import { CryptoModule } from './infra/crypto/crypto.module';
import { DatabaseModule } from './infra/database/database.module';
import { MessagingModule } from './infra/messaging/messaging.module';
import { REDIS, RedisModule } from './infra/redis/redis.module';
import { RedisThrottlerStorage } from './infra/redis/throttler.storage';
import { StorageModule } from './infra/storage/storage.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DevController } from './modules/dev/dev.controller';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { KycModule } from './modules/kyc/kyc.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RbacModule } from './modules/rbac/rbac.module';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    CryptoModule,
    StorageModule,
    MessagingModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG, REDIS],
      useFactory: (config: AppConfig, redis: Redis) => ({
        storage: new RedisThrottlerStorage(redis),
        throttlers: [
          { name: 'default', ttl: config.RATE_LIMIT_TTL_SECONDS * 1000, limit: config.RATE_LIMIT_MAX },
          {
            name: 'auth',
            ttl: 60_000,
            limit: config.AUTH_RATE_LIMIT_MAX,
            skipIf: (context) => !Reflect.getMetadata(AUTH_THROTTLED, context.getHandler()),
          },
        ],
      }),
    }),
    AuditModule,
    SettingsModule,
    NotificationsModule,
    RbacModule,
    AuthModule,
    ProfilesModule,
    KycModule,
    CatalogModule,
    MarketplaceModule,
    CommerceModule,
    ReviewsModule,
    CreatorsModule,
    HealthModule,
  ],
  controllers: isProduction ? [] : [DevController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    // Order matters: rate limit → authenticate → authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
