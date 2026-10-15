import { createHash } from 'node:crypto';

export const DAY_MS = 86400000;
const METHODS = new Set(['turn/started', 'turn/completed', 'item/started', 'item/completed', 'thread/status/changed', 'history.item', 'history.turn']);
const ITEM_TYPES = new Set(['commandExecution', 'agentMessage', 'fileChange']);
const STATUSES = new Set(['inProgress', 'completed', 'failed', 'interrupted', 'declined', 'idle', 'active', 'notLoaded', 'systemError']);
const ID = /^[A-Za-z0-9_-]{1,160}$/;
export const hash = (value) => createHash('sha256').update(value).digest('hex');

export function validateBinding(binding) {
  const fields = ['repository', 'taskId', 'runId', 'attempt', 'producerInstanceId', 'threadId', 'sessionId', 'turnId'];
  if (!binding || Object.keys(binding).some(k => !fields.includes(k)) ||
      typeof binding.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(binding.repository) ||
      (binding.sessionId != null && (typeof binding.sessionId !== 'string' || !ID.test(binding.sessionId))) ||
      ![binding.taskId, binding.runId, binding.threadId, binding.turnId, binding.producerInstanceId].every(v => typeof v === 'string' && ID.test(v)) ||
      binding.taskId === binding.runId || !Number.isSafeInteger(binding.attempt) || binding.attempt < 1) {
    throw new Error('INVALID_LIFECYCLE_BINDING');
  }
  return binding;
}

// Exact proof-output allowlist is deliberately narrower than a secret-pattern scrubber.
// Unknown/customer/freeform text is rejected even if it contains no known secret pattern.
export function approvedOutput(raw, nonce) {
  if (typeof raw !== 'string' || !/^BELLA_BATCH1_[a-f0-9]{24}$/.test(nonce || '') || raw.length > 1024) return null;
  const text = raw.replace(/\r\n/g, '\n');
  if (/(?:bearer\s+|(?:token|password|secret|api[_-]?key)\s*[:=]|-----BEGIN)/i.test(text)) return null;
  const lines = text.trimEnd().split('\n');
  if (lines.length !== 3 || lines[0] !== nonce || lines[2] !== 'ASSERT_19_PLUS_23_EQ_42=PASS' ||
      !/^UTC=\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(lines[1]) || !Number.isFinite(Date.parse(lines[1].slice(4)))) return null;
  return { text, sha256: hash(text) };
}

function timestamp(ms) {
  return Number.isSafeInteger(ms) && ms >= 0 && ms <= 8640000000000000 ? new Date(ms).toISOString() : null;
}

function fact(binding, method, item, status, receivedAt, sourceMs, nonce, sourceKind) {
  validateBinding(binding);
  if (!METHODS.has(method) || !Number.isFinite(Date.parse(receivedAt))) throw new Error('INVALID_LIFECYCLE_FACT');
  if (status !== null && !STATUSES.has(status)) throw new Error('UNKNOWN_SOURCE_STATUS');
  const output = item?.type === 'commandExecution' && (method.endsWith('completed') || method === 'history.item')
    ? approvedOutput(item.aggregatedOutput, nonce) : null;
  return {
    schemaVersion: 1, repository: binding.repository, taskId: binding.taskId,
    runId: binding.runId, attempt: binding.attempt, producerInstanceId: binding.producerInstanceId,
    threadId: binding.threadId, sessionId: binding.sessionId || null, turnId: binding.turnId,
    itemId: item?.id || null, method, itemType: item?.type || null, status,
    exitCode: item?.type !== 'fileChange' && Number.isSafeInteger(item?.exitCode) ? item.exitCode : null,
    sourceKind, sourceTimestamp: timestamp(sourceMs), receivedAt,
    output, collectionError: item?.type === 'commandExecution' && typeof item.aggregatedOutput === 'string' && item.aggregatedOutput.length > 0 && !output ? 'OUTPUT_NOT_ALLOWLISTED' : null,
  };
}

