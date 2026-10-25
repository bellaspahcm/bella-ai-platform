import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockGetUser = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockAdmit = jest.fn();
const mockAdminClient = jest.fn();
jest.mock('@/services/user-actions', () => ({ getCurrentUser: mockGetCurrentUser }));
jest.mock('@/lib/supabase-admin-env', () => ({ getSupabaseAdminUrl: () => 'http://configured-admin.local', getSupabaseAdminKey: () => 'controlled-admin-key' }));
jest.mock('@supabase/supabase-js', () => ({ createClient: mockAdminClient }));
jest.mock('@/products/bella-education/services/preschool-admission.service', () => {
  const actual = jest.requireActual('@/products/bella-education/services/preschool-admission.service') as typeof import('@/products/bella-education/services/preschool-admission.service');
  return { ...actual, PreschoolAdmissionService: jest.fn().mockImplementation(() => ({ admit: mockAdmit })) };
});
const mockFrom = jest.fn();
const mockRegisterStudent = jest.fn();
const mockGetStudent = jest.fn();
const mockEnrollStudent = jest.fn();
const mockGetEnrollment = jest.fn();
const mockEstablishGuardianAuthorization = jest.fn();
const mockGetAuthorizedGuardians = jest.fn();
const mockAssignEnrollmentToBranch = jest.fn();
const mockGetEnrollmentChain = jest.fn();
const mockPreflightEnrollmentBranch = jest.fn<() => Promise<void>>();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

jest.mock('@/platform/education/contracts/student.contract.impl', () => ({
  StudentContractImpl: jest.fn().mockImplementation(() => ({
    registerStudent: mockRegisterStudent,
    getStudent: mockGetStudent,
  })),
}));

jest.mock('@/platform/education/contracts/enrollment.contract.impl', () => ({
  EnrollmentContractImpl: jest.fn().mockImplementation(() => ({
    getEnrollment: mockGetEnrollment,
  })),
}));

jest.mock('@/products/bella-education/services/enrollment.service', () => ({
  EnrollmentProductService: jest.fn().mockImplementation(() => ({
    enrollStudent: mockEnrollStudent,
  })),
}));

jest.mock('@/products/bella-education/services/preschool-guardian-authorization.service', () => ({
  normalizePreschoolGuardianPhone: (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) throw new Error('GUARDIAN_PHONE_REQUIRED');
    return digits;
  },
  PreschoolGuardianAuthorizationService: jest.fn().mockImplementation(() => ({
    establishForEnrollment: mockEstablishGuardianAuthorization,
    getAuthorizedGuardians: mockGetAuthorizedGuardians,
  })),
}));

jest.mock('@/products/bella-education/services/preschool-chain.service', () => ({
  ...jest.requireActual('@/products/bella-education/services/preschool-chain.service') as typeof import('@/products/bella-education/services/preschool-chain.service'),
  PreschoolChainService: jest.fn().mockImplementation(() => ({
    preflightEnrollmentBranch: mockPreflightEnrollmentBranch,
    assignEnrollmentToBranch: mockAssignEnrollmentToBranch,
    getEnrollmentChain: mockGetEnrollmentChain,
    listEnrollmentAssignments:jest.fn(async()=>[{tenantId,courseId,enrollmentId:'enrollment-1',branchId,requestId:'request-1',assignedBy:userId}]),
    assertEnrollmentAccess:jest.fn(async()=>undefined),
  })),
}));

const { GET, POST } = require('../route') as typeof import('../route');

const tenantId = '00000000-0000-0000-0000-0000000000aa';
const userId = '00000000-0000-0000-0000-000000000001';
const partyId = '00000000-0000-0000-0000-0000000000bb';
const guardianPartyId = '00000000-0000-0000-0000-0000000000dd';
const courseId = '00000000-0000-0000-0000-0000000000cc';
const branchId = '00000000-0000-0000-0000-0000000000ee';

const insertedRows: unknown[] = [];
const operationOrder: string[] = [];
const queryFilters: Array<{ readonly table: string; readonly column: string; readonly value: unknown }> = [];

