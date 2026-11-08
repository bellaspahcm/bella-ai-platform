/**
 * Bella Interior OS — Supabase Durable Finance Outbox Adapter
 *
 * Implements InteriorOutboxPort using public.interior_finance_outbox and the
 * enqueue_interior_finance_event PostgreSQL RPC function.
 *
 * Durability & Invariants:
 *   - Events are written to the database in the same transaction or persistent DB call
 *   - Idempotency enforced via UNIQUE (tenant_id, event_type, reference_type, reference_id)
 *   - Gracefully handles duplicate events by returning existing/idempotent status
 *
 * @module src/products/bella-interior/adapters
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BaseInteriorDomainEvent } from '../domain/events';
import type {
  FinanceMilestoneOutboxPayload,
  InteriorOutboxPort,
} from '../ports/interior-outbox.port';

interface RpcResponse {
  data: string | null;
  error: { code?: string; message: string } | null;
}

export class SupabaseInteriorFinanceOutboxAdapter implements InteriorOutboxPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async publishDomainEvent(event: BaseInteriorDomainEvent): Promise<void> {
    void event;
    throw new Error('INTERIOR_DOMAIN_EVENT_OUTBOX_NOT_CONFIGURED');
  }

  async enqueueFinanceMilestone(
    payload: FinanceMilestoneOutboxPayload,
  ): Promise<{ readonly outboxId: string; readonly status: 'queued' }> {
    const referenceId = `${payload.contractId}_m${payload.milestoneOrder}`;
    const eventType = 'INTERIOR_CONTRACT_MILESTONE_INVOICED';
    const referenceType = 'PAYMENT_MILESTONE';

    try {
      const response = (await this.supabase.rpc('enqueue_interior_finance_event', {
        p_tenant_id: payload.tenantId,
        p_event_type: eventType,
        p_reference_type: referenceType,
        p_reference_id: referenceId,
        p_payload: payload as unknown as Record<string, unknown>,
      })) as unknown as RpcResponse;

      if (response?.error) {
        if (response.error.code === '23505') {
          return { outboxId: `idempotent_${referenceId}`, status: 'queued' };
        }
        throw new Error(`[InteriorFinanceOutbox] Enqueue RPC failed: ${response.error.message}`);
      }

      // If RPC returned NULL, it means duplicate was skipped by ON CONFLICT DO NOTHING
      const outboxId = response?.data ?? `idempotent_${referenceId}`;
      return { outboxId, status: 'queued' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown persistence error';
      console.error('[InteriorFinanceOutbox] Outbox persistence failed');
      throw new Error(`[InteriorFinanceOutbox] Persistence failed: ${message}`);
    }
  }

  getPublishedEvents(): readonly BaseInteriorDomainEvent[] {
    return [];
  }
}

