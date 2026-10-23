import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { basename, resolve } from 'node:path';
import { parse } from 'dotenv';
import { z } from 'zod';
import { saleChainConnection } from '../src/modules/bella-auto/services/AutoMoveSaleChainConnection';

const project = 'bmnbqbcdbuklhopfbopv';
export function rcEnvironment(input: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...input };
  assert.match(env.AUTOMOVE_RC_SHA || '', /^[a-f0-9]{40}$/, 'Exact candidate SHA required');
  assert.equal(env.E2E_BASE_URL || '', '', 'RC runner owns its fresh localhost server');
  assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL || '').href, `https://${project}.supabase.co/`, 'Canonical Non-Production API required');
  for (const key of ['SUPABASE_URL', 'E2E_SUPABASE_URL']) {
    if (env[key]) assert.equal(new URL(env[key]).href, `https://${project}.supabase.co/`, 'Conflicting API target');
  }
  const urls = ['DB_URL', 'SUPABASE_DB_URL', 'DATABASE_URL'].map(key => env[key]).filter((url): url is string => !!url);
  assert.ok(urls.length, 'Non-Production DB required');
  for (const url of urls) saleChainConnection(url, env.NEXT_PUBLIC_SUPABASE_URL || '');
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(publicKey, 'Public Auth key required');
  assert.ok(env.SUPABASE_SERVICE_ROLE_KEY, 'Isolated fixture authority required');
  for (const key of Object.keys(env)) if (/^PRODUCTION_|^VERCEL_|^AWS_/.test(key)) delete env[key];
  return { ...env, DB_URL: urls[0], SUPABASE_DB_URL: urls[0], DATABASE_URL: urls[0],
    SUPABASE_SECRET_KEY: env.SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey, SUPABASE_URL: `https://${project}.supabase.co`,
    USE_READ_REPLICA: 'false', SUPABASE_READ_REPLICA_URL: '', SUPABASE_READ_REPLICA_KEY: '',
    NODE_ENV: 'production', DEPLOYMENT_ENV: '', NEXT_PUBLIC_VERCEL_ENV: '', NEXT_TELEMETRY_DISABLED: '1', E2E_REUSE_SERVER: '0', SKIP_WEBSERVER: '1' };
}

export function assertRcReport(report: unknown) {
  const parsed = z.object({ stats: z.object({ expected: z.literal(1), unexpected: z.literal(0), flaky: z.literal(0), skipped: z.literal(0) }) }).parse(report);
  return parsed.stats;
}

export function summarizeRcHealth(statusCode: number, body: unknown) {
  const value = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
  const checks = typeof value.checks === 'object' && value.checks !== null ? value.checks as Record<string, unknown> : {};
  const appStatus = z.enum(['healthy', 'unhealthy', 'error']).safeParse(value.status);
  const environment = z.enum(['production', 'preview', 'development', 'staging']).safeParse(value.environment);
  const database = z.enum(['ok', 'failed']).safeParse(checks.database);
  return {
    httpStatus: statusCode,
    appStatus: appStatus.success ? appStatus.data : 'unexpected',
    environment: environment.success ? environment.data : 'unexpected',
    database: database.success ? database.data : 'unexpected',
  } as const;
}

export function redactRcLog(line: string, env: NodeJS.ProcessEnv) {
  let result = line;
  for (const [key, value] of Object.entries(env)) if (value && value.length >= 8 && /KEY|TOKEN|SECRET|PASSWORD|DB_URL|DATABASE_URL/.test(key)) result = result.split(value).join('[REDACTED]');
  return result.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[DB_URL_REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT_REDACTED]')
    .replace(/base64(?:-|%2D)[A-Za-z0-9+/_%=-]{20,}/g, '[AUTH_COOKIE_REDACTED]');
}

async function freePort() {
  const server = createServer();
  await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  await new Promise<void>((done, fail) => server.close(error => error ? fail(error) : done()));
  return address.port;
}

