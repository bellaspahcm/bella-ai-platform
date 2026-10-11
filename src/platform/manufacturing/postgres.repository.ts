import type { QueryResultRow } from 'pg';

import type {
  BOMComponent,
  BOMRevision,
  CommandLogEntry,
  FinishedGoodsReceiptEvidence,
  ManufacturingId,
  MaterialIssueLogisticsEvidence,
  MaterialRequirement,
  ProductionPlan,
  ProductionPlanMaterialRequirement,
  ProductionPlanScheduleSlot,
  ProductionOperationProgress,
  ProductionCompletion,
  ProductionExecution,
  ProductionOrder,
  ProductionOrderLine,
  QualityDispositionEvidence,
  RoutingOperation,
  RoutingRevision,
  TenantId,
  WorkCenter,
} from './domain/types';
import type { ManufacturingRepository } from './ports';

export interface ManufacturingSqlClient {
  query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

type ProductionOrderRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  factory_org_unit_id: string;
  order_number: string;
  finished_good_item_id: string;
  target_quantity: string | number;
  uom: string;
  status: ProductionOrder['status'];
  bom_revision_id: string | null;
  created_by: string;
  created_at: string | Date;
  released_by: string | null;
  released_at: string | Date | null;
  completed_by: string | null;
  completed_at: string | Date | null;
};

type ProductionOrderLineRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  production_order_id: string;
  finished_good_item_id: string;
  target_quantity: string | number;
  uom: string;
};

type WorkCenterRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  factory_org_unit_id: string;
  code: string;
  name: string;
  status: WorkCenter['status'];
  created_by: string;
  created_at: string | Date;
};

type RoutingRevisionRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  factory_org_unit_id: string;
  finished_good_item_id: string;
  revision_code: string;
  status: RoutingRevision['status'];
  created_by: string;
  created_at: string | Date;
  approved_by: string | null;
  approved_at: string | Date | null;
};

type RoutingOperationRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  routing_revision_id: string;
  sequence: string | number;
  operation_code: string;
  operation_name: string;
  work_center_id: string;
  required: boolean;
};

type OperationProgressRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  factory_org_unit_id: string;
  production_order_id: string;
  production_order_line_id: string;
  routing_revision_id: string;
  routing_operation_id: string;
  work_center_id: string;
  required: boolean;
  status: ProductionOperationProgress['status'];
  blocked_reason: string | null;
  production_execution_id: string | null;
  completed_quantity: string | number | null;
  quantity_uom: string | null;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  updated_by: string;
  updated_at: string | Date;
};

type BOMRevisionRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  finished_good_item_id: string;
  revision_code: string;
  status: BOMRevision['status'];
  created_by: string;
  created_at: string | Date;
  approved_by: string | null;
  approved_at: string | Date | null;
};

type BOMComponentRow = QueryResultRow & {
  id: string;
  component_item_id: string;
  quantity_per_unit: string | number;
  uom: string;
  scrap_allowance_percent: string | number | null;
};

type MaterialRequirementRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  production_order_id: string;
  bom_revision_id: string;
  component_item_id: string;
  source_location_id: string;
  required_quantity: string | number;
  available_quantity: string | number | null;
  status: MaterialRequirement['status'];
  checked_at: string | Date | null;
};

type ProductionPlanRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  factory_org_unit_id: string;
  plan_number: string;
  source_type: ProductionPlan['sourceType'];
  source_reference_id: string | null;
  source_reference_number: string | null;
  finished_good_item_id: string;
  planned_quantity: string | number;
  uom: string;
  requested_due_at: string | Date | null;
  status: ProductionPlan['status'];
  bom_revision_id: string | null;
  routing_revision_id: string | null;
  source_location_id: string | null;
  material_readiness_status: ProductionPlan['materialReadinessStatus'];
  material_readiness_checked_at: string | Date | null;
  material_requirements: unknown;
  linked_production_order_id: string | null;
  created_by: string;
  created_at: string | Date;
  updated_by: string | null;
  updated_at: string | Date | null;
  submitted_by: string | null;
  submitted_at: string | Date | null;
  approved_by: string | null;
  approved_at: string | Date | null;
  rejected_by: string | null;
  rejected_at: string | Date | null;
  rejection_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | Date | null;
};

type ProductionPlanScheduleSlotRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  factory_org_unit_id: string;
  production_plan_id: string;
  routing_revision_id: string;
  routing_operation_id: string;
  operation_sequence: string | number;
  work_center_id: string;
  planned_date: string | Date;
  shift_code: string;
  planned_quantity: string | number;
  status: ProductionPlanScheduleSlot['status'];
  created_by: string;
  created_at: string | Date;
  updated_by: string | null;
  updated_at: string | Date | null;
};

type ProductionExecutionRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  factory_org_unit_id: string;
  production_order_id: string;
  production_order_line_id: string;
  material_issue_document_id: string;
  material_issue_movement_id: string;
  material_issue_evidence: MaterialIssueLogisticsEvidence | null;
  material_requirement_id: string | null;
  actual_quantity: string | number;
  accepted_quantity: string | number;
  rejected_quantity: string | number;
  scrap_quantity: string | number;
  uom: string;
  recorded_by: string;
  recorded_at: string | Date;
};

type ProductionCompletionRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  factory_org_unit_id: string;
  production_order_id: string;
  completed_quantity: string | number;
  rejected_quantity: string | number;
  scrap_quantity: string | number;
  uom: string;
  receipt_evidence: FinishedGoodsReceiptEvidence[];
  quality_disposition_evidence: QualityDispositionEvidence[];
  completed_by: string;
  completed_at: string | Date;
};

type QualityDispositionRow = QueryResultRow & {
  id: string;
  tenant_id: string;
  factory_org_unit_id: string;
  production_order_id: string;
  production_order_line_id: string;
  production_execution_id: string;
  receipt_document_id: string | null;
  receipt_line_id: string | null;
  source_quantity_type: QualityDispositionEvidence['sourceQuantityType'];
  disposition: QualityDispositionEvidence['disposition'];
  quantity: string | number;
  accepted_output_quantity: string | number;
  reason_code: string | null;
  reason_text: string | null;
  evidence_reference: string | null;
  final_handling_decision: boolean | null;
  conditional_accept_policy_approved: boolean | null;
  terminal: boolean;
  decided_by: string;
  decided_at: string | Date;
};

type CommandLogRow<T> = QueryResultRow & {
  tenant_id: string;
  factory_org_unit_id: string;
  operation: string;
  business_key: string;
  payload_hash: string;
  result: T;
  created_at: string | Date;
};

