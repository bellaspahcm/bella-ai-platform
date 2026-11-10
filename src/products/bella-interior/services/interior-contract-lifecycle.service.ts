/**
 * Bella Interior OS — Commercial Proposal Phase 3: Contract & Payment Milestone Service
 *
 * Implements:
 * - Quotation-to-Contract conversion (gated strictly on 'accepted' quotations)
 * - Milestone payment schedule generation & percentage/amount reconciliation (sum = 100%)
 * - Contract Variation Orders / Addenda management (preserving baseline value)
 * - Milestone invoice issuance & payment receipt transaction recording
 * - Financial summary & accounts receivable progress calculation
 * - Platform Finance Outbox event publication (Event-After-Persistence)
 * - Separation of Duties & Canonical RBAC Guard
 *
 * @module src/products/bella-interior/services/interior-contract-lifecycle.service
 */

import { randomUUID } from 'crypto';
import { TenantIsolationViolationError } from '../domain/errors';
import type { IInteriorRepository } from '../repositories/interior-repository.interface';
import type { InteriorOutboxPort } from '../ports/interior-outbox.port';
import type {
  InteriorContract,
  PaymentMilestone,
  ContractAddendum,
} from '../domain/commercial-costing/types';
import type {
  MilestoneScheduleTemplate,
  MilestoneTemplateCode,
  CreateContractFromQuotationInput,
  CreateAddendumInput,
  PaymentTransaction,
  RecordPaymentTransactionInput,
  IssueMilestoneInvoiceInput,
  ContractFinancialSummary,
} from '../domain/commercial-costing/contract.types';

// Canonical RBAC roles authorized to manage contract financial lifecycle
export const CANONICAL_CONTRACT_MANAGEMENT_ROLES = [
  'owner',
  'admin',
  'director',
  'executive',
  'pm',
  'qs',
] as const;

export const CANONICAL_PAYMENT_RECORDING_ROLES = [
  'owner',
  'admin',
  'qs',
] as const;

