import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { AppConfig } from './config/config.module';

export const API_PREFIX = 'api/v1';

export function buildOpenApiDocument(app: INestApplication) {
  const options = new DocumentBuilder()
    .setTitle('Boikonika API')
    .setDescription(
      'REST API for the Boikonika web, PWA and mobile apps. Every response uses the envelope ' +
        '`{ success, data, message, errors, meta? }`. Authenticate with `Authorization: Bearer <accessToken>`.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addCookieAuth('bk_refresh', { type: 'apiKey', in: 'cookie' }, 'refresh-cookie')
    .build();
  return SwaggerModule.createDocument(app, options);
}

/** Shared by main.ts and the e2e tests so both run the exact same HTTP stack. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  if (config.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      // The API only serves JSON; Swagger UI (dev) needs inline assets.
      contentSecurityPolicy: config.swaggerEnabled ? false : { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || config.CORS_ORIGINS.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Requested-With', 'Idempotency-Key', 'Accept-Language', 'X-Cart-Token', 'X-Client-Platform'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  if (config.swaggerEnabled) {
    SwaggerModule.setup('api/docs', app, () => buildOpenApiDocument(app), { jsonDocumentUrl: 'api/docs-json' });
  }
}
