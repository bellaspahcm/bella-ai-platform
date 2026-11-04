/**
 * Finance OS F2.2 — Cash Projection Worker
 *
 * Consumes persisted F2 v2 outbox events through the shared SQL projection
 * command. It never derives legs or bank mappings from an event-bus payload.
 *
 * @module platform/finance/engines/cash-engine/cash-projection-worker
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { eventBus } from '@/platform/host/event-bus';
import type {
  DomainEvent,
  FinanceTransactionPostedV2Payload,
  FinanceTransactionReversedV2Payload
} from '@/platform/host/event-bus/types';

function toJson(value: unknown): Json {
  const serialized: unknown = JSON.parse(JSON.stringify(value));
  return serialized as Json;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class CashProjectionWorker {
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * Starts the worker by subscribing to F1 transaction posted and reversed v2 events.
   * Returns an unsubscribe callback for clean shutdown.
   */
  public start(): () => void {
    if (this.unsubscribe) {
      return this.unsubscribe;
    }

    const unsubPost = eventBus.subscribe<FinanceTransactionPostedV2Payload>(
      'finance.transaction.posted.v2',
      async (event) => this.handleEventSafe(event, (ev) => this.handlePostedV2(ev))
    );

    const unsubRev = eventBus.subscribe<FinanceTransactionReversedV2Payload>(
      'finance.transaction.reversed.v2',
      async (event) => this.handleEventSafe(event, (ev) => this.handleReversedV2(ev))
    );

    this.unsubscribe = () => {
      unsubPost();
      unsubRev();
      this.unsubscribe = null;
    };

    return this.unsubscribe;
  }

  /** Existing public classifier retained for callers; projection authority is in SQL. */
  public classifyLiquidityAccount(accountCode: string): boolean {
    return accountCode.startsWith('11');
  }

  /**
   * Routes terminal integrity failures to the existing quarantine boundary and
   * lets transient infrastructure errors propagate for normal outbox retry.
   */
  private async handleEventSafe<T extends {
    tenant_id: string;
    transaction_id: string;
    event_id: string;
  }>(
    event: DomainEvent<T>,
    handler: (event: DomainEvent<T>) => Promise<void>
  ): Promise<void> {
    try {
      await handler(event);
    } catch (err: unknown) {
      const error = err as Error & { code?: string; isTerminal?: boolean; failureCode?: string };
      const isTerminal = error.isTerminal || this.isPgTerminalError(error.code);

      if (!isTerminal) {
        console.error(
          `[CASH_PROJECTION_WORKER_TRANSIENT] Retryable exception encountered: ${error.message} [Event: ${event.eventId}]. Rethrowing...`
        );
        throw error;
      }

      const failureCode = error.failureCode || error.code || 'TERMINAL_ERROR';
      const failureReason = error.message || 'Unknown terminal failure';
      if (
        failureCode === 'SECURITY_TENANT_MISMATCH' ||
        failureCode === 'F2020' ||
        failureCode === 'F2001' ||
        failureCode === 'SECURITY_INTEGRITY_VIOLATION' ||
        failureCode.startsWith('F204')
      ) {
        console.error(
          `[SECURITY_AUDIT_SIGNAL] Terminal security integrity violation detected: ${failureReason} [Event: ${event.eventId}, Tenant: ${event.tenantId}, F1-Tx: ${event.payload.transaction_id}]`
        );
      } else {
        console.error(
          `[CASH_PROJECTION_WORKER_TERMINAL] Event quarantined: ${failureReason} [Event: ${event.eventId}]`
        );
      }

      await this.quarantineEvent(
        event.payload.tenant_id,
        event.payload.event_id,
        event.eventType,
        event.payload as unknown as Record<string, unknown>,
        failureReason,
        failureCode
      );
    }
  }

  private isPgTerminalError(code?: string): boolean {
    if (!code) return false;
    return (
      code.startsWith('22') ||
      code.startsWith('23') ||
      code.startsWith('F2') ||
      code.startsWith('A0') ||
      code.startsWith('T0') ||
      code.startsWith('Q0')
    );
  }

  private async handlePostedV2(
    event: DomainEvent<FinanceTransactionPostedV2Payload>
  ): Promise<void> {
    const payload = event.payload;
    if (
      event.eventType !== 'finance.transaction.posted.v2' ||
      payload.event_type !== 'finance.transaction.posted.v2' ||
      !payload.tenant_id ||
      !payload.transaction_id ||
      !payload.event_id
    ) {
      throw this.createTerminalError('Posted v2 envelope is missing identity fields', 'ENVELOPE_INVALID');
    }

    if (payload.tenant_id !== event.tenantId) {
      throw this.createTerminalError(
        `Event tenant context mismatch: payload '${payload.tenant_id}' does not match context '${event.tenantId}'`,
        'SECURITY_TENANT_MISMATCH'
      );
    }

    await this.projectV2Event(
      payload.tenant_id,
      payload.event_id,
      payload.transaction_id,
      'finance.transaction.posted.v2'
    );
  }

  private async handleReversedV2(
    event: DomainEvent<FinanceTransactionReversedV2Payload>
  ): Promise<void> {
    const payload = event.payload;
    if (
      event.eventType !== 'finance.transaction.reversed.v2' ||
      payload.event_type !== 'finance.transaction.reversed.v2' ||
      !payload.tenant_id ||
      !payload.transaction_id ||
      !payload.event_id ||
      !payload.reversal_of_transaction_id
    ) {
      throw this.createTerminalError('Reversed v2 envelope is missing identity fields', 'ENVELOPE_INVALID');
    }

    if (payload.tenant_id !== event.tenantId) {
      throw this.createTerminalError(
        `Reversal tenant context mismatch: payload '${payload.tenant_id}' does not match context '${event.tenantId}'`,
        'SECURITY_TENANT_MISMATCH'
      );
    }

    await this.projectV2Event(
      payload.tenant_id,
      payload.event_id,
      payload.transaction_id,
      'finance.transaction.reversed.v2'
    );
  }

  /** Shared command used by synchronous Admission and post-commit worker replay. */
  private async projectV2Event(
    tenantId: string,
    eventId: string,
    transactionId: string,
    eventType: 'finance.transaction.posted.v2' | 'finance.transaction.reversed.v2'
  ): Promise<void> {
    const { data, error } = await this.client.rpc('finance_f2_project_v2_event', {
      p_tenant_id: tenantId,
      p_event_id: eventId
    });

    if (error) {
      throw error;
    }

    if (
      !isObjectRecord(data) ||
      data.success !== true ||
      data.event_id !== eventId ||
      data.event_type !== eventType ||
      data.transaction_id !== transactionId
    ) {
      throw this.createTerminalError(
        'Shared F2 projection command returned an invalid result for the persisted event',
        'PROJECTION_RPC_FAILED'
      );
    }
  }

  private async quarantineEvent(
    tenantId: string,
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    failureReason: string,
    failureCode: string
  ): Promise<void> {
    const { error } = await this.client.rpc('finance_internal_quarantine_cash_event', {
      p_tenant_id: tenantId,
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: toJson(payload),
      p_failure_reason: failureReason,
      p_failure_code: failureCode
    });

    if (error) {
      console.error(
        `[CRITICAL_FALLTHROUGH_QUARANTINE_FAILED] Failed to record event quarantine in DB: ${error.message} [Event: ${eventId}]`
      );
    }
  }

  private createTerminalError(
    message: string,
    failureCode: string
  ): Error & { isTerminal: boolean; failureCode: string } {
    const error = new Error(message) as Error & { isTerminal: boolean; failureCode: string };
    error.isTerminal = true;
    error.failureCode = failureCode;
    return error;
  }
}
