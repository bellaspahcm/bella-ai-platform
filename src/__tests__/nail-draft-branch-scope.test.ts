import { upsertBookingRecord } from '@/core/services/order/create-booking-helpers';

jest.mock('@/core/services/order/commission-actions', () => ({ resolveKtvCommission: jest.fn() }));
jest.mock('@/services/audit-actions', () => ({ recordAuditLog: jest.fn() }));

type Scope = { tenantId: string; customerId: string; branchId: string };
type Operation = { table: string; action: string; filters: Record<string, unknown>; payload?: unknown };
const scope: Scope = { tenantId: 'nail', customerId: 'customer', branchId: 'branch-b' };
const draft = { id: 'draft', tenant_id: 'nail', customer_id: 'customer', branch_id: 'branch-b', deposit_amount: 100000 };

function client(children: { session_logs?: unknown[]; revenue?: unknown[]; error?: boolean } = {}, concurrentChange = false) {
  const operations: Operation[] = [];
  return {
    operations,
    from(table: string) {
      let action = 'read';
      const filters: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => { filters[field] = value; return query; },
        update: (payload: unknown) => { action = 'update'; operations.push({ table, action, filters, payload }); return query; },
        returns: async () => { operations.push({ table, action, filters }); return { data: children[table as 'session_logs' | 'revenue'] ?? [], error: children.error ? { message: 'unavailable' } : null }; },
        single: async () => ({ data: concurrentChange ? null : { ...draft }, error: concurrentChange ? { message: 'No matching row' } : null }),
      };
      return query;
    },
  };
}

async function upsert(db: ReturnType<typeof client>, existing = draft, overrides: Partial<Scope> = {}, scoped = true) {
  const expected = { ...scope, ...overrides };
  const params = {
    supabase: db as never,
    existingBooking: existing as never,
    bookingPayload: { tenant_id: expected.tenantId, customer_id: expected.customerId, branch_id: expected.branchId, full_price: 300000, total_sessions: 2 } as never,
    ...(scoped ? { expectedDraftScope: expected } : {}),
  };
  return upsertBookingRecord(params);
}

describe('Nail pending booking scope: approved no-transfer invariant', () => {
  it.each([
    { ...draft, branch_id: 'branch-a' },
    { ...draft, branch_id: null },
    { ...draft, tenant_id: 'other-tenant' },
    { ...draft, customer_id: 'other-customer' },
  ])('refuses mismatched or legacy-unscoped draft before any update: %j', async existing => {
    const db = client();
    const original = JSON.stringify(existing);
    const result = await upsert(db, existing as typeof draft);
    expect(result).toEqual({ error: expect.any(String) });
    expect(db.operations.some(x => x.action === 'update')).toBe(false);
    expect(JSON.stringify(existing)).toBe(original);
  });

  it.each(['session_logs', 'revenue'] as const)('rejects inconsistent %s without changing booking or children', async table => {
    const children = { [table]: [{ tenant_id: 'nail', branch_id: 'branch-a' }] };
    const original = JSON.stringify(children);
    const db = client(children);
    expect(await upsert(db)).toEqual({ error: expect.any(String) });
    expect(db.operations.some(x => x.action === 'update')).toBe(false);
    expect(JSON.stringify(children)).toBe(original);
  });

  it('rejects an unverifiable child scope rather than treating query failure as empty', async () => {
    const db = client({ error: true });
    expect(await upsert(db)).toEqual({ error: expect.any(String) });
    expect(db.operations.some(x => x.action === 'update')).toBe(false);
  });

  it('reuses same-scope draft and conditions the update on its tenant/customer/branch', async () => {
    const db = client({ session_logs: [{ tenant_id: 'nail', branch_id: 'branch-b' }], revenue: [{ tenant_id: 'nail', branch_id: 'branch-b' }] });
    expect(await upsert(db)).toEqual({ booking: draft });
    expect(db.operations.find(x => x.action === 'update')?.filters).toEqual({ id: 'draft', tenant_id: 'nail', customer_id: 'customer', branch_id: 'branch-b' });
  });

  it('fails if the matching row disappears or changes before conditional update', async () => {
    const db = client({}, true);
    expect(await upsert(db)).toEqual({ error: expect.any(String) });
  });

  it('leaves the existing Haircut/unscoped upsert path unchanged', async () => {
    const db = client();
    expect(await upsert(db, { ...draft, branch_id: 'branch-a' }, {}, false)).toEqual({ booking: draft });
    expect(db.operations).toHaveLength(1);
    expect(db.operations[0].filters).toEqual({ id: 'draft' });
  });
});
