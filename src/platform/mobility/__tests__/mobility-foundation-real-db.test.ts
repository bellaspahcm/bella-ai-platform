import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import { parse as parseEnv } from 'dotenv';
import { Client, type QueryResultRow } from 'pg';

import {
  MobilityFoundationService,
  PostgresMobilityRepository,
  StaticMobilityAuthorization,
  type MobilityActor,
  type MobilityIdFactory,
  type MobilityPermission,
  type MobilitySqlClient,
} from '..';

const EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const EXPECTED_E2E_SUPABASE_HOST = `${EXPECTED_E2E_PROJECT_REF}.supabase.co`;

loadMobilityE2eEnv();

const dbUrl =
  process.env.DATABASE_EXECUTOR_URL_TEST ||
  process.env.E2E_SUPABASE_DB_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  '';

const autoFoundationSql = readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260803200800_create_bella_auto_foundation.sql'),
  'utf8'
);
const autoVehiclesSql = readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260803210000_create_auto_vehicles.sql'),
  'utf8'
);
const autoCustomerExtensionSql = readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260803220000_create_auto_customer_extension.sql'),
  'utf8'
);
const autoServiceCenterSql = readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20260803260000_bella_auto_phase6_service_center.sql'),
  'utf8'
);
const mobilitySql = readFileSync(
  path.resolve(__dirname, '../../../../supabase/migrations/20261013120000_create_mobility_os_foundation_contract.sql'),
  'utf8'
);

const describeWithRealDb =
  isRunnableDbUrl(dbUrl) && isAllowedE2eProject() && isAllowedE2eDbUrl(dbUrl) ? describe : describe.skip;

class RandomUuidMobilityIdFactory implements MobilityIdFactory {
  next(): string {
    return randomUUID();
  }
}

class IncrementingMobilityClock {
  private nextOffsetMs = 0;

  constructor(private readonly startTimestamp: string) {}

  now(): string {
    const timestamp = new Date(new Date(this.startTimestamp).getTime() + this.nextOffsetMs).toISOString();
    this.nextOffsetMs += 1000;
    return timestamp;
  }
}

