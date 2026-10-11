import { randomUUID } from 'crypto';

import { Client, type QueryResult, type QueryResultRow } from 'pg';

import { WarehouseStockInCanonicalFacade } from '../logistics/warehouse/stock-in-canonical.facade';
import { createWarehousePostgresStockInPorts } from '../logistics/warehouse/postgres-stock-in-ports';
import { WarehouseStockOutCanonicalFacade } from '../logistics/warehouse/stock-out-canonical.facade';
import { createWarehousePostgresStockOutPorts } from '../logistics/warehouse/postgres-stock-out-ports';
import { ManufacturingAuthorizationError } from './domain/errors';
import type {
  FactoryOrgUnitId,
  ManufacturingActor,
  ManufacturingPermission,
  TenantId,
  UserId,
} from './domain/types';
import {
  LogisticsEvidenceBindingAdapter,
  LogisticsFinishedGoodsReceiptAdapter,
  LogisticsProductionConsumptionIssueAdapter,
} from './ports';
import { ManufacturingSlice1Service } from './manufacturing-slice1.service';
import {
  PostgresManufacturingRepository,
  type ManufacturingSqlClient,
} from './postgres.repository';
import type {
  FinishedGoodsReceiptPort,
  ManufacturingAuthorizationPort,
  ManufacturingRepository,
  MaterialAvailabilityPort,
  ProductionConsumptionIssuePort,
} from './ports';

const ALL_MANUFACTURING_PERMISSIONS: ManufacturingPermission[] = [
  'manufacturing:operational_read:read',
  'manufacturing:production_plan:write',
  'manufacturing:production_plan:approve',
  'manufacturing:production_plan:release',
  'manufacturing:production_order:write',
  'manufacturing:production_order:release',
  'manufacturing:production_order:complete',
  'manufacturing:bom:write',
  'manufacturing:bom:approve',
  'manufacturing:material_requirement:calculate',
  'manufacturing:availability:read',
  'manufacturing:material_issue:record',
  'manufacturing:execution:record',
  'manufacturing:fgr:record',
  'manufacturing:quality_disposition:record',
  'manufacturing:work_center:write',
  'manufacturing:routing:write',
  'manufacturing:routing:approve',
  'manufacturing:routing:apply',
  'manufacturing:operation_progress:update',
  'manufacturing:reconciliation:read',
  'manufacturing:genealogy:read',
];

const ROLE_PERMISSIONS: Record<string, ManufacturingPermission[]> = {
  manufacturing_planner: [
    'manufacturing:operational_read:read',
    'manufacturing:production_plan:write',
    'manufacturing:production_plan:approve',
    'manufacturing:production_plan:release',
    'manufacturing:production_order:write',
    'manufacturing:production_order:release',
    'manufacturing:bom:write',
    'manufacturing:bom:approve',
    'manufacturing:material_requirement:calculate',
    'manufacturing:availability:read',
    'manufacturing:work_center:write',
    'manufacturing:routing:write',
    'manufacturing:routing:approve',
    'manufacturing:routing:apply',
    'manufacturing:reconciliation:read',
    'manufacturing:genealogy:read',
  ],
  manufacturing_operator: [
    'manufacturing:operational_read:read',
    'manufacturing:availability:read',
    'manufacturing:material_issue:record',
    'manufacturing:execution:record',
    'manufacturing:operation_progress:update',
    'manufacturing:genealogy:read',
  ],
  manufacturing_qc: [
    'manufacturing:operational_read:read',
    'manufacturing:fgr:record',
    'manufacturing:quality_disposition:record',
    'manufacturing:reconciliation:read',
    'manufacturing:genealogy:read',
  ],
  manufacturing_supervisor: ALL_MANUFACTURING_PERMISSIONS,
  planner: [
    'manufacturing:operational_read:read',
    'manufacturing:production_plan:write',
    'manufacturing:production_plan:approve',
    'manufacturing:production_plan:release',
    'manufacturing:production_order:write',
    'manufacturing:production_order:release',
    'manufacturing:bom:write',
    'manufacturing:bom:approve',
    'manufacturing:material_requirement:calculate',
    'manufacturing:availability:read',
    'manufacturing:work_center:write',
    'manufacturing:routing:write',
    'manufacturing:routing:approve',
    'manufacturing:routing:apply',
    'manufacturing:reconciliation:read',
    'manufacturing:genealogy:read',
  ],
  operator: [
    'manufacturing:operational_read:read',
    'manufacturing:availability:read',
    'manufacturing:material_issue:record',
    'manufacturing:execution:record',
    'manufacturing:operation_progress:update',
    'manufacturing:genealogy:read',
  ],
  qc: [
    'manufacturing:operational_read:read',
    'manufacturing:fgr:record',
    'manufacturing:quality_disposition:record',
    'manufacturing:reconciliation:read',
    'manufacturing:genealogy:read',
  ],
  supervisor: ALL_MANUFACTURING_PERMISSIONS,
};

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'owner', 'manager']);

export class AuthenticatedManufacturingSqlClient implements ManufacturingSqlClient {
  constructor(
    private readonly client: Client,
    private readonly context: { userId: UserId; tenantId: TenantId }
  ) {}

