import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { EducationEnrollmentDTO } from '@/platform/education/contracts/enrollment.contract';
import {
  TRUSTED_ACTOR_ORG_UNIT_ACCESS_RPC,
  type TrustedActorOrgUnitAccessRow,
} from '@/platform/org-unit/trusted-actor-access.contract';
import { PreschoolChainError, type PreschoolChainAssignmentDTO } from '../services/preschool-chain.service';
import { PreschoolAttendanceAccessService } from '../services/preschool-attendance-access.service';

type ChainAccess = NonNullable<ConstructorParameters<typeof PreschoolAttendanceAccessService>[1]>;
type CourseAssignment = Pick<Database['public']['Tables']['preschool_chain_course_branch_assignments']['Row'],
  'tenant_id' | 'course_id' | 'branch_id'>;
type DbError = { code: string; message: string };

const tenantId = 'tenant-a';
const actorId = 'admin-a';
const courseId = 'course-a';
const branchId = 'branch-a';
const enrollmentId = 'enrollment-a';
const studentId = 'student-a';

function setup() {
  const assignment: CourseAssignment = { tenant_id: tenantId, course_id: courseId, branch_id: branchId };
  const chainAssignment: PreschoolChainAssignmentDTO = {
    tenantId, courseId, branchId, enrollmentId, requestId: 'request-a', assignedBy: actorId,
  };
  const canonicalEnrollment: EducationEnrollmentDTO = {
    id: enrollmentId, tenantId, studentPartyId: studentId, courseId,
    status: 'active', enrolledAt: '2026-10-23T00:00:00Z',
  };
  const explicitAccess: TrustedActorOrgUnitAccessRow = {
    user_id: actorId, tenant_id: tenantId, org_unit_id: branchId,
    root_org_unit_id: 'region-a', relationship_id: 'relationship-a', access_source: 'manages',
  };
  const queryResult: { data: CourseAssignment | null; error: DbError | null } = {
    data: assignment, error: null,
  };
  const accessResult: { data: TrustedActorOrgUnitAccessRow[] | null; error: DbError | null } = {
    data: [explicitAccess], error: null,
  };
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async () => queryResult),
  };
  const client = {
    from: jest.fn(() => query),
    rpc: jest.fn(async () => accessResult),
  };
  const chain: jest.Mocked<ChainAccess> = {
    assertBranchAccess: jest.fn<ReturnType<ChainAccess['assertBranchAccess']>, Parameters<ChainAccess['assertBranchAccess']>>()
      .mockResolvedValue(undefined),
    getEnrollmentChain: jest.fn<ReturnType<ChainAccess['getEnrollmentChain']>, Parameters<ChainAccess['getEnrollmentChain']>>()
      .mockResolvedValue(chainAssignment),
    assertEnrollmentAccess: jest.fn<ReturnType<ChainAccess['assertEnrollmentAccess']>, Parameters<ChainAccess['assertEnrollmentAccess']>>()
      .mockResolvedValue(canonicalEnrollment),
  };
  const service = new PreschoolAttendanceAccessService(client as unknown as SupabaseClient<Database>, chain);
  return { service, client, query, queryResult, accessResult, explicitAccess, chain, chainAssignment, canonicalEnrollment };
}

