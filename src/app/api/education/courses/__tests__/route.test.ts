import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockFrom = jest.fn();
const mockGetAuthUser = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>>();
const mockGetCurrentUser = jest.fn<() => Promise<{ id?: string; tenant_id?: string | null;role?:string } | null>>();
const mockGetCourseTeachers = jest.fn<() => Promise<Array<{ teacherPartyId: string; role: string }>>>();
const mockCreateSessionClient = jest.fn(() => ({ from: mockFrom, auth: { getUser: mockGetAuthUser } }));
const mockCreateAdminClient = jest.fn(() => ({ from: mockFrom }));
const mockAdminUrl = jest.fn<() => string | undefined>(() => 'https://courses-test.invalid');
const mockAdminKey = jest.fn<() => string | undefined>(() => 'courses-test-admin-placeholder');
const mockTenantFilter = jest.fn();

const mockCourseAssignments=jest.fn(async()=>[{course_id:'00000000-0000-0000-0000-0000000000cc',branch_id:'branch-a'}]);
const mockEnrollmentAssignments=jest.fn(async()=>[]);
jest.mock('@/products/bella-education/services/preschool-chain.service',()=>{const actual=jest.requireActual('@/products/bella-education/services/preschool-chain.service') as typeof import('@/products/bella-education/services/preschool-chain.service');return {...actual,PreschoolChainService:jest.fn().mockImplementation(()=>({listCourseAssignments:mockCourseAssignments,listEnrollmentAssignments:mockEnrollmentAssignments,assertBranchAccess:jest.fn(async()=>undefined)}))};});
jest.mock('@/lib/supabase-server', () => ({
  createClient: mockCreateSessionClient,
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateAdminClient,
}));

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: mockAdminUrl,
  getSupabaseAdminKey: mockAdminKey,
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

const { GET, POST } = require('../route') as typeof import('../route');

const tenantId = '00000000-0000-0000-0000-0000000000aa';
const courseId = '00000000-0000-0000-0000-0000000000cc';

