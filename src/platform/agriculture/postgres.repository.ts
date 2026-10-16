import type {
  AgricultureDomainEvent,
  AgricultureId,
  CommandLogEntry,
  CropActivityEvidence,
  CropCycle,
  CropCycleEvent,
  Farm,
  HarvestEvidence,
  MaterialUsageEvidence,
  Plot,
  TenantId,
} from './domain/types';
import type { AgricultureRepository } from './ports';

type AgricultureQueryResultRow = Record<string, unknown>;

export interface AgricultureSqlClient {
  query<Row extends AgricultureQueryResultRow = AgricultureQueryResultRow>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

type FarmRow = AgricultureQueryResultRow & {
  id: string;
  tenant_id: string;
  org_unit_id: string;
  farm_code: string;
  name: string;
  status: Farm['status'];
  created_by: string;
  created_at: string | Date;
  updated_by: string;
  updated_at: string | Date;
};

type PlotRow = AgricultureQueryResultRow & {
  id: string;
  tenant_id: string;
  farm_id: string;
  org_unit_id: string;
  plot_code: string;
  name: string;
  status: Plot['status'];
  created_by: string;
  created_at: string | Date;
  updated_by: string;
  updated_at: string | Date;
};

type CropCycleRow = AgricultureQueryResultRow & {
  id: string;
  tenant_id: string;
  farm_id: string;
  plot_id: string;
  org_unit_id: string;
  cycle_code: string;
  crop_name: string;
  status: CropCycle['status'];
  planned_start_date: string | Date | null;
  planned_end_date: string | Date | null;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  completion_disposition: CropCycle['completionDisposition'] | null;
  completion_reason: string | null;
  cancelled_at: string | Date | null;
  cancellation_reason: string | null;
  created_by: string;
  created_at: string | Date;
  updated_by: string;
  updated_at: string | Date;
};

type CropCycleEventRow = AgricultureQueryResultRow & {
  id: string;
  tenant_id: string;
  crop_cycle_id: string;
  from_status: CropCycle['status'] | null;
  to_status: CropCycle['status'];
  reason: string | null;
  disposition: CropCycle['completionDisposition'] | null;
  recorded_by: string;
  recorded_at: string | Date;
};

type CropActivityRow = AgricultureQueryResultRow & {
  id: string;
  tenant_id: string;
  farm_id: string;
  plot_id: string;
  crop_cycle_id: string;
  org_unit_id: string;
  activity_type: string;
  occurred_at: string | Date;
  evidence: unknown;
  recorded_by: string;
  recorded_at: string | Date;
};

type MaterialUsageRow = AgricultureQueryResultRow & {
  id: string;
  tenant_id: string;
  farm_id: string;
  plot_id: string;
  crop_cycle_id: string;
  org_unit_id: string;
  material_id: string;
  material_name: string | null;
  quantity: string | number;
  uom: string;
  occurred_at: string | Date;
  evidence: unknown;
  recorded_by: string;
  recorded_at: string | Date;
};

type HarvestRow = AgricultureQueryResultRow & {
  id: string;
  tenant_id: string;
  farm_id: string;
  plot_id: string;
  crop_cycle_id: string;
  org_unit_id: string;
  harvest_batch_code: string | null;
  crop_name: string | null;
  quantity: string | number;
  uom: string;
  quality_grade: string | null;
  harvested_at: string | Date;
  evidence: unknown;
  recorded_by: string;
  recorded_at: string | Date;
};

type DomainEventRow = AgricultureQueryResultRow & {
  id: string;
  tenant_id: string;
  org_unit_id: string;
  entity_type: AgricultureDomainEvent['entityType'];
  entity_id: string;
  event_type: string;
  payload: unknown;
  recorded_by: string;
  recorded_at: string | Date;
};

type CommandLogRow<T> = AgricultureQueryResultRow & {
  tenant_id: string;
  org_unit_id: string;
  operation: string;
  business_key: string;
  payload_hash: string;
  result: T;
  created_at: string | Date;
};

export class PostgresAgricultureRepository implements AgricultureRepository {
  constructor(
    private readonly db: AgricultureSqlClient,
    private readonly inTransaction = false
  ) {}