export class PostgresManufacturingRepository implements ManufacturingRepository {
  constructor(
    private readonly db: ManufacturingSqlClient,
    private readonly inTransaction = false
  ) {}

  async withTransaction<T>(callback: (repository: ManufacturingRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return callback(this);
    await this.db.query('BEGIN');
    try {
      const result = await callback(new PostgresManufacturingRepository(this.db, true));
      await this.db.query('COMMIT');
      return result;
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async saveProductionOrder(order: ProductionOrder): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_production_orders (
          id, tenant_id, factory_org_unit_id, order_number, finished_good_item_id,
          target_quantity, uom, status, bom_revision_id, created_by, created_at,
          released_by, released_at, completed_by, completed_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          status = EXCLUDED.status,
          bom_revision_id = EXCLUDED.bom_revision_id,
          released_by = EXCLUDED.released_by,
          released_at = EXCLUDED.released_at,
          completed_by = EXCLUDED.completed_by,
          completed_at = EXCLUDED.completed_at,
          updated_at = NOW()
      `,
      [
        order.id,
        order.tenantId,
        order.factoryOrgUnitId,
        order.orderNumber,
        order.finishedGoodItemId,
        order.targetQuantity,
        order.uom,
        order.status,
        order.bomRevisionId ?? null,
        order.createdBy,
        order.createdAt,
        order.releasedBy ?? null,
        order.releasedAt ?? null,
        order.completedBy ?? null,
        order.completedAt ?? null,
      ]
    );

    for (const line of order.lines) {
      await this.db.query(
        `
          INSERT INTO public.manufacturing_production_order_lines (
            id, tenant_id, production_order_id, finished_good_item_id, target_quantity, uom
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (tenant_id, production_order_id, finished_good_item_id)
          DO UPDATE SET
            target_quantity = EXCLUDED.target_quantity,
            uom = EXCLUDED.uom
        `,
        [
          line.id,
          line.tenantId,
          line.productionOrderId,
          line.finishedGoodItemId,
          line.targetQuantity,
          line.uom,
        ]
      );
    }
  }

  async getProductionOrder(tenantId: TenantId, id: ManufacturingId): Promise<ProductionOrder | null> {
    const result = await this.db.query<ProductionOrderRow>(
      'SELECT * FROM public.manufacturing_production_orders WHERE tenant_id = $1 AND id = $2',
      [tenantId, id]
    );
    return result.rows[0]
      ? this.mapProductionOrder(result.rows[0], await this.getProductionOrderLines(tenantId, id))
      : null;
  }

  async listProductionOrders(params: {
    tenantId: TenantId;
    factoryOrgUnitId: string;
    limit?: number;
  }): Promise<ProductionOrder[]> {
    const result = await this.db.query<ProductionOrderRow>(
      `
        SELECT *
        FROM public.manufacturing_production_orders
        WHERE tenant_id = $1 AND factory_org_unit_id = $2
        ORDER BY created_at DESC, id DESC
        LIMIT $3
      `,
      [params.tenantId, params.factoryOrgUnitId, params.limit ?? 50]
    );

    const orders: ProductionOrder[] = [];
    for (const row of result.rows) {
      orders.push(this.mapProductionOrder(row, await this.getProductionOrderLines(row.tenant_id, row.id)));
    }
    return orders;
  }

  async findProductionOrderByNumber(tenantId: TenantId, orderNumber: string): Promise<ProductionOrder | null> {
    const result = await this.db.query<ProductionOrderRow>(
      'SELECT * FROM public.manufacturing_production_orders WHERE tenant_id = $1 AND order_number = $2',
      [tenantId, orderNumber]
    );
    return result.rows[0]
      ? this.mapProductionOrder(
          result.rows[0],
          await this.getProductionOrderLines(tenantId, result.rows[0].id)
        )
      : null;
  }

  async getProductionOrderLine(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    productionOrderLineId: ManufacturingId;
  }): Promise<ProductionOrderLine | null> {
    const result = await this.db.query<ProductionOrderLineRow>(
      `
        SELECT id, tenant_id, production_order_id, finished_good_item_id, target_quantity, uom
        FROM public.manufacturing_production_order_lines
        WHERE tenant_id = $1 AND production_order_id = $2 AND id = $3
      `,
      [params.tenantId, params.productionOrderId, params.productionOrderLineId]
    );
    return result.rows[0] ? this.mapProductionOrderLine(result.rows[0]) : null;
  }

  async saveProductionPlan(plan: ProductionPlan): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_production_plans (
          id, tenant_id, factory_org_unit_id, plan_number, source_type,
          source_reference_id, source_reference_number, finished_good_item_id,
          planned_quantity, uom, requested_due_at, status, bom_revision_id,
          routing_revision_id, source_location_id, material_readiness_status,
          material_readiness_checked_at, material_requirements, linked_production_order_id,
          created_by, created_at, updated_by, updated_at, submitted_by, submitted_at,
          approved_by, approved_at, rejected_by, rejected_at, rejection_reason,
          cancelled_by, cancelled_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16,
          $17, $18::jsonb, $19,
          $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30,
          $31, $32
        )
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          source_reference_id = EXCLUDED.source_reference_id,
          source_reference_number = EXCLUDED.source_reference_number,
          finished_good_item_id = EXCLUDED.finished_good_item_id,
          planned_quantity = EXCLUDED.planned_quantity,
          uom = EXCLUDED.uom,
          requested_due_at = EXCLUDED.requested_due_at,
          status = EXCLUDED.status,
          bom_revision_id = EXCLUDED.bom_revision_id,
          routing_revision_id = EXCLUDED.routing_revision_id,
          source_location_id = EXCLUDED.source_location_id,
          material_readiness_status = EXCLUDED.material_readiness_status,
          material_readiness_checked_at = EXCLUDED.material_readiness_checked_at,
          material_requirements = EXCLUDED.material_requirements,
          linked_production_order_id = EXCLUDED.linked_production_order_id,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at,
          submitted_by = EXCLUDED.submitted_by,
          submitted_at = EXCLUDED.submitted_at,
          approved_by = EXCLUDED.approved_by,
          approved_at = EXCLUDED.approved_at,
          rejected_by = EXCLUDED.rejected_by,
          rejected_at = EXCLUDED.rejected_at,
          rejection_reason = EXCLUDED.rejection_reason,
          cancelled_by = EXCLUDED.cancelled_by,
          cancelled_at = EXCLUDED.cancelled_at
      `,
      [
        plan.id,
        plan.tenantId,
        plan.factoryOrgUnitId,
        plan.planNumber,
        plan.sourceType,
        plan.sourceReferenceId ?? null,
        plan.sourceReferenceNumber ?? null,
        plan.finishedGoodItemId,
        plan.plannedQuantity,
        plan.uom,
        plan.requestedDueAt ?? null,
        plan.status,
        plan.bomRevisionId ?? null,
        plan.routingRevisionId ?? null,
        plan.sourceLocationId ?? null,
        plan.materialReadinessStatus,
        plan.materialReadinessCheckedAt ?? null,
        JSON.stringify(plan.materialRequirements),
        plan.linkedProductionOrderId ?? null,
        plan.createdBy,
        plan.createdAt,
        plan.updatedBy ?? null,
        plan.updatedAt ?? null,
        plan.submittedBy ?? null,
        plan.submittedAt ?? null,
        plan.approvedBy ?? null,
        plan.approvedAt ?? null,
        plan.rejectedBy ?? null,
        plan.rejectedAt ?? null,
        plan.rejectionReason ?? null,
        plan.cancelledBy ?? null,
        plan.cancelledAt ?? null,
      ]
    );
  }

  async getProductionPlan(tenantId: TenantId, id: ManufacturingId): Promise<ProductionPlan | null> {
    const result = await this.db.query<ProductionPlanRow>(
      'SELECT * FROM public.manufacturing_production_plans WHERE tenant_id = $1 AND id = $2',
      [tenantId, id]
    );
    return result.rows[0] ? this.mapProductionPlan(result.rows[0]) : null;
  }

  async listProductionPlans(params: {
    tenantId: TenantId;
    factoryOrgUnitId: string;
    limit?: number;
  }): Promise<ProductionPlan[]> {
    const result = await this.db.query<ProductionPlanRow>(
      `
        SELECT *
        FROM public.manufacturing_production_plans
        WHERE tenant_id = $1 AND factory_org_unit_id = $2
        ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
        LIMIT $3
      `,
      [params.tenantId, params.factoryOrgUnitId, params.limit ?? 50]
    );
    return result.rows.map((row) => this.mapProductionPlan(row));
  }

  async findProductionPlanByNumber(tenantId: TenantId, planNumber: string): Promise<ProductionPlan | null> {
    const result = await this.db.query<ProductionPlanRow>(
      'SELECT * FROM public.manufacturing_production_plans WHERE tenant_id = $1 AND plan_number = $2',
      [tenantId, planNumber]
    );
    return result.rows[0] ? this.mapProductionPlan(result.rows[0]) : null;
  }

  async saveProductionPlanScheduleSlots(params: {
    productionPlanId: ManufacturingId;
    slots: ProductionPlanScheduleSlot[];
  }): Promise<void> {
    const tenantId = params.slots[0]?.tenantId;
    if (tenantId) {
      await this.db.query(
        'DELETE FROM public.manufacturing_production_plan_schedule_slots WHERE tenant_id = $1 AND production_plan_id = $2',
        [tenantId, params.productionPlanId]
      );
    }
    for (const slot of params.slots) {
      await this.db.query(
        `
          INSERT INTO public.manufacturing_production_plan_schedule_slots (
            id, tenant_id, factory_org_unit_id, production_plan_id, routing_revision_id,
            routing_operation_id, operation_sequence, work_center_id, planned_date,
            shift_code, planned_quantity, status, created_by, created_at, updated_by, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (tenant_id, id)
          DO UPDATE SET
            planned_date = EXCLUDED.planned_date,
            shift_code = EXCLUDED.shift_code,
            planned_quantity = EXCLUDED.planned_quantity,
            status = EXCLUDED.status,
            updated_by = EXCLUDED.updated_by,
            updated_at = EXCLUDED.updated_at
        `,
        [
          slot.id,
          slot.tenantId,
          slot.factoryOrgUnitId,
          slot.productionPlanId,
          slot.routingRevisionId,
          slot.routingOperationId,
          slot.operationSequence,
          slot.workCenterId,
          slot.plannedDate,
          slot.shiftCode,
          slot.plannedQuantity,
          slot.status,
          slot.createdBy,
          slot.createdAt,
          slot.updatedBy ?? null,
          slot.updatedAt ?? null,
        ]
      );
    }
  }

  async getProductionPlanScheduleSlots(params: {
    tenantId: TenantId;
    productionPlanId: ManufacturingId;
  }): Promise<ProductionPlanScheduleSlot[]> {
    const result = await this.db.query<ProductionPlanScheduleSlotRow>(
      `
        SELECT *
        FROM public.manufacturing_production_plan_schedule_slots
        WHERE tenant_id = $1 AND production_plan_id = $2
        ORDER BY planned_date, shift_code, operation_sequence, id
      `,
      [params.tenantId, params.productionPlanId]
    );
    return result.rows.map((row) => this.mapProductionPlanScheduleSlot(row));
  }

  async listProductionPlanScheduleSlots(params: {
    tenantId: TenantId;
    factoryOrgUnitId: string;
    limit?: number;
  }): Promise<ProductionPlanScheduleSlot[]> {
    const result = await this.db.query<ProductionPlanScheduleSlotRow>(
      `
        SELECT *
        FROM public.manufacturing_production_plan_schedule_slots
        WHERE tenant_id = $1 AND factory_org_unit_id = $2
        ORDER BY planned_date, shift_code, operation_sequence, id
        LIMIT $3
      `,
      [params.tenantId, params.factoryOrgUnitId, params.limit ?? 200]
    );
    return result.rows.map((row) => this.mapProductionPlanScheduleSlot(row));
  }

  async findProductionPlanScheduleConflict(params: {
    tenantId: TenantId;
    factoryOrgUnitId: string;
    workCenterId: ManufacturingId;
    plannedDate: string;
    shiftCode: string;
    excludeProductionPlanId?: ManufacturingId;
  }): Promise<ProductionPlanScheduleSlot | null> {
    const result = await this.db.query<ProductionPlanScheduleSlotRow>(
      `
        SELECT *
        FROM public.manufacturing_production_plan_schedule_slots
        WHERE tenant_id = $1
          AND factory_org_unit_id = $2
          AND work_center_id = $3
          AND planned_date = $4::date
          AND shift_code = $5
          AND status IN ('planned', 'released')
          AND ($6::uuid IS NULL OR production_plan_id <> $6::uuid)
        ORDER BY created_at, id
        LIMIT 1
      `,
      [
        params.tenantId,
        params.factoryOrgUnitId,
        params.workCenterId,
        params.plannedDate,
        params.shiftCode,
        params.excludeProductionPlanId ?? null,
      ]
    );
    return result.rows[0] ? this.mapProductionPlanScheduleSlot(result.rows[0]) : null;
  }

  async saveWorkCenter(workCenter: WorkCenter): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_work_centers (
          id, tenant_id, factory_org_unit_id, code, name, status, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          updated_at = NOW()
      `,
      [
        workCenter.id,
        workCenter.tenantId,
        workCenter.factoryOrgUnitId,
        workCenter.code,
        workCenter.name,
        workCenter.status,
        workCenter.createdBy,
        workCenter.createdAt,
      ]
    );
  }

  async getWorkCenter(tenantId: TenantId, id: ManufacturingId): Promise<WorkCenter | null> {
    const result = await this.db.query<WorkCenterRow>(
      'SELECT * FROM public.manufacturing_work_centers WHERE tenant_id = $1 AND id = $2',
      [tenantId, id]
    );
    return result.rows[0] ? this.mapWorkCenter(result.rows[0]) : null;
  }

  async listWorkCenters(params: {
    tenantId: TenantId;
    factoryOrgUnitId: string;
  }): Promise<WorkCenter[]> {
    const result = await this.db.query<WorkCenterRow>(
      `
        SELECT *
        FROM public.manufacturing_work_centers
        WHERE tenant_id = $1 AND factory_org_unit_id = $2
        ORDER BY code, id
      `,
      [params.tenantId, params.factoryOrgUnitId]
    );
    return result.rows.map((row) => this.mapWorkCenter(row));
  }

  async findWorkCenterByCode(params: {
    tenantId: TenantId;
    factoryOrgUnitId: string;
    code: string;
  }): Promise<WorkCenter | null> {
    const result = await this.db.query<WorkCenterRow>(
      `
        SELECT *
        FROM public.manufacturing_work_centers
        WHERE tenant_id = $1 AND factory_org_unit_id = $2 AND code = $3
      `,
      [params.tenantId, params.factoryOrgUnitId, params.code]
    );
    return result.rows[0] ? this.mapWorkCenter(result.rows[0]) : null;
  }

  async saveRoutingRevision(revision: RoutingRevision): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_routing_revisions (
          id, tenant_id, factory_org_unit_id, finished_good_item_id, revision_code, status,
          created_by, created_at, approved_by, approved_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          status = EXCLUDED.status,
          approved_by = EXCLUDED.approved_by,
          approved_at = EXCLUDED.approved_at,
          updated_at = NOW()
      `,
      [
        revision.id,
        revision.tenantId,
        revision.factoryOrgUnitId,
        revision.finishedGoodItemId,
        revision.revisionCode,
        revision.status,
        revision.createdBy,
        revision.createdAt,
        revision.approvedBy ?? null,
        revision.approvedAt ?? null,
      ]
    );

    await this.db.query(
      'DELETE FROM public.manufacturing_routing_operations WHERE tenant_id = $1 AND routing_revision_id = $2',
      [revision.tenantId, revision.id]
    );
    for (const operation of revision.operations) {
      await this.db.query(
        `
          INSERT INTO public.manufacturing_routing_operations (
            id, tenant_id, routing_revision_id, operation_sequence, operation_code,
            operation_name, work_center_id, required
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          operation.id,
          operation.tenantId,
          operation.routingRevisionId,
          operation.sequence,
          operation.operationCode,
          operation.operationName,
          operation.workCenterId,
          operation.required,
        ]
      );
    }
  }

  async getRoutingRevision(tenantId: TenantId, id: ManufacturingId): Promise<RoutingRevision | null> {
    const result = await this.db.query<RoutingRevisionRow>(
      'SELECT * FROM public.manufacturing_routing_revisions WHERE tenant_id = $1 AND id = $2',
      [tenantId, id]
    );
    return result.rows[0]
      ? this.mapRoutingRevision(result.rows[0], await this.getRoutingOperations(tenantId, id))
      : null;
  }

  async listRoutingRevisions(params: {
    tenantId: TenantId;
    factoryOrgUnitId: string;
  }): Promise<RoutingRevision[]> {
    const result = await this.db.query<RoutingRevisionRow>(
      `
        SELECT *
        FROM public.manufacturing_routing_revisions
        WHERE tenant_id = $1 AND factory_org_unit_id = $2
        ORDER BY finished_good_item_id, revision_code, id
      `,
      [params.tenantId, params.factoryOrgUnitId]
    );

    const revisions: RoutingRevision[] = [];
    for (const row of result.rows) {
      revisions.push(this.mapRoutingRevision(row, await this.getRoutingOperations(row.tenant_id, row.id)));
    }
    return revisions;
  }

  async findRoutingRevisionByCode(params: {
    tenantId: TenantId;
    factoryOrgUnitId: string;
    finishedGoodItemId: string;
    revisionCode: string;
  }): Promise<RoutingRevision | null> {
    const result = await this.db.query<RoutingRevisionRow>(
      `
        SELECT *
        FROM public.manufacturing_routing_revisions
        WHERE tenant_id = $1
          AND factory_org_unit_id = $2
          AND finished_good_item_id = $3
          AND revision_code = $4
      `,
      [params.tenantId, params.factoryOrgUnitId, params.finishedGoodItemId, params.revisionCode]
    );
    return result.rows[0]
      ? this.mapRoutingRevision(result.rows[0], await this.getRoutingOperations(params.tenantId, result.rows[0].id))
      : null;
  }

  async saveOperationProgress(progress: ProductionOperationProgress): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_operation_progress (
          id, tenant_id, factory_org_unit_id, production_order_id, production_order_line_id,
          routing_revision_id, routing_operation_id, work_center_id, required, status,
          blocked_reason, production_execution_id, completed_quantity, quantity_uom,
          started_at, completed_at, updated_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          required = EXCLUDED.required,
          status = EXCLUDED.status,
          blocked_reason = EXCLUDED.blocked_reason,
          production_execution_id = EXCLUDED.production_execution_id,
          completed_quantity = EXCLUDED.completed_quantity,
          quantity_uom = EXCLUDED.quantity_uom,
          started_at = EXCLUDED.started_at,
          completed_at = EXCLUDED.completed_at,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
      `,
      [
        progress.id,
        progress.tenantId,
        progress.factoryOrgUnitId,
        progress.productionOrderId,
        progress.productionOrderLineId,
        progress.routingRevisionId,
        progress.routingOperationId,
        progress.workCenterId,
        progress.required,
        progress.status,
        progress.blockedReason ?? null,
        progress.productionExecutionId ?? null,
        progress.completedQuantity ?? null,
        progress.quantityUom ?? null,
        progress.startedAt ?? null,
        progress.completedAt ?? null,
        progress.updatedBy,
        progress.updatedAt,
      ]
    );
  }

  async getOperationProgressById(
    tenantId: TenantId,
    id: ManufacturingId
  ): Promise<ProductionOperationProgress | null> {
    const result = await this.db.query<OperationProgressRow>(
      'SELECT * FROM public.manufacturing_operation_progress WHERE tenant_id = $1 AND id = $2',
      [tenantId, id]
    );
    return result.rows[0] ? this.mapOperationProgress(result.rows[0]) : null;
  }

  async getOperationProgress(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
  }): Promise<ProductionOperationProgress[]> {
    const result = await this.db.query<OperationProgressRow>(
      `
        SELECT *
        FROM public.manufacturing_operation_progress
        WHERE tenant_id = $1 AND production_order_id = $2
        ORDER BY routing_revision_id, routing_operation_id, id
      `,
      [params.tenantId, params.productionOrderId]
    );
    return result.rows.map((row) => this.mapOperationProgress(row));
  }

  async saveBOMRevision(revision: BOMRevision): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_bom_revisions (
          id, tenant_id, finished_good_item_id, revision_code, status,
          created_by, created_at, approved_by, approved_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          status = EXCLUDED.status,
          approved_by = EXCLUDED.approved_by,
          approved_at = EXCLUDED.approved_at,
          updated_at = NOW()
      `,
      [
        revision.id,
        revision.tenantId,
        revision.finishedGoodItemId,
        revision.revisionCode,
        revision.status,
        revision.createdBy,
        revision.createdAt,
        revision.approvedBy ?? null,
        revision.approvedAt ?? null,
      ]
    );

    await this.db.query(
      'DELETE FROM public.manufacturing_bom_components WHERE tenant_id = $1 AND bom_revision_id = $2',
      [revision.tenantId, revision.id]
    );
    for (const component of revision.components) {
      await this.db.query(
        `
          INSERT INTO public.manufacturing_bom_components (
            id, tenant_id, bom_revision_id, component_item_id,
            quantity_per_unit, uom, scrap_allowance_percent
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          component.id,
          revision.tenantId,
          revision.id,
          component.componentItemId,
          component.quantityPerUnit,
          component.uom,
          component.scrapAllowancePercent ?? null,
        ]
      );
    }
  }

