import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { IPickupAuthorizationContract } from '@/platform/party/pickup-authorization.contract';
import { PickupAuthorizationError } from '@/platform/party/pickup-authorization.contract';
import { PickupAuthorizationContractImpl } from '@/platform/party/pickup-authorization.contract.impl';
import { PreschoolChainError } from './preschool-chain.service';

const GUARDIAN_PHONE_IDENTIFIER_TYPE = 'preschool_guardian_phone';
const GUARDIAN_RELATIONSHIP_TYPE = 'guardian_of';
const AUTHORIZED_STATUS = 'authorized';

type BellaEducationClient = SupabaseClient<Database>;
type GuardianAuthorizationRow = Database['public']['Tables']['edu_preschool_pickup_authorizations']['Row'];

export interface EstablishGuardianAuthorizationInput {
  readonly tenantId: string;
  readonly studentPartyId: string;
  readonly guardianName: string;
  readonly guardianPhone: string;
  readonly actorId: string;
}

export interface AuthorizedGuardianDTO {
  readonly authorizationId: string;
  readonly studentPartyId: string;
  readonly guardianPartyId: string;
  readonly displayName: string;
  readonly phone: string;
  readonly status: 'authorized';
}

export interface GuardianAuthorizationResult extends AuthorizedGuardianDTO {
  readonly normalizedPhone: string;
}

export function normalizePreschoolGuardianPhone(phone: string): string {
  const digits = phone.trim().replace(/\D/g, '');
  if (!digits) {
    throw new Error('GUARDIAN_PHONE_REQUIRED');
  }

  if (digits.startsWith('0084') && digits.length > 4) {
    return `0${digits.slice(4)}`;
  }

  if (digits.startsWith('84') && digits.length > 2) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}

export class PreschoolGuardianAuthorizationService {
  private readonly pickupAuthorizations: IPickupAuthorizationContract;

  constructor(private readonly supabase: BellaEducationClient, pickupAuthorizations?: IPickupAuthorizationContract) {
    this.pickupAuthorizations = pickupAuthorizations ?? new PickupAuthorizationContractImpl(supabase);
  }

  /** Durable admission supplies the identity from the atomic Party public contract. */
  async establishForCanonicalGuardian(input: EstablishGuardianAuthorizationInput & {
    readonly guardianPartyId: string;
  }): Promise<GuardianAuthorizationResult> {
    const normalizedPhone = normalizePreschoolGuardianPhone(input.guardianPhone);
    const { data: parties, error } = await this.supabase.from('party_parties')
      .select('id, display_name').eq('tenant_id', input.tenantId)
      .in('id', [input.studentPartyId, input.guardianPartyId])
      .eq('party_type', 'person').is('deleted_at', null);
    if (error) throw new Error(`Failed to verify canonical Guardian/Student: ${error.message}`);
    const guardian = parties?.find((party) => party.id === input.guardianPartyId);
    if (!guardian || !parties?.some((party) => party.id === input.studentPartyId)
      || input.guardianPartyId === input.studentPartyId
      || await this.findGuardianPartyIdByPhone(input.tenantId, normalizedPhone) !== input.guardianPartyId) {
      throw new PreschoolChainError('PRESCHOOL_GUARDIAN_CANONICAL_IDENTITY_CONFLICT');
    }
    const relationInput = { tenantId: input.tenantId, guardianPartyId: input.guardianPartyId, studentPartyId: input.studentPartyId };
    const { data: priorRelationship, error: relationshipError } = await this.supabase.from('party_relationships')
      .select('id, active_from, active_to').eq('tenant_id', input.tenantId)
      .eq('source_party_id', input.guardianPartyId).eq('target_party_id', input.studentPartyId)
      .eq('relationship_type', GUARDIAN_RELATIONSHIP_TYPE).maybeSingle();
    if (relationshipError) throw new Error(`Guardian relationship read failed: ${relationshipError.message}`);
    const today = new Date().toISOString().slice(0,10);
    if (priorRelationship && ((priorRelationship.active_from && priorRelationship.active_from>today)
      || (priorRelationship.active_to && priorRelationship.active_to<today))) {
      throw new PreschoolChainError('PRESCHOOL_GUARDIAN_RELATIONSHIP_NOT_ACTIVE',403);
    }
    if (!priorRelationship) await this.ensureGuardianRelationship(relationInput);
    let authorization;
    try {
      authorization = await this.pickupAuthorizations.authorizePickup({
        tenantId: input.tenantId, actorId: input.actorId, studentPartyId: input.studentPartyId,
        guardianPartyId: input.guardianPartyId, normalizedPhone,
      });
    } catch (error) {
      if (error instanceof PickupAuthorizationError) throw new PreschoolChainError(error.code, error.status);
      throw error;
    }
    if (authorization.tenant_id!==input.tenantId || authorization.student_party_id!==input.studentPartyId
      || authorization.guardian_party_id!==input.guardianPartyId || authorization.status!=='authorized') {
      throw new PreschoolChainError('PRESCHOOL_GUARDIAN_AUTHORIZATION_CANONICAL_CONFLICT');
    }
    return {
      authorizationId: authorization.id, studentPartyId: input.studentPartyId,
      guardianPartyId: input.guardianPartyId, displayName: guardian.display_name,
      phone: normalizedPhone, status: 'authorized', normalizedPhone,
    };
  }

