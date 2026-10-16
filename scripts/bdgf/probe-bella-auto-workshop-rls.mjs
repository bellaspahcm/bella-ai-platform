#!/usr/bin/env node
/**
 * Bella Auto workshop RLS post-deploy probe.
 *
 * This script verifies the target database after the approved BDGF migration
 * has run. It creates temporary fixture data inside one transaction, checks
 * anon denial and authenticated tenant isolation, and rolls everything back.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
dotenv.config();

const WORKSHOP_TABLES = [
  'auto_service_appointments',
  'auto_repair_orders'
];

function requireDatabaseUrl(env = process.env) {
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl || dbUrl.trim() === '') {
    throw new Error('DATABASE_URL is required for post-deploy Real DB probes');
  }
  return dbUrl.trim();
}

function uuid() {
  return crypto.randomUUID();
}

function randomSuffix() {
  return crypto.randomBytes(4).toString('hex');
}

function tenantClaims(userId, tenantId) {
  return JSON.stringify({
    sub: userId,
    role: 'authenticated',
    tenant_id: tenantId,
    app_metadata: {
      tenant_id: tenantId,
      role: 'authenticated'
    },
    user_metadata: {
      tenant_id: tenantId
    }
  });
}

function assertTableSecurity(table, row) {
  if (!row.exists) {
    throw new Error(`${table} does not exist on target database`);
  }

  if (!row.rls_enabled) {
    throw new Error(`${table} does not have RLS enabled`);
  }

  if (row.anon_select || row.anon_insert || row.anon_update || row.anon_delete) {
    throw new Error(`${table} grants anon table privileges`);
  }
}

async function loadTableSecurity(client) {
  const result = await client.query(
    `
      SELECT
        table_name,
        to_regclass(format('public.%I', table_name)) IS NOT NULL AS exists,
        COALESCE(c.relrowsecurity, false) AS rls_enabled,
        has_table_privilege('anon', format('public.%I', table_name), 'SELECT') AS anon_select,
        has_table_privilege('anon', format('public.%I', table_name), 'INSERT') AS anon_insert,
        has_table_privilege('anon', format('public.%I', table_name), 'UPDATE') AS anon_update,
        has_table_privilege('anon', format('public.%I', table_name), 'DELETE') AS anon_delete
      FROM unnest($1::text[]) AS table_name
      LEFT JOIN pg_class c ON c.oid = to_regclass(format('public.%I', table_name))
    `,
    [WORKSHOP_TABLES]
  );

  return result.rows;
}

async function seedFixture(client) {
  const suffix = randomSuffix();
  const tenantAId = uuid();
  const tenantBId = uuid();
  const userAId = uuid();
  const userBId = uuid();
  const customerAId = uuid();
  const customerBId = uuid();
  const brandAId = uuid();
  const brandBId = uuid();
  const modelAId = uuid();
  const modelBId = uuid();
  const variantAId = uuid();
  const variantBId = uuid();
  const vehicleAId = uuid();
  const vehicleBId = uuid();
  const appointmentAId = uuid();
  const appointmentBId = uuid();
  const repairOrderAId = uuid();
  const repairOrderBId = uuid();

  await client.query(
    `
      INSERT INTO public.tenants (id, name, status)
      VALUES
        ($1, $2, 'active'),
        ($3, $4, 'active')
    `,
    [tenantAId, `BDGF Workshop Probe Tenant A ${suffix}`, tenantBId, `BDGF Workshop Probe Tenant B ${suffix}`]
  );

  await client.query(
    `
      INSERT INTO public.users (id, email, full_name, role, status, tenant_id)
      VALUES
        ($1, $2, 'BDGF Probe User A', 'admin_staff', 'active', $3),
        ($4, $5, 'BDGF Probe User B', 'admin_staff', 'active', $6)
    `,
    [userAId, `bdgf-probe-a-${suffix}@example.invalid`, tenantAId, userBId, `bdgf-probe-b-${suffix}@example.invalid`, tenantBId]
  );

  await client.query(
    `
      INSERT INTO public.customers (id, tenant_id, phone, name_mother, status)
      VALUES
        ($1, $2, $3, 'BDGF Probe Customer A', 'active'),
        ($4, $5, $6, 'BDGF Probe Customer B', 'active')
    `,
    [customerAId, tenantAId, `090${suffix.slice(0, 7)}`, customerBId, tenantBId, `091${suffix.slice(0, 7)}`]
  );

  await client.query(
    `
      INSERT INTO public.auto_brands (id, tenant_id, name, country_of_origin)
      VALUES
        ($1, $2, $3, 'VN'),
        ($4, $5, $6, 'VN')
    `,
    [brandAId, tenantAId, `BDGF Brand A ${suffix}`, brandBId, tenantBId, `BDGF Brand B ${suffix}`]
  );

  await client.query(
    `
      INSERT INTO public.auto_models (id, tenant_id, brand_id, name, segment)
      VALUES
        ($1, $2, $3, $4, 'Probe'),
        ($5, $6, $7, $8, 'Probe')
    `,
    [modelAId, tenantAId, brandAId, `BDGF Model A ${suffix}`, modelBId, tenantBId, brandBId, `BDGF Model B ${suffix}`]
  );

  await client.query(
    `
      INSERT INTO public.auto_variants (id, tenant_id, model_id, name, year)
      VALUES
        ($1, $2, $3, $4, 2026),
        ($5, $6, $7, $8, 2026)
    `,
    [variantAId, tenantAId, modelAId, `BDGF Variant A ${suffix}`, variantBId, tenantBId, modelBId, `BDGF Variant B ${suffix}`]
  );

  await client.query(
    `
      INSERT INTO public.auto_vehicles (
        id, tenant_id, variant_id, vin, color_exterior, model_year, list_price, status
      )
      VALUES
        ($1, $2, $3, $4, 'White', 2026, 0, 'showroom'),
        ($5, $6, $7, $8, 'Black', 2026, 0, 'showroom')
    `,
    [
      vehicleAId,
      tenantAId,
      variantAId,
      `BDGFPROBEA${suffix.slice(0, 7)}`.slice(0, 17),
      vehicleBId,
      tenantBId,
      variantBId,
      `BDGFPROBEB${suffix.slice(0, 7)}`.slice(0, 17)
    ]
  );

  await client.query(
    `
      INSERT INTO public.auto_service_appointments (
        id,
        tenant_id,
        appointment_number,
        customer_id,
        vehicle_id,
        appointment_date,
        appointment_time,
        scheduled_date,
        service_type,
        requested_services,
        customer_name,
        customer_phone,
        vehicle_info,
        status
      )
      VALUES
        ($1, $2, $3, $4, $5, CURRENT_DATE, '09:00', now(), 'repair', 'BDGF probe A', 'BDGF Probe Customer A', '0900000000', 'BDGF Vehicle A', 'scheduled'),
        ($6, $7, $8, $9, $10, CURRENT_DATE, '10:00', now(), 'repair', 'BDGF probe B', 'BDGF Probe Customer B', '0910000000', 'BDGF Vehicle B', 'scheduled')
    `,
    [
      appointmentAId,
      tenantAId,
      `BDGF-APT-A-${suffix}`,
      customerAId,
      vehicleAId,
      appointmentBId,
      tenantBId,
      `BDGF-APT-B-${suffix}`,
      customerBId,
      vehicleBId
    ]
  );

  await client.query(
    `
      INSERT INTO public.auto_repair_orders (
        id,
        tenant_id,
        order_number,
        appointment_id,
        customer_id,
        vehicle_id,
        order_type,
        work_description,
        customer_name,
        customer_phone,
        vehicle_info,
        status
      )
      VALUES
        ($1, $2, $3, $4, $5, $6, 'repair', 'BDGF probe repair A', 'BDGF Probe Customer A', '0900000000', 'BDGF Vehicle A', 'open'),
        ($7, $8, $9, $10, $11, $12, 'repair', 'BDGF probe repair B', 'BDGF Probe Customer B', '0910000000', 'BDGF Vehicle B', 'open')
    `,
    [
      repairOrderAId,
      tenantAId,
      `BDGF-RO-A-${suffix}`,
      appointmentAId,
      customerAId,
      vehicleAId,
      repairOrderBId,
      tenantBId,
      `BDGF-RO-B-${suffix}`,
      appointmentBId,
      customerBId,
      vehicleBId
    ]
  );

  return {
    tenantAId,
    tenantBId,
    userAId,
    userBId,
    customerBId,
    vehicleBId,
    appointmentAId,
    appointmentBId,
    repairOrderAId,
    repairOrderBId,
    suffix
  };
}

async function withRoleProbe(client, { role, userId, tenantId }, fn) {
  const savepoint = `probe_${randomSuffix()}`;
  await client.query(`SAVEPOINT ${savepoint}`);

  try {
    await client.query(`SET LOCAL ROLE ${role}`);
    await client.query('SET LOCAL row_security = on');

    if (role === 'authenticated') {
      await client.query(
        `
          SELECT
            set_config('request.jwt.claim.sub', $1, true),
            set_config('request.jwt.claim.role', 'authenticated', true),
            set_config('request.jwt.claim.tenant_id', $2, true),
            set_config('request.jwt.claims', $3, true),
            set_config('app.current_tenant_id', $2, true)
        `,
        [userId, tenantId, tenantClaims(userId, tenantId)]
      );
    }

    const result = await fn();
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return result;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`).catch(() => {});
    throw error;
  }
}

async function expectRejected(client, label, fn) {
  try {
    await fn();
  } catch (error) {
    return {
      label,
      pass: true,
      error: error.message,
      code: error.code || null
    };
  }

  throw new Error(`${label} unexpectedly succeeded`);
}

async function expectSelectOne(client, label, table, id) {
  const result = await client.query(`SELECT id FROM public.${table} WHERE id = $1`, [id]);
  if (result.rowCount !== 1) {
    throw new Error(`${label} expected 1 visible row, got ${result.rowCount}`);
  }
  return { label, pass: true, rows: result.rowCount };
}

async function expectSelectNone(client, label, table, id) {
  const result = await client.query(`SELECT id FROM public.${table} WHERE id = $1`, [id]);
  if (result.rowCount !== 0) {
    throw new Error(`${label} expected 0 visible rows, got ${result.rowCount}`);
  }
  return { label, pass: true, rows: result.rowCount };
}

async function expectNoWrite(client, label, sql, params) {
  let result;
  try {
    result = await client.query(sql, params);
  } catch (error) {
    return {
      label,
      pass: true,
      error: error.message,
      code: error.code || null
    };
  }

  if (result.rowCount > 0) {
    throw new Error(`${label} modified ${result.rowCount} row(s)`);
  }

  return { label, pass: true, rows: result.rowCount };
}

async function probeWorkshopSecurity(client, fixture) {
  const evidence = [];

  for (const table of WORKSHOP_TABLES) {
    evidence.push(await withRoleProbe(client, { role: 'anon' }, () =>
      expectRejected(client, `anon SELECT denied on ${table}`, () =>
        client.query(`SELECT id FROM public.${table} LIMIT 1`)
      )
    ));
  }

  evidence.push(await withRoleProbe(client, {
    role: 'authenticated',
    userId: fixture.userAId,
    tenantId: fixture.tenantAId
  }, async () => {
    const checks = [];
    checks.push(await expectSelectOne(client, 'tenant A reads own appointment', 'auto_service_appointments', fixture.appointmentAId));
    checks.push(await expectSelectOne(client, 'tenant A reads own repair order', 'auto_repair_orders', fixture.repairOrderAId));
    checks.push(await expectSelectNone(client, 'tenant A cannot read tenant B appointment', 'auto_service_appointments', fixture.appointmentBId));
    checks.push(await expectSelectNone(client, 'tenant A cannot read tenant B repair order', 'auto_repair_orders', fixture.repairOrderBId));
    checks.push(await expectNoWrite(
      client,
      'tenant A cannot update tenant B appointment',
      'UPDATE public.auto_service_appointments SET internal_notes = $1 WHERE id = $2',
      ['bdgf-cross-tenant-update-blocked', fixture.appointmentBId]
    ));
    checks.push(await expectNoWrite(
      client,
      'tenant A cannot update tenant B repair order',
      'UPDATE public.auto_repair_orders SET internal_notes = $1 WHERE id = $2',
      ['bdgf-cross-tenant-update-blocked', fixture.repairOrderBId]
    ));
    checks.push(await expectNoWrite(
      client,
      'tenant A cannot insert tenant B appointment',
      `
        INSERT INTO public.auto_service_appointments (
          tenant_id, appointment_number, customer_id, vehicle_id, appointment_date,
          appointment_time, scheduled_date, service_type, requested_services,
          customer_name, vehicle_info
        )
        VALUES ($1, $2, $3, $4, CURRENT_DATE, '11:00', now(), 'repair', 'blocked cross tenant insert', 'Blocked Customer', 'Blocked Vehicle')
      `,
      [fixture.tenantBId, `BDGF-BLOCK-APT-${fixture.suffix}`, fixture.customerBId, fixture.vehicleBId]
    ));
    checks.push(await expectNoWrite(
      client,
      'tenant A cannot insert tenant B repair order',
      `
        INSERT INTO public.auto_repair_orders (
          tenant_id, order_number, customer_id, vehicle_id, order_type,
          work_description, customer_name, vehicle_info
        )
        VALUES ($1, $2, $3, $4, 'repair', 'blocked cross tenant insert', 'Blocked Customer', 'Blocked Vehicle')
      `,
      [fixture.tenantBId, `BDGF-BLOCK-RO-${fixture.suffix}`, fixture.customerBId, fixture.vehicleBId]
    ));
    return { label: 'tenant A authenticated isolation', pass: true, checks };
  }));

  evidence.push(await withRoleProbe(client, {
    role: 'authenticated',
    userId: fixture.userBId,
    tenantId: fixture.tenantBId
  }, async () => {
    const checks = [];
    checks.push(await expectSelectOne(client, 'tenant B reads own appointment', 'auto_service_appointments', fixture.appointmentBId));
    checks.push(await expectSelectOne(client, 'tenant B reads own repair order', 'auto_repair_orders', fixture.repairOrderBId));
    checks.push(await expectSelectNone(client, 'tenant B cannot read tenant A appointment', 'auto_service_appointments', fixture.appointmentAId));
    checks.push(await expectSelectNone(client, 'tenant B cannot read tenant A repair order', 'auto_repair_orders', fixture.repairOrderAId));
    checks.push(await expectNoWrite(
      client,
      'tenant B cannot update tenant A appointment',
      'UPDATE public.auto_service_appointments SET internal_notes = $1 WHERE id = $2',
      ['bdgf-cross-tenant-update-blocked', fixture.appointmentAId]
    ));
    checks.push(await expectNoWrite(
      client,
      'tenant B cannot update tenant A repair order',
      'UPDATE public.auto_repair_orders SET internal_notes = $1 WHERE id = $2',
      ['bdgf-cross-tenant-update-blocked', fixture.repairOrderAId]
    ));
    return { label: 'tenant B authenticated isolation', pass: true, checks };
  }));

  return evidence;
}

async function main() {
  const dbUrl = requireDatabaseUrl();
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  await client.query('BEGIN');

  try {
    const securityRows = await loadTableSecurity(client);
    for (const row of securityRows) {
      assertTableSecurity(row.table_name, row);
    }

    const fixture = await seedFixture(client);
    const probeEvidence = await probeWorkshopSecurity(client, fixture);

    console.log('Bella Auto workshop RLS post-deploy probe passed');
    console.log(JSON.stringify({
      tables: securityRows.map(row => ({
        table: row.table_name,
        rls_enabled: row.rls_enabled,
        anon_select: row.anon_select,
        anon_insert: row.anon_insert,
        anon_update: row.anon_update,
        anon_delete: row.anon_delete
      })),
      probes: probeEvidence
    }, null, 2));
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`Bella Auto workshop RLS probe failed: ${error.message}`);
    process.exit(1);
  });
}

export {
  WORKSHOP_TABLES,
  assertTableSecurity,
  expectNoWrite,
  requireDatabaseUrl,
  tenantClaims
};