export class InteriorContractLifecycleService {
  /** Predefined Canonical Milestone Schedule Templates */
  public static readonly MILESTONE_TEMPLATES: Record<MilestoneTemplateCode, MilestoneScheduleTemplate> = {
    '3_STEP_STANDARD': {
      code: '3_STEP_STANDARD',
      title: 'Lịch thanh toán 3 đợt chuẩn',
      description: 'Phù hợp các gói thi công nội thất quy mô vừa (Tạm ứng 40% - Giao hàng 40% - Nghiệm thu 20%)',
      steps: [
        {
          order: 1,
          name: 'Đợt 1: Ký hợp đồng & Đặt cọc sản xuất',
          percentage: 40,
          triggerCondition: 'Ngay sau khi ký kết hợp đồng thi công chính thức',
          relativeDaysFromStart: 3,
        },
        {
          order: 2,
          name: 'Đợt 2: Tập kết đồ gỗ & vật tư tại công trình',
          percentage: 40,
          triggerCondition: 'Khi toàn bộ đồ gỗ và thiết bị bàn giao tại công trình sẵn sàng lắp đặt',
          relativeDaysFromStart: 30,
        },
        {
          order: 3,
          name: 'Đợt 3: Nghiệm thu bàn giao & Quyết toán',
          percentage: 20,
          triggerCondition: 'Sau khi ký Biên bản nghiệm thu bàn giao và hồ sơ quyết toán',
          relativeDaysFromStart: 45,
        },
      ],
    },
    '4_STEP_BALANCED': {
      code: '4_STEP_BALANCED',
      title: 'Lịch thanh toán 4 đợt cân bằng',
      description: 'Phù hợp công trình cao cấp cần kiểm soát dòng tiền chặt chẽ (30% - 30% - 30% - 10%)',
      steps: [
        {
          order: 1,
          name: 'Đợt 1: Đặt cọc ký hợp đồng',
          percentage: 30,
          triggerCondition: 'Ngay sau khi hợp đồng có hiệu lực',
          relativeDaysFromStart: 3,
        },
        {
          order: 2,
          name: 'Đợt 2: Khởi động sản xuất tại xưởng',
          percentage: 30,
          triggerCondition: 'Sau khi hoàn tất hồ sơ bóc tách chi tiết kỹ thuật sản xuất',
          relativeDaysFromStart: 15,
        },
        {
          order: 3,
          name: 'Đợt 3: Vận chuyển & Lắp đặt hoàn thiện',
          percentage: 30,
          triggerCondition: 'Khi hàng hóa được chuyển đến công trường và hoàn thành lắp ráp 90%',
          relativeDaysFromStart: 35,
        },
        {
          order: 4,
          name: 'Đợt 4: Nghiệm thu bàn giao & Bảo hành',
          percentage: 10,
          triggerCondition: 'Sau khi ký biên bản bàn giao hoàn thành và phát hành chứng thư bảo hành',
          relativeDaysFromStart: 50,
        },
      ],
    },
    '5_STEP_DUBAI_CANONICAL': {
      code: '5_STEP_DUBAI_CANONICAL',
      title: 'Lịch thanh toán 5 đợt chuẩn Biệt thự Luxury',
      description: 'Kế thừa chuẩn dự án tham chiếu Dubai Luxury Villa (30% - 20% - 20% - 25% - 5%)',
      steps: [
        {
          order: 1,
          name: 'Đợt 1: Đặt cọc ký hợp đồng',
          percentage: 30,
          triggerCondition: 'Ký kết hợp đồng thi công chính thức',
          relativeDaysFromStart: 3,
        },
        {
          order: 2,
          name: 'Đợt 2: Nghiệm thu phần thô & Khung gỗ tại xưởng',
          percentage: 20,
          triggerCondition: 'Khách hàng hoặc giám sát nghiệm thu mộc thô tại xưởng',
          relativeDaysFromStart: 20,
        },
        {
          order: 3,
          name: 'Đợt 3: Vận chuyển & Lắp đặt tại công trình',
          percentage: 20,
          triggerCondition: 'Bàn giao thiết bị và đồ nội thất tại hiện trường công trình',
          relativeDaysFromStart: 35,
        },
        {
          order: 4,
          name: 'Đợt 4: Nghiệm thu tổng thể & Bàn giao sử dụng',
          percentage: 25,
          triggerCondition: 'Ký biên bản nghiệm thu đưa vào sử dụng',
          relativeDaysFromStart: 50,
        },
        {
          order: 5,
          name: 'Đợt 5: Quyết toán giữ lại bảo hành',
          percentage: 5,
          triggerCondition: 'Hết thời hạn bảo hành 12 tháng hoặc phát hành thư bảo lãnh bảo hành',
          relativeDaysFromStart: 365,
        },
      ],
    },
    'CUSTOM': {
      code: 'CUSTOM',
      title: 'Lịch thanh toán tùy biến',
      description: 'Lịch thanh toán theo thỏa thuận riêng giữa Chủ đầu tư và Nhà thầu',
      steps: [],
    },
  };

  constructor(
    private readonly repository: IInteriorRepository,
    private readonly outbox?: InteriorOutboxPort
  ) {}

  /**
   * RBAC Guard: Ensures caller possesses commercial management role.
   */
  private assertAuthorizedRole(userRole: string, allowedRoles: readonly string[] = CANONICAL_CONTRACT_MANAGEMENT_ROLES): void {
    const normalized = userRole.trim().toLowerCase();
    if (!allowedRoles.includes(normalized)) {
      throw new Error(
        `AuthorizationViolation: Role "${userRole}" is not authorized for contract operations. Required: ${allowedRoles.join(', ')}.`
      );
    }
  }

