#!/usr/bin/env node
import pkg from 'pg';
const { Client } = pkg;

const postgresUrl = process.env.DATABASE_ADMIN_URL;
if (!postgresUrl) {
  throw new Error('DATABASE_ADMIN_URL must be configured through an approved secret manager.');
}

const c = new Client({connectionString: postgresUrl});
await c.connect();

console.log('Applying BYPASSRLS to bella_migration_executor...\n');

try {
  await c.query("ALTER ROLE bella_migration_executor WITH BYPASSRLS");
  console.log('✅ BYPASSRLS granted');
  
  const check = await c.query("SELECT rolbypassrls FROM pg_roles WHERE rolname = 'bella_migration_executor'");
  console.log('Verified:', check.rows[0].rolbypassrls ? '✅ Has BYPASSRLS' : '❌ No BYPASSRLS');
  
  await c.query(`
    INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
    VALUES('20260820130000', 'grant_executor_rls_bypass', ARRAY['ALTER ROLE bella_migration_executor WITH BYPASSRLS'])
    ON CONFLICT (version) DO NOTHING
  `);
  console.log('✅ Migration recorded\n');
} catch (err) {
  console.error('❌ Error:', err.message);
}

await c.end();
