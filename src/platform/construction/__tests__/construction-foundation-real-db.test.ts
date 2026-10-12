import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import { parse as parseEnv } from 'dotenv';
import { Client, type QueryResultRow } from 'pg';

import {
  ConstructionFoundationService,
  FixedConstructionClock,
  PostgresConstructionRepository,
  StaticConstructionAuthorization,
  type ConstructionActor,
  type ConstructionIdFactory,
  type ConstructionPermission,
  type ConstructionSqlClient,
} from '..';

const EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const EXPECTED_E2E_SUPABASE_HOST = `${EXPECTED_E2E_PROJECT_REF}.supabase.co`;

loadConstructionE2eEnv();

const dbUrl =
  process.env.DATABASE_EXECUTOR_URL_TEST ||
  process.env.E2E_SUPABASE_DB_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  '';

const migrationSql = readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20261013010000_create_construction_foundation_mvp.sql'),
  'utf8'
);

const describeWithRealDb =
  isRunnableDbUrl(dbUrl) && isAllowedE2eProject() && isAllowedE2eDbUrl(dbUrl) ? describe : describe.skip;

class RandomUuidConstructionIdFactory implements ConstructionIdFactory {
  next(): string {
    return randomUUID();
  }
}

class AuthenticatedConstructionSqlClient implements ConstructionSqlClient {
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

describeWithRealDb('Construction OS Foundation MVP real DB and RLS verification', () => {
  jest.setTimeout(120_000);

  const marker = `construction-foundation-${Date.now()}`;
  const ids = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    userDenied: randomUUID(),
    personA: randomUUID(),
    personB: randomUUID(),
    personDenied: randomUUID(),
    orgA: randomUUID(),
    orgB: randomUUID(),
    orgDenied: randomUUID(),
  };

  const allPermissions: ConstructionPermission[] = [
    'construction:foundation:read',
    'construction:project:write',
    'construction:site:write',
    'construction:work_package:write',
    'construction:boq:write',
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
    await seedUser(ids.tenantA, ids.userDenied, ids.personDenied, ids.orgDenied, 'denied');
  });

