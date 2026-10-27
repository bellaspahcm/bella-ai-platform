import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { IEducationPreschoolOperationsContract } from '@/platform/education/contracts/preschool-operations.contract';
import { EducationPreschoolOperationError } from '@/platform/education/contracts/preschool-operations.contract';
import { EducationPreschoolOperationsContractImpl } from '@/platform/education/contracts/preschool-operations.contract.impl';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import { EnrollmentRecoveryContractImpl } from '@/platform/education/contracts/enrollment-recovery.contract.impl';
import type { IOrgUnitContract, OrgUnit } from '@/platform/org-unit';
import type { ITrustedActorOrgUnitAccessContract, TrustedActorOrgUnitAccessRow } from '@/platform/org-unit/trusted-actor-access.contract';
import { TrustedActorOrgUnitAccessContractImpl } from '@/platform/org-unit/trusted-actor-access.contract.impl';
import {
  CURRENT_ACTOR_ORG_UNIT_ACCESS_RPC,
  type CurrentActorOrgUnitAccessRow,
  type PlatformActorDatabase,
} from '@/platform/security/current-actor.contract';

type PreschoolChainClient = SupabaseClient<Database>;
type OrgRelationshipRow = Pick<
  Database['public']['Tables']['org_relationships']['Row'],
  'to_id' | 'rel_type' | 'since' | 'until'
>;
type OrgUnitScope = Pick<OrgUnit, 'id' | 'unitType' | 'isActive' | 'parentId'>;
type OrgUnitContractScope = Pick<IOrgUnitContract, 'getOrgUnit' | 'getOrgUnits'>
  & Partial<Pick<IOrgUnitContract, 'createOrgUnit'>>;

function getDefaultOrgUnitContract(): OrgUnitContractScope {
  const platform = require('@/platform/org-unit') as { orgUnitEngine: OrgUnitContractScope };
  return platform.orgUnitEngine;
}

export interface AssignPreschoolChainInput {
  readonly tenantId: string;
  readonly courseId: string;
  readonly enrollmentId: string;
  readonly branchId: string;
  readonly actorUserId: string;
  readonly requestId: string;
}

type PreschoolChainPreflightInput = Pick<AssignPreschoolChainInput, 'tenantId' | 'courseId' | 'branchId' | 'actorUserId'>;

export interface PreschoolChainAssignmentDTO {
  readonly tenantId: string;
  readonly courseId: string;
  readonly enrollmentId: string;
  readonly branchId: string;
  readonly requestId: string;
  readonly assignedBy: string | null;
}

export interface PreschoolBranchOption {
  readonly id: string;
  readonly name: string;
  readonly code?: string;
}

export interface CreatePreschoolBranchInput {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly name: string;
  readonly code?: string;
}

export class PreschoolChainError extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code); this.name = 'PreschoolChainError'; }
}

export class PreschoolChainService {
  private readonly operations: IEducationPreschoolOperationsContract;
  private readonly trustedActorAccess: ITrustedActorOrgUnitAccessContract;

  public constructor(
    private readonly client: PreschoolChainClient,
    private readonly orgUnits: OrgUnitContractScope = getDefaultOrgUnitContract(),
    operations?: IEducationPreschoolOperationsContract,
    trustedActorAccess?: ITrustedActorOrgUnitAccessContract,
  ) {
    this.operations = operations ?? new EducationPreschoolOperationsContractImpl(client);
    this.trustedActorAccess = trustedActorAccess ?? new TrustedActorOrgUnitAccessContractImpl(client);
  }

