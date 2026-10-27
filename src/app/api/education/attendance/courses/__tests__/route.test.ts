import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NextResponse } from 'next/server';

const mockContext = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockAdmin = jest.fn(() => ({}));
const mockSessionClient = {};
const mockTeacherContext = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockTeacherCourses = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockTenantPresentation = jest.fn<() => Promise<unknown>>();
jest.mock('../../request-context', () => ({
  ...jest.requireActual('../../request-context'),
  resolveAttendanceRequestContext: mockTeacherContext,
  assertAttendanceDay: jest.fn(),
}));
jest.mock('@/products/bella-education/services/preschool-teacher-attendance.service', () => ({
  PreschoolTeacherAttendanceService: jest.fn().mockImplementation(() => ({ listCourses: mockTeacherCourses })),
}));
jest.mock('@/services/tenant-actions', () => ({ getTenantPresentation: () => mockTenantPresentation() }));
const mockAccess = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockAssignments = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockCourse = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRoster = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockCheckCourse = jest.fn(async (..._args: unknown[]) => undefined);
const mockCheckEnrollment = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('../../../courses/request-context', () => ({
  COURSE_PRIVATE_HEADERS: { 'Cache-Control': 'private, no-store' },
  resolveCourseReadContext: mockContext,
}));
jest.mock('@supabase/supabase-js', () => ({ createClient: mockAdmin }));
jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://synthetic.invalid', getSupabaseAdminKey: () => 'synthetic-test-key',
}));
jest.mock('@/platform/org-unit/trusted-actor-access.contract.impl', () => ({
  TrustedActorOrgUnitAccessContractImpl: jest.fn().mockImplementation(() => ({ listForActor: mockAccess })),
}));
jest.mock('@/products/bella-education/services/preschool-chain.service', () => ({
  PreschoolChainService: jest.fn().mockImplementation(() => ({ listCourseAssignments: mockAssignments })),
  PreschoolChainError: class extends Error { constructor(message: string, public status = 409) { super(message); } },
}));
jest.mock('@/products/bella-education/services/preschool-attendance-access.service', () => ({
  PreschoolAttendanceAccessService: jest.fn().mockImplementation(() => ({
    assertCourseAccess: mockCheckCourse, assertEnrollmentAccess: mockCheckEnrollment,
  })),
}));
jest.mock('../../../enrollments/admission-course-reader', () => ({
  admissionCourseReader: () => ({ readCourse: mockCourse }),
}));
jest.mock('@/platform/education/contracts/attendance.contract.impl', () => ({
  AttendanceContractImpl: jest.fn().mockImplementation(() => ({ getCourseDailyAttendance: mockRoster })),
}));
const { GET } = require('../route') as typeof import('../route');
const request = (query = '') => new Request(`http://localhost/api/education/attendance/courses?date=2026-10-23${query}`);
const relationship = { tenant_id: 'tenant-A', user_id: 'actor-A', org_unit_id: 'branch-A', relationship_id: 'relation-A', access_source: 'belongs_to' };

beforeEach(() => {
  jest.clearAllMocks();
  mockTeacherContext.mockResolvedValue({ client: mockSessionClient, tenantId: 'tenant-A', actorId: 'actor-A', actorRole: 'admin_staff', productKey: 'bella_preschool' });
  mockTeacherCourses.mockReset();
  mockTeacherCourses.mockResolvedValue([{ courseId: 'course-A', name: 'Assigned class', branchId: 'branch-A' }]);
  mockContext.mockResolvedValue({ allowed: true, tenantId: 'tenant-A', actor: { id: 'actor-A', role: 'admin' }, supabase: mockSessionClient });
  mockTenantPresentation.mockResolvedValue({ id: 'tenant-A', product_key: 'bella_preschool', status: 'active' });
  mockAccess.mockResolvedValue([relationship]);
  mockAssignments.mockResolvedValue([{ tenant_id: 'tenant-A', course_id: 'course-A', branch_id: 'branch-A' }]);
  mockCourse.mockResolvedValue({ id: 'course-A', title: 'Canonical Class', status: 'active' });
  mockRoster.mockResolvedValue([
    { enrollmentId: 'enrollment-A', studentPartyId: 'student-A', attendance: { status: 'present' } },
    { enrollmentId: 'enrollment-B', studentPartyId: 'student-B', attendance: null },
  ]);
  mockCheckCourse.mockReset(); mockCheckCourse.mockResolvedValue(undefined);
  mockCheckEnrollment.mockReset(); mockCheckEnrollment.mockResolvedValue(undefined);
});

