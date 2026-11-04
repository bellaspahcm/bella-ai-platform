'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = 'D:/CodexWorktrees/preschool-sealed-release-20261102/BELLA SPA ERP';
const { Client } = require(path.join(root, 'node_modules/pg'));
const { applyHealthOnly } = require(path.join(root, 'scripts/apply-platform-health-probe-only.cjs'));
const bytes = execFileSync('git', ['show', 'HEAD:supabase/migrations/20261029090000_platform_health_rest_database_probe.sql'], { cwd: root });
const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local port');
const make = database => new Client({ host: '127.0.0.1', port, database, user: 'postgres', ssl: false });
const setup = async client => client.query(`CREATE SCHEMA supabase_migrations;
 CREATE TABLE supabase_migrations.schema_migrations(version text primary key, name text, statements text[], created_by text);
 INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES ('legacy-remote','untouched');`);

(async () => {
  const a = make('executor_ok'), b = make('executor_ok'), fail = make('executor_fail'), acl = make('executor_acl'), identity = make('executor_identity'), inherit = make('executor_inherit');
  await Promise.all([a.connect(), b.connect(), fail.connect(), acl.connect(), identity.connect(), inherit.connect()]);
  try {
    await setup(a);
    const results = await Promise.allSettled([applyHealthOnly(a, bytes), applyHealthOnly(b, bytes)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const denied = results.find(r => r.status === 'rejected');
    assert.match(denied.reason.message, /already exists/);
    const result = await a.query("SELECT version FROM supabase_migrations.schema_migrations ORDER BY version");
    assert.deepEqual(result.rows.map(r => r.version), ['20261029090000', 'legacy-remote']);
    const success = await a.query('SET ROLE anon; SELECT public.platform_health_database_probe() AS result; RESET ROLE;');
    assert.equal(success[1].rows[0].result, true);

    await setup(fail);
    await fail.query(`CREATE FUNCTION public.reject_health_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.version='20261029090000' THEN RAISE EXCEPTION 'injected ledger failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_health BEFORE INSERT ON supabase_migrations.schema_migrations
      FOR EACH ROW EXECUTE FUNCTION public.reject_health_ledger();`);
    await assert.rejects(applyHealthOnly(fail, bytes), /injected ledger failure/);
    const rolledBack = await fail.query("SELECT to_regprocedure('public.platform_health_database_probe()') IS NULL AS absent, (SELECT count(*)::integer FROM supabase_migrations.schema_migrations) AS entries");
    assert.deepEqual(rolledBack.rows[0], { absent: true, entries: 1 });

    await a.query('CREATE ROLE unexpected_executor NOLOGIN');
    await setup(acl);
    await acl.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO unexpected_executor');
    await assert.rejects(applyHealthOnly(acl, bytes), /ACL verification failed/);
    const aclRollback = await acl.query("SELECT to_regprocedure('public.platform_health_database_probe()') IS NULL AS absent, (SELECT count(*)::integer FROM supabase_migrations.schema_migrations) AS entries");
    assert.deepEqual(aclRollback.rows[0], { absent: true, entries: 1 });

    await setup(identity);
    await identity.query('GRANT USAGE ON SCHEMA supabase_migrations TO unexpected_executor');
    await identity.query('SET ROLE unexpected_executor');
    await assert.rejects(applyHealthOnly(identity, bytes), /executor identity/);
    await identity.query('RESET ROLE');
    const idRollback = await identity.query("SELECT to_regprocedure('public.platform_health_database_probe()') IS NULL AS absent, (SELECT count(*)::integer FROM supabase_migrations.schema_migrations) AS entries");
    assert.deepEqual(idRollback.rows[0], { absent: true, entries: 1 });

    await setup(inherit);
    await a.query('CREATE ROLE unexpected_inheritor NOLOGIN INHERIT; GRANT anon TO unexpected_inheritor');
    await assert.rejects(applyHealthOnly(inherit, bytes), /ACL verification failed/);
    const inheritRollback = await inherit.query("SELECT to_regprocedure('public.platform_health_database_probe()') IS NULL AS absent, (SELECT count(*)::integer FROM supabase_migrations.schema_migrations) AS entries");
    assert.deepEqual(inheritRollback.rows[0], { absent: true, entries: 1 });
    console.log(JSON.stringify({ concurrent: 'PASS', onlyApprovedLedgerRow: 'PASS', anonCall: 'PASS', injectedFailureRollback: 'PASS', unexpectedDefaultGrantRejected: 'PASS', wrongExecutorRejected: 'PASS', unexpectedInheritanceRejected: 'PASS', scope: 'isolated native PostgreSQL 17 synthetic data' }));
  } finally {
    await Promise.all([a.end(), b.end(), fail.end(), acl.end(), identity.end(), inherit.end()]);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
