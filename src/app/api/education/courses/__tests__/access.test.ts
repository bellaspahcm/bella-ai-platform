import { beforeEach, describe, expect, it, jest } from '@jest/globals';

interface AuthResult {
  data: { user: { id: string } | null };
  error: { message: string } | null;
}

interface Profile {
  id: string;
  tenant_id: string | null;
  status: string;
  role: string;
}

const mockGetUser = jest.fn<() => Promise<AuthResult>>();
const mockGetCurrentUser = jest.fn<() => Promise<Profile | null>>();
const mockFrom = jest.fn<(table: string) => unknown>();
const mockGetCourseTeachers = jest.fn<() => Promise<unknown[]>>();
const mockClient = { auth: { getUser: mockGetUser }, from: mockFrom };

jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockClient }));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => mockClient }));
jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://courses-test.invalid',
  getSupabaseAdminKey: () => 'courses-test-admin-placeholder',
}));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: mockGetCurrentUser }));
jest.mock('@/products/bella-education/services/preschool-chain.service', () => ({
  PreschoolChainError: class extends Error {},
  PreschoolChainService: jest.fn().mockImplementation(() => ({
    listCourseAssignments: async () => [{ tenant_id: tenantId, course_id: courseId, branch_id: 'branch-a' }],
    listEnrollmentAssignments: async () => [],
  })),
}));
jest.mock('@/platform/education/contracts/teacher-assignment.contract.impl', () => ({
  TeacherAssignmentContractImpl: jest.fn().mockImplementation(() => ({
    getCourseTeachers: mockGetCourseTeachers,
  })),
}));

const { GET: listCourses } = require('../route') as typeof import('../route');
const { GET: getCourse } = require('../[id]/route') as typeof import('../[id]/route');
const { resolveCourseReadContext } = require('../request-context') as typeof import('../request-context');

const userId = '00000000-0000-0000-0000-000000000011';
const tenantId = '00000000-0000-0000-0000-000000000022';
const foreignTenantId = '00000000-0000-0000-0000-000000000033';
const courseId = '00000000-0000-0000-0000-000000000044';
const profile: Profile = { id: userId, tenant_id: tenantId, status: 'active', role: 'admin_staff' };
const handlers: ReadonlyArray<readonly [string, (request: Request) => Promise<Response>]> = [
  ['list', (request) => listCourses(request)],
  ['detail', (request) => getCourse(request, { params: Promise.resolve({ id: courseId }) })],
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mockGetCurrentUser.mockResolvedValue(profile);
  mockGetCourseTeachers.mockResolvedValue([]);
});

for (const [label, invoke] of handlers) {
  describe(`Courses ${label} request boundary`, () => {
    async function expectDenied(request: Request, status: number, error: string) {
      const response = await invoke(request);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ success: false, error });
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(mockFrom).not.toHaveBeenCalled();
      expect(mockGetCourseTeachers).not.toHaveBeenCalled();
    }

    it('rejects anonymous tenant and mock-role selectors before profile or classroom reads', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      await expectDenied(new Request(`http://localhost/api/education/courses?tenantId=${tenantId}`, {
        headers: { 'x-mock-user-email': 'admin@example.test', 'x-mock-role': 'admin' },
      }), 401, 'COURSE_UNAUTHENTICATED');
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    });

    it('rejects an Auth validation error even if a user object was returned', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: { message: 'Invalid token' } });
      await expectDenied(new Request('http://localhost/api/education/courses'), 401, 'COURSE_UNAUTHENTICATED');
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    });

    it.each([
      ['missing', null],
      ['inactive', { ...profile, status: 'inactive' }],
      ['foreign Auth subject', { ...profile, id: 'another-auth-user' }],
      ['missing tenant', { ...profile, tenant_id: null }],
      ['blank tenant', { ...profile, tenant_id: '  ' }],
    ] as const)('rejects a %s profile before classroom reads', async (_label, invalidProfile) => {
      mockGetCurrentUser.mockResolvedValue(invalidProfile);
      await expectDenied(new Request('http://localhost/api/education/courses'), 403, 'COURSE_ACCESS_DENIED');
    });

    it('rejects a foreign tenant selector instead of switching the data client tenant', async () => {
      await expectDenied(new Request(`http://localhost/api/education/courses?tenantId=${foreignTenantId}`), 403, 'TENANT_ISOLATION_VIOLATION');
    });

    it('rejects a conflicting duplicate selector even when the first tenant matches', async () => {
      await expectDenied(new Request(`http://localhost/api/education/courses?tenantId=${tenantId}&tenantId=${foreignTenantId}`), 403, 'TENANT_ISOLATION_VIOLATION');
    });

    it.each(['view=catalog&view=catalog', 'view=foreign', 'view=catalog&date=2026-10-22'])('rejects ambiguous modes before a legacy resolver or data read: %s', async query => {
      await expectDenied(new Request(`http://localhost/api/education/courses?${query}`), 400, 'COURSE_INVALID_CATALOG_REQUEST');
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
      expect(mockGetUser).not.toHaveBeenCalled();
    });
  });
}

