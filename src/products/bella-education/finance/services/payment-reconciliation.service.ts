/**
 * Bella Preschool OS — P7.1 Payment Reconciliation & Receipt Service
 * 
 * Responsible for:
 * 1. Recording inbound payments (append-only payment history)
 * 2. Allocating payment amounts to ISSUED invoices
 * 3. Recording Product allocation facts (not Finance GL postings)
 * 4. Dynamically deriving Settlement Status (UNPAID | PARTIALLY_PAID | PAID | OVERPAID)
 * 5. Issuing payment receipt evidence packages with deterministic SHA-256 fingerprints
 */

import { createHash, randomUUID } from 'crypto';
import { FinanceAtomicDatabaseError, PreschoolFinanceRepository } from '../repositories/preschool-finance.repository';
import { canonicalJsonString } from './invoice-issuance.service';
import type { FinanceReconciliationCommand, FinanceReconciliationResult, Payment } from '../domain/finance.types';

export type PaymentReconciliationRepository = Pick<PreschoolFinanceRepository,
  'hasActiveEnrollmentForStudentParty' | 'assertStudentPartyBelongsToTenant' | 'assertPayerPartyBelongsToTenant'
  | 'recordPayment' | 'recoverAtomicReconciliation' | 'commitAtomicReconciliation'>;

function canonicalUuid(value: string): string {
  const compact = value.replace(/^\{(.*)\}$/, '$1').replaceAll('-', '');
  if (!/^[0-9a-f]{32}$/i.test(compact)) return value;
  const lower = compact.toLowerCase();
  return [lower.slice(0, 8), lower.slice(8, 12), lower.slice(12, 16), lower.slice(16, 20), lower.slice(20)].join('-');
}

export class PaymentReconciliationService {
  constructor(private repo: PaymentReconciliationRepository = new PreschoolFinanceRepository()) {}

