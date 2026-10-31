import { createTestApp, resetState, uniquePhone, type TestContext } from './utils';

describe('Rate limiting (e2e)', () => {
  let ctx: TestContext;
  const previous = process.env.AUTH_RATE_LIMIT_MAX;

  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT_MAX = '3';
    ctx = await createTestApp();
    await resetState(ctx);
  });
  afterAll(async () => {
    process.env.AUTH_RATE_LIMIT_MAX = previous;
    await ctx.app.close();
  });

  it('limits sign-in attempts per IP with Retry-After, without touching other routes', async () => {
    const ip = '192.0.2.44';
    for (let i = 0; i < 3; i++) {
      await ctx.http.post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ identifier: uniquePhone(), password: 'whatever-1' }).expect(401);
    }
    const blocked = await ctx.http.post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ identifier: uniquePhone(), password: 'whatever-1' }).expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after-auth'] ?? blocked.headers['retry-after'])).toBeGreaterThan(0);
    // Another client is unaffected, and so are non-auth routes for the same client.
    await ctx.http.post('/api/v1/auth/login').set('X-Forwarded-For', '192.0.2.45').send({ identifier: uniquePhone(), password: 'whatever-1' }).expect(401);
    await ctx.http.get('/api/v1/health').set('X-Forwarded-For', ip).expect(200);
  });
});