  async establishForEnrollment(input: EstablishGuardianAuthorizationInput): Promise<GuardianAuthorizationResult> {
    const normalizedPhone = normalizePreschoolGuardianPhone(input.guardianPhone);
    const guardianPartyId = await this.resolveOrCreateGuardianParty({
      tenantId: input.tenantId,
      guardianName: input.guardianName,
      normalizedPhone,
      actorId: input.actorId,
    });

    await this.ensureGuardianRelationship({
      tenantId: input.tenantId,
      guardianPartyId,
      studentPartyId: input.studentPartyId,
    });

    const authorization = await this.ensurePickupAuthorization({
      tenantId: input.tenantId,
      guardianPartyId,
      studentPartyId: input.studentPartyId,
    });

    return {
      authorizationId: authorization.id,
      studentPartyId: authorization.student_party_id,
      guardianPartyId,
      displayName: input.guardianName,
      phone: normalizedPhone,
      status: 'authorized',
      normalizedPhone,
    };
  }

  async getAuthorizedGuardians(
    tenantId: string,
    studentPartyIds: readonly string[],
  ): Promise<Map<string, AuthorizedGuardianDTO[]>> {
    const uniqueStudentPartyIds = [...new Set(studentPartyIds)].filter(Boolean);
    const guardiansByStudent = new Map<string, AuthorizedGuardianDTO[]>();

    if (uniqueStudentPartyIds.length === 0) {
      return guardiansByStudent;
    }

    const { data: authorizations, error } = await this.supabase
      .from('edu_preschool_pickup_authorizations')
      .select('id, tenant_id, student_party_id, guardian_party_id, status')
      .eq('tenant_id', tenantId)
      .eq('status', AUTHORIZED_STATUS)
      .in('student_party_id', uniqueStudentPartyIds);

    if (error) {
      throw new Error(`Failed to load preschool pickup authorizations: ${error.message}`);
    }

    const activeAuthorizations = (authorizations ?? []).filter(
      (row): row is Pick<GuardianAuthorizationRow, 'id' | 'tenant_id' | 'student_party_id' | 'guardian_party_id' | 'status'> =>
        row.status === AUTHORIZED_STATUS,
    );

    if (activeAuthorizations.length === 0) {
      return guardiansByStudent;
    }

    const guardianPartyIds = [...new Set(activeAuthorizations.map((row) => row.guardian_party_id))];
    const [guardianParties, guardianPhones] = await Promise.all([
      this.loadGuardianParties(tenantId, guardianPartyIds),
      this.loadGuardianPhones(tenantId, guardianPartyIds),
    ]);

    for (const authorization of activeAuthorizations) {
      const party = guardianParties.get(authorization.guardian_party_id);
      if (!party) {
        continue;
      }

      const existing = guardiansByStudent.get(authorization.student_party_id) ?? [];
      existing.push({
        authorizationId: authorization.id,
        studentPartyId: authorization.student_party_id,
        guardianPartyId: authorization.guardian_party_id,
        displayName: party.displayName,
        phone: guardianPhones.get(authorization.guardian_party_id) ?? '',
        status: 'authorized',
      });
      guardiansByStudent.set(authorization.student_party_id, existing);
    }

    return guardiansByStudent;
  }

  private async resolveOrCreateGuardianParty(input: {
    readonly tenantId: string;
    readonly guardianName: string;
    readonly normalizedPhone: string;
    readonly actorId: string;
  }): Promise<string> {
    const existingPartyId = await this.findGuardianPartyIdByPhone(input.tenantId, input.normalizedPhone);
    if (existingPartyId) {
      return existingPartyId;
    }

    const { data: party, error: partyError } = await this.supabase
      .from('party_parties')
      .insert({
        tenant_id: input.tenantId,
        party_type: 'person',
        display_name: input.guardianName,
        legal_name: input.guardianName,
        created_by: this.toUuidOrNull(input.actorId),
        updated_by: this.toUuidOrNull(input.actorId),
      })
      .select('id')
      .single();

    if (partyError || !party) {
      throw new Error(partyError?.message || 'Failed to create canonical Guardian Party');
    }

    const { error: identifierError } = await this.supabase
      .from('party_identifiers')
      .insert({
        tenant_id: input.tenantId,
        party_id: party.id,
        identifier_type: GUARDIAN_PHONE_IDENTIFIER_TYPE,
        identifier_value: input.normalizedPhone,
      });

    if (identifierError) {
      if (identifierError.code === '23505') {
        const racedPartyId = await this.findGuardianPartyIdByPhone(input.tenantId, input.normalizedPhone);
        if (racedPartyId) {
          return racedPartyId;
        }
      }
      throw new Error(`Failed to persist Guardian Party phone identifier: ${identifierError.message}`);
    }

    return party.id;
  }

