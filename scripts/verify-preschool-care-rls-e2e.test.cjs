'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function harness(mock, exported) {
  const file = join(__dirname, 'verify-preschool-care-rls-e2e.cjs');
  const source = readFileSync(file, 'utf8');
  const entry = "main().catch(() => { console.error('CARE_E2E_FATAL_SANITIZED'); process.exitCode = 1; });";
  assert.equal(source.split(entry).length, 2);
  const scopedRequire = id => id === 'node:fs' && mock.fs ? { ...require(id), ...mock.fs } : require(id);
  const context = vm.createContext({ require: scopedRequire, __dirname, Buffer, URL, structuredClone, Date,
    setTimeout, fetch: () => assert.fail('No network allowed in fault tests'), mock,
    process: { once() {}, env: {}, argv: [], platform: 'win32' }, module: { exports: {} } });
  vm.runInContext(source.replace(entry, '') + '\n' + exported, context, { filename: file });
  return context.module.exports;
}

function catalog(sha, fk) {
  return { sha256: sha, outsideSha256: 'outside6', outsideSevenSha256: 'outside7', controls: { stable: true },
    targets: Object.fromEntries(['edu_courses', 'edu_enrollments', 'party_parties', 'edu_attendance_daily_state', 'edu_daily_care_sessions', 'edu_daily_care_records'].map(name => [name, null])),
    timeline: { constraints: [{ name: 'timeline_events_primary_party_id_fkey', definition: fk, validated: true }] } };
}

test('Timeline lock timeout enters Care and FK recovery; no retained flags survive', async () => {
  const original = catalog('original', 'CASCADE'), careBefore = catalog('careBefore', 'RESTRICT'), prepared = catalog('prepared', 'RESTRICT');
  const calls = []; let current = prepared, lockFailures = 0;
  const mock = { original, careBefore, prepared,
    snapshot: async () => structuredClone(current),
    query: async sql => {
      calls.push(sql);
      if (sql === 'lock table public.party_parties,public.timeline_events in share row exclusive mode' && lockFailures++ === 0) {
        const error = new Error('synthetic lock timeout'); error.code = '55P03'; throw error;
      }
      if (sql.startsWith('select count(*)')) return { rows: [{ count: 0 }] };
      if (sql === 'drop table public.edu_attendance_daily_state') current = careBefore;
      if (sql === 'SYNTHETIC_FK_DOWN') current = original;
      return { rows: [], rowCount: 0 };
    } };
  const run = harness(mock, `
    async function snapshot() { return mock.snapshot(); }
    async function q(sql) { return mock.query(sql); }
    function stableSql() {}
    module.exports = async () => {
      args = { retain: true, timeline: true }; connected = true; preparationAttempted = true; committed = true;
      before = mock.careBefore; prepared = mock.prepared;
      timelineOriginal = mock.original; timelinePrepared = mock.careBefore; timelineAttempted = true; timelineCommitted = true;
      timelineSql = { down: 'SYNTHETIC_FK_DOWN' };
      bundle = { manifest: { policies: Object.fromEntries(EXISTING.map(t => [t, ['synthetic_allow','synthetic_guard']])) } };
      report.timelineFk = {};
      await recoverOrRetain(); await finalizeTimeline();
      return report;
    };`);
  const result = await run();
  assert.equal(result.cleanup.failures[0].code, '55P03');
  assert.equal(result.functionalAcceptance, 'FAIL');
  assert.equal(result.recovery.restored, true);
  assert.notEqual(result.recovery.retainedOnExplicitApprovedPass, true);
  assert.equal(result.timelineFk.recovery.restoredOriginalFk, true);
  assert.notEqual(result.timelineFk.recovery.retainedOnApprovedPass, true);
  assert.equal(calls.filter(sql => sql.startsWith('drop table ')).length, 3);
  assert.equal(calls.filter(sql => sql === 'SYNTHETIC_FK_DOWN').length, 1);
});

test('Interrupted checkpoint write preserves the previous published JSON and records evidence failure', () => {
  const published = '{"partial":true,"acceptance":"NOT_PROVEN","previous":true}\n';
  const files = new Map(); let destination, renamed = false;
  const run = harness({ fs: {
    mkdirSync() {},
    writeFileSync(file, value, options) {
      assert.equal(options.flush, true); assert.ok(file.endsWith('.json.tmp'));
      destination = file.slice(0, -4); files.set(destination, published);
      files.set(file, value.slice(0, 15)); // Failure before publish must not destroy the prior checkpoint.
      throw new Error('synthetic interrupted temporary write');
    },
    renameSync() { renamed = true; },
  } }, `module.exports = () => { args = { approved: true, output: 'unused' }; checkpoint(); return report; };`);
  const result = run();
  assert.equal(renamed, false);
  assert.equal(files.get(destination), published);
  assert.equal(JSON.parse(files.get(destination)).previous, true);
  assert.equal(result.evidenceWriteFailure, 'PROGRESS_WRITE_FAILED');
});

