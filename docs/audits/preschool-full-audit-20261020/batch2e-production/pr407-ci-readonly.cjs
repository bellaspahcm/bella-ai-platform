const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const expectedHead = 'b85722f6eab1aedc3d9bd977bd3deee19e5684e5', commands = [];
function gh(args) {
  const result = cp.spawnSync('gh', [...args, '--repo', 'bellaspahcm/bella-ai-platform'], { encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 15000000 });
  commands.push({ command: ['gh', ...args], exitCode: result.status }); if (result.status !== 0) throw Error('GITHUB_READ_FAILED'); return result.stdout;
}
const raw = JSON.parse(gh(['pr', 'view', '407', '--json', 'number,url,state,isDraft,headRefName,headRefOid,baseRefName,mergeStateStatus,statusCheckRollup']));
if (raw.headRefOid !== expectedHead) throw Error('PR_SOURCE_DRIFT');
const checks = raw.statusCheckRollup.map(item => ({ name: item.name || item.context, workflow: item.workflowName || null, state: item.status || item.state, conclusion: item.conclusion || null, url: item.detailsUrl || item.targetUrl || null }));
const counts = [];
for (const [kind, id] of [['affected-unit', '118931158758'], ['logistics-kernel', '118931083603']]) {
  try {
    const log = gh(['run', 'view', '--job', id, '--log']).replace(/\x1b\[[0-9;]*m/g, '');
    const summaries = [...log.matchAll(/(?:Test Suites|Tests):\s*\d[^\r\n]*/g)].map(match => match[0]);
    counts.push({ kind, jobId: id, summaries, rawBusinessOutputSaved: false });
  } catch { counts.push({ kind, jobId: id, result: 'COUNTS_NOT_PROVEN' }); }
}
const fail = checks.filter(item => ['FAILURE', 'ERROR'].includes(item.state) || ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(item.conclusion));
const pending = checks.filter(item => ['PENDING', 'IN_PROGRESS', 'QUEUED', 'EXPECTED'].includes(item.state));
const report = { checkedAt: new Date().toISOString(), url: raw.url, source: expectedHead, branch: raw.headRefName, draft: raw.isDraft, state: raw.state, mergeStateStatus: raw.mergeStateStatus, checks, counts, commands,
  failed: fail.map(row => row.name), pending: pending.map(row => row.name), skipped: checks.filter(row => row.conclusion === 'SKIPPED').map(row => row.name), result: fail.length ? 'FAIL' : pending.length ? 'PENDING' : 'EMITTED_CHECKS_COMPLETED_WITHOUT_FAILURE',
  realAuthenticatedRls: 'NOT_PROVEN', fullProductGoLive: 'NOT_READY', mergePerformed: false, productionSourceRollout: 'NOT_RUN' };
const stamp = report.checkedAt.replace(/[:.]/g, '-');
fs.writeFileSync(path.join(__dirname, 'pr407-ci-' + stamp + '.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'pr407-ci-latest.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ checkedAt: report.checkedAt, source: report.source, result: report.result, failed: report.failed, pending: report.pending, skipped: report.skipped, counts, commandExits: commands.map(row => row.exitCode) }));
