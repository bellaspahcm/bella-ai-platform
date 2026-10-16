/**
 * E2E Test Fixtures for Phase 3C
 * 
 * Reusable test data and setup utilities for end-to-end Runtime testing.
 * 
 * @see BELLA_RUNTIME_PHASE_3C_TEST_PLAN.md
 */

import type { FinancialIntent } from '../../src/platform/integration-runtime/types/financial-intent.types';

export interface E2ETenant {
  tenantId: string;
  tenantName: string;
  userId: string;
}

/**
 * Test tenants for Phase 3C isolation
 */
export const E2E_TENANTS = {
  TENANT_A: {
    tenantId: 'test-e2e-tenant-a',
    tenantName: 'E2E Test Tenant A',
    userId: '1176579a-50cc-48b2-800f-5bd5f24d6288',  // ✅ Real auth.users UUID
  } as E2ETenant,
  
  TENANT_B: {
    tenantId: 'test-e2e-tenant-b',
    tenantName: 'E2E Test Tenant B',
    userId: '40ef93da-3381-4b16-a30e-eed7072bce72',  // ✅ Real auth.users UUID
  } as E2ETenant,
  
  TENANT_ATTACKER: {
    tenantId: 'test-e2e-tenant-attacker',
    tenantName: 'E2E Test Attacker',
    userId: '73a1837f-4970-4c27-939f-ef7a4ee864ed',  // ✅ Real auth.users UUID
  } as E2ETenant,
} as const;

/**
 * Generate test Financial Intent
 * 
 * @param overrides - Partial intent to override defaults
 * @returns Complete Financial Intent for testing
 */
export function createTestIntent(
  overrides: Partial<FinancialIntent> = {}
): FinancialIntent {
  const timestamp = new Date().toISOString();
  const random = Math.random().toString(36).substr(2, 9);
  
  return {
    intentType: 'REVENUE_RECOGNIZED',
    tenantId: E2E_TENANTS.TENANT_A.tenantId,
    correlationId: `test-corr-${random}`,
    amount: 1000.00,
    currency: 'USD',
    effectiveDate: new Date(),
    source: 'E2E Test',
    entityType: 'Hospital',
    entityId: `hospital-${random}`,
    metadata: {
      source: 'E2E Test',
      testRun: timestamp,
    },
    ...overrides,
  };
}

/**
 * Healthcare-specific intent fixtures
 */
