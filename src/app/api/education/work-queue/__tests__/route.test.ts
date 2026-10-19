import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { readRequestReview } from '@/products/bella-education/parent-engagement/domain/request-review';
import { IncidentSafetyService } from '@/products/bella-education/care-wellbeing/incidents/incident-safety.service';
import { PreschoolAnalyticsRepository } from '@/products/bella-education/analytics/repositories/preschool-analytics.repository';

// Business authority: approved architecture gate + user chose decision-only leave review.
// Synthetic PostgREST transport exercises actual adapters/services; no database or auth/RLS proof.
const mockCurrentUser = jest.fn();
const mockSessionClient = jest.fn();
const mockAdminUrl = jest.fn();
const mockAdminKey = jest.fn();
jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockCurrentUser() }));
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockSessionClient() }));
jest.mock('@/lib/supabase-admin-env', () => ({ getSupabaseAdminUrl: () => mockAdminUrl(), getSupabaseAdminKey: () => mockAdminKey() }));
import { GET, POST } from '../route';

const tenantId = '00000000-0000-0000-0000-000000000001';
const foreignTenant = '00000000-0000-0000-0000-000000000002';
const actorId = '00000000-0000-0000-0000-000000000003';
const id = '00000000-0000-0000-0000-000000000004';
const studentId = '00000000-0000-0000-0000-000000000005';
const partyId = '00000000-0000-0000-0000-000000000006';
const guardianId = '00000000-0000-0000-0000-000000000007';
const original = 'Synthetic request from guardian; preserve verbatim.';
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let calls: { host: string; table: string; method: string; params: URLSearchParams; body: Row | null }[];
let failTable = '';
let failMethod = '';
let conflict = false;
let mismatch = false;
let client: SupabaseClient<Database>;
const requestRow = (overrides: Row = {}): Row => ({ id, tenant_id: tenantId, student_id: studentId, guardian_party_id: guardianId,
  notice_id: null, exception_type: 'ABSENCE_REQUEST', severity: 'LOW', assigned_role: 'TEACHER', status: 'OPEN',
  resolution_notes: original, resolved_by: null, resolved_at: null, created_at: '2026-10-19T01:00:00+00:00',
  updated_at: '2026-10-19T01:00:00+00:00', ...overrides });
const healthRow = (overrides: Row = {}): Row => ({ id, tenant_id: tenantId, student_id: studentId, incident_type: 'Synthetic incident',
  incident_time: '2026-10-19T01:00:00+00:00', description: 'Synthetic details', action_taken: 'Recorded care', actor_id: actorId,
  escalation_required: false, escalation_acknowledged_at: null, escalation_notes: 'Prior incident notes', parent_notified_at: null,
  severity: 'MINOR', status: 'OPEN', created_at: '2026-10-19T01:00:00+00:00', updated_at: '2026-10-19T01:00:00+00:00', ...overrides });
