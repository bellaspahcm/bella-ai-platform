import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { EducationAttendanceDTO, IEducationAttendanceContract } from '@/platform/education/contracts/attendance.contract';
import {
  PreschoolRegistryError,
  type IPreschoolRegistryContract,
  type PreschoolRegistryPage,
  type PreschoolRegistryStudent,
} from '@/platform/education/contracts/preschool-registry.contract';

const mockRegistryRead = jest.fn<IPreschoolRegistryContract['read']>();
const mockHistory = jest.fn<IEducationAttendanceContract['getAttendanceHistory']>();
jest.mock('@/platform/education/contracts/preschool-registry.contract.impl', () => ({
  PreschoolRegistryContractImpl: jest.fn().mockImplementation(() => ({ read: mockRegistryRead })),
}));
jest.mock('@/platform/education/contracts/attendance.contract.impl', () => ({
  AttendanceContractImpl: jest.fn().mockImplementation(() => ({ getAttendanceHistory: mockHistory })),
}));

const { loadStudent360Profile } = require('../student-360.service') as typeof import('../student-360.service');
const { PreschoolRegistryContractImpl } = require('@/platform/education/contracts/preschool-registry.contract.impl') as typeof import('@/platform/education/contracts/preschool-registry.contract.impl');
const { AttendanceContractImpl } = require('@/platform/education/contracts/attendance.contract.impl') as typeof import('@/platform/education/contracts/attendance.contract.impl');
const tenantId = 'ed100000-0000-0000-0000-000000000001';
const callerClient = Object.freeze({ callerScoped: true }) as unknown as SupabaseClient<Database>;
const uuid = (group: number, index: number) => `${group.toString(16).padStart(8, '0')}-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
function student(index = 1): PreschoolRegistryStudent {
  return {
    id: uuid(1, index), tenantId, partyId: uuid(2, index), studentCode: `EDU-2026-${String(index).padStart(6, '0')}`,
    name: `Canonical child ${index}`, dob: '2022-02-23', gender: 'male',
    enrollments: [{ id: uuid(3, index), courseId: uuid(4, index), courseCode: `CLASS-${index}`,
      courseTitle: `Canonical class ${index}`, branchId: uuid(5, 1), branchName: 'Authorized branch', status: 'active' }],
  };
}
function page(students: PreschoolRegistryStudent[], offset = 0, total = students.length): PreschoolRegistryPage {
  return {
    tenantId, request: { query: '', status: 'all', courseId: null, branchId: null, offset, limit: 50 },
    totals: { students: total, active: total, pending: 0 }, filteredTotal: total,
    nextOffset: offset + students.length < total ? offset + students.length : null, students,
  };
}
function event(index: number, status: EducationAttendanceDTO['status']): EducationAttendanceDTO {
  return { id: uuid(6, index), tenantId, enrollmentId: student().enrollments[0].id,
    status, rollCallTime: `2026-10-24T0${index}:00:00.000Z` };
}

describe('Student 360 caller-authorized public contract composition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegistryRead.mockReset().mockResolvedValue(page([student()]));
    mockHistory.mockReset().mockResolvedValue([]);
  });

  it.each([student().studentCode, student().id, student().partyId, student().enrollments[0].id])(
    'matches exactly the authorized student identifier %s', async identifier => {
      const profile = await loadStudent360Profile(callerClient, tenantId, identifier);
      expect(profile).toMatchObject({ id: student().studentCode, studentId: student().id,
        partyId: student().partyId, name: student().name, dob: student().dob, gender: student().gender,
        enrollments: student().enrollments, attendance: { present: 0, absent: 0, excused: 0, totalRecords: 0, records: [] } });
      expect(PreschoolRegistryContractImpl).toHaveBeenCalledWith(callerClient);
      expect(AttendanceContractImpl).toHaveBeenCalledWith(callerClient);
      expect(mockHistory).toHaveBeenCalledWith(tenantId, student().enrollments[0].id);
      expect(Object.keys(profile ?? {}).sort()).toEqual(['attendance', 'dob', 'enrollments', 'gender', 'id', 'name', 'partyId', 'studentId']);
    },
  );

  it.each(['EDU-2026', '%', 'EDU-2026-00000_', 'edu-2026-000001', 'another-child'])('does not resolve partial or foreign identifier %s', async identifier => {
    expect(await loadStudent360Profile(callerClient, tenantId, identifier)).toBeNull();
    expect(mockHistory).not.toHaveBeenCalled();
  });

  it.each(['STU-001', 'HS-2026-001'])('resolves alias %s to canonical student code HS0001', async alias => {
    const s = { ...student(), studentCode: 'HS0001' };
    mockRegistryRead.mockResolvedValueOnce(page([s]));
    const profile = await loadStudent360Profile(callerClient, tenantId, alias);
    expect(profile?.id).toBe('HS0001');
    expect(profile?.studentId).toBe(s.id);
  });

  it('returns not found only after a complete authorized empty registry', async () => {
    mockRegistryRead.mockResolvedValueOnce(page([]));
    expect(await loadStudent360Profile(callerClient, tenantId, student().id)).toBeNull();
    expect(AttendanceContractImpl).not.toHaveBeenCalled();
  });

  it('preserves canonical null identity fields and pending enrollment', async () => {
    const pending = { ...student(), dob: null, gender: null,
      enrollments: [{ ...student().enrollments[0], status: 'pending' as const }] };
    mockRegistryRead.mockResolvedValueOnce({ ...page([pending]), totals: { students: 1, active: 0, pending: 1 } });
    const profile = await loadStudent360Profile(callerClient, tenantId, pending.studentCode);
    expect(profile).toMatchObject({ dob: null, gender: null, enrollments: pending.enrollments });
  });

  it('finds a student beyond the first page with validated pagination', async () => {
    const students = Array.from({ length: 51 }, (_, index) => student(index + 1));
    mockRegistryRead.mockResolvedValueOnce(page(students.slice(0, 50), 0, 51))
      .mockResolvedValueOnce(page(students.slice(50), 50, 51));
    const profile = await loadStudent360Profile(callerClient, tenantId, students[50].studentCode);
    expect(profile?.studentId).toBe(students[50].id);
    expect(mockRegistryRead).toHaveBeenNthCalledWith(2, tenantId, { status: 'all', offset: 50, limit: 50 });
    expect(mockHistory).toHaveBeenCalledTimes(1);
  });

  it.each(['tenant', 'extra-field', 'invalid-status', 'next-offset', 'null-page'])('rejects malformed registry payload: %s', async fault => {
    const invalid: unknown = fault === 'tenant' ? { ...page([student()]), tenantId: uuid(9, 1) }
      : fault === 'extra-field' ? { ...page([student()]), medicalNote: 'must not escape' }
      : fault === 'invalid-status' ? page([{ ...student(), enrollments: [{ ...student().enrollments[0], status: 'cancelled' as 'active' }] }])
      : fault === 'next-offset' ? { ...page([student()]), nextOffset: 0 }
      : null;
    mockRegistryRead.mockResolvedValueOnce(invalid as PreschoolRegistryPage);
    await expect(loadStudent360Profile(callerClient, tenantId, student().studentCode)).rejects.toMatchObject({ status: 503 });
    expect(mockHistory).not.toHaveBeenCalled();
  });

  it('rejects repeated identities across pages even when the target already matched', async () => {
    const students = Array.from({ length: 50 }, (_, index) => student(index + 1));
    mockRegistryRead.mockResolvedValueOnce(page(students, 0, 51)).mockResolvedValueOnce(page([student()], 50, 51));
    await expect(loadStudent360Profile(callerClient, tenantId, student().studentCode)).rejects.toMatchObject({ status: 503 });
    expect(mockHistory).not.toHaveBeenCalled();
  });

  it('rejects changing registry totals instead of accepting partial pagination', async () => {
    const students = Array.from({ length: 52 }, (_, index) => student(index + 1));
    mockRegistryRead.mockResolvedValueOnce(page(students.slice(0, 50), 0, 51))
      .mockResolvedValueOnce(page(students.slice(50), 50, 52));
    await expect(loadStudent360Profile(callerClient, tenantId, student().studentCode)).rejects.toMatchObject({ status: 503 });
  });

  it('fails unavailable at the page bound instead of returning a partial match or not found', async () => {
    mockRegistryRead.mockImplementation(async (_tenant, query) => {
      const offset = query?.offset ?? 0;
      return page(Array.from({ length: 50 }, (_, index) => student(offset + index + 1)), offset, 5001);
    });
    await expect(loadStudent360Profile(callerClient, tenantId, student().studentCode)).rejects.toMatchObject({ status: 503 });
    expect(mockRegistryRead).toHaveBeenCalledTimes(100);
    expect(mockHistory).not.toHaveBeenCalled();
  });

  it('propagates branch denial and provider failure instead of inventing not found', async () => {
    const denied = new PreschoolRegistryError('REGISTRY_ACCESS_DENIED', 403);
    mockRegistryRead.mockRejectedValueOnce(denied);
    await expect(loadStudent360Profile(callerClient, tenantId, student().studentCode)).rejects.toBe(denied);
    const failure = new Error('provider failed');
    mockRegistryRead.mockRejectedValueOnce(failure);
    await expect(loadStudent360Profile(callerClient, tenantId, student().studentCode)).rejects.toBe(failure);
  });

  it('counts raw present/absent/excused events separately, without inventing days or percentages', async () => {
    const events = [event(1, 'present'), event(2, 'absent'), event(3, 'excused')];
    mockHistory.mockResolvedValueOnce(events);
    const profile = await loadStudent360Profile(callerClient, tenantId, student().studentCode);
    expect(profile?.attendance).toMatchObject({ present: 1, absent: 1, excused: 1, totalRecords: 3 });
    expect(profile?.attendance.records.map(record => record.id)).toEqual(events.map(record => record.id).reverse());
    expect(profile?.attendance).not.toHaveProperty('rate');
    expect(profile?.attendance).not.toHaveProperty('days');
  });

  it('reads history only for enrollments included in the authorized registry result', async () => {
    const second = student(2).enrollments[0];
    const enrolled = { ...student(), enrollments: [...student().enrollments, second] };
    mockRegistryRead.mockResolvedValueOnce(page([enrolled]));
    await loadStudent360Profile(callerClient, tenantId, student().studentCode);
    expect(mockHistory.mock.calls).toEqual([[tenantId, enrolled.enrollments[0].id], [tenantId, second.id]]);
  });

  it.each(['foreign-tenant', 'foreign-enrollment', 'unknown-status', 'invalid-time', 'non-array', 'duplicate-id'])('rejects invalid attendance: %s', async fault => {
    const valid = event(1, 'present');
    const invalid: unknown = fault === 'foreign-tenant' ? [{ ...valid, tenantId: uuid(9, 1) }]
      : fault === 'foreign-enrollment' ? [{ ...valid, enrollmentId: uuid(3, 99) }]
      : fault === 'unknown-status' ? [{ ...valid, status: 'late' }]
      : fault === 'invalid-time' ? [{ ...valid, rollCallTime: 'not-a-date' }]
      : fault === 'duplicate-id' ? [valid, valid]
      : null;
    mockHistory.mockResolvedValueOnce(invalid as readonly EducationAttendanceDTO[]);
    await expect(loadStudent360Profile(callerClient, tenantId, student().studentCode)).rejects.toMatchObject({ status: 503 });
  });

  it('does not turn a failed attendance read into zero attendance', async () => {
    const failure = new Error('attendance unavailable');
    mockHistory.mockRejectedValueOnce(failure);
    await expect(loadStudent360Profile(callerClient, tenantId, student().studentCode)).rejects.toBe(failure);
  });

  it('fails closed when attendance history reaches the provider row cap', async () => {
    mockHistory.mockResolvedValueOnce(Array.from({ length: 1000 }, (_, index) => ({
      id: uuid(6, index + 1),
      tenantId,
      enrollmentId: student().enrollments[0].id,
      status: 'present' as const,
      rollCallTime: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
    })));
    await expect(loadStudent360Profile(callerClient, tenantId, student().studentCode))
      .rejects.toMatchObject({ status: 503, code: 'STUDENT_PROFILE_UNAVAILABLE' });
  });

  it.each(['', ' ', 'x'.repeat(81), 'invalid\u0001'])('rejects invalid identifiers before contract reads', async identifier => {
    await expect(loadStudent360Profile(callerClient, tenantId, identifier)).rejects.toMatchObject({ status: 400 });
    expect(mockRegistryRead).not.toHaveBeenCalled();
  });
});
