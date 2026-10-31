import type Redis from 'ioredis';
import { buildConfig } from '../../../config/config.module';
import { loadEnv } from '../../../config/env';
import { BkashGateway } from './bkash.gateway';
import type { StoredPayment } from './gateway';
import { SslcommerzGateway } from './sslcommerz.gateway';

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://unused',
  JWT_ACCESS_SECRET: 'unit-test-secret-0123456789abcdefghijklmnop',
  DATA_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
  BKASH_APP_KEY: 'k',
  BKASH_APP_SECRET: 's',
  BKASH_USERNAME: 'u',
  BKASH_PASSWORD: 'p',
  SSLCOMMERZ_STORE_ID: 'store',
  SSLCOMMERZ_STORE_PASSWORD: 'pass',
} as NodeJS.ProcessEnv);
const config = buildConfig(env);
const payment: StoredPayment = { id: '11111111-2222-4333-8444-555555555555', amount: '820.00', method: 'card', providerPaymentId: 'PAY123', providerTransactionId: null };

function mockFetch(...bodies: Array<Record<string, unknown>>) {
  const queue = [...bodies];
  return jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify(queue.shift() ?? {}), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

afterEach(() => jest.restoreAllMocks());

describe('SSLCOMMERZ verification', () => {
  const gateway = new SslcommerzGateway(config);

  it('accepts a VALID response for our transaction, amount and currency', async () => {
    mockFetch({ status: 'VALID', tran_id: payment.id, amount: '820.00', currency_type: 'BDT', bank_tran_id: 'BANK1', val_id: 'VAL1' });
    await expect(gateway.validate(payment, 'VAL1')).resolves.toMatchObject({ status: 'paid', transactionId: 'BANK1', eventId: 'valid:VAL1' });
  });

  it.each([
    ['another transaction', { status: 'VALID', tran_id: 'someone-else', amount: '820.00', currency_type: 'BDT' }],
    ['a smaller amount', { status: 'VALID', tran_id: payment.id, amount: '82.00', currency_type: 'BDT' }],
    ['another currency', { status: 'VALID', tran_id: payment.id, amount: '820.00', currency_type: 'USD' }],
    ['an invalid status', { status: 'INVALID_TRANSACTION', tran_id: payment.id, amount: '820.00' }],
  ])('rejects %s', async (_label, body) => {
    mockFetch(body);
    const result = await gateway.validate(payment, 'VAL1');
    expect(result.status).not.toBe('paid');
  });

  it('never stores credentials from provider payloads', async () => {
    mockFetch({ status: 'VALID', tran_id: payment.id, amount: '820.00', currency_type: 'BDT', store_passwd: 'leak', val_id: 'V' });
    const result = await gateway.validate(payment, 'V');
    expect(JSON.stringify(result.raw)).not.toContain('leak');
  });
});

describe('bKash verification', () => {
  const redis = { get: jest.fn().mockResolvedValue('cached-token'), set: jest.fn(), del: jest.fn() } as unknown as Redis;
  const gateway = new BkashGateway(config, redis);
  const bkashPayment = { ...payment, method: 'bkash' as const };

  it('treats an executed payment with the right amount as paid', async () => {
    mockFetch({ statusCode: '0000', transactionStatus: 'Completed', amount: '820.00', trxID: 'TRX1', paymentID: 'PAY123' });
    await expect(gateway.execute(bkashPayment)).resolves.toMatchObject({ status: 'paid', transactionId: 'TRX1' });
  });

  it('refuses a completed payment for a different amount', async () => {
    mockFetch({ statusCode: '0000', transactionStatus: 'Completed', amount: '1.00', trxID: 'TRX2' });
    await expect(gateway.execute(bkashPayment)).resolves.toMatchObject({ status: 'failed', failureReason: 'amount_mismatch' });
  });

  it('confirms through the status API when execute was already done', async () => {
    const spy = mockFetch({ statusCode: '2117', statusMessage: 'Payment execution already been called before' }, { statusCode: '0000', transactionStatus: 'Completed', amount: '820.00', trxID: 'TRX3' });
    await expect(gateway.execute(bkashPayment)).resolves.toMatchObject({ status: 'paid', transactionId: 'TRX3' });
    expect(String(spy.mock.calls[1]?.[0])).toContain('/payment/status');
  });
});
