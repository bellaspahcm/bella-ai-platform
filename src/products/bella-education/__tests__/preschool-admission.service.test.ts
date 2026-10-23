import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { PreschoolAdmissionError, PreschoolAdmissionService, normalizeAdmissionPayload } from '../services/preschool-admission.service';
import type { EducationStudentDTO } from '@/platform/education/contracts/student.contract';
import type { EducationEnrollmentDTO } from '@/platform/education/contracts/enrollment.contract';
import type { RegisteredPersonIdentity } from '@/platform/party/registration.contract';
import type { PreschoolChainAssignmentDTO } from '../services/preschool-chain.service';

jest.mock('@/lib/supabase-server', () => ({ createClient: jest.fn() }));

const tenantId = '10000000-0000-4000-8000-000000000001';
const actorId = '10000000-0000-4000-8000-000000000002';
const operationKey = '10000000-0000-4000-8000-000000000003';
const branchId = '10000000-0000-4000-8000-000000000004';
const courseId = '10000000-0000-4000-8000-000000000005';
const childId = '10000000-0000-4000-8000-000000000006';
const guardianId = '10000000-0000-4000-8000-000000000007';
const requestId = '10000000-0000-4000-8000-000000000008';
const payload = { childName: 'Child', nickname: 'Nickname', dateOfBirth: '2023-06-15', gender: 'Nam',
  guardianName: 'Guardian', guardianPhone: '+84 989 112 334', medicalNote: 'Care note', branchId, courseId };

function harness(failure?: string) {
  const persisted = {
    operation: null as null | { tenant_id: string; actor_id: string; operation_key: string; branch_id: string; payload: object; student_code: string; enrollment_request_id: string },
    identities: new Map<string, RegisteredPersonIdentity>(),
    student: null as EducationStudentDTO | null,
    enrollment: null as EducationEnrollmentDTO | null,
    assignment: null as PreschoolChainAssignmentDTO | null,
  };
  let remainingFailure = failure;
  let role = 'admin';
  let allowedBranch = true;
  let status = 'active';
  const order: string[] = [];
  function fail(point: string) {
    if (remainingFailure === point) { remainingFailure = undefined; throw new Error(`controlled-${point}`); }
  }
  const rpc = jest.fn(async (_name: string, args: { p_payload?: object; p_tenant_id: string; p_actor_id: string }) => {
    order.push('operation');
    if (persisted.operation && (args.p_tenant_id !== persisted.operation.tenant_id || args.p_actor_id !== persisted.operation.actor_id)) {
      return { data: null, error: { code: '42501', message: 'PRESCHOOL_ADMISSION_ACTOR_DENIED' } };
    }
    if (persisted.operation && args.p_payload && JSON.stringify(args.p_payload) !== JSON.stringify(persisted.operation.payload)) {
      return { data: null, error: { code: 'P0001', message: 'PRESCHOOL_ADMISSION_PAYLOAD_CONFLICT' } };
    }
    if (!persisted.operation && !args.p_payload) return { data: null, error: { code: 'P0002', message: 'PRESCHOOL_ADMISSION_OPERATION_NOT_FOUND' } };
    if (!persisted.operation) persisted.operation = { tenant_id: tenantId, actor_id: actorId, operation_key: operationKey, branch_id: branchId,
      payload: args.p_payload ?? {}, student_code: 'EDU-2026-1000000000000', enrollment_request_id: requestId };
    return { data: [persisted.operation], error: null };
  });
  const client = {
    rpc,
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query,
        maybeSingle: async () => ({ data: table === 'users' ? { id: actorId, role, status: 'active' }
          : { id: courseId, title: 'Canonical course', status }, error: null }),
      };
      return query;
    },
  } as unknown as SupabaseClient<Database>;
  const parties = { registerOrRecoverPerson: jest.fn(async (input: { registrationKey: string; person: { displayName: string } }) => {
    order.push('party');
    if (!persisted.identities.has(input.registrationKey)) persisted.identities.set(input.registrationKey,
      { partyId: input.registrationKey.endsWith('child') ? childId : guardianId, displayName: input.person.displayName });
    fail(input.registrationKey.endsWith('child') ? 'child' : 'guardian');
    return persisted.identities.get(input.registrationKey)!;
  }) };
  const students = {
    getStudent: jest.fn(async () => persisted.student),
    registerStudent: jest.fn(async () => {
      persisted.student = { tenantId, partyId: childId, studentCode: 'EDU-2026-1000000000000', academicStatus: 'active' };
      fail('student'); return persisted.student;
    }),
  };
  const recovery = { getEnrollmentByRequest: jest.fn(async () => { order.push('recover'); return persisted.enrollment; }) };
  const enrollments = {
    enrollStudent: jest.fn(async () => {
      order.push('enroll');
      persisted.enrollment = { tenantId, studentPartyId: childId, courseId, id: 'canonical-enrollment', status: 'active', enrolledAt: '2026-10-19T00:00:00Z' };
      fail('enrollment'); return persisted.enrollment;
    }),
    getEnrollment: jest.fn(async () => persisted.enrollment),
  };
  const chain = {
    preflightEnrollmentBranch: jest.fn(async () => { order.push('preflight'); if (!allowedBranch) throw new Error('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED');
      return { id: branchId, unitType: 'branch' as const, isActive: true, parentId: undefined }; }),
    assignEnrollmentToBranch: jest.fn(async () => {
      persisted.assignment = { tenantId, courseId, enrollmentId: 'canonical-enrollment', branchId, requestId, assignedBy: actorId };
      fail('assignment'); return persisted.assignment;
    }),
    getEnrollmentChain: jest.fn(async () => persisted.assignment),
  };
  const guardians = { establishForCanonicalGuardian: jest.fn(async () => { fail('authorization'); return {
    authorizationId: 'canonical-authorization', studentPartyId: childId, guardianPartyId: guardianId,
    displayName: 'Guardian', phone: '0989112334', status: 'authorized' as const, normalizedPhone: '0989112334',
  }; }) };
  const create = () => new PreschoolAdmissionService(client, { parties, students, recovery, enrollments, chain, guardians, courseReader:{readCourse:async()=>({id:courseId,title:'Canonical course',status})} });
  return { persisted, parties, students, recovery, enrollments, chain, rpc, order, create,
    setRole: (value: string) => { role = value; }, denyBranch: () => { allowedBranch = false; }, archiveCourse: () => { status = 'archived'; } };
}

