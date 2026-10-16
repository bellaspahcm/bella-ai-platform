import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createBdgfDatabaseConfig } from './database-connection.mjs';
import { assertExecutionIdentity } from './execution-identity.mjs';
import { buildOwnerAuthorityNotes, resolveGitHubActionsOwnerAuthority } from './owner-authority.mjs';

const E2E_REF = 'bmnbqbcdbuklhopfbopv';
const CATALOG_PATH = 'supabase/migrations/20261016010000_align_automove_catalog_read_acl.sql';
const CATALOG_HASH = '4b87b19444ef4b5f788278c94d8709983d94fe991674e48b9fcdc091fa83750e';
const PROBE_POLICY = 'bdgf_automove_owner_rehearsal';
const PROBE_BUCKET = 'bdgf-automove-owner-rehearsal';

// Missing E2E infrastructure only. Final columns/invariants come from the R4
// approval/token contracts and 20260926001000 owner-operated forward migration.
// The original inline partial UNIQUE clause is expressed as a valid unique index.
const GOVERNANCE_SCHEMA = `
CREATE TABLE public.bella_migration_approval (
 approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), migration_id varchar(255) NOT NULL,
 migration_hash varchar(64) NOT NULL, approval_mode varchar(32) NOT NULL DEFAULT 'separated'
   CHECK (approval_mode IN ('separated','owner_operated')),
 requester_id varchar(255) NOT NULL, approver_id varchar(255) NOT NULL,
 approver_role varchar(50) NOT NULL CHECK (approver_role IN ('admin','dba','tech_lead','emergency_override')),
 approved_at timestamp NOT NULL DEFAULT now(), target_environment varchar(20) NOT NULL
   CHECK (target_environment IN ('production','staging','dev')), target_schema varchar(255),
 expires_at timestamp NOT NULL, valid_from timestamp, valid_until timestamp,
 status varchar(20) NOT NULL DEFAULT 'requested' CHECK (status IN
   ('requested','approved','executing','executed','execution_failed','used','revoked','expired','rejected')),
 used_at timestamp, used_by varchar(255), approval_hash varchar(64) NOT NULL, signature text,
 created_by varchar(255) NOT NULL, created_at timestamp NOT NULL DEFAULT now(), notes text,
 execution_started_at timestamptz, execution_completed_at timestamptz, execution_error text,
 CONSTRAINT no_self_approval CHECK ((approval_mode='separated' AND requester_id<>approver_id) OR approval_mode='owner_operated')
);
CREATE UNIQUE INDEX unique_active_approval ON public.bella_migration_approval(migration_id,target_environment) WHERE status='approved';
CREATE TABLE public.bella_gate_tokens (
 token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), approval_id uuid NOT NULL REFERENCES public.bella_migration_approval(approval_id),
 migration_id varchar(255) NOT NULL, migration_hash varchar(64) NOT NULL, target_environment varchar(50) NOT NULL,
 target_schema varchar(255), executor_identity text NOT NULL, execution_attempt_id uuid NOT NULL DEFAULT gen_random_uuid(),
 nonce varchar(64) NOT NULL UNIQUE, token_signature varchar(128) NOT NULL,
 issued_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','used','expired','revoked')),
 used_at timestamptz, execution_result varchar(20) CHECK (execution_result IN ('success','failed','rollback')),
 execution_error text, created_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
 CHECK (expires_at>issued_at AND expires_at<=issued_at+interval '60 seconds'),
 CHECK (used_at IS NULL OR used_at>=issued_at),
 CHECK ((status='used' AND used_at IS NOT NULL) OR (status<>'used' AND used_at IS NULL)),
 UNIQUE(execution_attempt_id)
);
ALTER TABLE public.bella_migration_approval ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bella_gate_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bella_migration_approval,public.bella_gate_tokens FROM PUBLIC,anon,authenticated;
`;

export function rehearsalConnection(env) {
  assert.equal(env.ALLOW_BDGF_OWNER_E2E_REHEARSAL, '1', 'Explicit owner E2E rehearsal authorization is required.');
  assert.equal(new URL(env.BDGF_REHEARSAL_API_URL || '').href, `https://${E2E_REF}.supabase.co/`, 'Only the approved E2E project is allowed.');
  const config = createBdgfDatabaseConfig(env.BDGF_REHEARSAL_DB_URL);
  assert.equal(config.database, 'postgres');
  assert.ok(config.host === `db.${E2E_REF}.supabase.co` && config.user === 'postgres'
    || /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(config.host) && config.user === `postgres.${E2E_REF}`,
  'An explicit matching E2E postgres connection is required; no fallback is allowed.');
  assert.ok([5432, 6543].includes(config.port));
  return config;
}

