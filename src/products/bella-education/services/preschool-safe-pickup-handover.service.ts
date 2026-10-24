import type { SupabaseClient } from '@supabase/supabase-js';

type BellaEducationClient = SupabaseClient;

interface HandoverEventRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly student_party_id: string;
  readonly guardian_party_id: string;
  readonly pickup_authorization_id: string;
  readonly handed_over_at: string;
  readonly handed_over_by: string;
  readonly created_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasStringField(value: Record<string, unknown>, field: keyof HandoverEventRow): boolean {
  return typeof value[field] === 'string';
}

function isHandoverEventRow(value: unknown): value is HandoverEventRow {
  if (!isRecord(value)) return false;

  return (
    hasStringField(value, 'id')
    && hasStringField(value, 'tenant_id')
    && hasStringField(value, 'student_party_id')
    && hasStringField(value, 'guardian_party_id')
    && hasStringField(value, 'pickup_authorization_id')
    && hasStringField(value, 'handed_over_at')
    && hasStringField(value, 'handed_over_by')
    && hasStringField(value, 'created_at')
  );
}

export interface RecordPreschoolHandoverInput {
  readonly tenantId: string;
  readonly studentPartyId: string;
  readonly guardianPartyId: string;
  readonly pickupAuthorizationId: string;
  readonly operatorUserId: string;
}

export type PreschoolHandoverCommand = (input: RecordPreschoolHandoverInput) => PromiseLike<{
  data: unknown;
  error: { code?: string; message: string } | null;
}>;

export interface PreschoolHandoverDTO {
  readonly id: string;
  readonly tenantId: string;
  readonly studentPartyId: string;
  readonly guardianPartyId: string;
  readonly pickupAuthorizationId: string;
  readonly handedOverAt: string;
  readonly handedOverBy: string;
}

export class PreschoolHandoverError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = 'PreschoolHandoverError';
  }
}

export class PreschoolSafePickupHandoverService {
  constructor(
    private readonly supabase: BellaEducationClient,
    private readonly command?: PreschoolHandoverCommand,
  ) {}

  async recordHandover(input: RecordPreschoolHandoverInput): Promise<PreschoolHandoverDTO> {
    // The Product command serializes creation/recovery and rechecks current
    // authorization after DB waits. Never fall back to a direct table insert.
    if (!this.command) throw new Error('PRESCHOOL_HANDOVER_COMMAND_REQUIRED');
    const { data, error } = await this.command(input);
    if (error) {
      const status = error.code === '42501' ? 403
        : error.code === '23505' || error.code === '40001' ? 409
          : error.code === '22023' ? 400 : null;
      if (status !== null) {
        throw new PreschoolHandoverError(error.message, status);
      }
      throw new Error(`Failed to record Preschool handover [${error.code ?? 'UNKNOWN'}]`);
    }
    const row: unknown = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (!isHandoverEventRow(row) || !row.id
      || row.tenant_id !== input.tenantId || row.student_party_id !== input.studentPartyId
      || row.guardian_party_id !== input.guardianPartyId
      || row.pickup_authorization_id !== input.pickupAuthorizationId
      || !Number.isFinite(Date.parse(row.handed_over_at)) || !row.handed_over_by) {
      throw new Error('PRESCHOOL_HANDOVER_CANONICAL_READBACK_INVALID');
    }
    return this.toDTO(row);
  }

  async getLatestHandovers(
    tenantId: string,
    studentPartyIds: readonly string[],
  ): Promise<Map<string, PreschoolHandoverDTO>> {
    const uniqueStudentPartyIds = [...new Set(studentPartyIds)].filter(Boolean);
    const handoversByStudent = new Map<string, PreschoolHandoverDTO>();

    if (uniqueStudentPartyIds.length === 0) {
      return handoversByStudent;
    }

    const { data, error } = await this.supabase
      .from('edu_preschool_pickup_handover_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('student_party_id', uniqueStudentPartyIds)
      .order('handed_over_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load Preschool handovers: ${error.message}`);
    }

    const rows: unknown[] = Array.isArray(data) ? data : [];
    for (const row of rows) {
      if (!isHandoverEventRow(row)) {
        continue;
      }
      if (!handoversByStudent.has(row.student_party_id)) {
        handoversByStudent.set(row.student_party_id, this.toDTO(row));
      }
    }

    return handoversByStudent;
  }

  private toDTO(row: HandoverEventRow): PreschoolHandoverDTO {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      studentPartyId: row.student_party_id,
      guardianPartyId: row.guardian_party_id,
      pickupAuthorizationId: row.pickup_authorization_id,
      handedOverAt: row.handed_over_at,
      handedOverBy: row.handed_over_by,
    };
  }
}
