import fs from 'fs';
import path from 'path';
import { PreschoolFinanceRepository } from '../finance/repositories/preschool-finance.repository';
import { TuitionBillingService } from '../finance/services/tuition-billing.service';
import { PaymentReconciliationService } from '../finance/services/payment-reconciliation.service';
import { FeeStructure, Invoice, InvoiceLineItem, Payment, StudentDiscountProfile, type FinanceReconciliationCommand } from '../finance/domain/finance.types';

const tenantId = 'tenant-a';
const studentPartyId = 'student-party-a';
const otherStudentPartyId = 'student-party-b';

function makeTuitionFee(): FeeStructure {
  return {
    id: 'fee-tuition',
    tenantId,
    programId: 'PRESCHOOL',
    feeCode: 'TUITION_MONTHLY',
    feeName: 'Monthly tuition',
    feeType: 'TUITION',
    amount: 5000000,
    currency: 'VND',
    billingCycle: 'MONTHLY',
    isActive: true,
  };
}

function makeInvoice(input: {
  readonly studentPartyId: string;
  readonly studentId?: string | null;
  readonly lineItems: readonly Omit<InvoiceLineItem, 'id' | 'invoiceId' | 'createdAt'>[];
}): Invoice {
  const grossAmount = input.lineItems
    .filter((item) => item.itemType !== 'DISCOUNT')
    .reduce((sum, item) => sum + item.subtotalAmount, 0);
  const discountAmount = Math.abs(
    input.lineItems
      .filter((item) => item.itemType === 'DISCOUNT')
      .reduce((sum, item) => sum + item.subtotalAmount, 0),
  );
  const netAmount = Math.max(0, grossAmount - discountAmount);

  return {
    id: 'invoice-a',
    tenantId,
    studentPartyId: input.studentPartyId,
    studentId: input.studentId ?? null,
    billingPeriodId: 'period-a',
    invoiceNumber: 'INV-TEST',
    invoiceStatus: 'DRAFT',
    settlementStatus: 'UNPAID',
    grossAmount,
    discountAmount,
    netAmount,
    paidAmount: 0,
    outstandingAmount: netAmount,
    dueDate: '2026-09-30',
    isArchived: false,
    createdBy: 'staff-a',
    lineItems: [...input.lineItems],
  };
}

type FinanceRepoStubOptions = {
  readonly enrolled?: boolean;
  readonly discountProfiles?: StudentDiscountProfile[];
};

function makeFinanceRepoStub(options: FinanceRepoStubOptions = {}) {
  const calls = {
    enrollmentChecks: [] as Array<{ tenantId: string; studentPartyId: string }>,
    invoices: [] as Array<{ studentPartyId: string; studentId?: string | null }>,
    payments: [] as Array<{ studentPartyId: string; studentId?: string | null }>,
    discountStudentPartyIds: [] as string[],
  };

  const repo = {
    async hasActiveEnrollmentForStudentParty(inputTenantId: string, inputStudentPartyId: string): Promise<boolean> {
      calls.enrollmentChecks.push({ tenantId: inputTenantId, studentPartyId: inputStudentPartyId });
      return options.enrolled ?? true;
    },
    async assertStudentPartyBelongsToTenant(): Promise<void> {
      return undefined;
    },
    async assertPayerPartyBelongsToTenant(): Promise<void> {
      return undefined;
    },
    async getFeeStructures(): Promise<FeeStructure[]> {
      return [makeTuitionFee()];
    },
    async getActiveDiscountProfiles(inputTenantId: string, inputStudentPartyId: string): Promise<StudentDiscountProfile[]> {
      expect(inputTenantId).toBe(tenantId);
      calls.discountStudentPartyIds.push(inputStudentPartyId);
      return options.discountProfiles ?? [];
    },
    async createInvoice(
      invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>,
      lineItems: Omit<InvoiceLineItem, 'id' | 'invoiceId' | 'createdAt'>[],
    ): Promise<Invoice> {
      calls.invoices.push({
        studentPartyId: invoiceData.studentPartyId,
        studentId: invoiceData.studentId,
      });
      return makeInvoice({
        studentPartyId: invoiceData.studentPartyId,
        studentId: invoiceData.studentId,
        lineItems,
      });
    },
    async recordPayment(paymentData: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
      calls.payments.push({
        studentPartyId: paymentData.studentPartyId,
        studentId: paymentData.studentId,
      });
      return {
        id: 'payment-a',
        tenantId: paymentData.tenantId,
        payerPartyId: paymentData.payerPartyId,
        studentPartyId: paymentData.studentPartyId,
        studentId: paymentData.studentId,
        paymentNumber: paymentData.paymentNumber,
        paymentMethod: paymentData.paymentMethod,
        amount: paymentData.amount,
        allocatedAmount: paymentData.allocatedAmount,
        unallocatedAmount: paymentData.unallocatedAmount,
        referenceNumber: paymentData.referenceNumber,
        paymentDate: paymentData.paymentDate,
        status: paymentData.status,
        createdBy: paymentData.createdBy,
      };
    },
  };

  return { repo: repo as unknown as PreschoolFinanceRepository, calls };
}

