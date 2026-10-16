import type {
  AvailableMobilityVehicle,
  MobilityCommandLogEntry,
  MobilityDomainEvent,
  MobilityId,
  MobilityServiceHistoryEntry,
  MobilityVehicle,
  MobilityVehicleOwnership,
  MobilityVehicleStatus,
  MobilityVehicleStatusLog,
  TenantId,
} from './domain/types';
import type { MobilityRepository } from './ports';

type MobilityQueryResultRow = Record<string, unknown>;

export interface MobilitySqlClient {
  query<Row extends MobilityQueryResultRow = MobilityQueryResultRow>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

type VehicleRow = MobilityQueryResultRow & {
  id: string;
  tenant_id: string;
  variant_id: string;
  vin: string;
  chassis_number: string | null;
  engine_number: string | null;
  color_exterior: string;
  color_interior: string | null;
  model_year: number;
  list_price: string | number;
  cost_price: string | number;
  status: MobilityVehicleStatus;
  location_note: string | null;
  expected_arrival_date: string | Date | null;
  actual_arrival_date: string | Date | null;
  import_declaration_number: string | null;
  allocated_to_contract_id: string | null;
  allocated_at: string | Date | null;
  allocated_by_user_id: string | null;
  delivered_at: string | Date | null;
  delivered_to_customer_id: string | null;
  delivery_notes: string | null;
  metadata: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

type StatusLogRow = MobilityQueryResultRow & {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  from_status: MobilityVehicleStatus | null;
  to_status: MobilityVehicleStatus;
  changed_by_user_id: string | null;
  reason: string | null;
  metadata: unknown;
  created_at: string | Date;
};

type OwnershipRow = MobilityQueryResultRow & {
  id: string;
  tenant_id: string;
  customer_id: string;
  vehicle_id: string;
  ownership_type: MobilityVehicleOwnership['ownershipType'];
  license_plate: string | null;
  registration_date: string | Date | null;
  is_active: boolean;
  transferred_at: string | Date | null;
  transfer_notes: string | null;
  metadata: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

type ServiceHistoryRow = MobilityQueryResultRow & {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  vin: string;
  repair_order_id: string | null;
  appointment_id: string | null;
  service_date: string | Date;
  service_type: string;
  service_description: string;
  mileage: number;
  services_performed: unknown;
  parts_replaced: unknown;
  labor_hours: string | number | null;
  total_cost: string | number | null;
  next_service_due_date: string | Date | null;
  next_service_due_mileage: number | null;
  recorded_by: string;
  recorded_at: string | Date;
};

type DomainEventRow = MobilityQueryResultRow & {
  id: string;
  tenant_id: string;
  org_unit_id: string | null;
  entity_type: MobilityDomainEvent['entityType'];
  entity_id: string;
  event_type: string;
  payload: unknown;
  recorded_by: string;
  recorded_at: string | Date;
};

type CommandLogRow<T> = MobilityQueryResultRow & {
  tenant_id: string;
  org_unit_id: string | null;
  operation: string;
  business_key: string;
  payload_hash: string;
  result: T;
  created_at: string | Date;
};

export class PostgresMobilityRepository implements MobilityRepository {
  constructor(
    private readonly db: MobilitySqlClient,
    private readonly inTransaction = false
  ) {}

  async withTransaction<T>(callback: (repository: MobilityRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return callback(this);
    await this.db.query('BEGIN');
    try {
      const result = await callback(new PostgresMobilityRepository(this.db, true));
      await this.db.query('COMMIT');
      return result;
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async saveVehicle(vehicle: MobilityVehicle): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.auto_vehicles (
          id, tenant_id, variant_id, vin, chassis_number, engine_number,
          color_exterior, color_interior, model_year, list_price, cost_price,
          status, location_note, expected_arrival_date, actual_arrival_date,
          import_declaration_number, allocated_to_contract_id, allocated_at,
          allocated_by_user_id, delivered_at, delivered_to_customer_id,
          delivery_notes, metadata, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25
        )
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          location_note = EXCLUDED.location_note,
          allocated_to_contract_id = EXCLUDED.allocated_to_contract_id,
          allocated_at = EXCLUDED.allocated_at,
          allocated_by_user_id = EXCLUDED.allocated_by_user_id,
          delivered_at = EXCLUDED.delivered_at,
          delivered_to_customer_id = EXCLUDED.delivered_to_customer_id,
          delivery_notes = EXCLUDED.delivery_notes,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
      `,
      [
        vehicle.id,
        vehicle.tenantId,
        vehicle.variantId,
        vehicle.vin,
        vehicle.chassisNumber ?? null,
        vehicle.engineNumber ?? null,
        vehicle.colorExterior,
        vehicle.colorInterior ?? null,
        vehicle.modelYear,
        vehicle.listPrice,
        vehicle.costPrice,
        vehicle.status,
        vehicle.locationNote ?? null,
        vehicle.expectedArrivalDate ?? null,
        vehicle.actualArrivalDate ?? null,
        vehicle.importDeclarationNumber ?? null,
        vehicle.allocatedToContractId ?? null,
        vehicle.allocatedAt ?? null,
        vehicle.allocatedByUserId ?? null,
        vehicle.deliveredAt ?? null,
        vehicle.deliveredToCustomerId ?? null,
        vehicle.deliveryNotes ?? null,
        JSON.stringify(vehicle.metadata),
        vehicle.createdAt,
        vehicle.updatedAt,
      ]
    );
  }

  async getVehicle(tenantId: TenantId, id: MobilityId): Promise<MobilityVehicle | null> {
    const result = await this.db.query<VehicleRow>(
      `
        SELECT id, tenant_id, variant_id, vin, chassis_number, engine_number,
          color_exterior, color_interior, model_year, list_price, cost_price,
          status, location_note, expected_arrival_date, actual_arrival_date,
          import_declaration_number, allocated_to_contract_id, allocated_at,
          allocated_by_user_id, delivered_at, delivered_to_customer_id,
          delivery_notes, metadata, created_at, updated_at
        FROM public.auto_vehicles
        WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, id]
    );
    return result.rows[0] ? this.mapVehicle(result.rows[0]) : null;
  }

  async findVehicleByVin(params: { tenantId: TenantId; vin: string }): Promise<MobilityVehicle | null> {
    const result = await this.db.query<VehicleRow>(
      `
        SELECT id, tenant_id, variant_id, vin, chassis_number, engine_number,
          color_exterior, color_interior, model_year, list_price, cost_price,
          status, location_note, expected_arrival_date, actual_arrival_date,
          import_declaration_number, allocated_to_contract_id, allocated_at,
          allocated_by_user_id, delivered_at, delivered_to_customer_id,
          delivery_notes, metadata, created_at, updated_at
        FROM public.auto_vehicles
        WHERE tenant_id = $1 AND vin = $2
      `,
      [params.tenantId, params.vin]
    );
    return result.rows[0] ? this.mapVehicle(result.rows[0]) : null;
  }

  async saveVehicleStatusLog(log: MobilityVehicleStatusLog): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.auto_vehicle_status_logs (
          id, tenant_id, vehicle_id, from_status, to_status,
          changed_by_user_id, reason, metadata, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        log.id,
        log.tenantId,
        log.vehicleId,
        log.fromStatus ?? null,
        log.toStatus,
        log.changedByUserId ?? null,
        log.reason ?? null,
        JSON.stringify(log.metadata),
        log.createdAt,
      ]
    );
  }

  async listVehicleStatusLogs(params: {
    tenantId: TenantId;
    vehicleId: MobilityId;
  }): Promise<MobilityVehicleStatusLog[]> {
    const result = await this.db.query<StatusLogRow>(
      `
        SELECT id, tenant_id, vehicle_id, from_status, to_status,
          changed_by_user_id, reason, metadata, created_at
        FROM public.auto_vehicle_status_logs
        WHERE tenant_id = $1 AND vehicle_id = $2
        ORDER BY created_at, id
      `,
      [params.tenantId, params.vehicleId]
    );
    return result.rows.map((row) => this.mapStatusLog(row));
  }

  async saveVehicleOwnership(ownership: MobilityVehicleOwnership): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.auto_vehicle_owners (
          id, tenant_id, customer_id, vehicle_id, ownership_type,
          license_plate, registration_date, is_active, transferred_at,
          transfer_notes, metadata, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        ownership.id,
        ownership.tenantId,
        ownership.customerId,
        ownership.vehicleId,
        ownership.ownershipType,
        ownership.licensePlate ?? null,
        ownership.registrationDate ?? null,
        ownership.isActive,
        ownership.transferredAt ?? null,
        ownership.transferNotes ?? null,
        JSON.stringify(ownership.metadata),
        ownership.createdAt,
        ownership.updatedAt,
      ]
    );
  }

  async listVehicleOwnerships(params: {
    tenantId: TenantId;
    vehicleId: MobilityId;
  }): Promise<MobilityVehicleOwnership[]> {
    const result = await this.db.query<OwnershipRow>(
      `
        SELECT id, tenant_id, customer_id, vehicle_id, ownership_type,
          license_plate, registration_date, is_active, transferred_at,
          transfer_notes, metadata, created_at, updated_at
        FROM public.auto_vehicle_owners
        WHERE tenant_id = $1 AND vehicle_id = $2
        ORDER BY created_at, id
      `,
      [params.tenantId, params.vehicleId]
    );
    return result.rows.map((row) => this.mapOwnership(row));
  }

  async listVehicleServiceHistory(params: {
    tenantId: TenantId;
    vehicleId: MobilityId;
  }): Promise<MobilityServiceHistoryEntry[]> {
    const result = await this.db.query<ServiceHistoryRow>(
      `
        SELECT id, tenant_id, vehicle_id, vin, repair_order_id, appointment_id,
          service_date, service_type, service_description, mileage,
          services_performed, parts_replaced, labor_hours, total_cost,
          next_service_due_date, next_service_due_mileage, recorded_by, recorded_at
        FROM public.auto_service_history
        WHERE tenant_id = $1 AND vehicle_id = $2
        ORDER BY service_date DESC, id
      `,
      [params.tenantId, params.vehicleId]
    );
    return result.rows.map((row) => this.mapServiceHistory(row));
  }

  async listAvailableVehicles(params: {
    tenantId: TenantId;
    variantId: MobilityId;
    colorExterior?: string;
    statuses: readonly MobilityVehicleStatus[];
  }): Promise<AvailableMobilityVehicle[]> {
    const values: unknown[] = [params.tenantId, params.variantId, params.statuses];
    const colorPredicate = params.colorExterior ? 'AND color_exterior = $4' : '';
    if (params.colorExterior) values.push(params.colorExterior);

    const result = await this.db.query<Pick<VehicleRow, 'id' | 'vin' | 'color_exterior' | 'status'>>(
      `
        SELECT id, vin, color_exterior, status
        FROM public.auto_vehicles
        WHERE tenant_id = $1
          AND variant_id = $2
          AND status = ANY($3::public.auto_vehicle_status[])
          ${colorPredicate}
        ORDER BY created_at DESC
      `,
      values
    );

    return result.rows.map((row) => ({
      id: row.id,
      vin: row.vin,
      colorExterior: row.color_exterior,
      status: row.status,
    }));
  }

  async saveDomainEvent(event: MobilityDomainEvent): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.mobility_domain_events (
          id, tenant_id, org_unit_id, entity_type, entity_id,
          event_type, payload, recorded_by, recorded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        event.id,
        event.tenantId,
        event.orgUnitId ?? null,
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
    entityId: MobilityId;
  }): Promise<MobilityDomainEvent[]> {
    const result = await this.db.query<DomainEventRow>(
      `
        SELECT id, tenant_id, org_unit_id, entity_type, entity_id,
          event_type, payload, recorded_by, recorded_at
        FROM public.mobility_domain_events
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
  }): Promise<MobilityCommandLogEntry<T> | null> {
    const result = await this.db.query<CommandLogRow<T>>(
      `
        SELECT tenant_id, org_unit_id, operation, business_key, payload_hash, result, created_at
        FROM public.mobility_command_idempotency
        WHERE tenant_id = $1 AND operation = $2 AND business_key = $3
      `,
      [params.tenantId, params.operation, params.businessKey]
    );
    const row = result.rows[0];
    return row
      ? {
          tenantId: row.tenant_id,
          orgUnitId: row.org_unit_id ?? undefined,
          operation: row.operation,
          businessKey: row.business_key,
          payloadHash: row.payload_hash,
          result: row.result,
          createdAt: toTimestamp(row.created_at),
        }
      : null;
  }

  async saveCommandLog<T>(entry: MobilityCommandLogEntry<T>): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.mobility_command_idempotency (
          tenant_id, org_unit_id, operation, business_key, payload_hash, result, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        entry.tenantId,
        entry.orgUnitId ?? null,
        entry.operation,
        entry.businessKey,
        entry.payloadHash,
        JSON.stringify(entry.result),
        entry.createdAt,
      ]
    );
  }

  private mapVehicle(row: VehicleRow): MobilityVehicle {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      variantId: row.variant_id,
      vin: row.vin,
      chassisNumber: row.chassis_number ?? undefined,
      engineNumber: row.engine_number ?? undefined,
      colorExterior: row.color_exterior,
      colorInterior: row.color_interior ?? undefined,
      modelYear: row.model_year,
      listPrice: toNumber(row.list_price),
      costPrice: toNumber(row.cost_price),
      status: row.status,
      locationNote: row.location_note ?? undefined,
      expectedArrivalDate: row.expected_arrival_date ? toDateOnly(row.expected_arrival_date) : undefined,
      actualArrivalDate: row.actual_arrival_date ? toDateOnly(row.actual_arrival_date) : undefined,
      importDeclarationNumber: row.import_declaration_number ?? undefined,
      allocatedToContractId: row.allocated_to_contract_id ?? undefined,
      allocatedAt: row.allocated_at ? toTimestamp(row.allocated_at) : undefined,
      allocatedByUserId: row.allocated_by_user_id ?? undefined,
      deliveredAt: row.delivered_at ? toTimestamp(row.delivered_at) : undefined,
      deliveredToCustomerId: row.delivered_to_customer_id ?? undefined,
      deliveryNotes: row.delivery_notes ?? undefined,
      metadata: readRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapStatusLog(row: StatusLogRow): MobilityVehicleStatusLog {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      vehicleId: row.vehicle_id,
      fromStatus: row.from_status ?? undefined,
      toStatus: row.to_status,
      changedByUserId: row.changed_by_user_id ?? undefined,
      reason: row.reason ?? undefined,
      metadata: readRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
    };
  }

  private mapOwnership(row: OwnershipRow): MobilityVehicleOwnership {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      vehicleId: row.vehicle_id,
      ownershipType: row.ownership_type,
      licensePlate: row.license_plate ?? undefined,
      registrationDate: row.registration_date ? toDateOnly(row.registration_date) : undefined,
      isActive: row.is_active,
      transferredAt: row.transferred_at ? toTimestamp(row.transferred_at) : undefined,
      transferNotes: row.transfer_notes ?? undefined,
      metadata: readRecord(row.metadata),
      createdAt: toTimestamp(row.created_at),
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapServiceHistory(row: ServiceHistoryRow): MobilityServiceHistoryEntry {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      vehicleId: row.vehicle_id,
      vin: row.vin,
      repairOrderId: row.repair_order_id ?? undefined,
      appointmentId: row.appointment_id ?? undefined,
      serviceDate: toDateOnly(row.service_date),
      serviceType: row.service_type,
      serviceDescription: row.service_description,
      mileage: row.mileage,
      servicesPerformed: readRecordArray(row.services_performed),
      partsReplaced: readRecordArray(row.parts_replaced),
      laborHours: row.labor_hours === null ? undefined : toNumber(row.labor_hours),
      totalCost: row.total_cost === null ? undefined : toNumber(row.total_cost),
      nextServiceDueDate: row.next_service_due_date ? toDateOnly(row.next_service_due_date) : undefined,
      nextServiceDueMileage: row.next_service_due_mileage ?? undefined,
      recordedBy: row.recorded_by,
      recordedAt: toTimestamp(row.recorded_at),
    };
  }

  private mapDomainEvent(row: DomainEventRow): MobilityDomainEvent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      orgUnitId: row.org_unit_id ?? undefined,
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

function readRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null && !Array.isArray(entry)
      ).map((entry) => ({ ...entry }))
    : [];
}