  private async findGuardianPartyIdByPhone(tenantId: string, normalizedPhone: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('party_identifiers')
      .select('party_id')
      .eq('tenant_id', tenantId)
      .eq('identifier_type', GUARDIAN_PHONE_IDENTIFIER_TYPE)
      .eq('identifier_value', normalizedPhone)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve Guardian Party by phone: ${error.message}`);
    }

    return data?.party_id ?? null;
  }

  private async ensureGuardianRelationship(input: {
    readonly tenantId: string;
    readonly guardianPartyId: string;
    readonly studentPartyId: string;
  }): Promise<void> {
    const { data: existing, error: readError } = await this.supabase
      .from('party_relationships')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('source_party_id', input.guardianPartyId)
      .eq('target_party_id', input.studentPartyId)
      .eq('relationship_type', GUARDIAN_RELATIONSHIP_TYPE)
      .maybeSingle();

    if (readError) {
      throw new Error(`Failed to read Guardian relationship: ${readError.message}`);
    }
    if (existing) {
      return;
    }

    const { error: insertError } = await this.supabase
      .from('party_relationships')
      .insert({
        tenant_id: input.tenantId,
        source_party_id: input.guardianPartyId,
        target_party_id: input.studentPartyId,
        relationship_type: GUARDIAN_RELATIONSHIP_TYPE,
        attributes: {},
      });

    if (insertError && insertError.code !== '23505') {
      throw new Error(`Failed to create Guardian relationship: ${insertError.message}`);
    }
  }

  private async ensurePickupAuthorization(input: {
    readonly tenantId: string;
    readonly guardianPartyId: string;
    readonly studentPartyId: string;
  }): Promise<GuardianAuthorizationRow> {
    const existing = await this.findActivePickupAuthorization(input);
    if (existing) {
      return existing;
    }

    const { data, error } = await this.supabase
      .from('edu_preschool_pickup_authorizations')
      .insert({
        tenant_id: input.tenantId,
        student_party_id: input.studentPartyId,
        guardian_party_id: input.guardianPartyId,
        status: AUTHORIZED_STATUS,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        const racedAuthorization = await this.findActivePickupAuthorization(input);
        if (racedAuthorization) {
          return racedAuthorization;
        }
      }
      throw new Error(`Failed to create Preschool pickup authorization: ${error.message}`);
    }
    if (!data) {
      throw new Error('Failed to read Preschool pickup authorization after insert');
    }

    return data;
  }

  private async findActivePickupAuthorization(input: {
    readonly tenantId: string;
    readonly guardianPartyId: string;
    readonly studentPartyId: string;
  }): Promise<GuardianAuthorizationRow | null> {
    const { data, error } = await this.supabase
      .from('edu_preschool_pickup_authorizations')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('student_party_id', input.studentPartyId)
      .eq('guardian_party_id', input.guardianPartyId)
      .eq('status', AUTHORIZED_STATUS)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read Preschool pickup authorization: ${error.message}`);
    }

    return data ?? null;
  }

  private async loadGuardianParties(
    tenantId: string,
    guardianPartyIds: readonly string[],
  ): Promise<Map<string, { displayName: string }>> {
    const { data, error } = await this.supabase
      .from('party_parties')
      .select('id, display_name')
      .eq('tenant_id', tenantId)
      .in('id', guardianPartyIds);

    if (error) {
      throw new Error(`Failed to load Guardian Parties: ${error.message}`);
    }

    return new Map((data ?? []).map((row) => [row.id, { displayName: row.display_name }]));
  }

  private async loadGuardianPhones(
    tenantId: string,
    guardianPartyIds: readonly string[],
  ): Promise<Map<string, string>> {
    const { data, error } = await this.supabase
      .from('party_identifiers')
      .select('party_id, identifier_value')
      .eq('tenant_id', tenantId)
      .eq('identifier_type', GUARDIAN_PHONE_IDENTIFIER_TYPE)
      .in('party_id', guardianPartyIds);

    if (error) {
      throw new Error(`Failed to load Guardian phone identifiers: ${error.message}`);
    }

    return new Map((data ?? []).map((row) => [row.party_id, row.identifier_value]));
  }

  private toUuidOrNull(value: string): string | null {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value)
      ? value
      : null;
  }
}