describe('Preschool Finance canonical student Party connection', () => {
  it('creates draft invoice for canonical enrolled student_party_id without requiring legacy student_id', async () => {
    const { repo, calls } = makeFinanceRepoStub();
    const service = new TuitionBillingService(repo);

    const invoice = await service.compileDraftInvoice({
      tenantId,
      studentPartyId,
      billingPeriodId: 'period-a',
      dueDate: '2026-09-30',
      createdBy: 'staff-a',
    });

    expect(calls.enrollmentChecks).toEqual([{ tenantId, studentPartyId }]);
    expect(calls.discountStudentPartyIds).toEqual([studentPartyId]);
    expect(calls.invoices).toEqual([{ studentPartyId, studentId: null }]);
    expect(invoice.studentPartyId).toBe(studentPartyId);
    expect(invoice.studentId).toBeNull();
    expect(invoice.netAmount).toBe(5000000);
  });

  it('rejects draft invoice when canonical student Party is not actively enrolled in tenant', async () => {
    const { repo } = makeFinanceRepoStub({ enrolled: false });
    const service = new TuitionBillingService(repo);

    await expect(service.compileDraftInvoice({
      tenantId,
      studentPartyId: otherStudentPartyId,
      billingPeriodId: 'period-a',
      dueDate: '2026-09-30',
      createdBy: 'staff-a',
    })).rejects.toThrow('FINANCE_STUDENT_ENROLLMENT_REQUIRED');
  });

  it('validates meal charge identity with student_party_id', async () => {
    const { repo } = makeFinanceRepoStub();
    const service = new TuitionBillingService(repo);

    await expect(service.compileDraftInvoice({
      tenantId,
      studentPartyId,
      billingPeriodId: 'period-a',
      dueDate: '2026-09-30',
      createdBy: 'staff-a',
      mealChargeInputs: [{
        tenantId,
        studentPartyId: otherStudentPartyId,
        sourceDomain: 'P4_CARE',
        sourceEntityType: 'MEAL_LOG',
        sourceEntityId: 'meal-a',
        mealDate: '2026-09-27',
        mealName: 'Lunch',
        unitPrice: 35000,
        consumedCount: 1,
      }],
    })).rejects.toThrow('FINANCE_MISMATCH_ERROR');
  });

  it('records inbound payment against canonical enrolled student_party_id', async () => {
    const { repo, calls } = makeFinanceRepoStub();
    const service = new PaymentReconciliationService(repo);

    const payment = await service.recordInboundPayment({
      tenantId,
      payerPartyId: 'guardian-party-a',
      studentPartyId,
      paymentMethod: 'BANK_TRANSFER',
      amount: 1000000,
      createdBy: 'staff-a',
    });

    expect(calls.enrollmentChecks).toEqual([{ tenantId, studentPartyId }]);
    expect(calls.payments).toEqual([{ studentPartyId, studentId: null }]);
    expect(payment.studentPartyId).toBe(studentPartyId);
    expect(payment.studentId).toBeNull();
    expect(payment.unallocatedAmount).toBe(1000000);
  });

  it('propagates the atomic repository canonical student mismatch when legacy student_id is null', async () => {
    const invoice: Invoice = {
      ...makeInvoice({
        studentPartyId,
        studentId: null,
        lineItems: [{
          tenantId,
          itemType: 'TUITION',
          description: 'Monthly tuition',
          unitPrice: 5000000,
          quantity: 1,
          subtotalAmount: 5000000,
          sourceDomain: 'FINANCE_CATALOG',
          sourceEntityType: 'FEE_STRUCTURE',
          sourceEntityId: 'fee-tuition',
        }],
      }),
      invoiceStatus: 'ISSUED',
    };
    const wrongStudentPayment: Payment = {
      id: 'payment-wrong-student',
      tenantId,
      payerPartyId: 'guardian-party-a',
      studentPartyId: otherStudentPartyId,
      studentId: null,
      paymentNumber: 'PAY-WRONG',
      paymentMethod: 'BANK_TRANSFER',
      amount: 1000000,
      allocatedAmount: 0,
      unallocatedAmount: 1000000,
      paymentDate: '2026-09-30T00:00:00.000Z',
      status: 'RECEIVED',
      createdBy: 'staff-a',
    };
    const repo = {
      async recoverAtomicReconciliation() { return null; },
      async commitAtomicReconciliation(command: FinanceReconciliationCommand) {
        expect(command.request).toMatchObject({ invoiceId: invoice.id, paymentId: wrongStudentPayment.id });
        // Canonical mismatch enforcement moved into the atomic DB capability.
        // The opt-in actual DB suite verifies rejection with unchanged rows.
        throw new Error('PAYMENT_INVOICE_STUDENT_MISMATCH_ERROR');
      },
    } as unknown as PreschoolFinanceRepository;

    await expect(new PaymentReconciliationService(repo).reconcilePaymentToInvoice({
      tenantId,
      paymentId: wrongStudentPayment.id,
      invoiceId: invoice.id,
      allocationAmount: 1000000,
      reconciledByPartyId: 'staff-a',
    })).rejects.toThrow('PAYMENT_INVOICE_STUDENT_MISMATCH_ERROR');
  });

  it('keeps legacy student_id rows compatible while adding canonical identity constraints', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260927070000_preschool_finance_canonical_student_party.sql'),
      'utf8',
    );

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS student_party_id UUID REFERENCES public.party_parties(id) ON DELETE RESTRICT');
    expect(migration).toContain('ALTER COLUMN student_id DROP NOT NULL');
    expect(migration).toContain('CHECK (student_id IS NOT NULL OR student_party_id IS NOT NULL)');
    expect(migration).toContain('OLD.student_party_id IS DISTINCT FROM NEW.student_party_id');
    expect(migration).not.toContain('DROP COLUMN student_id');
    expect(migration).not.toContain('UPDATE public.edu_fin');
  });
});
