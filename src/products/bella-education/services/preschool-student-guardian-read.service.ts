export const PRESCHOOL_G1_GUARDIANS_READ_RPC = 'preschool_g1_guardians_read';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_KEYS = ['studentId', 'studentPartyId', 'asOfDate', 'complete', 'guardianCount', 'guardians'];
const GUARDIAN_KEYS = ['guardianPartyId', 'displayName', 'phone', 'phoneState', 'relationships', 'pickupStatus'];
const RELATIONSHIP_KEYS = ['id', 'type', 'activeFrom', 'activeTo'];

export type PreschoolGuardianRelationshipType = 'guardian_of' | 'parent_of';
export type PreschoolGuardianPickupStatus = 'authorized' | 'revoked' | 'not_recorded';

export interface PreschoolStudentGuardianRelationship {
  readonly id: string;
  readonly type: PreschoolGuardianRelationshipType;
  readonly activeFrom: string | null;
  readonly activeTo: string | null;
}

export interface PreschoolStudentGuardian {
  readonly guardianPartyId: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly phoneState: 'recorded' | 'missing';
  readonly relationships: readonly PreschoolStudentGuardianRelationship[];
  readonly pickupStatus: PreschoolGuardianPickupStatus;
}

export interface PreschoolStudentGuardianReadPage {
  readonly studentId: string;
  readonly studentPartyId: string;
  readonly asOfDate: string;
  readonly complete: true;
  readonly guardianCount: number;
  readonly guardians: readonly PreschoolStudentGuardian[];
}

export class PreschoolStudentGuardianReadError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 503) {
    super(code);
    this.name = 'PreschoolStudentGuardianReadError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isDateOrNull(value: unknown): value is string | null {
  return value === null || isCalendarDate(value);
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isRelationship(value: unknown): value is PreschoolStudentGuardianRelationship {
  if (!isRecord(value) || !hasOnlyKeys(value, RELATIONSHIP_KEYS)) return false;
  return isUuid(value.id)
    && (value.type === 'guardian_of' || value.type === 'parent_of')
    && isDateOrNull(value.activeFrom)
    && isDateOrNull(value.activeTo)
    && (value.activeFrom === null || value.activeTo === null || value.activeFrom <= value.activeTo);
}

function isGuardian(value: unknown): value is PreschoolStudentGuardian {
  if (!isRecord(value) || !hasOnlyKeys(value, GUARDIAN_KEYS)
    || !isUuid(value.guardianPartyId)
    || typeof value.displayName !== 'string' || value.displayName.trim().length === 0
    || !Array.isArray(value.relationships) || value.relationships.length === 0
    || !value.relationships.every(isRelationship)
    || !['authorized', 'revoked', 'not_recorded'].includes(String(value.pickupStatus))) return false;
  if (value.phoneState === 'missing') return value.phone === null;
  return value.phoneState === 'recorded' && typeof value.phone === 'string' && value.phone.trim().length > 0;
}

export function isPreschoolStudentGuardianReadPage(
  value: unknown,
  expectedStudentId?: string,
): value is PreschoolStudentGuardianReadPage {
  if (!isRecord(value) || !hasOnlyKeys(value, PAGE_KEYS)
    || !isUuid(value.studentId) || !isUuid(value.studentPartyId)
    || (expectedStudentId !== undefined && value.studentId.toLowerCase() !== expectedStudentId.toLowerCase())
    || !isCalendarDate(value.asOfDate)
    || value.complete !== true
    || typeof value.guardianCount !== 'number' || !Number.isSafeInteger(value.guardianCount)
    || value.guardianCount < 0 || value.guardianCount > 50
    || !Array.isArray(value.guardians) || value.guardians.length !== value.guardianCount
    || !value.guardians.every(isGuardian)) return false;

  const guardianIds = new Set<string>();
  const relationshipIds = new Set<string>();
  for (const guardian of value.guardians) {
    if (guardianIds.has(guardian.guardianPartyId.toLowerCase())) return false;
    guardianIds.add(guardian.guardianPartyId.toLowerCase());
    for (const relationship of guardian.relationships) {
      if ((relationship.activeFrom !== null && relationship.activeFrom > value.asOfDate)
        || (relationship.activeTo !== null && relationship.activeTo < value.asOfDate)) return false;
      if (relationshipIds.has(relationship.id.toLowerCase())) return false;
      relationshipIds.add(relationship.id.toLowerCase());
    }
  }
  return true;
}

export type PreschoolGuardianRead = (studentId: string) => Promise<{
  readonly data: unknown;
  readonly error: { readonly code?: string } | null;
}>;

export class PreschoolStudentGuardianReadService {
  constructor(private readonly readGuardians: PreschoolGuardianRead) {}

  async read(studentId: string): Promise<PreschoolStudentGuardianReadPage> {
    if (!isUuid(studentId)) {
      throw new PreschoolStudentGuardianReadError('INVALID_STUDENT_ID', 400);
    }
    const canonicalStudentId = studentId.toLowerCase();
    const result = await this.readGuardians(canonicalStudentId);
    if (result.error) {
      if (result.error.code === '42501') {
        throw new PreschoolStudentGuardianReadError('STUDENT_GUARDIAN_ACCESS_DENIED', 403);
      }
      throw new PreschoolStudentGuardianReadError('STUDENT_GUARDIANS_UNAVAILABLE', 503);
    }
    if (!isPreschoolStudentGuardianReadPage(result.data, canonicalStudentId)) {
      throw new PreschoolStudentGuardianReadError('STUDENT_GUARDIANS_UNAVAILABLE', 503);
    }
    return result.data;
  }
}
