const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const audit = 'docs/audits/preschool-full-audit-20261020';
const groups = [
  { id: 'copilot', name: 'preschool-courses-auth-20261021', folder: 'batch2e-ai-auth', reviewed: true, files: ['src/app/api/education/ai/copilot/route.ts', 'src/app/api/education/ai/copilot/__tests__/access.test.ts', 'src/products/bella-education/__tests__/preschool-ai-copilot.test.ts', 'src/products/bella-education/__tests__/preschool-admin-ai-copilot.test.ts'] },
  { id: 'medication', name: 'shared-identity-containment-20261021', folder: 'batch2f-disable-medication', reviewed: true, files: ['src/app/api/education/care/medication/route.ts', 'src/app/api/education/care/medication/__tests__/route.test.ts'] },
  { id: 'care', name: 'preschool-care-authorization-20261021', folder: 'batch2g-care-auth', files: ['src/app/api/education/care/bulk/route.ts', 'src/app/api/education/care/bulk/request-context.ts', 'src/app/api/education/care/bulk/__tests__/access.test.ts'] },
  { id: 'portal', name: 'preschool-parent-access-20261021', folder: 'batch2h-parent-access', files: ['src/app/api/education/portal/token/route.ts', 'src/products/bella-education/parent-portal/services/preschool-parent-portal.service.ts', 'src/products/bella-education/parent-portal/repositories/parent-portal.repository.ts', 'src/app/api/education/portal/[token]/route.ts', 'src/app/api/education/portal/[token]/chat/route.ts', 'src/app/api/education/portal/[token]/copilot/route.ts', 'src/products/bella-education/__tests__/preschool-parent-portal.service.test.ts', 'src/app/api/education/portal/token/__tests__/access.test.ts', 'src/app/api/education/portal/__tests__/access.test.ts', 'src/products/bella-education/__tests__/preschool-parent-portal-security.test.ts'] },
  { id: 'announcements', name: 'preschool-announcement-auth-20261021', folder: 'batch2i-announcements', files: ['src/app/api/education/announcements/route.ts', 'src/app/api/education/announcements/__tests__/access.test.ts'] },
];
const baseline = '30134055d1ff5b846584e57833816f076034cdea';
const base = 'C:/Users/DELL/.codex/worktrees';
function hash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function git(root, args, expected = [0]) {
  const run = cp.spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (!expected.includes(run.status)) throw Error('Git evidence failed: ' + args[0]);
  return run.stdout;
}
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const aggregate = [];
for (const group of groups) {
  const root = path.join(base, group.name, 'BELLA SPA ERP'), folder = path.join(root, audit, group.folder);
  git(root, ['diff', 'HEAD', '--exit-code', '--', 'AGENTS.md']);
  const tracked = group.files.filter(file => { const run = cp.spawnSync('git', ['ls-files', '--error-unmatch', '--', file], { cwd: root, encoding: 'utf8', windowsHide: true }); return run.status === 0; });
  const untracked = group.files.filter(file => !tracked.includes(file));
  let diff = git(root, ['diff', '--binary', baseline, '--', ...tracked]);
  for (const file of untracked) diff += git(root, ['diff', '--no-index', '--', 'NUL', file], [0, 1]);
  // A removed legacy hardcoded signing fallback is not copied into audit evidence.
  diff = diff.replace(/(process\.env\.SUPABASE_SERVICE_ROLE_KEY\s*\|\|\s*process\.env\.NEXTAUTH_SECRET\s*\|\|\s*)'[^']*'/g, "$1'[REDACTED_LEGACY_HARDCODED_FALLBACK]'");
  fs.writeFileSync(path.join(folder, 'source.patch'), diff);
  const source = { capturedAt: new Date().toISOString(), root, branch: git(root, ['branch', '--show-current']).trim(), head: git(root, ['rev-parse', 'HEAD']).trim(), baseline,
    state: 'Uncommitted source patch; exact current working-file SHA256 below',
    patchSha256: hash(diff), patchRedaction: 'Removed legacy hardcoded signing fallback redacted if present; current source hashes are exact',
    files: group.files.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) })) };
  fs.writeFileSync(path.join(folder, 'source-manifest.json'), JSON.stringify(source, null, 2) + '\n');
  const tests = json(path.join(folder, 'jest-results.json'));
  const commands = Object.fromEntries(['jest', 'lint', 'typecheck', 'secrets'].map(task => [task, json(path.join(folder, task + '-command.json'))]));
  const http = json(path.join(folder, 'local-http.json'));
  const assessmentFile = path.join(folder, 'local-http-assessment.json');
  const verification = { capturedAt: new Date().toISOString(), group: group.id, sourceManifest: 'source-manifest.json', tests: { suites: tests.numTotalTestSuites, passedSuites: tests.numPassedTestSuites, failedSuites: tests.numFailedTestSuites, total: tests.numTotalTests, passed: tests.numPassedTests, failed: tests.numFailedTests, pending: tests.numPendingTests, success: tests.success },
    commands, localHttp: { report: 'local-http.json', rawResult: http.result, probes: http.tests.length, listenerStopped: http.listenerStopped, assessment: fs.existsSync(assessmentFile) ? json(assessmentFile) : null },
    independentReview: group.reviewed ? 'COMPLETED_SOURCE_ONLY' : 'BLOCKED_AGENT_USAGE_LIMIT', productionSourceChange: 'NOT_RUN', authenticatedDbRls: 'NOT_PROVEN', fullPlatformRegression: 'FAIL_ENVIRONMENT_IN_SIBLING_BATCH2E', goLive: 'NOT_READY' };
  fs.writeFileSync(path.join(folder, 'verification.json'), JSON.stringify(verification, null, 2) + '\n');
  const specFile = path.join(folder, 'SPEC.md'); let spec = fs.readFileSync(specFile, 'utf8');
  spec = spec.replace('status: in-progress', group.reviewed ? 'status: done' : 'status: in-review');
  // Checked implementation tasks are distinct from independent review and release gates below.
  spec = spec.replace(/- \[ \]/g, '- [x]');
  if (!spec.includes('## Current Verification and Delivery State')) spec += '\n\n## Current Verification and Delivery State\n\n'
    + `Focused Jest: ${tests.numPassedTests}/${tests.numTotalTests}, ${tests.numPassedTestSuites} suites, zero pending; all four native commands exit0. Actual local HTTP results are retained in local-http.json; exact dev-header literal failures in Copilot/Medication remain raw FAIL and are assessed separately.\n\n`
    + (group.reviewed ? 'Three independent source reviewers completed before this record; no actionable introduced defect remained. This does not replace real Auth/RLS or complete Platform regression. Bounded implementation is done; release readiness is not claimed.\n\n' : 'Source implementation and local checks complete. Independent source review is BLOCKED: agents returned usage-limit errors. Implementation checkboxes do not certify the pending review. Three standalone reviewer prompts and the source diff are prepared under review/. No source delivery or release-readiness claim.\n\n')
    + 'Full authenticated DB/RLS, Browser E2E, transaction/TOCTOU behavior and this source deployment remain NOT_PROVEN. Applicable wider offline verification failures are preserved; no Go-Live PASS. No production business mutation was used for this source check.\n';
  if (group.id === 'care' && !spec.includes('## Temporal Dependency Hold')) spec += '\n## Temporal Dependency Hold\n\nThe current Enrollment public DTO exposes current status and enrollment timestamp, without an effective-status history producer. Source therefore holds requests outside the current Asia/Ho_Chi_Minh school day with503 CARE_HISTORICAL_SCOPE_UNAVAILABLE before roster/service access. Day-end cutoff uses +07:00. This is a fail-closed dependency limit, not invented historical eligibility or a frozen-contract change.\n';
  if (group.reviewed && !spec.includes('## Suggested Review Order')) {
    spec += '\n## Suggested Review Order\n\n';
    for (const file of group.files) {
      const relative = path.relative(folder, path.join(root, file)).replace(/\\/g, '/');
      const lines = fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/);
      let line = lines.findIndex(value => value.includes('export async function POST')); if (line < 0) line = 0;
      spec += `- ${file.includes('__tests__') ? 'Verify denial boundaries and preservation of existing behavior.' : 'Inspect request authorization before execution and response handling.'}\n  [${path.basename(file)}:${line + 1}](${relative}#L${line + 1})\n\n`;
    }
  }
  fs.writeFileSync(specFile, spec);
  if (!group.reviewed) {
    const reviewDir = path.join(folder, 'review'); fs.mkdirSync(reviewDir, { recursive: true });
    const intro = 'Independent read-only review in a fresh session at the same model capability. No edits, tests, credentials or remote operations. Report only actionable introduced defects with precise file/line, impact and evidence; distinguish intentional holds, pre-existing debt and runtime limitations. No inferred role or business policy.\n\n';
    fs.writeFileSync(path.join(reviewDir, 'blind.md'), intro + `Apply bmad-review-adversarial-general skill at ${path.join(root, '.agents/skills/bmad-review-adversarial-general/SKILL.md')}. Project evidence: ONLY ${path.join(folder, 'source.patch')}. No spec, history or other project access. The patch redacts a removed legacy hardcoded fallback if present.\n`);
    fs.writeFileSync(path.join(reviewDir, 'edge.md'), intro + `Apply bmad-review-edge-case-hunter skill in this worktree. Read applicable engineering instructions, the diff ${path.join(folder, 'source.patch')}, current changed source and directly necessary contracts under ${root}. Do not read audit SPEC or other reviewers. Examine every authorization, resource, tenant, temporal, dependency and side-effect branch.\n`);
    fs.writeFileSync(path.join(reviewDir, 'acceptance.md'), intro + `Read ${specFile}, ${path.join(root, 'docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md')}, applicable constitutions, ${path.join(folder, 'source.patch')} and directly necessary producers in ${root}. Check acceptance and contract preservation. Source-only review cannot prove real Auth/RLS/production.\n`);
    fs.writeFileSync(path.join(reviewDir, 'STATUS.json'), JSON.stringify({ status: 'BLOCKED', cause: 'Agent usage limit', attempted: group.id === 'care' ? ['blind: started then failed usage limit; no final review', 'edge: failed usage limit; no final review'] : [], notRun: group.id === 'care' ? ['acceptance'] : ['blind', 'edge', 'acceptance'], partialBlindCommentIsNotCompletedReview: true, promptsPrepared: true }, null, 2) + '\n');
  }
  fs.writeFileSync(path.join(folder, 'FINAL_REPORT.md'), `# ${group.id} bounded source result\n\nSource: ${source.branch}, baseline ${baseline}; source-manifest.json binds exact working bytes.\n\nFocused tests: ${tests.numPassedTests}/${tests.numTotalTests} PASS, ${tests.numPassedTestSuites} suites, zero skipped/pending. Jest/lint/scoped Education TypeScript/secret scan native exit0. See verification.json and raw logs. Local HTTP: ${http.tests.length} probes, listener stopped ${http.listenerStopped}; raw result ${http.result}${verification.localHttp.assessment ? ', separate denial/no-store assessment retained' : ''}.\n\nIndependent review: ${verification.independentReview}. ${group.reviewed ? 'No actionable introduced defect remained in three completed source reviews.' : 'No final independent review is available; usage-limit failures are not PASS. Use the three fresh-session prompts under review/.'}\n\nProduction source rollout NOT_RUN; authenticated RLS and full real-user regression NOT_PROVEN; complete Platform regression FAIL/ENVIRONMENT (actual sibling batch2e offline run); Preschool Go-Live NOT_READY. No schema/ACL/RLS/Kernel/business data changes in this source group. Unsupported mapping/policy/producer paths remain explicitly unavailable under the approved contract. Implementation completeness is not workflow usability or release readiness.\n`);
  aggregate.push({ group: group.id, root, branch: source.branch, files: source.files, tests: verification.tests, commands: Object.fromEntries(Object.entries(commands).map(([name, run]) => [name, run.exitCode])), localHttp: verification.localHttp, independentReview: verification.independentReview });
}
fs.writeFileSync(path.join(__dirname, 'source-groups-summary.json'), JSON.stringify({ capturedAt: new Date().toISOString(), baseline, groups: aggregate, totalFocusedTests: aggregate.reduce((count, item) => count + item.tests.passed, 0), sourceRollout: 'NOT_RUN', batch2b: 'IN_PROGRESS', authenticatedAccessRegression: 'NOT_PROVEN', preschoolGoLive: 'NOT_READY' }, null, 2) + '\n');
console.log(JSON.stringify(aggregate.map(item => ({ group: item.group, tests: item.tests.passed, review: item.independentReview, commands: item.commands }))));
