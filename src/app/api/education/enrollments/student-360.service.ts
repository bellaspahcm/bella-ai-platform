import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { PreschoolRegistryContractImpl } from '@/platform/education/contracts/preschool-registry.contract.impl';
import {
  isPreschoolRegistryPage,
  isRegistryUuid,
  type PreschoolRegistryEnrollment,
  type PreschoolRegistryStudent,
} from '@/platform/education/contracts/preschool-registry.contract';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import type { EducationAttendanceDTO } from '@/platform/education/contracts/attendance.contract';

const PAGE_SIZE = 50;
const MAX_REGISTRY_PAGES = 100;
// PostgREST is configured with max_rows = 1000. A full-size response may have
// been truncated, so Student 360 must fail closed instead of reporting partial
// history as a complete count.
const ATTENDANCE_HISTORY_ROW_CAP = 1000;

export interface Student360AttendanceRecord extends Omit<EducationAttendanceDTO, 'tenantId'> {
  readonly courseId: string;
  readonly courseTitle: string;
}

export interface Student360ProfileData {
  readonly id: string;
  readonly studentId: string;
  readonly partyId: string;
  readonly name: string;
  readonly dob: string | null;
  readonly gender: string | null;
  readonly enrollments: readonly PreschoolRegistryEnrollment[];
  readonly attendance: {
    readonly present: number;
    readonly absent: number;
    readonly excused: number;
    readonly totalRecords: number;
    readonly records: readonly Student360AttendanceRecord[];
  };
}

export class Student360ReadError extends Error {
  constructor(readonly code: string, readonly status: 400 | 503) {
    super(code);
  }
}

function unavailable(): never {
  throw new Student360ReadError('STUDENT_PROFILE_UNAVAILABLE', 503);
}

function matchesStudent(student: PreschoolRegistryStudent, identifier: string): boolean {
  if (student.studentCode === identifier) return true;
  if (!isRegistryUuid(identifier.toLowerCase())) return false;
  const uuid = identifier.toLowerCase();
  return student.id === uuid || student.partyId === uuid
    || student.enrollments.some(enrollment => enrollment.id === uuid);
}

function isAttendanceRecord(value: unknown, tenantId: string, enrollmentId: string): value is EducationAttendanceDTO {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return isRegistryUuid(record.id) && record.tenantId === tenantId && record.enrollmentId === enrollmentId
    && typeof record.status === 'string' && ['present', 'absent', 'excused'].includes(record.status)
    && typeof record.rollCallTime === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(record.rollCallTime)
    && Number.isFinite(Date.parse(record.rollCallTime));
}

/** Only caller-authorized Registry records may supply Student 360 identities. */
export async function loadStudent360Profile(
  client: SupabaseClient<Database>,
  tenantId: string,
  rawIdentifier: string,
): Promise<Student360ProfileData | null> {
  const identifier = rawIdentifier.trim();
  if (!identifier || identifier.length > 80 || /[\u0000-\u001f\u007f]/.test(identifier)) {
    throw new Student360ReadError('INVALID_STUDENT_ID', 400);
  }

  const registry = new PreschoolRegistryContractImpl(client);
  const seenStudents = new Set<string>();
  const seenParties = new Set<string>();
  const seenCodes = new Set<string>();
  const seenEnrollments = new Set<string>();
  let student: PreschoolRegistryStudent | null = null;
  let expectedTotal: number | undefined;
  let expectedTotals: string | undefined;
  let offset = 0;
  let complete = false;

  for (let pageNumber = 0; pageNumber < MAX_REGISTRY_PAGES; pageNumber += 1) {
    const query = { status: 'all' as const, offset, limit: PAGE_SIZE };
    const page = await registry.read(tenantId, query);
    if (!isPreschoolRegistryPage(page, query, tenantId)) unavailable();
    const totals = JSON.stringify(page.totals);
    if ((expectedTotal !== undefined && expectedTotal !== page.filteredTotal)
      || (expectedTotals !== undefined && expectedTotals !== totals)) unavailable();
    expectedTotal = page.filteredTotal;
    expectedTotals = totals;

    for (const candidate of page.students) {
      if (seenStudents.has(candidate.id) || seenParties.has(candidate.partyId)
        || seenCodes.has(candidate.studentCode)) unavailable();
      seenStudents.add(candidate.id);
      seenParties.add(candidate.partyId);
      seenCodes.add(candidate.studentCode);
      for (const enrollment of candidate.enrollments) {
        if (seenEnrollments.has(enrollment.id)) unavailable();
        seenEnrollments.add(enrollment.id);
      }
      if (matchesStudent(candidate, identifier)) {
        if (student) unavailable();
        student = candidate;
      }
    }

    if (page.nextOffset === null) {
      if (offset + page.students.length !== page.filteredTotal) unavailable();
      complete = true;
      break;
    }
    if (page.nextOffset !== offset + page.students.length || page.nextOffset <= offset) unavailable();
    offset = page.nextOffset;
  }

  if (!complete) unavailable();
  if (!student) return null;

  const attendance = new AttendanceContractImpl(client);
  const records: Student360AttendanceRecord[] = [];
  const seenEvents = new Set<string>();
  const counts = { present: 0, absent: 0, excused: 0 };
  for (const enrollment of student.enrollments) {
    const history = await attendance.getAttendanceHistory(tenantId, enrollment.id);
    if (!Array.isArray(history)) unavailable();
    if (history.length >= ATTENDANCE_HISTORY_ROW_CAP) unavailable();
    for (const event of history) {
      if (!isAttendanceRecord(event, tenantId, enrollment.id) || seenEvents.has(event.id)) unavailable();
      seenEvents.add(event.id);
      counts[event.status] += 1;
      records.push({
        id: event.id,
        enrollmentId: event.enrollmentId,
        courseId: enrollment.courseId,
        courseTitle: enrollment.courseTitle,
        status: event.status,
        rollCallTime: event.rollCallTime,
      });
    }
  }
  records.sort((left, right) => Date.parse(right.rollCallTime) - Date.parse(left.rollCallTime)
    || left.id.localeCompare(right.id));

  return {
    id: student.studentCode,
    studentId: student.id,
    partyId: student.partyId,
    name: student.name,
    dob: student.dob,
    gender: student.gender,
    enrollments: student.enrollments,
    attendance: { ...counts, totalRecords: records.length, records },
  };
}
