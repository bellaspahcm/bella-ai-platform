/**
 * Bella Interior OS — In-Memory Repository Implementation
 *
 * Provides thread-safe, tenant-isolated in-memory storage for testing and local execution.
 * Enforces Gate 0 Tenant Isolation on all methods.
 *
 * @module src/products/bella-interior/repositories
 */

import { TenantIsolationViolationError, TakeoffRunImmutableError } from '../domain/errors';
import type {
  InteriorCustomerApprovalAddendumSubject,
  InteriorCustomerApprovalContractSubject,
  IInteriorRepository,
  SaveBOQOptions,
} from './interior-repository.interface';
import type {
  BOQVersionHistoryItem,
  ForkBOQRevisionInput,
} from '../domain/commercial-costing/boq-version-diff.types';
import type {
  InteriorProject,
  ProjectRoomZone,
  DesignRevision,
} from '../domain/design-specification/types';
import type { DesignTakeoffRun } from '../domain/takeoff/types';
import type {
  InteriorBOQ,
  InteriorQuotation,
  InteriorContract,
  ContractAddendum,
  PaymentMilestone,
} from '../domain/commercial-costing/types';
import type { PaymentTransaction } from '../domain/commercial-costing/contract.types';
import type { CustomerApproval } from '../domain/commercial-costing/approval.types';
import type {
  ProductionOrder,
  SiteInstallationPlan,
} from '../domain/manufacturing-install/types';
import type {
  SiteDiaryEntry,
  QCPunchListItem,
  HandoverDossier,
  WarrantyCertificate,
  WarrantyServiceTicket,
} from '../domain/delivery-aftercare/types';

export class InMemoryInteriorRepository implements IInteriorRepository {
  private readonly projects = new Map<string, InteriorProject>();
  private readonly roomZones = new Map<string, ProjectRoomZone>();
  private readonly designRevisions = new Map<string, DesignRevision>();
  private readonly takeoffRuns = new Map<string, DesignTakeoffRun>();
  private readonly boqs = new Map<string, InteriorBOQ>();
  private readonly quotations = new Map<string, InteriorQuotation>();
  private readonly contracts = new Map<string, InteriorContract>();
  private readonly contractAddenda = new Map<string, ContractAddendum>();
  private readonly paymentTransactions = new Map<string, PaymentTransaction>();
  private readonly productionOrders = new Map<string, ProductionOrder>();
  private readonly installationPlans = new Map<string, SiteInstallationPlan>();
  private readonly siteDiaries = new Map<string, SiteDiaryEntry>();
  private readonly punchListItems = new Map<string, QCPunchListItem>();
  private readonly handoverDossiers = new Map<string, HandoverDossier>();
  private readonly warrantyCertificates = new Map<string, WarrantyCertificate>();
  private readonly warrantyTickets = new Map<string, WarrantyServiceTicket>();
  // Phase 4: Customer Approval
  private readonly customerApprovals = new Map<string, CustomerApproval>();

  private makeKey(tenantId: string, id: string): string {
    if (!tenantId) throw new TenantIsolationViolationError('tenantId is required');
    return `${tenantId}::${id}`;
  }

  // --- Design & Specification ---

  async saveProject(tenantId: string, project: InteriorProject): Promise<void> {
    if (project.tenantId !== tenantId) throw new TenantIsolationViolationError();
    this.projects.set(this.makeKey(tenantId, project.id), project);
  }

  async getProject(tenantId: string, projectId: string): Promise<InteriorProject | null> {
    return this.projects.get(this.makeKey(tenantId, projectId)) ?? null;
  }

  async listProjects(tenantId: string): Promise<InteriorProject[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: InteriorProject[] = [];
    for (const [key, val] of this.projects.entries()) {
      if (key.startsWith(`${tenantId}::`)) result.push(val);
    }
    return result;
  }

  async saveRoomZone(tenantId: string, roomZone: ProjectRoomZone): Promise<void> {
    if (roomZone.tenantId !== tenantId) throw new TenantIsolationViolationError();
    this.roomZones.set(this.makeKey(tenantId, roomZone.id), roomZone);
  }

