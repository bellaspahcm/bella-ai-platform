import { confirmBookingDeposit } from '../AutoMoveDepositConfirmationService';

const actor = '96d14c7c-6023-4572-b0fb-9e959f55e066', bookingId = '6090d1e8-b144-4a51-9464-fd83c95959e0';
const key = '1d58b8bd-b5d0-41ae-b913-96e2584c9d3e';
const tenant = 'd4f7567f-787f-46e9-86d8-206c00457b43';
const db = { query: jest.fn() };
const payload = { amount: 30000000, payment_method: 'cash', notes: 'Proof' };
const stored = { id: bookingId, tenant_id: tenant, deposit_amount: '100000000', deposit_paid: '30000000', payment_status: 'partially_paid' };
const receipt = { id: key, booking_id: bookingId, amount: '30000000', payment_method: 'cash', transaction_ref: null, notes: 'Proof',
  status: 'confirmed', created_by: actor, confirmed_by: actor };
beforeEach(() => { jest.clearAllMocks(); db.query.mockResolvedValue({ rows: [] }); });

it.each([0, -1, 1.5, Infinity, '30'])('rejects invalid amount %s before database work', async amount => {
  await expect(confirmBookingDeposit(db, actor, bookingId, key, { ...payload, amount })).rejects.toMatchObject({ code: 'INVALID_DEPOSIT_AMOUNT' });
  expect(db.query).not.toHaveBeenCalled();
});
it.each([{ ...payload, tenant_id: tenant }, { ...payload, confirmed_by: actor }, { ...payload, notes: {} }])('rejects client authority or non-text fields before writes', async value => {
  await expect(confirmBookingDeposit(db, actor, bookingId, key, value)).rejects.toMatchObject({ code: 'INVALID_DEPOSIT_REQUEST' });
  expect(db.query).not.toHaveBeenCalled();
});
it('rejects an invalid key without generating a replacement operation', async () => {
  await expect(confirmBookingDeposit(db, actor, bookingId, 'invalid', payload)).rejects.toMatchObject({ code: 'INVALID_DEPOSIT_REQUEST' });
  expect(db.query).not.toHaveBeenCalled();
});
it('requires canonical active identity/tenant', async () => {
  await expect(confirmBookingDeposit(db, actor, bookingId, key, payload)).rejects.toMatchObject({ code: 'ACTOR_NOT_AUTHORIZED', httpStatus: 403 });
  expect(db.query).toHaveBeenCalledTimes(1);
});
it('returns the same receipt/current balance on retry without another write', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ tenant_id: tenant }] }).mockResolvedValueOnce({ rows: [{ ...stored, deposit_paid: '60000000' }] }).mockResolvedValueOnce({ rows: [receipt] });
  const replay = await confirmBookingDeposit(db, actor, bookingId, key, payload);
  expect(replay).toMatchObject({ isDuplicate: true, data: { deposit_id: key, new_deposit_paid: 60000000, remaining: 40000000 } });
  expect(db.query).toHaveBeenCalledTimes(3);
  expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('for update'), [bookingId, tenant]);
});
it('replays a full deposit before checking an additional overpayment', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ tenant_id: tenant }] }).mockResolvedValueOnce({ rows: [{ ...stored, deposit_paid: '100000000', payment_status: 'fully_paid' }] })
    .mockResolvedValueOnce({ rows: [{ ...receipt, amount: '100000000' }] });
  expect(await confirmBookingDeposit(db, actor, bookingId, key, { ...payload, amount: 100000000 })).toMatchObject({ isDuplicate: true, data: { remaining: 0 } });
});
it.each([{ ...receipt, amount: '1' }, { ...receipt, booking_id: key }, { ...receipt, created_by: key }, { ...receipt, status: 'refunded' }])('rejects conflicting/revoked receipt reuse without modifying it', async existing => {
  db.query.mockResolvedValueOnce({ rows: [{ tenant_id: tenant }] }).mockResolvedValueOnce({ rows: [stored] }).mockResolvedValueOnce({ rows: [existing] });
  await expect(confirmBookingDeposit(db, actor, bookingId, key, payload)).rejects.toMatchObject({ code: 'DEPOSIT_IDEMPOTENCY_CONFLICT' });
  expect(db.query).toHaveBeenCalledTimes(3);
});
it('does not let a new key exceed the remaining requirement', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ tenant_id: tenant }] }).mockResolvedValueOnce({ rows: [{ ...stored, deposit_paid: '80000000' }] }).mockResolvedValueOnce({ rows: [] });
  await expect(confirmBookingDeposit(db, actor, bookingId, key, payload)).rejects.toMatchObject({ code: 'DEPOSIT_EXCEEDS_REQUIRED_AMOUNT' });
  expect(db.query).toHaveBeenCalledTimes(3);
});
it('writes a new receipt then the exact booking balance without changing lifecycle status', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ tenant_id: tenant }] }).mockResolvedValueOnce({ rows: [{ ...stored, deposit_paid: '0' }] })
    .mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: key }] }).mockResolvedValueOnce({ rows: [stored] });
  expect(await confirmBookingDeposit(db, actor, bookingId, key, payload)).toMatchObject({ isDuplicate: false, data: { deposit_id: key, new_deposit_paid: 30000000 } });
  expect(db.query).toHaveBeenNthCalledWith(4, expect.stringContaining('insert into public.auto_deposits'), [key, tenant, bookingId, 30000000, 'cash', null, 'Proof', actor]);
  expect(db.query).toHaveBeenNthCalledWith(5, expect.stringContaining('update public.auto_bookings'), [30000000, 'partially_paid', bookingId, tenant]);
});