export const HEALTHCARE_INTENTS = {
  /**
   * Patient service revenue recognition
   */
  PATIENT_REVENUE: (tenantId: string, amount = 500.00): FinancialIntent => ({
    intentType: 'REVENUE_RECOGNIZED',
    tenantId,
    correlationId: `hc-patient-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    amount,
    currency: 'USD',
    effectiveDate: new Date(),
    source: 'E2E Test',
    entityType: 'Patient',
    entityId: `patient-${Math.random().toString(36).substr(2, 9)}`,
    metadata: {
      serviceType: 'Consultation',
      departmentId: 'dept-cardiology',
      providerId: 'dr-smith-001',
    },
  }),

  /**
   * Insurance claim payment
   */
  INSURANCE_PAYMENT: (tenantId: string, amount = 1500.00): FinancialIntent => ({
    intentType: 'PAYMENT_RECEIVED',
    tenantId,
    correlationId: `hc-insurance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    amount,
    currency: 'USD',
    effectiveDate: new Date(),
    source: 'E2E Test',
    entityType: 'Insurance',
    entityId: `insurance-${Math.random().toString(36).substr(2, 9)}`,
    metadata: {
      claimId: `claim-${Math.random().toString(36).substr(2, 9)}`,
      payerId: 'insurance-co-001',
    },
  }),

  /**
   * Pharmacy inventory expense
   */
  PHARMACY_EXPENSE: (tenantId: string, amount = 250.00): FinancialIntent => ({
    intentType: 'EXPENSE_INCURRED',
    tenantId,
    correlationId: `hc-pharmacy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    amount,
    currency: 'USD',
    effectiveDate: new Date(),
    source: 'E2E Test',
    entityType: 'Pharmacy',
    entityId: `pharmacy-${Math.random().toString(36).substr(2, 9)}`,
    metadata: {
      medicationId: 'med-aspirin-100mg',
      quantity: 100,
      supplierId: 'supplier-pharma-001',
    },
  }),
} as const;

/**
 * Education-specific intent fixtures
 */
export const EDUCATION_INTENTS = {
  /**
   * Student tuition payment
   */
  TUITION_PAYMENT: (tenantId: string, amount = 5000.00): FinancialIntent => ({
    intentType: 'PAYMENT_RECEIVED',
    tenantId,
    correlationId: `edu-tuition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    amount,
    currency: 'USD',
    effectiveDate: new Date(),
    source: 'E2E Test',
    entityType: 'Student',
    entityId: `student-${Math.random().toString(36).substr(2, 9)}`,
    metadata: {
      academicYear: '2026-2027',
      semester: 'Fall 2026',
      programId: 'program-cs-undergrad',
    },
  }),

  /**
   * Scholarship grant
   */
  SCHOLARSHIP_GRANT: (tenantId: string, amount = 2000.00): FinancialIntent => ({
    intentType: 'GRANT_AWARDED',
    tenantId,
    correlationId: `edu-scholarship-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    amount,
    currency: 'USD',
    effectiveDate: new Date(),
    source: 'E2E Test',
    entityType: 'Student',
    entityId: `student-${Math.random().toString(36).substr(2, 9)}`,
    metadata: {
      scholarshipType: 'Merit-based',
      fundId: 'fund-alumni-001',
    },
  }),
} as const;

/**
 * Invalid intent fixtures for validation testing (3C-4)
 */
export const INVALID_INTENTS = {
  /**
   * Missing required field: tenantId
   */
  MISSING_TENANT: (): Partial<FinancialIntent> => ({
    intentType: 'REVENUE_RECOGNIZED',
    // tenantId missing
    correlationId: `invalid-${Date.now()}`,
    amount: 100.00,
    currency: 'USD',
    effectiveDate: new Date(),
    source: 'E2E Test',
    entityType: 'Test',
    entityId: 'test-001',
  }),

  /**
   * Invalid amount (negative)
   */
  NEGATIVE_AMOUNT: (tenantId: string): FinancialIntent => ({
    intentType: 'REVENUE_RECOGNIZED',
    tenantId,
    correlationId: `invalid-${Date.now()}`,
    amount: -100.00, // Invalid: negative
    currency: 'USD',
    effectiveDate: new Date(),
    source: 'E2E Test',
    entityType: 'Test',
    entityId: 'test-001',
  }),

  /**
   * Invalid currency code
   */
  INVALID_CURRENCY: (tenantId: string): FinancialIntent => ({
    intentType: 'REVENUE_RECOGNIZED',
    tenantId,
    correlationId: `invalid-${Date.now()}`,
    amount: 100.00,
    currency: 'INVALID', // Invalid: not 3-letter ISO code
    effectiveDate: new Date(),
    source: 'E2E Test',
    entityType: 'Test',
    entityId: 'test-001',
  }),

  /**
   * Invalid date format
   */
  INVALID_DATE: (tenantId: string): Record<string, unknown> => ({
    intentType: 'REVENUE_RECOGNIZED',
    tenantId,
    correlationId: `invalid-${Date.now()}`,
    amount: 100.00,
    currency: 'USD',
    effectiveDate: 'not-a-date', // Deliberately malformed raw input
    source: 'E2E Test',
    entityType: 'Test',
    entityId: 'test-001',
  }),

  /**
   * SQL injection attempt in entityId
   */
  SQL_INJECTION: (tenantId: string): FinancialIntent => ({
    intentType: 'REVENUE_RECOGNIZED',
    tenantId,
    correlationId: `invalid-${Date.now()}`,
    amount: 100.00,
    currency: 'USD',
    effectiveDate: new Date(),
    source: 'E2E Test',
    entityType: 'Test',
    entityId: "'; DROP TABLE runtime_outbox; --",
  }),
} as const;

/**
 * Generate batch of intents for concurrency testing
 */
export function generateIntentBatch(
  count: number,
  tenantId: string,
  baseIntent: Partial<FinancialIntent> = {}
): FinancialIntent[] {
  return Array.from({ length: count }, (_, i) =>
    createTestIntent({
      tenantId,
      correlationId: `batch-${Date.now()}-${i}`,
      amount: 100.00 * (i + 1),
      ...baseIntent,
    })
  );
}

/**
 * Wait utility for async tests
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry utility for eventual consistency checks
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 10,
    delayMs = 100,
    timeoutMs = 5000,
  } = options;

  const startTime = Date.now();
  let attempts = 0;

  while (attempts < maxAttempts) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`retryUntil timeout after ${timeoutMs}ms`);
    }

    const result = await fn();
    
    if (predicate(result)) {
      return result;
    }

    attempts++;
    await wait(delayMs);
  }

  throw new Error(`retryUntil failed after ${maxAttempts} attempts`);
}