  async query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<Row>> {
    const command = sql.trim().toUpperCase();
    if (command === 'BEGIN') {
      await this.client.query('BEGIN');
      await this.client.query('SET LOCAL ROLE authenticated');
      await this.client.query('SET LOCAL row_security = on');
      await this.client.query(
        `
          SELECT
            set_config('app.current_user_id', $1, TRUE),
            set_config('app.current_tenant_id', $2, TRUE),
            set_config('request.jwt.claim.sub', $1, TRUE),
            set_config('request.jwt.claim.role', 'authenticated', TRUE)
        `,
        [this.context.userId, this.context.tenantId]
      );
      return emptyQueryResult('BEGIN');
    }

    const result = await this.client.query<Row>(sql, values ? [...values] : undefined);
    return result;
  }
}

function emptyQueryResult<Row extends QueryResultRow>(command: string): QueryResult<Row> {
  return {
    command,
    rowCount: null,
    oid: 0,
    rows: [],
    fields: [],
  };
}

export class ManufacturingRoleAuthorization implements ManufacturingAuthorizationPort {
  constructor(private readonly db: ManufacturingSqlClient) {}

  async ensureAllowed(params: {
    actor: ManufacturingActor;
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    permission: ManufacturingPermission;
  }): Promise<void> {
    if (params.actor.tenantId !== params.tenantId) {
      throw new ManufacturingAuthorizationError();
    }

    const access = await this.db.query(
      `
        SELECT 1
        FROM public.user_org_unit_access
        WHERE user_id = $1::uuid
          AND tenant_id = $2::uuid
          AND org_unit_id = $3::uuid
        LIMIT 1
      `,
      [params.actor.userId, params.tenantId, params.factoryOrgUnitId]
    );

    if (access.rows.length === 0 || !hasManufacturingPermission(params.actor.roles, params.permission)) {
      throw new ManufacturingAuthorizationError();
    }
  }
}

export interface ManufacturingOperationalRuntime {
  service: ManufacturingSlice1Service;
  repository: ManufacturingRepository;
  authorization: ManufacturingRoleAuthorization;
  issue: ProductionConsumptionIssuePort;
  receipt: FinishedGoodsReceiptPort;
  authorize(permission: ManufacturingPermission): Promise<void>;
  close(): Promise<void>;
}

export async function createManufacturingOperationalRuntime(params: {
  databaseUrl: string;
  actor: ManufacturingActor;
}): Promise<ManufacturingOperationalRuntime> {
  const manufacturingClient = new Client({ connectionString: params.databaseUrl, ssl: sslConfig() });
  const logisticsClient = new Client({ connectionString: params.databaseUrl, ssl: sslConfig() });
  await manufacturingClient.connect();
  await logisticsClient.connect();

  const manufacturingSql = new AuthenticatedManufacturingSqlClient(manufacturingClient, {
    userId: params.actor.userId,
    tenantId: params.actor.tenantId,
  });
  const logisticsSql = new AuthenticatedManufacturingSqlClient(logisticsClient, {
    userId: params.actor.userId,
    tenantId: params.actor.tenantId,
  });
  const repository = new PostgresManufacturingRepository(manufacturingSql);
  const authorization = new ManufacturingRoleAuthorization(manufacturingSql);
  const stockOutPorts = createWarehousePostgresStockOutPorts(logisticsSql, {
    idFactory: () => randomUUID(),
  });
  const stockInPorts = createWarehousePostgresStockInPorts(logisticsSql, {
    idFactory: () => randomUUID(),
  });
  const availability: MaterialAvailabilityPort = {
    async getAvailable(availabilityParams) {
      const balance = await stockOutPorts.balance.getSourceBalance({
        tenant_id: availabilityParams.tenantId,
        item_id: availabilityParams.itemId,
        location_id: availabilityParams.locationId,
      });
      return balance.available;
    },
  };
  const service = new ManufacturingSlice1Service(
    repository,
    authorization,
    availability,
    new LogisticsEvidenceBindingAdapter(stockOutPorts, stockInPorts),
    { next: () => randomUUID() },
    { now: () => new Date().toISOString() }
  );

  return {
    service,
    repository,
    authorization,
    issue: new LogisticsProductionConsumptionIssueAdapter(new WarehouseStockOutCanonicalFacade(stockOutPorts)),
    receipt: new LogisticsFinishedGoodsReceiptAdapter(new WarehouseStockInCanonicalFacade(stockInPorts)),
    async authorize(permission) {
      await repository.withTransaction(async () => {
        await authorization.ensureAllowed({
          actor: params.actor,
          tenantId: params.actor.tenantId,
          factoryOrgUnitId: params.actor.factoryOrgUnitId,
          permission,
        });
      });
    },
    async close() {
      await manufacturingClient.end();
      await logisticsClient.end();
    },
  };
}

export function getManufacturingDatabaseUrl(): string | null {
  return (
    process.env.E2E_SUPABASE_DB_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    null
  );
}

export function hasManufacturingPermission(
  roles: readonly string[],
  permission: ManufacturingPermission
): boolean {
  for (const role of roles) {
    const normalized = normalizeRole(role);
    if (ADMIN_ROLES.has(normalized)) return true;
    if ((ROLE_PERMISSIONS[normalized] ?? []).includes(permission)) return true;
  }
  return false;
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase();
}

function sslConfig(): boolean | { rejectUnauthorized: false } | undefined {
  return process.env.SUPABASE_DB_SSL === 'disable' ? undefined : { rejectUnauthorized: false };
}
