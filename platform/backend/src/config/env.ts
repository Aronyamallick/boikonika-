import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'yes', 'no'])])
  .transform((v) => v === true || v === 'true' || v === '1' || v === 'yes');
const csv = z.string().transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

/**
 * Every environment variable the API reads, validated at boot. The process refuses to
 * start with an invalid or unsafe production configuration instead of failing later.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    APP_URL: z.url().default('http://localhost:3000'),
    API_URL: z.url().default('http://localhost:4000'),
    CORS_ORIGINS: csv.default(['http://localhost:3000']),
    TRUST_PROXY: bool.default(false),
    SWAGGER_ENABLED: bool.optional(),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(200).default(20),
    DATABASE_SSL: bool.default(false),
    REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    COOKIE_SECURE: bool.default(false),
    COOKIE_DOMAIN: z.string().optional(),
    /** 32-byte key (base64) for encrypting sensitive columns such as KYC document numbers. */
    DATA_ENCRYPTION_KEY: z.string().min(40, 'DATA_ENCRYPTION_KEY must be a base64 encoded 32-byte key'),

    OTP_TTL_SECONDS: z.coerce.number().int().min(60).default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('auto'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_PUBLIC: z.string().default('boikonika-public'),
    S3_BUCKET_PRIVATE: z.string().default('boikonika-private'),
    S3_PUBLIC_BASE_URL: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool.default(true),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),

    MAIL_DRIVER: z.enum(['log', 'smtp']).default('log'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_SECURE: bool.default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default('Boikonika <no-reply@boikonika.com>'),

    SMS_DRIVER: z.enum(['log', 'http']).default('log'),
    SMS_API_URL: z.string().optional(),
    SMS_API_KEY: z.string().optional(),
    SMS_SENDER_ID: z.string().optional(),

    GOOGLE_CLIENT_IDS: csv.default([]),

    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().default('mailto:support@boikonika.com'),
    EXPO_ACCESS_TOKEN: z.string().optional(),

    PLATFORM_COMMISSION_PERCENT: z.coerce.number().min(0).max(100).default(10),
    PAYMENT_SANDBOX_ENABLED: bool.optional(),
    BKASH_BASE_URL: z.string().default('https://tokenized.sandbox.bka.sh/v1.2.0-beta'),
    BKASH_APP_KEY: z.string().optional(),
    BKASH_APP_SECRET: z.string().optional(),
    BKASH_USERNAME: z.string().optional(),
    BKASH_PASSWORD: z.string().optional(),
    SSLCOMMERZ_BASE_URL: z.string().default('https://sandbox.sslcommerz.com'),
    SSLCOMMERZ_STORE_ID: z.string().optional(),
    SSLCOMMERZ_STORE_PASSWORD: z.string().optional(),

    ANTHROPIC_API_KEY: z.string().optional(),
    AI_MODEL: z.string().default('claude-sonnet-5-5'),

    RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().default(60),
    RATE_LIMIT_MAX: z.coerce.number().int().default(120),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    const fail = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (!env.COOKIE_SECURE) fail('COOKIE_SECURE', 'must be true in production (HTTPS only cookies)');
    if (/change[-_]?me|example|^(dev|test)-/i.test(env.JWT_ACCESS_SECRET)) fail('JWT_ACCESS_SECRET', 'looks like a placeholder; generate a random secret');
    if (env.STORAGE_DRIVER === 's3' && (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) fail('S3_ACCESS_KEY_ID', 'S3 credentials are required');
    if (env.MAIL_DRIVER === 'log') fail('MAIL_DRIVER', 'must be smtp in production');
    if (env.PAYMENT_SANDBOX_ENABLED) fail('PAYMENT_SANDBOX_ENABLED', 'the payment sandbox must be disabled in production');
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}
