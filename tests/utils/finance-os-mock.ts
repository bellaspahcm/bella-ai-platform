/**
 * Finance OS Mock for Phase 3C E2E Testing
 * 
 * Simulates Finance OS boundary behavior for testing Runtime emission logic.
 * 
 * Critical Boundary (Amendment 4 & 5):
 * - Runtime emits Financial Intent (domain event)
 * - Finance OS receives intent and produces accounting entries
 * - Mock validates intent structure, does NOT simulate accounting logic
 * 
 * @see F5_6_C2_ACCOUNTING_INTENT_BOUNDARY.md
 * @see BELLA_RUNTIME_PHASE_3C_TEST_PLAN.md (Test Category 3C-9)
 */

import type { FinancialIntent } from '../../src/platform/integration-runtime/types/financial-intent.types';

export type MockFinanceOSResponse = 
  | { status: 'accepted'; transactionId: string }
  | { status: 'rejected'; reason: string; errorCode: string }
  | { status: 'timeout' };

export interface FinanceOSMockConfig {
  responseMode?: 'accept' | 'reject' | 'timeout' | 'custom';
  responseDelayMs?: number;
  customResponse?: MockFinanceOSResponse;
  rejectReason?: string;
  rejectErrorCode?: string;
}

export interface EmissionRecord {
  intent: FinancialIntent;
  timestamp: Date;
  response: MockFinanceOSResponse;
}

/**
 * In-memory Finance OS mock for testing Runtime emission
 * 
 * Capabilities:
 * - Accept/reject intents based on configuration
 * - Simulate network timeouts
 * - Track all received emissions for verification
 * - Validate intent structure (not financial semantics)
 */
export class FinanceOSMock {
  private emissionHistory: EmissionRecord[] = [];
  private config: Required<FinanceOSMockConfig>;

  constructor(config: FinanceOSMockConfig = {}) {
    this.config = {
      responseMode: config.responseMode || 'accept',
      responseDelayMs: config.responseDelayMs || 0,
      customResponse: config.customResponse || { status: 'accepted', transactionId: 'mock-tx-001' },
      rejectReason: config.rejectReason || 'Mock rejection',
      rejectErrorCode: config.rejectErrorCode || 'MOCK_ERROR',
    };
  }

  /**
   * Emit Financial Intent to mock Finance OS
   * 
   * Validates intent structure and returns response based on configuration.
   * 
   * @param intent - Financial Intent to emit
   * @returns Mock Finance OS response
   */
  async emitIntent(intent: FinancialIntent): Promise<MockFinanceOSResponse> {
    // Validate intent structure (NOT financial semantics)
    this.validateIntentStructure(intent);

    // Simulate network delay
    if (this.config.responseDelayMs > 0) {
      await this.delay(this.config.responseDelayMs);
    }

    // Generate response based on mode
    let response: MockFinanceOSResponse;

    switch (this.config.responseMode) {
      case 'accept':
        response = {
          status: 'accepted',
          transactionId: `mock-tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        break;

      case 'reject':
        response = {
          status: 'rejected',
          reason: this.config.rejectReason,
          errorCode: this.config.rejectErrorCode,
        };
        break;

      case 'timeout':
        response = { status: 'timeout' };
        break;

      case 'custom':
        response = this.config.customResponse;
        break;

      default:
        throw new Error(`Unknown response mode: ${this.config.responseMode}`);
    }

    // Record emission for verification
    this.emissionHistory.push({
      intent,
      timestamp: new Date(),
      response,
    });

    return response;
  }

  /**
   * Validate intent structure (schema validation only, not business rules)
   * 
   * Finance OS would perform full validation, but mock only checks structure
   * to avoid duplicating Finance OS domain logic in Runtime tests.
   */
  private validateIntentStructure(intent: FinancialIntent): void {
    const required = ['intentType', 'tenantId', 'correlationId', 'amount', 'currency', 'effectiveDate'];
    
    for (const field of required) {
      if (!(field in intent)) {
        throw new Error(`Invalid intent structure: missing required field '${field}'`);
      }
    }

    if (typeof intent.amount !== 'number') {
      throw new Error('Invalid intent structure: amount must be a number');
    }

    if (intent.amount <= 0) {
      throw new Error('Invalid intent structure: amount must be positive');
    }

    if (typeof intent.currency !== 'string' || intent.currency.length !== 3) {
      throw new Error('Invalid intent structure: currency must be 3-letter ISO code');
    }
  }

  /**
   * Configure mock behavior dynamically during tests
   */
  setConfig(config: Partial<FinanceOSMockConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get all emitted intents for verification
   */
  getEmissionHistory(): EmissionRecord[] {
    return [...this.emissionHistory];
  }

  /**
   * Get emissions filtered by tenant
   */
  getEmissionsByTenant(tenantId: string): EmissionRecord[] {
    return this.emissionHistory.filter((record) => record.intent.tenantId === tenantId);
  }

  /**
   * Get emissions filtered by correlation ID
   */
  getEmissionsByCorrelationId(correlationId: string): EmissionRecord[] {
    return this.emissionHistory.filter((record) => record.intent.correlationId === correlationId);
  }

  /**
   * Count total emissions
   */
  getEmissionCount(): number {
    return this.emissionHistory.length;
  }

  /**
   * Check if specific intent was emitted (for idempotency verification)
   */
  wasIntentEmitted(correlationId: string, tenantId: string): boolean {
    return this.emissionHistory.some(
      (record) =>
        record.intent.correlationId === correlationId &&
        record.intent.tenantId === tenantId
    );
  }

  /**
   * Clear emission history (for test isolation)
   */
  clearHistory(): void {
    this.emissionHistory = [];
  }

  /**
   * Reset mock to default configuration
   */
  reset(): void {
    this.emissionHistory = [];
    this.config = {
      responseMode: 'accept',
      responseDelayMs: 0,
      customResponse: { status: 'accepted', transactionId: 'mock-tx-001' },
      rejectReason: 'Mock rejection',
      rejectErrorCode: 'MOCK_ERROR',
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for shared mock across tests
 * 
 * Usage pattern:
 * ```typescript
 * beforeEach(() => {
 *   financeOSMock.reset();
 * });
 * 
 * test('should emit intent', async () => {
 *   await runtime.submitIntent(intent);
 *   expect(financeOSMock.getEmissionCount()).toBe(1);
 * });
 * ```
 */
export const financeOSMock = new FinanceOSMock();