export function normalizeNotification(message, binding, receivedAt, nonce) {
  const p = message?.params;
  if (!p || !METHODS.has(message.method) || message.method.startsWith('history.')) return null;
  const turnId = p.turnId || p.turn?.id;
  if (p.threadId !== binding.threadId || (message.method !== 'thread/status/changed' && turnId !== binding.turnId)) return null;
  if (message.method.startsWith('item/') && (!ITEM_TYPES.has(p.item?.type) || !ID.test(p.item?.id || ''))) return null;
  const item = message.method.startsWith('item/') ? p.item : null;
  const status = message.method === 'thread/status/changed' ? p.status?.type : p.turn?.status || item?.status || null;
  return fact(binding, message.method, item, status, receivedAt, p.completedAtMs ?? p.startedAtMs, nonce, 'live_notification');
}

export function normalizeHistory(entry, binding, receivedAt, nonce) {
  if (entry?.turnId !== binding.turnId || !ITEM_TYPES.has(entry.item?.type) || !ID.test(entry.item?.id || '')) return null;
  return fact(binding, 'history.item', entry.item, entry.item.status || null, receivedAt, entry.completedAtMs ?? entry.startedAtMs, nonce, 'history_snapshot');
}

export function normalizeHistoryTurn(turn, binding, receivedAt) {
  if (turn?.id !== binding.turnId) return null;
  return fact(binding, 'history.turn', null, turn.status, receivedAt, Number.isSafeInteger(turn.completedAt) ? turn.completedAt * 1000 : null, null, 'history_snapshot');
}

export function logicalKey(f) {
  return [f.sourceKind, f.threadId, f.turnId, f.itemId || '-', f.method].join(':');
}

export function signature(f) {
  // Receipt time is a collector observation, not a source payload change.
  const payload = [f.itemType, f.status, f.exitCode, f.sourceTimestamp, f.output?.sha256 || null, f.collectionError];
  // Bind the new type's digest to its full identity without changing legacy
  // command/message signatures or any previously sealed package.
  return hash(JSON.stringify(f.itemType === 'fileChange' ? [f.repository, f.taskId, f.runId, f.attempt, f.producerInstanceId, f.threadId, f.sessionId, f.turnId, f.itemId, ...payload] : payload));
}

export function validateFact(f, binding, nonce) {
  validateBinding(binding);
  const fields = ['schemaVersion', 'repository', 'taskId', 'runId', 'attempt', 'producerInstanceId', 'threadId', 'sessionId', 'turnId', 'itemId', 'method', 'itemType', 'status', 'exitCode', 'sourceKind', 'sourceTimestamp', 'receivedAt', 'output', 'collectionError'];
  if (!f || Object.keys(f).length !== fields.length || Object.keys(f).some(k => !fields.includes(k)) ||
      f.schemaVersion !== 1 || ['repository', 'taskId', 'runId', 'attempt', 'producerInstanceId', 'threadId', 'turnId'].some(k => f[k] !== binding[k]) ||
      f.sessionId !== (binding.sessionId || null) || !METHODS.has(f.method) || !Number.isFinite(Date.parse(f.receivedAt)) ||
      (f.sourceTimestamp !== null && !Number.isFinite(Date.parse(f.sourceTimestamp))) ||
      (f.itemId !== null && !ID.test(f.itemId)) || (f.itemType !== null && !ITEM_TYPES.has(f.itemType)) ||
      (f.status !== null && !STATUSES.has(f.status)) || (f.exitCode !== null && !Number.isSafeInteger(f.exitCode)) ||
      (f.collectionError !== null && f.collectionError !== 'OUTPUT_NOT_ALLOWLISTED') ||
      f.sourceKind !== (f.method.startsWith('history.') ? 'history_snapshot' : 'live_notification')) throw new Error('INVALID_STORED_FACT');
  const isItem = f.method.startsWith('item/') || f.method === 'history.item';
  if ((isItem && (!f.itemId || !f.itemType)) || (!isItem && (f.itemId !== null || f.itemType !== null)) ||
      ((f.output || f.collectionError) && !(f.itemType === 'commandExecution' && (f.method === 'item/completed' || f.method === 'history.item')))) throw new Error('INVALID_STORED_FACT');
  if (f.output && (Object.keys(f.output).sort().join(',') !== 'sha256,text' || approvedOutput(f.output.text, nonce)?.sha256 !== f.output.sha256)) throw new Error('UNSAFE_OUTPUT');
  if (f.itemType === 'fileChange' && (f.exitCode !== null || f.output !== null || f.collectionError !== null)) throw new Error('INVALID_STORED_FACT');
}

