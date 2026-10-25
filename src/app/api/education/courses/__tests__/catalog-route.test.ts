import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { EducationCourseDTO } from '@/platform/education/contracts/course.contract';

const mockFrom = jest.fn<(table: string) => unknown>();
const mockGetAuthUser = jest.fn<() => Promise<{
  data: { user: { id: string } | null };
  error: { message: string } | null;
}>>();
const mockGetCurrentUser = jest.fn<() => Promise<{
  id: string;
  tenant_id: string;
  status: string;
} | null>>();
const mockGetCourseTeachers = jest.fn<() => Promise<unknown[]>>();
const mockListCourses = jest.fn<(tenant: string) => Promise<readonly EducationCourseDTO[]>>();
const mockInjectedClient = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: { getUser: mockGetAuthUser },
  }),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

jest.mock('@/platform/education/contracts/teacher-assignment.contract.impl', () => ({
  TeacherAssignmentContractImpl: jest.fn().mockImplementation(() => ({
    getCourseTeachers: mockGetCourseTeachers,
    assignTeacher: jest.fn(),
  })),
}));
jest.mock('@/platform/education/contracts/course.contract.impl', () => ({
  CourseContractImpl: jest.fn().mockImplementation((client: unknown) => {
    mockInjectedClient(client);
    return { listCourses: mockListCourses };
  }),
}));

const { GET, POST } = require('../route') as typeof import('../route');

const tenantId = '00000000-0000-0000-0000-0000000000aa';
const courseId = '00000000-0000-0000-0000-0000000000cc';
const authUserId = '00000000-0000-0000-0000-0000000000dd';

describe('/api/education/courses additive catalog read', () => {
  const course: EducationCourseDTO = {
    id: courseId, tenantId, courseCode: 'CATALOG-1', title: 'Canonical catalog only',
    status: 'active', prerequisites: ['PRE-1'],
  };
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ data: { user: { id: authUserId } }, error: null });
    mockListCourses.mockResolvedValue([course]);
    mockFrom.mockImplementation(table => {
      if (table !== 'users' && table !== 'tenants') throw new Error(`Operational dependency forbidden in catalog: ${table}`);
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: table === 'users'
          ? { id: authUserId, tenant_id: tenantId, role: 'admin', status: 'active' }
          : { id: tenantId, status: 'active', product_key: 'bella_preschool' },
        error: null,
      }) }) }) };
    });
  });
  it('returns only the existing public DTO through the caller-injected contract and Product service', async () => {
    const response = await GET(new Request('http://localhost/api/education/courses?view=catalog'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ success: true, courses: [course] });
    expect(mockListCourses).toHaveBeenCalledWith(tenantId);
    expect(mockInjectedClient).toHaveBeenCalledWith(expect.objectContaining({ from: mockFrom, auth: { getUser: mockGetAuthUser } }));
    expect(mockFrom.mock.calls.map(([table]) => table)).toEqual(['users', 'tenants']);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockGetCourseTeachers).not.toHaveBeenCalled();
  });
  it('preserves a successful empty catalog as empty', async () => {
    mockListCourses.mockResolvedValue([]);
    const response = await GET(new Request('http://localhost/api/education/courses?view=catalog'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, courses: [] });
  });
  it('contains dependency diagnostics in a generic unavailable response', async () => {
    mockListCourses.mockRejectedValue(new Error('private SQL/row detail'));
    const response = await GET(new Request('http://localhost/api/education/courses?view=catalog'));
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ success: false, error: 'COURSE_CATALOG_UNAVAILABLE' });
  });
  it('denies unauthenticated catalog requests before identity, contract, or legacy reads', async () => {
    mockGetAuthUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET(new Request('http://localhost/api/education/courses?view=catalog'));
    expect(response.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockListCourses).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });
});
