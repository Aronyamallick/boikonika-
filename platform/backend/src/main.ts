import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { buildConfig } from './config/config.module';

// Local development reads backend/.env; production gets real environment variables.
if (existsSync('.env')) process.loadEnvFile('.env');

async function bootstrap(): Promise<void> {
  const config = buildConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: config.isProduction ? new ConsoleLogger({ json: true }) : new ConsoleLogger({ prefix: 'Boikonika' }),
  });
  configureApp(app, config);
  await app.listen(config.PORT, '0.0.0.0');
  Logger.log(`API listening on port ${config.PORT} (public URL ${config.API_URL}/api/v1)${config.swaggerEnabled ? ` — docs at ${config.API_URL}/api/docs` : ''}`, 'Bootstrap');
}

bootstrap().catch((err: Error) => {
  // eslint-disable-next-line no-console
  console.error(err.message);
  process.exit(1);
});
