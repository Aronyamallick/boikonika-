import { createHmac } from 'node:crypto';
import type { AppConfig } from '../../config/config.module';
import { TokenService } from './token.service';

const config = { JWT_ACCESS_SECRET: 'unit-test-secret-unit-test-secret-0123456789', JWT_ACCESS_TTL_SECONDS: 900 } as AppConfig;

describe('TokenService', () => {
  const tokens = new TokenService(config);

  it('signs and verifies access tokens', () => {
    const { token, expiresIn } = tokens.signAccess('user-1', 'session-1');
    expect(expiresIn).toBe(900);
    const verified = tokens.verifyAccess(token);
    expect(verified).toMatchObject({ ok: true, claims: { sub: 'user-1', sid: 'session-1' } });
  });

  it('rejects modified payloads, other algorithms and other secrets', () => {
    const { token } = tokens.signAccess('user-1', 'session-1');
    const [header, payload, signature] = token.split('.');
    const changed = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), sub: 'admin' })).toString('base64url');
    expect(tokens.verifyAccess(`${header}.${changed}.${signature}`)).toEqual({ ok: false, reason: 'invalid' });
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    expect(tokens.verifyAccess(`${none}.${payload}.`)).toEqual({ ok: false, reason: 'invalid' });
    // Signed with the raw secret instead of the derived key (e.g. a token minted by another service).
    const foreign = createHmac('sha256', config.JWT_ACCESS_SECRET).update(`${header}.${payload}`).digest('base64url');
    expect(tokens.verifyAccess(`${header}.${payload}.${foreign}`)).toEqual({ ok: false, reason: 'invalid' });
    const other = new TokenService({ ...config, JWT_ACCESS_SECRET: 'another-secret-another-secret-0123456789xx' } as AppConfig);
    expect(other.verifyAccess(token)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('keeps access and two-step challenge tokens apart', () => {
    const challenge = tokens.signChallenge({ sub: 'user-1', method: 'password', device: { client: 'web', rememberDevice: true } });
    expect(tokens.verifyAccess(challenge.token).ok).toBe(false);
    const access = tokens.signAccess('user-1', 'session-1');
    expect(tokens.verifyChallenge(access.token).ok).toBe(false);
    expect(tokens.verifyChallenge(challenge.token)).toMatchObject({ ok: true, claims: { sub: 'user-1', jti: challenge.jti } });
  });

  it('reports expiry separately', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const { token } = tokens.signAccess('user-1', 'session-1');
    jest.setSystemTime(new Date('2026-01-01T00:15:01Z'));
    expect(tokens.verifyAccess(token)).toEqual({ ok: false, reason: 'expired' });
    jest.useRealTimers();
  });
});
