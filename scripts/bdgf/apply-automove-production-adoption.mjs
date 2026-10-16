// One owner-approved immutable adoption. No history repair or runtime changes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { createBdgfDatabaseConfig } from './database-connection.mjs';
import { assertExecutionIdentity } from './execution-identity.mjs';

export const approvedHash = 'a5e574c6985924d41436c2b05ff1ea9ffc45530861302b60f9ff8687a2e22f23';
export const approvedTag = 'bdgf-automove-adoption-20261016';
const preparationSha = 'a864f85165246b0f753184ddf18a766fc91cbdf7';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const folder = resolve(root, 'scripts/bdgf/automove-adoption-20261016');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (condition, code) => { if (!condition) throw new Error(code); };
const primitives = ['database-connection.mjs','execution-identity.mjs','owner-authority.mjs',
  'get-signing-key.mjs','create-migration-approval.mjs','r4-verify-approval.mjs',
  'execute-migration-wrapper.mjs','migration-executor.mjs','gate-token.mjs'];

export function validateDispatch(env) {
  check(env.GITHUB_ACTIONS === 'true' && env.GITHUB_EVENT_NAME === 'workflow_dispatch', 'REAL_MANUAL_ACTIONS_REQUIRED');
  check(env.GITHUB_REPOSITORY === 'bellaspahcm/bella-ai-platform', 'WRONG_REPOSITORY');
  check(env.GITHUB_REF === 'refs/tags/' + approvedTag, 'WRONG_EXECUTION_TAG');
  check(env.GITHUB_RUN_ATTEMPT === '1', 'AUTOMATIC_REEXECUTION_FORBIDDEN');
  check(env.ADOPTION_APPROVED_SHA256 === approvedHash, 'APPROVED_HASH_MISMATCH');
  check(env.ADOPTION_CONFIRMATION === 'APPLY_AUTOMOVE_SCHEMA_SECURITY_ONLY', 'EXPLICIT_CONFIRMATION_REQUIRED');
  check(Boolean(env.AUTOMOVE_PRODUCTION_DB_URL) && Boolean(env.GATE_SIGNING_KEY_FROM_SECRETS_MANAGER), 'TRUSTED_SECRETS_REQUIRED');
  check(!env.GATE_SIGNING_KEY && env.BDGF_USE_SECRETS_MANAGER === 'false', 'DEVELOPMENT_KEY_OR_BACKEND_FORBIDDEN');
  check(!['.env','.env.local','.env.production','.env.production.local'].some(name => existsSync(resolve(root, name))), 'DOTENV_FILES_FORBIDDEN');
}

export function productionConfig(url) {
  const config = createBdgfDatabaseConfig(url);
  const project = 'lvnvkpyxtuilhrabtlwv';
  check(config.host === `db.${project}.supabase.co` ||
    (/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(config.host) && config.user === `postgres.${project}`), 'WRONG_PRODUCTION_TARGET');
  check(config.user === 'postgres' || config.user === `postgres.${project}`, 'EXPLICIT_OWNER_PRINCIPAL_REQUIRED');
  check(config.database === 'postgres' && config.ssl?.rejectUnauthorized === true, 'VERIFIED_TLS_DATABASE_REQUIRED');
  return config;
}

export function loadPackage() {
  const manifest = JSON.parse(readFileSync(resolve(folder, 'manifest.json')));
  const sql = readFileSync(resolve(folder, 'adoption.sql'), 'utf8');
  const before = readFileSync(resolve(folder, 'preconditions.sql'), 'utf8');
  const after = readFileSync(resolve(folder, 'final-postconditions.sql'), 'utf8');
  check(digest(sql) === approvedHash && manifest.adoption_sql_sha256 === approvedHash, 'FROZEN_PAYLOAD_HASH_MISMATCH');
  check(digest(before) === manifest.preconditions_sql_sha256 && digest(after) === manifest.postconditions_sql_sha256, 'READBACK_HASH_MISMATCH');
  check(manifest.project_ref === 'lvnvkpyxtuilhrabtlwv' && manifest.creates.length === 8 && manifest.existing_adapter_acl_scope.length === 11, 'PACKAGE_SCOPE_MISMATCH');
  for (const input of manifest.inputs) {
    const bytes = execFileSync('git', ['show', `${input.source_sha}:${input.path}`], { cwd: root, maxBuffer: 1024 * 1024 });
    check(digest(bytes) === input.sha256, 'IMMUTABLE_MIGRATION_SOURCE_MISMATCH');
  }
  for (const name of primitives) {
    const path = `scripts/bdgf/${name}`;
    const expected = execFileSync('git', ['show', `${preparationSha}:${path}`], { cwd: root });
    const actual = readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n');
    check(digest(actual) === digest(expected), 'CANONICAL_EXECUTION_SOURCE_CHANGED');
  }
  return { manifest, sql, before, after };
}

