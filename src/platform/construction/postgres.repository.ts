import type {
  ConstructionBoqLine,
  ConstructionId,
  ConstructionProject,
  ConstructionSite,
  ConstructionWorkPackage,
  TenantId,
} from './domain/types';
import type { ConstructionRepository } from './ports';

type ConstructionQueryResultRow = Record<string, unknown>;

export interface ConstructionSqlClient {
  query<Row extends ConstructionQueryResultRow = ConstructionQueryResultRow>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
}

type ProjectRow = ConstructionQueryResultRow & {
  id: string;
  tenant_id: string;
  project_code: string;
  name: string;
  status: ConstructionProject['status'];
  created_by: string;
  created_at: string | Date;
  updated_by: string;
  updated_at: string | Date;
};

type SiteRow = ConstructionQueryResultRow & {
  id: string;
  tenant_id: string;
  project_id: string;
  org_unit_id: string;
  site_code: string;
  name: string;
  location_text: string | null;
  status: ConstructionSite['status'];
  created_by: string;
  created_at: string | Date;
  updated_by: string;
  updated_at: string | Date;
};

type WorkPackageRow = ConstructionQueryResultRow & {
  id: string;
  tenant_id: string;
  project_id: string;
  site_id: string;
  org_unit_id: string;
  parent_work_package_id: string | null;
  work_package_code: string;
  name: string;
  status: ConstructionWorkPackage['status'];
  planned_start_date: string | Date | null;
  planned_end_date: string | Date | null;
  created_by: string;
  created_at: string | Date;
  updated_by: string;
  updated_at: string | Date;
};

type BoqLineRow = ConstructionQueryResultRow & {
  id: string;
  tenant_id: string;
  project_id: string;
  site_id: string;
  work_package_id: string;
  org_unit_id: string;
  line_number: string;
  description: string;
  quantity: string | number;
  uom: string;
  unit_rate: string | number | null;
  currency: string;
  cost_code: string | null;
  created_by: string;
  created_at: string | Date;
  updated_by: string;
  updated_at: string | Date;
};

export class PostgresConstructionRepository implements ConstructionRepository {
  constructor(
    private readonly db: ConstructionSqlClient,
    private readonly inTransaction = false
  ) {}

  async withTransaction<T>(callback: (repository: ConstructionRepository) => Promise<T>): Promise<T> {
    if (this.inTransaction) return callback(this);
    await this.db.query('BEGIN');
    try {
      const result = await callback(new PostgresConstructionRepository(this.db, true));
      await this.db.query('COMMIT');
      return result;
    } catch (error) {
      await this.db.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async saveProject(project: ConstructionProject): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.construction_projects (
          id, tenant_id, project_code, name, status,
          created_by, created_at, updated_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
      `,
      [
        project.id,
        project.tenantId,
        project.projectCode,
        project.name,
        project.status,
        project.createdBy,
        project.createdAt,
        project.updatedBy,
        project.updatedAt,
      ]
    );
  }

  async getProject(tenantId: TenantId, id: ConstructionId): Promise<ConstructionProject | null> {
    const result = await this.db.query<ProjectRow>(
      `
        SELECT id, tenant_id, project_code, name, status,
          created_by, created_at, updated_by, updated_at
        FROM public.construction_projects
        WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, id]
    );
    return result.rows[0] ? this.mapProject(result.rows[0]) : null;
  }

  async findProjectByCode(params: { tenantId: TenantId; projectCode: string }): Promise<ConstructionProject | null> {
    const result = await this.db.query<ProjectRow>(
      `
        SELECT id, tenant_id, project_code, name, status,
          created_by, created_at, updated_by, updated_at
        FROM public.construction_projects
        WHERE tenant_id = $1 AND project_code = $2
      `,
      [params.tenantId, params.projectCode]
    );
    return result.rows[0] ? this.mapProject(result.rows[0]) : null;
  }

