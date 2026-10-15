import { mkdtemp, mkdir, lstat, readFile, rename, rm, open } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { authorizeRepository } from './authority.mjs';
import { DAY_MS, logicalKey, signature, validateBinding, validateFact, approvedOutput } from './contract.mjs';

export const evidenceRoot = () => join(homedir(), '.codex', 'agent-flow-evidence');
export function validateStorePath(dir) {
  const absolute = resolve(dir);
  if (![resolve(tmpdir()), resolve(evidenceRoot())].includes(dirname(absolute)) || !/^bella-agent-flow-[A-Za-z0-9]+$/.test(absolute.split(/[\\/]/).pop())) throw new Error('EXTERNAL_PRIVATE_STORE_REQUIRED');
  return absolute;
}

export async function writeDurableJson(path, data) {
  const handle = await open(path, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(data)); await handle.sync(); }
  finally { await handle.close(); }
}

// All retained companion artifacts share the original output deadline. Purging
// metadata earlier than its 14-day maximum avoids retaining copied output in
// reader artifacts. No daemon/unattended expiry guarantee is implied.
export async function enforceReviewRetention(dir, now = Date.now()) {
  const directory = validateStorePath(dir);
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('UNSAFE_STORE_DIRECTORY');
  const contextPath = join(directory, 'context.json');
  let context;
  try {
    const contextStat = await lstat(contextPath);
    if (!contextStat.isFile() || contextStat.isSymbolicLink() || contextStat.size > 4096) throw new Error('UNSAFE_EVIDENCE_CONTEXT');
    context = JSON.parse(await readFile(contextPath, 'utf8'));
  } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  const created = Date.parse(context.createdAt), deadline = Date.parse(context.outputReviewDeadline);
  if (!Number.isFinite(created) || !Number.isFinite(deadline) || deadline < created || !Number.isSafeInteger(now)) throw new Error('INVALID_REVIEW_RETENTION');
  if (now >= Math.min(created + 7 * DAY_MS, deadline)) {
    await rm(directory, { recursive: true, force: true });
    throw new Error('REVIEW_WINDOW_EXPIRED');
  }
}

export async function createPrivateDirectory({ retained = false } = {}) {
  const root = retained ? evidenceRoot() : tmpdir();
  await mkdir(root, { recursive: true, mode: 0o700 });
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('UNSAFE_STORE_DIRECTORY');
  const dir = await mkdtemp(join(root, 'bella-agent-flow-'));
  try {
    if (process.platform === 'win32') {
      const sid = execFileSync('whoami', ['/user', '/fo', 'csv', '/nh'], { windowsHide: true, encoding: 'utf8' }).match(/S-1-[\d-]+/)?.[0];
      if (!sid) throw new Error();
      execFileSync('icacls', [dir, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true, stdio: 'pipe' });
    } else {
      const { chmod } = await import('node:fs/promises');
      await chmod(dir, 0o700);
    }
    return dir;
  } catch {
    await rm(dir, { recursive: true, force: true });
    throw new Error('PRIVATE_STORE_SETUP_FAILED');
  }
}

export class DevelopmentStore {
  constructor(dir, binding, { authorize = authorizeRepository, clock = () => Date.now(), nonce = null } = {}) {
    validateBinding(binding);
    this.dir = validateStorePath(dir); this.binding = Object.freeze({ ...binding }); this.authorize = authorize; this.clock = clock; this.nonce = nonce;
  }

