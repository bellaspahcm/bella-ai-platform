import { describe, expect, it } from '@jest/globals';
import { parseFeeProgramResolution } from '../fee-program.contract';

describe('Fee Program resolver contract', () => {
  it.each([
    'NOT_FOUND',
    'NOT_PUBLISHED',
    'NOT_EFFECTIVE',
    'AMBIGUOUS',
    'INVALID_ENROLLMENT_REFERENCE',
    'POLICY_NOT_DEFINED',
  ] as const)('preserves fail-closed resolver outcome %s', (outcome) => {
    expect(parseFeeProgramResolution({ outcome })).toEqual({ outcome });
  });

  it('rejects a RESOLVED payload unless every reconstructable result field is present as an object', () => {
    expect(() => parseFeeProgramResolution({ outcome: 'RESOLVED' })).toThrow('FEE_PROGRAM_RESOLVER_INVALID_RESPONSE');
    expect(() => parseFeeProgramResolution({
      outcome: 'RESOLVED', tenantId: 'tenant-a', enrollmentId: 'enrollment-a', feeProgramVersionId: 'program-v1',
      feeItemVersionIds: [], billingPeriodPolicyVersionId: 'policy-v1', servicePeriod: null,
      dueDateDecision: {}, effectiveDateDecision: {}, sourceProvenance: {}, economicFacts: {},
    })).toThrow('FEE_PROGRAM_RESOLVER_INVALID_RESPONSE');
  });

  it('rejects unknown outcomes and malformed failure payloads', () => {
    expect(() => parseFeeProgramResolution({ outcome: 'MAYBE' })).toThrow('FEE_PROGRAM_RESOLVER_INVALID_RESPONSE');
    expect(() => parseFeeProgramResolution(null)).toThrow('FEE_PROGRAM_RESOLVER_INVALID_RESPONSE');
  });
});
