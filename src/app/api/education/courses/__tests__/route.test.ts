import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockFrom = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockGetCourseTeachers = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    from: mockFrom,
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

const { GET, POST } = require('../route') as typeof import('../route');

const tenantId = '00000000-0000-0000-0000-0000000000aa';
const courseId = '00000000-0000-0000-0000-0000000000cc';

describe('/api/education/courses canonical classroom route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ tenant_id: tenantId });
    mockGetCourseTeachers.mockResolvedValue([]);
  });

  it('lists classrooms from canonical edu_courses and only uses courses as display projection', async () => {
    const queriedTables: string[] = [];

    mockFrom.mockImplementation((table: string) => {
      queriedTables.push(table);

      if (table === 'edu_courses') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
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
              }),
            }),
          }),
        };
      }

      if (table === 'edu_enrollments') {
        const chain = {
          select: (columns: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head) {
              return {
                eq: () => ({
                  eq: () => ({
                    in: async () => ({ count: 2, error: null }),
                  }),
                }),
              };
            }

            return {
              eq: () => ({
                eq: () => ({
                  in: async () => ({ data: [{ id: 'enrollment-1' }, { id: 'enrollment-2' }], error: null }),
                }),
              }),
            };
          },
        };
        return chain;
      }

      if (table === 'edu_attendance_daily_state') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: async () => ({ data: [{ status: 'present' }], error: null }),
              }),
            }),
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
      room: 'Phòng 105',
      students: 2,
      maxStudents: 25,
      status: 'active',
    })]);
    expect(queriedTables[0]).toBe('edu_courses');
    expect(queriedTables).toContain('courses');
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
    expect(body.error).toBe('COURSE_AUTHORIZATION_NOT_READY');
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockGetCourseTeachers).not.toHaveBeenCalled();
    expect(deletedCourseIds).toEqual([]);
  });
});
