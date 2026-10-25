import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockResolveContext = jest.fn();
const mockAssertSelectors = jest.fn();
const mockAuthorizeCourse = jest.fn();
const mockGetStudent = jest.fn();
const mockSearchCandidates = jest.fn();
const mockEnrollStudent = jest.fn();
const mockGetWorkflow = jest.fn();
const mockFrom = jest.fn();

jest.mock('../../attendance/request-context', () => ({
  resolveAttendanceRequestContext: mockResolveContext,
  assertAttendanceSelectors: mockAssertSelectors,
  authorizeAttendanceCourse: mockAuthorizeCourse,
  AttendanceAccessError: class AttendanceAccessError extends Error {
    constructor(readonly status: number, readonly code: string) { super(code); }
  },
}));
jest.mock('@/platform/education/contracts/student.contract.impl', () => ({
  StudentContractImpl: class { getStudent = mockGetStudent; searchEnrollmentCandidates = mockSearchCandidates; },
}));
jest.mock('@/platform/education/contracts/enrollment.contract.impl', () => ({
  EnrollmentContractImpl: class { enrollPreschoolStudent = mockEnrollStudent; },
}));
jest.mock('@/platform/education/contracts/workflow-registry.contract.impl', () => ({
  WorkflowRegistryContractImpl: class { getWorkflow = mockGetWorkflow; },
}));

const { GET, POST } = require('../route') as typeof import('../route');
const tenantId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const courseId = '33333333-3333-4333-8333-333333333333';
const studentPartyId = '44444444-4444-4444-8444-444444444444';
const guardianPartyId = '55555555-5555-4555-8555-555555555555';
const requestId = '66666666-6666-4666-8666-666666666666';
const body = { courseId, studentPartyId, guardianPartyId, requestId };
const context = { tenantId, actorId, productKey: 'bella_preschool', client: { from: mockFrom } };

