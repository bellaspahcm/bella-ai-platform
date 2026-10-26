import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { TeacherClassroomAssignment, type TeacherRole, type TeacherAssignmentStatus } from '../domain/teacher-assignment.entity';
import {
  PreschoolTeacherContractError,
  type IPreschoolTeacherContract,
  type PreschoolTeacherContext,
  type PreschoolTeacherConfirmation,
  type PreschoolTeacherCandidatePage,
  type PreschoolCourseTeacherPage,
  type PreschoolTeacherAttendanceCourseScope,
  type PreschoolCanonicalTeacherAssignmentReceipt,
  type PreschoolCanonicalTeacherAssignment,
  type PreschoolTeacherEligibility,
} from './teacher-assignment.contract';

interface TeacherRpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES: readonly TeacherRole[] = ['lead_teacher', 'co_teacher', 'assistant', 'substitute'];
const STATUSES: readonly TeacherAssignmentStatus[] = ['active', 'completed', 'terminated'];
const ELIGIBILITIES: readonly PreschoolTeacherEligibility[] = [
  'confirmed', 'confirmation_revoked', 'outside_confirmation_dates', 'identity_unavailable',
];

function invalid(): never { throw new PreschoolTeacherContractError('PRESCHOOL_TEACHER_INVALID_REQUEST', 400); }
function unavailable(): never { throw new PreschoolTeacherContractError('PRESCHOOL_TEACHER_UNAVAILABLE', 503); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function isNullableDate(value: unknown): value is string | null { return value === null || isDate(value); }
function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
    && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);
}
function isDisplayName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function pageInput(offset: number, limit: number): void {
  if (!Number.isInteger(offset) || offset < 0 || offset > 100_000 || !Number.isInteger(limit) || limit < 1 || limit > 50) invalid();
}
function assertContext(context: PreschoolTeacherContext): void {
  if (!isUuid(context.tenantId) || !isUuid(context.actorId) || !isUuid(context.branchId)) invalid();
}
function rpcContext(context: PreschoolTeacherContext): Record<string, unknown> {
  return { p_tenant_id: context.tenantId.toLowerCase(), p_actor_id: context.actorId.toLowerCase(),
    p_branch_id: context.branchId.toLowerCase() };
}
function parseConfirmation(value: unknown, context: PreschoolTeacherContext): PreschoolTeacherConfirmation {
  if (!isRecord(value) || !isUuid(value.id) || value.tenant_id !== context.tenantId
    || value.branch_id !== context.branchId || !isUuid(value.teacher_party_id)
    || !isDate(value.valid_from) || !isNullableDate(value.valid_to)
    || (value.valid_to !== null && value.valid_to < value.valid_from)
    || !isText(value.attestation, 500) || !isUuid(value.confirmed_by)
    || typeof value.confirmed_at !== 'string' || !value.confirmed_at
    || (value.revoked_at !== null && typeof value.revoked_at !== 'string')
    || (value.revoked_by !== null && !isUuid(value.revoked_by))
    || (value.revocation_reason !== null && typeof value.revocation_reason !== 'string')) unavailable();
  return {
    id: value.id, tenantId: context.tenantId, branchId: context.branchId,
    teacherPartyId: value.teacher_party_id, validFrom: value.valid_from, validTo: value.valid_to,
    attestation: value.attestation, confirmedBy: value.confirmed_by, confirmedAt: value.confirmed_at,
    revokedAt: value.revoked_at, revokedBy: value.revoked_by, revocationReason: value.revocation_reason,
  };
}
function parseAssignment(value: unknown, context: PreschoolTeacherContext, courseId: string): PreschoolCanonicalTeacherAssignmentReceipt {
  if (!isRecord(value) || !isUuid(value.assignment_id) || value.tenant_id !== context.tenantId
    || value.course_id !== null || value.canonical_course_id !== courseId
    || !isUuid(value.teacher_party_id) || !isUuid(value.canonical_teacher_confirmation_id)
    || !ROLES.includes(value.role as TeacherRole) || !isText(value.academic_year, 80)
    || !isDate(value.effective_start_date) || !isNullableDate(value.effective_end_date)
    || (value.effective_end_date !== null && value.effective_end_date < value.effective_start_date)
    || !STATUSES.includes(value.status as TeacherAssignmentStatus)) unavailable();
  return {
    assignmentId: value.assignment_id, tenantId: context.tenantId, branchId: context.branchId,
    courseId, teacherPartyId: value.teacher_party_id,
    confirmationId: value.canonical_teacher_confirmation_id, role: value.role as TeacherRole,
    academicYear: value.academic_year, effectiveStartDate: value.effective_start_date,
    effectiveEndDate: value.effective_end_date, status: value.status as TeacherAssignmentStatus,
  };
}

