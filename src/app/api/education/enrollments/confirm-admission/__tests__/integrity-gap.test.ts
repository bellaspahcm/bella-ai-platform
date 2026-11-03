/** @jest-environment node */
/**
 * Diagnostic characterization of the unchanged route, not acceptance of its behavior.
 * The fake driver returns database errors and records attempts. It does not implement
 * PostgreSQL constraints, locks, transactions or durability; there is no database I/O.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Row = Record<string, unknown>;
type Result = { data: Row | Row[] | null; error: { code: string; message: string } | null; count?: number | null };
type Action = 'select' | 'insert' | 'update';
type Attempt = { table: string; action: Action; payload: unknown };
type Query = { table: string; action: Action; payload: unknown; count: boolean };

const tenantId = '10000000-0000-4000-8000-000000000001';
const actorId = '10000000-0000-4000-8000-000000000002';
const enrollmentId = '10000000-0000-4000-8000-000000000003';
const studentPartyId = '10000000-0000-4000-8000-000000000004';
const courseId = '10000000-0000-4000-8000-000000000005';
const initialInvoice = { id: '10000000-0000-4000-8000-000000000006', invoice_number: 'SYN-EXISTING', net_amount: 5700000, paid_amount: 0, outstanding_amount: 5700000, settlement_status: 'UNPAID' };
const actor = { id: actorId, tenant_id: tenantId, tenant_status: 'active', status: 'active', role: 'admin', email: 'synthetic@example.test', full_name: 'Synthetic Admin', avatar_url: null };

let mockStatus: 'pending' | 'active';
let mockInvoices: Row[];
let mockPaymentCount: number;
let mockFail: Set<string>;
let mockZeroRowActivation: boolean;
let mockRace: boolean;
let mockInvoiceReads: number;
let mockReleaseRace: () => void;
let mockRaceGate: Promise<void>;
const mockAttempts: Attempt[] = [];
const mockReads: string[] = [];

async function mockExecute(query: Query): Promise<Result> {
  const operation = query.count ? 'count' : query.action;
  if (query.action === 'select') mockReads.push(`${query.table}:${operation}`);
  else mockAttempts.push({ table: query.table, action: query.action, payload: query.payload });
  if (mockFail.has(`${query.table}:${operation}`)) {
    return { data: null, error: { code: 'XX000', message: 'Synthetic returned database failure' }, count: null };
  }
  if (query.action === 'select') {
    if (query.table === 'edu_enrollments') return query.count
      ? { data: null, error: null, count: mockStatus === 'active' ? 1 : 0 }
      : { data: { id: enrollmentId, tenant_id: tenantId, student_party_id: studentPartyId, course_id: courseId, status: mockStatus, request_id: 'synthetic-enrollment-request' }, error: null };
    if (query.table === 'students') return { data: { student_id: 'synthetic-legacy-student', party_id: studentPartyId, student_code: 'SYN001' }, error: null };
    if (query.table === 'edu_fin_billing_periods') return { data: { id: '10000000-0000-4000-8000-000000000007' }, error: null };
    if (query.table === 'edu_fin_invoices') {
      const snapshot = mockInvoices.map(row => ({ ...row }));
      if (mockRace) {
        if (++mockInvoiceReads === 2) mockReleaseRace();
        await mockRaceGate;
      }
      return { data: snapshot, error: null };
    }
    return { data: null, error: null };
  }
  if (query.table === 'edu_enrollments') {
    if (mockZeroRowActivation) return { data: [], error: null, count: 0 };
    mockStatus = 'active';
  }
  if (query.table === 'edu_fin_invoices' && query.action === 'insert') mockInvoices.push(query.payload as Row);
  if (query.table === 'edu_fin_invoices' && query.action === 'update') Object.assign(mockInvoices[0], query.payload);
  if (query.table === 'edu_fin_payments') mockPaymentCount++;
  return { data: null, error: null };
}

function mockFrom(table: string) {
  const query: Query = { table, action: 'select', payload: null, count: false };
  const chain = {
    select: (_columns: string, options?: { count?: string; head?: boolean }) => { query.count = options?.count === 'exact'; return chain; },
    insert: (payload: unknown) => { query.action = 'insert'; query.payload = payload; return chain; },
    update: (payload: unknown) => { query.action = 'update'; query.payload = payload; return chain; },
    eq: (_key: string, _value: unknown) => chain,
    or: (_filter: string) => chain,
    order: (_column: string, _options: unknown) => chain,
    limit: (_count: number) => chain,
    maybeSingle: () => mockExecute(query),
    then: (resolve: (result: Result) => void, reject?: (error: unknown) => void) => mockExecute(query).then(resolve, reject),
  };
  return chain;
}

jest.mock('@/lib/supabase-server', () => ({ createClient: async () => ({
  auth: {
    getSession: async () => ({ data: { session: { access_token: 'synthetic-offline-session' } }, error: null }),
    getUser: async () => ({ data: { user: { id: actorId } }, error: null }),
  },
  rpc: async () => ({ data: [actor], error: null }),
}) }));
jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'http://127.0.0.1:1', getSupabaseAdminKey: () => 'synthetic-offline-key',
}));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: mockFrom }) }));
const { POST } = require('../route') as typeof import('../route');

function confirm(mode: 'PAID' | 'DEBT' = 'PAID') {
  return POST(new Request('http://localhost/api/education/enrollments/confirm-admission', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrollmentId, admissionMode: mode }),
  }));
}
const writes = (table: string) => mockAttempts.filter(attempt => attempt.table === table);

describe('GL05 known integrity gaps — diagnostic only, runtime remains HELD', () => {
  beforeEach(() => {
    mockStatus = 'pending'; mockInvoices = []; mockPaymentCount = 0;
    mockFail = new Set(); mockZeroRowActivation = false; mockRace = false; mockInvoiceReads = 0;
    mockAttempts.length = 0; mockReads.length = 0;
    mockRaceGate = new Promise<void>(resolve => { mockReleaseRace = resolve; });
  });

  it.each(['PAID', 'DEBT'] as const)('characterizes the existing successful %s sequence without declaring its fees canonical', async mode => {
    const response = await confirm(mode);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, admissionMode: mode, enrollment: { status: 'active' } });
    expect(writes('edu_fin_invoices')).toHaveLength(1);
    expect(writes('edu_fin_invoice_line_items')).toHaveLength(1);
    expect(writes('edu_fin_payments')).toHaveLength(mode === 'PAID' ? 1 : 0);
  });

  it.each([
    { failed: 'edu_fin_invoices:insert', existing: false },
    { failed: 'edu_fin_invoice_line_items:insert', existing: false },
    { failed: 'edu_fin_payments:insert', existing: false },
    { failed: 'edu_fin_invoices:update', existing: true },
    { failed: 'edu_fin_payments:insert', existing: true },
    { failed: 'edu_enrollments:count', existing: false },
    { failed: 'edu_courses:update', existing: false },
  ])('exposes success despite returned $failed error (existing invoice: $existing)', async ({ failed, existing }) => {
    if (existing) mockInvoices = [{ ...initialInvoice }];
    mockFail.add(failed);
    const response = await confirm();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, enrollment: { status: 'active' } });
    expect(mockStatus).toBe('active'); // Fake driver state, not actual persistence.
    expect(writes('edu_enrollments')).toHaveLength(1);
  });

  it('exposes active success after a zero-row activation while the fake row remains pending', async () => {
    mockZeroRowActivation = true;
    const response = await confirm();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, enrollment: { status: 'active' } });
    expect(mockStatus).toBe('pending');
  });

  it('exposes financial write attempts before an activation failure without an observed rollback command', async () => {
    mockFail.add('edu_enrollments:update');
    const response = await confirm();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false, error: 'ACTIVATION_FAILED' });
    expect(writes('edu_fin_invoices')).toHaveLength(1);
    expect(writes('edu_fin_payments')).toHaveLength(1);
    expect(mockStatus).toBe('pending');
  });

  it('exposes an active retry that does not revisit a previously rejected payment', async () => {
    mockFail.add('edu_fin_payments:insert');
    expect((await confirm()).status).toBe(200);
    expect(mockPaymentCount).toBe(0);
    mockFail.clear();
    const retry = await confirm();
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ success: true, enrollment: { status: 'active' } });
    expect(writes('edu_fin_payments')).toHaveLength(1);
    expect(mockPaymentCount).toBe(0);
    expect(mockReads.filter(read => read === 'edu_fin_invoices:select')).toHaveLength(1);
  });

  it('exposes two concurrent financial write attempts after the same empty snapshot, without claiming DB duplication', async () => {
    mockRace = true;
    const responses = await Promise.all([confirm(), confirm()]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(writes('edu_fin_invoices')).toHaveLength(2);
    expect(writes('edu_fin_payments')).toHaveLength(2);
    // Unique/FK enforcement and committed duplicate rows require an actual DB test.
  });
});