  async saveSite(site: ConstructionSite): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.construction_sites (
          id, tenant_id, project_id, org_unit_id, site_code, name, location_text, status,
          created_by, created_at, updated_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          name = EXCLUDED.name,
          location_text = EXCLUDED.location_text,
          status = EXCLUDED.status,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
      `,
      [
        site.id,
        site.tenantId,
        site.projectId,
        site.orgUnitId,
        site.siteCode,
        site.name,
        site.locationText ?? null,
        site.status,
        site.createdBy,
        site.createdAt,
        site.updatedBy,
        site.updatedAt,
      ]
    );
  }

  async getSite(tenantId: TenantId, id: ConstructionId): Promise<ConstructionSite | null> {
    const result = await this.db.query<SiteRow>(
      `
        SELECT id, tenant_id, project_id, org_unit_id, site_code, name, location_text, status,
          created_by, created_at, updated_by, updated_at
        FROM public.construction_sites
        WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, id]
    );
    return result.rows[0] ? this.mapSite(result.rows[0]) : null;
  }

  async findSiteByCode(params: {
    tenantId: TenantId;
    projectId: ConstructionId;
    siteCode: string;
  }): Promise<ConstructionSite | null> {
    const result = await this.db.query<SiteRow>(
      `
        SELECT id, tenant_id, project_id, org_unit_id, site_code, name, location_text, status,
          created_by, created_at, updated_by, updated_at
        FROM public.construction_sites
        WHERE tenant_id = $1 AND project_id = $2 AND site_code = $3
      `,
      [params.tenantId, params.projectId, params.siteCode]
    );
    return result.rows[0] ? this.mapSite(result.rows[0]) : null;
  }

  async listSitesByProject(params: { tenantId: TenantId; projectId: ConstructionId }): Promise<ConstructionSite[]> {
    const result = await this.db.query<SiteRow>(
      `
        SELECT id, tenant_id, project_id, org_unit_id, site_code, name, location_text, status,
          created_by, created_at, updated_by, updated_at
        FROM public.construction_sites
        WHERE tenant_id = $1 AND project_id = $2
        ORDER BY site_code, id
      `,
      [params.tenantId, params.projectId]
    );
    return result.rows.map((row) => this.mapSite(row));
  }

  async saveWorkPackage(workPackage: ConstructionWorkPackage): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.construction_work_packages (
          id, tenant_id, project_id, site_id, org_unit_id, parent_work_package_id,
          work_package_code, name, status, planned_start_date, planned_end_date,
          created_by, created_at, updated_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          planned_start_date = EXCLUDED.planned_start_date,
          planned_end_date = EXCLUDED.planned_end_date,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
      `,
      [
        workPackage.id,
        workPackage.tenantId,
        workPackage.projectId,
        workPackage.siteId,
        workPackage.orgUnitId,
        workPackage.parentWorkPackageId ?? null,
        workPackage.workPackageCode,
        workPackage.name,
        workPackage.status,
        workPackage.plannedStartDate ?? null,
        workPackage.plannedEndDate ?? null,
        workPackage.createdBy,
        workPackage.createdAt,
        workPackage.updatedBy,
        workPackage.updatedAt,
      ]
    );
  }

  async getWorkPackage(tenantId: TenantId, id: ConstructionId): Promise<ConstructionWorkPackage | null> {
    const result = await this.db.query<WorkPackageRow>(
      `
        SELECT id, tenant_id, project_id, site_id, org_unit_id, parent_work_package_id,
          work_package_code, name, status, planned_start_date, planned_end_date,
          created_by, created_at, updated_by, updated_at
        FROM public.construction_work_packages
        WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, id]
    );
    return result.rows[0] ? this.mapWorkPackage(result.rows[0]) : null;
  }

  async findWorkPackageByCode(params: {
    tenantId: TenantId;
    siteId: ConstructionId;
    workPackageCode: string;
  }): Promise<ConstructionWorkPackage | null> {
    const result = await this.db.query<WorkPackageRow>(
      `
        SELECT id, tenant_id, project_id, site_id, org_unit_id, parent_work_package_id,
          work_package_code, name, status, planned_start_date, planned_end_date,
          created_by, created_at, updated_by, updated_at
        FROM public.construction_work_packages
        WHERE tenant_id = $1 AND site_id = $2 AND work_package_code = $3
      `,
      [params.tenantId, params.siteId, params.workPackageCode]
    );
    return result.rows[0] ? this.mapWorkPackage(result.rows[0]) : null;
  }

  async listWorkPackagesBySite(params: {
    tenantId: TenantId;
    siteId: ConstructionId;
  }): Promise<ConstructionWorkPackage[]> {
    const result = await this.db.query<WorkPackageRow>(
      `
        SELECT id, tenant_id, project_id, site_id, org_unit_id, parent_work_package_id,
          work_package_code, name, status, planned_start_date, planned_end_date,
          created_by, created_at, updated_by, updated_at
        FROM public.construction_work_packages
        WHERE tenant_id = $1 AND site_id = $2
        ORDER BY work_package_code, id
      `,
      [params.tenantId, params.siteId]
    );
    return result.rows.map((row) => this.mapWorkPackage(row));
  }

  async saveBoqLine(line: ConstructionBoqLine): Promise<void> {
    await this.db.query(
      `
        INSERT INTO public.construction_boq_lines (
          id, tenant_id, project_id, site_id, work_package_id, org_unit_id,
          line_number, description, quantity, uom, unit_rate, currency, cost_code,
          created_by, created_at, updated_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (tenant_id, id)
        DO UPDATE SET
          description = EXCLUDED.description,
          quantity = EXCLUDED.quantity,
          uom = EXCLUDED.uom,
          unit_rate = EXCLUDED.unit_rate,
          currency = EXCLUDED.currency,
          cost_code = EXCLUDED.cost_code,
          updated_by = EXCLUDED.updated_by,
          updated_at = EXCLUDED.updated_at
      `,
      [
        line.id,
        line.tenantId,
        line.projectId,
        line.siteId,
        line.workPackageId,
        line.orgUnitId,
        line.lineNumber,
        line.description,
        line.quantity,
        line.uom,
        line.unitRate ?? null,
        line.currency,
        line.costCode ?? null,
        line.createdBy,
        line.createdAt,
        line.updatedBy,
        line.updatedAt,
      ]
    );
  }

  async findBoqLineByNumber(params: {
    tenantId: TenantId;
    workPackageId: ConstructionId;
    lineNumber: string;
  }): Promise<ConstructionBoqLine | null> {
    const result = await this.db.query<BoqLineRow>(
      `
        SELECT id, tenant_id, project_id, site_id, work_package_id, org_unit_id,
          line_number, description, quantity, uom, unit_rate, currency, cost_code,
          created_by, created_at, updated_by, updated_at
        FROM public.construction_boq_lines
        WHERE tenant_id = $1 AND work_package_id = $2 AND line_number = $3
      `,
      [params.tenantId, params.workPackageId, params.lineNumber]
    );
    return result.rows[0] ? this.mapBoqLine(result.rows[0]) : null;
  }

  async listBoqLinesByWorkPackage(params: {
    tenantId: TenantId;
    workPackageId: ConstructionId;
  }): Promise<ConstructionBoqLine[]> {
    const result = await this.db.query<BoqLineRow>(
      `
        SELECT id, tenant_id, project_id, site_id, work_package_id, org_unit_id,
          line_number, description, quantity, uom, unit_rate, currency, cost_code,
          created_by, created_at, updated_by, updated_at
        FROM public.construction_boq_lines
        WHERE tenant_id = $1 AND work_package_id = $2
        ORDER BY line_number, id
      `,
      [params.tenantId, params.workPackageId]
    );
    return result.rows.map((row) => this.mapBoqLine(row));
  }

  private mapProject(row: ProjectRow): ConstructionProject {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectCode: row.project_code,
      name: row.name,
      status: row.status,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      updatedBy: row.updated_by,
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapSite(row: SiteRow): ConstructionSite {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      orgUnitId: row.org_unit_id,
      siteCode: row.site_code,
      name: row.name,
      locationText: row.location_text ?? undefined,
      status: row.status,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      updatedBy: row.updated_by,
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapWorkPackage(row: WorkPackageRow): ConstructionWorkPackage {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      siteId: row.site_id,
      orgUnitId: row.org_unit_id,
      parentWorkPackageId: row.parent_work_package_id ?? undefined,
      workPackageCode: row.work_package_code,
      name: row.name,
      status: row.status,
      plannedStartDate: row.planned_start_date ? toDateOnly(row.planned_start_date) : undefined,
      plannedEndDate: row.planned_end_date ? toDateOnly(row.planned_end_date) : undefined,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      updatedBy: row.updated_by,
      updatedAt: toTimestamp(row.updated_at),
    };
  }

  private mapBoqLine(row: BoqLineRow): ConstructionBoqLine {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      siteId: row.site_id,
      workPackageId: row.work_package_id,
      orgUnitId: row.org_unit_id,
      lineNumber: row.line_number,
      description: row.description,
      quantity: toNumber(row.quantity),
      uom: row.uom,
      unitRate: row.unit_rate === null ? undefined : toNumber(row.unit_rate),
      currency: row.currency,
      costCode: row.cost_code ?? undefined,
      createdBy: row.created_by,
      createdAt: toTimestamp(row.created_at),
      updatedBy: row.updated_by,
      updatedAt: toTimestamp(row.updated_at),
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
