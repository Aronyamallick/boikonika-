import { Global, Module } from '@nestjs/common';
import { Env, loadEnv } from './env';

export const APP_CONFIG = Symbol('APP_CONFIG');
export type AppConfig = Env & {
  isProduction: boolean;
  isTest: boolean;
  /** The dev-only payment simulator is on by default outside production. */
  paymentSandboxEnabled: boolean;
  swaggerEnabled: boolean;
};

export function buildConfig(env: Env = loadEnv()): AppConfig {
  const isProduction = env.NODE_ENV === 'production';
  return {
    ...env,
    isProduction,
    isTest: env.NODE_ENV === 'test',
    paymentSandboxEnabled: env.PAYMENT_SANDBOX_ENABLED ?? !isProduction,
    swaggerEnabled: env.SWAGGER_ENABLED ?? !isProduction,
  };
}

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => buildConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
