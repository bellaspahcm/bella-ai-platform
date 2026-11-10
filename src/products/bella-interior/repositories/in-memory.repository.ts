/**
 * Bella Interior OS — In-Memory Repository Implementation
 *
 * Provides thread-safe, tenant-isolated in-memory storage for testing and local execution.
 * Enforces Gate 0 Tenant Isolation on all methods.
 *
 * @module src/products/bella-interior/repositories
 */

import { TenantIsolationViolationError, TakeoffRunImmutableError } from '../domain/errors';
import type { IInteriorRepository, SaveBOQOptions } from './interior-repository.interface';
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
} from '../domain/commercial-costing/types';
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
  private readonly productionOrders = new Map<string, ProductionOrder>();
  private readonly installationPlans = new Map<string, SiteInstallationPlan>();
  private readonly siteDiaries = new Map<string, SiteDiaryEntry>();
  private readonly punchListItems = new Map<string, QCPunchListItem>();
  private readonly handoverDossiers = new Map<string, HandoverDossier>();
  private readonly warrantyCertificates = new Map<string, WarrantyCertificate>();
  private readonly warrantyTickets = new Map<string, WarrantyServiceTicket>();

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
    this.quotations.set(this.makeKey(tenantId, quotation.id), quotation);
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
    this.contracts.set(this.makeKey(tenantId, contract.id), contract);
  }

  async getContract(tenantId: string, contractId: string): Promise<InteriorContract | null> {
    return this.contracts.get(this.makeKey(tenantId, contractId)) ?? null;
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
    this.productionOrders.clear();
    this.installationPlans.clear();
    this.siteDiaries.clear();
    this.punchListItems.clear();
    this.handoverDossiers.clear();
    this.warrantyCertificates.clear();
    this.warrantyTickets.clear();
  }
}

