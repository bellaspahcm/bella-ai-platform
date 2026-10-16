import { createHash } from 'node:crypto';
import { AutoMoveRecognitionAdjustmentService } from '../AutoMoveRecognitionAdjustmentService';
import { lockOpenAccountingPeriods } from '@/core/services/accounting/period-guards';

type Row = Record<string, unknown>;
const actor = '96d14c7c-6023-4572-b0fb-9e959f55e066', booking = '6090d1e8-b144-4a51-9464-fd83c95959e0';
const tenant = 'd4f7567f-787f-46e9-86d8-206c00457b43', id = 'cc7cf807-d3a1-467c-82fa-2a77dd784a8b';
const period = '00000000-0000-4000-8000-000000000009', key = '00000000-0000-4000-8000-000000000003';
const bytes = new TextEncoder().encode('Accountant approved correction');
const document = { bucket: 'automove-sale-documents', path: `${tenant}/evidence.pdf`, sha256: createHash('sha256').update(bytes).digest('hex') };
function fixture() {
  const original: Row = { id, customer_id: 'customer', vehicle_id: 'vehicle', source_document_type: 'approved_financial_snapshot', source_document_id: key,
    handover_evidence_ref: `mobility-status-log://${id}`, metadata: { command: 'recognize_vehicle_sale_revenue', snapshotId: key, handoverEvidenceId: id },
    recognized_at: new Date('2026-10-16T00:00:00Z'), sale_price_recognized: '1400000000', cost_basis_at_sale: '1000000000', accounting_policy_id: 'approved-original', accounting_policy_version: '1.0.0' };
  const rows: Row[] = [], periods: Row[] = [{ id: period, start_date: '2026-10-01', end_date: '2026-10-31', status: 'OPEN' }];
  let active = true, visible = true;
  const query = jest.fn(async (sql: string, values?: unknown[]): Promise<{ rows: Row[] }> => {
    if (sql.includes('from public.users')) return { rows: active ? [{ tenant_id: tenant, effective_date: '2026-10-16' }] : [] };
    if (sql.includes('from public.accounting_periods')) return { rows: periods };
    if (sql.includes('from public.auto_bookings')) return { rows: visible ? [{ customer_id: 'customer', vehicle_id: 'vehicle' }] : [] };
    if (sql.includes('from public.auto_vehicle_sale_recognitions')) return { rows: [original] };
    if (sql.startsWith('set local role')) return { rows: [] };
    if (sql.includes('select * from public.auto_vehicle_sale_recognition_adjustments')) return { rows: sql.includes('idempotency_key=$2') ? rows.filter(row => row.idempotency_key === values?.[1]) : rows };
    if (sql.startsWith('insert into public.auto_vehicle_sale_recognition_adjustments') && values) {
      const row: Row = { id: `00000000-0000-4000-8000-${String(rows.length + 1).padStart(12, '0')}`, recognition_id: values[1],
        adjustment_type: values[2], idempotency_key: values[3], reason: values[4], evidence_ref: values[5], affected_period_ref: values[6], created_by_user_id: values[7],
        accounting_policy_id: values[8], accounting_policy_version: values[9], sale_price_delta: values[10], cost_basis_delta: values[11], receivable_delta: values[10], refund_amount: '0',
        metadata: JSON.parse(String(values[12])), created_at: new Date(Date.UTC(2026, 9, 16, 0, 0, rows.length)) };
      rows.push(row); return { rows: [row] };
    }
    throw Error(`Unhandled adjustment query ${sql}`);
  });
  const download = jest.fn(async () => bytes), service = new AutoMoveRecognitionAdjustmentService({ query }, actor, download);
  const intent = async (delta = -100000000) => ({ action: 'price', delta, revision: (await service.state(booking)).revision, reason: 'Approved correction', document, confirmed: true });
  return { service, query, download, intent, original, rows, periods, disable: () => { active = false; }, hide: () => { visible = false; } };
}
it('appends documented deltas with original policy and a locked period, never mutating the original', async () => {
  const f = fixture(), copy = structuredClone(f.original);
  const result = await f.service.execute(booking, key, await f.intent());
  expect(result).toMatchObject({ duplicate: false, state: { salePrice: 1300000000, costBasis: 1000000000 }, entry: { periodId: period, saleDelta: -100000000 } });
  expect(f.rows[0]).toMatchObject({ adjustment_type: 'sale_revenue_adjusted', idempotency_key: key, accounting_policy_version: '1.0.0', refund_amount: '0' });
  expect(f.original).toEqual(copy);
  const calls = f.query.mock.calls.map(([sql]) => sql);
  expect(calls.findIndex(sql => sql.includes('for share'))).toBeLessThan(calls.findIndex(sql => sql.startsWith('insert into')));
  expect(calls.some(sql => /^(?:update|delete|commit|begin)\b/i.test(sql) || sql.includes('finance_'))).toBe(false);
});
it('returns the same persisted intent after close or evidence removal, but rejects a changed key payload', async () => {
  const f = fixture(), intent = await f.intent(); const first = await f.service.execute(booking, key, intent);
  f.periods[0].status = 'CLOSED'; f.download.mockRejectedValue(Error('removed'));
  expect(await f.service.execute(booking, key, intent)).toMatchObject({ duplicate: true, entry: first.entry });
  expect(f.rows).toHaveLength(1); expect(f.download).toHaveBeenCalledTimes(1);
  await expect(f.service.execute(booking, key, { ...intent, delta: 1 })).rejects.toMatchObject({ code: 'ADJUSTMENT_KEY_CONFLICT' });
});
it('keeps cost correction and full remaining reversal separate from cash, booking and vehicle state', async () => {
  const f = fixture(); await f.service.execute(booking, key, { ...await f.intent(50000000), action: 'cost' });
  const reverse = { action: 'reverse', revision: (await f.service.state(booking)).revision, reason: 'Confirmed reversal', document, confirmed: true };
  expect(await f.service.execute(booking, period, reverse)).toMatchObject({ state: { salePrice: 0, costBasis: 0, reversed: true }, entry: { saleDelta: -1400000000, costDelta: -1050000000 } });
  await expect(f.service.execute(booking, id, { ...await f.intent(), action: 'price' })).rejects.toMatchObject({ code: 'ADJUSTMENT_ALREADY_REVERSED' });
  expect(f.query.mock.calls.some(([sql]) => /update|insert into public.auto_(?:deposits|vehicles|bookings|vehicle_sale_payments)/i.test(sql.replace('for update', '')))).toBe(false);
});
it.each(['CLOSED', 'LOCKED', null])('denies non-OPEN status %s without any adjustment', async status => {
  const f = fixture(); f.periods[0].status = status;
  await expect(f.service.execute(booking, key, await f.intent())).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_NOT_OPEN' }); expect(f.rows).toHaveLength(0);
});
it('denies missing or overlapping periods and stale reviews', async () => {
  const f = fixture(), intent = await f.intent(); f.periods.splice(0);
  await expect(f.service.execute(booking, key, intent)).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_MISSING_OR_AMBIGUOUS' });
  f.periods.push({ id: period, start_date: '2026-10-01', end_date: '2026-10-31', status: 'OPEN' }); f.periods.push({ ...f.periods[0] });
  await expect(f.service.execute(booking, key, intent)).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_MISSING_OR_AMBIGUOUS' });
  await expect(f.service.execute(booking, key, { ...intent, revision: '0'.repeat(64) })).rejects.toMatchObject({ code: 'ADJUSTMENT_STALE_REVIEW' });
});
it('denies invalid evidence, unapproved confirmation and caller-owned authority/policy fields', async () => {
  const f = fixture(), intent = await f.intent();
  for (const value of [{ ...intent, confirmed: false }, { ...intent, accountingPolicyVersion: '2.0.0' }, { ...intent, createdBy: actor }]) {
    await expect(f.service.execute(booking, key, value)).rejects.toMatchObject({ code: 'ADJUSTMENT_INVALID_INTENT' });
  }
  await expect(f.service.execute(booking, key, { ...intent, document: { ...document, path: `${id}/wrong.pdf` } })).rejects.toMatchObject({ code: 'ADJUSTMENT_DOCUMENT_TENANT' });
  f.download.mockResolvedValue(new Uint8Array([1]));
  await expect(f.service.execute(booking, key, intent)).rejects.toMatchObject({ code: 'ADJUSTMENT_DOCUMENT_INVALID' }); expect(f.rows).toHaveLength(0);
});
it('requires current authority and rejects foreign-tenant or unknown/possibly posted source', async () => {
  const f = fixture(); f.disable(); await expect(f.service.state(booking)).rejects.toMatchObject({ code: 'ADJUSTMENT_FORBIDDEN' });
  const g = fixture(); g.hide(); await expect(g.service.state(booking)).rejects.toMatchObject({ code: 'ADJUSTMENT_NOT_FOUND' });
  const h = fixture(); h.original.metadata = { ...(h.original.metadata as Row), financePosting: true };
  await expect(h.service.state(booking)).rejects.toMatchObject({ code: 'ADJUSTMENT_UNPOSTED_SOURCE_NOT_PROVEN' });
});
it.each([-1400000001, Number.MAX_SAFE_INTEGER])('rejects negative or unsafe resulting totals %s', async delta => {
  const f = fixture(); await expect(f.service.execute(booking, key, await f.intent(delta))).rejects.toBeInstanceOf(Error); expect(f.rows).toHaveLength(0);
});
it('public guard verifies identity and both source/current dates, with no period creation or transaction ownership', async () => {
  const query = jest.fn(async (sql: string): Promise<{ rows: Row[] }> => ({ rows: sql.includes('from public.users') ? [{ effective_date: '2026-10-16' }] : [
    { id: key, start_date: '2026-09-01', end_date: '2026-09-30', status: 'OPEN' }, { id: period, start_date: '2026-10-01', end_date: '2026-10-31', status: 'CLOSED' },
  ] }));
  await expect(lockOpenAccountingPeriods({ query }, { actorId: actor, tenantId: tenant, sourceDate: '2026-09-15' })).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_NOT_OPEN' });
  expect(query.mock.calls.some(([sql]) => /insert|update|delete|commit|begin/i.test(sql))).toBe(false);
  await expect(lockOpenAccountingPeriods({ query }, { actorId: actor, tenantId: tenant, sourceDate: '2026-02-30' })).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_INVALID_DATE' });
});