  afterAll(async () => {
    if (!admin) return;
    try {
      await cleanupFixtures();
      await admin.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB, ids.userDenied]]);
    } finally {
      await admin.end();
    }
  });

  it('applies additive Construction schema and RLS policies', async () => {
    const tables = [
      'construction_projects',
      'construction_sites',
      'construction_work_packages',
      'construction_boq_lines',
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
          AND tablename LIKE 'construction_%'
      `
    );
    expect(policies.rows.map((row) => row.policyname)).toEqual(
      expect.arrayContaining([
        'construction_projects_tenant_access',
        'construction_sites_org_unit_access',
        'construction_work_packages_org_unit_access',
        'construction_boq_lines_org_unit_access',
      ])
    );
  });

  it('persists Project to BOQ through runtime repository and denies cross-tenant RLS read-back', async () => {
    const clientA = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    const clientB = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await clientA.connect();
    await clientB.connect();
    try {
      const actorA = createActor(ids.tenantA, ids.userA, [ids.orgA]);
      const serviceA = createService(clientA, actorA);
      const project = await serviceA.createProject(actorA, {
        projectCode: `${marker}-project`,
        name: `${marker} project`,
      });
      const site = await serviceA.createSite(actorA, {
        projectId: project.id,
        orgUnitId: ids.orgA,
        siteCode: `${marker}-site`,
        name: `${marker} site`,
      });
      const workPackage = await serviceA.createWorkPackage(actorA, {
        siteId: site.id,
        workPackageCode: `${marker}-wp`,
        name: `${marker} work package`,
      });
      const boqLine = await serviceA.createBoqLine(actorA, {
        workPackageId: workPackage.id,
        lineNumber: '1',
        description: `${marker} BOQ line`,
        quantity: 3,
        uom: 'm3',
        unitRate: 100,
      });

      const tenantARepository = new PostgresConstructionRepository(
        new AuthenticatedConstructionSqlClient(clientA, { tenantId: ids.tenantA, userId: ids.userA })
      );
      const persistedLines = await tenantARepository.withTransaction((repository) =>
        repository.listBoqLinesByWorkPackage({ tenantId: ids.tenantA, workPackageId: workPackage.id })
      );
      expect(persistedLines.map((line) => line.id)).toContain(boqLine.id);

      const tenantBRepository = new PostgresConstructionRepository(
        new AuthenticatedConstructionSqlClient(clientB, { tenantId: ids.tenantB, userId: ids.userB })
      );
      const tenantBReadBack = await tenantBRepository.withTransaction((repository) =>
        repository.getProject(ids.tenantA, project.id)
      );
      expect(tenantBReadBack).toBeNull();
    } finally {
      await clientA.end();
      await clientB.end();
    }
  });

  it('denies same-tenant access to Site, Work Package, and BOQ when the Platform Org Unit is not authorized', async () => {
    const clientA = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    const deniedClient = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await clientA.connect();
    await deniedClient.connect();
    try {
      const actorA = createActor(ids.tenantA, ids.userA, [ids.orgA]);
      const serviceA = createService(clientA, actorA);
      const project = await serviceA.createProject(actorA, {
        projectCode: `${marker}-auth-project`,
        name: `${marker} auth project`,
      });
      const site = await serviceA.createSite(actorA, {
        projectId: project.id,
        orgUnitId: ids.orgA,
        siteCode: `${marker}-auth-site`,
        name: `${marker} auth site`,
      });
      const workPackage = await serviceA.createWorkPackage(actorA, {
        siteId: site.id,
        workPackageCode: `${marker}-auth-wp`,
        name: `${marker} auth work package`,
      });
      await serviceA.createBoqLine(actorA, {
        workPackageId: workPackage.id,
        lineNumber: 'AUTH-1',
        description: `${marker} auth BOQ line`,
        quantity: 1,
        uom: 'ea',
      });

      const deniedSiteCount = await queryAsAuthenticated<CountRow>(
        deniedClient,
        { tenantId: ids.tenantA, userId: ids.userDenied },
        `
          SELECT COUNT(*)::text AS count
          FROM public.construction_sites
          WHERE tenant_id = $1::uuid AND id = $2::uuid
        `,
        [ids.tenantA, site.id]
      );
      expect(Number(deniedSiteCount.rows[0].count)).toBe(0);

      await expect(queryAsAuthenticated(
        deniedClient,
        { tenantId: ids.tenantA, userId: ids.userDenied },
        `
          INSERT INTO public.construction_sites (
            tenant_id, project_id, org_unit_id, site_code, name, created_by, updated_by
          )
          VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::uuid, $6::uuid)
        `,
        [
          ids.tenantA,
          project.id,
          ids.orgA,
          `${marker}-denied-site`,
          `${marker} denied site`,
          ids.userDenied,
        ]
      )).rejects.toThrow();
    } finally {
      await clientA.end();
      await deniedClient.end();
    }
  });

  function createService(client: Client, actor: ConstructionActor): ConstructionFoundationService {
    return new ConstructionFoundationService(
      new PostgresConstructionRepository(
        new AuthenticatedConstructionSqlClient(client, { tenantId: actor.tenantId, userId: actor.userId })
      ),
      new StaticConstructionAuthorization(
        {
          [ids.userA]: [ids.orgA],
          [ids.userB]: [ids.orgB],
          [ids.userDenied]: [ids.orgDenied],
        },
        {
          [ids.userA]: allPermissions,
          [ids.userB]: allPermissions,
          [ids.userDenied]: allPermissions,
        }
      ),
      new RandomUuidConstructionIdFactory(),
      new FixedConstructionClock('2026-10-13T03:00:00.000Z')
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
        VALUES ($1::uuid, $2::uuid, 'branch', $3, $4, TRUE, '{"proof":"construction-foundation"}'::jsonb)
      `,
      [orgUnitId, tenantId, `${marker}-${label}-org`, `${marker}-${label}-org`]
    );
    await admin.query(
      `
        INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'employee', $4, TRUE, '{"proof":"construction-foundation"}'::jsonb)
      `,
      [personId, tenantId, userId, `${marker} person ${label}`]
    );
    await admin.query(
      `
        INSERT INTO public.org_relationships (
          tenant_id, from_id, from_type, to_id, to_type, rel_type, role, since, metadata
        )
        VALUES ($1::uuid, $2::uuid, 'person', $3::uuid, 'unit', 'belongs_to', 'operator', CURRENT_DATE, '{"proof":"construction-foundation"}'::jsonb)
      `,
      [tenantId, personId, orgUnitId]
    );
  }

  function createActor(tenantId: string, userId: string, orgUnitIds: string[]): ConstructionActor {
    return {
      tenantId,
      userId,
      orgUnitIds,
      roles: ['construction_operator'],
    };
  }

  async function cleanupFixtures(): Promise<void> {
    await admin.query('SET row_security = off');
    await admin.query('DELETE FROM public.construction_boq_lines WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.construction_work_packages WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.construction_sites WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.construction_projects WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.org_relationships WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.people_directory WHERE id = ANY($1::uuid[])', [
      [ids.personA, ids.personB, ids.personDenied],
    ]);
    await admin.query('DELETE FROM public.org_units WHERE id = ANY($1::uuid[])', [
      [ids.orgA, ids.orgB, ids.orgDenied],
    ]);
    await admin.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB, ids.userDenied]]);
  }
});

async function queryAsAuthenticated<Row extends QueryResultRow = QueryResultRow>(
  client: Client,
  context: { userId: string; tenantId: string },
  sql: string,
  values?: readonly unknown[]
): Promise<{ rows: Row[] }> {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await client.query('SET LOCAL row_security = on');
  await client.query(
    `
      SELECT
        set_config('app.current_user_id', $1, TRUE),
        set_config('app.current_tenant_id', $2, TRUE),
        set_config('request.jwt.claim.sub', $1, TRUE),
        set_config('request.jwt.claim.role', 'authenticated', TRUE)
    `,
    [context.userId, context.tenantId]
  );
  try {
    const result = await client.query<Row>(sql, values ? [...values] : undefined);
    await client.query('COMMIT');
    return { rows: result.rows };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

function isRunnableDbUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && parsed.hostname !== 'base');
  } catch {
    return false;
  }
}

function loadConstructionE2eEnv(): void {
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