function buildRequest(body: object): Request {
  return new Request('http://localhost/api/education/enrollments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setupSupabaseMocks() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'preschool_admission_operations') return {select:()=>({eq:()=>({in:async()=>({data:[],error:null})})})};
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { tenant_id: tenantId }, error: null }),
          }),
        }),
      };
    }

    if (table === 'edu_courses') {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          queryFilters.push({ table, column, value });
          return chain;
        },
        in: async () => ({
          data: [{ id: courseId, title: 'Lớp Mầm A1' }],
          error: null,
        }),
        maybeSingle: async () => ({ data: { id: courseId, title: 'Lớp Mầm A1' }, error: null }),
      };
      return chain;
    }

    if (table === 'party_parties') {
      const selectChain = {
        eq: (column: string, value: unknown) => {
          queryFilters.push({ table, column, value });
          return selectChain;
        },
        in: async () => ({
          data: [{
            id: partyId,
            display_name: 'Lê Hoàng Nam',
            dob: '2023-06-15',
            gender: 'male',
          }],
          error: null,
        }),
      };
      return {
        insert: (row: unknown) => {
          operationOrder.push('party-insert');
          insertedRows.push(row);
          return {
            select: () => ({
              single: async () => ({ data: { id: partyId }, error: null }),
            }),
          };
        },
        select: () => selectChain,
      };
    }

    if (table === 'edu_enrollments') {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          queryFilters.push({ table, column, value });
          return chain;
        },
        in: () => chain,
        order: () => chain,
        limit: async () => ({
          data: [{
            id: 'enrollment-1',
            course_id: courseId,
            student_party_id: partyId,
            status: 'active',
            request_id:'request-1',
            enrolled_at: '2026-09-26T00:00:00.000Z',
          }],
          error: null,
        }),
      };
      return chain;
    }

    if (table === 'students') {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          queryFilters.push({ table, column, value });
          return chain;
        },
        in: async () => ({
          data: [{
            student_id: 'student-row-1',
            party_id: partyId,
            student_code: 'EDU-2026-123456',
            metadata: { nickname: 'Bé Tôm', medicalNote: 'Dị ứng sữa bò' },
          }],
          error: null,
        }),
      };
      return chain;
    }

    throw new Error(`Unexpected table access in Preschool enrollment route test: ${table}`);
  });
}

describe('GET /api/education/enrollments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insertedRows.length = 0;
    queryFilters.length = 0;
    mockGetCurrentUser.mockResolvedValue({id:userId,tenant_id:tenantId,role:'admin'});
    setupSupabaseMocks();
    mockAdminClient.mockReturnValue({ from: mockFrom });

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: userId,
          user_metadata: { tenant_id: tenantId },
        },
      },
      error: null,
    });
    mockGetAuthorizedGuardians.mockResolvedValue(new Map([
      [partyId, [{
        authorizationId: 'guardian-authorization-1',
        studentPartyId: partyId,
        guardianPartyId,
        displayName: 'Lê Văn Thành',
        phone: '0989112334',
        status: 'authorized',
      }]],
    ]));
  });

  it('reads the student registry from canonical tenant-scoped enrollments and Party-backed student rows', async () => {
    const response = await GET(new Request('http://localhost/api/education/enrollments'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.students).toEqual([expect.objectContaining({
      id: 'EDU-2026-123456',
      enrollmentId: 'enrollment-1',
      studentId: 'student-row-1',
      partyId,
      name: 'Lê Hoàng Nam',
      nickname: 'Bé Tôm',
      dateOfBirth: '2023-06-15',
      gender: 'Nam',
      className: 'Lớp Mầm A1',
      parentName: 'Lê Văn Thành',
      parentPhone: '0989112334',
      hasHealthAlert: true,
      medicalNote: 'Dị ứng sữa bò',
      status: 'Đang Học',
      statusKey: 'active',
    })]);
    expect(mockGetAuthorizedGuardians).toHaveBeenCalledWith(tenantId, [partyId]);

    expect(queryFilters).toEqual(expect.arrayContaining([
      { table: 'edu_enrollments', column: 'tenant_id', value: tenantId },
      { table: 'party_parties', column: 'tenant_id', value: tenantId },
      { table: 'students', column: 'tenant_id', value: tenantId },
      { table: 'edu_courses', column: 'tenant_id', value: tenantId },
    ]));
  });
});