  async operation(action) {
    await this.authorize(this.binding.repository);
    await enforceReviewRetention(this.dir, this.clock());
    const dirStat = await lstat(this.dir);
    if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) throw new Error('UNSAFE_STORE_DIRECTORY');
    const lockPath = join(this.dir, 'store.lock');
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const lockStat = await lstat(lockPath);
      if (!lockStat.isFile() || lockStat.isSymbolicLink() || lockStat.size > 30) throw new Error('STORE_LOCK_OWNER_UNKNOWN');
      const owner = Number(await readFile(lockPath, 'utf8'));
      if (!Number.isSafeInteger(owner) || owner <= 0) throw new Error('STORE_LOCK_OWNER_UNKNOWN');
      try { process.kill(owner, 0); throw new Error('STORE_BUSY'); }
      catch (ownerError) { if (ownerError.code !== 'ESRCH') throw new Error('STORE_BUSY'); }
      // Recovery is for this single-writer proof only; never steal a live owner's lock.
      await rm(lockPath);
      lock = await open(lockPath, 'wx', 0o600);
    }
    try {
      await lock.writeFile(String(process.pid));
      const file = join(this.dir, 'facts.json');
      let data;
      try {
        const stat = await lstat(file);
        if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('UNSAFE_STORE_FILE');
        data = JSON.parse(await readFile(file, 'utf8'));
      } catch (error) {
        if (error.code !== 'ENOENT') throw new Error('STORE_READ_FAILED');
        data = { binding: this.binding, records: [] };
      }
      if (Object.keys(data).sort().join(',') !== 'binding,records' || JSON.stringify(data.binding) !== JSON.stringify(this.binding) || !Array.isArray(data.records)) throw new Error('STORE_SCOPE_MISMATCH');
      const now = this.clock();
      if (!Number.isSafeInteger(now) || now < 0) throw new Error('INVALID_STORE_CLOCK');
      const rowFields = 'digest,fact,key,metadataExpiresAt,outputExpiresAt,outputState,revision,storedAt';
      for (const r of data.records) {
        if (!r || Object.keys(r).sort().join(',') !== rowFields || !Number.isSafeInteger(r.storedAt) || r.storedAt < 0 ||
            r.metadataExpiresAt !== r.storedAt + 14 * DAY_MS || r.outputExpiresAt !== r.storedAt + 7 * DAY_MS ||
            !Number.isSafeInteger(r.revision) || r.revision < 1 || !/^[a-f0-9]{64}$/.test(r.digest) ||
            r.key !== logicalKey(r.fact) || !['AVAILABLE', 'ABSENT', 'EXPIRED'].includes(r.outputState)) throw new Error('INVALID_STORE_RECORD');
      }
      data.records = data.records.filter(r => r.metadataExpiresAt > now).map(r => {
        if (r.outputExpiresAt <= now && r.fact.output) { r.fact.output = null; r.outputState = 'EXPIRED'; }
        return r;
      });
      for (const r of data.records) validateFact(r.fact, this.binding, this.nonce);
      const result = action(data, now);
      if (data.records.length > 5000) throw new Error('PROOF_STORE_LIMIT');
      // Do not retain binding metadata after the final record expires.
      if (data.records.length === 0) { await rm(file, { force: true }); return structuredClone(result); }
      const encoded = JSON.stringify(data);
      if (Buffer.byteLength(encoded) > 2 * 1024 * 1024) throw new Error('PROOF_STORE_LIMIT');
      const temp = join(this.dir, `${randomUUID()}.tmp`);
      try {
        const handle = await open(temp, 'wx', 0o600);
        try { await handle.writeFile(encoded); await handle.sync(); } finally { await handle.close(); }
        await rename(temp, file);
        // Best-effort directory-entry flush where the platform supports it.
        // Windows durable guarantee here is process-restart survival, not power-loss safety.
        if (process.platform !== 'win32') {
          const directory = await open(this.dir, 'r');
          try { await directory.sync(); } finally { await directory.close(); }
        }
      } finally { await rm(temp, { force: true }); }
      return structuredClone(result);
    } finally { await lock.close(); await rm(lockPath, { force: true }); }
  }

  async ingest(fact) {
    validateFact(fact, this.binding, this.nonce);
    const acknowledgement = await this.operation((data, now) => {
      const key = logicalKey(fact), digest = signature(fact);
      const prior = data.records.findLast(r => r.key === key);
      const duplicate = fact.method === 'thread/status/changed' ? (prior?.digest === digest ? prior : null) : data.records.find(r => r.key === key && r.digest === digest);
      if (duplicate) return { duplicate: true, revision: duplicate.revision, sequence: data.records.indexOf(duplicate) + 1, digest, acknowledgedAt: new Date(now).toISOString() };
      const saved = structuredClone(fact);
      if (saved.output) saved.output = approvedOutput(saved.output.text, this.nonce);
      const row = { key, digest, revision: (prior?.revision || 0) + 1, storedAt: now, metadataExpiresAt: now + 14 * DAY_MS, outputExpiresAt: now + 7 * DAY_MS, outputState: saved.output ? 'AVAILABLE' : 'ABSENT', fact: saved };
      data.records.push(row);
      return { duplicate: false, revision: row.revision, sequence: data.records.length, digest, acknowledgedAt: new Date(now).toISOString() };
    });
    return { ...acknowledgement, acknowledgedAt: new Date(this.clock()).toISOString() };
  }

  async read() { return this.operation(data => data.records); }

  async destroy() {
    await this.authorize(this.binding.repository);
    const stat = await lstat(this.dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('UNSAFE_STORE_DIRECTORY');
    await rm(this.dir, { recursive: true, force: true });
  }
}
