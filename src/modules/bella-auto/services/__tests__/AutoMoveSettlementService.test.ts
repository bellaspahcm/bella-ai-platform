import { createHash, randomUUID } from 'node:crypto';
import { AutoMoveSettlementService } from '../AutoMoveSettlementService';
import { AutoMoveSaleChainService } from '../AutoMoveSaleChainService';
import { MobilityFoundationService } from '@/platform/mobility';
import type { MobilityVehicleTrace } from '@/platform/mobility';

const actor = randomUUID(), tenant = randomUUID(), bookingId = randomUUID(), deposit = randomUUID(), vehicle = randomUUID();
const bytes = new TextEncoder().encode('Owner confirmed refund evidence');
const document = { bucket: 'automove-sale-documents', path: `${tenant}/proof.pdf`, sha256: createHash('sha256').update(bytes).digest('hex') };
const intent = { action: 'refund', receiptType: 'deposit', receiptId: deposit, amount: 40, reason: 'Confirmed manual refund', document, confirmed: true };
type Row = Record<string, unknown>;
const trace = jest.spyOn(MobilityFoundationService.prototype, 'getVehicleTrace');
const transition = jest.spyOn(MobilityFoundationService.prototype, 'transitionVehicleStatus');
function fixture() {
  const booking: Row = { id: bookingId, tenant_id: tenant, deposit_paid: 100, status: 'confirmed', vehicle_id: null };
  const actions: Row[] = []; let active = true;
  const query = jest.fn();
  query.mockImplementation(async (sql: string, values?: readonly unknown[]) => {
    if (sql.includes('from public.users')) return { rows: active ? [{ tenant_id: tenant }] : [] };
    if (sql.startsWith('select * from public.auto_bookings')) return { rows: [booking] };
    if (sql.includes('from public.auto_deposits')) return { rows: [{ id: deposit, amount: 100 }] };
    if (sql.includes('from public.auto_vehicle_sale_payments') || sql.includes('from public.auto_vehicle_sale_recognitions')) return { rows: [] };
    if (sql.includes('select * from public.auto_vehicle_sale_settlement_actions')) return { rows: sql.includes('idempotency_key') ? actions.filter(row => row.idempotency_key === values?.[1]) : actions };
    if (sql.startsWith('set local role')) return { rows: [] };
    if (sql.startsWith('update public.auto_bookings')) { booking.status = 'cancelled'; return { rows: [{ id: bookingId }] }; }
    if (sql.includes('insert into public.auto_vehicle_sale_settlement_actions') && values) {
      const row = { id: randomUUID(), tenant_id: values[0], booking_id: values[1], idempotency_key: values[2], action_type: values[3],
        source_deposit_id: values[4], source_payment_id: values[5], amount: values[6], reason: values[7], source_document: JSON.parse(String(values[8])),
        request_hash: values[9], created_by: values[10], created_at: new Date() };
      actions.push(row); return { rows: [row] };
    }
    throw new Error(`Unhandled query ${sql}`);
  });
  const download = jest.fn(async () => bytes);
  return { service: new AutoMoveSettlementService({ query }, actor, download), query, download, booking, actions, disable: () => { active = false; } };
}
beforeEach(() => { jest.clearAllMocks(); });
afterAll(() => jest.restoreAllMocks());
it('records an independent refund fact and replays it without rechecking mutable Storage', async () => {
  const f = fixture(), key = randomUUID();
  const first = await f.service.execute(bookingId, key, intent);
  expect(first.state).toMatchObject({ grossReceived: 100, refunded: 40, netReceived: 60, recognitionId: null, issues: [] });
  f.download.mockRejectedValue(new Error('Document later removed'));
  expect(await f.service.execute(bookingId, key, intent)).toMatchObject({ duplicate: true, action: first.action });
  expect(f.actions).toHaveLength(1); expect(f.download).toHaveBeenCalledTimes(1);
  expect(f.query.mock.calls.some(([sql]) => /update public.auto_deposits|insert into public.auto_vehicle_sale_recognitions|finance_|recognition_adjustments/.test(sql))).toBe(false);
  await expect(f.service.execute(bookingId, key, { ...intent, amount: 30 })).rejects.toMatchObject({ code: 'SETTLEMENT_KEY_CONFLICT' });
});
it('caps cumulative refunds per receipt and rejects missing receipt or unconfirmed input', async () => {
  const f = fixture(); await f.service.execute(bookingId, randomUUID(), intent);
  await expect(f.service.execute(bookingId, randomUUID(), { ...intent, amount: 61 })).rejects.toMatchObject({ code: 'SETTLEMENT_REFUND_EXCEEDS_RECEIPT' });
  await expect(f.service.execute(bookingId, randomUUID(), { ...intent, receiptId: randomUUID() })).rejects.toMatchObject({ code: 'SETTLEMENT_RECEIPT_NOT_FOUND' });
  await expect(f.service.execute(bookingId, randomUUID(), { ...intent, confirmed: false })).rejects.toMatchObject({ code: 'SETTLEMENT_INVALID_INTENT' });
  expect(f.actions).toHaveLength(1);
});
it('does not double-refund a legacy refunded booking without reconcilable canonical facts', async () => {
  const f = fixture(); f.booking.payment_status = 'refunded';
  expect(await f.service.state(bookingId)).toMatchObject({ issues: ['LEGACY_REFUND_REQUIRES_RECONCILIATION'] });
  await expect(f.service.execute(bookingId, randomUUID(), intent)).rejects.toMatchObject({ code: 'SETTLEMENT_RECONCILIATION_MISMATCH' });
  expect(f.actions).toHaveLength(0);
});
it('rejects client authority, wrong tenant, invalid evidence and inactive accountant before writes', async () => {
  const f = fixture();
  await expect(f.service.execute(bookingId, randomUUID(), { ...intent, role: 'accountant' })).rejects.toMatchObject({ code: 'SETTLEMENT_INVALID_INTENT' });
  await expect(f.service.execute(bookingId, randomUUID(), { ...intent, document: { ...document, path: `${randomUUID()}/proof.pdf` } })).rejects.toMatchObject({ code: 'SETTLEMENT_DOCUMENT_TENANT' });
  f.download.mockResolvedValue(new Uint8Array([1]));
  await expect(f.service.execute(bookingId, randomUUID(), intent)).rejects.toMatchObject({ code: 'SETTLEMENT_DOCUMENT_INVALID' });
  f.disable(); await expect(f.service.state(bookingId)).rejects.toMatchObject({ code: 'SETTLEMENT_FORBIDDEN' });
  expect(f.actions).toHaveLength(0);
});
it.each(['23505','40001'])('preserves original write error %s instead of masking it with a role reset in an aborted transaction', async code => {
  const f=fixture(), base=f.query.getMockImplementation();
  f.query.mockImplementation(async(sql:string,values?:readonly unknown[])=>{
    if(sql.includes('insert into public.auto_vehicle_sale_settlement_actions'))throw Object.assign(new Error('Original conflict'),{code});
    if(!base)throw Error('Fixture query missing');return base(sql,values);
  });
  await expect(f.service.execute(bookingId,randomUUID(),intent)).rejects.toMatchObject({code});
  expect(f.query).not.toHaveBeenCalledWith('set local role authenticated');
});
it('cancels independently without refunding cash or inventing a revenue reversal', async () => {
  const f = fixture(), key = randomUUID(), cancel = { action: 'cancel', reason: 'Owner confirmed cancellation', document, confirmed: true };
  const first = await f.service.execute(bookingId, key, cancel);
  expect(first.state).toMatchObject({ bookingStatus: 'cancelled', refunded: 0, netReceived: 100, canCancel: false });
  expect(await f.service.execute(bookingId, key, cancel)).toMatchObject({ duplicate: true });
  await expect(f.service.execute(bookingId, randomUUID(), cancel)).rejects.toMatchObject({ code: 'SETTLEMENT_ALREADY_CANCELLED' });
});
it('uses only the existing Mobility contract to release this booking allocation', async () => {
  const f = fixture(); f.booking.vehicle_id = vehicle;
  const value = vehicleTrace('allocated', bookingId);
  trace.mockResolvedValue(value);
  transition.mockResolvedValue({ value: value.vehicle, isDuplicate: false });
  await f.service.execute(bookingId, randomUUID(), { action: 'cancel', reason: 'Cancelled before handover', document, confirmed: true });
  expect(transition).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant }), expect.objectContaining({ vehicleId: vehicle, toStatus: 'showroom' }));
});
it('does not release a delivered vehicle and rejects another booking allocation', async () => {
  const f = fixture(); f.booking.vehicle_id = vehicle;
  trace.mockResolvedValue(vehicleTrace('allocated', randomUUID()));
  const cancel = { action: 'cancel', reason: 'Confirmed cancellation', document, confirmed: true };
  await expect(f.service.execute(bookingId, randomUUID(), cancel)).rejects.toMatchObject({ code: 'SETTLEMENT_ALLOCATION_MISMATCH' });
  trace.mockResolvedValue(vehicleTrace('delivered', bookingId));
  await f.service.execute(bookingId, randomUUID(), cancel);
  expect(transition).not.toHaveBeenCalled();
});
function vehicleTrace(status: 'allocated' | 'delivered', booking: string): MobilityVehicleTrace {
  return { vehicle: { id: vehicle, tenantId: tenant, variantId: randomUUID(), vin: 'TESTVEHICLE0000001',
    colorExterior: 'White', modelYear: 2026, listPrice: 0, costPrice: 0, metadata: {}, status,
    allocatedToContractId: booking, createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z' },
  lifecycleEvents: [], ownerships: [], serviceHistory: [], domainEvents: [] };
}
it('rejects unsafe gross money before netting refunds can hide a rounding loss at recognition', async () => {
  const snapshot = randomUUID(), evidenceId = randomUUID(), customer = randomUUID();
  const query = jest.fn();
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('from public.users')) return { rows: [{ id: actor, tenant_id: tenant, role: 'accountant', status: 'active' }] };
    if (sql.includes('from public.auto_bookings')) return { rows: [{ id: bookingId, tenant_id: tenant, vehicle_id: vehicle, customer_id: customer, status: 'confirmed' }] };
    if (sql.includes('from public.customers')) return { rows: [{ id: customer }] };
    if (sql.includes('from public.auto_vehicle_sale_financial_snapshots')) return { rows: [{ id: snapshot, tenant_id: tenant, booking_id: bookingId,
      vehicle_id: vehicle, customer_id: customer, status: 'approved', approved_by: actor, approved_at: new Date(),
      sale_transaction_id: randomUUID(), sale_price: 1000, discount_amount: 0, cost_basis: 700 }] };
    if (sql.includes('from public.auto_deposits')) return { rows: [{ amount: '9007199254740992' }] };
    if (sql.includes('from public.auto_vehicle_sale_settlement_actions')) return { rows: [{ amount: '9007199254740991' }] };
    return { rows: [] };
  });
  const evidence = vehicleTrace('delivered',bookingId);
  evidence.vehicle.deliveredToCustomerId = customer;
  evidence.lifecycleEvents.push({ id: evidenceId, tenantId: tenant, vehicleId: vehicle, toStatus: 'delivered',
    changedByUserId: actor, createdAt: '2026-10-15T00:00:00Z', metadata: { bookingId, customerId: customer } });
  trace.mockResolvedValue(evidence);
  await expect(new AutoMoveSaleChainService({query},actor,async()=>bytes).recognize({snapshotId:snapshot,handoverEvidenceId:evidenceId}))
    .rejects.toMatchObject({code:'PAYMENT_INVALID'});
  expect(query.mock.calls.some(([sql]) => sql.includes('insert into public.auto_vehicle_sale_recognitions'))).toBe(false);
});