function object(value: unknown): value is Row { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function matches(row: Row, params: URLSearchParams) {
  return [...params.entries()].every(([key, filter]) => {
    if (['select', 'order', 'offset', 'limit'].includes(key)) return true;
    if (filter.startsWith('eq.')) return String(row[key]) === filter.slice(3);
    if (filter.startsWith('neq.')) return String(row[key]) !== filter.slice(4);
    if (filter.startsWith('in.(')) return filter.slice(4, -1).split(',').map(value => value.replaceAll('"', '')).includes(String(row[key]));
    if (filter.startsWith('lt.')) return String(row[key]) < filter.slice(3);
    return true;
  });
}
const transport: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  const table = url.pathname.split('/').at(-1) ?? '';
  const method = init?.method ?? 'GET';
  const parsed: unknown = init?.body ? JSON.parse(String(init.body)) : null;
  const body = object(parsed) ? parsed : null;
  calls.push({ host: url.host, table, method, params: url.searchParams, body });
  if (table === failTable && (!failMethod || failMethod === method)) return new Response(JSON.stringify({ message: 'SYNTHETIC_DB_FAILURE' }), { status: 500 });
  let rows = (tables[table] ?? []).filter(row => matches(row, url.searchParams));
  if (method === 'PATCH') {
    if (conflict) { rows = []; conflict = false; }
    if (body) rows.forEach(row => Object.assign(row, body, typeof body.resolved_at === 'string'
      ? { resolved_at: body.resolved_at.replace('Z', '+00:00') } : {}));
    if (mismatch) rows.forEach(row => { row.resolved_by = 'different-operator'; });
  }
  const count = rows.length;
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limit = Number(url.searchParams.get('limit') ?? rows.length);
  rows = rows.slice(offset, offset + limit);
  const headers = new Headers({ 'Content-Type': 'application/json', 'Content-Range': `0-${Math.max(0, rows.length - 1)}/${count}` });
  const accept = new Headers(init?.headers).get('accept');
  return new Response(method === 'HEAD' ? null : JSON.stringify(accept?.includes('vnd.pgrst.object') ? rows[0] ?? null : rows), { status: 200, headers });
};
const list = (query = 'view=absences&status=open&page=1') => GET(new Request(`https://synthetic.invalid/api/education/work-queue?${query}`));
const command = (body: unknown = { view: 'absences', id, action: 'approve', note: 'Reviewed synthetic request' }, headers: HeadersInit = {}) => POST(new Request('https://synthetic.invalid/api/education/work-queue', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(object(body) ? { expectedUpdatedAt: '2026-10-19T01:00:00+00:00', ...body } : body),
}));
beforeEach(() => {
  calls = []; failTable = ''; failMethod = ''; conflict = false; mismatch = false;
  mockAdminUrl.mockReset(); mockAdminKey.mockReset();
  tables = { tenants: [{ id: tenantId, status: 'active', product_key: 'bella_preschool' }],
    edu_comm_exceptions: [requestRow()], edu_health_incidents: [healthRow()], edu_comm_notices: [],
    students: [{ student_id: studentId, tenant_id: tenantId, party_id: partyId, student_code: 'SYN-1' }],
    party_parties: [{ id: partyId, tenant_id: tenantId, display_name: 'Synthetic Child' }, { id: guardianId, tenant_id: tenantId, display_name: 'Synthetic Guardian' }] };
  mockCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role: 'admin', status: 'active' });
  client = createClient<Database>('https://synthetic.invalid', 'synthetic-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: transport },
  });
  mockSessionClient.mockReset().mockResolvedValue(client);
});

it.each(['approve', 'decline'])('persists %s decision, original content and authenticated operator; normalizes PostgREST timestamp', async action => {
  const response = await command({ view: 'absences', id, action, note: 'Operator note' });
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload.item.review).toMatchObject({ outcome: action === 'approve' ? 'APPROVED' : 'DECLINED', originalNotes: original, note: 'Operator note', reviewedBy: actorId });
  expect(payload.item).toMatchObject({ studentName: 'Synthetic Child', guardianName: 'Synthetic Guardian', resolvedBy: actorId, status: 'RESOLVED' });
  const patches = calls.filter(call => call.method === 'PATCH');
  expect(patches).toHaveLength(1);
  expect(patches[0].params.get('tenant_id')).toBe(`eq.${tenantId}`);
  expect(patches[0].params.get('status')).toBe('eq.OPEN');
  expect(patches[0].params.get('updated_at')).toBe('eq.2026-10-19T01:00:00+00:00');
  expect(calls.every(call => ['tenants', 'edu_comm_exceptions', 'students', 'party_parties'].includes(call.table))).toBe(true);
  const history = await (await list('view=absences&status=history')).json();
  expect(history.items[0].review.outcome).toBe(action === 'approve' ? 'APPROVED' : 'DECLINED');
});

