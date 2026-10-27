/** Education-owned, branch-authorized registry. Attendance keeps its separate active-only contract. */
export type PreschoolRegistryStatus = 'all' | 'active' | 'pending';
export interface PreschoolRegistryQuery {
  query?: string;
  status?: PreschoolRegistryStatus;
  courseId?: string | null;
  branchId?: string | null;
  offset?: number;
  limit?: number;
}
export interface PreschoolRegistryEnrollment {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  branchId: string;
  branchName: string;
  status: 'active' | 'pending';
}
export interface PreschoolRegistryStudent {
  id: string;
  tenantId: string;
  partyId: string;
  studentCode: string;
  name: string;
  gender: string | null;
  dob: string | null;
  enrollments: PreschoolRegistryEnrollment[];
}
export interface PreschoolRegistryPage {
  tenantId: string;
  request: Required<PreschoolRegistryQuery>;
  totals: { students: number; active: number; pending: number };
  filteredTotal: number;
  nextOffset: number | null;
  students: PreschoolRegistryStudent[];
}
export interface IPreschoolRegistryContract {
  read(tenantId: string, query?: PreschoolRegistryQuery): Promise<PreschoolRegistryPage>;
}
export class PreschoolRegistryError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 503) { super(code); }
}
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
export const isRegistryUuid = (v: unknown): v is string => typeof v === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export function normalizeRegistryQuery(input: PreschoolRegistryQuery = {}): Required<PreschoolRegistryQuery> {
  if (input.query !== undefined && typeof input.query !== 'string') throw new PreschoolRegistryError('REGISTRY_INVALID_REQUEST', 400);
  const q = { query: input.query?.trim() ?? '', status: input.status ?? 'all', courseId: input.courseId ?? null,
    branchId: input.branchId ?? null, offset: input.offset ?? 0, limit: input.limit ?? 20 };
  if (typeof q.query !== 'string' || q.query.length > 80 || /[\u0000-\u001f\u007f]/.test(q.query)
    || !['all', 'active', 'pending'].includes(q.status) || !integer(q.offset) || q.offset > 100000
    || !integer(q.limit) || q.limit < 1 || q.limit > 50
    || (q.courseId !== null && !isRegistryUuid(q.courseId)) || (q.branchId !== null && !isRegistryUuid(q.branchId))) {
    throw new PreschoolRegistryError('REGISTRY_INVALID_REQUEST', 400);
  }
  return q;
}
/** Reject malformed responses and accidental extra sensitive fields at the public boundary. */
export function isPreschoolRegistryPage(value: unknown, input: PreschoolRegistryQuery = {}, tenantId?: string): value is PreschoolRegistryPage {
  const expected = normalizeRegistryQuery(input);
  if (!record(value) || !keys(value, ['tenantId', 'request', 'totals', 'filteredTotal', 'nextOffset', 'students'])
    || !isRegistryUuid(value.tenantId) || (tenantId !== undefined && value.tenantId !== tenantId)
    || !record(value.request) || !keys(value.request, Object.keys(expected))
    || Object.entries(expected).some(([key, v]) => (value.request as Record<string, unknown>)[key] !== v)
    || !record(value.totals) || !keys(value.totals, ['students', 'active', 'pending'])
    || !integer(value.totals.students) || !integer(value.totals.active) || !integer(value.totals.pending)
    || value.totals.active > value.totals.students || value.totals.pending > value.totals.students
    || !integer(value.filteredTotal) || value.filteredTotal > value.totals.students || !Array.isArray(value.students)
    || value.students.length !== Math.min(expected.limit, Math.max(0, value.filteredTotal - expected.offset))) return false;
  const next = expected.offset + value.students.length < value.filteredTotal && expected.offset + value.students.length <= 100000
    ? expected.offset + value.students.length : null;
  if (value.nextOffset !== next || (next !== null && next <= expected.offset)) return false;
  const seenStudents = new Set<string>(), seenParties = new Set<string>(), seenEnrollments = new Set<string>();
  for (const student of value.students) {
    if (!record(student) || !keys(student, ['id', 'tenantId', 'partyId', 'studentCode', 'name', 'gender', 'dob', 'enrollments'])
      || !isRegistryUuid(student.id) || !isRegistryUuid(student.partyId) || student.tenantId !== value.tenantId
      || !text(student.studentCode) || !text(student.name) || (student.gender !== null && typeof student.gender !== 'string')
      || (student.dob !== null && (typeof student.dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(student.dob)))
      || seenStudents.has(student.id) || seenParties.has(student.partyId)
      || !Array.isArray(student.enrollments) || student.enrollments.length === 0) return false;
    seenStudents.add(student.id); seenParties.add(student.partyId);
    for (const enrollment of student.enrollments) {
      if (!record(enrollment) || !keys(enrollment, ['id', 'courseId', 'courseCode', 'courseTitle', 'branchId', 'branchName', 'status'])
        || !isRegistryUuid(enrollment.id) || !isRegistryUuid(enrollment.courseId) || !isRegistryUuid(enrollment.branchId)
        || !text(enrollment.courseCode) || !text(enrollment.courseTitle) || !text(enrollment.branchName)
        || (enrollment.status !== 'active' && enrollment.status !== 'pending') || seenEnrollments.has(enrollment.id)
        || (expected.courseId !== null && enrollment.courseId !== expected.courseId)
        || (expected.branchId !== null && enrollment.branchId !== expected.branchId)) return false;
      seenEnrollments.add(enrollment.id);
    }
    if (expected.status !== 'all' && !student.enrollments.some((e: PreschoolRegistryEnrollment) => e.status === expected.status)) return false;
  }
  return true;
}
