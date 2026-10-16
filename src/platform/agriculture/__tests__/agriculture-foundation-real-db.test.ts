import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import { parse as parseEnv } from 'dotenv';
import { Client, type QueryResultRow } from 'pg';

import {
  AgricultureFoundationService,
  FixedAgricultureClock,
  PostgresAgricultureRepository,
  StaticAgricultureAuthorization,
  type AgricultureActor,
  type AgricultureIdFactory,
  type AgriculturePermission,
  type AgricultureSqlClient,
} from '..';

const EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const EXPECTED_E2E_SUPABASE_HOST = `${EXPECTED_E2E_PROJECT_REF}.supabase.co`;

loadAgricultureE2eEnv();

const dbUrl =
  process.env.DATABASE_EXECUTOR_URL_TEST ||
  process.env.E2E_SUPABASE_DB_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  '';

const migrationSql = readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20261012030000_create_agriculture_os_foundation.sql'),
  'utf8'
);

const describeWithRealDb =
  isRunnableDbUrl(dbUrl) && isAllowedE2eProject() && isAllowedE2eDbUrl(dbUrl) ? describe : describe.skip;

class RandomUuidAgricultureIdFactory implements AgricultureIdFactory {
  next(): string {
    return randomUUID();
  }
}

class AuthenticatedAgricultureSqlClient implements AgricultureSqlClient {
  constructor(
    private readonly client: Client,
    private readonly context: { userId: string; tenantId: string }
  ) {}

  async query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[] }> {
    if (sql.trim().toUpperCase() === 'BEGIN') {
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
      return { rows: [] };
    }

    const result = await this.client.query<Row>(sql, values ? [...values] : undefined);
    return { rows: result.rows };
  }
}

type CountRow = QueryResultRow & { count: string };
type PolicyRow = QueryResultRow & { tablename: string; policyname: string };