async function readOnly(db, action) {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await db.query("SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='3s'");
    assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
    return await action();
  } finally { await db.query('ROLLBACK'); }
}

export async function applyApprovedAdoption() {
  const evidence = { status: 'NOT_PROVEN', adoption_sql_sha256: approvedHash,
    source_sha: process.env.GITHUB_SHA, run_id: process.env.GITHUB_RUN_ID,
    checked_at_utc: new Date().toISOString(), environment: 'PRODUCTION', executor: 'postgres',
    runtime_guard: 'UNCHANGED_HELD', business_data_mutation: false, migration_history_written: false,
    application_deployment: false, backup_exception: 'OWNER_ACCEPTED_DEFERRED_PENDING_BUDGET',
    approval_created: false, schema_execution_attempted: false };
  const diagnostics = { log: console.log, warn: console.warn, error: console.error };
  let reader;
  let writer;
  let phase = 'LOCAL_INPUT_GUARDS';
  // Canonical modules log nonce fragments; suppress rather than persist them.
  console.log = console.warn = console.error = () => {};
  try {
    validateDispatch(process.env);
    const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    check(sourceSha === process.env.GITHUB_SHA, 'CHECKED_OUT_SOURCE_MISMATCH');
    const { manifest, sql, before, after } = loadPackage();
    const config = productionConfig(process.env.AUTOMOVE_PRODUCTION_DB_URL);
    const { resolveGitHubActionsOwnerAuthority, buildOwnerAuthorityNotes } = await import('./owner-authority.mjs');
    const { getSigningKey, clearCache } = await import('./get-signing-key.mjs');
    const { createApprovalRecord } = await import('./create-migration-approval.mjs');
    const { evaluateApprovalRecord } = await import('./r4-verify-approval.mjs');
    const { executeMigrationWithAuthorization } = await import('./execute-migration-wrapper.mjs');
    phase = 'TRUSTED_OWNER_AND_KEY';
    const authority = await resolveGitHubActionsOwnerAuthority({ targetEnvironment: 'production', targetSchema: null });
    check(authority.approverRole === 'admin' && authority.evidence.sha === sourceSha, 'OWNER_AUTHORITY_MISMATCH');
    evidence.owner_authority = authority.evidence;
    clearCache();
    const key = await getSigningKey();
    check(typeof key === 'string' && key.length >= 64, 'INVALID_TRUSTED_KEY');
    phase = 'READ_ONLY_PRODUCTION_PREFLIGHT';
    reader = new pg.Client({ ...config, options: '-c default_transaction_read_only=on', application_name: 'automove-adoption-readback' });
    await reader.connect();
    check(reader.connection.stream.authorized === true, 'TLS_CERTIFICATE_NOT_AUTHORIZED');
    await assertExecutionIdentity(reader, 'postgres');
    await readOnly(reader, async () => {
      await reader.query(before);
      const prior = await reader.query("SELECT count(*)::int AS count FROM public.bella_migration_approval WHERE migration_hash=$1 AND target_environment='production'", [approvedHash]);
      check(prior.rows[0].count === 0, 'PRIOR_ATTEMPT_EXISTS_INSPECT_BEFORE_RETRY');
      const rights = (await reader.query(`SELECT has_schema_privilege('postgres','public','CREATE') AS public_create,
        has_schema_privilege('postgres','storage','USAGE') AS storage_usage,
        has_table_privilege('postgres','storage.buckets','SELECT') AS bucket_select,
        has_table_privilege('postgres','storage.buckets','INSERT') AS bucket_insert,
        has_table_privilege('postgres','public.bella_migration_approval','INSERT') AS approval_insert,
        has_table_privilege('postgres','public.bella_migration_approval','UPDATE') AS approval_update,
        has_table_privilege('postgres','public.bella_gate_tokens','INSERT') AS token_insert,
        has_table_privilege('postgres','public.bella_gate_tokens','UPDATE') AS token_update`)).rows[0];
      check(Object.values(rights).every(value => value === true), 'REQUIRED_EXISTING_PRIVILEGE_MISSING');
    });
    evidence.preflight = 'PASS_READ_ONLY';
    evidence.tls_ca_hostname_verification = 'ENABLED_AND_AUTHORIZED';
    phase = 'CANONICAL_APPROVAL_ISSUANCE';
    writer = new pg.Client({ ...config, application_name: 'automove-canonical-approval-writer' });
    await writer.connect();
    check(writer.connection.stream.authorized === true, 'TLS_CERTIFICATE_NOT_AUTHORIZED');
    await assertExecutionIdentity(writer, 'postgres');
    const approval = await createApprovalRecord(writer, {
      migrationContent: sql, migrationHash: approvedHash, approvalMode: 'owner_operated',
      requesterId: authority.requesterId, approverId: authority.approverId, approverRole: authority.approverRole,
      authoritySource: authority.authoritySource, authorityEvidence: authority.evidence,
      targetEnvironment: 'production', targetSchema: null, expiresInMinutes: 10,
      notes: buildOwnerAuthorityNotes(`Owner-approved immutable AutoMove schema/security only; hash ${approvedHash}; source ${sourceSha}; explicit postgres; public/storage; runtime remains closed; owner backup exception retained.`, authority.evidence)
    });
    evidence.approval_created = true;
    evidence.approval_id = approval.approval_id;
    check(approval.migration_hash === approvedHash && approval.target_schema === null && String(approval.migration_id) === String(approval.approval_id), 'CANONICAL_APPROVAL_BINDING_MISMATCH');
    check(evaluateApprovalRecord(approval, { migration_content: sql, execution_environment: 'production', execution_schema: null }).decision === 'PASS', 'CANONICAL_APPROVAL_REJECTED');
    await writer.end(); writer = null;
    // Explicit approved owner URL only. Never fall back to a second credential.
    process.env.DATABASE_EXECUTOR_URL = process.env.AUTOMOVE_PRODUCTION_DB_URL;
    process.env.DATABASE_URL = process.env.AUTOMOVE_PRODUCTION_DB_URL;
    phase = 'CANONICAL_WRAPPER_EXECUTION';
    evidence.schema_execution_attempted = true;
    const result = await executeMigrationWithAuthorization({ approval_id: approval.approval_id,
      migration_content: sql, target_environment: 'production', target_schema: null, executor_identity: 'postgres' });
    check(result.status === 'SUCCESS' && result.migration_hash === approvedHash, 'WRAPPER_COMMIT_NOT_ACKNOWLEDGED');
    evidence.commit_outcome = 'ACKNOWLEDGED_BY_CANONICAL_WRAPPER';
    phase = 'FRESH_COMMITTED_READBACK';
    await readOnly(reader, async () => {
      await reader.query(after);
      const tokens = await reader.query('SELECT status,used_at,migration_hash,target_environment,target_schema,executor_identity FROM public.bella_gate_tokens WHERE approval_id=$1', [approval.approval_id]);
      check(tokens.rowCount === 1 && tokens.rows[0].status === 'used' && tokens.rows[0].used_at !== null &&
        tokens.rows[0].migration_hash === approvedHash && tokens.rows[0].target_environment === 'production' &&
        tokens.rows[0].target_schema === null && tokens.rows[0].executor_identity === 'postgres', 'TOKEN_CONSUMPTION_BINDING_NOT_PROVEN');
      const tables = await reader.query(`SELECT n.nspname||'.'||c.relname AS name,c.relrowsecurity,
        pg_get_userbyid(c.relowner) AS owner,(SELECT count(*)::int FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
        (SELECT count(*)::int FROM pg_constraint k WHERE k.conrelid=c.oid) AS constraints,
        (SELECT count(*)::int FROM pg_index i WHERE i.indrelid=c.oid) AS indexes
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname||'.'||c.relname=ANY($1) ORDER BY 1`, [manifest.creates]);
      check(tables.rowCount === 8 && tables.rows.every(row => row.relrowsecurity && row.owner === 'postgres'), 'NEW_TABLE_READBACK_MISMATCH');
      evidence.tables = tables.rows;
      evidence.single_use_token = 'ONE_TOKEN_CONSUMED_BEFORE_DDL';
    });
    evidence.postconditions = 'PASS_FRESH_COMMITTED_READ_ONLY';
    evidence.status = 'PROVEN_PRODUCTION_SCHEMA_SECURITY_ADOPTION';
  } catch (error) {
    evidence.status = 'BLOCKED_OR_FAILED_PRODUCTION_ADOPTION';
    evidence.failed_phase = phase;
    evidence.failure_code = error.code || error.details?.code || error.name;
    if (/^[A-Z][A-Z_]+$/.test(error.message || '')) evidence.failure_condition = error.message;
    const safeSqlReason = /(?:Adoption before-state drift: [a-z]+|permission denied for (?:table|schema|function) [a-z0-9_.]+|must be owner of (?:table|function) [a-z0-9_.]+)/i.exec(error.message || '');
    if (safeSqlReason) evidence.failure_condition = safeSqlReason[0];
    evidence.retry = 'FORBIDDEN_INSPECT_ACTUAL_STATE_AND_GOVERNANCE_FIRST';
    process.exitCode = 1;
  } finally {
    await writer?.end().catch(() => {});
    await reader?.end().catch(() => {});
    Object.assign(console, diagnostics);
    const output = resolve(root, '.cache/automove-production-adoption');
    mkdirSync(output, { recursive: true });
    writeFileSync(resolve(output, 'execution-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence, null, 2));
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await applyApprovedAdoption();