const securitySnapshot = `select jsonb_build_object(
 'relations',(select jsonb_agg(row_to_json(x) order by x.schema,x.name) from (
   select n.nspname as schema,c.relname as name,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where
   (n.nspname='public' and c.relname in ('auto_brands','auto_models','auto_variants')) or
   (n.nspname='storage' and c.relname in ('objects','buckets'))) x),
 'columns',(select jsonb_agg(row_to_json(x) order by x.table_name,x.attnum) from (
   select c.relname as table_name,a.attnum,a.attacl::text from pg_attribute a join pg_class c on c.oid=a.attrelid
   join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
   and c.relname in ('auto_brands','auto_models','auto_variants') and a.attnum>0 and not a.attisdropped) x),
 'policies',(select jsonb_agg(row_to_json(x) order by x.schemaname,x.tablename,x.policyname) from (
   select * from pg_policies where (schemaname='public' and tablename in ('auto_brands','auto_models','auto_variants'))
   or (schemaname='storage' and tablename in ('objects','buckets'))) x))`;

export function buildRehearsalSql(catalogSql, fail = false) {
  assert.ok(!catalogSql.includes('$catalog_delta$'), 'Unexpected SQL delimiter.');
  return `SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $bdgf_rehearsal$
DECLARE before_state jsonb; after_state jsonb;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'Explicit postgres principal required'; END IF;
  LOCK TABLE public.auto_brands,public.auto_models,public.auto_variants,storage.objects,storage.buckets IN SHARE ROW EXCLUSIVE MODE;
  IF EXISTS(select 1 from pg_policies where policyname='${PROBE_POLICY}')
     OR EXISTS(select 1 from storage.buckets where id='${PROBE_BUCKET}') THEN
    RAISE EXCEPTION 'Rehearsal fixture name already exists';
  END IF;
  ${securitySnapshot} INTO before_state;
  BEGIN
    EXECUTE $catalog_delta$${catalogSql}$catalog_delta$;
    CREATE POLICY ${PROBE_POLICY} ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (false);
    INSERT INTO storage.buckets(id,name,public) VALUES ('${PROBE_BUCKET}','${PROBE_BUCKET}',false);
    IF NOT EXISTS(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='${PROBE_POLICY}')
       OR NOT EXISTS(select 1 from storage.buckets where id='${PROBE_BUCKET}' and not public) THEN
      RAISE EXCEPTION 'Owner DDL/DML read-back failed';
    END IF;
    ${fail ? "RAISE EXCEPTION 'BDGF_REHEARSAL_EXPECTED_ROLLBACK';" : "RAISE EXCEPTION USING ERRCODE='ZB001', MESSAGE='BDGF_REHEARSAL_ROLLBACK';"}
  EXCEPTION WHEN SQLSTATE 'ZB001' THEN NULL;
  END;
  ${securitySnapshot} INTO after_state;
  IF before_state IS DISTINCT FROM after_state
     OR EXISTS(select 1 from storage.buckets where id='${PROBE_BUCKET}') THEN
    RAISE EXCEPTION 'Rehearsal security/fixture rollback did not restore original state';
  END IF;
END $bdgf_rehearsal$;`;
}

async function ensureGovernance(db) {
  const { rows: [state] } = await db.query(`select to_regclass('public.bella_migration_approval')::text as approvals,
    to_regclass('public.bella_gate_tokens')::text as tokens`);
  assert.equal(Boolean(state.approvals), Boolean(state.tokens), 'Partial governance schema requires explicit repair, not a guessed bootstrap.');
  if (!state.approvals) {
    await db.query('BEGIN');
    try { await db.query(GOVERNANCE_SCHEMA); await db.query('COMMIT'); }
    catch (error) { await db.query('ROLLBACK'); throw error; }
  }
  const { rows } = await db.query(`select c.relname,r.rolname as owner,c.relrowsecurity,
    has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as anon_rights,
    has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as app_rights
    from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_roles r on r.oid=c.relowner
    where n.nspname='public' and c.relname in ('bella_migration_approval','bella_gate_tokens')`);
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.owner, 'postgres'); assert.equal(row.relrowsecurity, true);
    assert.equal(row.anon_rights, false); assert.equal(row.app_rights, false);
  }
  return !state.approvals;
}