/** Education-owned adapter for canonical teacher management and caller-scoped attendance contracts. */
export class PreschoolTeacherContractImpl implements IPreschoolTeacherContract {
  private readonly rpcClient: TeacherRpcClient;

  constructor(client: SupabaseClient<Database>) {
    this.rpcClient = client as unknown as TeacherRpcClient;
  }

  private async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    let result: Awaited<ReturnType<TeacherRpcClient['rpc']>>;
    try { result = await this.rpcClient.rpc(name, args); }
    catch { return unavailable(); }
    if (result.error) {
      if (result.error.code === '42501') throw new PreschoolTeacherContractError('PRESCHOOL_TEACHER_ACCESS_DENIED', 403);
      if (result.error.code === '22023') return invalid();
      if (result.error.code === '23505') throw new PreschoolTeacherContractError('PRESCHOOL_TEACHER_CONFLICT', 409);
      return unavailable();
    }
    return result.data;
  }

  async listCandidates(context: PreschoolTeacherContext, query: string, confirmedOnly: boolean,
    onDate: string, offset: number, limit: number): Promise<PreschoolTeacherCandidatePage> {
    assertContext(context); pageInput(offset, limit);
    if (typeof query !== 'string' || query.length > 80 || /[\x00-\x1f\x7f]/.test(query)
      || typeof confirmedOnly !== 'boolean' || !isDate(onDate)) invalid();
    const value = await this.rpc('preschool_teacher_candidates', {
      ...rpcContext(context), p_query: query, p_confirmed_only: confirmedOnly,
      p_on_date: onDate, p_offset: offset, p_limit: limit,
    });
    if (!isRecord(value) || value.tenantId !== context.tenantId || value.branchId !== context.branchId
      || value.onDate !== onDate || value.confirmedOnly !== confirmedOnly || value.offset !== offset
      || value.limit !== limit || !Number.isInteger(value.filteredTotal) || (value.filteredTotal as number) < 0
      || (value.nextOffset !== null && (!Number.isInteger(value.nextOffset) || (value.nextOffset as number) <= offset))
      || !Array.isArray(value.parties) || value.parties.length > limit) unavailable();
    const seen = new Set<string>();
    const parties = value.parties.map((item: unknown) => {
    if (!isRecord(item) || !isUuid(item.partyId) || !isDisplayName(item.displayName)
        || seen.has(item.partyId) || !Array.isArray(item.confirmations)) unavailable();
      seen.add(item.partyId);
      const confirmations = item.confirmations.map((confirmation: unknown) => {
        if (!isRecord(confirmation) || !isUuid(confirmation.confirmationId)
          || !isDate(confirmation.validFrom) || !isNullableDate(confirmation.validTo)
          || !isUuid(confirmation.confirmedBy) || typeof confirmation.confirmedAt !== 'string'
          || !confirmation.confirmedAt) unavailable();
        return {
          confirmationId: confirmation.confirmationId, validFrom: confirmation.validFrom,
          validTo: confirmation.validTo, confirmedBy: confirmation.confirmedBy, confirmedAt: confirmation.confirmedAt,
        };
      });
      if (confirmedOnly && confirmations.length === 0) unavailable();
      return { partyId: item.partyId, displayName: item.displayName, confirmations };
    });
    return { tenantId: context.tenantId, branchId: context.branchId, onDate, confirmedOnly, offset, limit,
      filteredTotal: value.filteredTotal as number, nextOffset: value.nextOffset as number | null, parties };
  }

  async confirm(context: PreschoolTeacherContext, input: {
    operationKey: string; teacherPartyId: string; validFrom: string; validTo: string | null; attestation: string;
  }): Promise<PreschoolTeacherConfirmation> {
    assertContext(context);
    if (!isUuid(input.operationKey) || !isUuid(input.teacherPartyId) || !isDate(input.validFrom)
      || !isNullableDate(input.validTo) || (input.validTo !== null && input.validTo < input.validFrom)
      || !isText(input.attestation, 500)) invalid();
    const value = await this.rpc('preschool_confirm_teacher', {
      ...rpcContext(context), p_operation_key: input.operationKey.toLowerCase(),
      p_teacher_party_id: input.teacherPartyId.toLowerCase(), p_valid_from: input.validFrom,
      p_valid_to: input.validTo, p_attestation: input.attestation,
    });
    const row = parseConfirmation(value, context);
    if (row.id !== input.operationKey.toLowerCase() || row.confirmedBy !== context.actorId
      || row.teacherPartyId !== input.teacherPartyId.toLowerCase()
      || row.validFrom !== input.validFrom || row.validTo !== input.validTo || row.attestation !== input.attestation) unavailable();
    return row;
  }

  async revoke(context: PreschoolTeacherContext, input: { confirmationId: string; reason: string }): Promise<PreschoolTeacherConfirmation> {
    assertContext(context);
    if (!isUuid(input.confirmationId) || !isText(input.reason, 500)) invalid();
    const value = await this.rpc('preschool_revoke_teacher_confirmation', {
      ...rpcContext(context), p_confirmation_id: input.confirmationId.toLowerCase(), p_reason: input.reason,
    });
    const row = parseConfirmation(value, context);
    if (row.id !== input.confirmationId.toLowerCase() || !row.revokedAt
      || row.revokedBy !== context.actorId || row.revocationReason !== input.reason) unavailable();
    return row;
  }

  async assign(context: PreschoolTeacherContext, input: {
    operationKey: string; courseId: string; confirmationId: string; teacherPartyId: string;
    role: TeacherRole; academicYear: string; effectiveStartDate: string; effectiveEndDate: string | null;
  }): Promise<PreschoolCanonicalTeacherAssignmentReceipt> {
    assertContext(context);
    if (![input.operationKey, input.courseId, input.confirmationId, input.teacherPartyId].every(isUuid)
      || !ROLES.includes(input.role) || !isText(input.academicYear, 80)
      || !isDate(input.effectiveStartDate) || !isNullableDate(input.effectiveEndDate)
      || (input.effectiveEndDate !== null && input.effectiveEndDate < input.effectiveStartDate)) invalid();
    const assignment = TeacherClassroomAssignment.create({
      id: input.operationKey.toLowerCase(), tenantId: context.tenantId, courseId: input.courseId.toLowerCase(),
      teacherPartyId: input.teacherPartyId.toLowerCase(), role: input.role, academicYear: input.academicYear,
      effectiveStartDate: new Date(`${input.effectiveStartDate}T00:00:00.000Z`),
      effectiveEndDate: input.effectiveEndDate ? new Date(`${input.effectiveEndDate}T00:00:00.000Z`) : null,
    });
    const value = await this.rpc('edu_assign_preschool_teacher', {
      ...rpcContext(context), p_operation_key: assignment.id, p_course_id: assignment.courseId,
      p_confirmation_id: input.confirmationId.toLowerCase(), p_teacher_party_id: assignment.teacherPartyId,
      p_role: assignment.role, p_academic_year: assignment.academicYear,
      p_effective_start_date: input.effectiveStartDate, p_effective_end_date: input.effectiveEndDate,
    });
    const row = parseAssignment(value, context, assignment.courseId);
    if (row.assignmentId !== assignment.id || row.teacherPartyId !== assignment.teacherPartyId
      || row.confirmationId !== input.confirmationId.toLowerCase() || row.role !== input.role
      || row.academicYear !== assignment.academicYear || row.effectiveStartDate !== input.effectiveStartDate
      || row.effectiveEndDate !== input.effectiveEndDate || row.status !== 'active') unavailable();
    return row;
  }

  async listCourseTeachers(context: PreschoolTeacherContext, courseId: string, onDate: string,
    offset: number, limit: number): Promise<PreschoolCourseTeacherPage> {
    assertContext(context); pageInput(offset, limit);
    if (!isUuid(courseId) || !isDate(onDate)) invalid();
    const id = courseId.toLowerCase();
    const value = await this.rpc('edu_get_preschool_course_teachers', {
      ...rpcContext(context), p_course_id: id, p_on_date: onDate, p_offset: offset, p_limit: limit,
    });
    if (!isRecord(value) || value.tenantId !== context.tenantId || value.branchId !== context.branchId
      || value.courseId !== id || value.onDate !== onDate || value.offset !== offset || value.limit !== limit
      || !Number.isInteger(value.total) || (value.total as number) < 0
      || (value.nextOffset !== null && (!Number.isInteger(value.nextOffset) || (value.nextOffset as number) <= offset))
      || !Array.isArray(value.assignments) || value.assignments.length > limit) unavailable();
    const assignments: PreschoolCanonicalTeacherAssignment[] = value.assignments.map((item: unknown) => {
      const receipt = parseAssignment(item, context, id);
      if (!isRecord(item) || item.branchId !== context.branchId
        || (item.teacherName !== null && !isDisplayName(item.teacherName))
        || typeof item.effectiveOnDate !== 'boolean'
        || !ELIGIBILITIES.includes(item.eligibility as PreschoolTeacherEligibility)) unavailable();
      return { ...receipt, teacherName: item.teacherName, effectiveOnDate: item.effectiveOnDate,
        eligibility: item.eligibility as PreschoolTeacherEligibility };
    });
    return { tenantId: context.tenantId, branchId: context.branchId, courseId: id, onDate,
      offset, limit, total: value.total as number, nextOffset: value.nextOffset as number | null, assignments };
  }

  async listMyAttendanceCourses(schoolDay: string, branchId?: string): Promise<PreschoolTeacherAttendanceCourseScope> {
    if (!isDate(schoolDay) || (branchId !== undefined && !isUuid(branchId))) invalid();
    const value = await this.rpc('preschool_teacher_attendance_courses', {
      p_school_day: schoolDay, p_branch_id: branchId?.toLowerCase() ?? null,
    });
    if (!isRecord(value) || !isUuid(value.tenantId) || !isUuid(value.actorId)
      || value.schoolDay !== schoolDay || !Array.isArray(value.courses)) unavailable();
    const seen = new Set<string>();
    const courses = value.courses.map((item: unknown) => {
      if (!isRecord(item) || !isUuid(item.courseId) || !isUuid(item.branchId)
        || !isText(item.name, 180) || (branchId !== undefined
          && item.branchId.toLowerCase() !== branchId.toLowerCase()) || seen.has(item.courseId)) unavailable();
      seen.add(item.courseId);
      return { courseId: item.courseId, name: item.name, branchId: item.branchId };
    });
    return { tenantId: value.tenantId, actorId: value.actorId, schoolDay, courses };
  }

  async terminate(context: PreschoolTeacherContext, input: {
    courseId: string; assignmentId: string; endDate: string;
  }): Promise<PreschoolCanonicalTeacherAssignmentReceipt> {
    assertContext(context);
    if (!isUuid(input.courseId) || !isUuid(input.assignmentId) || !isDate(input.endDate)) invalid();
    const courseId = input.courseId.toLowerCase();
    const value = await this.rpc('edu_terminate_preschool_teacher', {
      ...rpcContext(context), p_course_id: courseId, p_assignment_id: input.assignmentId.toLowerCase(),
      p_end_date: input.endDate,
    });
    const row = parseAssignment(value, context, courseId);
    if (row.assignmentId !== input.assignmentId.toLowerCase() || row.status !== 'terminated'
      || row.effectiveEndDate !== input.endDate) unavailable();
    return row;
  }
}
