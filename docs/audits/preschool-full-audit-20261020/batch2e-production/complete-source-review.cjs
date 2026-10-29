const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const groupId = process.argv[2];
const folders = { care: 'batch2g-care-auth', portal: 'batch2h-parent-access', announcements: 'batch2i-announcements' };
if (!folders[groupId]) throw Error('Unknown held group');
const receipts = JSON.parse(fs.readFileSync(path.join(__dirname, 'source-review-receipts.json')));
const reviewers = receipts.filter(item => item.group === groupId);
if (reviewers.length !== 3 || new Set(reviewers.map(row => row.role)).size !== 3 || reviewers.some(row => row.conclusion !== 'No actionable introduced defect')) throw Error('Three completed clean reviews required');
const summaryPath = path.join(__dirname, 'source-groups-summary.json');
const summary = JSON.parse(fs.readFileSync(summaryPath));
const group = summary.groups.find(item => item.group === groupId), folder = path.join(group.root, 'docs/audits/preschool-full-audit-20261020', folders[groupId]);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (!group.files.every(file => sha(fs.readFileSync(path.join(group.root, file.file))) === file.sha256)) throw Error('Source differs from reviewed manifest');
const reviewedAt = new Date().toISOString();
const review = { recordedAt: reviewedAt, scope: 'Source only; same-capability independent fresh sessions, fork_turns none', reviewers, outcome: 'No actionable introduced defect remains', runtimeRls: 'NOT_PROVEN', fullRegression: 'FAIL_ENVIRONMENT', releaseReadiness: 'NOT_PROVEN', historicalLimit: 'Initial agent usage-limit failures preserved separately; fresh reviewer sessions subsequently completed after user continuation' };
fs.writeFileSync(path.join(folder, 'review-results.json'), JSON.stringify(review, null, 2) + '\n');
const status = path.join(folder, 'review/STATUS.json'), history = path.join(folder, 'review/STATUS-initial-limit.json');
if (!fs.existsSync(history)) fs.copyFileSync(status, history);
fs.writeFileSync(status, JSON.stringify({ recordedAt: reviewedAt, status: 'COMPLETED_SOURCE_ONLY', reviewers: reviewers.map(row => row.agent), historicalLimit: 'STATUS-initial-limit.json', sourceManifest: '../source-manifest.json', runtimeRls: 'NOT_PROVEN' }, null, 2) + '\n');
const finalFile = path.join(folder, 'FINAL_REPORT.md'), oldFinal = path.join(folder, 'FINAL_REPORT-initial-review-blocked.md');
if (!fs.existsSync(oldFinal)) fs.copyFileSync(finalFile, oldFinal);
let final = fs.readFileSync(finalFile, 'utf8');
final = final.replace('Independent review: BLOCKED_AGENT_USAGE_LIMIT. No final independent review is available; usage-limit failures are not PASS. Use the three fresh-session prompts under review/.', 'Independent review: COMPLETED_SOURCE_ONLY. All three fresh reviewers subsequently completed, no actionable introduced defect remained. Initial quota failure records are retained separately; they were never counted as PASS.');
final += '\nReview completion recorded ' + reviewedAt + '. Current source bytes match the reviewed manifest. No runtime source changed during review; no new test run was needed. Local commit may seal source/evidence only; full Platform regression, real authenticated RLS and source rollout remain separate unresolved gates.\n';
fs.writeFileSync(finalFile, final.trimEnd() + '\n');
const verificationPath = path.join(folder, 'verification.json'), verification = JSON.parse(fs.readFileSync(verificationPath));
verification.independentReview = 'COMPLETED_SOURCE_ONLY'; verification.reviewReceipt = 'review-results.json'; verification.reviewCompletedAt = reviewedAt;
fs.writeFileSync(verificationPath, JSON.stringify(verification, null, 2) + '\n');
const specPath = path.join(folder, 'SPEC.md'); let spec = fs.readFileSync(specPath, 'utf8');
spec = spec.replace('status: in-review', 'status: done');
spec = spec.replace(/- \[ \] Lead verification:[^\r\n]*/g, '- [x] Lead verification: native focused Jest/lint/scoped TS/secret checks and actual HTTP PASS; all three independent source reviews completed. Real-user/RLS/atomicity/production limits remain recorded.');
spec = spec.replace('Source implementation and local checks complete. Independent source review is BLOCKED: agents returned usage-limit errors. Implementation checkboxes do not certify the pending review. Three standalone reviewer prompts and the source diff are prepared under review/. No source delivery or release-readiness claim.', 'Bounded source implementation, local checks and three independent source reviews are complete. Initial agent quota failures remain historical records under review/. No actionable introduced defect remained; source review does not prove runtime/RLS or release readiness.');
if (!spec.includes('## Suggested Review Order')) {
  spec += '\n## Suggested Review Order\n\n';
  for (const file of group.files) {
    const relative = path.relative(folder, path.join(group.root, file.file)).replace(/\\/g, '/');
    const lines = fs.readFileSync(path.join(group.root, file.file), 'utf8').split(/\r?\n/);
    let index = lines.findIndex(line => /export async function (POST|GET)|export class|describe\(/.test(line)); if (index < 0) index = 0;
    spec += '- ' + (file.file.includes('__tests__') ? 'Check denied resources, authorized behavior and side-effect exclusion.' : 'Trace identity/resource checks before existing execution or explicit dependency holds.') + '\n  [' + path.basename(file.file) + ':' + (index + 1) + '](' + relative + '#L' + (index + 1) + ')\n\n';
  }
}
fs.writeFileSync(specPath, spec.trimEnd() + '\n');
group.independentReview = 'COMPLETED_SOURCE_ONLY'; group.reviewCompletedAt = reviewedAt;
summary.capturedAt = reviewedAt;
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ group: groupId, reviewedAt, reviewers: reviewers.map(row => row.agent), sourceMatchesManifest: true, runtimeChanged: false, sourceRollout: 'NOT_RUN' }));
