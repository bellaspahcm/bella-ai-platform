import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  type ITrustedActorOrgUnitAccessContract,
  type TrustedActorOrgUnitAccessRow,
} from '@/platform/org-unit/trusted-actor-access.contract';
import { TrustedActorOrgUnitAccessContractImpl } from '@/platform/org-unit/trusted-actor-access.contract.impl';
import { PreschoolChainError, PreschoolChainService } from './preschool-chain.service';

type ChainAccess = Pick<PreschoolChainService,
  'assertBranchAccess' | 'getEnrollmentChain' | 'assertEnrollmentAccess'>;

// The public Platform contract declares this server-only RPC separately from
// the main generated database snapshot. Preserve its declared input/row types.
/** Attendance preflight supplements, and never replaces, the action guard. */
export class PreschoolAttendanceAccessService {
  private readonly chain: ChainAccess;
  private readonly trustedActorAccess: ITrustedActorOrgUnitAccessContract;

  // Request-scoped memoization to eliminate hundreds of redundant round-trips
  // during batch classroom/student attendance reads.
  private readonly courseBranchCache = new Map<string, Promise<string>>();
  private readonly actorAccessCache = new Map<string, Promise<readonly TrustedActorOrgUnitAccessRow[]>>();
  private readonly branchAccessCache = new Map<string, Promise<void>>();

  public constructor(
    private readonly client: SupabaseClient<Database>,
    chain?: ChainAccess,
    trustedActorAccess?: ITrustedActorOrgUnitAccessContract,
  ) {
    this.chain = chain ?? new PreschoolChainService(client);
    this.trustedActorAccess = trustedActorAccess ?? new TrustedActorOrgUnitAccessContractImpl(client);
  }

  public async assertCourseAccess(tenantId: string, actorId: string, courseId: string): Promise<void> {
    await this.assertCourseBranch(tenantId, actorId, courseId);
  }

  public async assertEnrollmentAccess(
    tenantId: string,
    actorId: string,
    enrollmentId: string,
    expectedStudentId?: string,
    expectedCourseId?: string,
  ) {
    const assignment = await this.chain.getEnrollmentChain(tenantId, enrollmentId);
    if (!assignment) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_ENROLLMENT_ACCESS_DENIED', 403);
    }
    if (assignment.tenantId !== tenantId || assignment.enrollmentId !== enrollmentId
      || !assignment.courseId || !assignment.branchId
      || (expectedCourseId !== undefined && assignment.courseId !== expectedCourseId)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
    }

    const branchId = await this.assertCourseBranch(tenantId, actorId, assignment.courseId);
    if (branchId !== assignment.branchId) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
    }

    const enrollment = await this.chain.assertEnrollmentAccess(
      tenantId, actorId, enrollmentId, expectedStudentId, expectedCourseId,
    );
    if (enrollment.id !== enrollmentId || enrollment.tenantId !== tenantId
      || enrollment.courseId !== assignment.courseId
      || (expectedStudentId !== undefined && enrollment.studentPartyId !== expectedStudentId)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
    }
    return enrollment;
  }

  private async assertCourseBranch(tenantId: string, actorId: string, courseId: string): Promise<string> {
    if (!tenantId || !actorId || !courseId) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_COURSE_ACCESS_DENIED', 403);
    }
    const key = `${tenantId}:${actorId}:${courseId}`;
    let task = this.courseBranchCache.get(key);
    if (!task) {
      task = this.resolveCourseBranch(tenantId, actorId, courseId);
      this.courseBranchCache.set(key, task);
    }
    return task;
  }

  private async resolveCourseBranch(tenantId: string, actorId: string, courseId: string): Promise<string> {
    const { data, error } = await this.client
      .from('preschool_chain_course_branch_assignments')
      .select('tenant_id, course_id, branch_id')
      .eq('tenant_id', tenantId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (error) this.throwDatabaseError(error);
    if (!data) throw new PreschoolChainError('PRESCHOOL_CHAIN_COURSE_ACCESS_DENIED', 403);
    if (data.tenant_id !== tenantId || data.course_id !== courseId || !data.branch_id) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
    }

    // Branch access verification with per-instance caching
    const branchKey = `${tenantId}:${actorId}:${data.branch_id}`;
    let branchTask = this.branchAccessCache.get(branchKey);
    if (!branchTask) {
      branchTask = this.chain.assertBranchAccess(tenantId, actorId, data.branch_id);
      this.branchAccessCache.set(branchKey, branchTask);
    }
    await branchTask;

    // Trusted actor relationship verification with per-instance caching
    const accessKey = `${tenantId}:${actorId}`;
    let accessTask = this.actorAccessCache.get(accessKey);
    if (!accessTask) {
      accessTask = (async () => {
        try {
          return await this.trustedActorAccess.listForActor({ p_tenant_id: tenantId, p_actor_id: actorId });
        } catch (contractError) {
          if (contractError instanceof Error && contractError.message === 'TRUSTED_ACTOR_ACCESS_DENIED') {
            throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED', 403);
          }
          this.throwDatabaseError({ message: contractError instanceof Error ? contractError.message : 'Unknown access contract error' });
        }
      })();
      this.actorAccessCache.set(accessKey, accessTask);
    }
    const rows = await accessTask;
    if (rows.some((row) => row.tenant_id !== tenantId || row.user_id !== actorId)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED', 403);
    }
    const explicitlyAuthorized = rows.some((row) => row.org_unit_id === data.branch_id
      && typeof row.relationship_id === 'string' && row.relationship_id.length > 0
      && ['belongs_to', 'manages', 'participates_in'].includes(row.access_source));
    if (!explicitlyAuthorized) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED', 403);
    }
    return data.branch_id;
  }

  private throwDatabaseError(error: { code?: string; message: string }): never {
    if (error.code === '42501') {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED', 403);
    }
    throw new Error(`PRESCHOOL_ATTENDANCE_ACCESS_LOOKUP_FAILED: ${error.message}`);
  }
}
