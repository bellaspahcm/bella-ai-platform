// Verification only: no database, approval or gate-token APIs are imported.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const adoptionHash = 'a5e574c6985924d41436c2b05ff1ea9ffc45530861302b60f9ff8687a2e22f23';
const resolverHash = '9f757f205bbfac396a4ea9340d30a5a87ab5c4164784be7dc10768c9d408273c';
const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), '../..');
const check = (condition, code) => { if (!condition) throw new Error(code); };

export function signProbe(probe, key) {
  return createHmac('sha256', key).update(JSON.stringify(probe), 'utf8').digest('hex');
}

export function verifyProbe(probe, signature, key) {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(signProbe(probe, key), 'hex'));
}

export function validateContext(env) {
  check(env.GITHUB_ACTIONS === 'true', 'REAL_ACTIONS_REQUIRED');
  check(env.GITHUB_EVENT_NAME === 'workflow_dispatch', 'MANUAL_VERIFICATION_REQUIRED');
  check(env.GITHUB_REPOSITORY === 'bellaspahcm/bella-ai-platform', 'WRONG_REPOSITORY');
  check(env.GITHUB_REF === 'refs/tags/bdgf-key-check-20261016', 'WRONG_VERIFICATION_REF');
  check(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || ''), 'SOURCE_SHA_REQUIRED');
  check(Boolean(env.GATE_SIGNING_KEY_FROM_SECRETS_MANAGER), 'TRUSTED_INJECTION_REQUIRED');
  check(!env.GATE_SIGNING_KEY, 'DEVELOPMENT_FALLBACK_FORBIDDEN');
  check(env.BDGF_USE_SECRETS_MANAGER === 'false' && env.SECRETS_CACHE_ENABLED === 'false', 'EXPLICIT_INJECTED_BACKEND_REQUIRED');
  const credentials = Object.keys(env).filter(name => /^(?:DATABASE.*URL|SUPABASE.*(?:URL|KEY)|NEXT_PUBLIC_SUPABASE.*|PGHOST|PGPASSWORD|DB_URL|.*EXECUTOR.*URL)$/.test(name));
  check(credentials.every(name => !env[name]), 'DATABASE_CREDENTIAL_FORBIDDEN');
}

async function worker(mode) {
  // Resolver diagnostics are suppressed, never copied into CI output.
  console.log = () => {};
  console.warn = () => {};
  validateContext(process.env);
  const { getSigningKey, clearCache } = await import('./get-signing-key.mjs');
  clearCache();
  const key = await getSigningKey();
  check(typeof key === 'string' && key.length >= 64, 'INVALID_KEY_FORMAT');
  const input = JSON.parse(readFileSync(0, 'utf8'));
  check(input.probe?.domain === 'BELLA_BDGF_NON_AUTHORIZING_KEY_PROBE_V1' && input.probe?.purpose === 'verification-only-no-execution', 'NON_AUTHORIZING_PROBE_REQUIRED');
  if (mode === 'sign') {
    process.stdout.write(JSON.stringify({ key_format_valid: true, signature: signProbe(input.probe, key) }));
  } else {
    check(mode === 'verify', 'UNKNOWN_PROBE_MODE');
    const changed = input.signature[0] === '0' ? '1' : '0';
    process.stdout.write(JSON.stringify({
      key_format_valid: true,
      signature_valid: verifyProbe(input.probe, input.signature, key),
      hash_tamper_rejected: !verifyProbe({ ...input.probe, adoption_sql_sha256: '0'.repeat(64) }, input.signature, key),
      nonce_tamper_rejected: !verifyProbe({ ...input.probe, challenge_nonce: 'changed' }, input.signature, key),
      signature_tamper_rejected: !verifyProbe(input.probe, changed + input.signature.slice(1), key),
      malformed_signature_rejected: !verifyProbe(input.probe, 'invalid', key)
    }));
  }
}

function runWorker(mode, input) {
  const result = spawnSync(process.execPath, [script, '--worker=' + mode], {
    cwd: root, env: process.env, input: JSON.stringify(input), encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000, maxBuffer: 65536, windowsHide: true
  });
  check(result.status === 0, 'CANONICAL_RESOLVER_PROBE_FAILED');
  // Signature stays in process memory/pipe. Never log stdout/stderr or failures.
  return JSON.parse(result.stdout);
}

async function main() {
  const evidence = { status: 'NOT_PROVEN', checked_at_utc: new Date().toISOString(),
    adoption_sql_sha256: adoptionHash, source_sha: process.env.GITHUB_SHA,
    run_id: process.env.GITHUB_RUN_ID, run_attempt: process.env.GITHUB_RUN_ATTEMPT,
    key_source: 'GitHub Environment Production -> trusted injection -> canonical resolver',
    database_connection: false, approval_created: false, gate_token_created: false,
    production_mutation: false, deployment_performed: false, secret_material_logged: false };
  try {
    validateContext(process.env);
    check(!['.env', '.env.local', '.env.production', '.env.production.local'].some(name => existsSync(resolve(root, name))), 'DOTENV_FILES_FORBIDDEN');
    const source = readFileSync(resolve(root, 'scripts/bdgf/get-signing-key.mjs'), 'utf8').replaceAll('\r\n', '\n');
    check(createHash('sha256').update(source).digest('hex') === resolverHash, 'CANONICAL_RESOLVER_SOURCE_MISMATCH');
    const probe = { domain: 'BELLA_BDGF_NON_AUTHORIZING_KEY_PROBE_V1', purpose: 'verification-only-no-execution',
      adoption_sql_sha256: adoptionHash, challenge_nonce: randomBytes(32).toString('hex') };
    const signed = runWorker('sign', { probe });
    check(signed.key_format_valid === true && /^[a-f0-9]{64}$/.test(signed.signature || ''), 'SIGN_PROBE_FAILED');
    const verified = runWorker('verify', { probe, signature: signed.signature });
    check(Object.values(verified).length === 6 && Object.values(verified).every(value => value === true), 'VERIFY_OR_TAMPER_CHECK_FAILED');
    evidence.checks = { canonical_source_unchanged: true, trusted_injection_only: true,
      separate_process_key_consistency: true, ...verified };
    evidence.status = 'PASS_CURRENT_PRODUCTION_KEY_CRYPTOGRAPHIC_VERIFICATION_ONLY';
  } catch {
    evidence.status = 'FAIL_CLOSED_KEY_VERIFICATION';
    process.exitCode = 1;
  } finally {
    const output = resolve(root, '.cache/bdgf-key-check');
    mkdirSync(output, { recursive: true });
    writeFileSync(resolve(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence, null, 2));
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const mode = process.argv[2]?.replace('--worker=', '');
  if (mode) worker(mode).catch(() => { process.exitCode = 1; });
  else await main();
}
