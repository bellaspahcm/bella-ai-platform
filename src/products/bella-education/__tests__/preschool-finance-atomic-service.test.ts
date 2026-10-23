/**
 * Business test contract: approved financial unit is atomic, completed writes are
 * recovered by stable key and canonical IDs; recovery errors fail closed.
 * These tests verify orchestration only. SQL atomicity requires real DB evidence.
 */
import { createHash } from 'crypto';
import { PaymentReconciliationService, type PaymentReconciliationRepository } from '../finance/services/payment-reconciliation.service';
import { FinanceAtomicDatabaseError } from '../finance/repositories/preschool-finance.repository';
import type { FinanceReconciliationResult } from '../finance/domain/finance.types';
import { canonicalJsonString } from '../finance/services/invoice-issuance.service';

const command = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  actorId: '00000000-0000-0000-0000-000000000002',
  operationKey: 'stable-payment-key',
  invoiceId: '00000000-0000-0000-0000-000000000003',
  paymentAmount: 40.01,
  paymentMethod: 'BANK_TRANSFER' as const,
};

function resultFixture(): FinanceReconciliationResult {
  const issuedAt = '2026-10-19T00:00:00.123Z';
  const snapshot = {
    tenantId: command.tenantId, paymentId: 'payment-id', invoiceId: command.invoiceId,
    receiptNumber: 'RCT-fixture', allocationAmount: 40.01, invoiceNetAmount: 100,
    newInvoicePaidAmount: 40.01, newInvoiceOutstandingAmount: 59.99,
    settlementStatus: 'PARTIALLY_PAID', issuedAt,
  };
  return {
    payment: {
      id: 'payment-id', tenantId: command.tenantId, payerPartyId: 'payer-id', studentPartyId: 'child-id',
      paymentNumber: 'PAY-fixture', paymentMethod: 'BANK_TRANSFER', amount: 40.01,
      allocatedAmount: 40.01, unallocatedAmount: 0, paymentDate: issuedAt, status: 'RECONCILED', createdBy: command.actorId,
    },
    reconciliationEntry: {
      id: 'allocation-id', tenantId: command.tenantId, paymentId: 'payment-id', invoiceId: command.invoiceId,
      allocatedAmount: 40.01, allocationDate: issuedAt, reconciledByPartyId: command.actorId,
    },
    receipt: {
      id: 'receipt-id', tenantId: command.tenantId, paymentId: 'payment-id', invoiceId: command.invoiceId,
      receiptNumber: 'RCT-fixture', settlementSnapshot: snapshot,
      sha256Fingerprint: createHash('sha256').update(canonicalJsonString(snapshot)).digest('hex'), issuedAt,
    },
    updatedSettlementStatus: 'PARTIALLY_PAID',
  };
}

function repositoryFixture(): jest.Mocked<PaymentReconciliationRepository> {
  return {
    hasActiveEnrollmentForStudentParty: jest.fn(), assertStudentPartyBelongsToTenant: jest.fn(),
    assertPayerPartyBelongsToTenant: jest.fn(), recordPayment: jest.fn(),
    recoverAtomicReconciliation: jest.fn(), commitAtomicReconciliation: jest.fn(),
  };
}