  async listRoomZones(tenantId: string, projectId: string): Promise<ProjectRoomZone[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: ProjectRoomZone[] = [];
    for (const [key, val] of this.roomZones.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.projectId === projectId) {
        result.push(val);
      }
    }
    return result;
  }

  async saveDesignRevision(tenantId: string, revision: DesignRevision): Promise<void> {
    if (revision.tenantId !== tenantId) throw new TenantIsolationViolationError();
    this.designRevisions.set(this.makeKey(tenantId, revision.id), revision);
  }

  async getDesignRevision(tenantId: string, revisionId: string): Promise<DesignRevision | null> {
    return this.designRevisions.get(this.makeKey(tenantId, revisionId)) ?? null;
  }

  async listDesignRevisions(tenantId: string, projectId: string): Promise<DesignRevision[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: DesignRevision[] = [];
    for (const [key, val] of this.designRevisions.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.projectId === projectId) {
        result.push(val);
      }
    }
    return result.sort((a, b) => a.versionNumber - b.versionNumber);
  }

  // --- Design Takeoff Staging & Review (Phase 2A) ---

  async saveTakeoffRun(tenantId: string, run: DesignTakeoffRun): Promise<void> {
    if (run.tenantId !== tenantId) throw new TenantIsolationViolationError();
    const key = this.makeKey(tenantId, run.id);
    const existing = this.takeoffRuns.get(key);
    if (existing && existing.isImmutable) {
      throw new TakeoffRunImmutableError(run.id, existing.status);
    }
    // Deep clone snapshot so external in-memory references cannot mutate stored state
    this.takeoffRuns.set(key, JSON.parse(JSON.stringify(run)) as DesignTakeoffRun);
  }

  async getTakeoffRun(tenantId: string, runId: string): Promise<DesignTakeoffRun | null> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const run = this.takeoffRuns.get(this.makeKey(tenantId, runId));
    if (!run) return null;
    return JSON.parse(JSON.stringify(run)) as DesignTakeoffRun;
  }

  async listTakeoffRuns(tenantId: string, projectId: string): Promise<DesignTakeoffRun[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: DesignTakeoffRun[] = [];
    for (const [key, val] of this.takeoffRuns.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.projectId === projectId) {
        result.push(JSON.parse(JSON.stringify(val)) as DesignTakeoffRun);
      }
    }
    return result.sort((a, b) => a.runNumber - b.runNumber);
  }

  // --- Commercial & Costing ---

  async saveBOQ(tenantId: string, boq: InteriorBOQ, options?: SaveBOQOptions): Promise<void> {
    if (boq.tenantId !== tenantId) throw new TenantIsolationViolationError();
    const key = this.makeKey(tenantId, boq.id);
    const existing = this.boqs.get(key);

    if (existing && options?.expectedVersionNumber !== undefined && existing.versionNumber !== options.expectedVersionNumber) {
      throw new Error(
        `[InteriorRepo] ConcurrencyConflict: Expected version ${options.expectedVersionNumber}, but found ${existing.versionNumber}`
      );
    }

    if (existing && (existing.status === 'approved' || existing.status === 'locked_for_contract')) {
      const isStatusTransitionToLocked =
        existing.status === 'approved' && boq.status === 'locked_for_contract';
      if (!isStatusTransitionToLocked) {
        throw new Error(
          `[InteriorRepo] Immutability violation: BOQ ${boq.id} is '${existing.status}' and cannot be modified. Create a new revision.`
        );
      }
    }
    // Deep-copy snapshot to prevent external in-memory references from mutating stored state
    this.boqs.set(key, JSON.parse(JSON.stringify(boq)) as InteriorBOQ);
  }

  async getBOQ(tenantId: string, boqId: string): Promise<InteriorBOQ | null> {
    const boq = this.boqs.get(this.makeKey(tenantId, boqId));
    if (!boq) return null;
    return JSON.parse(JSON.stringify(boq)) as InteriorBOQ;
  }

  async getBOQByProject(tenantId: string, projectId: string): Promise<InteriorBOQ | null> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const revisions = await this.listBOQRevisions(tenantId, projectId);
    return revisions.length > 0 ? revisions[0] : null;
  }

  async listBOQRevisions(tenantId: string, projectId: string): Promise<InteriorBOQ[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: InteriorBOQ[] = [];
    for (const [key, val] of this.boqs.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.projectId === projectId) {
        result.push(JSON.parse(JSON.stringify(val)) as InteriorBOQ);
      }
    }
    return result.sort((a, b) => b.versionNumber - a.versionNumber);
  }

  /**
   * Forks an approved/locked BOQ into a new draft revision (in-memory — for unit tests).
   * Mirrors the behaviour of the fork_interior_boq_revision SQL RPC.
   */
  async forkBOQRevision(tenantId: string, input: ForkBOQRevisionInput): Promise<InteriorBOQ> {
    if (!tenantId) throw new TenantIsolationViolationError();

    const sourceKey = this.makeKey(tenantId, input.sourceBOQId);
    const source = this.boqs.get(sourceKey);
    if (!source) {
      throw new Error(`BOQNotFound: Source BOQ "${input.sourceBOQId}" not found for tenant "${tenantId}".`);
    }
    if (source.status !== 'approved' && source.status !== 'locked_for_contract') {
      throw new Error(
        `BOQForkViolation: Cannot fork BOQ in status "${source.status}". Must be approved or locked_for_contract.`
      );
    }

    // Seal the source (mutate in-place — controlled, isolated within test store)
    const sourceExtended = source as InteriorBOQ & { snapshotSealedAt?: string | null; forkedFromBoqId?: string | null; releaseNotes?: string | null };
    const sealedSource: InteriorBOQ & { snapshotSealedAt?: string; forkedFromBoqId?: string | null; releaseNotes?: string | null } = {
      ...source,
      snapshotSealedAt: sourceExtended.snapshotSealedAt ?? new Date().toISOString(),
    };
    this.boqs.set(sourceKey, JSON.parse(JSON.stringify(sealedSource)) as InteriorBOQ);

    // Build new boq_number
    const newVersionNumber = source.versionNumber + 1;
    const newBoqNumber = source.boqNumber.replace(/-V\d+$/, '') + `-V${newVersionNumber}`;
    const newBoqId = `boq-fork-${Date.now()}-${newVersionNumber}`;

    // Deep-copy items with new IDs, preserve stableComponentId lineage
    const newItems: (typeof source.items[0])[] = source.items.map((item) => ({
      ...item,
      id: `item-fork-${Date.now()}-${item.id.slice(-8)}`,
      boqId: newBoqId,
      syncStatus: 'active' as const,
      lineage: item.lineage
        ? {
            ...item.lineage,
            sourceBOQRevisionId: item.id, // 7th lineage field: source item ID
          }
        : undefined,
    }));

    const newDraftBOQ: InteriorBOQ & {
      forkedFromBoqId?: string | null;
      snapshotSealedAt?: string | null;
      releaseNotes?: string | null;
    } = {
      id: newBoqId,
      tenantId,
      projectId: source.projectId,
      designRevisionId: source.designRevisionId,
      boqNumber: newBoqNumber,
      versionNumber: newVersionNumber,
      status: 'draft',
      totalInternalCost: source.totalInternalCost,
      totalClientPrice: source.totalClientPrice,
      totalGrossMargin: source.totalGrossMargin,
      grossMarginPercent: source.grossMarginPercent,
      items: newItems,
      preparedBy: input.actorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      forkedFromBoqId: input.sourceBOQId,
      snapshotSealedAt: null,
      releaseNotes: input.releaseNotes ?? null,
    };

    this.boqs.set(this.makeKey(tenantId, newBoqId), JSON.parse(JSON.stringify(newDraftBOQ)) as InteriorBOQ);
    return JSON.parse(JSON.stringify(newDraftBOQ)) as InteriorBOQ;
  }

  /**
   * Lists all BOQ revisions for a project with fork lineage metadata.
   * In-memory implementation — mirrors the interior_boq_version_history view.
   */
  async listBOQVersionHistory(tenantId: string, projectId: string): Promise<BOQVersionHistoryItem[]> {
    if (!tenantId) throw new TenantIsolationViolationError();

    const revisions = await this.listBOQRevisions(tenantId, projectId);
    // listBOQRevisions returns desc order — reverse to asc for history
    revisions.sort((a, b) => a.versionNumber - b.versionNumber);

    return revisions.map((boq): BOQVersionHistoryItem => {
      const extended = boq as InteriorBOQ & {
        forkedFromBoqId?: string | null;
        snapshotSealedAt?: string | null;
        releaseNotes?: string | null;
      };

      // Find parent version number if forkedFromBoqId is set
      let forkedFromVersionNumber: number | null = null;
      if (extended.forkedFromBoqId) {
        const parentKey = this.makeKey(tenantId, extended.forkedFromBoqId);
        const parent = this.boqs.get(parentKey) as (InteriorBOQ & { versionNumber: number }) | undefined;
        forkedFromVersionNumber = parent?.versionNumber ?? null;
      }

      return {
        boqId:                    boq.id,
        tenantId:                 boq.tenantId,
        projectId:                boq.projectId,
        boqNumber:                boq.boqNumber,
        versionNumber:            boq.versionNumber,
        status:                   boq.status,
        forkedFromBoqId:          extended.forkedFromBoqId ?? null,
        forkedFromVersionNumber,
        snapshotSealedAt:         extended.snapshotSealedAt ?? null,
        releaseNotes:             extended.releaseNotes ?? null,
        preparedBy:               boq.preparedBy,
        createdAt:                boq.createdAt,
        totalClientPrice:         boq.totalClientPrice,
        totalInternalCost:        boq.totalInternalCost,
        totalGrossMargin:         boq.totalGrossMargin,
        grossMarginPercent:       boq.grossMarginPercent,
        itemCount:                boq.items.length,
      };
    });
  }

  async saveQuotation(tenantId: string, quotation: InteriorQuotation): Promise<void> {
    if (quotation.tenantId !== tenantId) throw new TenantIsolationViolationError();
    const key = this.makeKey(tenantId, quotation.id);
    const existing = this.quotations.get(key);

    if (existing && (existing.status === 'sent_to_client' || existing.status === 'accepted')) {
      // Allow status transitions (e.g. sent_to_client -> accepted / rejected)
      const isStatusTransitionOnly =
        existing.subtotal === quotation.subtotal &&
        existing.discountAmount === quotation.discountAmount &&
        existing.grandTotal === quotation.grandTotal &&
        existing.boqId === quotation.boqId;

      if (!isStatusTransitionOnly) {
        throw new Error(
          `QuotationImmutableError: Cannot modify financial terms of quotation "${existing.quotationNumber}" in status "${existing.status}". Create a new revision.`
        );
      }
    }

    this.quotations.set(key, JSON.parse(JSON.stringify(quotation)) as InteriorQuotation);
  }

  async createQuotationSnapshot(tenantId: string, quotation: InteriorQuotation): Promise<void> {
    if (!tenantId || quotation.tenantId !== tenantId) throw new TenantIsolationViolationError();
    if (!quotation.items?.length) throw new Error('QuotationSnapshotItemsRequired');
    if (this.quotations.has(this.makeKey(tenantId, quotation.id))) {
      throw new Error('QuotationSnapshotAlreadyExists');
    }
    const boq = await this.getBOQ(tenantId, quotation.boqId);
    if (!boq || boq.projectId !== quotation.projectId || boq.versionNumber !== quotation.boqVersionNumber
      || (boq.status !== 'approved' && boq.status !== 'locked_for_contract')) {
      throw new Error('QuotationBOQVersionMustBeApproved');
    }
    await this.saveQuotation(tenantId, quotation);
  }

  async getQuotation(tenantId: string, quotationId: string): Promise<InteriorQuotation | null> {
    return this.quotations.get(this.makeKey(tenantId, quotationId)) ?? null;
  }

  async listQuotationsByProject(tenantId: string, projectId: string): Promise<InteriorQuotation[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: InteriorQuotation[] = [];
    for (const [key, val] of this.quotations.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.projectId === projectId) {
        result.push(JSON.parse(JSON.stringify(val)) as InteriorQuotation);
      }
    }
    return result.sort((a, b) => b.versionNumber - a.versionNumber);
  }

  async listQuotationRevisions(tenantId: string, projectId: string): Promise<InteriorQuotation[]> {
    return this.listQuotationsByProject(tenantId, projectId);
  }

  async saveContract(tenantId: string, contract: InteriorContract): Promise<void> {
    if (contract.tenantId !== tenantId) throw new TenantIsolationViolationError();
    const existing = this.contracts.get(this.makeKey(tenantId, contract.id));
    if (existing && (existing.status === 'signed' || existing.status === 'active')) {
      if (existing.baselineContractValue !== contract.baselineContractValue) {
        throw new Error(
          `[InteriorRepo] Immutability violation: Contract ${contract.id} baseline value is sealed and cannot be modified directly. Use an addendum.`
        );
      }
    }
    this.contracts.set(this.makeKey(tenantId, contract.id), contract);
  }

  async createContractWithMilestones(tenantId: string, contract: InteriorContract): Promise<void> {
    if (this.contracts.has(this.makeKey(tenantId, contract.id))) {
      throw new Error('INTERIOR_CONTRACT_ALREADY_EXISTS');
    }
    await this.saveContract(tenantId, contract);
  }

  async getContract(tenantId: string, contractId: string): Promise<InteriorContract | null> {
    return this.contracts.get(this.makeKey(tenantId, contractId)) ?? null;
  }

  async getContractForCustomerApproval(tenantId: string, contractId: string): Promise<InteriorCustomerApprovalContractSubject | null> {
    const contract = await this.getContract(tenantId, contractId);
    if (!contract) return null;
    return {
      id: contract.id,
      tenantId: contract.tenantId,
      projectId: contract.projectId,
      status: contract.status,
      quotationVersionNumber: contract.quotationVersionNumber ?? 1,
    };
  }

  async getContractAddendumForCustomerApproval(
    tenantId: string,
    addendumId: string,
  ): Promise<InteriorCustomerApprovalAddendumSubject | null> {
    const addendum = this.contractAddenda.get(this.makeKey(tenantId, addendumId));
    if (!addendum) return null;
    const contract = await this.getContract(tenantId, addendum.contractId);
    if (!contract) return null;
    return {
      id: addendum.id,
      tenantId: addendum.tenantId,
      projectId: contract.projectId,
      status: addendum.status,
      versionNumber: 1,
      customerApprovalId: addendum.customerApprovalId ?? null,
    };
  }

  async getContractByProject(tenantId: string, projectId: string): Promise<InteriorContract | null> {
    if (!tenantId) throw new TenantIsolationViolationError();
    for (const [key, val] of this.contracts.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.projectId === projectId) {
        return val;
      }
    }
    return null;
  }

  async listContractsByProject(tenantId: string, projectId: string): Promise<InteriorContract[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: InteriorContract[] = [];
    for (const [key, val] of this.contracts.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.projectId === projectId) {
        result.push(val);
      }
    }
    return result;
  }

  async saveContractAddendum(tenantId: string, addendum: ContractAddendum): Promise<void> {
    if (addendum.tenantId !== tenantId) throw new TenantIsolationViolationError();
    if (addendum.status !== 'pending_customer_approval' || addendum.approvedAt !== null) {
      throw new Error('INTERIOR_ADDENDUM_MUST_START_PENDING_CUSTOMER_APPROVAL');
    }
    const contract = await this.getContract(tenantId, addendum.contractId);
    if (!contract) {
      throw new Error(`[InteriorRepo] Contract not found: ${addendum.contractId}`);
    }
    if (contract.addenda.some((existing) => existing.id !== addendum.id
      && existing.addendumNumber === addendum.addendumNumber)) {
      throw new Error('INTERIOR_ADDENDUM_NUMBER_ALREADY_EXISTS');
    }
    this.contractAddenda.set(this.makeKey(tenantId, addendum.id), addendum);

    // A pending proposal is visible on the contract but does not change its
    // commercial value or payment terms until the customer capability is used.
    const existingAddenda = contract.addenda.filter((a) => a.id !== addendum.id);
    const updatedAddenda = [...existingAddenda, addendum];
    const updatedContract: InteriorContract = {
      ...contract,
      addenda: updatedAddenda,
      updatedAt: new Date().toISOString(),
    };
    this.contracts.set(this.makeKey(tenantId, contract.id), updatedContract);
  }

  async listContractAddenda(tenantId: string, contractId: string): Promise<ContractAddendum[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: ContractAddendum[] = [];
    for (const [key, val] of this.contractAddenda.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.contractId === contractId) {
        result.push(val);
      }
    }
    return result.sort((a, b) => a.addendumNumber.localeCompare(b.addendumNumber));
  }

  async savePaymentTransaction(tenantId: string, transaction: PaymentTransaction): Promise<void> {
    if (transaction.tenantId !== tenantId) throw new TenantIsolationViolationError();
    if (!transaction.referenceCode.trim()) {
      throw new Error('PaymentReferenceCodeRequired: payment reference code must not be blank.');
    }
    await this.getContract(tenantId, transaction.contractId);
    // Re-read after the await so concurrent calls serialize on the current
    // in-memory aggregate just as the database trigger serializes on its row.
    const contract = this.contracts.get(this.makeKey(tenantId, transaction.contractId));
    if (!contract) {
      throw new Error(`[InteriorRepo] Contract not found: ${transaction.contractId}`);
    }

    // Unique constraint: (tenantId, contractId, referenceCode) - race condition guard
    for (const existing of this.paymentTransactions.values()) {
      if (
        existing.tenantId === tenantId &&
        existing.contractId === transaction.contractId &&
        existing.referenceCode.trim().toLocaleLowerCase('en-US') === transaction.referenceCode.trim().toLocaleLowerCase('en-US')
      ) {
        throw new Error(
          `DuplicatePaymentTransaction: A transaction with referenceCode "${transaction.referenceCode}" has already been recorded for contract "${transaction.contractId}".`
        );
      }
    }

    const paymentMilestone = contract.milestones.find((m) => m.id === transaction.milestoneId);
    if (!paymentMilestone || paymentMilestone.contractId !== contract.id) {
      throw new Error(`[InteriorRepo] Payment milestone not found: ${transaction.milestoneId}`);
    }
    const newCollectedAmount = (paymentMilestone.collectedAmount ?? 0) + transaction.amount;
    if (!Number.isFinite(transaction.amount) || transaction.amount <= 0 || newCollectedAmount > paymentMilestone.amount) {
      throw new Error('INTERIOR_PAYMENT_EXCEEDS_MILESTONE_BALANCE');
    }

    this.paymentTransactions.set(this.makeKey(tenantId, transaction.id), {
      ...transaction,
      referenceCode: transaction.referenceCode.trim(),
    });

    // Update receipt total and paid state atomically with the in-memory insert.
    const updatedMilestones = contract.milestones.map((m) => {
      if (m.id === transaction.milestoneId) {
        const isPaid = newCollectedAmount >= m.amount;
        return {
          ...m,
          collectedAmount: newCollectedAmount,
          status: (isPaid ? 'paid' : m.status) as PaymentMilestone['status'],
          paidAt: isPaid ? transaction.transactionDate : m.paidAt,
        };
      }
      return m;
    });

    const updatedContract: InteriorContract = {
      ...contract,
      milestones: updatedMilestones,
      updatedAt: new Date().toISOString(),
    };
    this.contracts.set(this.makeKey(tenantId, contract.id), updatedContract);
  }

  async listPaymentTransactions(
    tenantId: string,
    contractId: string,
    milestoneId?: string
  ): Promise<PaymentTransaction[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: PaymentTransaction[] = [];
    for (const [key, val] of this.paymentTransactions.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.contractId === contractId) {
        if (!milestoneId || val.milestoneId === milestoneId) {
          result.push(val);
        }
      }
    }
    return result.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }

  // --- Manufacturing & Installation ---

  async saveProductionOrder(tenantId: string, order: ProductionOrder): Promise<void> {
    if (order.tenantId !== tenantId) throw new TenantIsolationViolationError();
    this.productionOrders.set(this.makeKey(tenantId, order.id), order);
  }

  async getProductionOrder(tenantId: string, orderId: string): Promise<ProductionOrder | null> {
    return this.productionOrders.get(this.makeKey(tenantId, orderId)) ?? null;
  }

  async listProductionOrders(tenantId: string, projectId?: string): Promise<ProductionOrder[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: ProductionOrder[] = [];
    for (const [key, val] of this.productionOrders.entries()) {
      if (key.startsWith(`${tenantId}::`)) {
        if (!projectId || val.projectId === projectId) {
          result.push(val);
        }
      }
    }
    return result;
  }

  async saveInstallationPlan(tenantId: string, plan: SiteInstallationPlan): Promise<void> {
    if (plan.tenantId !== tenantId) throw new TenantIsolationViolationError();
    this.installationPlans.set(this.makeKey(tenantId, plan.id), plan);
  }

  async getInstallationPlan(tenantId: string, planId: string): Promise<SiteInstallationPlan | null> {
    return this.installationPlans.get(this.makeKey(tenantId, planId)) ?? null;
  }

  async getInstallationPlanByProject(tenantId: string, projectId: string): Promise<SiteInstallationPlan | null> {
    if (!tenantId) throw new TenantIsolationViolationError();
    for (const [key, val] of this.installationPlans.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.projectId === projectId) {
        return val;
      }
    }
    return null;
  }

  // --- Delivery & Aftercare ---

  async saveSiteDiary(tenantId: string, entry: SiteDiaryEntry): Promise<void> {
    if (entry.tenantId !== tenantId) throw new TenantIsolationViolationError();
    this.siteDiaries.set(this.makeKey(tenantId, entry.id), entry);
  }

  async listSiteDiaries(tenantId: string, projectId: string): Promise<SiteDiaryEntry[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: SiteDiaryEntry[] = [];
    for (const [key, val] of this.siteDiaries.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.projectId === projectId) {
        result.push(val);
      }
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }

  async savePunchListItem(tenantId: string, item: QCPunchListItem): Promise<void> {
    if (item.tenantId !== tenantId) throw new TenantIsolationViolationError();
    this.punchListItems.set(this.makeKey(tenantId, item.id), item);
  }

  async listPunchListItems(tenantId: string, projectId: string): Promise<QCPunchListItem[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: QCPunchListItem[] = [];
    for (const [key, val] of this.punchListItems.entries()) {
      if (key.startsWith(`${tenantId}::`) && val.projectId === projectId) {
        result.push(val);
      }
    }
    return result;
  }

  async saveHandoverDossier(tenantId: string, dossier: HandoverDossier): Promise<void> {
    if (dossier.tenantId !== tenantId) throw new TenantIsolationViolationError();
    this.handoverDossiers.set(this.makeKey(tenantId, dossier.id), dossier);
  }

  async getHandoverDossier(tenantId: string, dossierId: string): Promise<HandoverDossier | null> {
    return this.handoverDossiers.get(this.makeKey(tenantId, dossierId)) ?? null;
  }

  async saveWarrantyCertificate(tenantId: string, certificate: WarrantyCertificate): Promise<void> {
    if (certificate.tenantId !== tenantId) throw new TenantIsolationViolationError();
    this.warrantyCertificates.set(this.makeKey(tenantId, certificate.id), certificate);
  }

  async getWarrantyCertificate(tenantId: string, certificateId: string): Promise<WarrantyCertificate | null> {
    return this.warrantyCertificates.get(this.makeKey(tenantId, certificateId)) ?? null;
  }

  async saveWarrantyTicket(tenantId: string, ticket: WarrantyServiceTicket): Promise<void> {
    if (ticket.tenantId !== tenantId) throw new TenantIsolationViolationError();
    this.warrantyTickets.set(this.makeKey(tenantId, ticket.id), ticket);
  }

  async listWarrantyTickets(tenantId: string, projectId?: string): Promise<WarrantyServiceTicket[]> {
    if (!tenantId) throw new TenantIsolationViolationError();
    const result: WarrantyServiceTicket[] = [];
    for (const [key, val] of this.warrantyTickets.entries()) {
      if (key.startsWith(`${tenantId}::`)) {
        if (!projectId || val.projectId === projectId) {
          result.push(val);
        }
      }
    }
    return result;
  }

  /**
   * Clear all records (testing only)
   */
  clear(): void {
    this.projects.clear();
    this.roomZones.clear();
    this.designRevisions.clear();
    this.boqs.clear();
    this.quotations.clear();
    this.contracts.clear();
    this.contractAddenda.clear();
    this.paymentTransactions.clear();
    this.productionOrders.clear();
    this.installationPlans.clear();
    this.siteDiaries.clear();
    this.punchListItems.clear();
    this.handoverDossiers.clear();
    this.warrantyCertificates.clear();
    this.warrantyTickets.clear();
    this.customerApprovals.clear();
  }

  // ─── Phase 4: Customer Approval & Digital Signature ──────────────────────────

  async saveCustomerApproval(tenantId: string, approval: CustomerApproval): Promise<void> {
    if (approval.tenantId !== tenantId) throw new TenantIsolationViolationError();
    if (approval.status !== 'pending' || approval.approvedAt || approval.rejectedAt || approval.signatureReference) {
      throw new Error('INTERIOR_APPROVAL_MUST_START_PENDING');
    }
    if (approval.subjectType === 'quotation') {
      const key = this.makeKey(tenantId, approval.subjectId);
      const quotation = this.quotations.get(key);
      if (!quotation || quotation.projectId !== approval.projectId
        || quotation.versionNumber !== approval.subjectVersionNumber
        || !['draft', 'sent_to_client', 'negotiating'].includes(quotation.status)) {
        throw new Error('ApprovalSubjectStatusError: quotation changed before approval request persistence');
      }
      if (quotation.status === 'draft') {
        this.quotations.set(key, { ...quotation, status: 'sent_to_client', sentToClientAt: approval.sentAt });
      }
    } else if (approval.subjectType === 'contract') {
      const contract = this.contracts.get(this.makeKey(tenantId, approval.subjectId));
      if (!contract || contract.projectId !== approval.projectId || !['draft', 'in_review'].includes(contract.status)) {
        throw new Error('ApprovalSubjectStatusError: contract changed before approval request persistence');
      }
      if (contract.status === 'draft') {
        this.contracts.set(this.makeKey(tenantId, contract.id), { ...contract, status: 'in_review' });
      }
    } else {
      const addendum = this.contractAddenda.get(this.makeKey(tenantId, approval.subjectId));
      if (!addendum || addendum.status !== 'pending_customer_approval'
        || addendum.customerApprovalId !== null) {
        throw new Error('ApprovalSubjectStatusError: addendum changed before approval request persistence');
      }
      this.contractAddenda.set(this.makeKey(tenantId, addendum.id), {
        ...addendum,
        customerApprovalId: approval.id,
      });
      const contract = await this.getContract(tenantId, addendum.contractId);
      if (contract) {
        this.contracts.set(this.makeKey(tenantId, contract.id), {
          ...contract,
          addenda: contract.addenda.map((item) => item.id === addendum.id
            ? { ...item, customerApprovalId: approval.id }
            : item),
        });
      }
    }
    await this.supersedePendingApprovals(tenantId, approval.subjectId, 'Superseded by a newer approval request');
    this.customerApprovals.set(this.makeKey(tenantId, approval.id), approval);
  }

  /** Seed an existing approval only in fixture setup; production writes use the pending-only RPC path. */
  seedCustomerApproval(tenantId: string, approval: CustomerApproval): void {
    if (approval.tenantId !== tenantId) throw new TenantIsolationViolationError();
    this.customerApprovals.set(this.makeKey(tenantId, approval.id), approval);
  }

  async getCustomerApproval(tenantId: string, approvalId: string): Promise<CustomerApproval | null> {
    return this.customerApprovals.get(this.makeKey(tenantId, approvalId)) ?? null;
  }

  async getCustomerApprovalByToken(tenantId: string, approvalToken: string): Promise<CustomerApproval | null> {
    for (const approval of this.customerApprovals.values()) {
      if (approval.tenantId === tenantId && approval.approvalToken === approvalToken) {
        return approval;
      }
    }
    return null;
  }

  async listCustomerApprovals(tenantId: string, subjectId: string): Promise<CustomerApproval[]> {
    const result: CustomerApproval[] = [];
    for (const approval of this.customerApprovals.values()) {
      if (approval.tenantId === tenantId && approval.subjectId === subjectId) {
        result.push(approval);
      }
    }
    return result.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  async supersedePendingApprovals(tenantId: string, subjectId: string, reason: string): Promise<void> {
    for (const [key, approval] of this.customerApprovals.entries()) {
      if (
        approval.tenantId === tenantId &&
        approval.subjectId === subjectId &&
        approval.status === 'pending'
      ) {
        this.customerApprovals.set(key, {
          ...approval,
          status: 'superseded',
          customerNotes: reason,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  async transitionCustomerApproval(
    tenantId: string,
    approvalId: string,
    targetApproval: CustomerApproval
  ): Promise<boolean> {
    const key = this.makeKey(tenantId, approvalId);
    const existing = this.customerApprovals.get(key);
    if (!existing) return false;
    // Atomic check: must be pending and not expired
    if (existing.status !== 'pending' || targetApproval.status === 'pending'
      || targetApproval.tenantId !== tenantId || targetApproval.id !== existing.id
      || targetApproval.approvalToken !== existing.approvalToken
      || targetApproval.subjectId !== existing.subjectId
      || targetApproval.subjectType !== existing.subjectType
      || targetApproval.subjectVersionNumber !== existing.subjectVersionNumber) return false;
    if (new Date(existing.expiresAt) <= new Date()) return false;

    // Mirror the PostgreSQL AFTER UPDATE trigger: consume the approval token
    // and advance its exact commercial subject as one in-memory operation.
    if (targetApproval.status === 'rejected' && targetApproval.subjectType === 'quotation') {
      const quoteKey = this.makeKey(tenantId, targetApproval.subjectId);
      const quotation = this.quotations.get(quoteKey);
      if (!quotation
        || quotation.projectId !== targetApproval.projectId
        || quotation.versionNumber !== targetApproval.subjectVersionNumber
        || (quotation.status !== 'sent_to_client' && quotation.status !== 'negotiating')) {
        return false;
      }
      this.quotations.set(quoteKey, {
        ...quotation,
        status: 'rejected',
        rejectedAt: targetApproval.rejectedAt ?? new Date().toISOString(),
        rejectionReason: targetApproval.rejectionReason ?? null,
      });
    } else if (targetApproval.status === 'rejected' && targetApproval.subjectType === 'contract') {
      const contractKey = this.makeKey(tenantId, targetApproval.subjectId);
      const contract = this.contracts.get(contractKey);
      if (!contract || contract.projectId !== targetApproval.projectId
        || (contract.status !== 'draft' && contract.status !== 'in_review')) return false;
      this.contracts.set(contractKey, {
        ...contract,
        status: 'rejected',
        updatedAt: targetApproval.rejectedAt ?? new Date().toISOString(),
      });
    } else if (targetApproval.status === 'approved' && targetApproval.subjectType === 'quotation') {
      const quoteKey = this.makeKey(tenantId, targetApproval.subjectId);
      const quotation = this.quotations.get(quoteKey);
      if (!quotation
        || quotation.projectId !== targetApproval.projectId
        || quotation.versionNumber !== targetApproval.subjectVersionNumber
        || (quotation.status !== 'sent_to_client' && quotation.status !== 'negotiating')) {
        return false;
      }
      this.quotations.set(quoteKey, {
        ...quotation,
        status: 'accepted',
        acceptedAt: targetApproval.approvedAt ?? new Date().toISOString(),
      });
    } else if (targetApproval.status === 'approved' && targetApproval.subjectType === 'contract') {
      const contractKey = this.makeKey(tenantId, targetApproval.subjectId);
      const contract = this.contracts.get(contractKey);
      const quotation = contract ? this.quotations.get(this.makeKey(tenantId, contract.quotationId)) : null;
      const quotationApproval = contract?.quotationCustomerApprovalId
        ? this.customerApprovals.get(this.makeKey(tenantId, contract.quotationCustomerApprovalId))
        : null;
      const boq = contract?.boqId ? this.boqs.get(this.makeKey(tenantId, contract.boqId)) : null;
      const designRevision = contract?.designRevisionId
        ? this.designRevisions.get(this.makeKey(tenantId, contract.designRevisionId))
        : null;
      if (!contract
        || contract.projectId !== targetApproval.projectId
        || (contract.status !== 'draft' && contract.status !== 'in_review')
        || !quotation || quotation.status !== 'accepted'
        || quotation.versionNumber !== contract.quotationVersionNumber
        || !quotationApproval || quotationApproval.status !== 'approved'
        || quotationApproval.subjectType !== 'quotation'
        || quotationApproval.subjectId !== quotation.id
        || quotationApproval.subjectVersionNumber !== quotation.versionNumber
        || !boq || boq.versionNumber !== contract.boqVersionNumber
        || !designRevision || designRevision.versionNumber !== contract.designVersionNumber
        || !targetApproval.signatureReference
        || !/^[0-9a-f]{64}$/i.test(targetApproval.signatureReference.sha256Hash)
        || !targetApproval.signatureReference.storagePath.trim()
        || targetApproval.signatureReference.fileSizeBytes <= 0) {
        return false;
      }
      const approvedAt = targetApproval.approvedAt ?? new Date().toISOString();
      this.contracts.set(contractKey, {
        ...contract,
        status: 'signed',
        signedDate: approvedAt,
        customerApprovalId: targetApproval.id,
        updatedAt: approvedAt,
      });
      const projectKey = this.makeKey(tenantId, contract.projectId);
      const project = this.projects.get(projectKey);
      if (project) {
        this.projects.set(projectKey, { ...project, status: 'contracted', updatedAt: approvedAt });
      }
    } else if (targetApproval.subjectType === 'contract_addendum') {
      const addendumKey = this.makeKey(tenantId, targetApproval.subjectId);
      const addendum = this.contractAddenda.get(addendumKey);
      const contractKey = addendum ? this.makeKey(tenantId, addendum.contractId) : '';
      const contract = addendum ? this.contracts.get(contractKey) : null;
      if (!addendum || !contract || addendum.status !== 'pending_customer_approval'
        || addendum.customerApprovalId !== targetApproval.id
        || contract.projectId !== targetApproval.projectId
        || contract.currentContractValue !== addendum.baseContractValue) return false;

      if (targetApproval.status === 'approved') {
        const proposedById = new Map(addendum.proposedPaymentSchedule.map((milestone) => [milestone.id, milestone]));
        if (proposedById.size !== contract.milestones.length
          || contract.milestones.some((current) => {
            const proposed = proposedById.get(current.id);
            if (!proposed) return true;
            const immutable = current.status === 'paid' || (current.collectedAmount ?? 0) > 0
              || current.invoiceStatus === 'issued' || current.invoiceStatus === 'adjusted';
            return immutable && (current.name !== proposed.name
              || current.percentage !== proposed.percentage || current.amount !== proposed.amount
              || current.triggerCondition !== proposed.triggerCondition || current.dueDate !== proposed.dueDate);
          })) return false;
        const approvedAt = targetApproval.approvedAt ?? new Date().toISOString();
        const milestones = contract.milestones.map((current) => {
          const proposed = proposedById.get(current.id)!;
          const immutable = current.status === 'paid' || (current.collectedAmount ?? 0) > 0
            || current.invoiceStatus === 'issued' || current.invoiceStatus === 'adjusted';
          return immutable ? current : {
            ...current,
            name: proposed.name,
            percentage: proposed.percentage,
            amount: proposed.amount,
            triggerCondition: proposed.triggerCondition,
            dueDate: proposed.dueDate,
          };
        });
        this.contracts.set(contractKey, {
          ...contract,
          currentContractValue: contract.currentContractValue + addendum.valueDelta,
          milestones,
          addenda: contract.addenda.map((item) => item.id === addendum.id
            ? { ...item, status: 'approved', approvedAt, customerApprovalId: targetApproval.id }
            : item),
          updatedAt: approvedAt,
        });
        this.contractAddenda.set(addendumKey, { ...addendum, status: 'approved', approvedAt });
      } else if (targetApproval.status === 'rejected') {
        this.contractAddenda.set(addendumKey, { ...addendum, status: 'rejected', approvedAt: null });
        this.contracts.set(contractKey, {
          ...contract,
          addenda: contract.addenda.map((item) => item.id === addendum.id
            ? { ...item, status: 'rejected', approvedAt: null, customerApprovalId: targetApproval.id }
            : item),
        });
      } else {
        return false;
      }
    }

    this.customerApprovals.set(key, targetApproval);
    return true;
  }
}

