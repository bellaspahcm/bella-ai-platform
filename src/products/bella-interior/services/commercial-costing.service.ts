/**
 * Service 2: Commercial & Costing Service
 *
 * Implements Furniture BOQ/BOM itemization, Tripartite Costing calculation,
 * Quotations, and Contract Milestone Payment schedules.
 *
 * @module src/products/bella-interior/services
 */

import { randomUUID } from 'crypto';
import {
  TenantIsolationViolationError,
  ApprovedDesignLockViolationError,
  MilestonePercentageSumError,
} from '../domain/errors';
import type {
  InteriorBOQ,
  BOQItem,
  InteriorQuotation,
  InteriorContract,
  PaymentMilestone,
} from '../domain/commercial-costing/types';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type { InteriorOutboxPort } from '../ports/interior-outbox.port';

export class CommercialCostingService {
  constructor(
    private readonly repository: IInteriorRepository,
    private readonly outbox?: InteriorOutboxPort
  ) {}

  async createBOQFromApprovedDesign(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly designRevisionId: string;
    readonly boqNumber: string;
    readonly preparedBy: string;
    readonly rawItems: Array<{
      readonly roomZoneId: string;
      readonly roomZoneName: string;
      readonly itemCode: string;
      readonly itemName: string;
      readonly category: BOQItem['category'];
      readonly dimensions: BOQItem['dimensions'];
      readonly specifications: BOQItem['specifications'];
      readonly unit: BOQItem['unit'];
      readonly quantity: number;
      readonly internalUnitCost: number;
      readonly clientUnitPrice: number;
    }>;
  }): Promise<InteriorBOQ> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    // Verify Design Revision status — Approved Design Lock
    const revision = await this.repository.getDesignRevision(input.tenantId, input.designRevisionId);
    if (!revision) {
      throw new Error(`Design revision ${input.designRevisionId} not found`);
    }

    if (revision.status !== 'approved') {
      throw new ApprovedDesignLockViolationError(revision.versionNumber, revision.status);
    }

    const boqId = randomUUID();
    const now = new Date().toISOString();

    let totalInternalCost = 0;
    let totalClientPrice = 0;

    const items: BOQItem[] = input.rawItems.map((raw) => {
      const internalTotalCost = raw.internalUnitCost * raw.quantity;
      const clientTotalPrice = raw.clientUnitPrice * raw.quantity;
      const grossMarginAmount = clientTotalPrice - internalTotalCost;
      const grossMarginPercent = clientTotalPrice > 0 ? (grossMarginAmount / clientTotalPrice) * 100 : 0;

      totalInternalCost += internalTotalCost;
      totalClientPrice += clientTotalPrice;

      return {
        id: randomUUID(),
        tenantId: input.tenantId,
        boqId,
        roomZoneId: raw.roomZoneId,
        roomZoneName: raw.roomZoneName,
        itemCode: raw.itemCode,
        itemName: raw.itemName,
        category: raw.category,
        dimensions: raw.dimensions,
        specifications: raw.specifications,
        unit: raw.unit,
        quantity: raw.quantity,
        internalUnitCost: raw.internalUnitCost,
        internalTotalCost,
        clientUnitPrice: raw.clientUnitPrice,
        clientTotalPrice,
        grossMarginAmount,
        grossMarginPercent,
      };
    });

    const totalGrossMargin = totalClientPrice - totalInternalCost;
    const grossMarginPercent = totalClientPrice > 0 ? (totalGrossMargin / totalClientPrice) * 100 : 0;

    const boq: InteriorBOQ = {
      id: boqId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      designRevisionId: input.designRevisionId,
      boqNumber: input.boqNumber,
      versionNumber: 1,
      status: 'approved',
      totalInternalCost,
      totalClientPrice,
      totalGrossMargin,
      grossMarginPercent,
      items,
      preparedBy: input.preparedBy,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveBOQ(input.tenantId, boq);
    return boq;
  }

  async createQuotation(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly boqId: string;
    readonly quotationNumber: string;
    readonly actorId: string;
    readonly actorName?: string;
    readonly discountAmount?: number;
    readonly vatPercent?: number;
    readonly paymentTerms?: string;
    readonly validityDays?: number;
  }): Promise<InteriorQuotation> {
    if (!input.tenantId || !input.actorId.trim()) throw new TenantIsolationViolationError();

    const boq = await this.repository.getBOQ(input.tenantId, input.boqId);
    if (!boq) throw new Error(`BOQ ${input.boqId} not found`);

    const quotationId = randomUUID();
    const now = new Date().toISOString();
    const items = boq.items.map((item) => {
      const internalTotalCost = Math.round(item.internalUnitCost * item.quantity);
      const clientTotalPrice = Math.round(item.clientUnitPrice * item.quantity);
      const grossMarginAmount = clientTotalPrice - internalTotalCost;
      return {
        id: randomUUID(),
        tenantId: input.tenantId,
        quotationId,
        boqItemId: item.id,
        stableComponentId: item.stableComponentId,
        roomZoneName: item.roomZoneName,
        itemCode: item.itemCode,
        itemName: item.itemName,
        category: item.category,
        specifications: [
          item.specifications?.carcassMaterial,
          item.specifications?.doorFrontMaterial,
          item.specifications?.surfaceFinish,
          item.specifications?.hardwareSpec,
          item.specifications?.stoneOrGlassSpec,
        ].filter(Boolean).join('; '),
        unit: item.unit,
        quantity: item.quantity,
        internalUnitCost: item.internalUnitCost,
        internalTotalCost,
        markupPercent: item.internalUnitCost > 0
          ? Math.round(((item.clientUnitPrice - item.internalUnitCost) / item.internalUnitCost) * 1000) / 10
          : 0,
        clientUnitPrice: item.clientUnitPrice,
        clientTotalPrice,
        grossMarginAmount,
        grossMarginPercent: clientTotalPrice > 0
          ? Math.round((grossMarginAmount / clientTotalPrice) * 1000) / 10
          : 0,
      };
    });
    if (items.length === 0 || items.some((item) => item.clientUnitPrice <= 0)) {
      throw new Error('QuotationPriceRequired: every BOQ item must have an approved client unit price.');
    }
    const subtotal = items.reduce((total, item) => total + item.clientTotalPrice, 0);
    const totalInternalCogs = items.reduce((total, item) => total + item.internalTotalCost, 0);
    const discountAmount = input.discountAmount ?? 0;
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal) {
      throw new Error('QuotationTermsInvalid: discount must be between zero and the quotation subtotal.');
    }
    const discountedTotal = subtotal - discountAmount;
    const vatPercent = input.vatPercent ?? 8;
    if (!Number.isFinite(vatPercent) || vatPercent < 0 || vatPercent > 100) {
      throw new Error('QuotationTermsInvalid: VAT percentage must be from 0 to 100.');
    }
    const vatAmount = Math.round((discountedTotal * vatPercent) / 100);
    const grandTotal = discountedTotal + vatAmount;

    const quotation: InteriorQuotation = {
      id: quotationId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      boqId: input.boqId,
      boqVersionNumber: boq.versionNumber,
      quotationNumber: input.quotationNumber,
      versionNumber: 1,
      status: 'draft',
      subtotal,
      discountAmount,
      vatPercent,
      vatAmount,
      grandTotal,
      paymentTerms: input.paymentTerms ?? 'Thanh toán chia làm 5 đợt theo mốc tiến độ thi công',
      validityDays: input.validityDays ?? 30,
      createdAt: now,
      totalInternalCogs,
      totalGrossMargin: subtotal - discountAmount - totalInternalCogs,
      grossMarginPercent: discountedTotal > 0
        ? Math.round(((subtotal - discountAmount - totalInternalCogs) / discountedTotal) * 1000) / 10
        : 0,
      preparedBy: input.actorName?.trim() || input.actorId,
      items,
    };

    await this.repository.createQuotationSnapshot(input.tenantId, quotation);
    return quotation;
  }

  async finalizeContract(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly quotationId: string;
    readonly quotationCustomerApprovalId: string;
    readonly contractNumber: string;
    readonly title: string;
    readonly clientRepresentative: string;
    readonly contractorRepresentative: string;
    readonly milestones: Array<{
      readonly milestoneOrder: number;
      readonly name: string;
      readonly percentage: number;
      readonly triggerCondition: string;
      readonly dueDate?: string;
    }>;
  }): Promise<InteriorContract> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const quotation = await this.repository.getQuotation(input.tenantId, input.quotationId);
    if (!quotation) throw new Error(`Quotation ${input.quotationId} not found`);
    if (quotation.status !== 'accepted') {
      throw new Error(`ContractQuotationStatusViolation: quotation must be accepted; current status is '${quotation.status}'.`);
    }
    const quotationApproval = await this.repository.getCustomerApproval(
      input.tenantId,
      input.quotationCustomerApprovalId,
    );
    if (!quotationApproval
      || quotationApproval.tenantId !== input.tenantId
      || quotationApproval.subjectType !== 'quotation'
      || quotationApproval.subjectId !== quotation.id
      || quotationApproval.subjectVersionNumber !== quotation.versionNumber
      || quotationApproval.status !== 'approved'
      || !quotationApproval.approvedAt) {
      throw new Error('QuotationCustomerApprovalRequired: exact quotation version approval evidence is required.');
    }

    const boq = await this.repository.getBOQ(input.tenantId, quotation.boqId);
    if (!boq || boq.versionNumber !== quotation.boqVersionNumber) {
      throw new Error('QuotationBOQLineageMismatch: contract must use the exact BOQ version quoted to the customer.');
    }
    const designRevision = await this.repository.getDesignRevision(input.tenantId, boq.designRevisionId);
    if (!designRevision) {
      throw new Error('ContractDesignLineageMissing: referenced design revision was not found.');
    }

    // Verify milestone percentages sum to 100%
    const totalPercentage = input.milestones.reduce((acc, m) => acc + m.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new MilestonePercentageSumError(totalPercentage);
    }

    const contractId = randomUUID();
    const contractValue = quotation.grandTotal;
    const now = new Date().toISOString();

    const milestones: PaymentMilestone[] = input.milestones.map((m) => ({
      id: randomUUID(),
      tenantId: input.tenantId,
      contractId,
      milestoneOrder: m.milestoneOrder,
      name: m.name,
      percentage: m.percentage,
      amount: (contractValue * m.percentage) / 100,
      triggerCondition: m.triggerCondition,
      status: 'pending',
      dueDate: m.dueDate,
    }));

    const contract: InteriorContract = {
      id: contractId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      quotationId: input.quotationId,
      contractNumber: input.contractNumber,
      title: input.title,
      status: 'draft',
      baselineContractValue: contractValue,
      currentContractValue: contractValue,
      signedDate: null,
      quotationCustomerApprovalId: quotationApproval.id,
      clientRepresentative: input.clientRepresentative,
      contractorRepresentative: input.contractorRepresentative,
      milestones,
      addenda: [],
      quotationNumber: quotation.quotationNumber,
      quotationVersionNumber: quotation.versionNumber,
      boqId: boq.id,
      boqVersionNumber: boq.versionNumber,
      designRevisionId: designRevision.id,
      designVersionNumber: designRevision.versionNumber,
    };

    await this.repository.createContractWithMilestones(input.tenantId, contract);

    return contract;
  }
}
