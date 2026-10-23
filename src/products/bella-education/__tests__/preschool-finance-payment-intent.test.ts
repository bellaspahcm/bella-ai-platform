import { parsePaymentIntent, preparePaymentIntent, paymentIntentStorageKey, type FinancePaymentIntent } from '../finance/services/preschool-finance-payment-intent';
const scope = { actorId: 'actor-a', tenantId: 'tenant-a', branchId: 'branch-a' };
describe('approved durable browser request identity boundary', () => {
  it('recovers exactly the same operation key and payload from persisted JSON after reload', () => {
    const first = preparePaymentIntent(null, scope, 'invoice-a', 20.5, 'CASH', () => 'stable-key');
    const restored = parsePaymentIntent(JSON.stringify(first), scope, 'invoice-a');
    expect(preparePaymentIntent(restored, scope, 'invoice-a', 20.5, 'CASH', () => { throw new Error('must not allocate another key'); })).toEqual(first);
  });
  it.each([{ actorId: 'other' }, { tenantId: 'other' }, { branchId: 'other' }])('rejects another identity/scope without converting to not found: %j', (change) => {
    const first = preparePaymentIntent(null, scope, 'invoice-a', 20, 'CASH', () => 'key');
    expect(() => parsePaymentIntent(JSON.stringify(first), { ...scope, ...change }, 'invoice-a')).toThrow();
  });
  it('fails closed on corrupt persisted state', () => { expect(() => parsePaymentIntent('{', scope, 'invoice-a')).toThrow(); });
  it.each(['CARD', 'untrusted-select-value', { toString: () => 'CASH' }])('rejects an undeclared runtime method before allocating a key (%p)', value => {
    const allocate = jest.fn(() => 'must-not-persist');
    expect(() => preparePaymentIntent(null, scope, 'invoice-a', 20, value as FinancePaymentIntent['paymentMethod'], allocate)).toThrow('Phương thức');
    expect(allocate).not.toHaveBeenCalled();
    const valid = preparePaymentIntent(null, scope, 'invoice-a', 20, 'CASH', () => 'key');
    expect(() => parsePaymentIntent(JSON.stringify({ ...valid, paymentMethod: value }), scope, 'invoice-a')).toThrow();
  });
  it('distinguishes missing state from corrupt state', () => { expect(parsePaymentIntent(null, scope, 'invoice-a')).toBeNull(); });
  it('rejects changed payload while retaining the original operation', () => {
    const first = preparePaymentIntent(null, scope, 'invoice-a', 20, 'CASH', () => 'key');
    expect(() => preparePaymentIntent(first, scope, 'invoice-a', 21, 'CASH', () => 'different-key')).toThrow();
    expect(() => preparePaymentIntent(first, scope, 'invoice-a', 20, 'BANK_TRANSFER', () => 'different-key')).toThrow();
    expect(first.operationKey).toBe('key');
  });

  it('corrects a rejected payload with the SAME key after reload; the next pending attempt is immutable again', () => {
    const first = preparePaymentIntent(null, scope, 'invoice-a', 200, 'CASH', () => 'original-key');
    const restored = parsePaymentIntent(JSON.stringify({ ...first, correctable: true }), scope, 'invoice-a');
    const corrected = preparePaymentIntent(restored, scope, 'invoice-a', 20, 'BANK_TRANSFER', () => { throw new Error('must keep key'); }, first.operationKey);
    expect(corrected).toMatchObject({ operationKey: 'original-key', paymentAmount: 20, paymentMethod: 'BANK_TRANSFER' });
    expect(corrected.correctable).toBeUndefined();
    expect(() => preparePaymentIntent(corrected, scope, 'invoice-a', 21, 'CASH', () => 'new')).toThrow();
  });

  it('never permits editing a persisted canonical success', () => {
    const first = preparePaymentIntent(null, scope, 'invoice-a', 20, 'CASH', () => 'key');
    const restored = parsePaymentIntent(JSON.stringify({ ...first, correctable: true, result: { paymentId: 'p', receiptId: 'r' } }), scope, 'invoice-a');
    expect(restored?.correctable).toBeUndefined();
    expect(() => preparePaymentIntent(restored, scope, 'invoice-a', 21, 'CASH', () => 'new')).toThrow();
  });
  it('preserves acknowledged canonical IDs for another result check rather than creating a new payment', () => {
    const first = { ...preparePaymentIntent(null, scope, 'invoice-a', 20, 'CASH', () => 'key'), result: { paymentId: 'payment-a', receiptId: 'receipt-a' } };
    const restored = parsePaymentIntent(JSON.stringify(first), scope, 'invoice-a');
    expect(preparePaymentIntent(restored, scope, 'invoice-a', 20, 'CASH', () => 'unwanted-new-key')).toEqual(first);
  });
  it('does not share persistence namespace across branch/actor/invoice', () => {
    const keys = [paymentIntentStorageKey(scope, 'invoice-a'), paymentIntentStorageKey({ ...scope, branchId: 'branch-b' }, 'invoice-a'),
      paymentIntentStorageKey({ ...scope, actorId: 'actor-b' }, 'invoice-a'), paymentIntentStorageKey(scope, 'invoice-b')];
    expect(new Set(keys).size).toBe(4);
  });
  it.each([null, 'replacement-key'])('refuses to allocate or recover a different key for a stale open tab (%s)', (replacementKey) => {
    const saved = replacementKey ? preparePaymentIntent(null, scope, 'invoice-a', 20, 'CASH', () => replacementKey) : null;
    const allocate = jest.fn(() => 'unwanted-new-key');
    expect(() => preparePaymentIntent(saved, scope, 'invoice-a', 20, 'CASH', allocate, 'original-key')).toThrow('thẻ khác');
    expect(allocate).not.toHaveBeenCalled();
  });
});
