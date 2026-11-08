/**
 * Bella Interior OS — Repository Interface
 *
 * All operations require tenantId as the first parameter to enforce Tenant Isolation (Gate 0).
 * @module src/products/bella-interior/repositories
 */

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

export interface IInteriorRepository {
  // Design & Specification
  saveProject(tenantId: string, project: InteriorProject): Promise<void>;
  getProject(tenantId: string, projectId: string): Promise<InteriorProject | null>;
  listProjects(tenantId: string): Promise<InteriorProject[]>;
  saveRoomZone(tenantId: string, roomZone: ProjectRoomZone): Promise<void>;
  listRoomZones(tenantId: string, projectId: string): Promise<ProjectRoomZone[]>;
  saveDesignRevision(tenantId: string, revision: DesignRevision): Promise<void>;
  getDesignRevision(tenantId: string, revisionId: string): Promise<DesignRevision | null>;
  listDesignRevisions(tenantId: string, projectId: string): Promise<DesignRevision[]>;

  // Design Takeoff Staging & Review (Phase 2A)
  saveTakeoffRun(tenantId: string, run: DesignTakeoffRun): Promise<void>;
  getTakeoffRun(tenantId: string, runId: string): Promise<DesignTakeoffRun | null>;
  listTakeoffRuns(tenantId: string, projectId: string): Promise<DesignTakeoffRun[]>;

  // Commercial & Costing
  saveBOQ(tenantId: string, boq: InteriorBOQ): Promise<void>;
  getBOQ(tenantId: string, boqId: string): Promise<InteriorBOQ | null>;
  getBOQByProject(tenantId: string, projectId: string): Promise<InteriorBOQ | null>;
  saveQuotation(tenantId: string, quotation: InteriorQuotation): Promise<void>;
  getQuotation(tenantId: string, quotationId: string): Promise<InteriorQuotation | null>;
  saveContract(tenantId: string, contract: InteriorContract): Promise<void>;
  getContract(tenantId: string, contractId: string): Promise<InteriorContract | null>;
  getContractByProject(tenantId: string, projectId: string): Promise<InteriorContract | null>;

  // Manufacturing & Installation
  saveProductionOrder(tenantId: string, order: ProductionOrder): Promise<void>;
  getProductionOrder(tenantId: string, orderId: string): Promise<ProductionOrder | null>;
  listProductionOrders(tenantId: string, projectId?: string): Promise<ProductionOrder[]>;
  saveInstallationPlan(tenantId: string, plan: SiteInstallationPlan): Promise<void>;
  getInstallationPlan(tenantId: string, planId: string): Promise<SiteInstallationPlan | null>;
  getInstallationPlanByProject(tenantId: string, projectId: string): Promise<SiteInstallationPlan | null>;

  // Delivery & Aftercare
  saveSiteDiary(tenantId: string, entry: SiteDiaryEntry): Promise<void>;
  listSiteDiaries(tenantId: string, projectId: string): Promise<SiteDiaryEntry[]>;
  savePunchListItem(tenantId: string, item: QCPunchListItem): Promise<void>;
  listPunchListItems(tenantId: string, projectId: string): Promise<QCPunchListItem[]>;
  saveHandoverDossier(tenantId: string, dossier: HandoverDossier): Promise<void>;
  getHandoverDossier(tenantId: string, dossierId: string): Promise<HandoverDossier | null>;
  saveWarrantyCertificate(tenantId: string, certificate: WarrantyCertificate): Promise<void>;
  getWarrantyCertificate(tenantId: string, certificateId: string): Promise<WarrantyCertificate | null>;
  saveWarrantyTicket(tenantId: string, ticket: WarrantyServiceTicket): Promise<void>;
  listWarrantyTickets(tenantId: string, projectId?: string): Promise<WarrantyServiceTicket[]>;
}