  async withTransaction<T>(callback: (repository: AgricultureRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return callback(this);
    await this.db.query('BEGIN');
    try {
      const result = await callback(new PostgresAgricultureRepository(this.db, true));
      await this.db.query('COMMIT');
      return result;
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async saveFarm(farm: Farm): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.agriculture_farms (
          id, tenant_id, org_unit_id, farm_code, name, status,
          created_by, created_at, updated_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
      `,
      [
        farm.id,
        farm.tenantId,
        farm.orgUnitId,
        farm.farmCode,
        farm.name,
        farm.status,
        farm.createdBy,
        farm.createdAt,
        farm.updatedBy,
        farm.updatedAt,
      ]
    );
  }

  async getFarm(tenantId: TenantId, id: AgricultureId): Promise<Farm | null> {
    const result = await this.db.query<FarmRow>(
      `
        SELECT id, tenant_id, org_unit_id, farm_code, name, status,
          created_by, created_at, updated_by, updated_at
        FROM public.agriculture_farms
        WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, id]
    );
    return result.rows[0] ? this.mapFarm(result.rows[0]) : null;
  }

  async findFarmByCode(params: { tenantId: TenantId; farmCode: string }): Promise<Farm | null> {
    const result = await this.db.query<FarmRow>(
      `
        SELECT id, tenant_id, org_unit_id, farm_code, name, status,
          created_by, created_at, updated_by, updated_at
        FROM public.agriculture_farms
        WHERE tenant_id = $1 AND farm_code = $2
      `,
      [params.tenantId, params.farmCode]
    );
    return result.rows[0] ? this.mapFarm(result.rows[0]) : null;
  }

  async savePlot(plot: Plot): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.agriculture_plots (
          id, tenant_id, farm_id, org_unit_id, plot_code, name, status,
          created_by, created_at, updated_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
      `,
      [
        plot.id,
        plot.tenantId,
        plot.farmId,
        plot.orgUnitId,
        plot.plotCode,
        plot.name,
        plot.status,
        plot.createdBy,
        plot.createdAt,
        plot.updatedBy,
        plot.updatedAt,
      ]
    );
  }

  async getPlot(tenantId: TenantId, id: AgricultureId): Promise<Plot | null> {
    const result = await this.db.query<PlotRow>(
      `
        SELECT id, tenant_id, farm_id, org_unit_id, plot_code, name, status,
          created_by, created_at, updated_by, updated_at
        FROM public.agriculture_plots
        WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, id]
    );
    return result.rows[0] ? this.mapPlot(result.rows[0]) : null;
  }

  async findPlotByCode(params: {
    tenantId: TenantId;
    farmId: AgricultureId;
    plotCode: string;
  }): Promise<Plot | null> {
    const result = await this.db.query<PlotRow>(
      `
        SELECT id, tenant_id, farm_id, org_unit_id, plot_code, name, status,
          created_by, created_at, updated_by, updated_at
        FROM public.agriculture_plots
        WHERE tenant_id = $1 AND farm_id = $2 AND plot_code = $3
      `,
      [params.tenantId, params.farmId, params.plotCode]
    );
    return result.rows[0] ? this.mapPlot(result.rows[0]) : null;
  }