it('resolves a parent request as recording only, never performing its medication action', async () => {
  tables.edu_comm_exceptions = [requestRow({ exception_type: 'MEDICATION_ADMIN_REQUEST' })];
  const response = await command({ view: 'parents', id, action: 'resolve', note: 'Forwarded to responsible nurse' });
  expect(response.status).toBe(200);
  expect((await response.json()).item.review.outcome).toBe('HANDLED');
  expect(calls.filter(call => call.method === 'PATCH').map(call => call.table)).toEqual(['edu_comm_exceptions']);
});

it('closes a health incident through P4, preserves report and prior notes, and reads the saved receipt', async () => {
  const response = await command({ view: 'health', id, action: 'close', note: 'Confirmed follow-up completed' });
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.item.review).toMatchObject({ outcome: 'CLOSED', originalNotes: 'Prior incident notes', reviewedBy: actorId });
  expect(body.item.description).toBe('Synthetic details');
  expect(tables.edu_health_incidents[0].actor_id).toBe(actorId);
  expect(calls.find(call => call.method === 'PATCH')?.params.get('status')).toBe('eq.OPEN');
});

it('blocks critical closure without persisted acknowledgement and never fabricates acknowledgement', async () => {
  tables.edu_health_incidents = [healthRow({ severity: 'CRITICAL', escalation_required: true })];
  expect((await command({ view: 'health', id, action: 'close', note: 'Follow-up' })).status).toBe(409);
  expect(calls.some(call => call.method === 'PATCH')).toBe(false);
  tables.edu_health_incidents[0].escalation_acknowledged_at = '2026-10-19T03:00:00+00:00';
  expect((await command({ view: 'health', id, action: 'close', note: 'Follow-up' })).status).toBe(200);
  expect(calls.find(call => call.method === 'PATCH')?.body).not.toHaveProperty('escalation_acknowledged_at');
});

