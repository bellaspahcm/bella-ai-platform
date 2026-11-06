/**
 * Bella Interior OS — Domain Events
 *
 * Immutable domain event models for Interior OS.
 * Emitted ONLY after successful persistence (Event-After-Persistence).
 *
 * @module src/products/bella-interior/domain/events
 */

export interface BaseInteriorDomainEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly aggregateType: 'interior_project' | 'design_revision' | 'boq' | 'interior_contract' | 'production_order' | 'handover' | 'warranty';
  readonly aggregateId: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly actorName: string;
  readonly payload: Record<string, unknown>;
}

export interface DesignRevisionApprovedEvent extends BaseInteriorDomainEvent {
  readonly eventType: 'interior.design.revision_approved.v1';
  readonly payload: {
    readonly projectId: string;
    readonly revisionId: string;
    readonly versionNumber: number;
    readonly approvedBy: string;
  };
}

export interface ContractSignedEvent extends BaseInteriorDomainEvent {
  readonly eventType: 'interior.contract.signed.v1';
  readonly payload: {
    readonly projectId: string;
    readonly contractId: string;
    readonly contractValue: number;
    readonly clientName: string;
  };
}

export interface ProductionOrderReleasedEvent extends BaseInteriorDomainEvent {
  readonly eventType: 'interior.production.order_released.v1';
  readonly payload: {
    readonly projectId: string;
    readonly productionOrderId: string;
    readonly designRevisionId: string;
    readonly totalItems: number;
  };
}

export interface HandoverCompletedEvent extends BaseInteriorDomainEvent {
  readonly eventType: 'interior.delivery.handover_completed.v1';
  readonly payload: {
    readonly projectId: string;
    readonly contractId: string;
    readonly handoverDossierId: string;
    readonly finalSettlementValue: number;
  };
}

export interface WarrantyClaimCreatedEvent extends BaseInteriorDomainEvent {
  readonly eventType: 'interior.aftercare.warranty_claim_created.v1';
  readonly payload: {
    readonly projectId: string;
    readonly ticketId: string;
    readonly certificateId: string;
    readonly defectCategory: string;
  };
}