describe('Preschool Attendance current relationship branch preflight', () => {
  it.each(['belongs_to', 'manages', 'participates_in'] as const)(
    'accepts an active canonical assigned branch through explicit %s access', async (accessSource) => {
      const fixture = setup();
      fixture.accessResult.data = [{ ...fixture.explicitAccess, access_source: accessSource }];
      await expect(fixture.service.assertCourseAccess(tenantId, actorId, courseId)).resolves.toBeUndefined();
      expect(fixture.client.from).toHaveBeenCalledWith('preschool_chain_course_branch_assignments');
      expect(fixture.query.eq.mock.calls).toEqual([['tenant_id', tenantId], ['course_id', courseId]]);
      expect(fixture.chain.assertBranchAccess).toHaveBeenCalledWith(tenantId, actorId, branchId);
      expect(fixture.client.rpc).toHaveBeenCalledWith(TRUSTED_ACTOR_ORG_UNIT_ACCESS_RPC, {
        p_tenant_id: tenantId, p_actor_id: actorId,
      });
    },
  );

  it('denies tenant_admin-only access even when Chain permits an admin at tenant scope', async () => {
    const fixture = setup();
    fixture.accessResult.data = [{ ...fixture.explicitAccess, access_source: 'tenant_admin', relationship_id: null }];
    await expect(fixture.service.assertCourseAccess(tenantId, actorId, courseId))
      .rejects.toMatchObject({ code: 'PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED', status: 403 });
    expect(fixture.chain.assertEnrollmentAccess).not.toHaveBeenCalled();
  });

  it.each(['missing-relationship', 'other-branch', 'revoked'])(
    'denies %s rather than inferring access from a single assignment', async (state) => {
      const fixture = setup();
      fixture.accessResult.data = state === 'revoked' ? [] : [{
        ...fixture.explicitAccess,
        relationship_id: state === 'missing-relationship' ? null : 'relationship-a',
        org_unit_id: state === 'other-branch' ? 'branch-b' : branchId,
      }];
      await expect(fixture.service.assertCourseAccess(tenantId, actorId, courseId))
        .rejects.toMatchObject({ status: 403 });
    },
  );

  it.each(['tenant_id', 'user_id'] as const)('rejects a Platform row with mismatched %s', async (field) => {
    const fixture = setup();
    fixture.accessResult.data = [fixture.explicitAccess, { ...fixture.explicitAccess, [field]: 'foreign-id' }];
    await expect(fixture.service.assertCourseAccess(tenantId, actorId, courseId)).rejects.toMatchObject({ status: 403 });
  });

  it.each(['missing', 'inactive'])(
    'retains the OrgUnit public contract rejection for a %s branch before any Platform lookup', async () => {
      const fixture = setup();
      fixture.chain.assertBranchAccess.mockRejectedValue(new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_NOT_ACTIVE_IN_TENANT', 400));
      await expect(fixture.service.assertCourseAccess(tenantId, actorId, courseId))
        .rejects.toMatchObject({ code: 'PRESCHOOL_CHAIN_BRANCH_NOT_ACTIVE_IN_TENANT', status: 400 });
      expect(fixture.client.rpc).not.toHaveBeenCalled();
    },
  );

  it('does not let a branch relationship bypass the existing action-role ceiling', async () => {
    const fixture = setup();
    fixture.chain.assertBranchAccess.mockRejectedValue(new PreschoolChainError('PRESCHOOL_CHAIN_ACTOR_DENIED', 403));
    await expect(fixture.service.assertCourseAccess(tenantId, actorId, courseId)).rejects.toMatchObject({ status: 403 });
    expect(fixture.client.rpc).not.toHaveBeenCalled();
  });

  it('denies an absent course assignment and does not choose a branch', async () => {
    const fixture = setup();
    fixture.queryResult.data = null;
    await expect(fixture.service.assertCourseAccess(tenantId, actorId, courseId)).rejects.toMatchObject({ status: 403 });
    expect(fixture.chain.assertBranchAccess).not.toHaveBeenCalled();
    expect(fixture.client.rpc).not.toHaveBeenCalled();
  });

  it.each(['tenant_id', 'course_id'] as const)('rejects inconsistent course assignment %s', async (field) => {
    const fixture = setup();
    fixture.queryResult.data = { tenant_id: tenantId, course_id: courseId, branch_id: branchId, [field]: 'foreign-id' };
    await expect(fixture.service.assertCourseAccess(tenantId, actorId, courseId))
      .rejects.toMatchObject({ code: 'PRESCHOOL_CHAIN_CANONICAL_CONFLICT', status: 409 });
    expect(fixture.client.rpc).not.toHaveBeenCalled();
  });

  it.each(['assignment', 'platform'])(
    'maps %s SQL42501 to denial without canonical data access or mutation', async (source) => {
      const fixture = setup();
      const result = source === 'assignment' ? fixture.queryResult : fixture.accessResult;
      result.error = { code: '42501', message: 'permission denied' };
      await expect(fixture.service.assertCourseAccess(tenantId, actorId, courseId)).rejects.toMatchObject({ status: 403 });
      expect(fixture.chain.assertEnrollmentAccess).not.toHaveBeenCalled();
    },
  );

  it.each(['assignment', 'platform'])(
    'preserves a %s database failure instead of treating it as missing access', async (source) => {
      const fixture = setup();
      const result = source === 'assignment' ? fixture.queryResult : fixture.accessResult;
      result.error = { code: 'XX001', message: 'controlled storage failure' };
      await expect(fixture.service.assertCourseAccess(tenantId, actorId, courseId))
        .rejects.toThrow('PRESCHOOL_ATTENDANCE_ACCESS_LOOKUP_FAILED: controlled storage failure');
      expect(fixture.chain.assertEnrollmentAccess).not.toHaveBeenCalled();
    },
  );

  it('reconciles enrollment, student and course through the existing canonical public boundary', async () => {
    const fixture = setup();
    await expect(fixture.service.assertEnrollmentAccess(tenantId, actorId, enrollmentId, studentId, courseId))
      .resolves.toEqual(fixture.canonicalEnrollment);
    expect(fixture.chain.getEnrollmentChain).toHaveBeenCalledWith(tenantId, enrollmentId);
    expect(fixture.chain.assertEnrollmentAccess).toHaveBeenCalledWith(tenantId, actorId, enrollmentId, studentId, courseId);
  });

  it('denies a missing enrollment mapping before reading a course or canonical enrollment', async () => {
    const fixture = setup();
    fixture.chain.getEnrollmentChain.mockResolvedValue(null);
    await expect(fixture.service.assertEnrollmentAccess(tenantId, actorId, enrollmentId)).rejects.toMatchObject({ status: 403 });
    expect(fixture.client.from).not.toHaveBeenCalled();
    expect(fixture.chain.assertEnrollmentAccess).not.toHaveBeenCalled();
  });

  it.each(['tenantId', 'enrollmentId', 'courseId'] as const)(
    'rejects enrollment mapping mismatch in %s before canonical lookup', async (field) => {
      const fixture = setup();
      fixture.chain.getEnrollmentChain.mockResolvedValue({ ...fixture.chainAssignment, [field]: 'foreign-id' });
      await expect(fixture.service.assertEnrollmentAccess(tenantId, actorId, enrollmentId, studentId, courseId))
        .rejects.toMatchObject({ code: 'PRESCHOOL_CHAIN_CANONICAL_CONFLICT', status: 409 });
      expect(fixture.client.from).not.toHaveBeenCalled();
      expect(fixture.chain.assertEnrollmentAccess).not.toHaveBeenCalled();
    },
  );

  it('rejects a course/enrollment branch conflict before canonical enrollment access', async () => {
    const fixture = setup();
    fixture.chain.getEnrollmentChain.mockResolvedValue({ ...fixture.chainAssignment, branchId: 'branch-b' });
    await expect(fixture.service.assertEnrollmentAccess(tenantId, actorId, enrollmentId))
      .rejects.toMatchObject({ code: 'PRESCHOOL_CHAIN_CANONICAL_CONFLICT', status: 409 });
    expect(fixture.chain.assertEnrollmentAccess).not.toHaveBeenCalled();
  });

  it('keeps expected-student conflict from canonical reconciliation as a conflict', async () => {
    const fixture = setup();
    fixture.chain.assertEnrollmentAccess.mockRejectedValue(new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT'));
    await expect(fixture.service.assertEnrollmentAccess(tenantId, actorId, enrollmentId, 'wrong-student', courseId))
      .rejects.toMatchObject({ code: 'PRESCHOOL_CHAIN_CANONICAL_CONFLICT', status: 409 });
    expect(fixture.chain.assertEnrollmentAccess).toHaveBeenCalledWith(tenantId, actorId, enrollmentId, 'wrong-student', courseId);
  });

  it.each(['id', 'tenantId', 'courseId', 'studentPartyId'] as const)(
    'does not return a canonical result whose %s differs from the expected context', async (field) => {
      const fixture = setup();
      fixture.chain.assertEnrollmentAccess.mockResolvedValue({ ...fixture.canonicalEnrollment, [field]: 'foreign-id' });
      await expect(fixture.service.assertEnrollmentAccess(tenantId, actorId, enrollmentId, studentId, courseId))
        .rejects.toMatchObject({ code: 'PRESCHOOL_CHAIN_CANONICAL_CONFLICT', status: 409 });
    },
  );

  it('does not silently omit a provided empty expected-student binding', async () => {
    const fixture = setup();
    await expect(fixture.service.assertEnrollmentAccess(tenantId, actorId, enrollmentId, '', courseId))
      .rejects.toMatchObject({ code: 'PRESCHOOL_CHAIN_CANONICAL_CONFLICT', status: 409 });
  });

  it('propagates enrollment assignment read failure instead of falling through to course access', async () => {
    const fixture = setup();
    fixture.chain.getEnrollmentChain.mockRejectedValue(new Error('PRESCHOOL_CHAIN_READBACK_FAILED: controlled failure'));
    await expect(fixture.service.assertEnrollmentAccess(tenantId, actorId, enrollmentId)).rejects.toThrow('controlled failure');
    expect(fixture.client.from).not.toHaveBeenCalled();
    expect(fixture.chain.assertEnrollmentAccess).not.toHaveBeenCalled();
  });
});