describe('Preschool Finance atomic command orchestration', () => {
  let repo: jest.Mocked<PaymentReconciliationRepository>;
  let service: PaymentReconciliationService;
  beforeEach(() => {
    repo = repositoryFixture();
    repo.recoverAtomicReconciliation.mockResolvedValue(null);
    repo.commitAtomicReconciliation.mockResolvedValue(resultFixture());
    service = new PaymentReconciliationService(repo);
  });

  it('commits a new payment and allocation in one repository capability', async () => {
    const result = await service.recordAndReconcilePayment(command);
    expect(result.receipt.id).toBe('receipt-id');
    expect(repo.commitAtomicReconciliation).toHaveBeenCalledTimes(1);
    expect(repo.commitAtomicReconciliation).toHaveBeenCalledWith({
      tenantId: command.tenantId, actorId: command.actorId, operationKey: command.operationKey,
      request: { kind: 'new-payment', invoiceId: command.invoiceId, paymentAmount: 40.01, paymentMethod: 'BANK_TRANSFER' },
    });
    expect(repo.recordPayment).not.toHaveBeenCalled();
  });

  it('recovers canonical IDs before mutable enrollment or Party checks', async () => {
    repo.recoverAtomicReconciliation.mockResolvedValue(resultFixture());
    expect((await service.recordAndReconcilePayment(command)).payment.id).toBe('payment-id');
    expect(repo.commitAtomicReconciliation).not.toHaveBeenCalled();
    expect(repo.hasActiveEnrollmentForStudentParty).not.toHaveBeenCalled();
    expect(repo.assertPayerPartyBelongsToTenant).not.toHaveBeenCalled();
  });

  it('recovers a committed result after acknowledgement loss using the SAME key', async () => {
    repo.commitAtomicReconciliation.mockRejectedValue(new Error('network acknowledgement lost'));
    repo.recoverAtomicReconciliation.mockResolvedValueOnce(null).mockResolvedValueOnce(resultFixture());
    expect((await service.recordAndReconcilePayment(command)).reconciliationEntry.id).toBe('allocation-id');
    expect(repo.recoverAtomicReconciliation).toHaveBeenCalledTimes(2);
    expect(repo.recoverAtomicReconciliation.mock.calls[0][0]).toEqual(repo.recoverAtomicReconciliation.mock.calls[1][0]);
    expect(repo.commitAtomicReconciliation).toHaveBeenCalledTimes(1);
  });

  it('does not mask an uncommitted SQL failure or retry blindly', async () => {
    const failure = new Error('trigger prevented invoice update');
    repo.commitAtomicReconciliation.mockRejectedValue(failure);
    await expect(service.recordAndReconcilePayment(command)).rejects.toBe(failure);
    expect(repo.commitAtomicReconciliation).toHaveBeenCalledTimes(1);
    expect(repo.recordPayment).not.toHaveBeenCalled();
  });

  it('fails closed when recovery has a DB error', async () => {
    repo.recoverAtomicReconciliation.mockRejectedValue(new Error('database unavailable'));
    await expect(service.recordAndReconcilePayment(command)).rejects.toThrow('database unavailable');
    expect(repo.commitAtomicReconciliation).not.toHaveBeenCalled();
  });

  it('permits correction only after an acknowledged rejection and authorized null read-back', async () => {
    const error = new FinanceAtomicDatabaseError('ALLOCATION_EXCEEDS_OUTSTANDING_ERROR: Balance exceeded.', 'P0001');
    repo.commitAtomicReconciliation.mockRejectedValue(error);
    await expect(service.recordAndReconcilePayment(command)).rejects.toMatchObject({ paymentNotCommitted: true });
    expect(repo.recoverAtomicReconciliation).toHaveBeenCalledTimes(2);
  });

  it.each([
    new FinanceAtomicDatabaseError('FINANCE_OPERATION_CONFLICT: Mismatch.', 'P0001'),
    new FinanceAtomicDatabaseError('ALLOCATION_EXCEEDS_OUTSTANDING_ERROR: Balance exceeded.', '08006'),
    new Error('Response lost'),
  ])('does not permit correction for conflict or uncertain transport outcome (%p)', async error => {
    repo.commitAtomicReconciliation.mockRejectedValue(error);
    await expect(service.recordAndReconcilePayment(command)).rejects.toBe(error);
    expect('paymentNotCommitted' in error && error.paymentNotCommitted).not.toBe(true);
  });

  it('does not mark a rejection safe when read-back fails or access is revoked', async () => {
    const error = new FinanceAtomicDatabaseError('ALLOCATION_EXCEEDS_OUTSTANDING_ERROR: Balance exceeded.', 'P0001');
    repo.commitAtomicReconciliation.mockRejectedValue(error);
    repo.recoverAtomicReconciliation.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('permission revoked'));
    await expect(service.recordAndReconcilePayment(command)).rejects.toThrow('permission revoked');
    expect(error.paymentNotCommitted).toBe(false);
  });

  it('fails closed when current authority was revoked after an uncertain outcome', async () => {
    repo.recoverAtomicReconciliation.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('AUTH_ROLE_PERMISSION_ERROR'));
    repo.commitAtomicReconciliation.mockRejectedValue(new Error('network error'));
    await expect(service.recordAndReconcilePayment(command)).rejects.toThrow('AUTH_ROLE_PERMISSION_ERROR');
    expect(repo.commitAtomicReconciliation).toHaveBeenCalledTimes(1);
  });

  it('propagates a payload conflict without mutation', async () => {
    repo.recoverAtomicReconciliation.mockRejectedValue(new Error('FINANCE_OPERATION_CONFLICT'));
    await expect(service.recordAndReconcilePayment(command)).rejects.toThrow('FINANCE_OPERATION_CONFLICT');
    expect(repo.commitAtomicReconciliation).not.toHaveBeenCalled();
  });

  it.each(['', '   ', 'x'.repeat(201)])('rejects invalid operation key before any RPC (%s)', async (operationKey) => {
    await expect(service.recordAndReconcilePayment({ ...command, operationKey })).rejects.toThrow('FINANCE_OPERATION_KEY_REQUIRED');
    expect(repo.recoverAtomicReconciliation).not.toHaveBeenCalled();
    expect(repo.commitAtomicReconciliation).not.toHaveBeenCalled();
  });

  it.each([0, -1, NaN, Infinity, 1.001, 10000000000000])('rejects invalid amount without rounding (%s)', async (paymentAmount) => {
    await expect(service.recordAndReconcilePayment({ ...command, paymentAmount })).rejects.toThrow('INVALID_ALLOCATION_AMOUNT_ERROR');
    expect(repo.commitAtomicReconciliation).not.toHaveBeenCalled();
    expect(repo.recoverAtomicReconciliation).not.toHaveBeenCalled();
  });

  it('rejects a forged fingerprint on canonical recovery', async () => {
    const invalid = resultFixture();
    invalid.receipt.sha256Fingerprint = 'bad';
    repo.recoverAtomicReconciliation.mockResolvedValue(invalid);
    await expect(service.recordAndReconcilePayment(command)).rejects.toThrow('FINANCE_CANONICAL_CONFLICT');
    expect(repo.commitAtomicReconciliation).not.toHaveBeenCalled();
  });

  it('keeps legacy duplicate-pair rejection without turning pair IDs into a replay key', async () => {
    const params = { tenantId: command.tenantId, invoiceId: command.invoiceId, paymentId: 'payment-id', allocationAmount: 10, reconciledByPartyId: command.actorId };
    await service.reconcilePaymentToInvoice(params);
    repo.commitAtomicReconciliation.mockRejectedValue(new Error('DUPLICATE_RECONCILIATION_ERROR'));
    await expect(service.reconcilePaymentToInvoice(params)).rejects.toThrow('DUPLICATE_RECONCILIATION_ERROR');
    const [first, second] = repo.commitAtomicReconciliation.mock.calls;
    expect(first[0].operationKey).not.toBe(second[0].operationKey);
    expect(first[0].request).toEqual(second[0].request);
  });

  it('permits explicit-key recovery for an existing payment', async () => {
    repo.recoverAtomicReconciliation.mockResolvedValue(resultFixture());
    await service.reconcilePaymentToInvoice({ tenantId: command.tenantId, invoiceId: command.invoiceId, paymentId: 'payment-id', allocationAmount: 40.01, reconciledByPartyId: command.actorId, operationKey: 'caller-key' });
    expect(repo.recoverAtomicReconciliation).toHaveBeenCalledWith(expect.objectContaining({ operationKey: 'caller-key', request: expect.objectContaining({ kind: 'existing-payment', paymentId: 'payment-id' }) }));
    expect(repo.commitAtomicReconciliation).not.toHaveBeenCalled();
  });
});