describe('Attendance canonical course discovery', () => {
  it.each([401, 403])('stops rejected Auth/tenant context (%s) before privileged client creation', async status => {
    mockContext.mockResolvedValue({ allowed: false, response: NextResponse.json({ success: false }, { status }) });
    expect((await GET(request())).status).toBe(status);
    expect(mockAdmin).not.toHaveBeenCalled();
    expect(mockAccess).not.toHaveBeenCalled();
  });

  it.each(['accountant', 'parent'])('denies the %s action before privileged access', async role => {
    mockContext.mockResolvedValue({ allowed: true, tenantId: 'tenant-A', actor: { id: 'actor-A', role } });
    expect((await GET(request())).status).toBe(403);
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it('uses canonical IDs, actual daily counts and unknown metadata', async () => {
    const { AttendanceContractImpl } = await import('@/platform/education/contracts/attendance.contract.impl');
    const reply = await GET(request('&branchId=branch-A'));
    expect(reply.status).toBe(200);
    expect(reply.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await reply.json();
    expect(body.tenantId).toBe('tenant-A');
    expect(body.classrooms).toEqual([{
      id: 'course-A', name: 'Canonical Class', branchId: 'branch-A', students: 2,
      maxStudents: null, gradeKey: null, todayStatus: { present: 1, absent: 0, excused: 0, unmarked: 1 },
    }]);
    expect(mockCourse).toHaveBeenCalledWith('tenant-A', 'course-A');
    expect(mockRoster).toHaveBeenCalledWith({ tenantId: 'tenant-A', courseId: 'course-A', schoolDay: '2026-10-23' });
    expect(mockCheckEnrollment).toHaveBeenCalledWith('tenant-A', 'actor-A', 'enrollment-A', 'student-A', 'course-A');
    expect(mockCheckCourse).toHaveBeenCalledTimes(2);
    expect(AttendanceContractImpl).toHaveBeenCalledWith(mockSessionClient, 'bella_preschool');
  });

  it('lists only teacher-authorized classes without a privileged catalog', async () => {
    mockContext.mockResolvedValue({ allowed: true, tenantId: 'tenant-A', actor: { id: 'actor-A', role: 'admin_staff' } });
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tenantId).toBe('tenant-A');
    expect(body.classrooms).toEqual([expect.objectContaining({ id: 'course-A', name: 'Assigned class' })]);
    expect(mockAdmin).not.toHaveBeenCalled();
    expect(mockAssignments).not.toHaveBeenCalled();
    expect(mockCourse).not.toHaveBeenCalled();
  });

  it('fails closed on teacher discovery revocation before roster access', async () => {
    const { PreschoolChainError } = await import('@/products/bella-education/services/preschool-chain.service');
    mockContext.mockResolvedValue({ allowed: true, tenantId: 'tenant-A', actor: { id: 'actor-A', role: 'admin_staff' } });
    mockTeacherCourses.mockRejectedValue(new PreschoolChainError('ATTENDANCE_TEACHER_ACCESS_DENIED', 403));
    expect((await GET(request())).status).toBe(403);
    expect(mockRoster).not.toHaveBeenCalled();
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it.each([['&branch_id=foreign', 403], ['&date=2026-10-23', 400], ['&branchId=invalid', 400]])('rejects ambiguous or unsupported teacher selector %s', async (query, status) => {
    mockContext.mockResolvedValue({ allowed: true, tenantId: 'tenant-A', actor: { id: 'actor-A', role: 'admin_staff' } });
    expect((await GET(request(query as string))).status).toBe(status);
    expect(mockTeacherCourses).not.toHaveBeenCalled();
    expect(mockRoster).not.toHaveBeenCalled();
  });

  it('never treats tenant-admin provenance as explicit branch access', async () => {
    mockAccess.mockResolvedValue([{ ...relationship, access_source: 'tenant_admin', relationship_id: null }]);
    const reply = await GET(request());
    expect((await reply.json()).classrooms).toEqual([]);
    expect(mockCourse).not.toHaveBeenCalled();
    expect((await GET(request('&branchId=branch-A'))).status).toBe(403);
  });

  it('filters other branches before canonical course or student reads', async () => {
    mockAssignments.mockResolvedValue([{ tenant_id: 'tenant-A', course_id: 'course-B', branch_id: 'branch-B' }]);
    expect((await (await GET(request())).json()).classrooms).toEqual([]);
    expect(mockCourse).not.toHaveBeenCalled(); expect(mockRoster).not.toHaveBeenCalled();
  });

  it('denies foreign actor projection and explicit ungranted branch', async () => {
    expect((await GET(request('&branchId=branch-B'))).status).toBe(403);
    mockAccess.mockResolvedValue([{ ...relationship, tenant_id: 'foreign' }]);
    expect((await GET(request())).status).toBe(403);
    expect(mockAssignments).not.toHaveBeenCalled();
  });

  it.each(['2026-02-30', 'not-a-date'])('rejects invalid date %s before any data operation', async date => {
    expect((await GET(new Request(`http://localhost/api/education/attendance/courses?date=${date}`))).status).toBe(400);
    expect(mockAdmin).not.toHaveBeenCalled();
  });

  it('fails closed on DB errors without returning an empty success or internal SQL', async () => {
    mockCourse.mockRejectedValue(new Error('synthetic SQL diagnostic'));
    const reply = await GET(request());
    expect(reply.status).toBe(500);
    expect(await reply.json()).toEqual({ success: false, error: 'ATTENDANCE_COURSES_READ_FAILED' });
  });

  it('does not substitute a missing or mismatched canonical ID', async () => {
    mockCourse.mockResolvedValue({ id: 'wrong-course', title: 'Wrong', status: 'active' });
    expect((await GET(request())).status).toBe(409);
    expect(mockRoster).not.toHaveBeenCalled();
  });

  it('fails closed when current access is revoked during read-back', async () => {
    mockCheckCourse.mockRejectedValueOnce(new Error('ACCESS_LOOKUP_FAILED'));
    expect((await GET(request())).status).toBe(500);
    expect(mockCourse).not.toHaveBeenCalled();
  });

  it('does not list inactive canonical courses', async () => {
    mockCourse.mockResolvedValue({ id: 'course-A', title: 'Canonical Class', status: 'archived' });
    expect((await (await GET(request())).json()).classrooms).toEqual([]);
    expect(mockRoster).not.toHaveBeenCalled();
  });
});
