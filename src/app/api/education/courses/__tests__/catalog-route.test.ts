import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { EducationCourseDTO } from '@/platform/education/contracts/course.contract';
import {
  CURRENT_ACTOR_PROFILE_RPC,
  CURRENT_ACTOR_TENANT_PRESENTATION_RPC,
  type CurrentActorProfileRow,
  type CurrentActorTenantPresentationRow,
} from '@/platform/security/current-actor.contract';

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
const mockRpc = jest.fn<(name: string) => Promise<{ data: unknown; error: { code: string; message: string } | null }>>();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: { getUser: mockGetAuthUser },
    rpc: mockRpc,
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
const actorProfile: CurrentActorProfileRow = {
  id: authUserId,
  tenant_id: tenantId,
  email: 'admin@preschool.example.invalid',
  full_name: 'Preschool Admin',
  avatar_url: null,
  role: 'admin',
  status: 'active',
  tenant_status: 'active',
};
const tenantPresentation = {
  tenant_id: tenantId,
  tenant_status: 'active',
  name: 'Preschool',
  product_key: 'bella_preschool',
  enabled_modules: [],
  brand_theme: {},
  logo_url: null,
} as unknown as CurrentActorTenantPresentationRow;

describe('/api/education/courses additive catalog read', () => {
  const course: EducationCourseDTO = {
    id: courseId, tenantId, courseCode: 'CATALOG-1', title: 'Canonical catalog only',
    status: 'active', prerequisites: ['PRE-1'],
  };
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ data: { user: { id: authUserId } }, error: null });
    mockListCourses.mockResolvedValue([course]);
    mockRpc.mockImplementation(async name => {
      if (name === CURRENT_ACTOR_PROFILE_RPC) return { data: [actorProfile], error: null };
      if (name === CURRENT_ACTOR_TENANT_PRESENTATION_RPC) return { data: [tenantPresentation], error: null };
      return { data: null, error: { code: '42883', message: 'Unexpected RPC' } };
    });
    mockFrom.mockImplementation(table => {
      throw new Error(`Unexpected direct read in catalog request: ${table}`);
    });
  });
  it('returns only the existing public DTO through the caller-injected contract and Product service', async () => {
    const response = await GET(new Request('http://localhost/api/education/courses?view=catalog'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ success: true, courses: [course] });
    expect(mockListCourses).toHaveBeenCalledWith(tenantId);
    expect(mockInjectedClient).toHaveBeenCalledWith(expect.objectContaining({ from: mockFrom, auth: { getUser: mockGetAuthUser } }));
    expect(mockRpc.mock.calls.map(([name]) => name)).toEqual([
      CURRENT_ACTOR_PROFILE_RPC,
      CURRENT_ACTOR_TENANT_PRESENTATION_RPC,
    ]);
    expect(mockFrom).not.toHaveBeenCalled();
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
