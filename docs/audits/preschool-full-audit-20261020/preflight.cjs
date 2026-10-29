const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const out = __dirname;
const files = ['.env', '.env.local', '.env.e2e', '.env.test', '.env.production', '.env.production.local'];
const envs = Object.fromEntries(files.filter(f => fs.existsSync(f)).map(f => [f, dotenv.parse(fs.readFileSync(f))]));
function urlInfo(value) {
  if (!value) return { present: false };
  try { const u = new URL(value); return { present: true, valid: true, local: ['localhost', '127.0.0.1', '::1'].includes(u.hostname), port: u.port || 'default' }; }
  catch { return { present: true, valid: false }; }
}
function project(e) { return e.NEXT_PUBLIC_SUPABASE_URL || e.SUPABASE_URL || ''; }
const production = Object.entries(envs).filter(([f]) => f.startsWith('.env.production')).map(([, e]) => project(e)).filter(Boolean);
function save(name, data) { fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n'); }
async function main() {
  const targets = Object.entries(envs).map(([f, e]) => ({ file: f, publicApi: urlInfo(project(e)), database: urlInfo(e.DATABASE_URL || e.SUPABASE_DATABASE_URL || e.SUPABASE_DB_URL), matchesConfiguredProductionApi: production.includes(project(e)), adminKeyPresent: Boolean(e.SUPABASE_SECRET_KEY || e.SUPABASE_SERVICE_ROLE_KEY), publicKeyPresent: Boolean(e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || e.NEXT_PUBLIC_SUPABASE_ANON_KEY) }));
  save('environment.json', { checkedAt: new Date().toISOString(), targets, fixtureWrites: 'HELD: no isolated non-production target established' });
  console.log(JSON.stringify({ targets }));
  const dbCandidate = Object.entries(envs).find(([,e]) => { const u = e.DATABASE_URL || e.SUPABASE_DATABASE_URL || e.SUPABASE_DB_URL; return urlInfo(u).valid; });
  if (!dbCandidate) { save('database.json', { result: 'BLOCKED', obstacle: 'No valid configured Postgres URL' }); return; }
  const [file, e] = dbCandidate;
  const connectionString = e.DATABASE_URL || e.SUPABASE_DATABASE_URL || e.SUPABASE_DB_URL;
  const client = new Client({ connectionString, connectionTimeoutMillis: 12000, statement_timeout: 15000, ssl: urlInfo(connectionString).local ? false : { rejectUnauthorized: false }, options: '-c default_transaction_read_only=on' });
  let connected = false;
  try {
    await client.connect(); connected = true;
    await client.query('BEGIN READ ONLY');
    const tx = (await client.query('SHOW transaction_read_only')).rows;
    const tables = (await client.query("SELECT c.relname AS table_name, c.relkind, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (c.relname LIKE 'edu_%' OR c.relname IN ('students','courses','party_parties','party_roles','users','people_directory','user_org_unit_access','org_units','org_relationships','accounting_outbox')) AND c.relkind IN ('r','p','v') ORDER BY c.relname")).rows;
    const policies = (await client.query("SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND (tablename LIKE 'edu_%' OR tablename IN ('students','courses','party_parties','party_roles','users','people_directory','user_org_unit_access','org_units','org_relationships','accounting_outbox')) ORDER BY tablename, policyname")).rows;
    const grants = (await client.query("SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated') AND (table_name LIKE 'edu_%' OR table_name IN ('students','courses','party_parties','party_roles','users','user_org_unit_access','org_units','org_relationships')) ORDER BY table_name,grantee,privilege_type")).rows;
    const routines = (await client.query("SELECT p.proname, p.prosecdef AS security_definer, pg_get_function_identity_arguments(p.oid) AS arguments FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname ILIKE '%preschool%' OR p.proname ILIKE '%education%' OR p.proname ILIKE '%edu_%' OR p.proname IN ('get_current_tenant_id','get_my_tenant_id','get_accessible_org_units','get_user_tenant_id')) ORDER BY p.proname")).rows;
    const tenantCounts = (await client.query("SELECT product_key, count(*)::int AS tenant_count FROM public.tenants WHERE product_key IN ('bella_preschool','bella_education') OR enabled_modules::text LIKE '%bella_education%' GROUP BY product_key ORDER BY product_key")).rows;
    await client.query('ROLLBACK');
    const result = { checkedAt: new Date().toISOString(), result: 'PASS_READ_ONLY_CATALOG_INSPECTION', envFile: file, transaction: tx, tables, policies, grants, routines, tenantCounts, caveat: 'Privileged catalog inspection is not authenticated RLS or RBAC execution proof' };
    save('database.json', result);
    console.log(JSON.stringify({ database: result.result, tables: tables.length, tablesWithoutRls: tables.filter(t => t.relkind !== 'v' && !t.rls_enabled).map(t => t.table_name), policies: policies.length, grants: grants.length, tenantCounts }));
  } catch (error) { const result = { result: 'BLOCKED', envFile: file, obstacle: 'Postgres connection/catalog inspection failed', errorCode: error.code || error.name }; save('database.json', result); console.log(JSON.stringify(result)); }
  finally { if (connected) await client.query('ROLLBACK').catch(() => {}); await client.end().catch(() => {}); }
}
main().catch(error => { console.error(error.name); process.exitCode = 1; });