export async function rehearseOwnerDdl() {
  const config = rehearsalConnection(process.env);
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(sha, process.env.BDGF_REHEARSAL_SHA, 'Checked-out source must match the exact candidate.');
  assert.equal(process.env.GITHUB_REPOSITORY, 'bellaspahcm/bella-ai-platform');
  const authority = await resolveGitHubActionsOwnerAuthority({ targetEnvironment: 'dev' },
    { env: { ...process.env, GITHUB_SHA: sha } });
  // The owner approved postgres explicitly. Never substitute this in other callers.
  process.env.DATABASE_EXECUTOR_URL = process.env.BDGF_REHEARSAL_DB_URL;
  process.env.DATABASE_URL = process.env.BDGF_REHEARSAL_DB_URL;
  process.env.BDGF_USE_SECRETS_MANAGER = 'false';
  delete process.env.GATE_SIGNING_KEY_FROM_SECRETS_MANAGER;
  process.env.GATE_SIGNING_KEY = randomBytes(32).toString('hex');
  const { computeHash } = await import('./r4-verify-approval.mjs');
  const { createApprovalRecord } = await import('./create-migration-approval.mjs');
  const { executeMigrationWithAuthorization } = await import('./execute-migration-wrapper.mjs');
  const { consumeGateToken } = await import('./gate-token.mjs');
  const catalog = readFileSync(CATALOG_PATH, 'utf8');
  assert.equal(computeHash(catalog), CATALOG_HASH, 'Rehearsal is limited to the reviewed catalog input.');
  const db = new pg.Client(config);
  const evidence = { sha, environment: 'E2E_NON_PRODUCTION', executor: 'postgres',
    catalog_sha256: CATALOG_HASH, owner_authority: authority.evidence, cases: [] };
  try {
    await db.connect(); assert.equal(db.connection.stream.authorized, true);
    await assertExecutionIdentity(db, 'postgres');
    await db.query("SET lock_timeout='5s'; SET statement_timeout='30s'");
    await db.query("select pg_advisory_lock(hashtext('bdgf-automove-owner-rehearsal'))");
    evidence.governance_created = await ensureGovernance(db);
    for (const fail of [false, true]) {
      const sql = buildRehearsalSql(catalog, fail);
      const migrationHash = computeHash(sql);
      const approval = await createApprovalRecord(db, {
        migrationContent: sql, migrationHash, approvalMode: 'owner_operated',
        requesterId: authority.requesterId, approverId: authority.approverId, approverRole: authority.approverRole,
        authoritySource: authority.authoritySource, authorityEvidence: authority.evidence,
        targetEnvironment: 'dev', targetSchema: null, expiresInMinutes: 5,
        notes: buildOwnerAuthorityNotes(`Approved rollback-only AutoMove public/storage rehearsal; source ${sha}; hash ${migrationHash}; explicit postgres executor.`, authority.evidence)
      });
      const operation = () => executeMigrationWithAuthorization({ approval_id: approval.approval_id,
        migration_content: sql, target_environment: 'dev', target_schema: null, executor_identity: 'postgres' });
      if (fail) await assert.rejects(operation, error => error.failed === true && error.message.includes('BDGF_REHEARSAL_EXPECTED_ROLLBACK'));
      else assert.equal((await operation()).status, 'SUCCESS');
      const tokens = await db.query('select nonce,status,used_at from public.bella_gate_tokens where approval_id=$1', [approval.approval_id]);
      assert.equal(tokens.rowCount, 1); assert.equal(tokens.rows[0].status, 'used'); assert.ok(tokens.rows[0].used_at);
      assert.equal((await consumeGateToken(tokens.rows[0].nonce, db)).consumed, false, 'Consumed tokens must not be revived.');
      const fixtures = await db.query(`select
        exists(select 1 from pg_policies where policyname=$1) as policy_left,
        exists(select 1 from storage.buckets where id=$2) as bucket_left`, [PROBE_POLICY, PROBE_BUCKET]);
      assert.equal(fixtures.rows[0].policy_left, false); assert.equal(fixtures.rows[0].bucket_left, false);
      evidence.cases.push({ name: fail ? 'EXECUTION_FAILURE_ROLLBACK' : 'OWNER_DDL_READBACK_ROLLBACK',
        status: 'PASS', migration_sha256: migrationHash, single_use: true, fixtures_clean: true });
    }
    evidence.status = 'PROVEN_NON_PRODUCTION_OWNER_DDL_ROUTE';
    evidence.cleanup = 'BUSINESS_AND_SECURITY_RESTORED_GOVERNANCE_AUDIT_RETAINED';
    mkdirSync('.cache/bdgf-owner-rehearsal', { recursive: true });
    writeFileSync('.cache/bdgf-owner-rehearsal/evidence.json', JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } finally { await db.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  rehearseOwnerDdl().catch(error => {
    console.error('BDGF_OWNER_REHEARSAL=FAIL', error instanceof Error ? error.message : 'Unknown failure');
    process.exitCode = 1;
  });
}
