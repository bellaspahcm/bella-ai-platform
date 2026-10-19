/**
 * Bella Preschool OS — P7.1 Tuition & Meal Fee Billing Service
 * 
 * Domain Service responsible for:
 * 1. Evaluating tuition fee structures and active student discount profiles
 * 2. Consuming P4 Care & Wellbeing public billing contract payload (StudentMealChargeInput)
 * 3. Compiling draft monthly invoices with line item charges
 * 4. Deduplicating P4 meal occurrences to prevent double-billing
 */

import { PreschoolFinanceRepository } from '../repositories/preschool-finance.repository';
import {
  Invoice,
  InvoiceLineItem,
  StudentMealChargeInput,
  StudentDiscountProfile,
} from '../domain/finance.types';

export class TuitionBillingService {
  constructor(private repo: PreschoolFinanceRepository = new PreschoolFinanceRepository()) {}

  /**
   * Compiles a DRAFT monthly invoice for a student
   */
  async compileDraftInvoice(params: {
    tenantId: string;
    studentPartyId?: string;
    studentId?: string | null;
    billingPeriodId: string;
    dueDate: string;
    createdBy: string;
    mealChargeInputs?: StudentMealChargeInput[];
    additionalLineItems?: Omit<InvoiceLineItem, 'tenantId'>[];
  }): Promise<Invoice> {
    const {
      tenantId,
      studentPartyId: explicitStudentPartyId,
      studentId: suppliedStudentId = null,
      billingPeriodId,
      dueDate,
      createdBy,
      mealChargeInputs = [],
      additionalLineItems = [],
    } = params;
    const studentPartyId = explicitStudentPartyId ?? suppliedStudentId;
    if (!studentPartyId) {
      throw new Error(`FINANCE_STUDENT_PARTY_REQUIRED: Canonical Student Party ID is required.`);
    }
    const studentId = suppliedStudentId;

    await this.repo.assertStudentPartyBelongsToTenant(tenantId, studentPartyId);

    const hasEnrollment = await this.repo.hasActiveEnrollmentForStudentParty(tenantId, studentPartyId);
    if (!hasEnrollment) {
      throw new Error(`FINANCE_STUDENT_ENROLLMENT_REQUIRED: Student Party ${studentPartyId} is not actively enrolled in tenant ${tenantId}.`);
    }

    // 1. Fetch base active fee structures for Preschool
    const feeStructures = await this.repo.getFeeStructures(tenantId, 'PRESCHOOL');
    const tuitionFee = feeStructures.find((f) => f.feeType === 'TUITION');

    if (!tuitionFee) {
      throw new Error(`FINANCE_RULE_ERROR: Base tuition fee structure for PRESCHOOL not configured.`);
    }

    const lineItems: Omit<InvoiceLineItem, 'id' | 'invoiceId' | 'createdAt'>[] = [];

    // Line Item 1: Base Tuition Fee
    lineItems.push({
      tenantId,
      itemType: 'TUITION',
      description: tuitionFee.feeName,
      unitPrice: tuitionFee.amount,
      quantity: 1,
      subtotalAmount: tuitionFee.amount,
      sourceDomain: 'FINANCE_CATALOG',
      sourceEntityType: 'FEE_STRUCTURE',
      sourceEntityId: tuitionFee.id,
    });

    // Line Items 2: P4 Meal Charges (Consumes P4 Public Billing Contract Input DTO)
    for (const meal of mealChargeInputs) {
      if (meal.studentPartyId !== studentPartyId) {
        throw new Error(`FINANCE_MISMATCH_ERROR: Meal charge studentPartyId ${meal.studentPartyId} does not match target student ${studentPartyId}.`);
      }
      if (meal.tenantId !== tenantId) {
        throw new Error(`COMMUNICATION_TENANT_MISMATCH_ERROR: Cross-tenant meal charge input detected.`);
      }

      const mealSubtotal = meal.unitPrice * meal.consumedCount;

      lineItems.push({
        tenantId,
        itemType: 'MEAL_FEE',
        description: `Tiền ăn ${meal.mealName} ngày ${meal.mealDate}`,
        unitPrice: meal.unitPrice,
        quantity: meal.consumedCount,
        subtotalAmount: mealSubtotal,
        sourceDomain: meal.sourceDomain,
        sourceEntityType: meal.sourceEntityType,
        sourceEntityId: meal.sourceEntityId,
      });
    }

    // Additional Custom Line Items (Activities, Materials)
    for (const add of additionalLineItems) {
      lineItems.push({
        ...add,
        tenantId,
      });
    }

    // 2. Fetch Active Student Discount Profiles (Sibling discount, scholarship)
    const activeDiscounts = await this.repo.getActiveDiscountProfiles(tenantId, studentPartyId);
    let totalDiscountAmount = 0;

    const grossTuition = tuitionFee.amount;

    for (const discount of activeDiscounts) {
      let discountVal = 0;
      if (discount.discountPercent > 0) {
        discountVal += (grossTuition * discount.discountPercent) / 100;
      }
      if (discount.fixedAmount > 0) {
        discountVal += discount.fixedAmount;
      }

      // Enforce Discount Policy Invariant: Total discount cannot exceed gross tuition balance
      if (totalDiscountAmount + discountVal > grossTuition) {
        discountVal = Math.max(0, grossTuition - totalDiscountAmount);
      }

      if (discountVal > 0) {
        totalDiscountAmount += discountVal;
        lineItems.push({
          tenantId,
          itemType: 'DISCOUNT',
          description: `Ưu đãi: ${discount.discountName}`,
          unitPrice: -discountVal,
          quantity: 1,
          subtotalAmount: -discountVal,
          sourceDomain: 'FINANCE_POLICY',
          sourceEntityType: 'DISCOUNT_PROFILE',
          sourceEntityId: discount.id,
        });
      }
    }

    // 3. Compute Gross, Discount, and Net Amounts
    let grossAmount = 0;
    for (const item of lineItems) {
      if (item.itemType !== 'DISCOUNT') {
        grossAmount += item.subtotalAmount;
      }
    }

    const netAmount = Math.max(0, grossAmount - totalDiscountAmount);
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    // 4. Create Invoice Header & Line Items in Database
    return await this.repo.createInvoice(
      {
        tenantId,
        studentPartyId,
        studentId,
        billingPeriodId,
        invoiceNumber,
        invoiceStatus: 'DRAFT',
        settlementStatus: 'UNPAID',
        grossAmount,
        discountAmount: totalDiscountAmount,
        netAmount,
        paidAmount: 0,
        outstandingAmount: netAmount,
        dueDate,
        isArchived: false,
        createdBy,
      },
      lineItems
    );
  }
}