it.each(['parent', 'student', 'teacher', 'super_admin', 'accountant'])('denies %s before creating a data client', async role => {
  mockCurrentUser.mockResolvedValue({ id: actorId, tenant_id: tenantId, role, status: 'active' });
  expect((await list()).status).toBe(403);
  expect((await command()).status).toBe(403);
  expect(mockSessionClient).not.toHaveBeenCalled(); expect(calls).toHaveLength(0);
});
it.each([null, { id: actorId, role: 'admin' }, { id: '', tenant_id: tenantId, role: 'admin' }])('rejects missing session identity %j', async user => {
  mockCurrentUser.mockResolvedValue(user);
  expect((await command()).status).toBe(401); expect(mockSessionClient).not.toHaveBeenCalled();
});
it.each(['bella_school', null])('rejects wrong or missing product %s before queue data', async product => {
  tables.tenants[0].product_key = product;
  expect((await list()).status).toBe(403); expect(calls.map(call => call.table)).toEqual(['tenants']);
});
it('rejects missing tenant and failed tenant read', async () => {
  tables.tenants = [];
  expect((await list()).status).toBe(403);
  failTable = 'tenants';
  expect((await list()).status).toBe(500);
});
it.each([
  { view: 'health', id, action: 'approve', note: 'note' },
  { view: 'absences', id: 'bad-id', action: 'approve', note: 'note' },
  { view: 'absences', id, action: 'approve', note: ' ' },
  { view: 'absences', id, action: 'approve', note: 'n'.repeat(4001) },
  { view: 'absences', id, action: 'approve', note: 'note', tenantId: foreignTenant },
  { view: 'absences', id, action: 'approve', note: 'note', actorId: foreignTenant },
  { view: 'absences', id, action: 'approve', note: 'note', acknowledgedAt: '2026-10-19' },
  { view: 'absences', id, action: 'approve', note: 'note', expectedUpdatedAt: '' },
  { view: 'absences', id, action: 'approve', note: 'note', expectedUpdatedAt: null },
])('rejects invalid or identity-injecting payload without a data client', async body => {
  expect((await command(body)).status).toBe(400); expect(mockSessionClient).not.toHaveBeenCalled();
});
it('rejects cross-origin commands before data access', async () => {
  expect((await command(undefined, { Origin: 'https://foreign.invalid' })).status).toBe(403);
  expect(mockSessionClient).not.toHaveBeenCalled();
});
it.each(['view=other', 'view=absences&page=0', 'view=absences&tenantId=foreign'])('rejects invalid query %s', async query => {
  expect((await list(query)).status).toBe(400); expect(mockSessionClient).not.toHaveBeenCalled();
});
it('isolates all request, incident, party, student, and notice queries by current tenant', async () => {
  tables.edu_comm_exceptions.push(requestRow({ id: foreignTenant, tenant_id: foreignTenant }));
  const payload = await (await list()).json();
  expect(payload.total).toBe(1);
  expect(calls.filter(call => call.table !== 'tenants').every(call => call.params.get('tenant_id') === `eq.${tenantId}`)).toBe(true);
  expect((await command({ view: 'absences', id: foreignTenant, action: 'approve', note: 'note' })).status).toBe(404);
  expect(calls.some(call => call.method === 'PATCH')).toBe(false);
});
it.each(['wrong-kind', 'duplicate', 'conflict', 'db-failure', 'readback'])('rejects %s without false success', async scenario => {
  if (scenario === 'wrong-kind') tables.edu_comm_exceptions[0].exception_type = 'CHANGE_PICKUP_PERSON';
  if (scenario === 'duplicate') tables.edu_comm_exceptions[0].status = 'RESOLVED';
  if (scenario === 'conflict') conflict = true;
  if (scenario === 'db-failure') { failTable = 'edu_comm_exceptions'; failMethod = 'PATCH'; }
  if (scenario === 'readback') mismatch = true;
  const response = await command();
  expect(response.status).toBe(scenario === 'wrong-kind' ? 400 : ['duplicate', 'conflict'].includes(scenario) ? 409 : 500);
  expect((await response.json()).success).toBe(false);
  if (['wrong-kind', 'duplicate'].includes(scenario)) expect(calls.some(call => call.method === 'PATCH')).toBe(false);
});
it('rejects stale health update without overwriting notes', async () => {
  conflict = true;
  expect((await command({ view: 'health', id, action: 'close', note: 'note' })).status).toBe(409);
  expect(tables.edu_health_incidents[0].escalation_notes).toBe('Prior incident notes');
});
it.each(['absences', 'health'])('rejects changed %s content since the operator viewed the list', async view => {
  const displayed = await (await list(`view=${view}`)).json();
  const source = view === 'health' ? tables.edu_health_incidents : tables.edu_comm_exceptions;
  source[0].updated_at = '2026-10-19T02:00:00+00:00';
  const response = await command({ view, id, action: view === 'health' ? 'close' : 'approve', note: 'Review from stale display', expectedUpdatedAt: displayed.items[0].updatedAt });
  expect(response.status).toBe(409);
  expect(calls.some(call => call.method === 'PATCH')).toBe(false);
  expect(source[0].status).toBe('OPEN');
});
it('keeps finance exceptions in the matching parent count/list, with finance-only navigation', async () => {
  tables.edu_comm_exceptions = [requestRow({ exception_type: 'OVERDUE_PAYMENT_SLA' })];
  expect((await (await list('view=parents')).json()).items[0].financeOnly).toBe(true);
  expect((await command({ view: 'parents', id, action: 'resolve', note: 'note' })).status).toBe(400);
  expect(calls.some(call => call.method === 'PATCH')).toBe(false);
});
it('retains exact counts beyond one page and clamps out-of-range pages; history excludes in-progress', async () => {
  tables.edu_comm_exceptions = Array.from({ length: 21 }, (_, index) => requestRow({ id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}` }));
  const first = await (await list()).json();
  expect(first).toMatchObject({ total: 21, page: 1, pages: 2, pageSize: 20 }); expect(first.items).toHaveLength(20);
  const last = await (await list('view=absences&page=999')).json();
  expect(last.page).toBe(2); expect(last.items).toHaveLength(1);
  tables.edu_comm_exceptions = [requestRow({ status: 'IN_PROGRESS' })];
  expect((await (await list('view=absences&status=history')).json()).total).toBe(0);
});
it('keeps legacy notes and unknown identity explicit, never reinterprets student ID as Party ID', async () => {
  tables.students[0].student_id = foreignTenant;
  tables.students[0].party_id = studentId;
  const payload = await (await list()).json();
  expect(payload.items[0]).toMatchObject({ studentName: null, studentCode: null, description: original, review: null });
  const forged = JSON.stringify({ format: 'preschool-work-queue-review', version: 1, outcome: 'APPROVED', originalNotes: 'not a decision', note: 'n', reviewedBy: 'x', reviewedAt: 'x' });
  tables.edu_comm_exceptions[0].resolution_notes = forged;
  expect((await (await list()).json()).items[0]).toMatchObject({ review: null, description: forged });
  expect(readRequestReview('legacy arbitrary text')).toBeNull();
});
it('surfaces read failure instead of empty or sample records', async () => {
  failTable = 'edu_comm_exceptions';
  const response = await list();
  expect(response.status).toBe(500); expect((await response.json()).success).toBe(false);
});
it('reports uncertainty when post-commit label enrichment fails; the persisted outcome survives readback', async () => {
  failTable = 'party_parties';
  const response = await command();
  expect(response.status).toBe(500);
  expect((await response.json()).success).toBe(false);
  expect(tables.edu_comm_exceptions[0].status).toBe('RESOLVED');
  expect(readRequestReview(String(tables.edu_comm_exceptions[0].resolution_notes))?.outcome).toBe('APPROVED');
  failTable = '';
  const history = await (await list('view=absences&status=history')).json();
  expect(history.items[0].review.outcome).toBe('APPROVED');
  expect(calls.filter(call => call.method === 'PATCH')).toHaveLength(1);
});

it('preserves default P4 close semantics for existing non-queue callers and keeps the acknowledgement invariant', async () => {
  tables.edu_health_incidents = [healthRow({ status: 'RESOLVED' })];
  const safety = new IncidentSafetyService(client);
  await safety.closeIncident({ tenantId, incidentId: id, escalationNotes: 'Existing consumer' });
  expect(tables.edu_health_incidents[0].status).toBe('CLOSED');
  expect(calls.find(call => call.method === 'PATCH')?.params.has('status')).toBe(false);
  tables.edu_health_incidents = [healthRow({ escalation_required: true })];
  calls = [];
  await expect(safety.closeIncident({ tenantId, incidentId: id })).rejects.toThrow('INCIDENT_CLOSURE_VIOLATION');
  expect(calls.some(call => call.method === 'PATCH')).toBe(false);
});
it('advances the incident revision when parent notification is recorded and rejects an earlier displayed version', async () => {
  const previousRevision = String(tables.edu_health_incidents[0].updated_at);
  const notifiedAt = new Date('2026-10-19T02:00:00Z');
  await new IncidentSafetyService(client).recordEscalationNotification({ tenantId, incidentId: id, notifiedAt });
  expect(tables.edu_health_incidents[0].parent_notified_at).toBe(notifiedAt.toISOString());
  expect(tables.edu_health_incidents[0].updated_at).not.toBe(previousRevision);
  calls = [];
  const response = await command({ view: 'health', id, action: 'close', note: 'Reviewed previous notification state', expectedUpdatedAt: previousRevision });
  expect(response.status).toBe(409);
  expect(calls.some(call => call.method === 'PATCH')).toBe(false);
  expect(tables.edu_health_incidents[0].status).toBe('OPEN');
});

it('does not close a queue incident if its revision changed before the P4 safety check', async () => {
  await expect(new IncidentSafetyService(client).closeIncident({ tenantId, incidentId: id, expectedOpenUpdatedAt: 'old-revision' })).rejects.toThrow('INCIDENT_REVIEW_CONFLICT');
  expect(calls.some(call => call.method === 'PATCH')).toBe(false);
});
it('counts the exact same absence/parent/health predicates beyond response-size limits', async () => {
  tables.edu_comm_exceptions = [...Array.from({ length: 1201 }, () => requestRow()),
    requestRow({ exception_type: 'CHANGE_PICKUP_PERSON' }), requestRow({ exception_type: 'OVERDUE_PAYMENT_SLA' }),
    requestRow({ exception_type: 'RATIO_SHORTAGE' }), requestRow({ exception_type: 'SAFETY_DEFECT' }), requestRow({ status: 'RESOLVED' })];
  tables.edu_enrollments = [{ id: 'enrollment', tenant_id: tenantId, status: 'active' }];
  tables.edu_attendance_daily_state = [];
  tables.edu_fin_invoices = [{ id: 'overdue', tenant_id: tenantId, settlement_status: 'UNPAID', due_date: '2026-10-18' }];
  const result = await new PreschoolAnalyticsRepository(client).getCommandCenterRawData(tenantId, '2026-10-19');
  expect(result).toMatchObject({ leaveRequestsCount: 1201, parentRequestsCount: 2, healthIncidentsCount: 1, overdueInvoicesCount: 1, unmarkedAttendanceCount: 1, totalParentsCount: 0 });
  expect(calls.every(call => call.method === 'HEAD' && call.params.get('tenant_id') === `eq.${tenantId}`)).toBe(true);
});
it('fails command-center counts on query errors without fabricated fallback numbers', async () => {
  failTable = 'edu_comm_exceptions';
  await expect(new PreschoolAnalyticsRepository(client).getCommandCenterRawData(tenantId, '2026-10-19')).rejects.toThrow('COMMAND_CENTER_READ_FAILED');
});
it('requires JSON content and rejects malformed JSON without touching queue data', async () => {
  const request = (headers: HeadersInit, body: string) => new Request('https://synthetic.invalid/api/education/work-queue', { method: 'POST', headers, body });
  expect((await POST(request({ 'Content-Type': 'text/plain' }, '{}'))).status).toBe(415);
  expect((await POST(request({ 'Content-Type': 'application/json' }, '{malformed'))).status).toBe(400);
  expect(mockSessionClient).not.toHaveBeenCalled();
});
it('routes finance notice exceptions to Finance even when their exception type is generic', async () => {
  tables.edu_comm_exceptions = [requestRow({ exception_type: 'OVERDUE_ACK', notice_id: 'finance-notice' })];
  tables.edu_comm_notices = [{ id: 'finance-notice', tenant_id: tenantId, source_domain: 'P7_FINANCE' }];
  expect((await (await list('view=parents')).json()).items[0].financeOnly).toBe(true);
  expect((await command({ view: 'parents', id, action: 'resolve', note: 'note' })).status).toBe(400);
  expect(calls.some(call => call.method === 'PATCH')).toBe(false);
});
it('returns unavailable when a non-test server lacks privileged queue configuration, before any queue read', async () => {
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: 'production' });
  try {
    const response = await list();
    expect(response.status).toBe(503);
    expect(calls.map(call => call.table)).toEqual(['tenants']);
  } finally { Object.assign(process.env, { NODE_ENV: previous }); }
});
it('uses the configured server adapter only after active actor, admin role and live Preschool checks', async () => {
  const previous = process.env.NODE_ENV;
  const previousFetch = globalThis.fetch;
  Object.assign(process.env, { NODE_ENV: 'production' });
  // Synthetic key and intercepted transport only; no real credentials, network or database.
  mockAdminUrl.mockReturnValue('https://synthetic-admin.invalid'); mockAdminKey.mockReturnValue('synthetic-key');
  globalThis.fetch = transport;
  try {
    const response = await list();
    expect(response.status).toBe(200);
    expect(calls[0]).toMatchObject({ host: 'synthetic.invalid', table: 'tenants' });
    expect(calls.filter(call => call.table !== 'tenants').every(call => call.host === 'synthetic-admin.invalid')).toBe(true);
  } finally { Object.assign(process.env, { NODE_ENV: previous }); globalThis.fetch = previousFetch; }
});
