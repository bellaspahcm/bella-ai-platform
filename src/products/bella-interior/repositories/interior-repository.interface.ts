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
  ContractAddendum,
} from '../domain/commercial-costing/types';
import type { PaymentTransaction } from '../domain/commercial-costing/contract.types';
import type { CustomerApproval } from '../domain/commercial-costing/approval.types';
import type {
  BOQVersionHistoryItem,
  ForkBOQRevisionInput,
} from '../domain/commercial-costing/boq-version-diff.types';
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

export interface SaveBOQOptions {
  readonly expectedVersionNumber?: number;
  readonly idempotencyKey?: string;
  readonly requestHash?: string;
  readonly auditActorId?: string;
}

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
  saveBOQ(tenantId: string, boq: InteriorBOQ, options?: SaveBOQOptions): Promise<void>;
  getBOQ(tenantId: string, boqId: string): Promise<InteriorBOQ | null>;
  getBOQByProject(tenantId: string, projectId: string): Promise<InteriorBOQ | null>;
  listBOQRevisions(tenantId: string, projectId: string): Promise<InteriorBOQ[]>;
  /** Fork an approved/locked BOQ into a new draft revision (Phase 1 — Versioning) */
  forkBOQRevision(tenantId: string, input: ForkBOQRevisionInput): Promise<InteriorBOQ>;
  /** List all BOQ revisions for a project with fork lineage metadata (Phase 1 — Versioning) */
  listBOQVersionHistory(tenantId: string, projectId: string): Promise<BOQVersionHistoryItem[]>;
  saveQuotation(tenantId: string, quotation: InteriorQuotation): Promise<void>;
  getQuotation(tenantId: string, quotationId: string): Promise<InteriorQuotation | null>;
  listQuotationsByProject(tenantId: string, projectId: string): Promise<InteriorQuotation[]>;
  listQuotationRevisions(tenantId: string, projectId: string): Promise<InteriorQuotation[]>;
  saveContract(tenantId: string, contract: InteriorContract): Promise<void>;
  getContract(tenantId: string, contractId: string): Promise<InteriorContract | null>;
  getContractByProject(tenantId: string, projectId: string): Promise<InteriorContract | null>;
  listContractsByProject(tenantId: string, projectId: string): Promise<InteriorContract[]>;
  saveContractAddendum(tenantId: string, addendum: ContractAddendum): Promise<void>;
  listContractAddenda(tenantId: string, contractId: string): Promise<ContractAddendum[]>;
  savePaymentTransaction(tenantId: string, transaction: PaymentTransaction): Promise<void>;
  listPaymentTransactions(tenantId: string, contractId: string, milestoneId?: string): Promise<PaymentTransaction[]>;

  // Phase 4: Customer Approval & Digital Signature
  saveCustomerApproval(tenantId: string, approval: CustomerApproval): Promise<void>;
  getCustomerApproval(tenantId: string, approvalId: string): Promise<CustomerApproval | null>;
  getCustomerApprovalByToken(tenantId: string, approvalToken: string): Promise<CustomerApproval | null>;
  listCustomerApprovals(tenantId: string, subjectId: string): Promise<CustomerApproval[]>;
  supersedePendingApprovals(tenantId: string, subjectId: string, reason: string): Promise<void>;
  /** Atomic conditional state transition: WHERE status = 'pending' AND expires_at > now() */
  transitionCustomerApproval(tenantId: string, approvalId: string, targetApproval: CustomerApproval): Promise<boolean>;

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