describe('approved durable admission orchestration (unit evidence only)', () => {
  it('normalizes input and denies missing branch or invalid date before writes', async () => {
    expect(normalizeAdmissionPayload(payload).guardianPhone).toBe('0989112334');
    const h = harness();
    await expect(h.create().admit({ tenantId, actorId, operationKey, payload: { ...payload, branchId: '' } })).rejects.toThrow('INVALID_PAYLOAD');
    await expect(h.create().admit({ tenantId, actorId, operationKey, payload: { ...payload, dateOfBirth: '0000-06-15' } })).rejects.toThrow('INVALID_PAYLOAD');
    expect(h.rpc).not.toHaveBeenCalled(); expect(h.parties.registerOrRecoverPerson).not.toHaveBeenCalled();
  });

  it('preflights before initial intent/identity writes and reads canonical entities on completed replay', async () => {
    const h = harness();
    const first = await h.create().admit({ tenantId, actorId, operationKey, payload });
    const replay = await h.create().admit({ tenantId, actorId, operationKey });
    expect(replay).toEqual(first);
    expect(h.order.indexOf('preflight')).toBeLessThan(h.order.indexOf('party'));
    expect(h.persisted.identities.size).toBe(2);
    expect(h.students.registerStudent).toHaveBeenCalledTimes(1);
    expect(h.enrollments.enrollStudent).toHaveBeenCalledTimes(1);
    expect(h.recovery.getEnrollmentByRequest).toHaveBeenCalledWith({ tenantId, studentPartyId: childId, courseId, requestId });
    expect(h.order.indexOf('recover')).toBeLessThan(h.order.indexOf('enroll'));
  });

  it.each(['child', 'guardian', 'authorization', 'student', 'enrollment', 'assignment'])('recovers the same identities after controlled %s step failure', async (point) => {
    const h = harness(point);
    try { await h.create().admit({ tenantId, actorId, operationKey, payload }); }
    catch (error) { expect((error as Error).message).toContain('controlled-'); }
    const retry = await h.create().admit({ tenantId, actorId, operationKey });
    expect(retry.student.partyId).toBe(childId); expect(retry.student.guardianPartyId).toBe(guardianId);
    expect(retry.enrollment.id).toBe('canonical-enrollment'); expect(h.persisted.identities.size).toBe(2);
    expect(h.students.registerStudent).toHaveBeenCalledTimes(1);
    expect(h.enrollments.enrollStudent).toHaveBeenCalledTimes(1);
  });

  it('recovers an existing enrollment while current course is archived without rerunning the command', async () => {
    const h = harness(); await h.create().admit({ tenantId, actorId, operationKey, payload });
    h.archiveCourse(); await h.create().admit({ tenantId, actorId, operationKey });
    expect(h.enrollments.enrollStudent).toHaveBeenCalledTimes(1);
  });

  it('fails closed on recovery errors rather than treating them as absence', async () => {
    const h = harness(); h.recovery.getEnrollmentByRequest.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(h.create().admit({ tenantId, actorId, operationKey, payload })).rejects.toThrow('database unavailable');
    expect(h.enrollments.enrollStudent).not.toHaveBeenCalled();
  });

  it('rejects changed payload and revoked role/branch even on completed operations', async () => {
    const h = harness(); await h.create().admit({ tenantId, actorId, operationKey, payload });
    // The HTTP route recognizes the Product error type, not a Platform error's
    // incidental status field. Preserve the public conflict contract end to end.
    await expect(h.create().admit({ tenantId, actorId, operationKey, payload: { ...payload, childName: 'Another child' } })).rejects.toBeInstanceOf(PreschoolAdmissionError);
    await expect(h.create().admit({ tenantId, actorId, operationKey, payload: { ...payload, childName: 'Another child' } })).rejects.toMatchObject({ status: 409 });
    h.setRole('admin_staff');
    await expect(h.create().admit({ tenantId, actorId, operationKey })).rejects.toMatchObject({ status: 403 });
    h.setRole('admin'); h.denyBranch();
    await expect(h.create().admit({ tenantId, actorId, operationKey })).rejects.toThrow('BRANCH_ACCESS_DENIED');
    expect(h.enrollments.enrollStudent).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for key-only missing operation without allocating or guessing identity', async () => {
    const h = harness();
    await expect(h.create().admit({ tenantId, actorId, operationKey })).rejects.toBeInstanceOf(PreschoolAdmissionError);
    expect(h.persisted.operation).toBeNull(); expect(h.persisted.identities.size).toBe(0);
  });
});