  async saveCropCycle(cropCycle: CropCycle): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.agriculture_crop_cycles (
          id, tenant_id, farm_id, plot_id, org_unit_id, cycle_code, crop_name, status,
          planned_start_date, planned_end_date, started_at, completed_at,
          completion_disposition, completion_reason, cancelled_at, cancellation_reason,
          created_by, created_at, updated_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          status = EXCLUDED.status,
          started_at = EXCLUDED.started_at,
          completed_at = EXCLUDED.completed_at,
          completion_disposition = EXCLUDED.completion_disposition,
          completion_reason = EXCLUDED.completion_reason,
          cancelled_at = EXCLUDED.cancelled_at,
          cancellation_reason = EXCLUDED.cancellation_reason,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
      `,
      [
        cropCycle.id,
        cropCycle.tenantId,
        cropCycle.farmId,
        cropCycle.plotId,
        cropCycle.orgUnitId,
        cropCycle.cycleCode,
        cropCycle.cropName,
        cropCycle.status,
        cropCycle.plannedStartDate ?? null,
        cropCycle.plannedEndDate ?? null,
        cropCycle.startedAt ?? null,
        cropCycle.completedAt ?? null,
        cropCycle.completionDisposition ?? null,
        cropCycle.completionReason ?? null,
        cropCycle.cancelledAt ?? null,
        cropCycle.cancellationReason ?? null,
        cropCycle.createdBy,
        cropCycle.createdAt,
        cropCycle.updatedBy,
        cropCycle.updatedAt,
      ]
    );
  }

  async getCropCycle(tenantId: TenantId, id: AgricultureId): Promise<CropCycle | null> {
    const result = await this.db.query<CropCycleRow>(
      `
        SELECT id, tenant_id, farm_id, plot_id, org_unit_id, cycle_code, crop_name, status,
          planned_start_date, planned_end_date, started_at, completed_at,
          completion_disposition, completion_reason, cancelled_at, cancellation_reason,
          created_by, created_at, updated_by, updated_at
        FROM public.agriculture_crop_cycles
        WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, id]
    );
    return result.rows[0] ? this.mapCropCycle(result.rows[0]) : null;
  }

  async findCropCycleByCode(params: {
    tenantId: TenantId;
    plotId: AgricultureId;
    cycleCode: string;
  }): Promise<CropCycle | null> {
    const result = await this.db.query<CropCycleRow>(
      `
        SELECT id, tenant_id, farm_id, plot_id, org_unit_id, cycle_code, crop_name, status,
          planned_start_date, planned_end_date, started_at, completed_at,
          completion_disposition, completion_reason, cancelled_at, cancellation_reason,
          created_by, created_at, updated_by, updated_at
        FROM public.agriculture_crop_cycles
        WHERE tenant_id = $1 AND plot_id = $2 AND cycle_code = $3
      `,
      [params.tenantId, params.plotId, params.cycleCode]
    );
    return result.rows[0] ? this.mapCropCycle(result.rows[0]) : null;
  }

  async saveCropCycleEvent(event: CropCycleEvent): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.agriculture_crop_cycle_events (
          id, tenant_id, crop_cycle_id, from_status, to_status, reason, disposition,
          recorded_by, recorded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        event.id,
        event.tenantId,
        event.cropCycleId,
        event.fromStatus ?? null,
        event.toStatus,
        event.reason ?? null,
        event.disposition ?? null,
        event.recordedBy,
        event.recordedAt,
      ]
    );
  }

  async listCropCycleEvents(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<CropCycleEvent[]> {
    const result = await this.db.query<CropCycleEventRow>(
      `
        SELECT id, tenant_id, crop_cycle_id, from_status, to_status, reason, disposition,
          recorded_by, recorded_at
        FROM public.agriculture_crop_cycle_events
        WHERE tenant_id = $1 AND crop_cycle_id = $2
        ORDER BY recorded_at, id
      `,
      [params.tenantId, params.cropCycleId]
    );
    return result.rows.map((row) => this.mapCropCycleEvent(row));
  }

  async saveCropActivity(activity: CropActivityEvidence): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.agriculture_crop_activities (
          id, tenant_id, farm_id, plot_id, crop_cycle_id, org_unit_id,
          activity_type, occurred_at, evidence, recorded_by, recorded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        activity.id,
        activity.tenantId,
        activity.farmId,
        activity.plotId,
        activity.cropCycleId,
        activity.orgUnitId,
        activity.activityType,
        activity.occurredAt,
        JSON.stringify(activity.evidence),
        activity.recordedBy,
        activity.recordedAt,
      ]
    );
  }

  async listCropActivities(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<CropActivityEvidence[]> {
    const result = await this.db.query<CropActivityRow>(
      `
        SELECT id, tenant_id, farm_id, plot_id, crop_cycle_id, org_unit_id,
          activity_type, occurred_at, evidence, recorded_by, recorded_at
        FROM public.agriculture_crop_activities
        WHERE tenant_id = $1 AND crop_cycle_id = $2
        ORDER BY occurred_at, id
      `,
      [params.tenantId, params.cropCycleId]
    );
    return result.rows.map((row) => this.mapCropActivity(row));
  }

  async saveMaterialUsage(usage: MaterialUsageEvidence): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.agriculture_material_usage_evidence (
          id, tenant_id, farm_id, plot_id, crop_cycle_id, org_unit_id,
          material_id, material_name, quantity, uom, occurred_at, evidence,
          recorded_by, recorded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
      [
        usage.id,
        usage.tenantId,
        usage.farmId,
        usage.plotId,
        usage.cropCycleId,
        usage.orgUnitId,
        usage.materialId,
        usage.materialName ?? null,
        usage.quantity,
        usage.uom,
        usage.occurredAt,
        JSON.stringify(usage.evidence),
        usage.recordedBy,
        usage.recordedAt,
      ]
    );
  }

  async listMaterialUsages(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<MaterialUsageEvidence[]> {
    const result = await this.db.query<MaterialUsageRow>(
      `
        SELECT id, tenant_id, farm_id, plot_id, crop_cycle_id, org_unit_id,
          material_id, material_name, quantity, uom, occurred_at, evidence,
          recorded_by, recorded_at
        FROM public.agriculture_material_usage_evidence
        WHERE tenant_id = $1 AND crop_cycle_id = $2
        ORDER BY occurred_at, id
      `,
      [params.tenantId, params.cropCycleId]
    );
    return result.rows.map((row) => this.mapMaterialUsage(row));
  }

  async saveHarvest(harvest: HarvestEvidence): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.agriculture_harvest_evidence (
          id, tenant_id, farm_id, plot_id, crop_cycle_id, org_unit_id,
          harvest_batch_code, crop_name, quantity, uom, quality_grade,
          harvested_at, evidence, recorded_by, recorded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `,
      [
        harvest.id,
        harvest.tenantId,
        harvest.farmId,
        harvest.plotId,
        harvest.cropCycleId,
        harvest.orgUnitId,
        harvest.harvestBatchCode ?? null,
        harvest.cropName ?? null,
        harvest.quantity,
        harvest.uom,
        harvest.qualityGrade ?? null,
        harvest.harvestedAt,
        JSON.stringify(harvest.evidence),
        harvest.recordedBy,
        harvest.recordedAt,
      ]
    );
  }

  async listHarvests(params: {
    tenantId: TenantId;
    cropCycleId: AgricultureId;
  }): Promise<HarvestEvidence[]> {
    const result = await this.db.query<HarvestRow>(
      `
        SELECT id, tenant_id, farm_id, plot_id, crop_cycle_id, org_unit_id,
          harvest_batch_code, crop_name, quantity, uom, quality_grade,
          harvested_at, evidence, recorded_by, recorded_at
        FROM public.agriculture_harvest_evidence
        WHERE tenant_id = $1 AND crop_cycle_id = $2
        ORDER BY harvested_at, id
      `,
      [params.tenantId, params.cropCycleId]
    );
    return result.rows.map((row) => this.mapHarvest(row));
  }

  async saveDomainEvent(event: AgricultureDomainEvent): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.agriculture_domain_events (
          id, tenant_id, org_unit_id, entity_type, entity_id, event_type,
          payload, recorded_by, recorded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        event.id,
        event.tenantId,
        event.orgUnitId,
        event.entityType,
        event.entityId,
        event.eventType,
        JSON.stringify(event.payload),
        event.recordedBy,
        event.recordedAt,
      ]
    );
  }

  async listDomainEvents(params: {
    tenantId: TenantId;
    entityId: AgricultureId;
  }): Promise<AgricultureDomainEvent[]> {
    const result = await this.db.query<DomainEventRow>(
      `
        SELECT id, tenant_id, org_unit_id, entity_type, entity_id, event_type,
          payload, recorded_by, recorded_at
        FROM public.agriculture_domain_events
        WHERE tenant_id = $1 AND entity_id = $2
        ORDER BY recorded_at, id
      `,
      [params.tenantId, params.entityId]
    );
    return result.rows.map((row) => this.mapDomainEvent(row));
  }

  async getCommandLog<T = unknown>(params: {
    tenantId: TenantId;
    operation: string;
    businessKey: string;
  }): Promise<CommandLogEntry<T> | null> {
    const result = await this.db.query<CommandLogRow<T>>(
      `
        SELECT tenant_id, org_unit_id, operation, business_key, payload_hash, result, created_at
        FROM public.agriculture_command_idempotency
        WHERE tenant_id = $1 AND operation = $2 AND business_key = $3
      `,
      [params.tenantId, params.operation, params.businessKey]
    );
    const row = result.rows[0];
    return row
      ? {
          tenantId: row.tenant_id,
          orgUnitId: row.org_unit_id,
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
        INSERT INTO public.agriculture_command_idempotency (
          tenant_id, org_unit_id, operation, business_key, payload_hash, result, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        entry.tenantId,
        entry.orgUnitId,
        entry.operation,
        entry.businessKey,
        entry.payloadHash,
        JSON.stringify(entry.result),
        entry.createdAt,
      ]
    );
  }

  private mapFarm(row: FarmRow): Farm {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      orgUnitId: row.org_unit_id,
      farmCode: row.farm_code,
      name: row.name,
      status: row.status,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      updatedBy: row.updated_by,
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapPlot(row: PlotRow): Plot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      farmId: row.farm_id,
      orgUnitId: row.org_unit_id,
      plotCode: row.plot_code,
      name: row.name,
      status: row.status,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      updatedBy: row.updated_by,
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapCropCycle(row: CropCycleRow): CropCycle {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      farmId: row.farm_id,
      plotId: row.plot_id,
      orgUnitId: row.org_unit_id,
      cycleCode: row.cycle_code,
      cropName: row.crop_name,
      status: row.status,
      plannedStartDate: row.planned_start_date ? toDateOnly(row.planned_start_date) : undefined,
      plannedEndDate: row.planned_end_date ? toDateOnly(row.planned_end_date) : undefined,
      startedAt: row.started_at ? toTimestamp(row.started_at) : undefined,
      completedAt: row.completed_at ? toTimestamp(row.completed_at) : undefined,
      completionDisposition: row.completion_disposition ?? undefined,
      completionReason: row.completion_reason ?? undefined,
      cancelledAt: row.cancelled_at ? toTimestamp(row.cancelled_at) : undefined,
      cancellationReason: row.cancellation_reason ?? undefined,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      updatedBy: row.updated_by,
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapCropCycleEvent(row: CropCycleEventRow): CropCycleEvent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      cropCycleId: row.crop_cycle_id,
      fromStatus: row.from_status ?? undefined,
      toStatus: row.to_status,
      reason: row.reason ?? undefined,
      disposition: row.disposition ?? undefined,
      recordedBy: row.recorded_by,
      recordedAt: toTimestamp(row.recorded_at),
    };
  }

  private mapCropActivity(row: CropActivityRow): CropActivityEvidence {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      farmId: row.farm_id,
      plotId: row.plot_id,
      cropCycleId: row.crop_cycle_id,
      orgUnitId: row.org_unit_id,
      activityType: row.activity_type,
      occurredAt: toTimestamp(row.occurred_at),
      evidence: readRecord(row.evidence),
      recordedBy: row.recorded_by,
      recordedAt: toTimestamp(row.recorded_at),
    };
  }

  private mapMaterialUsage(row: MaterialUsageRow): MaterialUsageEvidence {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      farmId: row.farm_id,
      plotId: row.plot_id,
      cropCycleId: row.crop_cycle_id,
      orgUnitId: row.org_unit_id,
      materialId: row.material_id,
      materialName: row.material_name ?? undefined,
      quantity: toNumber(row.quantity),
      uom: row.uom,
      occurredAt: toTimestamp(row.occurred_at),
      evidence: readRecord(row.evidence),
      recordedBy: row.recorded_by,
      recordedAt: toTimestamp(row.recorded_at),
    };
  }

  private mapHarvest(row: HarvestRow): HarvestEvidence {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      farmId: row.farm_id,
      plotId: row.plot_id,
      cropCycleId: row.crop_cycle_id,
      orgUnitId: row.org_unit_id,
      harvestBatchCode: row.harvest_batch_code ?? undefined,
      cropName: row.crop_name ?? undefined,
      quantity: toNumber(row.quantity),
      uom: row.uom,
      qualityGrade: row.quality_grade ?? undefined,
      harvestedAt: toTimestamp(row.harvested_at),
      evidence: readRecord(row.evidence),
      recordedBy: row.recorded_by,
      recordedAt: toTimestamp(row.recorded_at),
    };
  }

  private mapDomainEvent(row: DomainEventRow): AgricultureDomainEvent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      orgUnitId: row.org_unit_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      eventType: row.event_type,
      payload: readRecord(row.payload),
      recordedBy: row.recorded_by,
      recordedAt: toTimestamp(row.recorded_at),
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

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
