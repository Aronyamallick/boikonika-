// Test environment: isolated database, local storage and log drivers. Never point this at production.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://boikonika:boikonika_dev_pw@127.0.0.1:5432/boikonika_test';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379/15';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-0123456789';
process.env.DATA_ENCRYPTION_KEY ??= 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
process.env.STORAGE_DRIVER ??= 'local';
process.env.STORAGE_LOCAL_DIR ??= './storage-test';
process.env.MAIL_DRIVER ??= 'log';
process.env.SMS_DRIVER ??= 'log';
process.env.RATE_LIMIT_MAX ??= '10000';
process.env.AUTH_RATE_LIMIT_MAX ??= '10000';
// Lets tests simulate different client networks with X-Forwarded-For.
process.env.TRUST_PROXY ??= 'true';
process.env.GOOGLE_CLIENT_IDS ??= 'test-google-client-id.apps.googleusercontent.com';
