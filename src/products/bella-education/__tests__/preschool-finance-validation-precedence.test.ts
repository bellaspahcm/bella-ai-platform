import { PreschoolFinanceRepository } from '../finance/repositories/preschool-finance.repository';
import { PaymentReconciliationService } from '../finance/services/payment-reconciliation.service';
import { TuitionBillingService } from '../finance/services/tuition-billing.service';

type Operation = 'billing' | 'payment';

// Approved D02: canonical tenant boundaries precede enrollment eligibility;
// lookup failures must retain their error and must not create a financial row.
function setup() {
  const repo = new PreschoolFinanceRepository();
  const studentCheck = jest.spyOn(repo, 'assertStudentPartyBelongsToTenant').mockResolvedValue();
  const payerCheck = jest.spyOn(repo, 'assertPayerPartyBelongsToTenant').mockResolvedValue();
  const enrollmentCheck = jest.spyOn(repo, 'hasActiveEnrollmentForStudentParty').mockResolvedValue(false);
  const invoiceWrite = jest.spyOn(repo, 'createInvoice').mockImplementation(async () => {
    throw new Error('UNEXPECTED_INVOICE_WRITE');
  });
  const paymentWrite = jest.spyOn(repo, 'recordPayment').mockImplementation(async () => {
    throw new Error('UNEXPECTED_PAYMENT_WRITE');
  });
  const billing = new TuitionBillingService(repo);
  const payment = new PaymentReconciliationService(repo);

  const invoke = (operation: Operation, studentPartyId: string | undefined = 'student-party') => operation === 'billing'
    ? billing.compileDraftInvoice({ tenantId: 'tenant', studentPartyId, billingPeriodId: 'period', dueDate: '2026-10-31', createdBy: 'actor' })
    : payment.recordInboundPayment({ tenantId: 'tenant', studentPartyId, payerPartyId: 'payer-party', amount: 1000, paymentMethod: 'CASH', createdBy: 'actor' });

  return { studentCheck, payerCheck, enrollmentCheck, invoiceWrite, paymentWrite, invoke };
}

describe('D02 Finance validation precedence', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each<Operation>(['billing', 'payment'])('%s reports foreign Student Party before missing enrollment', async operation => {
    const h = setup();
    h.studentCheck.mockRejectedValue(new Error('STUDENT_PARTY_TENANT_MISMATCH'));

    await expect(h.invoke(operation)).rejects.toThrow('STUDENT_PARTY_TENANT_MISMATCH');
    expect(h.enrollmentCheck).not.toHaveBeenCalled();
    expect(h.invoiceWrite).not.toHaveBeenCalled();
    expect(h.paymentWrite).not.toHaveBeenCalled();
  });

  it('reports foreign Payer Party before missing enrollment', async () => {
    const h = setup();
    h.payerCheck.mockRejectedValue(new Error('PAYER_PARTY_TENANT_MISMATCH'));

    await expect(h.invoke('payment')).rejects.toThrow('PAYER_PARTY_TENANT_MISMATCH');
    expect(h.enrollmentCheck).not.toHaveBeenCalled();
    expect(h.paymentWrite).not.toHaveBeenCalled();
  });

  it.each<Operation>(['billing', 'payment'])('%s retains enrollment-required for valid same-tenant parties', async operation => {
    const h = setup();

    await expect(h.invoke(operation)).rejects.toThrow('FINANCE_STUDENT_ENROLLMENT_REQUIRED');
    expect(h.studentCheck).toHaveBeenCalledWith('tenant', 'student-party');
    if (operation === 'payment') expect(h.payerCheck).toHaveBeenCalledWith('tenant', 'payer-party');
    expect(h.invoiceWrite).not.toHaveBeenCalled();
    expect(h.paymentWrite).not.toHaveBeenCalled();
  });

  it.each<Operation>(['billing', 'payment'])('%s propagates Student Party DB failure without eligibility fallback', async operation => {
    const h = setup();
    const failure = new Error('FINANCE_PARTY_LOOKUP_ERROR: controlled DB failure');
    h.studentCheck.mockRejectedValue(failure);

    await expect(h.invoke(operation)).rejects.toBe(failure);
    expect(h.enrollmentCheck).not.toHaveBeenCalled();
    expect(h.invoiceWrite).not.toHaveBeenCalled();
    expect(h.paymentWrite).not.toHaveBeenCalled();
  });

  it('propagates Payer Party DB failure without eligibility fallback', async () => {
    const h = setup();
    const failure = new Error('FINANCE_PARTY_LOOKUP_ERROR: controlled payer DB failure');
    h.payerCheck.mockRejectedValue(failure);

    await expect(h.invoke('payment')).rejects.toBe(failure);
    expect(h.enrollmentCheck).not.toHaveBeenCalled();
    expect(h.paymentWrite).not.toHaveBeenCalled();
  });

  it.each<Operation>(['billing', 'payment'])('%s propagates enrollment DB failure without writing', async operation => {
    const h = setup();
    const failure = new Error('FINANCE_REPOSITORY_ERROR: controlled enrollment DB failure');
    h.enrollmentCheck.mockRejectedValue(failure);

    await expect(h.invoke(operation)).rejects.toBe(failure);
    expect(h.invoiceWrite).not.toHaveBeenCalled();
    expect(h.paymentWrite).not.toHaveBeenCalled();
  });
});