// Strict reconciliation for file-change metadata. Each row's digest proves its
// own canonical payload; source and receipt timestamps are not interchangeable.
// History is never used to invent a missing live start or completion.
export function verifyFileChangeRecords(records, binding) {
  validateBinding(binding);
  const groups = new Map();
  records.forEach((row, index) => {
    const f = row?.fact;
    if (f?.itemType !== 'fileChange') return;
    validateFact(f, binding);
    if (row.digest !== signature(f) || row.key !== logicalKey(f)) throw new Error('FILECHANGE_DIGEST_OR_KEY_MISMATCH');
    if (!groups.has(f.itemId)) groups.set(f.itemId, []);
    groups.get(f.itemId).push({ ...row, index });
  });
  return [...groups].map(([itemId, rows]) => {
    const starts = rows.filter(r => r.fact.method === 'item/started');
    const finals = rows.filter(r => r.fact.method === 'item/completed');
    const snapshots = rows.filter(r => r.fact.method === 'history.item');
    let result = !finals.length ? 'MISSING_LIVE' : !snapshots.length ? 'MISSING_HISTORY' : 'MATCH';
    // Repeated identical notifications are harmless. Conflicting terminal
    // revisions must not be hidden by Map last-write-wins behavior.
    if ([starts, finals, snapshots].some(group => new Set(group.map(r => r.digest)).size > 1)) result = 'CONFLICTING_DUPLICATE';
    if (result === 'MATCH' && !starts.length) result = 'MISSING_START';
    if (result === 'MATCH' && starts[0].fact.status !== 'inProgress') result = 'INVALID_START_STATUS';
    if (result === 'MATCH' && starts[0].index >= finals[0].index) result = 'INVALID_ORDER';
    if (result === 'MATCH' && (!['completed', 'failed', 'declined'].includes(finals[0].fact.status) || finals[0].fact.status !== snapshots[0].fact.status)) result = 'CONFLICT';
    return { itemId, result };
  });
}

export function reconcile(records) {
  const finals = records.filter(r => r.fact.method === 'item/completed' || r.fact.method === 'turn/completed');
  const snapshots = records.filter(r => r.fact.sourceKind === 'history_snapshot');
  const key = f => JSON.stringify([f.repository, f.taskId, f.runId, f.attempt, f.producerInstanceId, f.sessionId, f.threadId, f.turnId, f.itemId || '@turn']);
  const live = new Map(finals.map(r => [key(r.fact), r.fact]));
  const history = new Map(snapshots.map(r => [key(r.fact), r.fact]));
  return [...new Set([...live.keys(), ...history.keys()])].map(id => {
    const a = live.get(id), b = history.get(id);
    let result = !a ? 'MISSING_LIVE' : !b ? 'MISSING_HISTORY' : 'MATCH';
    if (a && b && (a.status !== b.status || a.exitCode !== b.exitCode || a.itemType !== b.itemType ||
        Boolean(a.output) !== Boolean(b.output) || a.collectionError !== b.collectionError ||
        (a.output && b.output && a.output.sha256 !== b.output.sha256))) result = 'CONFLICT';
    if (result === 'MATCH' && (a.collectionError || b.collectionError)) result = 'OUTPUT_UNVERIFIABLE';
    if (result === 'MATCH' && records.some(r => key(r.fact) === id && r.outputState === 'EXPIRED')) result = 'OUTPUT_EXPIRED';
    return { itemId: (a || b).itemId || null, result };
  });
}