  public async listAccessibleBranches(
    tenantId: string,
    actorUserId: string,
  ): Promise<PreschoolBranchOption[]> {
    if (!tenantId) throw new Error('PRESCHOOL_CHAIN_TENANT_REQUIRED');
    if (!actorUserId) throw new Error('PRESCHOOL_CHAIN_ACTOR_REQUIRED');

    await this.getActiveRole(tenantId, actorUserId);
    const [branches, accessRows] = await Promise.all([this.orgUnits.getOrgUnits({
      tenantId,
      unitType: 'branch',
      isActive: true,
    }), this.listTrustedActorAccess(tenantId, actorUserId)]);

    const explicitlyAccessibleBranchIds = new Set(accessRows
      .filter((row) => typeof row.relationship_id === 'string' && row.relationship_id.length > 0
        && ['belongs_to', 'manages', 'participates_in'].includes(row.access_source))
      .map((row) => row.org_unit_id));
    return this.toBranchOptions(branches.filter((branch) => explicitlyAccessibleBranchIds.has(branch.id)));
  }

  public async listManagedBranches(
    tenantId: string,
    actorUserId: string,
  ): Promise<PreschoolBranchOption[]> {
    if (!tenantId) throw new Error('PRESCHOOL_CHAIN_TENANT_REQUIRED');
    if (!actorUserId) throw new Error('PRESCHOOL_CHAIN_ACTOR_REQUIRED');
    if (await this.getActiveRole(tenantId, actorUserId) !== 'admin') {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_MANAGEMENT_DENIED', 403);
    }

    const [branches, accessRows] = await Promise.all([this.orgUnits.getOrgUnits({
      tenantId,
      unitType: 'branch',
      isActive: true,
    }), this.listCurrentActorOrgUnitAccess(tenantId, actorUserId)]);
    const tenantAdminBranchIds = new Set(accessRows
      .filter((row) => row.access_source === 'tenant_admin' && row.relationship_id === null)
      .map((row) => row.org_unit_id));
    return this.toBranchOptions(branches.filter((branch) => tenantAdminBranchIds.has(branch.id)));
  }

  public async createBranch(input: CreatePreschoolBranchInput): Promise<PreschoolBranchOption> {
    if (!input.tenantId) throw new Error('PRESCHOOL_CHAIN_TENANT_REQUIRED');
    if (!input.actorUserId) throw new Error('PRESCHOOL_CHAIN_ACTOR_REQUIRED');
    if (!input.name.trim()) throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_NAME_REQUIRED', 400);
    if (await this.getActiveRole(input.tenantId, input.actorUserId) !== 'admin') {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_MANAGEMENT_DENIED', 403);
    }
    if (!this.orgUnits.createOrgUnit) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_WRITER_UNAVAILABLE', 503);
    }

