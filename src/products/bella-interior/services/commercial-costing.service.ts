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
    readonly discountAmount?: number;
    readonly vatPercent?: number;
    readonly paymentTerms?: string;
    readonly validityDays?: number;
  }): Promise<InteriorQuotation> {
    if (!input.tenantId) throw new TenantIsolationViolationError();

    const boq = await this.repository.getBOQ(input.tenantId, input.boqId);
    if (!boq) throw new Error(`BOQ ${input.boqId} not found`);

    const subtotal = boq.totalClientPrice;
    const discountAmount = input.discountAmount ?? 0;
    const discountedTotal = Math.max(0, subtotal - discountAmount);
    const vatPercent = input.vatPercent ?? 8;
    const vatAmount = (discountedTotal * vatPercent) / 100;
    const grandTotal = discountedTotal + vatAmount;

    const quotation: InteriorQuotation = {
      id: randomUUID(),
      tenantId: input.tenantId,
      projectId: input.projectId,
      boqId: input.boqId,
      quotationNumber: input.quotationNumber,
      versionNumber: 1,
      status: 'accepted',
      subtotal,
      discountAmount,
      vatPercent,
      vatAmount,
      grandTotal,
      paymentTerms: input.paymentTerms ?? 'Thanh toán chia làm 5 đợt theo mốc tiến độ thi công',
      validityDays: input.validityDays ?? 30,
      createdAt: new Date().toISOString(),
    };

    await this.repository.saveQuotation(input.tenantId, quotation);
    return quotation;
  }

  async finalizeContract(input: {
    readonly tenantId: string;
    readonly projectId: string;
    readonly quotationId: string;
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
      status: 'signed',
      baselineContractValue: contractValue,
      currentContractValue: contractValue,
      signedDate: now,
      clientRepresentative: input.clientRepresentative,
      contractorRepresentative: input.contractorRepresentative,
      milestones,
      addenda: [],
    };

    await this.repository.saveContract(input.tenantId, contract);

    // Update project status to contracted
    const project = await this.repository.getProject(input.tenantId, input.projectId);
    if (project) {
      await this.repository.saveProject(input.tenantId, {
        ...project,
        status: 'contracted',
        updatedAt: now,
      });
    }

    // Publish ContractSignedEvent & Queue First Milestone to Finance Outbox
    if (this.outbox) {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'interior_contract',
        aggregateId: contract.id,
        eventType: 'interior.contract.signed.v1',
        occurredAt: now,
        actorId: input.contractorRepresentative,
        actorName: input.clientRepresentative,
        payload: {
          projectId: input.projectId,
          contractId: contract.id,
          contractValue,
          clientName: input.clientRepresentative,
        },
      });

      // Enqueue Milestone #1 (Tạm ứng) to Finance Outbox
      const milestone1 = milestones[0];
      if (milestone1) {
        await this.outbox.enqueueFinanceMilestone({
          tenantId: input.tenantId,
          projectId: input.projectId,
          contractId: contract.id,
          milestoneOrder: milestone1.milestoneOrder,
          milestoneName: milestone1.name,
          amount: milestone1.amount,
          currency: 'VND',
          clientName: input.clientRepresentative,
          occurredAt: now,
        });
      }
    }

    return contract;
  }
}
