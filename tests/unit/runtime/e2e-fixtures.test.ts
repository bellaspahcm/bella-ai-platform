import { describe, expect, it } from 'vitest';
import { intentValidator } from '../../../src/platform/integration-runtime/validation/intent-validator';
import { createTestIntent, generateIntentBatch, HEALTHCARE_INTENTS, EDUCATION_INTENTS, INVALID_INTENTS } from '../../utils/e2e-fixtures';

describe('Runtime E2E fixture public contract', () => {
  const validCases = [
    ['default', () => createTestIntent()],
    ['patient', () => HEALTHCARE_INTENTS.PATIENT_REVENUE('fixture-tenant')],
    ['insurance', () => HEALTHCARE_INTENTS.INSURANCE_PAYMENT('fixture-tenant')],
    ['pharmacy', () => HEALTHCARE_INTENTS.PHARMACY_EXPENSE('fixture-tenant')],
    ['tuition', () => EDUCATION_INTENTS.TUITION_PAYMENT('fixture-tenant')],
    ['scholarship', () => EDUCATION_INTENTS.SCHOLARSHIP_GRANT('fixture-tenant')],
  ] as const;

  it.each(validCases)('%s fixture satisfies the public validator', (_name, create) => {
    const fixture = create();
    expect(fixture.effectiveDate).toBeInstanceOf(Date);
    expect(fixture.source).toBe('E2E Test');
    expect(intentValidator.validate(fixture)).toEqual(fixture);
  });

  it('preserves caller overrides for Date and source', () => {
    const effectiveDate = new Date('2026-01-15T00:00:00Z');
    const fixture = createTestIntent({ effectiveDate, source: 'fixture-producer' });
    expect(fixture.effectiveDate).toEqual(effectiveDate);
    expect(fixture.source).toBe('fixture-producer');
    expect(intentValidator.validate(fixture)).toEqual(fixture);
  });

  it('creates a batch with the supplied tenant and distinct correlations', () => {
    const fixtures = generateIntentBatch(3, 'fixture-tenant');
    expect(new Set(fixtures.map(fixture => fixture.correlationId)).size).toBe(3);
    for (const fixture of fixtures) {
      expect(fixture.tenantId).toBe('fixture-tenant');
      expect(intentValidator.validate(fixture)).toEqual(fixture);
    }
  });

  it.each([
    ['missing tenant', () => INVALID_INTENTS.MISSING_TENANT(), /tenantId/i],
    ['negative amount', () => INVALID_INTENTS.NEGATIVE_AMOUNT('fixture-tenant'), /amount/i],
    ['invalid currency', () => INVALID_INTENTS.INVALID_CURRENCY('fixture-tenant'), /currency/i],
    ['malformed date', () => INVALID_INTENTS.INVALID_DATE('fixture-tenant'), /effectiveDate/i],
  ] as const)('%s fixture stays invalid', (_name, create, field) => {
    expect(() => intentValidator.validate(create())).toThrow(field);
  });
});