describe('/api/education/courses canonical classroom route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ data: { user: { id: 'actor-a' } }, error: null });
    mockGetCurrentUser.mockResolvedValue({ id: 'actor-a', tenant_id: tenantId,role:'admin',status:'active' });
    mockGetCourseTeachers.mockResolvedValue([]);
    mockAdminUrl.mockReturnValue('https://courses-test.invalid');
    mockAdminKey.mockReturnValue('courses-test-admin-placeholder');
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: (column: string, value: string) => {
          mockTenantFilter(column, value);
          return { order: async () => ({ data: [], error: null }) };
        },
      }),
    }));
  });

  function expectNoOperationAccess() {
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockGetCourseTeachers).not.toHaveBeenCalled();
  }

  it.each(['', `?tenantId=${tenantId}`])('rejects anonymous requests before client construction: %s', async (query) => {
    mockGetAuthUser.mockResolvedValue({ data: { user: null }, error: null });
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await GET(new Request(`http://localhost/api/education/courses${query}`));
    expect(response.status).toBe(401);
    expectNoOperationAccess();
  });

  it('rejects a canonical actor with no id before operation access', async () => {
    mockGetCurrentUser.mockResolvedValue({ tenant_id: tenantId });
    const response = await GET(new Request('http://localhost/api/education/courses'));
    expect(response.status).toBe(403);
    expectNoOperationAccess();
  });

  it('rejects an actor with no tenant even when a tenant is supplied', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'actor-a', tenant_id: null });
    const response = await GET(new Request(`http://localhost/api/education/courses?tenantId=${tenantId}`));
    expect(response.status).toBe(403);
    expectNoOperationAccess();
  });

  it('rejects another tenant with configured admin credentials before constructing that client', async () => {
    const response = await GET(new Request('http://localhost/api/education/courses?tenantId=other-tenant'));
    expect(response.status).toBe(403);
    expectNoOperationAccess();
  });

  it('does not use a mock header to authorize an anonymous request', async () => {
    mockGetAuthUser.mockResolvedValue({ data: { user: null }, error: null });
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await GET(new Request(`http://localhost/api/education/courses?tenantId=${tenantId}`, {
      headers: { 'x-mock-user-email': 'spoof@example.invalid' },
    }));
    expect(response.status).toBe(401);
    expectNoOperationAccess();
  });

  it('rejects development mock headers and default tenant fallback without a canonical actor', async () => {
    const nodeEnvironment = jest.replaceProperty(process.env, 'NODE_ENV', 'development');
    try {
      mockGetCurrentUser.mockResolvedValue(null);
      const response = await GET(new Request('http://localhost/api/education/courses', {
        headers: { 'x-mock-user-email': 'spoof@example.invalid' },
      }));
      expect(response.status).toBe(403);
      expectNoOperationAccess();
    } finally {
      nodeEnvironment.restore();
    }
  });

  it('fails closed when the canonical identity lookup throws', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Identity unavailable'));
    const response = await GET(new Request('http://localhost/api/education/courses'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: 'Identity unavailable' });
    expectNoOperationAccess();
  });

  it.each(['', `?tenantId=${tenantId}`])('uses the authenticated tenant with configured admin credentials: %s', async (query) => {
    const response = await GET(new Request(`http://localhost/api/education/courses${query}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, classrooms: [] });
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
    expect(mockCreateAdminClient).toHaveBeenCalledWith('https://courses-test.invalid', 'courses-test-admin-placeholder', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    expect(mockGetCurrentUser.mock.invocationCallOrder[0]).toBeLessThan(mockFrom.mock.invocationCallOrder[0]);
    expect(mockTenantFilter).toHaveBeenCalledWith('tenant_id', tenantId);
  });

  it('uses a session client after authorization when admin credentials are absent', async () => {
    mockAdminKey.mockReturnValue(undefined);
    const response = await GET(new Request('http://localhost/api/education/courses'));
    expect(response.status).toBe(200);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockCreateSessionClient).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentUser.mock.invocationCallOrder[0]).toBeLessThan(mockFrom.mock.invocationCallOrder[0]);
    expect(mockTenantFilter).toHaveBeenCalledWith('tenant_id', tenantId);
  });

  it('preserves canonical query errors as 500 responses', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { message: 'Course query failed' } }) }) }),
    }));
    const response = await GET(new Request('http://localhost/api/education/courses'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: 'Course query failed' });
    expect(mockGetCourseTeachers).not.toHaveBeenCalled();
  });

  it('lists classrooms from canonical edu_courses and only uses courses as display projection', async () => {
    const queriedTables: string[] = [];
    const tenantScopes: Array<{ table: string; column: string; value: string }> = [];
    mockGetCourseTeachers.mockResolvedValue([{ teacherPartyId: 'teacher-a', role: 'lead_teacher' }]);

    mockFrom.mockImplementation((table: string) => {
      queriedTables.push(table);

      if (table === 'edu_courses') {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              tenantScopes.push({ table, column, value });
              return { order: async () => ({
                data: [{
                  id: courseId,
                  course_code: 'MAM-A1',
                  title: 'Lớp Mầm Canonical',
                  status: 'active',
                  max_students: 25,
                  current_enrollment: 0,
                  created_at: '2026-10-06T00:00:00.000Z',
                }],
                error: null,
              }) };
            },
          }),
        };
      }

      if (table === 'courses') {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              tenantScopes.push({ table, column, value });
              return { in: async () => ({
                data: [{
                  course_id: courseId,
                  course_code: 'MAM-A1',
                  course_name: 'Projection Name',
                  description: 'Khối Mầm (3 tuổi)',
                  duration_weeks: 20,
                  metadata: { room: 'Phòng 105' },
                  status: 'active',
                }],
                error: null,
              }) };
            },
          }),
        };
      }

      if (table === 'party_parties') {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              mockTenantFilter(column, value);
              tenantScopes.push({ table, column, value });
              return { in: async () => ({ data: [{ id: 'teacher-a', display_name: 'Cô An' }], error: null }) };
            },
          }),
        };
      }

      if (table === 'edu_enrollments') {
        const chain = {
          select: (columns: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head) {
              return {
                eq: () => ({
                  eq: (column: string, value: string) => {
                    tenantScopes.push({ table, column, value });
                    return {in:()=>({ in: async () => ({ count: 2, error: null }) })};
                  },
                }),
              };
            }

            return {
              eq: () => ({
                eq: (column: string, value: string) => {
                  tenantScopes.push({ table, column, value });
                  return {in:()=>({in:async()=>({data:[{id:'enrollment-1'},{id:'enrollment-2'}],error:null})})};
                },
              }),
            };
          },
        };
        return chain;
      }

      if (table === 'edu_attendance_daily_state') {
        return {
          select: () => ({
            eq: (column: string, value: string) => {
              tenantScopes.push({ table, column, value });
              return { eq: () => ({
                in: async () => ({ data: [{ status: 'present' }], error: null }),
              }) };
            },
          }),
        };
      }

      throw new Error(`Unexpected table access in courses GET test: ${table}`);
    });

    const response = await GET(new Request('http://localhost/api/education/courses'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.classrooms).toEqual([expect.objectContaining({
      id: courseId,
      code: 'MAM-A1',
      name: 'Projection Name',
      grade: 'Khối Mầm (3 tuổi)',
      gradeKey: 'mam',
      room: 'Phòng 105',
      students: 2,
      maxStudents: 25,
      status: 'active',
      teacher: 'Cô An (Chủ nhiệm)',
    })]);
    expect(queriedTables[0]).toBe('edu_courses');
    expect(queriedTables).toContain('courses');
    expect(mockTenantFilter).toHaveBeenCalledWith('tenant_id', tenantId);
    expect(mockGetCourseTeachers).toHaveBeenCalledWith(tenantId, courseId);
    expect(tenantScopes).toEqual([
      { table: 'edu_courses', column: 'tenant_id', value: tenantId },
      { table: 'courses', column: 'tenant_id', value: tenantId },
      { table: 'party_parties', column: 'tenant_id', value: tenantId },
      { table: 'edu_enrollments', column: 'tenant_id', value: tenantId },
      { table: 'edu_enrollments', column: 'tenant_id', value: tenantId },
      { table: 'edu_attendance_daily_state', column: 'tenant_id', value: tenantId },
    ]);
  });

  it('correctly maps gradeKey for all preschool grades including nursery (Nhà Trẻ)', async () => {
    const mockEduCourses = [
      { id: 'c-nursery', course_code: 'NHA-TRE-1', title: 'Lớp Nhà trẻ 1 — Gấu Misa', status: 'active', max_students: 18, current_enrollment: 0, created_at: '2026-10-01' },
      { id: 'c-choi', course_code: 'CHOI-1', title: 'Lớp Chồi 1 — Sóc Nhí', status: 'active', max_students: 25, current_enrollment: 0, created_at: '2026-10-02' },
      { id: 'c-la', course_code: 'LA-1', title: 'Lớp Lá 1 — Vàng Anh', status: 'active', max_students: 25, current_enrollment: 0, created_at: '2026-10-03' },
      { id: 'c-mam', course_code: 'MAM-NON-1', title: 'Lớp Mầm non 1 — Họa Mi', status: 'active', max_students: 25, current_enrollment: 0, created_at: '2026-10-04' },
    ];

    mockCourseAssignments.mockResolvedValue(mockEduCourses.map((row)=>({course_id:row.id,branch_id:'branch-a'})));
    mockFrom.mockImplementation((table: string) => {
      if (table === 'edu_courses') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: mockEduCourses,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'courses') {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({
                data: mockEduCourses.map((c) => ({
                  course_id: c.id,
                  course_code: c.course_code,
                  course_name: c.title,
                  description: null,
                  duration_weeks: 25,
                  metadata: {},
                  status: 'active',
                })),
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'edu_enrollments') {
        return {
          select: (_cols: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head) {
              return {
                eq: () => ({ eq: () => ({in:()=>({ in: async () => ({ count: 0, error: null }) })}) }),
              };
            }
            return {
              eq: () => ({ eq: () => ({in:()=>({ in: async () => ({ data: [], error: null }) })}) }),
            };
          },
        };
      }
      if (table === 'edu_attendance_daily_state') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }),
          }),
        };
      }
      throw new Error(`Unexpected table access: ${table}`);
    });

    const response = await GET(new Request('http://localhost/api/education/courses'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const classrooms = body.classrooms;
    expect(classrooms.find((c: { id: string }) => c.id === 'c-nursery')?.gradeKey).toBe('nursery');
    expect(classrooms.find((c: { id: string }) => c.id === 'c-choi')?.gradeKey).toBe('choi');
    expect(classrooms.find((c: { id: string }) => c.id === 'c-la')?.gradeKey).toBe('la');
    expect(classrooms.find((c: { id: string }) => c.id === 'c-mam')?.gradeKey).toBe('mam');

    expect(classrooms.find((c: { id: string }) => c.id === 'c-nursery')?.grade).toBe('Nhà Trẻ (18-36 tháng)');
  });

  it('holds Course creation before any legacy or canonical persistence attempt', async () => {
    const deletedCourseIds: string[] = [];
    const newCourse = {
      course_id: courseId,
      tenant_id: tenantId,
      course_code: 'MAM-A1',
      course_name: 'Lớp Mầm A1',
      description: 'Khối Mầm (3 tuổi)',
      duration_weeks: 25,
      metadata: { room: 'Phòng 105' },
      status: 'active',
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'courses') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: newCourse, error: null }),
            }),
          }),
          delete: () => ({
            eq: () => ({
              eq: (_column: string, value: string) => {
                deletedCourseIds.push(value);
                return { error: null };
              },
            }),
          }),
        };
      }

      if (table === 'edu_courses') {
        return {
          insert: async () => ({
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
          }),
        };
      }

      throw new Error(`Unexpected table access in courses POST test: ${table}`);
    });

    const post: (request: Request) => Promise<Response> = POST;
    const response = await post(new Request('http://localhost/api/education/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        courseCode: 'MAM-A1',
        courseName: 'Lớp Mầm A1',
        maxStudents: 25,
        room: 'Phòng 105',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toBe('CANONICAL_COURSE_UNAVAILABLE');
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockGetCourseTeachers).not.toHaveBeenCalled();
    expect(deletedCourseIds).toEqual([]);
  });
});
