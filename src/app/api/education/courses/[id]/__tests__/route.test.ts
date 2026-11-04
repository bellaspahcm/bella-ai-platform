import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { EducationCourseDTO } from '@/platform/education/contracts/course.contract';
import type { CurrentActorProfileRow, CurrentActorTenantPresentationRow } from '@/platform/security/current-actor.contract';

const mockGetUser = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: null }>>();
const mockGetCurrentUser = jest.fn<() => Promise<{ id: string; tenant_id: string; status: string } | null>>();
const mockFrom = jest.fn<(table: string) => unknown>();
const mockGetCourse = jest.fn<(tenantId: string, id: string) => Promise<EducationCourseDTO | null>>();
const mockGetAdminCourse = jest.fn<(tenantId: string, id: string) => Promise<EducationCourseDTO | null>>();
const mockInjectedClient = jest.fn();
const mockGetTeachers = jest.fn();
const mockRpc = jest.fn<(name: string) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>>();
const mockClient = { from: mockFrom, rpc: mockRpc, auth: { getUser: mockGetUser } };
jest.mock('@/lib/supabase-server', () => ({ createClient: () => mockClient }));
jest.mock('@/services/user-actions', () => ({ getCurrentUser: mockGetCurrentUser }));
jest.mock('@/platform/education/contracts/course.contract.impl', () => ({
  CourseContractImpl: jest.fn().mockImplementation((client: unknown) => {
    mockInjectedClient(client);
    return { getCourse: mockGetCourse };
  }),
}));
jest.mock('@/platform/education/contracts/canonical-course-catalog.contract.impl', () => ({
  CanonicalCourseCatalogContractImpl: jest.fn().mockImplementation((client: unknown) => {
    mockInjectedClient(client);
    return { getPreschoolAdminCourse: mockGetAdminCourse };
  }),
}));
jest.mock('@/platform/education/contracts/teacher-assignment.contract.impl', () => ({
  TeacherAssignmentContractImpl: jest.fn().mockImplementation(() => ({ getCourseTeachers: mockGetTeachers })),
}));
const { GET } = require('../route') as typeof import('../route');
const tenantId = '00000000-0000-4000-8000-000000000001';
const courseId = '00000000-0000-4000-8000-000000000003';
const course: EducationCourseDTO = {
  id: courseId, tenantId, courseCode: 'CAT-1', title: 'Catalog only', status: 'draft', prerequisites: ['PRE-1'],
};
const invoke = (id = course.id, query = 'view=catalog') => GET(
  new Request(`http://localhost/api/education/courses/${encodeURIComponent(id)}?${query}`),
  { params: Promise.resolve({ id }) },
);
let profile: CurrentActorProfileRow;
let tenant: CurrentActorTenantPresentationRow;

beforeEach(() => {
  jest.clearAllMocks();
  profile = {
    id: 'auth-user', tenant_id: tenantId, email: 'admin@example.invalid', full_name: null, avatar_url: null,
    role: 'admin', status: 'active', tenant_status: 'active',
  };
  tenant = {
    tenant_id: tenantId, tenant_status: 'active', name: 'Synthetic Preschool', product_key: 'bella_preschool',
    enabled_modules: {}, brand_theme: {}, logo_url: null,
  };
  mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null });
  mockGetCurrentUser.mockResolvedValue({ id: 'auth-user', tenant_id: tenantId, status: 'active' });
  mockGetCourse.mockResolvedValue(course);
  mockGetAdminCourse.mockResolvedValue(course);
  mockRpc.mockImplementation(async name => {
    if (name === 'platform_current_actor_profile') return { data: [profile], error: null };
    if (name === 'platform_current_actor_tenant_presentation') return { data: [tenant], error: null };
    throw new Error(`Unexpected RPC ${name}`);
  });
  mockFrom.mockImplementation(table => {
    if (table !== 'courses') throw new Error(`Unexpected legacy dependency ${table}`);
    const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: null, error: null }) };
    return chain;
  });
});

describe('additive catalog Course detail', () => {
  it('reads one own-tenant Preschool class through the admin-only RPC contract', async () => {
    const response = await invoke();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, course });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mockGetAdminCourse).toHaveBeenCalledWith(tenantId, course.id);
    expect(mockInjectedClient).toHaveBeenCalledWith(mockClient);
    expect(mockRpc.mock.calls.map(([name]) => name)).toEqual([
      'platform_current_actor_profile', 'platform_current_actor_tenant_presentation',
    ]);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockGetTeachers).not.toHaveBeenCalled();
  });
  it.each([
    ['missing', null], ['foreign existing', { ...course, tenantId: 'foreign-tenant' }],
    ['mismatched ID', { ...course, id: '00000000-0000-4000-8000-000000000004' }],
  ] as const)('returns scoped 404 for a %s Course result', async (_label, result) => {
    mockGetAdminCourse.mockResolvedValue(result);
    const response = await invoke();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: 'COURSE_NOT_FOUND' });
    expect(mockGetTeachers).not.toHaveBeenCalled();
  });
  it.each(['', ' ', 'course-a'])('does not query the public contract with invalid ID %s', async id => {
    const response = await invoke(id);
    expect(response.status).toBe(404);
    expect(mockGetAdminCourse).not.toHaveBeenCalled();
  });
  it('does not leak a public-contract or DB diagnostic', async () => {
    mockGetAdminCourse.mockRejectedValue(new Error('private Course/SQL detail'));
    const response = await invoke();
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ success: false, error: 'COURSE_CATALOG_UNAVAILABLE' });
  });
  it.each(['teacher', 'owner', 'platform_admin'])('denies current role %s before the class RPC', async role => {
    profile = { ...profile, role };
    const response = await invoke();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, error: 'COURSE_ACCESS_DENIED' });
    expect(mockGetAdminCourse).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });
  it('denies foreign selectors instead of performing a foreign lookup', async () => {
    const response = await invoke(course.id, 'view=catalog&tenantId=foreign');
    expect(response.status).toBe(403);
    expect(mockGetAdminCourse).not.toHaveBeenCalled();
    expect(mockRpc.mock.calls.map(([name]) => name)).toEqual(['platform_current_actor_profile']);
  });
  it('only returns unsupported Product after trusted current tenant resolution', async () => {
    tenant = { ...tenant, product_key: 'bella_training' };
    const response = await invoke();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, error: 'COURSE_CATALOG_UNSUPPORTED_PRODUCT' });
    expect(mockGetAdminCourse).not.toHaveBeenCalled();
  });
  it.each(['view=catalog&view=catalog', 'view=foreign', 'view=catalog&branchId=branch', 'view=catalog&tenantId=own-tenant&tenantId=foreign'])('does not fall into the default handler for invalid mode %s', async query => {
    const response = await invoke(course.id, query);
    expect(response.status).toBe(400);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockGetAdminCourse).not.toHaveBeenCalled();
  });
  it('preserves the default legacy detail 404 path without invoking catalog identity or contract', async () => {
    const response = await invoke(course.id, '');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: 'Lớp học không tồn tại' });
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(mockGetAdminCourse).not.toHaveBeenCalled();
  });
});
