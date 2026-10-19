/**
 * Bella Preschool OS — P7.1 Payment Reconciliation & Receipt Service
 * 
 * Responsible for:
 * 1. Recording inbound payments (append-only payment history)
 * 2. Allocating payment amounts to ISSUED invoices
 * 3. Adding double-entry reconciliation ledger entries
 * 4. Dynamically deriving Settlement Status (UNPAID | PARTIALLY_PAID | PAID | OVERPAID)
 * 5. Issuing payment receipt evidence packages with deterministic SHA-256 fingerprints
 */

import { createHash } from 'crypto';
import { PreschoolFinanceRepository } from '../repositories/preschool-finance.repository';
import { canonicalJsonString } from './invoice-issuance.service';
import { Payment, PaymentReceipt, ReconciliationLedgerEntry, SettlementStatus } from '../domain/finance.types';

export class PaymentReconciliationService {
  constructor(private repo: PreschoolFinanceRepository = new PreschoolFinanceRepository()) {}

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

  /**
   * Reconciles/allocates a portion of an inbound payment to an ISSUED invoice
   */
  async reconcilePaymentToInvoice(params: {
    tenantId: string;
    paymentId: string;
    invoiceId: string;
    allocationAmount: number;
    reconciledByPartyId: string;
    notes?: string;
  }): Promise<{
    reconciliationEntry: ReconciliationLedgerEntry;
    receipt: PaymentReceipt;
    updatedSettlementStatus: SettlementStatus;
  }> {
    const { tenantId, paymentId, invoiceId, allocationAmount, reconciledByPartyId, notes } = params;

    if (allocationAmount <= 0) {
      throw new Error(`INVALID_ALLOCATION_AMOUNT_ERROR: Allocation amount must be greater than zero.`);
    }

    // 1. Fetch Payment & Invoice Records
    const invoice = await this.repo.getInvoiceById(tenantId, invoiceId);
    if (!invoice) {
      throw new Error(`INVOICE_NOT_FOUND_ERROR: Invoice ${invoiceId} not found.`);
    }

    if (invoice.invoiceStatus !== 'ISSUED') {
      throw new Error(`UNISSUED_INVOICE_RECONCILIATION_ERROR: Cannot reconcile payments to a DRAFT or VOID invoice.`);
    }

    // Validate Outstanding Balance Invariant: Allocation cannot exceed invoice outstanding amount
    if (allocationAmount > invoice.outstandingAmount) {
      throw new Error(`ALLOCATION_EXCEEDS_OUTSTANDING_ERROR: Allocation amount (${allocationAmount}) exceeds invoice outstanding balance (${invoice.outstandingAmount}).`);
    }

    // 2. Fetch Payment Record & Validate Unallocated Balance
    const payment = await this.repo.getPaymentById(tenantId, paymentId);
    if (!payment) {
      throw new Error(`PAYMENT_NOT_FOUND_ERROR: Payment ${paymentId} not found.`);
    }

    if (payment.studentPartyId !== invoice.studentPartyId) {
      throw new Error(`PAYMENT_INVOICE_STUDENT_MISMATCH_ERROR: Payment student does not match invoice student.`);
    }

    if (allocationAmount > payment.unallocatedAmount) {
      throw new Error(`ALLOCATION_EXCEEDS_PAYMENT_UNALLOCATED_ERROR: Allocation amount (${allocationAmount}) exceeds payment unallocated balance (${payment.unallocatedAmount}).`);
    }

    // 3. Add Reconciliation Ledger Entry
    const reconciliationEntry = await this.repo.addReconciliationEntry({
      tenantId,
      paymentId,
      invoiceId,
      allocatedAmount: allocationAmount,
      allocationDate: new Date().toISOString(),
      reconciledByPartyId,
      notes,
    });

    // 4. Update Payment Allocated & Unallocated Balances
    const newPaymentAllocated = payment.allocatedAmount + allocationAmount;
    const newPaymentUnallocated = payment.unallocatedAmount - allocationAmount;
    const newPaymentStatus: Payment['status'] = newPaymentUnallocated === 0 ? 'RECONCILED' : 'RECEIVED';

    await this.repo.updatePaymentAllocation(tenantId, paymentId, newPaymentAllocated, newPaymentUnallocated, newPaymentStatus);

    // 5. Update Invoice Paid & Outstanding Balances, Derive Settlement Status
    const newInvoicePaid = invoice.paidAmount + allocationAmount;
    const newInvoiceOutstanding = Math.max(0, invoice.netAmount - newInvoicePaid);

    let updatedSettlementStatus: SettlementStatus = 'UNPAID';
    if (newInvoicePaid >= invoice.netAmount) {
      updatedSettlementStatus = newInvoicePaid > invoice.netAmount ? 'OVERPAID' : 'PAID';
    } else if (newInvoicePaid > 0) {
      updatedSettlementStatus = 'PARTIALLY_PAID';
    }

    await this.repo.updateInvoiceStatus(tenantId, invoiceId, {
      settlementStatus: updatedSettlementStatus,
      paidAmount: newInvoicePaid,
      outstandingAmount: newInvoiceOutstanding,
    });

    // 6. Generate Payment Receipt Evidence Package & SHA-256 Fingerprint
    const receiptNumber = `RCT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const issuedAt = new Date().toISOString();

    const settlementSnapshot = {
      tenantId,
      paymentId,
      invoiceId,
      receiptNumber,
      allocationAmount,
      invoiceNetAmount: invoice.netAmount,
      newInvoicePaidAmount: newInvoicePaid,
      newInvoiceOutstandingAmount: newInvoiceOutstanding,
      settlementStatus: updatedSettlementStatus,
      issuedAt,
    };

    const canonicalJson = canonicalJsonString(settlementSnapshot);
    const sha256Fingerprint = createHash('sha256').update(canonicalJson).digest('hex');

    const receipt = await this.repo.createReceipt({
      tenantId,
      paymentId,
      invoiceId,
      receiptNumber,
      settlementSnapshot,
      sha256Fingerprint,
      issuedAt,
    });

    return {
      reconciliationEntry,
      receipt,
      updatedSettlementStatus,
    };
  }

}