describe('Courses verified session reads', () => {
  it('returns the same session client after Auth/profile and matching selector validation', async () => {
    const context = await resolveCourseReadContext(new Request(`http://localhost/api/education/courses?tenantId=${tenantId}`));
    expect(context.allowed).toBe(true);
    if (!context.allowed) throw new Error('Expected verified read context');
    expect(context.supabase).toBe(mockClient);
    expect(context.tenantId).toBe(tenantId);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('reads the existing detail projection through the session client scoped to the verified tenant', async () => {
    const filters: Array<{ table: string; column: string; value: string }> = [];
    mockFrom.mockImplementation((table: string) => {
      const chain = {
        select: () => chain,
        eq: (column: string, value: string) => {
          filters.push({ table, column, value });
          return chain;
        },
        single: async () => ({ data: {
          course_id: courseId, course_code: 'MAM-1', course_name: 'Lớp Mầm',
          description: 'Khối Mầm', metadata: { room: 'Phòng 3' }, duration_weeks: 25,
        }, error: null }),
        in: async () => ({ data: [], error: null }),
      };
      return chain;
    });
    const response = await getCourse(new Request(`http://localhost/api/education/courses/${courseId}?tenantId=${tenantId}`), {
      params: Promise.resolve({ id: courseId }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await response.json()).classroom).toEqual(expect.objectContaining({
      id: courseId, code: 'MAM-1', name: 'Lớp Mầm', room: 'Phòng 3',
      currentStudents: 0, maxStudents: 25, teachers: [], roster: [],
    }));
    expect(filters).toContainEqual({ table: 'courses', column: 'tenant_id', value: tenantId });
    expect(filters).toContainEqual({ table: 'edu_enrollments', column: 'tenant_id', value: tenantId });
  });

  it('adds the verified tenant fence to teacher Party reads in both handlers', async () => {
    mockGetCourseTeachers.mockResolvedValue([{ teacherPartyId: 'teacher-party', role: 'lead_teacher' }]);
    const filters: Array<{ table: string; column: string; value: string }> = [];
    const values: Record<string, unknown[]> = {
      edu_courses: [{ id: courseId, course_code: 'MAM-1', title: 'Lớp Mầm', status: 'active', max_students: 25, current_enrollment: 0 }],
      courses: [{ course_id: courseId, course_name: 'Lớp Mầm', metadata: {}, status: 'active' }],
      party_parties: [{ id: 'teacher-party', display_name: 'Giáo viên' }],
      edu_enrollments: [],
    };
    mockFrom.mockImplementation((table: string) => {
      const result = { data: values[table] ?? [], error: null, count: 0 };
      const chain = {
        select: () => chain,
        eq: (column: string, value: string) => { filters.push({ table, column, value }); return chain; },
        in: () => chain,
        order: async () => result,
        single: async () => ({ data: values[table]?.[0] ?? null, error: null }),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    });
    const list = await listCourses(new Request('http://localhost/api/education/courses'));
    expect(list.status).toBe(200);
    const detail = await getCourse(new Request(`http://localhost/api/education/courses/${courseId}`), { params: Promise.resolve({ id: courseId }) });
    expect(detail.status).toBe(200);
    expect(filters.filter((filter) => filter.table === 'party_parties')).toEqual([
      { table: 'party_parties', column: 'tenant_id', value: tenantId },
      { table: 'party_parties', column: 'tenant_id', value: tenantId },
    ]);
  });
});