test('Pooled startup timeout loss is bounded per transaction; a failed standalone statement rolls back', async () => {
  let inTransaction = false, statementTimeout = '2min', lockTimeout = '0'; const calls = [];
  const run = harness({ query: async ({ text }) => {
    calls.push(text);
    if (text === 'begin') inTransaction = true;
    else if (text.startsWith('set local lock_timeout=')) {
      assert.equal(inTransaction, true); statementTimeout = '30s'; lockTimeout = '5s';
    } else if (text.startsWith("select current_setting('lock_timeout')")) {
      return { rows: [{ statement_timeout: statementTimeout, lock_timeout: lockTimeout }] };
    } else if (text === 'synthetic failure') { const error = new Error('synthetic timeout'); error.code = '57014'; throw error; }
    else if (['commit', 'rollback'].includes(text)) { inTransaction = false; statementTimeout = '2min'; lockTimeout = '0'; }
    return { rows: [{ bounded: true }], rowCount: 1 };
  } }, `module.exports = async () => {
    db = { query: mock.query }; args = { approved: false };
    const positive = await q('select synthetic');
    let rejected;
    try { await q('synthetic failure'); } catch (error) { rejected = safeCode(error); }
    return { positive, rejected, transaction, report };
  };`);
  const result = await run();
  assert.equal(result.positive.rows[0].bounded, true);
  assert.equal(result.rejected, '57014'); assert.equal(result.transaction, false);
  assert.equal(inTransaction, false); assert.equal(statementTimeout, '2min');
  assert.equal(calls.at(-1), 'rollback');
  assert.equal(result.report.effectiveTransactionTimeouts.statement_timeout, '30s');
  assert.equal(result.report.databaseErrorReceipts[0].code, '57014');
  assert.match(result.report.databaseErrorReceipts[0].statementSha256, /^[a-f0-9]{64}$/);
});

test('Lost COMMIT and rollback acknowledgements block ordinary SQL until resynchronized; write outcome stays unproven', async () => {
  const calls = []; let lostCommit = true, lostRollback = true;
  const run = harness({ query: async ({ text }) => {
    calls.push(text);
    if (text.startsWith("select current_setting('lock_timeout')")) return { rows: [{ lock_timeout: '5s', statement_timeout: '30s' }] };
    if (text === 'commit' && lostCommit) { lostCommit = false; throw new Error('Query read timeout'); }
    if (text === 'rollback' && lostRollback) { lostRollback = false; throw new Error('Query read timeout'); }
    return { rows: [], rowCount: 0 };
  } }, `module.exports = async () => {
    db = { query: mock.query }; args = { approved: false };
    try { await q('synthetic write'); } catch { /* The server may already have committed. */ }
    const uncertainBefore = transactionUncertain;
    let blocked;
    try { await q('must never reach database'); } catch (error) { blocked = safeCode(error); }
    await q('rollback');
    await q('select after resynchronization');
    return { uncertainBefore, blocked, transactionUncertain, report };
  };`);
  const result = await run();
  assert.equal(result.uncertainBefore, true);
  assert.equal(result.blocked, 'TRANSACTION_STATE_UNCERTAIN_ROLLBACK_REQUIRED');
  assert.equal(calls.includes('must never reach database'), false);
  assert.equal(result.transactionUncertain, false);
  assert.equal(result.report.uncertainTransactionOutcomes.length, 1);
  assert.equal(result.report.uncertainTransactionOutcomes[0].phase, 'COMMIT');
  assert.equal(result.report.uncertainTransactionOutcomes[0].outcome, 'NOT_PROVEN_COMMITTED_OR_ROLLED_BACK');
  assert.equal(result.report.databaseErrorReceipts[0].phase, 'COMMIT');
});

test('Replacement Party UUID is rejected before DELETE even with matching tenant census', async () => {
  const identities = JSON.parse(readFileSync(join(__dirname, '../docs/audits/preschool-full-audit-20261020/batch2m-timeline-fk/prior-fixture-identities.json'), 'utf8'));
  const calls = [];
  const mock = { query: async sql => {
    calls.push(sql);
    if (sql.startsWith('select id from public.tenants')) return { rows: identities.tenantIds.map(id => ({ id })) };
    if (sql.startsWith('select id,tenant_id,created_at')) return { rows: identities.parties.map((item, index) => ({
      id: index === 0 ? '00000000-0000-4000-8000-000000000001' : item.id, tenant_id: item.tenantId, created_at: new Date(item.createdAt) })) };
    return { rows: [], rowCount: 0 };
  } };
  const run = harness(mock, `async function q(sql) { return mock.query(sql); }
    module.exports = () => cleanupPreviousParties();`);
  await assert.rejects(run, error => error.acceptanceCode === 'PRIOR_PARTY_IDENTITY_DRIFT');
  assert.equal(calls.some(sql => /^delete /i.test(sql)), false);
  assert.equal(calls.at(-1), 'rollback');
});
