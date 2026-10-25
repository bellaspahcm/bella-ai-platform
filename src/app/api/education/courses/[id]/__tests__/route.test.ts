import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { EducationCourseDTO } from '@/platform/education/contracts/course.contract';

const mockGetUser = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: null }>>();
const mockGetCurrentUser = jest.fn<() => Promise<{ id: string; tenant_id: string; status: string } | null>>();
const mockFrom = jest.fn<(table: string) => unknown>();
const mockGetCourse = jest.fn<(tenantId: string, id: string) => Promise<EducationCourseDTO | null>>();
const mockInjectedClient = jest.fn();
const mockGetTeachers = jest.fn();
const mockClient = { from: mockFrom, auth: { getUser: mockGetUser } };
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: mockGetCurrentUser }));
jest.mock('@/platform/education/contracts/course.contract.impl', () => ({
  CourseContractImpl: jest.fn().mockImplementation((client: unknown) => {
    mockInjectedClient(client);
    return { getCourse: mockGetCourse };
  }),
}));
jest.mock('@/platform/education/contracts/teacher-assignment.contract.impl', () => ({
  TeacherAssignmentContractImpl: jest.fn().mockImplementation(() => ({ getCourseTeachers: mockGetTeachers })),
}));
const { GET } = require('../route') as typeof import('../route');
const tenantId = 'own-tenant';
const course: EducationCourseDTO = { id: 'course-a', tenantId, courseCode: 'CAT-1', title: 'Catalog only', status: 'draft', prerequisites: ['PRE-1'] };
const invoke = (id = course.id, query = 'view=catalog') => GET(new Request(`http://localhost/api/education/courses/${encodeURIComponent(id)}?${query}`), {
  params: Promise.resolve({ id }),
});
let profile = { id: 'auth-user', tenant_id: tenantId, role: 'admin', status: 'active' };
let tenant = { id: tenantId, status: 'active', product_key: 'bella_preschool' };

beforeEach(() => {
  jest.clearAllMocks();
  profile = { id: 'auth-user', tenant_id: tenantId, role: 'admin', status: 'active' };
  tenant = { id: tenantId, status: 'active', product_key: 'bella_preschool' };
  mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null });
  mockGetCurrentUser.mockResolvedValue({ id: 'auth-user', tenant_id: tenantId, status: 'active' });
  mockGetCourse.mockResolvedValue(course);
  mockFrom.mockImplementation(table => {
    if (table !== 'users' && table !== 'tenants') throw new Error(`Unexpected catalog resource dependency ${table}`);
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'users' ? profile : tenant, error: null }) }) }) };
  });
});

describe('additive catalog Course detail', () => {
  it('reads a canonical-only Course by the own tenant through the caller-injected public contract', async () => {
    const response = await invoke();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, course });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mockGetCourse).toHaveBeenCalledWith(tenantId, course.id);
    expect(mockInjectedClient).toHaveBeenCalledWith(mockClient);
    expect(mockFrom.mock.calls.map(([table]) => table)).toEqual(['users', 'tenants']);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockGetTeachers).not.toHaveBeenCalled();
  });
  it.each([
    ['missing', null], ['foreign existing', { ...course, tenantId: 'foreign-tenant' }],
    ['mismatched ID', { ...course, id: 'course-b' }],
  ] as const)('returns scoped 404 for a %s Course result', async (_label, result) => {
    mockGetCourse.mockResolvedValue(result);
    const response = await invoke();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: 'COURSE_NOT_FOUND' });
    expect(mockGetTeachers).not.toHaveBeenCalled();
  });
  it.each(['', ' ', ' course-a'])('does not query the public contract with invalid ID %s', async id => {
    const response = await invoke(id);
    expect(response.status).toBe(404);
    expect(mockGetCourse).not.toHaveBeenCalled();
  });
  it('does not leak a public-contract or RLS diagnostic', async () => {
    mockGetCourse.mockRejectedValue(new Error('private Course/SQL detail'));
    const response = await invoke();
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ success: false, error: 'COURSE_CATALOG_UNAVAILABLE' });
  });
  it.each(['teacher', 'owner', 'ADMIN'])('denies current role %s before the public contract', async role => {
    profile.role = role;
    const response = await invoke();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, error: 'COURSE_ACCESS_DENIED' });
    expect(mockGetCourse).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });
  it('denies foreign selectors instead of performing a foreign lookup', async () => {
    const response = await invoke(course.id, 'view=catalog&tenantId=foreign');
    expect(response.status).toBe(403);
    expect(mockGetCourse).not.toHaveBeenCalled();
    expect(mockFrom.mock.calls.map(([table]) => table)).toEqual(['users']);
  });
  it('only returns unsupported Product after trusted current tenant resolution', async () => {
    tenant.product_key = 'bella_training';
    const response = await invoke();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, error: 'COURSE_CATALOG_UNSUPPORTED_PRODUCT' });
    expect(mockGetCourse).not.toHaveBeenCalled();
  });
  it.each(['view=catalog&view=catalog', 'view=foreign', 'view=catalog&branchId=branch', 'view=catalog&tenantId=own-tenant&tenantId=foreign'])('does not fall into the default handler for invalid mode %s', async query => {
    const response = await invoke(course.id, query);
    expect(response.status).toBe(400);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockGetCourse).not.toHaveBeenCalled();
  });
  it('preserves the default legacy detail 404 path without invoking catalog identity or contract', async () => {
    mockFrom.mockImplementation(table => {
      expect(table).toBe('courses');
      const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: null, error: null }) };
      return chain;
    });
    const response = await invoke(course.id, '');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: 'Lớp học không tồn tại' });
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(mockGetCourse).not.toHaveBeenCalled();
  });
});
