import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  PreschoolStudentGuardianReadError,
  PreschoolStudentGuardianReadService,
  isPreschoolStudentGuardianReadPage,
} from '../services/preschool-student-guardian-read.service';

type RpcResult = { data: unknown; error: { code: string; message: string } | null };
const mockRead = jest.fn<(studentId: string) => Promise<RpcResult>>();
const studentId = '00000001-0000-4000-8000-000000000001';
const studentPartyId = '00000002-0000-4000-8000-000000000001';
const guardianId = '00000003-0000-4000-8000-000000000001';
const relationshipId = '00000004-0000-4000-8000-000000000001';

function page() {
  return {
    studentId,
    studentPartyId,
    asOfDate: '2026-10-24',
    complete: true,
    guardianCount: 1,
    guardians: [{
      guardianPartyId: guardianId,
      displayName: 'Guardian One',
      phone: '0900000001',
      phoneState: 'recorded',
      relationships: [{ id: relationshipId, type: 'guardian_of', activeFrom: '2026-01-01', activeTo: null }],
      pickupStatus: 'authorized',
    }],
  };
}

describe('Preschool Student guardian read service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRead.mockResolvedValue({ data: page(), error: null });
  });

  it('calls only the injected Student-scoped reader and returns the exact complete projection', async () => {
    const result = await new PreschoolStudentGuardianReadService(mockRead).read(studentId);
    expect(mockRead).toHaveBeenCalledWith(studentId);
    expect(result).toEqual(page());
    expect(result.guardians[0]).toMatchObject({
      guardianPartyId: guardianId,
      phoneState: 'recorded',
      pickupStatus: 'authorized',
    });
  });

  it('accepts a proven complete empty list and a missing phone without inventing values', async () => {
    const empty = { ...page(), guardianCount: 0, guardians: [] };
    mockRead.mockResolvedValueOnce({ data: empty, error: null });
    await expect(new PreschoolStudentGuardianReadService(mockRead).read(studentId)).resolves.toEqual(empty);

    const missing = {
      ...page(),
      guardians: [{ ...page().guardians[0], phone: null, phoneState: 'missing', pickupStatus: 'not_recorded' }],
    };
    expect(isPreschoolStudentGuardianReadPage(missing, studentId)).toBe(true);
  });

  it('rejects an invalid Student UUID before any provider call', async () => {
    await expect(new PreschoolStudentGuardianReadService(mockRead).read('EDU-2026-001'))
      .rejects.toEqual(new PreschoolStudentGuardianReadError('INVALID_STUDENT_ID', 400));
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('maps access denial without leaking provider details', async () => {
    mockRead.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'private RLS details' } });
    await expect(new PreschoolStudentGuardianReadService(mockRead).read(studentId))
      .rejects.toMatchObject({ code: 'STUDENT_GUARDIAN_ACCESS_DENIED', status: 403 });
  });

  it.each(['P0001', '55000', 'XX000'])('maps provider error %s to unavailable', async code => {
    mockRead.mockResolvedValueOnce({ data: null, error: { code, message: 'private provider details' } });
    await expect(new PreschoolStudentGuardianReadService(mockRead).read(studentId))
      .rejects.toMatchObject({ code: 'STUDENT_GUARDIANS_UNAVAILABLE', status: 503 });
  });

  it.each([
    ['incomplete', { ...page(), complete: false }],
    ['foreign-student', { ...page(), studentId: '00000001-0000-4000-8000-000000000099' }],
    ['count-mismatch', { ...page(), guardianCount: 2 }],
    ['bad-phone-state', { ...page(), guardians: [{ ...page().guardians[0], phone: null, phoneState: 'recorded' }] }],
    ['unknown-pickup', { ...page(), guardians: [{ ...page().guardians[0], pickupStatus: 'assumed' }] }],
    ['future-relationship', {
      ...page(),
      guardians: [{
        ...page().guardians[0],
        relationships: [{ ...page().guardians[0].relationships[0], activeFrom: '2026-10-25' }],
      }],
    }],
    ['expired-relationship', {
      ...page(),
      guardians: [{
        ...page().guardians[0],
        relationships: [{ ...page().guardians[0].relationships[0], activeTo: '2026-10-23' }],
      }],
    }],
    ['extra-field', { ...page(), medicalNote: 'must not escape' }],
  ])('fails closed for malformed %s payload', async (_label, malformed) => {
    mockRead.mockResolvedValueOnce({ data: malformed, error: null });
    await expect(new PreschoolStudentGuardianReadService(mockRead).read(studentId))
      .rejects.toMatchObject({ code: 'STUDENT_GUARDIANS_UNAVAILABLE', status: 503 });
  });

  it('rejects duplicate Guardian and relationship identities', () => {
    const duplicateGuardian = {
      ...page(),
      guardianCount: 2,
      guardians: [page().guardians[0], { ...page().guardians[0] }],
    };
    expect(isPreschoolStudentGuardianReadPage(duplicateGuardian, studentId)).toBe(false);
    const secondGuardian = {
      ...page(),
      guardianCount: 2,
      guardians: [
        page().guardians[0],
        { ...page().guardians[0], guardianPartyId: '00000003-0000-4000-8000-000000000002' },
      ],
    };
    expect(isPreschoolStudentGuardianReadPage(secondGuardian, studentId)).toBe(false);
  });
});


it('normalizes valid UUID selectors and detects case-variant duplicate Guardian identities', async () => {
  const mixedId = 'abcdef01-0000-4000-8000-000000000001';
  mockRead.mockResolvedValueOnce({ data: { ...page(), studentId: mixedId }, error: null });
  await expect(new PreschoolStudentGuardianReadService(mockRead).read(mixedId.toUpperCase()))
    .resolves.toMatchObject({ studentId: mixedId });
  expect(mockRead).toHaveBeenLastCalledWith(mixedId);
  const mixedGuardian = 'abcdef03-0000-4000-8000-000000000001';
  expect(isPreschoolStudentGuardianReadPage({
    ...page(), guardianCount: 2,
    guardians: [
      { ...page().guardians[0], guardianPartyId: mixedGuardian },
      { ...page().guardians[0], guardianPartyId: mixedGuardian.toUpperCase(),
        relationships: [{ ...page().guardians[0].relationships[0], id: 'abcdef04-0000-4000-8000-000000000002' }] },
    ],
  }, studentId)).toBe(false);
});
