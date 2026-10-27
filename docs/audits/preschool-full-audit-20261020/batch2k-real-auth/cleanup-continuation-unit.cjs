'use strict';
// Fault injection of the actual cleanup function. No Auth/DB/HTTP/network calls.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const script = fs.readFileSync(path.join(root, 'scripts/verify-preschool-real-auth-acceptance.cjs'), 'utf8');
const start = script.indexOf('async function cleanup() {');
const end = script.indexOf('async function main() {', start);
assert(start > 0 && end > start);
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'];
const attempted = [];
const state = { head: 'unit', tree: 'unit', sourceSha256: 'unit', changed: [], untracked: [], nextAutoEnvFiles: [] };
const report = { cleanup: { failures: [] }, sourceBefore: state };
let secondDeleted = false;
const context = vm.createContext({
  cleanupStarted: false, connected: true, transaction: false, fixtureWrites: false,
  sessions: [], authIntents: [], authCreated: ids, fixtures: [], report, catalogBefore: {},
  stopServer: async () => {}, restoreGeneratedAgents: () => {}, catalog: async () => ({}),
  sourceState: () => state,
  safeCode: error => error.code || error.message,
  must: (value, code) => { if (!value) throw Error(code); },
  admin: { auth: { admin: { deleteUser: async () => ({ error: null }) } } },
  db: {
    query: async (sql, values) => {
      if (sql.startsWith('select id from public.users')) return { rows: ids.map(id => ({ id })) };
      if (sql.startsWith('delete from public.users where id=$1')) {
        attempted.push(values[0]);
        if (values[0] === ids[0]) { const error = Error('Synthetic FK failure'); error.code = '23503'; throw error; }
        secondDeleted = true; return { rows: [] };
      }
      if (sql.includes('as auth_users')) return { rows: [{ auth_users: 0, public_users: 1,
        active_users: 0, tenants: 0, active_tenants: 0, branches: 0, persons: 0, relationships: 0 }] };
      return { rows: [] };
    },
    end: async () => {},
  },
});
vm.runInContext(script.slice(start, end) + '\nthis.runCleanup = cleanup;', context);
(async () => {
  await context.runCleanup();
  const result = { checkedAt: new Date().toISOString(),
    harnessSha256: crypto.createHash('sha256').update(script).digest('hex'),
    scope: 'Actual cleanup function with fake DB/Auth; not real Auth/RLS evidence', networkRequests: 0,
    laterOwnedProfileAttempted: attempted.includes(ids[1]), laterOwnedProfileDeleted: secondDeleted,
    failuresRetained: report.cleanup.failures.length, residualDetected: report.cleanup.failures.some(item => item.name === 'RESIDUAL_READBACK'),
    result: 'FAIL' };
  try {
    assert.deepEqual(attempted, ids);
    assert.equal(secondDeleted, true);
    assert(report.cleanup.failures.some(item => item.name === 'DELETE_RESIDUAL_OWN_PROFILE' && item.code === '23503'));
    assert(result.residualDetected);
    result.result = 'PASS';
  } catch { process.exitCode = 1; }
  fs.writeFileSync(path.join(__dirname, 'cleanup-continuation-' + result.checkedAt.replace(/[:.]/g, '-') + '.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
})().catch(() => { console.error('CLEANUP_UNIT_FAILED'); process.exitCode = 1; });
