import { addressSchema, checkoutSchema, couponSchema, payoutAccountSchema, sellerOrderUpdateSchema } from './commerce';

const address = { recipientName: 'Nadia Rahman', phone: '01712345678', division: 'dhaka', district: 'gazipur', upazila: 'Tongi', area: 'Station Road', addressLine: 'House 12, Road 3' };

describe('commerce schemas', () => {
  it('normalises a Bangladesh address and checks the district belongs to the division', () => {
    const ok = addressSchema.parse({ ...address, postcode: '১৭১০' });
    expect(ok).toMatchObject({ phone: '+8801712345678', postcode: '1710', label: 'home', isDefault: false });
    expect(addressSchema.safeParse({ ...address, district: 'sylhet' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...address, division: 'mars' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...address, postcode: '12' }).success).toBe(false);
  });
  it('requires an idempotency key and a known payment method at checkout', () => {
    const base = { addressId: '6b0f8e2e-9a41-4d8b-9f2a-0d6c3c2b1a10', paymentMethod: 'cod', idempotencyKey: 'chk_0123456789abcdef' };
    expect(checkoutSchema.parse(base)).toMatchObject({ shippingMethod: 'standard' });
    expect(checkoutSchema.safeParse({ ...base, idempotencyKey: 'short' }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, paymentMethod: 'bitcoin' }).success).toBe(false);
  });
  it('needs a reason to cancel a seller order', () => {
    expect(sellerOrderUpdateSchema.safeParse({ status: 'cancelled' }).success).toBe(false);
    expect(sellerOrderUpdateSchema.safeParse({ status: 'cancelled', note: 'Out of print' }).success).toBe(true);
    expect(sellerOrderUpdateSchema.safeParse({ status: 'shipped', trackingUrl: 'http://track.example.com/1' }).success).toBe(false);
  });
  it('validates payout accounts by method', () => {
    expect(payoutAccountSchema.parse({ method: 'bkash', accountName: 'Karim', accountNumber: '০১৭১২-৩৪৫৬৭৮' }).accountNumber).toBe('01712345678');
    expect(payoutAccountSchema.safeParse({ method: 'bkash', accountName: 'Karim', accountNumber: '123456789' }).success).toBe(false);
    expect(payoutAccountSchema.safeParse({ method: 'bank', accountName: 'Karim', accountNumber: '123456789012' }).success).toBe(false);
    expect(payoutAccountSchema.safeParse({ method: 'bank', accountName: 'Karim', accountNumber: '123456789012', bankName: 'Sonali Bank', routingNumber: '200270522' }).success).toBe(true);
  });
  it('bounds coupon values', () => {
    expect(couponSchema.safeParse({ code: 'boi10', type: 'percent', value: '10' }).data?.code).toBe('BOI10');
    expect(couponSchema.safeParse({ code: 'BIG', type: 'percent', value: '150' }).success).toBe(false);
    expect(couponSchema.safeParse({ code: 'SHIPFREE', type: 'free_shipping', value: '0' }).success).toBe(true);
    expect(couponSchema.safeParse({ code: 'ZERO', type: 'fixed', value: '0' }).success).toBe(false);
  });
});
