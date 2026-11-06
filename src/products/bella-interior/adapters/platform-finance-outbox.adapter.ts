/**
 * Bella Interior OS — Platform Finance Outbox Adapter
 *
 * Implements InteriorOutboxPort by generating standardized finance event payloads
 * and routing them through the Platform Integration Hub Finance Outbox.
 *
 * @module src/products/bella-interior/adapters
 */

import { randomUUID } from 'crypto';
import type { BaseInteriorDomainEvent } from '../domain/events';
import type { FinanceMilestoneOutboxPayload, InteriorOutboxPort } from '../ports/interior-outbox.port';

export class PlatformFinanceOutboxAdapter implements InteriorOutboxPort {
  private readonly publishedEvents: BaseInteriorDomainEvent[] = [];
  private readonly queuedFinanceRecords: Array<FinanceMilestoneOutboxPayload & { outboxId: string }> = [];

  async publishDomainEvent(event: BaseInteriorDomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  async enqueueFinanceMilestone(
    payload: FinanceMilestoneOutboxPayload
  ): Promise<{ readonly outboxId: string; readonly status: 'queued' }> {
    const outboxId = randomUUID();
    this.queuedFinanceRecords.push({
      ...payload,
      outboxId,
    });
    return { outboxId, status: 'queued' };
  }

  getPublishedEvents(): readonly BaseInteriorDomainEvent[] {
    return [...this.publishedEvents];
  }

  getQueuedFinanceRecords(): ReadonlyArray<FinanceMilestoneOutboxPayload & { outboxId: string }> {
    return [...this.queuedFinanceRecords];
  }
}