  /**
   * Records an inbound payment from parent/payer
   */
  async recordInboundPayment(params: {
    tenantId: string;
    payerPartyId: string;
    studentPartyId?: string;
    studentId?: string | null;
    paymentMethod: Payment['paymentMethod'];
    amount: number;
    referenceNumber?: string;
    createdBy: string;
  }): Promise<Payment> {
    const {
      tenantId,
      payerPartyId,
      studentPartyId: explicitStudentPartyId,
      studentId: suppliedStudentId = null,
      paymentMethod,
      amount,
      referenceNumber,
      createdBy,
    } = params;
    const studentPartyId = explicitStudentPartyId ?? suppliedStudentId;
    if (!studentPartyId) {
      throw new Error(`FINANCE_STUDENT_PARTY_REQUIRED: Canonical Student Party ID is required.`);
    }
    const studentId = suppliedStudentId;

    if (amount <= 0) {
      throw new Error(`INVALID_PAYMENT_AMOUNT_ERROR: Payment amount must be greater than zero.`);
    }

    await this.repo.assertStudentPartyBelongsToTenant(tenantId, studentPartyId);
    await this.repo.assertPayerPartyBelongsToTenant(tenantId, payerPartyId);

    const hasEnrollment = await this.repo.hasActiveEnrollmentForStudentParty(tenantId, studentPartyId);
    if (!hasEnrollment) {
      throw new Error(`FINANCE_STUDENT_ENROLLMENT_REQUIRED: Student Party ${studentPartyId} is not actively enrolled in tenant ${tenantId}.`);
    }

    const paymentNumber = `PAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    return await this.repo.recordPayment({
      tenantId,
      payerPartyId,
      studentPartyId,
      studentId,
      paymentNumber,
      paymentMethod,
      amount,
      allocatedAmount: 0,
      unallocatedAmount: amount,
      referenceNumber,
      paymentDate: new Date().toISOString(),
      status: 'RECEIVED',
      createdBy,
    });
  }

  /** New payment and its allocation are one Product database transaction. */
  async recordAndReconcilePayment(params: {
    tenantId: string;
    actorId: string;
    operationKey: string;
    branchId?: string;
    invoiceId: string;
    paymentAmount: number;
    paymentMethod: Payment['paymentMethod'];
  }): Promise<FinanceReconciliationResult> {
    return this.execute({
      tenantId: params.tenantId,
      actorId: params.actorId,
      operationKey: params.operationKey,
      branchId: params.branchId,
      request: {
        kind: 'new-payment',
        invoiceId: params.invoiceId,
        paymentAmount: params.paymentAmount,
        paymentMethod: params.paymentMethod,
      },
    });
  }

  /** Existing-payment callers retain duplicate-pair rejection without an explicit key. */
  async reconcilePaymentToInvoice(params: {
    tenantId: string;
    paymentId: string;
    invoiceId: string;
    allocationAmount: number;
    reconciledByPartyId: string;
    notes?: string;
    operationKey?: string;
  }): Promise<FinanceReconciliationResult> {
    return this.execute({
      tenantId: params.tenantId,
      actorId: params.reconciledByPartyId,
      operationKey: params.operationKey ?? `legacy-${randomUUID()}`,
      request: {
        kind: 'existing-payment',
        invoiceId: params.invoiceId,
        paymentId: params.paymentId,
        allocationAmount: params.allocationAmount,
        notes: params.notes ?? null,
      },
    });
  }

  private async execute(command: FinanceReconciliationCommand): Promise<FinanceReconciliationResult> {
    command = {
      ...command, tenantId: canonicalUuid(command.tenantId), actorId: canonicalUuid(command.actorId),
      request: command.request.kind === 'new-payment'
        ? { ...command.request, invoiceId: canonicalUuid(command.request.invoiceId) }
        : { ...command.request, invoiceId: canonicalUuid(command.request.invoiceId), paymentId: canonicalUuid(command.request.paymentId) },
    };
    if (!command.operationKey.trim() || command.operationKey.length > 200) {
      throw new Error('FINANCE_OPERATION_KEY_REQUIRED: Stable operation key of at most 200 characters required.');
    }
    const amount = command.request.kind === 'new-payment'
      ? command.request.paymentAmount : command.request.allocationAmount;
    // Decimal scale is checked from the supplied number, without silently rounding it.
    if (!Number.isFinite(amount) || amount <= 0 || amount >= 10000000000000
        || !/^\d+(?:\.\d{1,2})?$/.test(String(amount))) {
      throw new Error('INVALID_ALLOCATION_AMOUNT_ERROR: Positive NUMERIC(15,2) amount required without rounding.');
    }
    if (command.request.kind === 'new-payment'
        && !['BANK_TRANSFER', 'CASH', 'QR_CODE', 'CARD'].includes(command.request.paymentMethod)) {
      throw new Error('INVALID_PAYMENT_METHOD_ERROR: Unsupported payment method.');
    }
    // Recovery validates CURRENT authority and actual canonical rows, before any
    // mutable invoice/enrollment/guardian eligibility is considered for a new write.
    const recovered = await this.repo.recoverAtomicReconciliation(command);
    if (recovered) return this.verifyReceipt(recovered);
    try {
      return this.verifyReceipt(await this.repo.commitAtomicReconciliation(command));
    } catch (error) {
      // A committed RPC response can be lost, or another caller can commit after
      // the first read. Keep the same key; never issue another payment command blindly.
      const afterUncertainOutcome = await this.repo.recoverAtomicReconciliation(command);
      if (afterUncertainOutcome) return this.verifyReceipt(afterUncertainOutcome);
      // Only an acknowledged transaction rejection followed by successful,
      // authorized read-back permits correction. Transport, authority and
      // canonical-conflict failures retain the original immutable request.
      if (error instanceof FinanceAtomicDatabaseError && error.code === 'P0001'
          && /^(ALLOCATION_EXCEEDS_OUTSTANDING_ERROR|UNISSUED_INVOICE_RECONCILIATION_ERROR|FINANCE_STUDENT_ENROLLMENT_REQUIRED):/.test(error.message)) {
        error.paymentNotCommitted = true;
      }
      throw error;
    }
  }

  private verifyReceipt(result: FinanceReconciliationResult): FinanceReconciliationResult {
    const fingerprint = createHash('sha256')
      .update(canonicalJsonString(result.receipt.settlementSnapshot)).digest('hex');
    if (fingerprint !== result.receipt.sha256Fingerprint) {
      throw new Error('FINANCE_CANONICAL_CONFLICT: Receipt SHA-256 does not match canonical JSON.');
    }
    return result;
  }
}