  async getBOMRevision(tenantId: TenantId, id: ManufacturingId): Promise<BOMRevision | null> {
    const revisions = await this.db.query<BOMRevisionRow>(
      'SELECT * FROM public.manufacturing_bom_revisions WHERE tenant_id = $1 AND id = $2',
      [tenantId, id]
    );
    const revision = revisions.rows[0];
    if (!revision) return null;
    return this.mapBOMRevision(revision, await this.getBOMComponents(tenantId, id));
  }

  async listBOMRevisions(params: { tenantId: TenantId }): Promise<BOMRevision[]> {
    const result = await this.db.query<BOMRevisionRow>(
      `
        SELECT *
        FROM public.manufacturing_bom_revisions
        WHERE tenant_id = $1
        ORDER BY finished_good_item_id, revision_code, id
      `,
      [params.tenantId]
    );

    const revisions: BOMRevision[] = [];
    for (const row of result.rows) {
      revisions.push(this.mapBOMRevision(row, await this.getBOMComponents(row.tenant_id, row.id)));
    }
    return revisions;
  }

  async findBOMRevisionByCode(params: {
    tenantId: TenantId;
    finishedGoodItemId: string;
    revisionCode: string;
  }): Promise<BOMRevision | null> {
    const revisions = await this.db.query<BOMRevisionRow>(
      `
        SELECT * FROM public.manufacturing_bom_revisions
        WHERE tenant_id = $1 AND finished_good_item_id = $2 AND revision_code = $3
      `,
      [params.tenantId, params.finishedGoodItemId, params.revisionCode]
    );
    const revision = revisions.rows[0];
    if (!revision) return null;
    return this.mapBOMRevision(revision, await this.getBOMComponents(params.tenantId, revision.id));
  }