  /**
   * Convert an accepted Quotation into an official InteriorContract.
   * Checkpoint 1: Rejects quotations not in 'accepted' status.
   * Checkpoint 2: Captures complete lineage (quotationId, quotationNumber, boqId, boqVersion).
   * Checkpoint 3: Reconciles milestone percentages (100%) and amounts.
   */
  async createContractFromQuotation(input: CreateContractFromQuotationInput): Promise<InteriorContract> {
    if (!input.tenantId) throw new TenantIsolationViolationError('tenantId is required');
    this.assertAuthorizedRole(input.userRole, CANONICAL_CONTRACT_MANAGEMENT_ROLES);

    // 1. Fetch and validate source Quotation
    const quotation = await this.repository.getQuotation(input.tenantId, input.quotationId);
    if (!quotation) {
      throw new Error(`QuotationNotFound: Quotation "${input.quotationId}" not found for tenant "${input.tenantId}".`);
    }

    if (quotation.projectId !== input.projectId) {
      throw new Error(
        `QuotationProjectMismatch: Quotation project "${quotation.projectId}" does not match contract project "${input.projectId}".`
      );
    }

    // Checkpoint 1: Accepted Quotation Prerequisite
    if (quotation.status !== 'accepted') {
      throw new Error(
        `ContractQuotationStatusViolation: Cannot create contract from quotation in "${quotation.status}" status. Quotation must be 'accepted'.`
      );
    }

    const now = new Date().toISOString();
    const contractId = randomUUID();
    const contractValue = quotation.grandTotal;

    // 2. Resolve Milestones Definition
    let milestoneDefs: ReadonlyArray<{
      readonly milestoneOrder: number;
      readonly name: string;
      readonly percentage: number;
      readonly triggerCondition: string;
      readonly dueDate?: string;
    }>;

    if (input.customMilestones && input.customMilestones.length > 0) {
      milestoneDefs = input.customMilestones;
    } else {
      const templateCode = input.milestoneTemplate ?? '5_STEP_DUBAI_CANONICAL';
      const template = InteriorContractLifecycleService.MILESTONE_TEMPLATES[templateCode];
      if (!template || template.steps.length === 0) {
        throw new Error(`InvalidMilestoneTemplate: Template "${templateCode}" has no steps.`);
      }
      const baseDate = input.executionStartDate ? new Date(input.executionStartDate) : new Date();
      milestoneDefs = template.steps.map((s) => {
        let dueDate: string | undefined;
        if (s.relativeDaysFromStart != null) {
          const d = new Date(baseDate.getTime() + s.relativeDaysFromStart * 86_400_000);
          dueDate = d.toISOString().split('T')[0];
        }
        return {
          milestoneOrder: s.order,
          name: s.name,
          percentage: s.percentage,
          triggerCondition: s.triggerCondition,
          dueDate,
        };
      });
    }

    // Checkpoint 3: Percentage reconciliation (sum === 100%)
    const totalPercentage = milestoneDefs.reduce((acc, m) => acc + m.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(
        `MilestonePercentageSumError: Total milestone percentage is ${totalPercentage}%, must equal exactly 100%.`
      );
    }

    // Checkpoint 3: Amount reconciliation with roundoff delta absorption on final step
    let accumulatedAmount = 0;
    const milestones: PaymentMilestone[] = milestoneDefs.map((m, index) => {
      const isLast = index === milestoneDefs.length - 1;
      let milestoneAmount = Math.round((contractValue * m.percentage) / 100);
      if (isLast) {
        milestoneAmount = contractValue - accumulatedAmount;
      } else {
        accumulatedAmount += milestoneAmount;
      }

      return {
        id: randomUUID(),
        tenantId: input.tenantId,
        contractId,
        milestoneOrder: m.milestoneOrder,
        name: m.name,
        percentage: m.percentage,
        amount: milestoneAmount,
        triggerCondition: m.triggerCondition,
        status: 'pending',
        dueDate: m.dueDate,
        collectedAmount: 0,
        invoiceStatus: 'unissued',
      };
    });

    // 3. Assemble Contract Canonical Model (Checkpoint 2: Lineage Linkage)
    const contract: InteriorContract = {
      id: contractId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      quotationId: quotation.id,
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
      quotationNumber: quotation.quotationNumber,
      quotationVersionNumber: quotation.versionNumber,
      boqId: quotation.boqId,
      boqVersionNumber: quotation.boqVersionNumber ?? 1,
      paymentTerms: input.paymentTerms ?? quotation.paymentTerms,
      executionStartDate: input.executionStartDate,
      executionEndDate: input.executionEndDate,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    // 4. Save contract to repository
    await this.repository.saveContract(input.tenantId, contract);

    // 5. Update Project Status to 'contracted'
    const project = await this.repository.getProject(input.tenantId, input.projectId);
    if (project) {
      await this.repository.saveProject(input.tenantId, {
        ...project,
        status: 'contracted',
        updatedAt: now,
      });
    }

    // 6. Checkpoint 6: Emit Platform Finance Outbox Events
    if (this.outbox) {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'interior_contract',
        aggregateId: contract.id,
        eventType: 'interior.contract.signed.v1',
        occurredAt: now,
        actorId: input.actorId ?? input.contractorRepresentative,
        actorName: input.contractorRepresentative,
        payload: {
          projectId: input.projectId,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          baselineContractValue: contract.baselineContractValue,
          quotationId: quotation.id,
          boqId: quotation.boqId,
          clientName: input.clientRepresentative,
        },
      });

      // Enqueue Milestone #1 (Tạm ứng) to Finance Outbox
      const firstMilestone = milestones[0];
      if (firstMilestone) {
        await this.outbox.enqueueFinanceMilestone({
          tenantId: input.tenantId,
          projectId: input.projectId,
          contractId: contract.id,
          milestoneOrder: firstMilestone.milestoneOrder,
          milestoneName: firstMilestone.name,
          amount: firstMilestone.amount,
          currency: 'VND',
          clientName: input.clientRepresentative,
          occurredAt: now,
        });
      }
    }

