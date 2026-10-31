import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { APP_CONFIG, type AppConfig } from '../src/config/config.module';

describe('HTTP stack (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app, app.get<AppConfig>(APP_CONFIG));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health reports database and redis up inside the envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ success: true, message: '', errors: [], data: { status: 'ok', checks: { database: { status: 'up' }, redis: { status: 'up' } } } });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('echoes a well-formed X-Request-Id and replaces a malformed one', async () => {
    const ok = await request(app.getHttpServer()).get('/api/v1/health').set('X-Request-Id', 'abc12345-trace');
    expect(ok.headers['x-request-id']).toBe('abc12345-trace');
    const bad = await request(app.getHttpServer()).get('/api/v1/health').set('X-Request-Id', '<script>');
    expect(bad.headers['x-request-id']).not.toBe('<script>');
  });

  it('returns a JSON 404 envelope without a stack trace for unknown routes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toMatchObject({ success: false, data: null, code: 'NOT_FOUND' });
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|node_modules/);
  });

  it('rejects oversized JSON bodies with 413', async () => {
    const big = JSON.stringify({ text: 'x'.repeat(1_100_000) });
    const res = await request(app.getHttpServer()).post('/api/v1/health').set('Content-Type', 'application/json').send(big);
    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it('sends security headers and hides the framework', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('only allows configured CORS origins', async () => {
    const allowed = await request(app.getHttpServer()).get('/api/v1/health').set('Origin', 'http://localhost:3000');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const denied = await request(app.getHttpServer()).get('/api/v1/health').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves the OpenAPI document', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.paths['/api/v1/health']).toBeDefined();
  });
});