function relationshipQuery(result: { data: unknown[]; count: number | null; error: unknown }) {
  const query = {
    select: jest.fn(() => query), eq: jest.fn(() => query), in: jest.fn(() => query),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}
function jsonRequest(payload: unknown) {
  return new Request('http://localhost/api/education/enrollments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveContext.mockResolvedValue(context);
  mockAssertSelectors.mockImplementation(() => undefined);
  mockAuthorizeCourse.mockResolvedValue(undefined);
  mockGetStudent.mockResolvedValue({ tenantId, partyId: studentPartyId, academicStatus: 'active' });
  mockSearchCandidates.mockResolvedValue({ tenantId, courseId, candidates: [], nextCursor: null });
  mockGetWorkflow.mockRejectedValue(new Error('workflow not registered; Education service default is active'));
  mockFrom.mockReturnValue(relationshipQuery({
    data: [{ id: 'rel-1', tenant_id: tenantId, source_party_id: guardianPartyId, target_party_id: studentPartyId,
      relationship_type: 'guardian_of', active_from: null, active_to: null }], count: 1, error: null,
  }));
  mockEnrollStudent.mockResolvedValue({ id: 'enrollment-1', tenantId, studentPartyId, courseId, status: 'active', enrolledAt: '2026-10-22T00:00:00.000Z' });
});

describe('Preschool Enrollment v1 API', () => {
  it('authorizes the Course/branch before invoking the approved caller-scoped candidate contract', async () => {
    const request = new Request(`http://localhost/api/education/enrollments?view=candidates&courseId=${courseId}&query=An&limit=10`);
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mockAuthorizeCourse).toHaveBeenCalledWith(context, request, courseId, expect.any(String));
    expect(mockAuthorizeCourse.mock.invocationCallOrder[0]).toBeLessThan(mockSearchCandidates.mock.invocationCallOrder[0]);
    expect(mockSearchCandidates).toHaveBeenCalledWith({ courseId, query: 'An', limit: 10, cursor: undefined });
    expect(await response.json()).toEqual({ success: true, tenantId, courseId, candidates: [], nextCursor: null });
    expect(mockEnrollStudent).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('keeps candidate discovery unavailable on a dependency/RLS failure without returning provider details', async () => {
    mockSearchCandidates.mockRejectedValue(new Error('42501 sensitive provider details'));
    const response = await GET(new Request(`http://localhost/api/education/enrollments?view=candidates&courseId=${courseId}&query=An`));
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ success: false, error: 'ENROLLMENT_WORKFLOW_UNAVAILABLE' });
  });

  it.each(['query=a', 'query=**', 'query=An&limit=21', 'query=An&limit=0', 'query=An&cursor=invalid', 'query=An&query=Other', 'query=An&unknown=true'])('rejects invalid search before invoking a contract: %s', async suffix => {
    const response = await GET(new Request(`http://localhost/api/education/enrollments?view=candidates&courseId=${courseId}&${suffix}`));
    expect(response.status).toBe(400);
    expect(mockAuthorizeCourse).not.toHaveBeenCalled();
    expect(mockSearchCandidates).not.toHaveBeenCalled();
    expect(mockEnrollStudent).not.toHaveBeenCalled();
  });

  it('does not search candidates when Course/branch authorization fails', async () => {
    mockAuthorizeCourse.mockRejectedValueOnce(new Error('branch unavailable'));
    const response = await GET(new Request(`http://localhost/api/education/enrollments?view=candidates&courseId=${courseId}&query=An`));
    expect(response.status).toBe(503);
    expect(mockSearchCandidates).not.toHaveBeenCalled();
  });

  it('authorizes Course/branch then delegates guardian and Student validation through the public mutation capability', async () => {
    const response = await POST(jsonRequest(body));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mockAuthorizeCourse).toHaveBeenCalledWith(context, expect.any(Request), courseId, expect.any(String), body);
    expect(mockAuthorizeCourse.mock.invocationCallOrder[0]).toBeLessThan(mockEnrollStudent.mock.invocationCallOrder[0]);
    expect(mockEnrollStudent).toHaveBeenCalledWith({ tenantId, studentPartyId, guardianPartyId, courseId, requestId });
    expect(mockFrom).not.toHaveBeenCalled(); expect(mockGetStudent).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ success: true, enrollment: { status: 'active', courseId, studentPartyId } });
  });

  it('rejects unauthenticated context before parsing or mutation', async () => {
    const request = jsonRequest(body); const parse = jest.spyOn(request, 'json');
    mockResolveContext.mockRejectedValue(new Error('AUTH_ROLE_PERMISSION_ERROR'));
    expect((await POST(request)).status).toBe(503); expect(parse).not.toHaveBeenCalled(); expect(mockEnrollStudent).not.toHaveBeenCalled();
  });

  it.each(['DENIED', 'UNAVAILABLE', 'CONFLICT', 'INVALID_REQUEST'] as const)('sanitizes public capability error %s', async code => {
    const { EducationPreschoolEnrollmentError } = await import('@/platform/education/contracts/enrollment.contract');
    mockEnrollStudent.mockRejectedValue(new EducationPreschoolEnrollmentError(code));
    const response = await POST(jsonRequest(body));
    expect(response.status).toBe(code === 'DENIED' ? 403 : code === 'INVALID_REQUEST' ? 400 : 503);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(JSON.stringify(await response.json())).not.toContain('42501');
  });

  it.each([{ ...body, student_party_id: studentPartyId }, { ...body, request_id: requestId }, { ...body, override: true }, { ...body, requestId: 'invalid' }])('rejects invalid/duplicate selectors with zero side effects: %j', async payload => {
    expect((await POST(jsonRequest(payload))).status).toBe(400); expect(mockEnrollStudent).not.toHaveBeenCalled();
  });

  it.each([
    ['STUDENT_DENIED', 'ENROLLMENT_STUDENT_ACCESS_DENIED'],
    ['GUARDIAN_REQUIRED', 'ENROLLMENT_GUARDIAN_RELATIONSHIP_REQUIRED'],
  ] as const)('preserves the HTTP v1 body for %s', async (code, error) => {
    const { EducationPreschoolEnrollmentError } = await import('@/platform/education/contracts/enrollment.contract');
    mockEnrollStudent.mockRejectedValue(new EducationPreschoolEnrollmentError(code));
    const response = await POST(jsonRequest(body));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ success: false, error });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('never mutates when Course/branch authorization fails', async () => {
    mockAuthorizeCourse.mockRejectedValue(new Error('denied'));
    expect((await POST(jsonRequest(body))).status).toBe(503); expect(mockEnrollStudent).not.toHaveBeenCalled();
  });

  it.each([{ tenantId: 'foreign' }, { courseId: 'foreign' }, { studentPartyId: 'foreign' }, { status: 'pending' }])('does not report success for a mismatched public result: %j', async override => {
    mockEnrollStudent.mockResolvedValue({ id: 'id', ...body, tenantId, status: 'active', ...override });
    expect((await POST(jsonRequest(body))).status).toBe(503);
  });
});