describe('POST /api/education/enrollments canonical auth and durable request boundary', () => {
  const operationKey = '10000000-0000-4000-8000-000000000001';
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminClient.mockReturnValue({ from: mockFrom });
    mockGetCurrentUser.mockResolvedValue({ id: userId, tenant_id: tenantId, role: 'admin' });
    mockAdmit.mockResolvedValue({ success: true, operationKey, student: { partyId }, enrollment: { id: 'enrollment-1' }, chain: { branchId } });
  });

  it('authenticates live canonical actor before constructing the configured privileged client', async () => {
    const response = await POST(buildRequest({ operationKey, childName: 'Child', branchId, courseId }));
    expect(response.status).toBe(201);
    expect(mockGetCurrentUser.mock.invocationCallOrder[0]).toBeLessThan(mockAdminClient.mock.invocationCallOrder[0]);
    expect(mockAdmit).toHaveBeenCalledWith({ tenantId, actorId: userId, operationKey, payload: { operationKey, childName: 'Child', branchId, courseId } });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it.each(['admin', 'super_admin'])('allows the approved current admission role %s', async (role) => {
    mockGetCurrentUser.mockResolvedValue({ id: userId, tenant_id: tenantId, role });
    expect((await POST(buildRequest({ operationKey }))).status).toBe(201);
    expect(mockAdmit).toHaveBeenCalledWith({ tenantId, actorId: userId, operationKey });
  });

  it.each(['admin_staff', 'accountant', 'parent', 'ktv', ''])('denies role %s before any operation client or recovery', async (role) => {
    mockGetCurrentUser.mockResolvedValue({ id: userId, tenant_id: tenantId, role });
    expect((await POST(buildRequest({ operationKey }))).status).toBe(403);
    expect(mockAdminClient).not.toHaveBeenCalled(); expect(mockAdmit).not.toHaveBeenCalled();
  });

  it('denies anonymous before configured admin construction', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    expect((await POST(buildRequest({ operationKey }))).status).toBe(401);
    expect(mockAdminClient).not.toHaveBeenCalled(); expect(mockAdmit).not.toHaveBeenCalled();
  });

  it('rejects body tenant selection and malformed/missing operation key before client construction', async () => {
    expect((await POST(buildRequest({ operationKey, tenantId: 'foreign' }))).status).toBe(403);
    expect((await POST(buildRequest({ childName: 'Child' }))).status).toBe(400);
    expect(mockAdminClient).not.toHaveBeenCalled(); expect(mockAdmit).not.toHaveBeenCalled();
  });

  it('preserves a payload conflict as 409 and a missing operation as 404', async () => {
    const { PreschoolAdmissionError } = await import('@/products/bella-education/services/preschool-admission.service');
    mockAdmit.mockRejectedValueOnce(new PreschoolAdmissionError('PRESCHOOL_ADMISSION_PAYLOAD_CONFLICT', 409));
    expect((await POST(buildRequest({ operationKey }))).status).toBe(409);
    mockAdmit.mockRejectedValueOnce(new PreschoolAdmissionError('PRESCHOOL_ADMISSION_OPERATION_NOT_FOUND', 404));
    expect((await POST(buildRequest({ operationKey }))).status).toBe(404);
  });

  it('returns only actor/tenant context for actor-scoped key storage with no privileged client', async () => {
    const response = await GET(new Request('http://localhost/api/education/enrollments?admissionContext=1'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, admissionContext: { actorId: userId, tenantId } });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mockAdminClient).not.toHaveBeenCalled();
  });
});
