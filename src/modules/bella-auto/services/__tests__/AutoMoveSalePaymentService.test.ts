import { AutoMoveSalePaymentService } from '../AutoMoveSalePaymentService';

const actor = '96d14c7c-6023-4572-b0fb-9e959f55e066', bookingId = '6090d1e8-b144-4a51-9464-fd83c95959e0';
const recognitionId = 'cc7cf807-d3a1-467c-82fa-2a77dd784a8b', key = '00000000-0000-4000-8000-000000000003';
const tenant = 'd4f7567f-787f-46e9-86d8-206c00457b43';
const intent = { amount: 300000000, paymentMethod: 'bank_transfer', transactionRef: 'bank-001', notes: null };
type Row = Record<string, unknown>;
function fixture() {
  const booking: Row = { id: bookingId, tenant_id: tenant, customer_id: 'customer', vehicle_id: 'vehicle', deposit_paid: '100000000', status: 'completed', payment_status: 'fully_paid' };
  const recognition: Row = { id: recognitionId, customer_id: 'customer', vehicle_id: 'vehicle', sale_price_recognized: '1400000000',
    payment_received_total: '100000000', deposit_received_total: '100000000', receivable_amount_at_recognition: '1300000000' };
  const payments: Row[] = [], adjustments: Row[] = [];
  let active = true, recognized = true;
  const query = jest.fn();
  query.mockImplementation(async (sql: string, values?: readonly unknown[]) => {
    if (sql.includes('from public.users')) return { rows: active ? [{ tenant_id: tenant }] : [] };
    if (sql.includes('from public.auto_bookings')) return { rows: [booking] };
    if (sql.includes('from public.auto_vehicle_sale_recognitions')) return { rows: recognized ? [recognition] : [] };
    if (sql.includes('from public.auto_deposits')) return { rows: sql.includes('transaction_ref=$4') ? [] : [{ id: 'deposit', amount: '100000000', status: 'confirmed' }] };
    if (sql.includes('from public.auto_vehicle_sale_recognition_adjustments')) return { rows: adjustments };
    if (sql.includes('insert into public.auto_vehicle_sale_payments') && values) {
      const row = { id: key, tenant_id: values[0], booking_id: values[1], recognition_id: values[2], idempotency_key: values[3], amount: values[4],
        payment_method: values[5], transaction_ref: values[6], notes: values[7], received_by: values[8], received_at: new Date('2026-10-15T00:00:00Z') };
      payments.push(row); return { rows: [row] };
    }
    if (sql.includes('from public.auto_vehicle_sale_payments')) return { rows: sql.includes('idempotency_key=$2') ? payments.filter(row => row.idempotency_key === values?.[1]) : payments };
    throw new Error(`Unhandled query: ${sql}`);
  });
  return { service: new AutoMoveSalePaymentService({ query }, actor), query, booking, recognition, payments, adjustments,
    disable: () => { active = false; }, unrecognize: () => { recognized = false; } };
}
it('persists a separate receipt and reconciles approved sale less deposits, without updating either source', async () => {
  const f = fixture();
  const result = await f.service.collect(bookingId, key, intent);
  expect(result).toMatchObject({ duplicate: false, state: { status: 'MATCHED', saleAmount: 1400000000,
    depositReceived: 100000000, postSaleReceived: 300000000, totalReceived: 400000000, outstanding: 1000000000 } });
  expect(f.query.mock.calls.some(([sql]) => /^update\s|finance_|accounting_outbox/.test(sql))).toBe(false);
});
it('replays the same persisted intent without a second receipt even after cancellation', async () => {
  const f = fixture(), first = await f.service.collect(bookingId, key, intent);
  f.booking.status = 'cancelled';
  expect(await f.service.collect(bookingId, key, intent)).toMatchObject({ duplicate: true, receipt: first.receipt });
  expect(f.payments).toHaveLength(1);
  await expect(f.service.collect(bookingId, '00000000-0000-4000-8000-000000000004', intent)).rejects.toMatchObject({ code: 'PAYMENT_COLLECTION_CLOSED' });
});
it.each([{ ...intent, amount: 1 }, { ...intent, transactionRef: 'different' }, { ...intent, notes: 'different' }])('rejects changed intent on the same key', async value => {
  const f = fixture(); await f.service.collect(bookingId, key, intent);
  await expect(f.service.collect(bookingId, key, value)).rejects.toMatchObject({ code: 'PAYMENT_KEY_CONFLICT' });
  expect(f.payments).toHaveLength(1);
});
it.each([0, -1, 1.1, Infinity, '300', Number.MAX_SAFE_INTEGER + 1])('rejects invalid amount %s without DB work', async amount => {
  const f = fixture();
  await expect(f.service.collect(bookingId, key, { ...intent, amount })).rejects.toMatchObject({ code: 'INVALID_PAYMENT' });
  expect(f.query).not.toHaveBeenCalled();
});
it.each([{ ...intent, tenant_id: tenant }, { ...intent, receivedBy: actor }, { ...intent, transactionRef: null }])('rejects client authority and missing bank reference', async value => {
  await expect(fixture().service.collect(bookingId, key, value)).rejects.toMatchObject({ code: 'INVALID_PAYMENT' });
});
it('requires recognized source and canonical active accountant context', async () => {
  const f = fixture(); f.disable();
  await expect(f.service.state(bookingId)).rejects.toMatchObject({ code: 'PAYMENT_FORBIDDEN' });
  const g = fixture(); g.unrecognize();
  expect(await g.service.state(bookingId)).toMatchObject({ status: 'NOT_RECOGNIZED', canCollect: false });
  await expect(g.service.collect(bookingId, key, intent)).rejects.toMatchObject({ code: 'PAYMENT_RECOGNITION_REQUIRED' });
});
it('detects missing deposit receipts instead of silently treating them as cash already collected', async () => {
  const f = fixture(); f.booking.deposit_paid = '200000000';
  expect(await f.service.state(bookingId)).toMatchObject({ status: 'MISMATCH', issues: ['DEPOSIT_RECEIPT_MISMATCH'], canCollect: false });
  await expect(f.service.collect(bookingId, key, intent)).rejects.toMatchObject({ code: 'PAYMENT_RECONCILIATION_MISMATCH' });
  expect(f.payments).toHaveLength(0);
});
it('blocks overpayment and unresolved refund effects without inventing a refund policy', async () => {
  const f = fixture();
  await expect(f.service.collect(bookingId, key, { ...intent, amount: 1300000001 })).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_OUTSTANDING' });
  f.adjustments.push({ adjustment_type: 'refund_recorded', sale_price_delta: '0', receivable_delta: '0', refund_amount: '1' });
  expect(await f.service.state(bookingId)).toMatchObject({ status: 'MISMATCH', issues: ['REFUND_OR_ADJUSTMENT_REQUIRES_RESOLUTION'] });
});
