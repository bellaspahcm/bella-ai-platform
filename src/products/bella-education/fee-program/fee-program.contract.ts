import type { Json } from '@/types/database.types';

export type FeeProgramResolutionOutcome =
  | 'RESOLVED'
  | 'NOT_FOUND'
  | 'NOT_PUBLISHED'
  | 'NOT_EFFECTIVE'
  | 'AMBIGUOUS'
  | 'INVALID_ENROLLMENT_REFERENCE'
  | 'POLICY_NOT_DEFINED';

export interface FeeProgramResolveRequest {
  readonly enrollmentId: string;
  readonly effectiveDateContext: Readonly<Record<string, Json | undefined>>;
  readonly servicePeriodContext: Readonly<Record<string, Json | undefined>>;
  readonly requestedFeeItemVersionIds: readonly string[];
}

export interface FeeProgramResolutionFailure {
  readonly outcome: Exclude<FeeProgramResolutionOutcome, 'RESOLVED'>;
  readonly reasonCode?: string;
}

export interface FeeProgramResolvedResult {
  readonly outcome: 'RESOLVED';
  readonly tenantId: string;
  readonly enrollmentId: string;
  readonly feeProgramVersionId: string;
  readonly feeItemVersionIds: readonly string[];
  readonly billingPeriodPolicyVersionId: string;
  readonly servicePeriod: Json;
  readonly dueDateDecision: Json;
  readonly effectiveDateDecision: Json;
  readonly sourceProvenance: Json;
  readonly economicFacts: Json;
}

export type FeeProgramResolution = FeeProgramResolutionFailure | FeeProgramResolvedResult;

const outcomes: readonly FeeProgramResolutionOutcome[] = [
  'RESOLVED',
  'NOT_FOUND',
  'NOT_PUBLISHED',
  'NOT_EFFECTIVE',
  'AMBIGUOUS',
  'INVALID_ENROLLMENT_REFERENCE',
  'POLICY_NOT_DEFINED',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isJson(value: unknown): value is Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (isRecord(value)) return Object.values(value).every(isJson);
  return false;
}

function isJsonObject(value: unknown): value is Readonly<Record<string, Json | undefined>> {
  return isRecord(value) && Object.values(value).every(isJson);
}

export function parseFeeProgramResolution(value: unknown): FeeProgramResolution {
  if (!isRecord(value) || typeof value.outcome !== 'string'
    || !outcomes.includes(value.outcome as FeeProgramResolutionOutcome)) {
    throw new Error('FEE_PROGRAM_RESOLVER_INVALID_RESPONSE');
  }

  if (value.outcome !== 'RESOLVED') {
    const result: FeeProgramResolutionFailure = {
      outcome: value.outcome as FeeProgramResolutionFailure['outcome'],
      ...(typeof value.reasonCode === 'string' ? { reasonCode: value.reasonCode } : {}),
    };
    return result;
  }

  if (typeof value.tenantId !== 'string'
    || typeof value.enrollmentId !== 'string'
    || typeof value.feeProgramVersionId !== 'string'
    || !isStringArray(value.feeItemVersionIds)
    || typeof value.billingPeriodPolicyVersionId !== 'string'
    || !isJsonObject(value.servicePeriod)
    || !isJsonObject(value.dueDateDecision)
    || !isJsonObject(value.effectiveDateDecision)
    || !isJsonObject(value.sourceProvenance)
    || !isJsonObject(value.economicFacts)) {
    throw new Error('FEE_PROGRAM_RESOLVER_INVALID_RESPONSE');
  }

  return {
    outcome: 'RESOLVED',
    tenantId: value.tenantId,
    enrollmentId: value.enrollmentId,
    feeProgramVersionId: value.feeProgramVersionId,
    feeItemVersionIds: value.feeItemVersionIds,
    billingPeriodPolicyVersionId: value.billingPeriodPolicyVersionId,
    servicePeriod: value.servicePeriod,
    dueDateDecision: value.dueDateDecision,
    effectiveDateDecision: value.effectiveDateDecision,
    sourceProvenance: value.sourceProvenance,
    economicFacts: value.economicFacts,
  };
}