  async saveMaterialRequirements(requirements: MaterialRequirement[]): Promise<void> {
    for (const requirement of requirements) {
      await this.db.query(
        `
          INSERT INTO public.manufacturing_material_requirements (
            id, tenant_id, production_order_id, bom_revision_id, component_item_id,
            source_location_id, required_quantity, available_quantity, status, checked_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (tenant_id, id)
          DO UPDATE SET
            available_quantity = EXCLUDED.available_quantity,
            status = EXCLUDED.status,
            checked_at = EXCLUDED.checked_at,
            updated_at = NOW()
        `,
        [
          requirement.id,
          requirement.tenantId,
          requirement.productionOrderId,
          requirement.bomRevisionId,
          requirement.componentItemId,
          requirement.sourceLocationId,
          requirement.requiredQuantity,
          requirement.availableQuantity ?? null,
          requirement.status,
          requirement.checkedAt ?? null,
        ]
      );
    }
  }

  async getMaterialRequirements(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    bomRevisionId: ManufacturingId;
  }): Promise<MaterialRequirement[]> {
    const result = await this.db.query<MaterialRequirementRow>(
      `
        SELECT * FROM public.manufacturing_material_requirements
        WHERE tenant_id = $1 AND production_order_id = $2 AND bom_revision_id = $3
        ORDER BY component_item_id
      `,
      [params.tenantId, params.productionOrderId, params.bomRevisionId]
    );
    return result.rows.map((row) => this.mapMaterialRequirement(row));
  }

  async saveProductionExecution(execution: ProductionExecution): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_production_executions (
          id, tenant_id, factory_org_unit_id, production_order_id, production_order_line_id,
          material_issue_document_id, material_issue_movement_id, material_issue_evidence, material_requirement_id,
          actual_quantity, accepted_quantity, rejected_quantity, scrap_quantity,
          uom, recorded_by, recorded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          material_issue_evidence = EXCLUDED.material_issue_evidence,
          actual_quantity = EXCLUDED.actual_quantity,
          accepted_quantity = EXCLUDED.accepted_quantity,
          rejected_quantity = EXCLUDED.rejected_quantity,
          scrap_quantity = EXCLUDED.scrap_quantity
      `,
      [
        execution.id,
        execution.tenantId,
        execution.factoryOrgUnitId,
        execution.productionOrderId,
        execution.productionOrderLineId,
        execution.materialIssueDocumentId,
        execution.materialIssueMovementId,
        JSON.stringify(execution.materialIssueEvidence ?? null),
        execution.materialRequirementId ?? null,
        execution.actualQuantity,
        execution.acceptedQuantity,
        execution.rejectedQuantity,
        execution.scrapQuantity,
        execution.uom,
        execution.recordedBy,
        execution.recordedAt,
      ]
    );
  }

  async getProductionExecutions(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
  }): Promise<ProductionExecution[]> {
    const result = await this.db.query<ProductionExecutionRow>(
      `
        SELECT *
        FROM public.manufacturing_production_executions
        WHERE tenant_id = $1 AND production_order_id = $2
        ORDER BY recorded_at, id
      `,
      [params.tenantId, params.productionOrderId]
    );
    return result.rows.map((row) => this.mapProductionExecution(row));
  }

  async findProductionExecutionsByMaterialLot(params: {
    tenantId: string;
    factoryOrgUnitId: string;
    itemId?: string;
    lotNumber?: string;
    serialNumber?: string;
  }): Promise<ProductionExecution[]> {
    const result = await this.db.query<ProductionExecutionRow>(
      `
        SELECT *
        FROM public.manufacturing_production_executions
        WHERE tenant_id = $1
          AND factory_org_unit_id = $2
          AND material_issue_evidence IS NOT NULL
          AND ($3::text IS NULL OR material_issue_evidence #>> '{itemId}' = $3)
          AND ($4::text IS NULL OR material_issue_evidence #>> '{lotNumber}' = $4)
          AND (
            $5::text IS NULL OR
            COALESCE(material_issue_evidence #> '{serialNumbers}', '[]'::jsonb) ? $5
          )
        ORDER BY recorded_at, id
      `,
      [
        params.tenantId,
        params.factoryOrgUnitId,
        params.itemId ?? null,
        params.lotNumber ?? null,
        params.serialNumber ?? null,
      ]
    );
    return result.rows.map((row) => this.mapProductionExecution(row));
  }

  async saveQualityDisposition(evidence: QualityDispositionEvidence): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_quality_dispositions (
          id, tenant_id, factory_org_unit_id, production_order_id, production_order_line_id,
          production_execution_id, receipt_document_id, receipt_line_id, source_quantity_type,
          disposition, quantity, accepted_output_quantity, reason_code, reason_text,
          evidence_reference, final_handling_decision, conditional_accept_policy_approved,
          terminal, decided_by, decided_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13, $14,
          $15, $16, $17,
          $18, $19, $20
        )
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          receipt_document_id = EXCLUDED.receipt_document_id,
          receipt_line_id = EXCLUDED.receipt_line_id,
          reason_code = EXCLUDED.reason_code,
          reason_text = EXCLUDED.reason_text,
          evidence_reference = EXCLUDED.evidence_reference,
          terminal = EXCLUDED.terminal
      `,
      [
        evidence.id,
        evidence.tenantId,
        evidence.factoryOrgUnitId,
        evidence.productionOrderId,
        evidence.productionOrderLineId,
        evidence.productionExecutionId,
        evidence.receiptDocumentId ?? null,
        evidence.receiptLineId ?? null,
        evidence.sourceQuantityType,
        evidence.disposition,
        evidence.quantity,
        evidence.acceptedOutputQuantity,
        evidence.reasonCode ?? null,
        evidence.reasonText ?? null,
        evidence.evidenceReference ?? null,
        evidence.finalHandlingDecision ?? null,
        evidence.conditionalAcceptPolicyApproved ?? null,
        evidence.terminal,
        evidence.decidedBy,
        evidence.decidedAt,
      ]
    );
  }

  async getQualityDispositions(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
  }): Promise<QualityDispositionEvidence[]> {
    const result = await this.db.query<QualityDispositionRow>(
      `
        SELECT *
        FROM public.manufacturing_quality_dispositions
        WHERE tenant_id = $1 AND production_order_id = $2
        ORDER BY decided_at, id
      `,
      [params.tenantId, params.productionOrderId]
    );
    return result.rows.map((row) => this.mapQualityDisposition(row));
  }

  async saveProductionCompletion(completion: ProductionCompletion): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_production_order_completions (
          id, tenant_id, factory_org_unit_id, production_order_id,
          completed_quantity, rejected_quantity, scrap_quantity, uom,
          receipt_evidence, quality_disposition_evidence, completed_by, completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12)
      `,
      [
        completion.id,
        completion.tenantId,
        completion.factoryOrgUnitId,
        completion.productionOrderId,
        completion.completedQuantity,
        completion.rejectedQuantity,
        completion.scrapQuantity,
        completion.uom,
        JSON.stringify(completion.receiptEvidence),
        JSON.stringify(completion.qualityDispositionEvidence),
        completion.completedBy,
        completion.completedAt,
      ]
    );
  }

  async getProductionCompletion(
    tenantId: TenantId,
    productionOrderId: ManufacturingId
  ): Promise<ProductionCompletion | null> {
    const result = await this.db.query<ProductionCompletionRow>(
      `
        SELECT *
        FROM public.manufacturing_production_order_completions
        WHERE tenant_id = $1 AND production_order_id = $2
      `,
      [tenantId, productionOrderId]
    );
    return result.rows[0] ? this.mapProductionCompletion(result.rows[0]) : null;
  }

  async findProductionCompletionsByFinishedGoodLot(params: {
    tenantId: string;
    factoryOrgUnitId: string;
    itemId?: string;
    lotNumber?: string;
    serialNumber?: string;
  }): Promise<ProductionCompletion[]> {
    const result = await this.db.query<ProductionCompletionRow>(
      `
        SELECT *
        FROM public.manufacturing_production_order_completions completion
        WHERE completion.tenant_id = $1
          AND completion.factory_org_unit_id = $2
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(completion.receipt_evidence) AS receipt(value)
            WHERE ($3::text IS NULL OR receipt.value #>> '{logisticsEvidence,itemId}' = $3)
              AND (
                $4::text IS NULL OR
                COALESCE(receipt.value #>> '{logisticsEvidence,lotNumber}', receipt.value #>> '{lotNumber}') = $4
              )
              AND (
                $5::text IS NULL OR
                COALESCE(receipt.value #> '{logisticsEvidence,serialNumbers}', receipt.value #> '{serialNumbers}', '[]'::jsonb) ? $5
              )
          )
        ORDER BY completed_at, id
      `,
      [
        params.tenantId,
        params.factoryOrgUnitId,
        params.itemId ?? null,
        params.lotNumber ?? null,
        params.serialNumber ?? null,
      ]
    );
    return result.rows.map((row) => this.mapProductionCompletion(row));
  }

  async getCommandLog<T = unknown>(params: {
    tenantId: TenantId;
    operation: string;
    businessKey: string;
  }): Promise<CommandLogEntry<T> | null> {
    const result = await this.db.query<CommandLogRow<T>>(
      `
        SELECT tenant_id, factory_org_unit_id, operation, business_key, payload_hash, result, created_at
        FROM public.manufacturing_command_idempotency
        WHERE tenant_id = $1 AND operation = $2 AND business_key = $3
      `,
      [params.tenantId, params.operation, params.businessKey]
    );
    const row = result.rows[0];
    return row
      ? {
          tenantId: row.tenant_id,
          factoryOrgUnitId: row.factory_org_unit_id,
          operation: row.operation,
          businessKey: row.business_key,
          payloadHash: row.payload_hash,
          result: row.result,
          createdAt: toTimestamp(row.created_at),
        }
      : null;
  }

  async saveCommandLog<T>(entry: CommandLogEntry<T>): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.manufacturing_command_idempotency (
          tenant_id, factory_org_unit_id, operation, business_key, payload_hash, result, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        entry.tenantId,
        entry.factoryOrgUnitId,
        entry.operation,
        entry.businessKey,
        entry.payloadHash,
        JSON.stringify(entry.result),
        entry.createdAt,
      ]
    );
  }

  private async getBOMComponents(tenantId: TenantId, bomRevisionId: ManufacturingId): Promise<BOMComponent[]> {
    const result = await this.db.query<BOMComponentRow>(
      `
        SELECT id, component_item_id, quantity_per_unit, uom, scrap_allowance_percent
        FROM public.manufacturing_bom_components
        WHERE tenant_id = $1 AND bom_revision_id = $2
        ORDER BY component_item_id
      `,
      [tenantId, bomRevisionId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      componentItemId: row.component_item_id,
      quantityPerUnit: toNumber(row.quantity_per_unit),
      uom: row.uom,
      scrapAllowancePercent:
        row.scrap_allowance_percent === null ? undefined : toNumber(row.scrap_allowance_percent),
    }));
  }

  private async getProductionOrderLines(
    tenantId: TenantId,
    productionOrderId: ManufacturingId
  ): Promise<ProductionOrderLine[]> {
    const result = await this.db.query<ProductionOrderLineRow>(
      `
        SELECT id, tenant_id, production_order_id, finished_good_item_id, target_quantity, uom
        FROM public.manufacturing_production_order_lines
        WHERE tenant_id = $1 AND production_order_id = $2
        ORDER BY finished_good_item_id, id
      `,
      [tenantId, productionOrderId]
    );
    return result.rows.map((row) => this.mapProductionOrderLine(row));
  }

  private async getRoutingOperations(
    tenantId: TenantId,
    routingRevisionId: ManufacturingId
  ): Promise<RoutingOperation[]> {
    const result = await this.db.query<RoutingOperationRow>(
      `
        SELECT id, tenant_id, routing_revision_id, operation_sequence AS sequence, operation_code,
               operation_name, work_center_id, required
        FROM public.manufacturing_routing_operations
        WHERE tenant_id = $1 AND routing_revision_id = $2
        ORDER BY operation_sequence, id
      `,
      [tenantId, routingRevisionId]
    );
    return result.rows.map((row) => this.mapRoutingOperation(row));
  }

  private mapProductionOrder(row: ProductionOrderRow, lines: ProductionOrderLine[]): ProductionOrder {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      factoryOrgUnitId: row.factory_org_unit_id,
      orderNumber: row.order_number,
      finishedGoodItemId: row.finished_good_item_id,
      targetQuantity: toNumber(row.target_quantity),
      uom: row.uom,
      status: row.status,
      lines,
      bomRevisionId: row.bom_revision_id ?? undefined,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      releasedBy: row.released_by ?? undefined,
      releasedAt: row.released_at ? toTimestamp(row.released_at) : undefined,
      completedBy: row.completed_by ?? undefined,
      completedAt: row.completed_at ? toTimestamp(row.completed_at) : undefined,
    };
  }

  private mapProductionOrderLine(row: ProductionOrderLineRow): ProductionOrderLine {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productionOrderId: row.production_order_id,
      finishedGoodItemId: row.finished_good_item_id,
      targetQuantity: toNumber(row.target_quantity),
      uom: row.uom,
    };
  }

  private mapProductionPlan(row: ProductionPlanRow): ProductionPlan {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      factoryOrgUnitId: row.factory_org_unit_id,
      planNumber: row.plan_number,
      sourceType: row.source_type,
      sourceReferenceId: row.source_reference_id ?? undefined,
      sourceReferenceNumber: row.source_reference_number ?? undefined,
      finishedGoodItemId: row.finished_good_item_id,
      plannedQuantity: toNumber(row.planned_quantity),
      uom: row.uom,
      requestedDueAt: row.requested_due_at ? toTimestamp(row.requested_due_at) : undefined,
      status: row.status,
      bomRevisionId: row.bom_revision_id ?? undefined,
      routingRevisionId: row.routing_revision_id ?? undefined,
      sourceLocationId: row.source_location_id ?? undefined,
      materialReadinessStatus: row.material_readiness_status,
      materialReadinessCheckedAt: row.material_readiness_checked_at
        ? toTimestamp(row.material_readiness_checked_at)
        : undefined,
      materialRequirements: readPlanMaterialRequirements(row.material_requirements),
      linkedProductionOrderId: row.linked_production_order_id ?? undefined,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      updatedBy: row.updated_by ?? undefined,
      updatedAt: row.updated_at ? toTimestamp(row.updated_at) : undefined,
      submittedBy: row.submitted_by ?? undefined,
      submittedAt: row.submitted_at ? toTimestamp(row.submitted_at) : undefined,
      approvedBy: row.approved_by ?? undefined,
      approvedAt: row.approved_at ? toTimestamp(row.approved_at) : undefined,
      rejectedBy: row.rejected_by ?? undefined,
      rejectedAt: row.rejected_at ? toTimestamp(row.rejected_at) : undefined,
      rejectionReason: row.rejection_reason ?? undefined,
      cancelledBy: row.cancelled_by ?? undefined,
      cancelledAt: row.cancelled_at ? toTimestamp(row.cancelled_at) : undefined,
    };
  }

  private mapProductionPlanScheduleSlot(row: ProductionPlanScheduleSlotRow): ProductionPlanScheduleSlot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      factoryOrgUnitId: row.factory_org_unit_id,
      productionPlanId: row.production_plan_id,
      routingRevisionId: row.routing_revision_id,
      routingOperationId: row.routing_operation_id,
      operationSequence: toNumber(row.operation_sequence),
      workCenterId: row.work_center_id,
      plannedDate: toDateOnly(row.planned_date),
      shiftCode: row.shift_code,
      plannedQuantity: toNumber(row.planned_quantity),
      status: row.status,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      updatedBy: row.updated_by ?? undefined,
      updatedAt: row.updated_at ? toTimestamp(row.updated_at) : undefined,
    };
  }

  private mapWorkCenter(row: WorkCenterRow): WorkCenter {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      factoryOrgUnitId: row.factory_org_unit_id,
      code: row.code,
      name: row.name,
      status: row.status,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
    };
  }

  private mapRoutingRevision(row: RoutingRevisionRow, operations: RoutingOperation[]): RoutingRevision {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      factoryOrgUnitId: row.factory_org_unit_id,
      finishedGoodItemId: row.finished_good_item_id,
      revisionCode: row.revision_code,
      status: row.status,
      operations,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      approvedBy: row.approved_by ?? undefined,
      approvedAt: row.approved_at ? toTimestamp(row.approved_at) : undefined,
    };
  }

  private mapRoutingOperation(row: RoutingOperationRow): RoutingOperation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      routingRevisionId: row.routing_revision_id,
      sequence: toNumber(row.sequence),
      operationCode: row.operation_code,
      operationName: row.operation_name,
      workCenterId: row.work_center_id,
      required: row.required,
    };
  }

  private mapOperationProgress(row: OperationProgressRow): ProductionOperationProgress {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      factoryOrgUnitId: row.factory_org_unit_id,
      productionOrderId: row.production_order_id,
      productionOrderLineId: row.production_order_line_id,
      routingRevisionId: row.routing_revision_id,
      routingOperationId: row.routing_operation_id,
      workCenterId: row.work_center_id,
      required: row.required,
      status: row.status,
      blockedReason: row.blocked_reason ?? undefined,
      productionExecutionId: row.production_execution_id ?? undefined,
      completedQuantity: row.completed_quantity === null ? undefined : toNumber(row.completed_quantity),
      quantityUom: row.quantity_uom ?? undefined,
      startedAt: row.started_at ? toTimestamp(row.started_at) : undefined,
      completedAt: row.completed_at ? toTimestamp(row.completed_at) : undefined,
      updatedBy: row.updated_by,
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapBOMRevision(row: BOMRevisionRow, components: BOMComponent[]): BOMRevision {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      finishedGoodItemId: row.finished_good_item_id,
      revisionCode: row.revision_code,
      status: row.status,
      components,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      approvedBy: row.approved_by ?? undefined,
      approvedAt: row.approved_at ? toTimestamp(row.approved_at) : undefined,
    };
  }

  private mapMaterialRequirement(row: MaterialRequirementRow): MaterialRequirement {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productionOrderId: row.production_order_id,
      bomRevisionId: row.bom_revision_id,
      componentItemId: row.component_item_id,
      sourceLocationId: row.source_location_id,
      requiredQuantity: toNumber(row.required_quantity),
      availableQuantity: row.available_quantity === null ? undefined : toNumber(row.available_quantity),
      status: row.status,
      checkedAt: row.checked_at ? toTimestamp(row.checked_at) : undefined,
    };
  }

  private mapProductionExecution(row: ProductionExecutionRow): ProductionExecution {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      factoryOrgUnitId: row.factory_org_unit_id,
      productionOrderId: row.production_order_id,
      productionOrderLineId: row.production_order_line_id,
      materialIssueDocumentId: row.material_issue_document_id,
      materialIssueMovementId: row.material_issue_movement_id,
      materialIssueEvidence: row.material_issue_evidence ? { ...row.material_issue_evidence } : undefined,
      materialRequirementId: row.material_requirement_id ?? undefined,
      actualQuantity: toNumber(row.actual_quantity),
      acceptedQuantity: toNumber(row.accepted_quantity),
      rejectedQuantity: toNumber(row.rejected_quantity),
      scrapQuantity: toNumber(row.scrap_quantity),
      uom: row.uom,
      recordedBy: row.recorded_by,
      recordedAt: toTimestamp(row.recorded_at),
    };
  }

  private mapQualityDisposition(row: QualityDispositionRow): QualityDispositionEvidence {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      factoryOrgUnitId: row.factory_org_unit_id,
      productionOrderId: row.production_order_id,
      productionOrderLineId: row.production_order_line_id,
      productionExecutionId: row.production_execution_id,
      receiptDocumentId: row.receipt_document_id ?? undefined,
      receiptLineId: row.receipt_line_id ?? undefined,
      sourceQuantityType: row.source_quantity_type,
      disposition: row.disposition,
      quantity: toNumber(row.quantity),
      acceptedOutputQuantity: toNumber(row.accepted_output_quantity),
      reasonCode: row.reason_code ?? undefined,
      reasonText: row.reason_text ?? undefined,
      evidenceReference: row.evidence_reference ?? undefined,
      finalHandlingDecision: row.final_handling_decision ?? undefined,
      conditionalAcceptPolicyApproved: row.conditional_accept_policy_approved ?? undefined,
      terminal: row.terminal,
      decidedBy: row.decided_by,
      decidedAt: toTimestamp(row.decided_at),
    };
  }

  private mapProductionCompletion(row: ProductionCompletionRow): ProductionCompletion {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      factoryOrgUnitId: row.factory_org_unit_id,
      productionOrderId: row.production_order_id,
      completedQuantity: toNumber(row.completed_quantity),
      rejectedQuantity: toNumber(row.rejected_quantity),
      scrapQuantity: toNumber(row.scrap_quantity),
      uom: row.uom,
      receiptEvidence: row.receipt_evidence.map((receipt) => ({ ...receipt })),
      qualityDispositionEvidence: row.quality_disposition_evidence.map((evidence) => ({ ...evidence })),
      completedBy: row.completed_by,
      completedAt: toTimestamp(row.completed_at),
    };
  }
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function toTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toDateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function readPlanMaterialRequirements(value: unknown): ProductionPlanMaterialRequirement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ProductionPlanMaterialRequirement[] => {
    const record = readRecord(entry);
    const bomRevisionId = readString(record.bomRevisionId);
    const componentItemId = readString(record.componentItemId);
    const sourceLocationId = readString(record.sourceLocationId);
    const requiredQuantity = readFiniteNumber(record.requiredQuantity);
    const status = readMaterialRequirementStatus(record.status);
    if (!bomRevisionId || !componentItemId || !sourceLocationId || requiredQuantity === undefined || !status) {
      return [];
    }
    const availableQuantity = readFiniteNumber(record.availableQuantity);
    const checkedAt = readString(record.checkedAt);
    return [{
      bomRevisionId,
      componentItemId,
      sourceLocationId,
      requiredQuantity,
      availableQuantity,
      status,
      checkedAt,
    }];
  });
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readMaterialRequirementStatus(value: unknown): ProductionPlanMaterialRequirement['status'] | undefined {
  return value === 'not_checked' ||
    value === 'available' ||
    value === 'shortage' ||
    value === 'not_proven'
    ? value
    : undefined;
}
