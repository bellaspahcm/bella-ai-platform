/** Diagnostic probes of CURRENT defects, not acceptance tests of desired behavior.
 * All clients/auth/persistence below are synthetic. No real DB or network access.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { CurrentActorProfileRow } from '@/platform/security/current-actor.contract';

type Result = { data: unknown; error: { code: string; message: string } | null; count?: number };
type Query = { table: string; action: string; payload?: unknown; filters: Array<[string, unknown]> };
const actorId = 'a1000000-0000-4000-8000-000000000001';
const tenantId = 'b1000000-0000-4000-8000-000000000001';
const studentId = 'c1000000-0000-4000-8000-000000000001';
const enrollmentId = 'd1000000-0000-4000-8000-000000000001';
const foreignThreadId = 'e1000000-0000-4000-8000-000000000099';
const courseId = 'f1000000-0000-4000-8000-000000000001';
let mockRole = 'admin';
let mockQueries: Query[] = [];
let mockHandler: (query: Query) => Result;
let mockRpcHandler: (name: string) => Result;

function mockProfile(): CurrentActorProfileRow {
  return { id: actorId, tenant_id: tenantId, role: mockRole, status: 'active', tenant_status: 'active',
    email: 'synthetic@example.test', full_name: 'Synthetic auditor', avatar_url: null };
}
function mockQuery(table: string) {
  const query: Query = { table, action: 'select', filters: [] };
  mockQueries.push(query);
  const chain = {
    select: () => chain,
    insert: (payload: unknown) => { query.action = 'insert'; query.payload = payload; return chain; },
    update: (payload: unknown) => { query.action = 'update'; query.payload = payload; return chain; },
    upsert: (payload: unknown) => { query.action = 'upsert'; query.payload = payload; return chain; },
    delete: () => { query.action = 'delete'; return chain; },
    eq: (key: string, value: unknown) => { query.filters.push([key, value]); return chain; },
    in: (key: string, value: unknown) => { query.filters.push([key, value]); return chain; },
    or: (value: string) => { query.filters.push(['or', value]); return chain; },
    not: () => chain, order: () => chain, limit: () => chain,
    single: () => Promise.resolve(mockHandler(query)),
    maybeSingle: () => Promise.resolve(mockHandler(query)),
    then: (resolve: (result: Result) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(mockHandler(query)).then(resolve, reject),
  };
  return chain;
}
const mockClient = {
  auth: { getUser: async () => ({ data: { user: { id: actorId } }, error: null }),
    getSession: async () => ({ data: { session: { access_token: 'synthetic-audit-token' } }, error: null }) },
  rpc: async (name: string) => mockRpcHandler(name), from: (table: string) => mockQuery(table),
};
jest.mock('@/lib/supabase-server', () => ({ createClient: async () => mockClient }));
jest.mock('@/lib/supabase-admin-env', () => ({ getSupabaseAdminKey: () => 'synthetic-audit-key', getSupabaseAdminUrl: () => 'https://mock.supabase.co' }));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => mockClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: async () => ({ ...mockProfile(), status: 'active' }) }));

const admission = require('@/app/api/education/enrollments/confirm-admission/route') as typeof import('@/app/api/education/enrollments/confirm-admission/route');
const grades = require('@/app/api/education/grades/route') as typeof import('@/app/api/education/grades/route');
const threads = require('@/app/api/education/communication/threads/route') as typeof import('@/app/api/education/communication/threads/route');
const messages = require('@/app/api/education/communication/messages/route') as typeof import('@/app/api/education/communication/messages/route');
const curriculum = require('@/app/api/education/curriculum/route') as typeof import('@/app/api/education/curriculum/route');
const { CurriculumService } = require('@/products/bella-education/learning-development/curriculum/curriculum.service') as typeof import('@/products/bella-education/learning-development/curriculum/curriculum.service');
const { WeeklyMenuService } = require('@/products/bella-education/care-wellbeing/nutrition/weekly-menu.service') as typeof import('@/products/bella-education/care-wellbeing/nutrition/weekly-menu.service');
const { PreschoolFinanceRepository } = require('@/products/bella-education/finance/repositories/preschool-finance.repository') as typeof import('@/products/bella-education/finance/repositories/preschool-finance.repository');
const db = mockClient as unknown as SupabaseClient<Database>;
function request(route: string, body: unknown): Request {
  return new Request('http://localhost/api/education/' + route, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
const fail: Result = { data: null, error: { code: '42501', message: 'synthetic persistence denial' } };
beforeEach(() => {
  mockRole = 'admin'; mockQueries = [];
  mockHandler = () => ({ data: [], error: null });
  mockRpcHandler = () => ({ data: [mockProfile()], error: null });
});

describe('Audit diagnostic probes — observed unsafe behavior', () => {
  it('F01: admission returns success after invoice, line-item and payment writes all fail', async () => {
    mockHandler = query => {
      if (query.action === 'insert') return fail;
      if (query.table === 'edu_enrollments') return { data: { id: enrollmentId, tenant_id: tenantId,
        student_party_id: studentId, course_id: courseId, status: 'pending' }, error: null };
      if (query.table === 'students') return { data: { student_id: studentId, party_id: studentId, student_code: 'AUDIT001' }, error: null };
      if (query.table === 'edu_fin_billing_periods') return { data: null, error: null };
      return { data: [], error: null };
    };
    const response = await admission.POST(request('enrollments/confirm-admission', { enrollmentId, admissionMode: 'PAID' }));
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect(mockQueries.filter(query => query.action === 'insert').map(query => query.table)).toEqual([
      'edu_fin_invoices', 'edu_fin_invoice_line_items', 'edu_fin_payments']);
    expect(mockQueries.some(query => query.table === 'edu_enrollments' && query.action === 'update')).toBe(true);
  });

  it('F02: issue_award returns a generated award and success without any persistence call', async () => {
    const response = await grades.POST(request('grades', { action: 'issue_award', studentId, title: 'Synthetic award' }));
    expect(response.status).toBe(200);
    expect((await response.json()).award.id).toMatch(/^award-/);
    expect(mockQueries).toEqual([]);
  });

  it('F02: observation INSERT denial is swallowed and returns a synthetic success ID', async () => {
    mockHandler = () => fail;
    const response = await grades.POST(request('grades', { action: 'save_observation', studentId, skill: 'Synthetic skill' }));
    expect(response.status).toBe(200);
    expect((await response.json()).observation.id).toMatch(/^obs-/);
    expect(mockQueries.some(query => query.table === 'edu_dev_observation_students')).toBe(false);
  });

  it('F03: parent receives tenant-wide private thread metadata without a guardian predicate', async () => {
    mockRole = 'parent';
    mockHandler = query => ({ data: query.table === 'edu_comm_threads' ? [{ id: foreignThreadId, title: 'Another family' }] : [], error: null, count: 1 });
    const response = await threads.GET(new Request('http://localhost/api/education/communication/threads'));
    expect(response.status).toBe(200);
    expect((await response.json()).data.threads[0].id).toBe(foreignThreadId);
    const query = mockQueries.find(query => query.table === 'edu_comm_threads');
    expect(query?.filters).toEqual([['tenant_id', tenantId], ['status', 'ACTIVE']]);
  });

  it('F04: staff can submit a supplied foreign thread UUID with no thread ownership lookup', async () => {
    mockRole = 'admin_staff';
    mockHandler = query => ({ data: query.action === 'insert' ? { id: studentId, sender_role: 'TEACHER',
      response_text: 'Synthetic message', created_at: '2026-10-31T00:00:00Z' } : [], error: null });
    const response = await messages.POST(request('communication/messages', { threadId: foreignThreadId, message: 'Synthetic message' }));
    expect(response.status).toBe(200);
    expect(mockQueries.some(query => query.table === 'edu_comm_threads' && query.action === 'select')).toBe(false);
    const inserted = mockQueries.find(query => query.table === 'edu_comm_responses')?.payload;
    expect(inserted).toMatchObject({ tenant_id: tenantId, thread_id: foreignThreadId, sender_party_id: actorId });
  });

  it('F05: unassigned staff can approve a lesson for an arbitrary course through privileged persistence', async () => {
    mockRole = 'admin_staff';
    mockHandler = () => ({ data: { id: studentId }, error: null });
    const response = await curriculum.POST(request('curriculum', { title: 'Synthetic lesson', theme: 'Audit',
      subjectDomain: 'Audit', plannedDate: '2026-10-31', courseId, weekNumber: 44, year: 2026,
      status: 'APPROVED', objectives: {}, activitySteps: [] }));
    expect(response.status).toBe(200);
    expect(mockQueries).toHaveLength(1);
    expect(mockQueries[0].table).toBe('edu_lesson_plans');
    expect(mockQueries[0].payload).toMatchObject({ course_id: courseId, approved_by: actorId });
  });

  it('F09: published menu master is written before daily-detail failure, with no compensating write', async () => {
    mockHandler = query => query.table === 'edu_weekly_menu_days' ? fail : { data: { id: studentId }, error: null };
    const response = await new WeeklyMenuService(db).saveWeeklyMenu(tenantId, actorId, { menuId: studentId,
      title: 'Synthetic menu', weekNumber: 44, year: 2026, startDate: '2026-10-26', endDate: '2026-11-01',
      status: 'PUBLISHED', days: [{ dayOfWeek: 'MON', menuDate: '2026-10-26', mealsPayload: [] }] });
    expect(response.success).toBe(false);
    expect(mockQueries.map(query => [query.table, query.action])).toEqual([
      ['edu_weekly_menus', 'update'], ['edu_weekly_menu_days', 'upsert']]);
    expect(mockQueries[0].payload).toMatchObject({ status: 'PUBLISHED' });
  });

  it('F10: missing lesson row update returns success without row-count or read-back verification', async () => {
    mockHandler = () => ({ data: [], error: null, count: 0 });
    const response = await new CurriculumService(db).saveCurriculum(tenantId, {
      id: studentId, code: 'AUDIT', name: 'Synthetic curriculum', subjects: [], status: 'ACTIVE' });
    expect(response.success).toBe(true);
    expect(mockQueries).toHaveLength(1);
    expect(mockQueries[0].action).toBe('update');
  });

  it('F07: missing finance RPC plus branch without assignments returns all tenant students', async () => {
    mockRpcHandler = () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    mockHandler = query => {
      const data = query.table === 'org_units' ? [{ id: courseId, name: 'Synthetic branch', code: 'AUDIT' }]
        : query.table === 'edu_enrollments' ? [{ id: enrollmentId, course_id: courseId, student_party_id: studentId }]
          : query.table === 'students' ? [{ student_id: studentId, student_code: 'AUDIT001', party_id: studentId }]
            : query.table === 'party_parties' ? [{ id: studentId, display_name: 'Synthetic child' }] : [];
      return { data, error: null };
    };
    const response = await new PreschoolFinanceRepository(db).readBranchState(tenantId, actorId, foreignThreadId);
    expect(response.selectedBranchId).toBe(foreignThreadId);
    expect(response.students).toHaveLength(1);
    expect(response.students[0].studentPartyId).toBe(studentId);
    expect(mockQueries.some(query => query.table === 'user_org_unit_access')).toBe(false);
  });
});