    try {
      const code = input.code?.trim();
      const branch = await this.orgUnits.createOrgUnit({
        tenantId: input.tenantId,
        unitType: 'branch',
        name: input.name.trim(),
        ...(code ? { code } : {}),
      });
      if (branch.tenantId !== input.tenantId || branch.unitType !== 'branch' || !branch.isActive) {
        throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_CREATE_UNAVAILABLE', 503);
      }
      return { id: branch.id, name: branch.name, code: branch.code };
    } catch (error) {
      if (error instanceof PreschoolChainError) throw error;
      if (this.hasErrorCode(error, 'ORG_UNIT_CODE_CONFLICT')) {
        throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_CODE_CONFLICT', 409);
      }
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('23505') || message.includes('duplicate key')) {
        throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_CODE_CONFLICT', 409);
      }
      if (message.includes('42501') || message.includes('row-level security')) {
        throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_MANAGEMENT_DENIED', 403);
      }
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_CREATE_UNAVAILABLE', 503);
    }
  }

  public async preflightEnrollmentBranch(input: PreschoolChainPreflightInput): Promise<OrgUnitScope> {
    if (!input.tenantId) throw new Error('PRESCHOOL_CHAIN_TENANT_REQUIRED');
    if (!input.courseId) throw new Error('PRESCHOOL_CHAIN_COURSE_REQUIRED');
    if (!input.branchId) throw new Error('PRESCHOOL_CHAIN_BRANCH_REQUIRED');
    if (!input.actorUserId) throw new Error('PRESCHOOL_CHAIN_ACTOR_REQUIRED');

    const role = await this.getActiveRole(input.tenantId, input.actorUserId);
    if (!['admin', 'super_admin'].includes(role)) throw new PreschoolChainError('PRESCHOOL_ADMISSION_ACTOR_DENIED', 403);
    const branch = await this.getBranchOrThrow(input.tenantId, input.branchId);
    await this.assertUserCanAccessBranch(input.tenantId, input.actorUserId, branch.id);
    await this.assertNoConflictingCourseBranch(input.tenantId, input.courseId, branch.id);
    return branch;
  }

  public async assignEnrollmentToBranch(input: AssignPreschoolChainInput): Promise<PreschoolChainAssignmentDTO> {
    this.assertRequired(input);
    const branch = await this.preflightEnrollmentBranch(input);

    const existing = await this.getEnrollmentChain(input.tenantId, input.enrollmentId);
    if (existing && (existing.courseId !== input.courseId || existing.branchId !== branch.id || existing.requestId !== input.requestId)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_ASSIGNMENT_CONFLICT');
    }
    try {
      const assignment = await this.operations.assignEnrollment({
        tenantId: input.tenantId, actorId: input.actorUserId, courseId: input.courseId,
        enrollmentId: input.enrollmentId, branchId: input.branchId, requestId: input.requestId,
      });
      return this.toAssignment(assignment);
    } catch (error) {
      if (error instanceof EducationPreschoolOperationError) throw new PreschoolChainError(error.code, error.status);
      throw error;
    }
  }

  public async getEnrollmentChain(
    tenantId: string,
    enrollmentId: string,
  ): Promise<PreschoolChainAssignmentDTO | null> {
    const { data, error } = await this.client
      .from('preschool_chain_enrollment_branch_assignments')
      .select('tenant_id, enrollment_id, course_id, branch_id, request_id, assigned_by')
      .eq('tenant_id', tenantId)
      .eq('enrollment_id', enrollmentId)
      .maybeSingle();

    if (error) {
      throw new Error(`PRESCHOOL_CHAIN_READBACK_FAILED: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    return {
      tenantId: data.tenant_id,
      courseId: data.course_id,
      enrollmentId: data.enrollment_id,
      branchId: data.branch_id,
      requestId: data.request_id,
      assignedBy: data.assigned_by,
    };
  }

  public async assertBranchAccess(tenantId: string, actorId: string, branchId: string): Promise<void> {
    const branch = await this.getBranchOrThrow(tenantId, branchId);
    await this.assertUserCanAccessBranch(tenantId, actorId, branch.id);
  }

  public async listCourseAssignments(tenantId: string, actorId: string, branchId?: string) {
    const branches = await this.listAccessibleBranches(tenantId, actorId);
    if (branchId !== undefined && !branches.some((branch) => branch.id === branchId)) throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED',403);
    const ids = branchId !== undefined ? [branchId] : branches.map((branch) => branch.id);
    if (!ids.length) return [];
    const rows:Array<{tenant_id:string;course_id:string;branch_id:string}>=[];
    for (let offset=0;;) {
      const { data, error } = await this.client.from('preschool_chain_course_branch_assignments')
        .select('tenant_id,course_id,branch_id').eq('tenant_id',tenantId).in('branch_id',ids)
        .order('course_id').range(offset,offset+499);
      if (error) throw new Error(`PRESCHOOL_CHAIN_COURSE_ASSIGNMENT_READ_FAILED: ${error.message}`);
      if (!data?.length) break;
      if (data.some((row)=>rows.some((prior)=>prior.course_id===row.course_id))) throw new Error('PRESCHOOL_CHAIN_PAGINATION_DID_NOT_ADVANCE');
      rows.push(...data);offset+=data.length;
    }
    return rows;
  }

  public async listEnrollmentAssignments(tenantId: string, actorId: string, branchId?: string) {
    const courses = await this.listCourseAssignments(tenantId,actorId,branchId);
    if (!courses.length) return [];
    const data:Array<{tenant_id:string;enrollment_id:string;course_id:string;branch_id:string;request_id:string;assigned_by:string|null}>=[];
    for (let offset=0;;) {
      const page = await this.client.from('preschool_chain_enrollment_branch_assignments')
        .select('tenant_id,enrollment_id,course_id,branch_id,request_id,assigned_by')
        .eq('tenant_id',tenantId).in('branch_id',[...new Set(courses.map((row)=>row.branch_id))])
        .order('enrollment_id').range(offset,offset+499);
      if (page.error) throw new Error(`PRESCHOOL_CHAIN_ENROLLMENT_ASSIGNMENT_READ_FAILED: ${page.error.message}`);
      if (!page.data?.length) break;
      if (page.data.some((row)=>data.some((prior)=>prior.enrollment_id===row.enrollment_id))) throw new Error('PRESCHOOL_CHAIN_PAGINATION_DID_NOT_ADVANCE');
      data.push(...page.data);offset+=page.data.length;
    }
    for (const row of data) if (!courses.some((course) => course.course_id===row.course_id && course.branch_id===row.branch_id)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
    }
    const assignments = data.map((row) => this.toAssignment(row));
    for (const assignment of assignments) await this.verifyCanonicalAssignment(assignment);
    return assignments;
  }

  public async assertCourseAccess(tenantId: string, actorId: string, courseId: string): Promise<void> {
    if (!(await this.listCourseAssignments(tenantId,actorId)).some((row) => row.course_id===courseId)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_COURSE_ACCESS_DENIED',403);
    }
  }

  public async assertEnrollmentAccess(tenantId: string, actorId: string, enrollmentId: string, expectedStudentId?: string, expectedCourseId?: string) {
    const assignment = await this.getEnrollmentChain(tenantId,enrollmentId);
    if (!assignment) throw new PreschoolChainError('PRESCHOOL_CHAIN_ENROLLMENT_ACCESS_DENIED',403);
    const courses = await this.listCourseAssignments(tenantId,actorId);
    if (!courses.some((row) => row.course_id===assignment.courseId && row.branch_id===assignment.branchId)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_ENROLLMENT_ACCESS_DENIED',403);
    }
    const enrollment = await this.verifyCanonicalAssignment(assignment);
    if (!enrollment || enrollment.tenantId!==tenantId || enrollment.courseId!==assignment.courseId
      || (expectedStudentId && enrollment.studentPartyId!==expectedStudentId)
      || (expectedCourseId && enrollment.courseId!==expectedCourseId)) throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
    return enrollment;
  }

  private async verifyCanonicalAssignment(assignment: PreschoolChainAssignmentDTO) {
    const enrollment = await new EnrollmentContractImpl(this.client).getEnrollment(assignment.tenantId,assignment.enrollmentId);
    if (!enrollment || enrollment.tenantId!==assignment.tenantId || enrollment.courseId!==assignment.courseId) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
    }
    const recovered = await new EnrollmentRecoveryContractImpl(this.client).getEnrollmentByRequest({
      tenantId:assignment.tenantId, requestId:assignment.requestId,
      studentPartyId:enrollment.studentPartyId, courseId:assignment.courseId,
    });
    if (!recovered || recovered.id!==enrollment.id) throw new PreschoolChainError('PRESCHOOL_CHAIN_CANONICAL_CONFLICT');
    return enrollment;
  }

  public async assertStudentAccess(tenantId: string, actorId: string, studentPartyId: string): Promise<void> {
    const assignments = await this.listEnrollmentAssignments(tenantId,actorId);
    for (const assignment of assignments) {
      const enrollment = await this.verifyCanonicalAssignment(assignment);
      if (enrollment.studentPartyId===studentPartyId && ['active','pending'].includes(enrollment.status)) return;
    }
    throw new PreschoolChainError('PRESCHOOL_CHAIN_STUDENT_ACCESS_DENIED',403);
  }

  private toAssignment(row: { tenant_id:string;course_id:string;enrollment_id:string;branch_id:string;request_id:string;assigned_by:string|null }): PreschoolChainAssignmentDTO {
    return { tenantId:row.tenant_id,courseId:row.course_id,enrollmentId:row.enrollment_id,branchId:row.branch_id,requestId:row.request_id,assignedBy:row.assigned_by };
  }

  private assertRequired(input: AssignPreschoolChainInput): void {
    if (!input.tenantId) throw new Error('PRESCHOOL_CHAIN_TENANT_REQUIRED');
    if (!input.courseId) throw new Error('PRESCHOOL_CHAIN_COURSE_REQUIRED');
    if (!input.enrollmentId) throw new Error('PRESCHOOL_CHAIN_ENROLLMENT_REQUIRED');
    if (!input.branchId) throw new Error('PRESCHOOL_CHAIN_BRANCH_REQUIRED');
    if (!input.actorUserId) throw new Error('PRESCHOOL_CHAIN_ACTOR_REQUIRED');
    if (!input.requestId) throw new Error('PRESCHOOL_CHAIN_REQUEST_REQUIRED');
  }

  private async getBranchOrThrow(tenantId: string, branchId: string): Promise<OrgUnitScope> {
    const branch = await this.orgUnits.getOrgUnit(branchId, tenantId);

    if (!branch || branch.unitType !== 'branch' || !branch.isActive) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_NOT_ACTIVE_IN_TENANT',400);
    }

    return branch;
  }

  private async assertNoConflictingCourseBranch(tenantId: string, courseId: string, branchId: string): Promise<void> {
    const { data, error } = await this.client
      .from('preschool_chain_course_branch_assignments')
      .select('branch_id')
      .eq('tenant_id', tenantId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (error) {
      throw new Error(`PRESCHOOL_CHAIN_COURSE_BRANCH_LOOKUP_FAILED: ${error.message}`);
    }
    if (data && data.branch_id !== branchId) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT');
    }
  }

  private async assertUserCanAccessBranch(tenantId: string, userId: string, branchId: string): Promise<void> {
    if (await this.hasTenantWideBranchAccess(tenantId, userId)) {
      return;
    }

    const person = await this.getActivePersonForUser(tenantId, userId);
    if (!person) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED',403);
    }

    const [relationships, orgUnits] = await Promise.all([
      this.getActiveUnitRelationships(tenantId, person.id),
      this.orgUnits.getOrgUnits({ tenantId, isActive: true }),
    ]);

    if (!this.isBranchAccessible(branchId, relationships, orgUnits)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED',403);
    }
  }

  private async listTrustedActorAccess(tenantId: string, actorUserId: string): Promise<readonly TrustedActorOrgUnitAccessRow[]> {
    let rows: readonly TrustedActorOrgUnitAccessRow[];
    try {
      rows = await this.trustedActorAccess.listForActor({ p_tenant_id: tenantId, p_actor_id: actorUserId });
    } catch (error) {
      if (error instanceof Error && error.message === 'TRUSTED_ACTOR_ACCESS_DENIED') {
        throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED', 403);
      }
      throw new Error(`PRESCHOOL_CHAIN_BRANCH_ACCESS_LOOKUP_FAILED: ${error instanceof Error ? error.message : 'Unknown access error'}`);
    }
    if (rows.some((row) => row.tenant_id !== tenantId || row.user_id !== actorUserId)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED', 403);
    }
    return rows;
  }

  private async listCurrentActorOrgUnitAccess(
    tenantId: string,
    actorUserId: string,
  ): Promise<readonly CurrentActorOrgUnitAccessRow[]> {
    const actorClient = this.client as unknown as SupabaseClient<PlatformActorDatabase>;
    const { data, error } = await actorClient.rpc(CURRENT_ACTOR_ORG_UNIT_ACCESS_RPC);
    if (error || !Array.isArray(data)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_LOOKUP_FAILED', 503);
    }
    const rows: CurrentActorOrgUnitAccessRow[] = [];
    for (const row of data) {
      if (row.tenant_id !== tenantId || row.user_id !== actorUserId
        || !this.isOrgUnitAccessSource(row.access_source)) {
        throw new PreschoolChainError('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED', 403);
      }
      rows.push({ ...row, access_source: row.access_source });
    }
    return rows;
  }

  private isOrgUnitAccessSource(value: string): value is CurrentActorOrgUnitAccessRow['access_source'] {
    return ['belongs_to', 'manages', 'participates_in', 'tenant_admin'].includes(value);
  }

  private hasErrorCode(error: unknown, expected: string): boolean {
    return error !== null && typeof error === 'object' && 'code' in error
      && error.code === expected;
  }

  private async getActiveRole(tenantId: string, userId: string): Promise<string> {
    const { data: user, error } = await this.client.from('users').select('role, status')
      .eq('tenant_id', tenantId).eq('id', userId).maybeSingle();
    if (error) throw new Error(`PRESCHOOL_CHAIN_USER_LOOKUP_FAILED: ${error.message}`);
    const role = user?.role?.toLowerCase() ?? '';
    if (!user || user.status !== 'active' || !['admin','super_admin','admin_staff'].includes(role)) {
      throw new PreschoolChainError('PRESCHOOL_CHAIN_ACTOR_DENIED', 403);
    }
    return role;
  }

  private async hasTenantWideBranchAccess(tenantId: string, userId: string): Promise<boolean> {
    return ['admin','super_admin'].includes(await this.getActiveRole(tenantId,userId));
  }

  private async getActivePersonForUser(tenantId: string, userId: string): Promise<{ id: string } | null> {
    const { data: person, error: personError } = await this.client
      .from('people_directory')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (personError) {
      throw new Error(`PRESCHOOL_CHAIN_PERSON_LOOKUP_FAILED: ${personError.message}`);
    }

    return person;
  }

  private async getActiveUnitRelationships(tenantId: string, personId: string): Promise<OrgRelationshipRow[]> {
    const { data, error } = await this.client
      .from('org_relationships')
      .select('to_id, rel_type, since, until')
      .eq('tenant_id', tenantId)
      .eq('from_id', personId)
      .eq('from_type', 'person')
      .eq('to_type', 'unit')
      .in('rel_type', ['belongs_to', 'manages', 'participates_in']);

    if (error) {
      throw new Error(`PRESCHOOL_CHAIN_RELATIONSHIP_LOOKUP_FAILED: ${error.message}`);
    }

    const today = new Date().toISOString().slice(0, 10);
    return (data ?? []).filter((relationship) => {
      const startsBeforeToday = !relationship.since || relationship.since <= today;
      const endsAfterToday = !relationship.until || relationship.until >= today;
      return startsBeforeToday && endsAfterToday;
    });
  }

  private isBranchAccessible(
    branchId: string,
    relationships: readonly OrgRelationshipRow[],
    orgUnits: readonly OrgUnitScope[],
  ): boolean {
    const childrenByParent = new Map<string, string[]>();
    for (const unit of orgUnits) {
      if (!unit.isActive || !unit.parentId) continue;
      const children = childrenByParent.get(unit.parentId) ?? [];
      children.push(unit.id);
      childrenByParent.set(unit.parentId, children);
    }

    const visited = new Set<string>();
    const activeIds = new Set(orgUnits.filter((unit) => unit.isActive).map((unit) => unit.id));
    const queue = relationships.map((relationship) => relationship.to_id).filter((id) => activeIds.has(id));
    while (queue.length > 0) {
      const unitId = queue.shift();
      if (!unitId || visited.has(unitId)) continue;
      if (unitId === branchId) return true;
      visited.add(unitId);
      queue.push(...(childrenByParent.get(unitId) ?? []));
    }

    return false;
  }

  private toBranchOptions(branches: readonly Pick<OrgUnit, 'id' | 'name' | 'code'>[]): PreschoolBranchOption[] {
    return branches
      .map((branch) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, 'vi'));
  }
}
