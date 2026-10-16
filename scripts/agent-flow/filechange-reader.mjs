import { readFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorizeRepository, REPOSITORY } from './authority.mjs';
import { validateStorePath } from './store.mjs';
import { DAY_MS, verifyFileChangeRecords, validateBinding, validateFact, logicalKey } from './contract.mjs';

// Independent read-only consumer of the canonical facts file. No source-query,
// store.read(), purge, log reconstruction or rewriting the retained package.
export async function readFileChanges(input, { authorize = authorizeRepository, clock = Date.now } = {}) {
  await authorize(REPOSITORY);
  const directory = validateStorePath(input);
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('UNSAFE_STORE_DIRECTORY');
  async function json(name, limit) {
    const file = join(directory, name), info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > limit) throw new Error('UNSAFE_STORE_FILE');
    return JSON.parse(await readFile(file, 'utf8'));
  }
  const context = await json('context.json', 4096);
  if (context.scope !== 'filechange-canonical-batch') throw new Error('FILECHANGE_BATCH_SCOPE_REQUIRED');
  validateBinding(context.binding);
  if (context.binding.repository !== REPOSITORY) throw new Error('TELEMETRY_SCOPE_DENIED');
  const now = clock(), created = Date.parse(context.createdAt), deadline = Date.parse(context.outputReviewDeadline);
  if (!Number.isSafeInteger(now) || !Number.isFinite(created) || !Number.isFinite(deadline) || created > now || deadline <= created || deadline > created + 7 * DAY_MS || now >= deadline) throw new Error('REVIEW_WINDOW_INVALID_OR_EXPIRED');
  const data = await json('facts.json', 2 * 1024 * 1024);
  validateBinding(data.binding);
  if (Object.keys(data).sort().join(',') !== 'binding,records' || ['repository', 'taskId', 'runId', 'attempt', 'producerInstanceId', 'threadId', 'sessionId', 'turnId'].some(field => data.binding[field] !== context.binding[field]) || !Array.isArray(data.records) || data.records.length > 5000) throw new Error('STORE_SCOPE_MISMATCH');
  for (const row of data.records) {
    if (!row || Object.keys(row).sort().join(',') !== 'digest,fact,key,metadataExpiresAt,outputExpiresAt,outputState,revision,storedAt' || !Number.isSafeInteger(row.storedAt) || row.storedAt < 0 || row.storedAt > now || row.metadataExpiresAt !== row.storedAt + 14 * DAY_MS || row.outputExpiresAt !== row.storedAt + 7 * DAY_MS || now >= row.metadataExpiresAt || !Number.isSafeInteger(row.revision) || row.revision < 1 || !['AVAILABLE', 'ABSENT', 'EXPIRED'].includes(row.outputState) || !/^[a-f0-9]{64}$/.test(row.digest) || row.key !== logicalKey(row.fact)) throw new Error('INVALID_STORE_RECORD');
    validateFact(row.fact, context.binding, context.nonce);
    if (row.fact.itemType === 'fileChange' && row.outputState !== 'ABSENT') throw new Error('INVALID_STORE_RECORD');
  }
  const reconciliation = verifyFileChangeRecords(data.records, context.binding);
  return { result: reconciliation.length && reconciliation.every(row => row.result === 'MATCH') ? 'PASS_FILECHANGE_CANONICAL_READBACK' : 'NOT_PROVEN', readerPid: process.pid, binding: context.binding, checkedAt: new Date(now).toISOString(), records: data.records.filter(row => row.fact.itemType === 'fileChange').length, reconciliation, evidenceClass: context.evidenceClass === 'runtime' ? 'RUNTIME_CLAIM_REQUIRES_SOURCE_REVIEW' : 'PROTOCOL_FIXTURE', historyQueried: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) readFileChanges(process.argv[2]).then(result => { console.log(JSON.stringify(result)); if (result.result !== 'PASS_FILECHANGE_CANONICAL_READBACK') process.exitCode = 2; }).catch(() => { console.error('FILECHANGE_READBACK_FAILED'); process.exitCode = 1; });