class AuthenticatedMobilitySqlClient implements MobilitySqlClient {
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
            set_config('request.jwt.claim.sub', $1, TRUE),
            set_config('request.jwt.claim.role', 'authenticated', TRUE)
        `,
        [this.context.userId]
      );
      return { rows: [] };
    }

    const result = await this.client.query<Row>(sql, values ? [...values] : undefined);
    return { rows: result.rows };
  }
}

type CountRow = QueryResultRow & { count: string };
type PolicyRow = QueryResultRow & { tablename: string; policyname: string };

describeWithRealDb('Mobility OS Foundation real DB and RLS verification', () => {
  jest.setTimeout(120_000);

  const marker = `mobility-foundation-${Date.now()}`;
  const ids = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    personA: randomUUID(),
    personB: randomUUID(),
    orgA: randomUUID(),
    orgB: randomUUID(),
    brandA: randomUUID(),
    brandB: randomUUID(),
    modelA: randomUUID(),
    modelB: randomUUID(),
    variantA: randomUUID(),
    variantB: randomUUID(),
  };

  const allPermissions: MobilityPermission[] = [
    'mobility:foundation:read',
    'mobility:vehicle:write',
    'mobility:ownership:write',
  ];

  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await admin.connect();
    await admin.query(autoFoundationSql);
    await admin.query(autoVehiclesSql);
    await applyMigrationIfTableMissing('auto_vehicle_owners', autoCustomerExtensionSql);
    await applyMigrationIfTableMissing('auto_service_history', autoServiceCenterSql);
    await admin.query(mobilitySql);
    await seedTenant(ids.tenantA, `${marker} Tenant A`);
    await seedTenant(ids.tenantB, `${marker} Tenant B`);
    await seedUser(ids.tenantA, ids.userA, ids.personA, ids.orgA, 'a');
    await seedUser(ids.tenantB, ids.userB, ids.personB, ids.orgB, 'b');
    await seedCatalog(ids.tenantA, ids.brandA, ids.modelA, ids.variantA, 'a');
    await seedCatalog(ids.tenantB, ids.brandB, ids.modelB, ids.variantB, 'b');
  });

  afterAll(async () => {
    if (!admin) return;
    try {
      await cleanupFixtures().catch(() => undefined);
      await admin.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB]]);
    } finally {
      await admin.end().catch(() => undefined);
    }
  });

  it('applies Mobility control schema and RLS policies without replacing auto_* schema', async () => {
    const tables = [
      'mobility_domain_events',
      'mobility_command_idempotency',
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
          AND tablename LIKE 'mobility_%'
      `
    );
    expect(policies.rows.map((row) => row.policyname)).toEqual(
      expect.arrayContaining([
        'mobility_domain_events_tenant_access',
        'mobility_command_idempotency_tenant_access',
      ])
    );

    const anonGrants = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM information_schema.role_table_grants
        WHERE grantee = 'anon'
          AND table_schema = 'public'
          AND table_name = ANY($1::text[])
      `,
      [tables]
    );
    expect(Number(anonGrants.rows[0].count)).toBe(0);
  });

  it('persists Mobility workflow and denies cross-tenant RLS read-back', async () => {
    const clientA = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    const clientB = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await clientA.connect();
    await clientB.connect();
    try {
      const actorA = createActor(ids.tenantA, ids.userA, ids.orgA);
      const serviceA = createService(clientA, actorA);
      const vehicle = (await serviceA.registerVehicle(actorA, {
        idempotencyKey: 'register-real-db',
        variantId: ids.variantA,
        vin: '1HGCM82633A004358',
        colorExterior: 'Pearl White',
        modelYear: 2026,
      })).value;

      const duplicate = await serviceA.registerVehicle(actorA, {
        idempotencyKey: 'register-real-db',
        variantId: ids.variantA,
        vin: '1HGCM82633A004358',
        colorExterior: 'Pearl White',
        modelYear: 2026,
      });
      expect(duplicate.isDuplicate).toBe(true);
      expect(duplicate.value.id).toBe(vehicle.id);

      await serviceA.transitionVehicleStatus(actorA, {
        idempotencyKey: 'warehouse-real-db',
        vehicleId: vehicle.id,
        toStatus: 'warehouse',
      });

      const trace = await serviceA.getVehicleTrace(actorA, { vehicleId: vehicle.id });
      expect(trace.lifecycleEvents.map((event) => event.toStatus)).toEqual(['in_transit', 'warehouse']);
      expect(trace.domainEvents.map((event) => event.eventType)).toEqual([
        'vehicle.registered',
        'vehicle.status_changed',
      ]);

      const tenantBRepository = new PostgresMobilityRepository(
        new AuthenticatedMobilitySqlClient(clientB, { tenantId: ids.tenantB, userId: ids.userB })
      );
      const tenantBReadBack = await tenantBRepository.withTransaction((repository) =>
        repository.getVehicle(ids.tenantA, vehicle.id)
      );
      const tenantBDomainEvents = await tenantBRepository.withTransaction((repository) =>
        repository.listDomainEvents({ tenantId: ids.tenantA, entityId: vehicle.id })
      );
      const noTenantContextEventCount = await countDomainEventsWithoutTenantContext(ids.tenantA, vehicle.id);

      expect(tenantBReadBack).toBeNull();
      expect(tenantBDomainEvents).toHaveLength(0);
      expect(noTenantContextEventCount).toBe(0);
    } finally {
      await clientA.end();
      await clientB.end();
    }
  });

  function createService(client: Client, actor: MobilityActor): MobilityFoundationService {
    return new MobilityFoundationService(
      new PostgresMobilityRepository(
        new AuthenticatedMobilitySqlClient(client, { tenantId: actor.tenantId, userId: actor.userId })
      ),
      new StaticMobilityAuthorization(
        {
          [ids.userA]: ids.tenantA,
          [ids.userB]: ids.tenantB,
        },
        {
          [ids.userA]: allPermissions,
          [ids.userB]: allPermissions,
        }
      ),
      new RandomUuidMobilityIdFactory(),
      new IncrementingMobilityClock('2026-10-13T03:00:00.000Z')
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

  async function applyMigrationIfTableMissing(tableName: string, sql: string): Promise<void> {
    const result = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      `,
      [tableName]
    );
    if (Number(result.rows[0].count) === 0) {
      await admin.query(sql);
    }
  }

  async function countDomainEventsWithoutTenantContext(
    tenantId: string,
    entityId: string
  ): Promise<number> {
    const client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query('SET LOCAL row_security = on');
      const result = await client.query<CountRow>(
        `
          SELECT COUNT(*)::text AS count
          FROM public.mobility_domain_events
          WHERE tenant_id = $1::uuid
            AND entity_id = $2::uuid
        `,
        [tenantId, entityId]
      );
      await client.query('ROLLBACK');
      return Number(result.rows[0].count);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await client.end();
    }
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
        VALUES ($1::uuid, $2::uuid, 'branch', $3, $4, TRUE, '{"proof":"mobility-foundation"}'::jsonb)
      `,
      [orgUnitId, tenantId, `${marker}-${label}-org`, `${marker}-${label}-org`]
    );
    await admin.query(
      `
        INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'employee', $4, TRUE, '{"proof":"mobility-foundation"}'::jsonb)
      `,
      [personId, tenantId, userId, `${marker} person ${label}`]
    );
    await admin.query(
      `
        INSERT INTO public.org_relationships (
          tenant_id, from_id, from_type, to_id, to_type, rel_type, role, since, metadata
        )
        VALUES ($1::uuid, $2::uuid, 'person', $3::uuid, 'unit', 'belongs_to', 'operator', CURRENT_DATE, '{"proof":"mobility-foundation"}'::jsonb)
      `,
      [tenantId, personId, orgUnitId]
    );
  }

  async function seedCatalog(
    tenantId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    label: string
  ): Promise<void> {
    await admin.query(
      `
        INSERT INTO public.auto_brands (id, tenant_id, name, country_of_origin)
        VALUES ($1::uuid, $2::uuid, $3, 'VN')
        ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at = timezone('utc'::text, now())
      `,
      [brandId, tenantId, `${marker}-brand-${label}`]
    );
    await admin.query(
      `
        INSERT INTO public.auto_models (id, tenant_id, brand_id, name, segment)
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'SUV')
        ON CONFLICT (tenant_id, brand_id, name) DO UPDATE SET updated_at = timezone('utc'::text, now())
      `,
      [modelId, tenantId, brandId, `${marker}-model-${label}`]
    );
    await admin.query(
      `
        INSERT INTO public.auto_variants (id, tenant_id, model_id, name, year, fuel_type, transmission)
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 2026, 'Hybrid', 'Automatic')
        ON CONFLICT (tenant_id, model_id, name, year) DO UPDATE SET updated_at = timezone('utc'::text, now())
      `,
      [variantId, tenantId, modelId, `${marker}-variant-${label}`]
    );
  }

  function createActor(tenantId: string, userId: string, orgUnitId: string): MobilityActor {
    return {
      tenantId,
      userId,
      orgUnitId,
      roles: ['mobility_operator'],
    };
  }

  async function cleanupFixtures(): Promise<void> {
    await admin.query('SET row_security = off');
    await admin.query('DELETE FROM public.mobility_command_idempotency WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.mobility_domain_events WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.auto_vehicle_status_logs WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.auto_vehicles WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.auto_variants WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.auto_models WHERE tenant_id = ANY($1::uuid[])', [
      [ids.tenantA, ids.tenantB],
    ]);
    await admin.query('DELETE FROM public.auto_brands WHERE tenant_id = ANY($1::uuid[])', [
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

function loadMobilityE2eEnv(): void {
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
