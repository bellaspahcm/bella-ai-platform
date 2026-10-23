/**
 * Bella Preschool OS — P7.1 Finance Domain Types & Contracts
 * 
 * Strict Domain Boundaries:
 * - Invoice Status: DRAFT | ISSUED | VOID
 * - Settlement Status: UNPAID | PARTIALLY_PAID | PAID | OVERPAID (Derived strictly from reconciliation ledger truth)
 * - P4 Meal Charge Input Contract: Consumes public DTO (StudentMealChargeInput), does not query internal P4 tables directly.
 */

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'VOID';
export type SettlementStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERPAID';
export type FeeItemType = 'TUITION' | 'MEAL_FEE' | 'ACTIVITY_FEE' | 'DISCOUNT' | 'OTHER';
export type DiscountType = 'SIBLING' | 'SCHOLARSHIP' | 'STAFF_CHILD' | 'FINANCIAL_AID' | 'WAIVER';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'QR_CODE' | 'CARD';
export type PaymentStatus = 'RECEIVED' | 'RECONCILED' | 'REFUNDED' | 'VOID';
export type TuitionRecognitionPolicyType = 'PERIOD_COMPLETION' | 'TIME_BASED' | 'MILESTONE_EVENT';
export type TuitionRecognitionPolicyStatus = 'ACTIVE' | 'INACTIVE';

/**
 * P4 Care & Wellbeing Public Billing Contract Input DTO
 * Finance consumes this contract payload for meal fee compilation
 */
export type StudentMealChargeInput = {
  studentPartyId: string;
  studentId?: string | null;
  tenantId: string;
  sourceDomain: 'P4_CARE';
  sourceEntityType: 'MEAL_LOG' | 'ATTENDANCE';
  sourceEntityId: string; // Meal occurrence or attendance log UUID for deduplication
  mealDate: string;
  mealName: string; // e.g. "Bữa Trưa", "Bữa Sáng"
  unitPrice: number; // e.g. 35000 VND
  consumedCount: number; // e.g. 1
};

export type FeeStructure = {
  id: string;
  tenantId: string;
  programId: string;
  feeCode: string;
  feeName: string;
  feeType: FeeItemType;
  amount: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'SEMESTER' | 'YEARLY' | 'DAILY';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type BillingPeriod = {
  id: string;
  tenantId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StudentDiscountProfile = {
  id: string;
  tenantId: string;
  studentPartyId: string;
  studentId?: string | null;
  discountType: DiscountType;
  discountName: string;
  discountPercent: number; // e.g. 10.00 for 10%
  fixedAmount: number;
  reason?: string;
  validFrom: string;
  validUntil?: string;
  isActive: boolean;
  createdAt?: string;
};

export type InvoiceLineItem = {
  id?: string;
  tenantId: string;
  invoiceId?: string;
  itemType: FeeItemType;
  description: string;
  unitPrice: number;
  quantity: number;
  subtotalAmount: number;
  sourceDomain?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  createdAt?: string;
};

export type Invoice = {
  id: string;
  tenantId: string;
  studentPartyId: string;
  studentId?: string | null;
  billingPeriodId: string;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
  settlementStatus: SettlementStatus;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  issuedAt?: string;
  dueDate: string;
  sha256Checksum?: string;
  isArchived: boolean;
  lineItems?: InvoiceLineItem[];
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Payment = {
  id: string;
  tenantId: string;
  payerPartyId: string;
  studentPartyId: string;
  studentId?: string | null;
  paymentNumber: string;
  paymentMethod: PaymentMethod;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  referenceNumber?: string;
  paymentDate: string;
  status: PaymentStatus;
  createdBy: string;
  createdAt?: string;
};

export type ReconciliationLedgerEntry = {
  id: string;
  tenantId: string;
  paymentId: string;
  invoiceId: string;
  allocatedAmount: number;
  allocationDate: string;
  reconciledByPartyId: string;
  notes?: string;
  createdAt?: string;
};

export type PaymentReceipt = {
  id: string;
  tenantId: string;
  paymentId: string;
  invoiceId: string;
  receiptNumber: string;
  settlementSnapshot: Record<string, unknown>;
  sha256Fingerprint: string;
  issuedAt: string;
  createdAt?: string;
};

/** Explicit command identity; it never conveys authorization. */
export type FinanceReconciliationRequest =
  | { kind: 'new-payment'; invoiceId: string; paymentAmount: number; paymentMethod: PaymentMethod }
  | { kind: 'existing-payment'; invoiceId: string; paymentId: string; allocationAmount: number; notes: string | null };

export interface FinanceReconciliationCommand {
  tenantId: string;
  actorId: string;
  operationKey: string;
  /** Explicit selected branch for the Product HTTP surface; never an access grant. */
  branchId?: string;
  request: FinanceReconciliationRequest;
}

export interface FinanceReconciliationResult {
  payment: Payment;
  reconciliationEntry: ReconciliationLedgerEntry;
  receipt: PaymentReceipt;
  updatedSettlementStatus: SettlementStatus;
}

export type TuitionRecognitionPolicy = {
  id: string;
  tenantId: string;
  policyType: TuitionRecognitionPolicyType;
  effectiveFrom: string;
  effectiveTo?: string | null;
  version: string;
  status: TuitionRecognitionPolicyStatus;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TuitionServicePeriodCompletion = {
  id: string;
  tenantId: string;
  billingPeriodId: string;
  completedAt: string;
  completedBy: string;
  createdAt?: string;
};
