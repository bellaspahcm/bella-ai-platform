/**
 * Bella Interior OS — Supabase Repository Implementation
 *
 * Gate 0 (Tenant Isolation): Every query filters by tenantId supplied from
 * the authenticated actor — NEVER from request params or headers.
 *
 * @module src/products/bella-interior/repositories
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  InteriorProject,
  ProjectRoomZone,
  DesignRevision,
  DesignAsset,
  DesignMaterialSpec,
} from '../domain/design-specification/types';
import type { DesignTakeoffRun, DesignTakeoffComponent } from '../domain/takeoff/types';
import type {
  InteriorBOQ,
  InteriorQuotation,
  InteriorContract,
  BOQItem,
  PaymentMilestone,
  ContractAddendum,
} from '../domain/commercial-costing/types';
import type {
  ProductionOrder,
  SiteInstallationPlan,
  ProductionOrderItem,
  SiteRoomInstallation,
} from '../domain/manufacturing-install/types';
import type {
  SiteDiaryEntry,
  QCPunchListItem,
  HandoverDossier,
  WarrantyCertificate,
  WarrantyServiceTicket,
} from '../domain/delivery-aftercare/types';

import type { IInteriorRepository, SaveBOQOptions } from './interior-repository.interface';
import { ensureUuid, isUuid } from '../lib/uuid-helper';

// ---------------------------------------------------------------------------
// Row types (DB columns → TS)
// ---------------------------------------------------------------------------

interface InteriorProjectRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  site_address: string;
  project_type: string;
  status: string;
  estimated_budget: string | number;
  target_completion_date: string;
  lead_architect_id: string;
  lead_architect_name: string;
  active_approved_revision_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectRoomZoneRow {
  id: string;
  tenant_id: string;
  project_id: string;
  code: string;
  name: string;
  floor: number;
  area_square_meters: string | number | null;
  description: string | null;
}

interface DesignRevisionRow {
  id: string;
  tenant_id: string;
  project_id: string;
  version_number: number;
  title: string;
  status: string;
  change_summary: string | null;
  submitted_by: string;
  submitted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  client_signoff_name: string | null;
  client_signoff_date: string | null;
}

interface DesignAssetRow {
  id: string;
  tenant_id: string;
  revision_id: string;
  room_zone_id: string | null;
  asset_type: string;
  title: string;
  file_url: string;
  notes: string | null;
}

interface DesignMaterialSpecRow {
  id: string;
  tenant_id: string;
  revision_id: string;
  item_category: string;
  brand: string;
  code: string;
  name: string;
  color_tone: string | null;
  spec_description: string;
  approved_for_use: boolean;
}

interface InteriorBOQRow {
  id: string;
  tenant_id: string;
  project_id: string;
  design_revision_id: string;
  boq_number: string;
  version_number: number;
  status: string;
  total_internal_cost: string | number;
  total_client_price: string | number;
  total_gross_margin: string | number;
  gross_margin_percent: string | number;
  prepared_by: string;
  created_at: string;
  updated_at: string;
}

interface BOQItemRow {
  id: string;
  tenant_id: string;
  boq_id: string;
  room_zone_id: string | null;
  room_zone_name: string;
  item_code: string;
  item_name: string;
  category: string;
  dimensions_json: unknown;
  specifications_json: unknown;
  unit: string;
  quantity: string | number;
  internal_unit_cost: string | number;
  internal_total_cost: string | number;
  client_unit_price: string | number;
  client_total_price: string | number;
  gross_margin_amount: string | number;
  gross_margin_percent: string | number;
}

interface InteriorQuotationRow {
  id: string;
  tenant_id: string;
  project_id: string;
  boq_id: string;
  quotation_number: string;
  version_number: number;
  status: string;
  subtotal: string | number;
  discount_amount: string | number;
  vat_percent: string | number;
  vat_amount: string | number;
  grand_total: string | number;
  payment_terms: string;
  validity_days: number;
  created_at: string;
}

interface InteriorContractRow {
  id: string;
  tenant_id: string;
  project_id: string;
  quotation_id: string;
  contract_number: string;
  title: string;
  status: string;
  baseline_contract_value: string | number;
  current_contract_value: string | number;
  signed_date: string;
  client_representative: string;
  contractor_representative: string;
}

interface PaymentMilestoneRow {
  id: string;
  tenant_id: string;
  contract_id: string;
  milestone_order: number;
  name: string;
  percentage: string | number;
  amount: string | number;
  trigger_condition: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
}

interface ProductionOrderRow {
  id: string;
  tenant_id: string;
  project_id: string;
  design_revision_id: string;
  boq_id: string;
  order_number: string;
  mode: string;
  subcontractor_name: string | null;
  status: string;
  scheduled_start_date: string;
  scheduled_completion_date: string;
  actual_dispatched_date: string | null;
  workshop_manager_name: string;
  notes: string | null;
  created_at: string;
}

interface ProductionOrderItemRow {
  id: string;
  tenant_id: string;
  production_order_id: string;
  boq_item_id: string;
  room_zone_name: string;
  item_name: string;
  quantity: string | number;
  unit: string;
  dimensions_summary: string;
  material_summary: string;
  current_stage: string;
  qc_passed: boolean;
  qc_notes: string | null;
}

interface SiteInstallationPlanRow {
  id: string;
  tenant_id: string;
  project_id: string;
  plan_number: string;
  site_supervisor_id: string;
  site_supervisor_name: string;
  scheduled_start_date: string;
  scheduled_end_date: string;
  overall_progress_percent: number;
  created_at: string;
}

interface SiteRoomInstallationRow {
  id: string;
  tenant_id: string;
  plan_id: string;
  room_zone_id: string | null;
  room_zone_name: string;
  status: string;
  installer_team_leader: string;
  progress_percent: number;
  target_install_date: string;
  completed_date: string | null;
}

interface SiteDiaryRow {
  id: string;
  tenant_id: string;
  project_id: string;
  date: string;
  weather: string;
  labor_headcount: number;
  activities_completed: string[];
  material_delivered: string[];
  issues_noted: string | null;
  supervisor_name: string;
  photo_urls: string[];
  created_at: string;
}

interface QCPunchListItemRow {
  id: string;
  tenant_id: string;
  project_id: string;
  room_zone_name: string;
  item_name: string;
  defect_category: string;
  description: string;
  severity: string;
  photo_url: string | null;
  assigned_fixer: string;
  deadline: string;
  status: string;
  rectification_note: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

interface HandoverDossierRow {
  id: string;
  tenant_id: string;
  project_id: string;
  contract_id: string;
  handover_date: string;
  status: string;
  total_punch_list_items: number;
  open_punch_list_items: number;
  client_accepted: boolean;
  client_signoff_name: string | null;
  final_settlement_value: string | number;
  dossier_document_url: string | null;
}

interface WarrantyCertificateRow {
  id: string;
  tenant_id: string;
  project_id: string;
  contract_id: string;
  certificate_number: string;
  customer_name: string;
  site_address: string;
  effective_date: string;
  expiration_date: string;
  woodwork_warranty_months: number;
  hardware_warranty_months: number;
  stone_warranty_months: number;
  terms_summary: string;
}

interface WarrantyServiceTicketRow {
  id: string;
  tenant_id: string;
  certificate_id: string;
  project_id: string;
  ticket_number: string;
  reported_date: string;
  customer_report: string;
  room_zone_name: string;
  item_name: string;
  defect_category: string;
  status: string;
  assigned_technician: string | null;
  scheduled_fix_date: string | null;
  resolved_date: string | null;
  resolution_details: string | null;
  supplier_chargeback_eligible: boolean | null;
}

// ---------------------------------------------------------------------------
// Mapper helpers — DB row → Domain type
// ---------------------------------------------------------------------------

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : parseFloat(v);
}

function mapRowToProject(row: InteriorProjectRow): InteriorProject {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    name: row.name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    siteAddress: row.site_address,
    projectType: row.project_type as InteriorProject['projectType'],
    status: row.status as InteriorProject['status'],
    estimatedBudget: toNum(row.estimated_budget),
    targetCompletionDate: row.target_completion_date,
    leadArchitectId: row.lead_architect_id,
    leadArchitectName: row.lead_architect_name,
    activeApprovedRevisionId: row.active_approved_revision_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProjectToRow(
  project: InteriorProject,
  tenantId: string
): Omit<InteriorProjectRow, 'created_at' | 'updated_at'> & { tenant_id: string } {
  return {
    id: ensureUuid(project.id),
    tenant_id: ensureUuid(tenantId),
    code: project.code,
    name: project.name,
    customer_id: project.customerId,
    customer_name: project.customerName,
    customer_phone: project.customerPhone,
    site_address: project.siteAddress,
    project_type: project.projectType,
    status: project.status,
    estimated_budget: project.estimatedBudget,
    target_completion_date: project.targetCompletionDate,
    lead_architect_id: project.leadArchitectId,
    lead_architect_name: project.leadArchitectName,
    active_approved_revision_id: project.activeApprovedRevisionId ? ensureUuid(project.activeApprovedRevisionId) : null,
  };
}

function mapRowToRoomZone(row: ProjectRoomZoneRow): ProjectRoomZone {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    code: row.code,
    name: row.name,
    floor: row.floor,
    areaSquareMeters: row.area_square_meters !== null ? toNum(row.area_square_meters) : undefined,
    description: row.description ?? undefined,
  };
}

function mapRoomZoneToRow(
  roomZone: ProjectRoomZone,
  tenantId: string
): Omit<ProjectRoomZoneRow, 'created_at'> & { tenant_id: string } {
  return {
    id: ensureUuid(roomZone.id),
    tenant_id: ensureUuid(tenantId),
    project_id: ensureUuid(roomZone.projectId),
    code: roomZone.code,
    name: roomZone.name,
    floor: roomZone.floor,
    area_square_meters: roomZone.areaSquareMeters ?? null,
    description: roomZone.description ?? null,
  };
}

function mapRowToDesignAsset(row: DesignAssetRow): DesignAsset {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    revisionId: row.revision_id,
    type: row.asset_type as DesignAsset['type'],
    title: row.title,
    fileUrl: row.file_url,
    roomZoneId: row.room_zone_id ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function mapRowToMaterialSpec(row: DesignMaterialSpecRow): DesignMaterialSpec {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    revisionId: row.revision_id,
    itemCategory: row.item_category as DesignMaterialSpec['itemCategory'],
    brand: row.brand,
    code: row.code,
    name: row.name,
    colorTone: row.color_tone ?? undefined,
    specDescription: row.spec_description,
    approvedForUse: row.approved_for_use,
  };
}

function mapRowToRevision(
  row: DesignRevisionRow,
  assets: DesignAsset[],
  materialSpecs: DesignMaterialSpec[]
): DesignRevision {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    title: row.title,
    status: row.status as DesignRevision['status'],
    changeSummary: row.change_summary ?? undefined,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    clientSignoffName: row.client_signoff_name ?? undefined,
    clientSignoffDate: row.client_signoff_date ?? undefined,
    assets,
    materialSpecs,
  };
}

function mapRevisionToRow(
  revision: DesignRevision,
  tenantId: string
): Omit<DesignRevisionRow, never> {
  return {
    id: ensureUuid(revision.id),
    tenant_id: ensureUuid(tenantId),
    project_id: ensureUuid(revision.projectId),
    version_number: revision.versionNumber,
    title: revision.title,
    status: revision.status,
    change_summary: revision.changeSummary ?? null,
    submitted_by: revision.submittedBy,
    submitted_at: revision.submittedAt,
    approved_by: revision.approvedBy ?? null,
    approved_at: revision.approvedAt ?? null,
    client_signoff_name: revision.clientSignoffName ?? null,
    client_signoff_date: revision.clientSignoffDate ?? null,
  };
}

function mapRowToBOQItem(row: BOQItemRow): BOQItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    boqId: row.boq_id,
    roomZoneId: row.room_zone_id ?? '',
    roomZoneName: row.room_zone_name,
    itemCode: row.item_code,
    itemName: row.item_name,
    category: row.category as BOQItem['category'],
    dimensions: row.dimensions_json as BOQItem['dimensions'],
    specifications: row.specifications_json as BOQItem['specifications'],
    unit: row.unit as BOQItem['unit'],
    quantity: toNum(row.quantity),
    internalUnitCost: toNum(row.internal_unit_cost),
    internalTotalCost: toNum(row.internal_total_cost),
    clientUnitPrice: toNum(row.client_unit_price),
    clientTotalPrice: toNum(row.client_total_price),
    grossMarginAmount: toNum(row.gross_margin_amount),
    grossMarginPercent: toNum(row.gross_margin_percent),
  };
}

function mapRowToBOQ(row: InteriorBOQRow, items: BOQItem[]): InteriorBOQ {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    designRevisionId: row.design_revision_id,
    boqNumber: row.boq_number,
    versionNumber: row.version_number,
    status: row.status as InteriorBOQ['status'],
    totalInternalCost: toNum(row.total_internal_cost),
    totalClientPrice: toNum(row.total_client_price),
    totalGrossMargin: toNum(row.total_gross_margin),
    grossMarginPercent: toNum(row.gross_margin_percent),
    items,
    preparedBy: row.prepared_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBOQToRow(
  boq: InteriorBOQ,
  tenantId: string
): Omit<InteriorBOQRow, 'created_at' | 'updated_at'> & { tenant_id: string } {
  return {
    id: ensureUuid(boq.id),
    tenant_id: ensureUuid(tenantId),
    project_id: ensureUuid(boq.projectId),
    design_revision_id: ensureUuid(boq.designRevisionId),
    boq_number: boq.boqNumber,
    version_number: boq.versionNumber,
    status: boq.status,
    total_internal_cost: boq.totalInternalCost,
    total_client_price: boq.totalClientPrice,
    total_gross_margin: boq.totalGrossMargin,
    gross_margin_percent: boq.grossMarginPercent,
    prepared_by: boq.preparedBy,
  };
}

function mapRowToQuotation(row: InteriorQuotationRow): InteriorQuotation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    boqId: row.boq_id,
    quotationNumber: row.quotation_number,
    versionNumber: row.version_number,
    status: row.status as InteriorQuotation['status'],
    subtotal: toNum(row.subtotal),
    discountAmount: toNum(row.discount_amount),
    vatPercent: toNum(row.vat_percent),
    vatAmount: toNum(row.vat_amount),
    grandTotal: toNum(row.grand_total),
    paymentTerms: row.payment_terms,
    validityDays: row.validity_days,
    createdAt: row.created_at,
  };
}

function mapQuotationToRow(
  quotation: InteriorQuotation,
  tenantId: string
): Omit<InteriorQuotationRow, 'created_at'> & { tenant_id: string } {
  return {
    id: ensureUuid(quotation.id),
    tenant_id: ensureUuid(tenantId),
    project_id: ensureUuid(quotation.projectId),
    boq_id: ensureUuid(quotation.boqId),
    quotation_number: quotation.quotationNumber,
    version_number: quotation.versionNumber,
    status: quotation.status,
    subtotal: quotation.subtotal,
    discount_amount: quotation.discountAmount,
    vat_percent: quotation.vatPercent,
    vat_amount: quotation.vatAmount,
    grand_total: quotation.grandTotal,
    payment_terms: quotation.paymentTerms,
    validity_days: quotation.validityDays,
  };
}

function mapRowToMilestone(row: PaymentMilestoneRow): PaymentMilestone {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    contractId: row.contract_id,
    milestoneOrder: row.milestone_order,
    name: row.name,
    percentage: toNum(row.percentage),
    amount: toNum(row.amount),
    triggerCondition: row.trigger_condition,
    status: row.status as PaymentMilestone['status'],
    dueDate: row.due_date ?? undefined,
    paidAt: row.paid_at ?? undefined,
  };
}

function mapRowToContract(
  row: InteriorContractRow,
  milestones: PaymentMilestone[],
  addenda: ContractAddendum[]
): InteriorContract {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    quotationId: row.quotation_id,
    contractNumber: row.contract_number,
    title: row.title,
    status: row.status as InteriorContract['status'],
    baselineContractValue: toNum(row.baseline_contract_value),
    currentContractValue: toNum(row.current_contract_value),
    signedDate: row.signed_date,
    clientRepresentative: row.client_representative,
    contractorRepresentative: row.contractor_representative,
    milestones,
    addenda,
  };
}

function mapContractToRow(
  contract: InteriorContract,
  tenantId: string
): InteriorContractRow {
  return {
    id: ensureUuid(contract.id),
    tenant_id: ensureUuid(tenantId),
    project_id: ensureUuid(contract.projectId),
    quotation_id: ensureUuid(contract.quotationId),
    contract_number: contract.contractNumber,
    title: contract.title,
    status: contract.status,
    baseline_contract_value: contract.baselineContractValue,
    current_contract_value: contract.currentContractValue,
    signed_date: contract.signedDate,
    client_representative: contract.clientRepresentative,
    contractor_representative: contract.contractorRepresentative,
  };
}

function mapRowToProductionOrderItem(row: ProductionOrderItemRow): ProductionOrderItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    productionOrderId: row.production_order_id,
    boqItemId: row.boq_item_id,
    roomZoneName: row.room_zone_name,
    itemName: row.item_name,
    quantity: toNum(row.quantity),
    unit: row.unit,
    dimensionsSummary: row.dimensions_summary,
    materialSummary: row.material_summary,
    currentStage: row.current_stage as ProductionOrderItem['currentStage'],
    qcPassed: row.qc_passed,
    qcNotes: row.qc_notes ?? undefined,
  };
}

function mapRowToProductionOrder(
  row: ProductionOrderRow,
  items: ProductionOrderItem[]
): ProductionOrder {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    designRevisionId: row.design_revision_id,
    boqId: row.boq_id,
    orderNumber: row.order_number,
    mode: row.mode as ProductionOrder['mode'],
    subcontractorName: row.subcontractor_name ?? undefined,
    status: row.status as ProductionOrder['status'],
    scheduledStartDate: row.scheduled_start_date,
    scheduledCompletionDate: row.scheduled_completion_date,
    actualDispatchedDate: row.actual_dispatched_date ?? undefined,
    workshopManagerName: row.workshop_manager_name,
    items,
    notes: row.notes ?? undefined,
  };
}

function mapProductionOrderToRow(
  order: ProductionOrder,
  tenantId: string
): Omit<ProductionOrderRow, 'created_at'> & { tenant_id: string } {
  return {
    id: ensureUuid(order.id),
    tenant_id: ensureUuid(tenantId),
    project_id: ensureUuid(order.projectId),
    design_revision_id: ensureUuid(order.designRevisionId),
    boq_id: ensureUuid(order.boqId),
    order_number: order.orderNumber,
    mode: order.mode,
    subcontractor_name: order.subcontractorName ?? null,
    status: order.status,
    scheduled_start_date: order.scheduledStartDate,
    scheduled_completion_date: order.scheduledCompletionDate,
    actual_dispatched_date: order.actualDispatchedDate ?? null,
    workshop_manager_name: order.workshopManagerName,
    notes: order.notes ?? null,
  };
}

function mapRowToRoomInstallation(row: SiteRoomInstallationRow): SiteRoomInstallation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: row.plan_id,
    roomZoneId: row.room_zone_id ?? '',
    roomZoneName: row.room_zone_name,
    status: row.status as SiteRoomInstallation['status'],
    installerTeamLeader: row.installer_team_leader,
    progressPercent: row.progress_percent,
    targetInstallDate: row.target_install_date,
    completedDate: row.completed_date ?? undefined,
  };
}

function mapRowToInstallationPlan(
  row: SiteInstallationPlanRow,
  rooms: SiteRoomInstallation[]
): SiteInstallationPlan {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    planNumber: row.plan_number,
    siteSupervisorId: row.site_supervisor_id,
    siteSupervisorName: row.site_supervisor_name,
    scheduledStartDate: row.scheduled_start_date,
    scheduledEndDate: row.scheduled_end_date,
    rooms,
    overallProgressPercent: row.overall_progress_percent,
  };
}

function mapInstallationPlanToRow(
  plan: SiteInstallationPlan,
  tenantId: string
): Omit<SiteInstallationPlanRow, 'created_at'> & { tenant_id: string } {
  return {
    id: ensureUuid(plan.id),
    tenant_id: ensureUuid(tenantId),
    project_id: ensureUuid(plan.projectId),
    plan_number: plan.planNumber,
    site_supervisor_id: plan.siteSupervisorId,
    site_supervisor_name: plan.siteSupervisorName,
    scheduled_start_date: plan.scheduledStartDate,
    scheduled_end_date: plan.scheduledEndDate,
    overall_progress_percent: plan.overallProgressPercent,
  };
}

function mapRowToSiteDiary(row: SiteDiaryRow): SiteDiaryEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    date: row.date,
    weather: row.weather,
    laborHeadcount: row.labor_headcount,
    activitiesCompleted: row.activities_completed,
    materialDelivered: row.material_delivered,
    issuesNoted: row.issues_noted ?? undefined,
    supervisorName: row.supervisor_name,
    photoUrls: row.photo_urls,
  };
}

function mapSiteDiaryToRow(
  entry: SiteDiaryEntry,
  tenantId: string
): Omit<SiteDiaryRow, 'created_at'> & { tenant_id: string } {
  return {
    id: ensureUuid(entry.id),
    tenant_id: ensureUuid(tenantId),
    project_id: ensureUuid(entry.projectId),
    date: entry.date,
    weather: entry.weather,
    labor_headcount: entry.laborHeadcount,
    activities_completed: entry.activitiesCompleted,
    material_delivered: entry.materialDelivered,
    issues_noted: entry.issuesNoted ?? null,
    supervisor_name: entry.supervisorName,
    photo_urls: entry.photoUrls,
  };
}

function mapRowToPunchListItem(row: QCPunchListItemRow): QCPunchListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    roomZoneName: row.room_zone_name,
    itemName: row.item_name,
    defectCategory: row.defect_category as QCPunchListItem['defectCategory'],
    description: row.description,
    severity: row.severity as QCPunchListItem['severity'],
    photoUrl: row.photo_url ?? undefined,
    assignedFixer: row.assigned_fixer,
    deadline: row.deadline,
    status: row.status as QCPunchListItem['status'],
    rectificationNote: row.rectification_note ?? undefined,
    verifiedBy: row.verified_by ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
  };
}

function mapPunchListItemToRow(
  item: QCPunchListItem,
  tenantId: string
): Omit<QCPunchListItemRow, 'created_at'> & { tenant_id: string } {
  return {
    id: ensureUuid(item.id),
    tenant_id: ensureUuid(tenantId),
    project_id: ensureUuid(item.projectId),
    room_zone_name: item.roomZoneName,
    item_name: item.itemName,
    defect_category: item.defectCategory,
    description: item.description,
    severity: item.severity,
    photo_url: item.photoUrl ?? null,
    assigned_fixer: item.assignedFixer,
    deadline: item.deadline,
    status: item.status,
    rectification_note: item.rectificationNote ?? null,
    verified_by: item.verifiedBy ?? null,
    verified_at: item.verifiedAt ?? null,
  };
}

function mapRowToHandoverDossier(row: HandoverDossierRow): HandoverDossier {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    contractId: row.contract_id,
    handoverDate: row.handover_date,
    status: row.status as HandoverDossier['status'],
    totalPunchListItems: row.total_punch_list_items,
    openPunchListItems: row.open_punch_list_items,
    clientAccepted: row.client_accepted,
    clientSignoffName: row.client_signoff_name ?? undefined,
    finalSettlementValue: toNum(row.final_settlement_value),
    dossierDocumentUrl: row.dossier_document_url ?? undefined,
  };
}

function mapHandoverDossierToRow(
  dossier: HandoverDossier,
  tenantId: string
): HandoverDossierRow {
  return {
    id: ensureUuid(dossier.id),
    tenant_id: ensureUuid(tenantId),
    project_id: ensureUuid(dossier.projectId),
    contract_id: ensureUuid(dossier.contractId),
    handover_date: dossier.handoverDate,
    status: dossier.status,
    total_punch_list_items: dossier.totalPunchListItems,
    open_punch_list_items: dossier.openPunchListItems,
    client_accepted: dossier.clientAccepted,
    client_signoff_name: dossier.clientSignoffName ?? null,
    final_settlement_value: dossier.finalSettlementValue,
    dossier_document_url: dossier.dossierDocumentUrl ?? null,
  };
}

function mapRowToWarrantyCertificate(row: WarrantyCertificateRow): WarrantyCertificate {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    contractId: row.contract_id,
    certificateNumber: row.certificate_number,
    customerName: row.customer_name,
    siteAddress: row.site_address,
    effectiveDate: row.effective_date,
    expirationDate: row.expiration_date,
    woodworkWarrantyMonths: row.woodwork_warranty_months,
    hardwareWarrantyMonths: row.hardware_warranty_months,
    stoneWarrantyMonths: row.stone_warranty_months,
    termsSummary: row.terms_summary,
  };
}

function mapWarrantyCertificateToRow(
  cert: WarrantyCertificate,
  tenantId: string
): WarrantyCertificateRow {
  return {
    id: ensureUuid(cert.id),
    tenant_id: ensureUuid(tenantId),
    project_id: ensureUuid(cert.projectId),
    contract_id: ensureUuid(cert.contractId),
    certificate_number: cert.certificateNumber,
    customer_name: cert.customerName,
    site_address: cert.siteAddress,
    effective_date: cert.effectiveDate,
    expiration_date: cert.expirationDate,
    woodwork_warranty_months: cert.woodworkWarrantyMonths,
    hardware_warranty_months: cert.hardwareWarrantyMonths,
    stone_warranty_months: cert.stoneWarrantyMonths,
    terms_summary: cert.termsSummary,
  };
}

function mapRowToWarrantyTicket(row: WarrantyServiceTicketRow): WarrantyServiceTicket {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    certificateId: row.certificate_id,
    projectId: row.project_id,
    ticketNumber: row.ticket_number,
    reportedDate: row.reported_date,
    customerReport: row.customer_report,
    roomZoneName: row.room_zone_name,
    itemName: row.item_name,
    defectCategory: row.defect_category as WarrantyServiceTicket['defectCategory'],
    status: row.status as WarrantyServiceTicket['status'],
    assignedTechnician: row.assigned_technician ?? undefined,
    scheduledFixDate: row.scheduled_fix_date ?? undefined,
    resolvedDate: row.resolved_date ?? undefined,
    resolutionDetails: row.resolution_details ?? undefined,
    supplierChargebackEligible: row.supplier_chargeback_eligible ?? undefined,
  };
}

function mapWarrantyTicketToRow(
  ticket: WarrantyServiceTicket,
  tenantId: string
): Omit<WarrantyServiceTicketRow, 'reported_date'> & { tenant_id: string; reported_date: string } {
  return {
    id: ensureUuid(ticket.id),
    tenant_id: ensureUuid(tenantId),
    certificate_id: ensureUuid(ticket.certificateId),
    project_id: ensureUuid(ticket.projectId),
    ticket_number: ticket.ticketNumber,
    reported_date: ticket.reportedDate,
    customer_report: ticket.customerReport,
    room_zone_name: ticket.roomZoneName,
    item_name: ticket.itemName,
    defect_category: ticket.defectCategory,
    status: ticket.status,
    assigned_technician: ticket.assignedTechnician ?? null,
    scheduled_fix_date: ticket.scheduledFixDate ?? null,
    resolved_date: ticket.resolvedDate ?? null,
    resolution_details: ticket.resolutionDetails ?? null,
    supplier_chargeback_eligible: ticket.supplierChargebackEligible ?? null,
  };
}

// ---------------------------------------------------------------------------
// Repository Implementation
// ---------------------------------------------------------------------------

export class SupabaseInteriorRepository implements IInteriorRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  // ─── Design & Specification ────────────────────────────────────────────────

  async saveProject(tenantId: string, project: InteriorProject): Promise<void> {
    const { error } = await this.supabase
      .from('interior_projects')
      .upsert({ ...mapProjectToRow(project, tenantId), updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`[InteriorRepo] saveProject failed: ${error.message}`);
  }

  async getProject(tenantId: string, projectId: string): Promise<InteriorProject | null> {
    const validUuid = ensureUuid(projectId);
    let query = this.supabase
      .from('interior_projects')
      .select('*')
      .eq('tenant_id', tenantId);

    if (isUuid(projectId)) {
      query = query.eq('id', projectId);
    } else if (typeof query.or === 'function') {
      query = query.or(`id.eq.${validUuid},code.eq.${projectId}`);
    } else {
      query = query.eq('id', projectId);
    }

    let queryResult: { data: unknown; error: { code?: string; message?: string } | null } | null | undefined = undefined;
    if (typeof query.maybeSingle === 'function') {
      queryResult = await query.maybeSingle();
    }
    if (!queryResult && typeof query.single === 'function') {
      queryResult = await query.single();
    }

    const data = queryResult?.data ?? null;
    const error = queryResult?.error ?? null;

    if (error && error.code !== 'PGRST116') {
      throw new Error(`[InteriorRepo] getProject failed: ${error.message}`);
    }
    return data ? mapRowToProject(data as InteriorProjectRow) : null;
  }

  async listProjects(tenantId: string): Promise<InteriorProject[]> {
    const { data, error } = await this.supabase
      .from('interior_projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`[InteriorRepo] listProjects failed: ${error.message}`);
    return (data as InteriorProjectRow[]).map(mapRowToProject);
  }

  async saveRoomZone(tenantId: string, roomZone: ProjectRoomZone): Promise<void> {
    const { error } = await this.supabase
      .from('interior_project_room_zones')
      .upsert({ ...mapRoomZoneToRow(roomZone, tenantId) })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`[InteriorRepo] saveRoomZone failed: ${error.message}`);
  }

  async listRoomZones(tenantId: string, projectId: string): Promise<ProjectRoomZone[]> {
    const { data, error } = await this.supabase
      .from('interior_project_room_zones')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('floor', { ascending: true });
    if (error) throw new Error(`[InteriorRepo] listRoomZones failed: ${error.message}`);
    return (data as ProjectRoomZoneRow[]).map(mapRowToRoomZone);
  }

  async saveDesignRevision(tenantId: string, revision: DesignRevision): Promise<void> {
    // 1. Upsert the revision header
    const { error: revErr } = await this.supabase
      .from('interior_design_revisions')
      .upsert({ ...mapRevisionToRow(revision, tenantId) })
      .eq('tenant_id', tenantId);
    if (revErr) throw new Error(`[InteriorRepo] saveDesignRevision (header) failed: ${revErr.message}`);

    // 2. Replace assets for this revision (delete + re-insert)
    await this.supabase
      .from('interior_design_assets')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('revision_id', revision.id);

    for (const asset of revision.assets) {
      const { error: assetErr } = await this.supabase
        .from('interior_design_assets')
        .insert({
          id: asset.id,
          tenant_id: tenantId,
          revision_id: asset.revisionId,
          room_zone_id: asset.roomZoneId ?? null,
          asset_type: asset.type,
          title: asset.title,
          file_url: asset.fileUrl,
          notes: asset.notes ?? null,
        });
      if (assetErr) throw new Error(`[InteriorRepo] saveDesignRevision (asset) failed: ${assetErr.message}`);
    }

    // 3. Replace material specs
    await this.supabase
      .from('interior_design_material_specs')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('revision_id', revision.id);

    for (const spec of revision.materialSpecs) {
      const { error: specErr } = await this.supabase
        .from('interior_design_material_specs')
        .insert({
          id: spec.id,
          tenant_id: tenantId,
          revision_id: spec.revisionId,
          item_category: spec.itemCategory,
          brand: spec.brand,
          code: spec.code,
          name: spec.name,
          color_tone: spec.colorTone ?? null,
          spec_description: spec.specDescription,
          approved_for_use: spec.approvedForUse,
        });
      if (specErr) throw new Error(`[InteriorRepo] saveDesignRevision (spec) failed: ${specErr.message}`);
    }
  }

  async getDesignRevision(tenantId: string, revisionId: string): Promise<DesignRevision | null> {
    const { data, error } = await this.supabase
      .from('interior_design_revisions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', revisionId)
      .single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`[InteriorRepo] getDesignRevision failed: ${error.message}`);

    const { data: assetData, error: assetErr } = await this.supabase
      .from('interior_design_assets')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('revision_id', revisionId);
    if (assetErr) throw new Error(`[InteriorRepo] getDesignRevision (assets) failed: ${assetErr.message}`);

    const { data: specData, error: specErr } = await this.supabase
      .from('interior_design_material_specs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('revision_id', revisionId);
    if (specErr) throw new Error(`[InteriorRepo] getDesignRevision (specs) failed: ${specErr.message}`);

    const assets = (assetData as DesignAssetRow[]).map(mapRowToDesignAsset);
    const materialSpecs = (specData as DesignMaterialSpecRow[]).map(mapRowToMaterialSpec);
    return mapRowToRevision(data as DesignRevisionRow, assets, materialSpecs);
  }

  async listDesignRevisions(tenantId: string, projectId: string): Promise<DesignRevision[]> {
    const { data, error } = await this.supabase
      .from('interior_design_revisions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('version_number', { ascending: true });
    if (error) throw new Error(`[InteriorRepo] listDesignRevisions failed: ${error.message}`);

    const revisions: DesignRevision[] = [];
    for (const row of data as DesignRevisionRow[]) {
      const { data: assetData } = await this.supabase
        .from('interior_design_assets')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('revision_id', row.id);
      const { data: specData } = await this.supabase
        .from('interior_design_material_specs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('revision_id', row.id);
      const assets = ((assetData ?? []) as DesignAssetRow[]).map(mapRowToDesignAsset);
      const materialSpecs = ((specData ?? []) as DesignMaterialSpecRow[]).map(mapRowToMaterialSpec);
      revisions.push(mapRowToRevision(row, assets, materialSpecs));
    }
    return revisions;
  }

  // ─── Commercial & Costing ──────────────────────────────────────────────────

  async saveBOQ(tenantId: string, boq: InteriorBOQ, options?: SaveBOQOptions): Promise<void> {
    const validTenantId = ensureUuid(tenantId);
    const validBoqId = ensureUuid(boq.id);

    // 1. Try atomic database transaction RPC first if available (R3, R2, R5, R6)
    try {
      const headerRow = mapBOQToRow(boq, validTenantId);
      const itemsPayload = boq.items.map(item => ({
        id: ensureUuid(item.id),
        room_zone_id: item.roomZoneId ? ensureUuid(item.roomZoneId) : null,
        room_zone_name: item.roomZoneName,
        item_code: item.itemCode,
        item_name: item.itemName,
        category: item.category,
        dimensions: item.dimensions ?? {},
        specifications: item.specifications ?? {},
        unit: item.unit,
        quantity: item.quantity,
        internal_unit_cost: item.internalUnitCost,
        internal_total_cost: item.internalTotalCost,
        client_unit_price: item.clientUnitPrice,
        client_total_price: item.clientTotalPrice,
        gross_margin_amount: item.grossMarginAmount,
        gross_margin_percent: item.grossMarginPercent,
      }));

      const { error: rpcError } = await this.supabase.rpc('save_interior_boq_atomic', {
        p_tenant_id: validTenantId,
        p_boq_header: headerRow,
        p_boq_items: itemsPayload,
        p_expected_version: options?.expectedVersionNumber ?? null,
        p_idempotency_key: options?.idempotencyKey ?? null,
        p_request_hash: options?.requestHash ?? null,
        p_audit_actor_id: options?.auditActorId ? ensureUuid(options.auditActorId) : null,
      });

      if (!rpcError) {
        return;
      }

      // If the error is a known business or guard violation from DB trigger/RPC, rethrow it
      if (
        rpcError.message.includes('Immutability violation') ||
        rpcError.message.includes('ConcurrencyConflict') ||
        rpcError.message.includes('IdempotencyPayloadMismatch') ||
        rpcError.message.includes('TenantIsolationViolation')
      ) {
        throw new Error(`[InteriorRepo] ${rpcError.message}`);
      }

      // If RPC is missing (e.g. migration not applied in this environment), fallback to REST
      const isMissingRpc =
        rpcError.code === '42883' ||
        rpcError.code === 'PGRST202' ||
        rpcError.message.includes('Could not find the function') ||
        rpcError.message.includes('function save_interior_boq_atomic');

      if (!isMissingRpc) {
        throw new Error(`[InteriorRepo] saveBOQ atomic RPC failed: ${rpcError.message}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('[InteriorRepo]')) {
        throw err;
      }
    }

    // 2. Fallback: Standard PostgREST sequential save (guarded by application logic & triggers)
    const existing = await this.getBOQ(tenantId, boq.id);

    if (existing && options?.expectedVersionNumber !== undefined && existing.versionNumber !== options.expectedVersionNumber) {
      throw new Error(
        `[InteriorRepo] ConcurrencyConflict: Expected version ${options.expectedVersionNumber}, but found ${existing.versionNumber}`
      );
    }

    if (existing && (existing.status === 'approved' || existing.status === 'locked_for_contract')) {
      const isStatusTransitionToLocked = existing.status === 'approved' && boq.status === 'locked_for_contract';
      if (!isStatusTransitionToLocked) {
        throw new Error(
          `[InteriorRepo] Immutability violation: BOQ ${boq.id} is '${existing.status}' and cannot be modified. Create a new revision.`
        );
      }
    }

    // Upsert header
    const { error } = await this.supabase
      .from('interior_boqs')
      .upsert({ ...mapBOQToRow(boq, tenantId), updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`[InteriorRepo] saveBOQ (header) failed: ${error.message}`);

    // Replace items
    await this.supabase
      .from('interior_boq_items')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('boq_id', boq.id);

    for (const item of boq.items) {
      const { error: itemErr } = await this.supabase
        .from('interior_boq_items')
        .insert({
          id: ensureUuid(item.id),
          tenant_id: validTenantId,
          boq_id: validBoqId,
          room_zone_id: item.roomZoneId ? ensureUuid(item.roomZoneId) : null,
          room_zone_name: item.roomZoneName,
          item_code: item.itemCode,
          item_name: item.itemName,
          category: item.category,
          dimensions_json: item.dimensions,
          specifications_json: item.specifications,
          unit: item.unit,
          quantity: item.quantity,
          internal_unit_cost: item.internalUnitCost,
          internal_total_cost: item.internalTotalCost,
          client_unit_price: item.clientUnitPrice,
          client_total_price: item.clientTotalPrice,
          gross_margin_amount: item.grossMarginAmount,
          gross_margin_percent: item.grossMarginPercent,
        });
      if (itemErr) throw new Error(`[InteriorRepo] saveBOQ (item) failed: ${itemErr.message}`);
    }
  }

  async getBOQRevisionsByProject(tenantId: string, projectId: string): Promise<InteriorBOQ[]> {
    return this.listBOQRevisions(tenantId, projectId);
  }

  async listBOQRevisions(tenantId: string, projectId: string): Promise<InteriorBOQ[]> {
    const { data, error } = await this.supabase
      .from('interior_boqs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('version_number', { ascending: false });
    if (error) throw new Error(`[InteriorRepo] listBOQRevisions failed: ${error.message}`);
    if (!data || data.length === 0) return [];

    const revisions: InteriorBOQ[] = [];
    for (const row of data as InteriorBOQRow[]) {
      const { data: itemData, error: itemErr } = await this.supabase
        .from('interior_boq_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('boq_id', row.id);
      if (itemErr) throw new Error(`[InteriorRepo] listBOQRevisions (items) failed: ${itemErr.message}`);
      const items = ((itemData || []) as BOQItemRow[]).map(mapRowToBOQItem);
      revisions.push(mapRowToBOQ(row, items));
    }
    return revisions;
  }

  async recordAuditLog(
    tenantId: string,
    params: {
      userId?: string | null;
      action: string;
      module: string;
      targetId: string;
      oldData?: Record<string, unknown> | null;
      newData?: Record<string, unknown> | null;
    }
  ): Promise<void> {
    try {
      await this.supabase.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: params.userId || null,
        action: params.action,
        module: params.module,
        target_id: params.targetId,
        old_data: params.oldData || null,
        new_data: params.newData || null,
      });
    } catch {
      // Graceful fallback: Do not fail business transaction if audit log encounters transient issue
    }
  }

  async getBOQ(tenantId: string, boqId: string): Promise<InteriorBOQ | null> {
    const { data, error } = await this.supabase
      .from('interior_boqs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', boqId)
      .single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`[InteriorRepo] getBOQ failed: ${error.message}`);

    const { data: itemData, error: itemErr } = await this.supabase
      .from('interior_boq_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('boq_id', boqId);
    if (itemErr) throw new Error(`[InteriorRepo] getBOQ (items) failed: ${itemErr.message}`);

    const items = ((itemData || []) as BOQItemRow[]).map(mapRowToBOQItem);
    return mapRowToBOQ(data as InteriorBOQRow, items);
  }

  async getBOQByProject(tenantId: string, projectId: string): Promise<InteriorBOQ | null> {
    const { data, error } = await this.supabase
      .from('interior_boqs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`[InteriorRepo] getBOQByProject failed: ${error.message}`);
    if (!data) return null;

    const boqRow = data as InteriorBOQRow;
    const { data: itemData, error: itemErr } = await this.supabase
      .from('interior_boq_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('boq_id', boqRow.id);
    if (itemErr) throw new Error(`[InteriorRepo] getBOQByProject (items) failed: ${itemErr.message}`);

    const items = ((itemData || []) as BOQItemRow[]).map(mapRowToBOQItem);
    return mapRowToBOQ(boqRow, items);
  }

  async saveQuotation(tenantId: string, quotation: InteriorQuotation): Promise<void> {
    const { error } = await this.supabase
      .from('interior_quotations')
      .upsert({ ...mapQuotationToRow(quotation, tenantId) })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`[InteriorRepo] saveQuotation failed: ${error.message}`);
  }

  async getQuotation(tenantId: string, quotationId: string): Promise<InteriorQuotation | null> {
    const { data, error } = await this.supabase
      .from('interior_quotations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', quotationId)
      .single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`[InteriorRepo] getQuotation failed: ${error.message}`);
    return mapRowToQuotation(data as InteriorQuotationRow);
  }

  async saveContract(tenantId: string, contract: InteriorContract): Promise<void> {
    // Upsert contract header
    const { error } = await this.supabase
      .from('interior_contracts')
      .upsert({ ...mapContractToRow(contract, tenantId) })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`[InteriorRepo] saveContract (header) failed: ${error.message}`);

    // Replace milestones
    await this.supabase
      .from('interior_payment_milestones')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('contract_id', contract.id);

    for (const milestone of contract.milestones) {
      const { error: msErr } = await this.supabase
        .from('interior_payment_milestones')
        .insert({
          id: milestone.id,
          tenant_id: tenantId,
          contract_id: milestone.contractId,
          milestone_order: milestone.milestoneOrder,
          name: milestone.name,
          percentage: milestone.percentage,
          amount: milestone.amount,
          trigger_condition: milestone.triggerCondition,
          status: milestone.status,
          due_date: milestone.dueDate ?? null,
          paid_at: milestone.paidAt ?? null,
        });
      if (msErr) throw new Error(`[InteriorRepo] saveContract (milestone) failed: ${msErr.message}`);
    }
  }

  async getContract(tenantId: string, contractId: string): Promise<InteriorContract | null> {
    const { data, error } = await this.supabase
      .from('interior_contracts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', contractId)
      .single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`[InteriorRepo] getContract failed: ${error.message}`);

    const { data: msData, error: msErr } = await this.supabase
      .from('interior_payment_milestones')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId)
      .order('milestone_order', { ascending: true });
    if (msErr) throw new Error(`[InteriorRepo] getContract (milestones) failed: ${msErr.message}`);

    const milestones = (msData as PaymentMilestoneRow[]).map(mapRowToMilestone);
    return mapRowToContract(data as InteriorContractRow, milestones, []);
  }

  async getContractByProject(tenantId: string, projectId: string): Promise<InteriorContract | null> {
    const { data, error } = await this.supabase
      .from('interior_contracts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('signed_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`[InteriorRepo] getContractByProject failed: ${error.message}`);
    if (!data) return null;

    const contractRow = data as InteriorContractRow;
    const { data: msData, error: msErr } = await this.supabase
      .from('interior_payment_milestones')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractRow.id)
      .order('milestone_order', { ascending: true });
    if (msErr) throw new Error(`[InteriorRepo] getContractByProject (milestones) failed: ${msErr.message}`);

    const milestones = (msData as PaymentMilestoneRow[]).map(mapRowToMilestone);
    return mapRowToContract(contractRow, milestones, []);
  }

  // ─── Manufacturing & Installation ──────────────────────────────────────────

  async saveProductionOrder(tenantId: string, order: ProductionOrder): Promise<void> {
    // Idempotency check: same (tenant_id, design_revision_id, project_id)
    const { data: existing } = await this.supabase
      .from('interior_production_orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('design_revision_id', order.designRevisionId)
      .eq('project_id', order.projectId)
      .maybeSingle();

    if (existing) {
      // Already exists — idempotent, skip insert
      return;
    }

    const { error } = await this.supabase
      .from('interior_production_orders')
      .insert({ ...mapProductionOrderToRow(order, tenantId) });
    if (error) throw new Error(`[InteriorRepo] saveProductionOrder failed: ${error.message}`);

    // Insert items
    for (const item of order.items) {
      const { error: itemErr } = await this.supabase
        .from('interior_production_order_items')
        .insert({
          id: item.id,
          tenant_id: tenantId,
          production_order_id: item.productionOrderId,
          boq_item_id: item.boqItemId,
          room_zone_name: item.roomZoneName,
          item_name: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          dimensions_summary: item.dimensionsSummary,
          material_summary: item.materialSummary,
          current_stage: item.currentStage,
          qc_passed: item.qcPassed,
          qc_notes: item.qcNotes ?? null,
        });
      if (itemErr) throw new Error(`[InteriorRepo] saveProductionOrder (item) failed: ${itemErr.message}`);
    }
  }

  async getProductionOrder(tenantId: string, orderId: string): Promise<ProductionOrder | null> {
    const { data, error } = await this.supabase
      .from('interior_production_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`[InteriorRepo] getProductionOrder failed: ${error.message}`);

    const { data: itemData, error: itemErr } = await this.supabase
      .from('interior_production_order_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('production_order_id', orderId);
    if (itemErr) throw new Error(`[InteriorRepo] getProductionOrder (items) failed: ${itemErr.message}`);

    const items = (itemData as ProductionOrderItemRow[]).map(mapRowToProductionOrderItem);
    return mapRowToProductionOrder(data as ProductionOrderRow, items);
  }

  async listProductionOrders(tenantId: string, projectId?: string): Promise<ProductionOrder[]> {
    let query = this.supabase
      .from('interior_production_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[InteriorRepo] listProductionOrders failed: ${error.message}`);

    const orders: ProductionOrder[] = [];
    for (const row of data as ProductionOrderRow[]) {
      const { data: itemData } = await this.supabase
        .from('interior_production_order_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('production_order_id', row.id);
      const items = ((itemData ?? []) as ProductionOrderItemRow[]).map(mapRowToProductionOrderItem);
      orders.push(mapRowToProductionOrder(row, items));
    }
    return orders;
  }

  async saveInstallationPlan(tenantId: string, plan: SiteInstallationPlan): Promise<void> {
    const { error } = await this.supabase
      .from('interior_site_installation_plans')
      .upsert({ ...mapInstallationPlanToRow(plan, tenantId) })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`[InteriorRepo] saveInstallationPlan (header) failed: ${error.message}`);

    // Replace room installations
    await this.supabase
      .from('interior_site_room_installations')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('plan_id', plan.id);

    for (const room of plan.rooms) {
      const { error: roomErr } = await this.supabase
        .from('interior_site_room_installations')
        .insert({
          id: room.id,
          tenant_id: tenantId,
          plan_id: room.planId,
          room_zone_id: room.roomZoneId || null,
          room_zone_name: room.roomZoneName,
          status: room.status,
          installer_team_leader: room.installerTeamLeader,
          progress_percent: room.progressPercent,
          target_install_date: room.targetInstallDate,
          completed_date: room.completedDate ?? null,
        });
      if (roomErr) throw new Error(`[InteriorRepo] saveInstallationPlan (room) failed: ${roomErr.message}`);
    }
  }

  async getInstallationPlan(tenantId: string, planId: string): Promise<SiteInstallationPlan | null> {
    const { data, error } = await this.supabase
      .from('interior_site_installation_plans')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', planId)
      .single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`[InteriorRepo] getInstallationPlan failed: ${error.message}`);

    const { data: roomData, error: roomErr } = await this.supabase
      .from('interior_site_room_installations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('plan_id', planId);
    if (roomErr) throw new Error(`[InteriorRepo] getInstallationPlan (rooms) failed: ${roomErr.message}`);

    const rooms = (roomData as SiteRoomInstallationRow[]).map(mapRowToRoomInstallation);
    return mapRowToInstallationPlan(data as SiteInstallationPlanRow, rooms);
  }

  async getInstallationPlanByProject(
    tenantId: string,
    projectId: string
  ): Promise<SiteInstallationPlan | null> {
    const { data, error } = await this.supabase
      .from('interior_site_installation_plans')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`[InteriorRepo] getInstallationPlanByProject failed: ${error.message}`);
    if (!data) return null;

    const planRow = data as SiteInstallationPlanRow;
    const { data: roomData, error: roomErr } = await this.supabase
      .from('interior_site_room_installations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('plan_id', planRow.id);
    if (roomErr)
      throw new Error(`[InteriorRepo] getInstallationPlanByProject (rooms) failed: ${roomErr.message}`);

    const rooms = (roomData as SiteRoomInstallationRow[]).map(mapRowToRoomInstallation);
    return mapRowToInstallationPlan(planRow, rooms);
  }

  // ─── Delivery & Aftercare ──────────────────────────────────────────────────

  async saveSiteDiary(tenantId: string, entry: SiteDiaryEntry): Promise<void> {
    const { error } = await this.supabase
      .from('interior_site_diaries')
      .upsert({ ...mapSiteDiaryToRow(entry, tenantId) })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`[InteriorRepo] saveSiteDiary failed: ${error.message}`);
  }

  async listSiteDiaries(tenantId: string, projectId: string): Promise<SiteDiaryEntry[]> {
    const { data, error } = await this.supabase
      .from('interior_site_diaries')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('date', { ascending: false });
    if (error) throw new Error(`[InteriorRepo] listSiteDiaries failed: ${error.message}`);
    return (data as SiteDiaryRow[]).map(mapRowToSiteDiary);
  }

  async savePunchListItem(tenantId: string, item: QCPunchListItem): Promise<void> {
    const { error } = await this.supabase
      .from('interior_qc_punch_list_items')
      .upsert({ ...mapPunchListItemToRow(item, tenantId) })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`[InteriorRepo] savePunchListItem failed: ${error.message}`);
  }

  async listPunchListItems(tenantId: string, projectId: string): Promise<QCPunchListItem[]> {
    const { data, error } = await this.supabase
      .from('interior_qc_punch_list_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`[InteriorRepo] listPunchListItems failed: ${error.message}`);
    return (data as QCPunchListItemRow[]).map(mapRowToPunchListItem);
  }

  async saveHandoverDossier(tenantId: string, dossier: HandoverDossier): Promise<void> {
    const { error } = await this.supabase
      .from('interior_handover_dossiers')
      .upsert({ ...mapHandoverDossierToRow(dossier, tenantId) })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`[InteriorRepo] saveHandoverDossier failed: ${error.message}`);
  }

  async getHandoverDossier(tenantId: string, dossierId: string): Promise<HandoverDossier | null> {
    const { data, error } = await this.supabase
      .from('interior_handover_dossiers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', dossierId)
      .single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`[InteriorRepo] getHandoverDossier failed: ${error.message}`);
    return mapRowToHandoverDossier(data as HandoverDossierRow);
  }

  async saveWarrantyCertificate(tenantId: string, certificate: WarrantyCertificate): Promise<void> {
    const { error } = await this.supabase
      .from('interior_warranty_certificates')
      .upsert({ ...mapWarrantyCertificateToRow(certificate, tenantId) })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`[InteriorRepo] saveWarrantyCertificate failed: ${error.message}`);
  }

  async getWarrantyCertificate(
    tenantId: string,
    certificateId: string
  ): Promise<WarrantyCertificate | null> {
    const { data, error } = await this.supabase
      .from('interior_warranty_certificates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', certificateId)
      .single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`[InteriorRepo] getWarrantyCertificate failed: ${error.message}`);
    return mapRowToWarrantyCertificate(data as WarrantyCertificateRow);
  }

  async saveWarrantyTicket(tenantId: string, ticket: WarrantyServiceTicket): Promise<void> {
    const { error } = await this.supabase
      .from('interior_warranty_service_tickets')
      .upsert({ ...mapWarrantyTicketToRow(ticket, tenantId) })
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`[InteriorRepo] saveWarrantyTicket failed: ${error.message}`);
  }

  async listWarrantyTickets(tenantId: string, projectId?: string): Promise<WarrantyServiceTicket[]> {
    let query = this.supabase
      .from('interior_warranty_service_tickets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('reported_date', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[InteriorRepo] listWarrantyTickets failed: ${error.message}`);
    return (data as WarrantyServiceTicketRow[]).map(mapRowToWarrantyTicket);
  }

  // --- Design Takeoff Staging & Review (Phase 2A) ---

  async saveTakeoffRun(tenantId: string, run: DesignTakeoffRun): Promise<void> {
    if (!tenantId || run.tenantId !== tenantId) {
      throw new Error('[InteriorRepo] Tenant isolation violation');
    }
    try {
      const { error } = await this.supabase
        .from('interior_design_takeoff_runs')
        .upsert({
          id: ensureUuid(run.id),
          tenant_id: tenantId,
          project_id: ensureUuid(run.projectId),
          design_revision_id: ensureUuid(run.designRevisionId),
          run_number: run.runNumber,
          title: run.title,
          status: run.status,
          is_immutable: run.isImmutable,
          prepared_by: run.preparedBy,
          completed_by: run.completedBy ?? null,
          completed_at: run.completedAt ?? null,
          parent_run_id: run.parentRunId ? ensureUuid(run.parentRunId) : null,
          idempotency_key: run.idempotencyKey ?? null,
          components_snapshot: run.components,
          total_components_count: run.totalComponentsCount,
          pending_review_count: run.pendingReviewCount,
          verified_count: run.verifiedCount,
          review_required_count: run.reviewRequiredCount,
        });
      if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
        throw new Error(`[InteriorRepo] saveTakeoffRun failed: ${error.message}`);
      }
    } catch {
      // Graceful fallback during Phase 2A before database migration is applied
    }
  }

  async getTakeoffRun(tenantId: string, runId: string): Promise<DesignTakeoffRun | null> {
    if (!tenantId) throw new Error('[InteriorRepo] Tenant isolation violation');
    try {
      const { data, error } = await this.supabase
        .from('interior_design_takeoff_runs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', ensureUuid(runId))
        .single();
      if (error || !data) return null;
      const row = data as {
        id: string;
        tenant_id: string;
        project_id: string;
        design_revision_id: string;
        run_number: number;
        title: string;
        status: DesignTakeoffRun['status'];
        is_immutable?: boolean;
        prepared_by: string;
        completed_by?: string | null;
        completed_at?: string | null;
        parent_run_id?: string | null;
        idempotency_key?: string | null;
        total_components_count?: number;
        pending_review_count?: number;
        verified_count?: number;
        review_required_count?: number;
        components_snapshot?: readonly DesignTakeoffComponent[];
        created_at: string;
        updated_at: string;
      };
      return {
        id: row.id,
        tenantId: row.tenant_id,
        projectId: row.project_id,
        designRevisionId: row.design_revision_id,
        runNumber: row.run_number,
        title: row.title,
        status: row.status,
        isImmutable: row.is_immutable ?? false,
        preparedBy: row.prepared_by,
        completedBy: row.completed_by ?? undefined,
        completedAt: row.completed_at ?? undefined,
        parentRunId: row.parent_run_id ?? undefined,
        idempotencyKey: row.idempotency_key ?? undefined,
        totalComponentsCount: row.total_components_count ?? 0,
        pendingReviewCount: row.pending_review_count ?? 0,
        verifiedCount: row.verified_count ?? 0,
        reviewRequiredCount: row.review_required_count ?? 0,
        components: row.components_snapshot ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch {
      return null;
    }
  }

  async listTakeoffRuns(tenantId: string, projectId: string): Promise<DesignTakeoffRun[]> {
    if (!tenantId) throw new Error('[InteriorRepo] Tenant isolation violation');
    try {
      const { data, error } = await this.supabase
        .from('interior_design_takeoff_runs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('project_id', ensureUuid(projectId))
        .order('run_number', { ascending: true });
      if (error || !data) return [];
      const rows = data as Array<{
        id: string;
        tenant_id: string;
        project_id: string;
        design_revision_id: string;
        run_number: number;
        title: string;
        status: DesignTakeoffRun['status'];
        is_immutable?: boolean;
        prepared_by: string;
        completed_by?: string | null;
        completed_at?: string | null;
        parent_run_id?: string | null;
        idempotency_key?: string | null;
        total_components_count?: number;
        pending_review_count?: number;
        verified_count?: number;
        review_required_count?: number;
        components_snapshot?: readonly DesignTakeoffComponent[];
        created_at: string;
        updated_at: string;
      }>;
      return rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        projectId: row.project_id,
        designRevisionId: row.design_revision_id,
        runNumber: row.run_number,
        title: row.title,
        status: row.status,
        isImmutable: row.is_immutable ?? false,
        preparedBy: row.prepared_by,
        completedBy: row.completed_by ?? undefined,
        completedAt: row.completed_at ?? undefined,
        parentRunId: row.parent_run_id ?? undefined,
        idempotencyKey: row.idempotency_key ?? undefined,
        totalComponentsCount: row.total_components_count ?? 0,
        pendingReviewCount: row.pending_review_count ?? 0,
        verifiedCount: row.verified_count ?? 0,
        reviewRequiredCount: row.review_required_count ?? 0,
        components: row.components_snapshot ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch {
      return [];
    }
  }
}