async function stop(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null) return;
  const exited = new Promise<void>(done => child.once('exit', () => done()));
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); } }
  await Promise.race([exited, new Promise<void>(done => setTimeout(done, 5000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

export async function runRc() {
  const supplied = process.env.E2E_ENV_FILE ? parse(readFileSync(process.env.E2E_ENV_FILE)) : {};
  const env = rcEnvironment({ ...process.env, ...supplied, AUTOMOVE_RC_SHA: process.env.AUTOMOVE_RC_SHA });
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, 'Git provenance unavailable'); return result.stdout.trim();
  };
  const sha = git('rev-parse', 'HEAD'); assert.equal(sha, env.AUTOMOVE_RC_SHA, 'Candidate checkout differs from requested SHA');
  const dirtyInputs = () => [...git('diff', 'HEAD', '--name-only').split(/\r?\n/), ...git('ls-files', '--others', '--exclude-standard').split(/\r?\n/)]
    .filter(file => /^(src\/|packages\/|scripts\/|e2e\/|\.github\/|package(?:-lock)?\.json$|.*config\.[cm]?[jt]s$)/.test(file));
  assert.deepEqual(dirtyInputs(), [], 'Commit candidate build/test inputs before RC verification');
  const root = resolve('.cache/automove-rc', sha, new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(root, { recursive: true });
  const evidence: Record<string, unknown> = { status: 'NOT_PROVEN', sha, project, runtime: 'next build -> next start', productionMutation: 'NOT_PERFORMED' };
  const writeEvidence = () => writeFileSync(resolve(root, 'evidence.json'), JSON.stringify(evidence, null, 2));
  writeEvidence();
  const children = new Set<ChildProcess>();
  const launch = (args: string[], name: string) => {
    const child = spawn(process.execPath, args, { env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    for (const stream of [child.stdout, child.stderr]) {
      let carry = '';
      stream?.on('data', (chunk: Buffer) => { carry += chunk.toString(); const lines = carry.split('\n'); carry = lines.pop() || '';
        for (const line of lines) appendFileSync(resolve(root, `${name}.log`), `${redactRcLog(line, env)}\n`); });
      stream?.on('end', () => { if (carry) appendFileSync(resolve(root, `${name}.log`), redactRcLog(carry, env)); });
    }
    const completion = new Promise<number>((done, fail) => { child.once('error', fail); child.once('exit', code => done(code ?? 1)); });
    // Keep spawn errors observed while readiness checks are running.
    void completion.catch(() => undefined);
    return { child, completion };
  };
  const stopAll = async () => { for (const child of children) await stop(child); };
  const interrupted = () => { void stopAll().finally(() => process.exit(1)); };
  process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
  try {
    console.log(`AUTOMOVE_RC_BUILD sha=${sha}`);
    const build = launch(['node_modules/next/dist/bin/next', 'build', '--webpack'], 'build');
    assert.equal(await build.completion, 0, 'RC build failed; inspect sanitized build.log');
    const buildId = readFileSync('.next/BUILD_ID', 'utf8').trim(); assert.ok(buildId);
    evidence.buildId = buildId; evidence.buildManifestSha256 = createHash('sha256').update(readFileSync('.next/build-manifest.json')).digest('hex');
    const port = await freePort(); env.E2E_BASE_URL = `http://127.0.0.1:${port}`;
    env.AUTOMOVE_RC_BUILD_ID = buildId; env.AUTOMOVE_RC_PROOF_PATH = resolve(root, 'chain-proof.json');
    const report = resolve(root, 'playwright-results.json'); env.PLAYWRIGHT_JSON_OUTPUT_FILE = report;
    const server = launch(['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], 'server');
    let healthy = false;
    const readiness: { attempts: number; last?: ReturnType<typeof summarizeRcHealth> | { transportError: string } } = { attempts: 0 };
    for (let attempt = 0; attempt < 60; attempt++) {
      assert.equal(server.child.exitCode, null, 'RC server exited before readiness');
      readiness.attempts = attempt + 1;
      try {
        const response = await fetch(`${env.E2E_BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
        let body: unknown = null;
        try { body = await response.json(); } catch { /* Record a safe summary for non-JSON readiness responses. */ }
        readiness.last = summarizeRcHealth(response.status, body);
        if (response.ok && z.object({ status: z.literal('healthy'), environment: z.literal('production'), checks: z.object({ database: z.literal('ok') }) }).safeParse(body).success) { healthy = true; break; }
      } catch (error) {
        readiness.last = { transportError: error instanceof Error && error.name === 'AbortError' ? 'timeout' : error instanceof Error && error.name === 'TypeError' ? 'connection' : 'other' };
      }
      await new Promise(done => setTimeout(done, 1000));
    }
    evidence.readiness = readiness;
    assert.ok(healthy, 'Fresh production-mode server failed health/readiness');
    console.log(`AUTOMOVE_RC_BROWSER sha=${sha} buildId=${buildId} project=${project}`);
    const browser = launch(['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.automove-rc.config.ts', '--workers=1', '--retries=0', `--output=${resolve(root, 'browser')}`], 'browser');
    assert.equal(await browser.completion, 0, 'RC Browser failed; inspect sanitized browser.log');
    evidence.tests = assertRcReport(JSON.parse(readFileSync(report, 'utf8')));
    const proof = z.object({ sha: z.literal(sha), buildId: z.literal(buildId), bookingId: z.string().uuid(), recognitionId: z.string().uuid(),
      finalSale: z.literal(0), finalCash: z.literal(0), finalOutstanding: z.literal(0), originalUnchanged: z.literal(true),
      reconciliation: z.literal('MATCHED'), cleanup: z.literal('PARTIAL_HISTORY_RETAINED') }).parse(JSON.parse(readFileSync(env.AUTOMOVE_RC_PROOF_PATH, 'utf8')));
    assert.equal(git('rev-parse', 'HEAD'), sha, 'Candidate changed while testing');
    assert.deepEqual(dirtyInputs(), [], 'Candidate build/test inputs changed while testing');
    evidence.chain = proof; evidence.status = 'PASS';
  } catch (error: unknown) {
    evidence.status = 'NOT_PROVEN'; evidence.error = redactRcLog(error instanceof Error ? error.message : 'RC verification failed', env); throw error;
  } finally {
    try { await stopAll(); } finally {
      writeEvidence(); process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted);
      console.log(`AUTOMOVE_RC_RESULT=${evidence.status} evidence=${resolve(root, 'evidence.json')}`);
    }
  }
}

if (basename(process.argv[1] || '') === 'run-automove-rc-business-chain.ts') {
  void runRc().catch(() => { console.error('AutoMove RC verification did not PASS. Inspect sanitized evidence.'); process.exitCode = 1; });
}