describeWithRealDb('Agriculture OS Foundation real DB and RLS verification', () => {
  jest.setTimeout(120_000);

  const marker = `ag-foundation-${Date.now()}`;
  const ids = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    personA: randomUUID(),
    personB: randomUUID(),
    orgA: randomUUID(),
    orgB: randomUUID(),
  };

  const allPermissions: AgriculturePermission[] = [
    'agriculture:foundation:read',
    'agriculture:farm:write',
    'agriculture:plot:write',
    'agriculture:crop_cycle:write',
    'agriculture:activity:record',
    'agriculture:material_usage:record',
    'agriculture:harvest:record',
  ];

  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await admin.connect();
    await admin.query(migrationSql);
    await seedTenant(ids.tenantA, `${marker} Tenant A`);
    await seedTenant(ids.tenantB, `${marker} Tenant B`);
    await seedUser(ids.tenantA, ids.userA, ids.personA, ids.orgA, 'a');
    await seedUser(ids.tenantB, ids.userB, ids.personB, ids.orgB, 'b');
  });

  afterAll(async () => {
    if (!admin) return;
    try {
      await cleanupFixtures();
      await admin.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB]]);
    } finally {
      await admin.end();
    }
  });

  it('applies additive schema and org-unit RLS policies', async () => {
    const tables = [
      'agriculture_farms',
      'agriculture_plots',
      'agriculture_crop_cycles',
      'agriculture_crop_cycle_events',
      'agriculture_crop_activities',
      'agriculture_material_usage_evidence',
      'agriculture_harvest_evidence',
      'agriculture_domain_events',
      'agriculture_command_idempotency',
    ];

    for (const table of tables) {
      const exists = await admin.query<CountRow>(
        `
          SELECT COUNT(*)::text AS count
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        `,
        [table]
      );
      expect(Number(exists.rows[0].count)).toBe(1);

      const rls = await admin.query<QueryResultRow & { relrowsecurity: boolean }>(
        'SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass',
        [`public.${table}`]
      );
      expect(rls.rows[0].relrowsecurity).toBe(true);
    }

    const policies = await admin.query<PolicyRow>(
      `
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename LIKE 'agriculture_%'
      `
    );
    expect(policies.rows.map((row) => row.policyname)).toEqual(
      expect.arrayContaining([
        'agriculture_farms_org_unit_access',
        'agriculture_plots_org_unit_access',
        'agriculture_crop_cycles_org_unit_access',
        'agriculture_cycle_events_cycle_access',
        'agriculture_crop_activities_org_unit_access',
        'agriculture_material_usage_org_unit_access',
        'agriculture_harvest_org_unit_access',
        'agriculture_domain_events_org_unit_access',
        'agriculture_command_idempotency_org_unit_access',
      ])
    );
  });

  it('persists foundation workflow and denies cross-tenant RLS read-back', async () => {
    const clientA = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    const clientB = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await clientA.connect();
    await clientB.connect();
    try {
      const actorA = createActor(ids.tenantA, ids.userA, ids.orgA);
      const serviceA = createService(clientA, actorA);
      const farm = (await serviceA.createFarm(actorA, {
        idempotencyKey: 'farm-real-db',
        orgUnitId: ids.orgA,
        farmCode: `${marker}-farm`,
        name: `${marker} farm`,
      })).value;
      const plot = (await serviceA.createPlot(actorA, {
        idempotencyKey: 'plot-real-db',
        farmId: farm.id,
        plotCode: `${marker}-plot`,
        name: `${marker} plot`,
      })).value;
      const cycle = (await serviceA.createCropCycle(actorA, {
        idempotencyKey: 'cycle-real-db',
        plotId: plot.id,
        cycleCode: `${marker}-cycle`,
        cropName: 'Rice',
      })).value;
      const activeCycle = (await serviceA.startCropCycle(actorA, {
        idempotencyKey: 'cycle-start-real-db',
        cropCycleId: cycle.id,
      })).value;
      await serviceA.recordCropActivity(actorA, {
        idempotencyKey: 'activity-real-db',
        cropCycleId: activeCycle.id,
        activityType: 'soil_preparation',
      });
      await serviceA.recordMaterialUsage(actorA, {
        idempotencyKey: 'usage-real-db',
        cropCycleId: activeCycle.id,
        plotId: plot.id,
        materialId: `${marker}-seed`,
        quantity: 1,
        uom: 'kg',
      });
      await serviceA.recordHarvest(actorA, {
        idempotencyKey: 'harvest-real-db',
        cropCycleId: activeCycle.id,
        plotId: plot.id,
        quantity: 10,
        uom: 'kg',
      });

      const trace = await serviceA.getCropCycleTrace(actorA, { cropCycleId: activeCycle.id });
      expect(trace.activities).toHaveLength(1);
      expect(trace.materialUsages).toHaveLength(1);
      expect(trace.harvests).toHaveLength(1);

      const tenantBRepository = new PostgresAgricultureRepository(
        new AuthenticatedAgricultureSqlClient(clientB, { tenantId: ids.tenantB, userId: ids.userB })
      );
      const tenantBReadBack = await tenantBRepository.withTransaction((repository) =>
        repository.getFarm(ids.tenantA, farm.id)
      );
      expect(tenantBReadBack).toBeNull();
    } finally {
      await clientA.end();
      await clientB.end();
    }
  });

  function createService(client: Client, actor: AgricultureActor): AgricultureFoundationService {
    return new AgricultureFoundationService(
      new PostgresAgricultureRepository(
        new AuthenticatedAgricultureSqlClient(client, { tenantId: actor.tenantId, userId: actor.userId })
      ),
      new StaticAgricultureAuthorization(
        {
          [ids.userA]: ids.orgA,
          [ids.userB]: ids.orgB,
        },
        {
          [ids.userA]: allPermissions,
          [ids.userB]: allPermissions,
        }
      ),
      new RandomUuidAgricultureIdFactory(),
      new FixedAgricultureClock('2026-10-12T03:00:00.000Z')
    );
  }

  async function seedTenant(tenantId: string, name: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO public.tenants (id, name, status, enabled_modules)
        VALUES ($1::uuid, $2, 'active', '{}'::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            status = EXCLUDED.status,
            enabled_modules = EXCLUDED.enabled_modules
      `,
      [tenantId, name]
    );
  }

  async function seedUser(
    tenantId: string,
    userId: string,
    personId: string,
    orgUnitId: string,
    label: string
  ): Promise<void> {
    await admin.query(
      `
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        )
        VALUES (
          '00000000-0000-0000-0000-000000000000'::uuid,
          $1::uuid,
          'authenticated',
          'authenticated',
          $2,
          '',
          NOW(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [userId, `${marker}-${label}@example.com`]
    );
    await admin.query(
      `
        INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
        VALUES ($1::uuid, $2::uuid, $3, $4, 'ktv', 'active')
        ON CONFLICT (id) DO UPDATE
        SET tenant_id = EXCLUDED.tenant_id,
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            status = EXCLUDED.status
      `,
      [userId, tenantId, `${marker}-${label}@example.com`, `${marker} ${label}`]
    );
    await admin.query(
      `
        INSERT INTO public.org_units (id, tenant_id, unit_type, name, code, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, 'branch', $3, $4, TRUE, '{"proof":"agriculture-foundation"}'::jsonb)
      `,
      [orgUnitId, tenantId, `${marker}-${label}-org`, `${marker}-${label}-org`]
    );
    await admin.query(
      `
        INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'employee', $4, TRUE, '{"proof":"agriculture-foundation"}'::jsonb)
      `,
      [personId, tenantId, userId, `${marker} person ${label}`]
    );
    await admin.query(
      `
        INSERT INTO public.org_relationships (
          tenant_id, from_id, from_type, to_id, to_type, rel_type, role, since, metadata
        )
        VALUES ($1::uuid, $2::uuid, 'person', $3::uuid, 'unit', 'belongs_to', 'operator', CURRENT_DATE, '{"proof":"agriculture-foundation"}'::jsonb)
      `,
      [tenantId, personId, orgUnitId]
    );
  }

  function createActor(tenantId: string, userId: string, orgUnitId: string): AgricultureActor {
    return {
      tenantId,
      userId,
      orgUnitId,
      roles: ['agriculture_operator'],
    };
  }

  async function cleanupFixtures(): Promise<void> {
    await admin.query('SET row_security = off');
    await admin.query('DELETE FROM public.agriculture_command_idempotency WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.agriculture_domain_events WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.agriculture_harvest_evidence WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.agriculture_material_usage_evidence WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.agriculture_crop_activities WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.agriculture_crop_cycle_events WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.agriculture_crop_cycles WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.agriculture_plots WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.agriculture_farms WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.org_relationships WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.people_directory WHERE id = ANY($1::uuid[])', [[ids.personA, ids.personB]]);
    await admin.query('DELETE FROM public.org_units WHERE id = ANY($1::uuid[])', [[ids.orgA, ids.orgB]]);
    await admin.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB]]);
  }
});

function isRunnableDbUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && parsed.hostname !== 'base');
  } catch {
    return false;
  }
}

function loadAgricultureE2eEnv(): void {
  for (const filePath of candidateE2eEnvFiles()) {
    if (!existsSync(filePath)) continue;
    const parsed = parseEnv(readFileSync(filePath));
    if (path.basename(filePath) === '.env.e2e') {
      if (parsed.NEXT_PUBLIC_SUPABASE_URL && !process.env.E2E_SUPABASE_URL?.trim()) {
        process.env.E2E_SUPABASE_URL = parsed.NEXT_PUBLIC_SUPABASE_URL;
      }
      if (parsed.DATABASE_EXECUTOR_URL_TEST && !process.env.DATABASE_EXECUTOR_URL_TEST?.trim()) {
        process.env.DATABASE_EXECUTOR_URL_TEST = parsed.DATABASE_EXECUTOR_URL_TEST;
      }
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]?.trim()) {
        process.env[key] = value;
      }
    }
  }
  mapE2eAliases();
}

function candidateE2eEnvFiles(): string[] {
  const candidates = [
    process.env.E2E_ENV_FILE,
    path.join(tmpdir(), 'bella-spa-e2e.env'),
    path.resolve(process.cwd(), '.env.e2e'),
    path.resolve('D:/Antigravity/Projects/BELLA SPA ERP/.env.e2e'),
    path.resolve(process.cwd(), '../BELLA SPA ERP/.env.e2e'),
  ].filter((filePath): filePath is string => Boolean(filePath));

  return [...new Set(candidates.map((filePath) => path.resolve(filePath)))];
}

function mapE2eAliases(): void {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.E2E_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.E2E_SUPABASE_URL;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.E2E_SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!process.env.SUPABASE_DB_URL && process.env.E2E_SUPABASE_DB_URL) {
    process.env.SUPABASE_DB_URL = process.env.E2E_SUPABASE_DB_URL;
  }
}

function isAllowedE2eProject(): boolean {
  const supabaseUrl =
    process.env.E2E_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  try {
    return new URL(supabaseUrl).host === EXPECTED_E2E_SUPABASE_HOST;
  } catch {
    return false;
  }
}

function isAllowedE2eDbUrl(value: string): boolean {
  return value.toLowerCase().includes(EXPECTED_E2E_PROJECT_REF);
}

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}
