/**
 * Bella Interior OS — Outbox Port
 *
 * Defines the contract for dispatching commercial milestones and financial integration
 * data into the Platform Finance Outbox without direct database access to Finance OS.
 *
 * @module src/products/bella-interior/ports
 */

import type { BaseInteriorDomainEvent } from '../domain/events';

export interface FinanceMilestoneOutboxPayload {
  readonly tenantId: string;
  readonly projectId: string;
  readonly contractId: string;
  readonly milestoneOrder: number;
  readonly milestoneName: string;
  readonly amount: number;
  readonly currency: string;
  readonly clientName: string;
  readonly occurredAt: string;
}

export interface InteriorOutboxPort {
  publishDomainEvent(event: BaseInteriorDomainEvent): Promise<void>;
  enqueueFinanceMilestone(payload: FinanceMilestoneOutboxPayload): Promise<{ readonly outboxId: string; readonly status: 'queued' }>;
}

