import { GET } from '../route';

type Row = Record<string, unknown>;
const actor = '00000000-0000-4000-8000-000000000001';
const tenant = '00000000-0000-4000-8000-000000000002';
const course = '00000000-0000-4000-8000-000000000003';
const branch = '00000000-0000-4000-8000-000000000004';
const foreign = '00000000-0000-4000-8000-000000000005';
let rows: Record<string, Row[]>;
let errors: Record<string, boolean>;
let counts: Record<string, number | null>;
const mockAuth = jest.fn();
const mockProfile = jest.fn();
const mockFrom = jest.fn((table: string) => new Query(table));

class Query {
  private filters: Array<(row: Row) => boolean> = [];
  constructor(private readonly table: string) {}
  select() { return this; }
  eq(key: string, value: unknown) { this.filters.push(row => row[key] === value); return this; }
  in(key: string, values: readonly unknown[]) { this.filters.push(row => values.includes(row[key])); return this; }
  order() { return this; }
  private result(single = false) {
    const data = (rows[this.table] || []).filter(row => this.filters.every(filter => filter(row)));
    return { data: single ? data[0] || null : data, count: this.table in counts ? counts[this.table] : data.length,
      error: errors[this.table] ? { message: 'synthetic sensitive DB detail' } : null };
  }
  maybeSingle() { return Promise.resolve(this.result(true)); }
  then(resolve: (value: ReturnType<Query['result']>) => unknown, reject: (error: unknown) => unknown) {
    return Promise.resolve(this.result()).then(resolve, reject);
  }
}
jest.mock('@/lib/supabase-server', () => ({ createClient: () => ({ auth: { getUser: mockAuth }, from: mockFrom }) }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: () => mockProfile() }));

const request = (query = '', headers?: Record<string, string>) => new Request('http://localhost/api/education/care/classes' + query, { headers });
async function outcome(status: number, code: string, query = '', headers?: Record<string, string>) {
  const response = await GET(request(query, headers));
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ success: false, error: code });
}
beforeEach(() => {
  jest.clearAllMocks(); errors = {}; counts = {};
  mockAuth.mockResolvedValue({ data: { user: { id: actor } }, error: null });
  mockProfile.mockResolvedValue({ id: actor, tenant_id: tenant, status: 'active', role: 'admin' });
  rows = {
    tenants: [{ id: tenant, status: 'active', product_key: 'bella_preschool' }],
    edu_courses: [{ id: course, tenant_id: tenant, course_code: 'SYNTHETIC', title: 'Synthetic course', status: 'active' }],
    preschool_chain_course_branch_assignments: [{ tenant_id: tenant, course_id: course, branch_id: branch }],
    org_units: [{ id: branch, tenant_id: tenant, unit_type: 'branch', is_active: true }],
    user_org_unit_access: [{ user_id: actor, tenant_id: tenant, org_unit_id: branch }],
  };
});

test('Approved active admin sees only actual canonical class identity through its own branch access', async () => {
  const response = await GET(request()); expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ success: true, classrooms: [{ id: course, name: 'Synthetic course', code: 'SYNTHETIC', status: 'active' }] });
  expect(mockFrom.mock.calls.map(([table]) => table)).not.toEqual(expect.arrayContaining(['courses', 'teacher_assignments']));
});
test('Anonymous spoofing stops before profile or table reads', async () => {
  mockAuth.mockResolvedValue({ data: { user: null }, error: null });
  await outcome(401, 'CARE_UNAUTHENTICATED', '', { 'x-mock-role': 'admin' });
  expect(mockProfile).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
});
test('Invalid provider session is denied', async () => {
  mockAuth.mockResolvedValue({ data: { user: { id: actor } }, error: { message: 'invalid' } });
  await outcome(401, 'CARE_UNAUTHENTICATED');
});
test.each(['parent', 'accountant', 'super_admin', 'teacher', ''])('Unapproved role %s is denied', async role => {
  mockProfile.mockResolvedValue({ id: actor, tenant_id: tenant, status: 'active', role }); await outcome(403, 'CARE_ROLE_DENIED');
});
test('admin_staff identity remains held', async () => {
  mockProfile.mockResolvedValue({ id: actor, tenant_id: tenant, status: 'active', role: 'admin_staff' });
  await outcome(503, 'CARE_TEACHER_IDENTITY_UNAVAILABLE');
  expect(mockFrom).not.toHaveBeenCalledWith('edu_courses');
});
test.each([null, { id: foreign, tenant_id: tenant, status: 'active', role: 'admin' }, { id: actor, tenant_id: tenant, status: 'inactive', role: 'admin' }])('Unbound/inactive profile denied %#', async profile => {
  mockProfile.mockResolvedValue(profile); await outcome(403, 'CARE_ACCESS_DENIED');
});
test.each(['missing', 'inactive', 'wrong-product'])('Invalid tenant %s denied', async mode => {
  if(mode === 'missing')rows.tenants = []; else if(mode === 'inactive')rows.tenants[0].status = 'suspended'; else rows.tenants[0].product_key = 'bella_training';
  await outcome(403, 'CARE_PRODUCT_ACCESS_DENIED');
});
test.each([`?tenantId=${foreign}`, `?tenantId=${tenant}&tenantId=${foreign}`, '?tenant_id=', `?actorId=${foreign}`, `?courseId=${course}`, `?branch_id=${branch}`, '?role=admin'])('Selectors cannot widen scope: %s', async query => {
  await outcome(403, 'CARE_CONTEXT_OVERRIDE_DENIED', query);
});
test('Header tenant override denied', async () => { await outcome(403, 'CARE_CONTEXT_OVERRIDE_DENIED', '', { 'x-tenant-id': foreign }); });
test.each(['inactive-branch', 'no-access', 'no-courses', 'draft-course'])('Valid empty catalog: %s', async mode => {
  if(mode === 'inactive-branch')rows.org_units[0].is_active = false;
  if(mode === 'no-access')rows.user_org_unit_access = [];
  if(mode === 'no-courses')rows.edu_courses = [];
  if(mode === 'draft-course')rows.edu_courses[0].status = 'draft';
  const response = await GET(request()); expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true, classrooms: [] });
});
test.each(['missing', 'duplicate', 'ambiguous'])('Invalid Course branch binding %s fails closed', async mode => {
  if(mode === 'missing')rows.preschool_chain_course_branch_assignments = [];
  else rows.preschool_chain_course_branch_assignments.push({ ...rows.preschool_chain_course_branch_assignments[0], branch_id: mode === 'ambiguous' ? foreign : branch });
  await outcome(503, 'CARE_CLASS_CATALOG_UNAVAILABLE');
});
test.each(['edu_courses', 'preschool_chain_course_branch_assignments', 'org_units', 'user_org_unit_access'])('Lookup error in %s never returns partial data or DB details', async table => {
  errors[table] = true; await outcome(503, 'CARE_CLASS_CATALOG_UNAVAILABLE');
});
test.each(['edu_courses', 'preschool_chain_course_branch_assignments', 'org_units', 'user_org_unit_access'])('Truncated %s fails closed', async table => {
  counts[table] = 2; await outcome(503, 'CARE_CLASS_CATALOG_UNAVAILABLE');
});
test('Cross-tenant Course rows cannot become classrooms', async () => {
  rows.edu_courses.push({ ...rows.edu_courses[0], id: foreign, tenant_id: foreign });
  const response = await GET(request()); const result = await response.json(); expect(result.classrooms).toHaveLength(1); expect(result.classrooms[0].id).toBe(course);
});