    return contract;
  }

  /**
   * Create an Addendum / Variation Order for an existing contract.
   * Checkpoint 4: Separation of Baseline and Current Contract Value.
   */
  async createAddendum(input: CreateAddendumInput): Promise<ContractAddendum> {
    if (!input.tenantId) throw new TenantIsolationViolationError('tenantId is required');
    this.assertAuthorizedRole(input.userRole, CANONICAL_CONTRACT_MANAGEMENT_ROLES);

    const contract = await this.repository.getContract(input.tenantId, input.contractId);
    if (!contract) {
      throw new Error(`ContractNotFound: Contract "${input.contractId}" not found for tenant "${input.tenantId}".`);
    }

    if (contract.status === 'completed' || contract.status === 'terminated') {
      throw new Error(`ContractLifecycleError: Cannot add addendum to a "${contract.status}" contract.`);
    }

    const now = input.approvedAt ?? new Date().toISOString();
    const addendum: ContractAddendum = {
      id: randomUUID(),
      tenantId: input.tenantId,
      contractId: input.contractId,
      addendumNumber: input.addendumNumber,
      title: input.title,
      valueDelta: input.valueDelta,
      reason: input.reason,
      approvedAt: now,
    };

    // Save addendum (repository automatically adjusts contract currentContractValue)
    await this.repository.saveContractAddendum(input.tenantId, addendum);

    // If requested, adjust unpaid milestones proportionally
    if (input.adjustUnpaidMilestones) {
      const refreshedContract = await this.repository.getContract(input.tenantId, input.contractId);
      if (refreshedContract) {
        const unpaidMilestones = refreshedContract.milestones.filter((m) => m.status !== 'paid');
        if (unpaidMilestones.length > 0) {
          const totalUnpaidPercentage = unpaidMilestones.reduce((acc, m) => acc + m.percentage, 0);
          if (totalUnpaidPercentage > 0) {
            const adjustedMilestones = refreshedContract.milestones.map((m) => {
              if (m.status !== 'paid') {
                const proportion = m.percentage / totalUnpaidPercentage;
                const additionalAmount = Math.round(input.valueDelta * proportion);
                return {
                  ...m,
                  amount: m.amount + additionalAmount,
                };
              }
              return m;
            });
            await this.repository.saveContract(input.tenantId, {
              ...refreshedContract,
              milestones: adjustedMilestones,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Publish Outbox event for addendum
    if (this.outbox) {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'interior_contract',
        aggregateId: contract.id,
        eventType: 'interior.contract.addendum_approved.v1',
        occurredAt: now,
        actorId: input.actorId ?? 'system',
        actorName: input.userRole,
        payload: {
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          addendumNumber: addendum.addendumNumber,
          valueDelta: addendum.valueDelta,
          newCurrentValue: contract.currentContractValue + addendum.valueDelta,
        },
      });
    }

    return addendum;
  }

  /**
   * Record a payment receipt transaction against a specific milestone.
   * Reconciles milestone collectedAmount and status.
   */
  async recordPayment(input: RecordPaymentTransactionInput): Promise<PaymentTransaction> {
    if (!input.tenantId) throw new TenantIsolationViolationError('tenantId is required');
    this.assertAuthorizedRole(input.userRole, CANONICAL_PAYMENT_RECORDING_ROLES);

    if (input.amount <= 0) {
      throw new Error(`InvalidPaymentAmount: Payment amount must be greater than 0, received ${input.amount}.`);
    }

    const contract = await this.repository.getContract(input.tenantId, input.contractId);
    if (!contract) {
      throw new Error(`ContractNotFound: Contract "${input.contractId}" not found for tenant "${input.tenantId}".`);
    }

    const milestone = contract.milestones.find((m) => m.id === input.milestoneId);
    if (!milestone) {
      throw new Error(
        `MilestoneNotFound: Milestone "${input.milestoneId}" not found in contract "${input.contractId}".`
      );
    }

    // Checkpoint 7B: Duplicate Payment Prevention (Idempotency Guard)
    const existingTransactions = await this.repository.listPaymentTransactions(input.tenantId, input.contractId);
    const isDuplicate = existingTransactions.some(
      (tx) => tx.referenceCode.trim().toLowerCase() === input.referenceCode.trim().toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(
        `DuplicatePaymentTransaction: A transaction with referenceCode "${input.referenceCode}" has already been recorded for contract "${input.contractId}".`
      );
    }

    const now = new Date().toISOString();
    const transaction: PaymentTransaction = {
      id: randomUUID(),
      tenantId: input.tenantId,
      contractId: input.contractId,
      milestoneId: input.milestoneId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      referenceCode: input.referenceCode,
      transactionDate: input.transactionDate,
      proofUrl: input.proofUrl,
      notes: input.notes,
      recordedBy: input.recordedBy,
      createdAt: now,
    };

    // Save transaction and reconcile milestone collected amount
    await this.repository.savePaymentTransaction(input.tenantId, transaction);

    // Publish Outbox event for milestone payment
    if (this.outbox) {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'interior_contract',
        aggregateId: contract.id,
        eventType: 'interior.milestone.paid.v1',
        occurredAt: now,
        actorId: input.recordedBy,
        actorName: input.userRole,
        payload: {
          contractId: contract.id,
          milestoneId: milestone.id,
          milestoneOrder: milestone.milestoneOrder,
          amountPaid: input.amount,
          referenceCode: input.referenceCode,
          transactionDate: input.transactionDate,
        },
      });
    }

    return transaction;
  }

  /**
   * Issue an official invoice for a payment milestone.
   */
  async issueMilestoneInvoice(input: IssueMilestoneInvoiceInput): Promise<PaymentMilestone> {
    if (!input.tenantId) throw new TenantIsolationViolationError('tenantId is required');
    this.assertAuthorizedRole(input.userRole, CANONICAL_CONTRACT_MANAGEMENT_ROLES);

    const contract = await this.repository.getContract(input.tenantId, input.contractId);
    if (!contract) {
      throw new Error(`ContractNotFound: Contract "${input.contractId}" not found for tenant "${input.tenantId}".`);
    }

    const milestone = contract.milestones.find((m) => m.id === input.milestoneId);
    if (!milestone) {
      throw new Error(
        `MilestoneNotFound: Milestone "${input.milestoneId}" not found in contract "${input.contractId}".`
      );
    }

    const now = input.invoicedAt ?? new Date().toISOString();
    const updatedMilestones = contract.milestones.map((m) => {
      if (m.id === input.milestoneId) {
        return {
          ...m,
          status: (m.status === 'pending' ? 'invoiced' : m.status) as PaymentMilestone['status'],
          invoiceStatus: 'issued' as const,
          invoiceNumber: input.invoiceNumber,
          invoicedAt: now,
        };
      }
      return m;
    });

    await this.repository.saveContract(input.tenantId, {
      ...contract,
      milestones: updatedMilestones,
      updatedAt: now,
    });

    // Publish Outbox event for milestone invoiced
    if (this.outbox) {
      await this.outbox.publishDomainEvent({
        id: randomUUID(),
        tenantId: input.tenantId,
        aggregateType: 'interior_contract',
        aggregateId: contract.id,
        eventType: 'interior.milestone.invoiced.v1',
        occurredAt: now,
        actorId: input.userRole,
        actorName: input.userRole,
        payload: {
          contractId: contract.id,
          milestoneId: milestone.id,
          milestoneOrder: milestone.milestoneOrder,
          invoiceNumber: input.invoiceNumber,
          amount: milestone.amount,
        },
      });
    }

    return updatedMilestones.find((m) => m.id === input.milestoneId)!;
  }

  /**
   * Calculate financial summary and collection status for a contract.
   */
  async getFinancialSummary(tenantId: string, contractId: string): Promise<ContractFinancialSummary> {
    if (!tenantId) throw new TenantIsolationViolationError('tenantId is required');

    const contract = await this.repository.getContract(tenantId, contractId);
    if (!contract) {
      throw new Error(`ContractNotFound: Contract "${contractId}" not found for tenant "${tenantId}".`);
    }

    const baselineContractValue = contract.baselineContractValue;
    const totalAddendaValue = (contract.addenda ?? []).reduce((acc, a) => acc + a.valueDelta, 0);
    const currentContractValue = contract.currentContractValue;

    const totalCollectedAmount = contract.milestones.reduce((acc, m) => acc + (m.collectedAmount ?? 0), 0);
    const remainingBalance = Math.max(0, currentContractValue - totalCollectedAmount);
    const collectionPercentage = currentContractValue > 0
      ? Math.round((totalCollectedAmount / currentContractValue) * 1000) / 10
      : 0;

    const now = new Date();
    let paidCount = 0;
    let invoicedCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    for (const m of contract.milestones) {
      if (m.status === 'paid') {
        paidCount++;
      } else if (m.status === 'invoiced') {
        invoicedCount++;
      } else {
        pendingCount++;
      }

      if (m.status !== 'paid' && m.dueDate) {
        const dueDate = new Date(m.dueDate);
        if (dueDate.getTime() < now.getTime()) {
          overdueCount++;
        }
      }
    }

    return {
      baselineContractValue,
      totalAddendaValue,
      currentContractValue,
      totalCollectedAmount,
      remainingBalance,
      collectionPercentage,
      totalMilestonesCount: contract.milestones.length,
      paidMilestonesCount: paidCount,
      invoicedMilestonesCount: invoicedCount,
      pendingMilestonesCount: pendingCount,
      overdueMilestonesCount: overdueCount,
      isFullyCollected: remainingBalance === 0 && totalCollectedAmount >= currentContractValue,
    };
  }
}
