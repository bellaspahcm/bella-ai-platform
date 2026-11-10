/**
 * Bella Interior OS — Commercial Proposal Phase 3: Contract & Payment Milestone Types
 *
 * Single Source of Truth for Contract Lifecycle, Addenda/Variation Orders,
 * Milestone Payment Schedules, Transaction Receipts, and Outbox Event Payloads.
 *
 * @module src/products/bella-interior/domain/commercial-costing/contract.types
 */

import type {
  InteriorContract,
  InteriorContractStatus,
  PaymentMilestone,
  PaymentMilestoneStatus,
  ContractAddendum,
} from './types';

export type MilestoneTemplateCode =
  | '3_STEP_STANDARD'
  | '4_STEP_BALANCED'
  | '5_STEP_DUBAI_CANONICAL'
  | 'CUSTOM';

export interface MilestoneTemplateItemDef {
  readonly order: number;
  readonly name: string;
  readonly percentage: number;
  readonly triggerCondition: string;
  readonly relativeDaysFromStart?: number;
}

export interface MilestoneScheduleTemplate {
  readonly code: MilestoneTemplateCode;
  readonly title: string;
  readonly description: string;
  readonly steps: ReadonlyArray<MilestoneTemplateItemDef>;
}

export interface CreateContractFromQuotationInput {
  readonly tenantId: string;
  readonly projectId: string;
  readonly quotationId: string;
  readonly contractNumber: string;
  readonly title: string;
  readonly clientRepresentative: string;
  readonly contractorRepresentative: string;
  readonly userRole: string; // Actor role for RBAC check
  readonly actorId?: string;
  readonly milestoneTemplate?: MilestoneTemplateCode;
  readonly customMilestones?: ReadonlyArray<{
    readonly milestoneOrder: number;
    readonly name: string;
    readonly percentage: number;
    readonly triggerCondition: string;
    readonly dueDate?: string;
  }>;
  readonly paymentTerms?: string;
  readonly executionStartDate?: string;
  readonly executionEndDate?: string;
  readonly notes?: string;
}

export interface CreateAddendumInput {
  readonly tenantId: string;
  readonly contractId: string;
  readonly addendumNumber: string;
  readonly title: string;
  readonly valueDelta: number; // Positive or negative financial variance
  readonly reason: string;
  readonly userRole: string;
  readonly actorId?: string;
  readonly approvedAt?: string;
  /** If true, adjusts existing unpaid milestone amounts proportionally */
  readonly adjustUnpaidMilestones?: boolean;
}

export type PaymentMethod =
  | 'bank_transfer'
  | 'cash'
  | 'credit_card'
  | 'escrow'
  | 'other';

export interface PaymentTransaction {
  readonly id: string;
  readonly tenantId: string;
  readonly contractId: string;
  readonly milestoneId: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly referenceCode: string;
  readonly transactionDate: string;
  readonly proofUrl?: string;
  readonly notes?: string;
  readonly recordedBy: string;
  readonly createdAt: string;
}

export interface RecordPaymentTransactionInput {
  readonly tenantId: string;
  readonly contractId: string;
  readonly milestoneId: string;
  readonly amount: number;
  readonly paymentMethod: PaymentMethod;
  readonly referenceCode: string;
  readonly transactionDate: string;
  readonly proofUrl?: string;
  readonly notes?: string;
  readonly recordedBy: string;
  readonly userRole: string;
}

export interface IssueMilestoneInvoiceInput {
  readonly tenantId: string;
  readonly contractId: string;
  readonly milestoneId: string;
  readonly invoiceNumber: string;
  readonly invoicedAt?: string;
  readonly userRole: string;
}

export interface ContractFinancialSummary {
  readonly baselineContractValue: number;
  readonly totalAddendaValue: number;
  readonly currentContractValue: number;
  readonly totalCollectedAmount: number;
  readonly remainingBalance: number;
  readonly collectionPercentage: number;
  readonly totalMilestonesCount: number;
  readonly paidMilestonesCount: number;
  readonly invoicedMilestonesCount: number;
  readonly pendingMilestonesCount: number;
  readonly overdueMilestonesCount: number;
  readonly isFullyCollected: boolean;
}

export {
  InteriorContract,
  InteriorContractStatus,
  PaymentMilestone,
  PaymentMilestoneStatus,
  ContractAddendum,
};

