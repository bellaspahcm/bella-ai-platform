'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../..');
function parse(value) {
  let current;
  const suites = new Set(), cases = new Set(), diagnostics = new Set();
  for (const line of value.replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/)) {
    const suite = /^FAIL[ \t]+([^\r\n]+?\.(?:test|spec)\.[jt]sx?)(?:[ \t]+\([^\r\n]*\))?[ \t]*$/.exec(line);
    if (suite) { current = suite[1].replaceAll('\\', '/'); suites.add(current); }
    if (/^PASS[ \t]/.test(line)) current = undefined;
    const heading = /^  ● (.+)$/.exec(line);
    if (current && heading && heading[1].trim() !== 'Console') {
      if (heading[1].trim().startsWith('Cannot log after tests are done.')) diagnostics.add(heading[1].trim());
      else cases.add(`${current} :: ${heading[1].trim()}`);
    }
  }
  return { failedSuites: [...suites].sort(), failedTestHeadings: [...cases].sort(), postRunDiagnostics: [...diagnostics].sort() };
}
// Timing suffixes, repeats, CRLF and the following PASS must not corrupt attribution.
const example = parse('FAIL src/a.test.ts (20.339 s)\r\n  ● first\r\nFAIL src/a.test.ts\n  ● first\nPASS src/b.test.ts\n  ● Console\nFAIL src/c.test.ts\n  ● second\n  ●  Cannot log after tests are done. Did you forget to wait for something async in your test?\n');
assert.deepEqual(example.failedSuites, ['src/a.test.ts', 'src/c.test.ts']);
assert.deepEqual(example.failedTestHeadings, ['src/a.test.ts :: first', 'src/c.test.ts :: second']);
assert.equal(example.postRunDiagnostics.length, 1);
const original = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-comparison-2026-10-21T04-34-49-404Z.json')));
const differences = (a, b) => a.filter(value => !b.includes(value));
const output = { capturedAt: new Date().toISOString(), baselineHead: original.baselineHead,
  rawComparison: 'baseline-comparison-2026-10-21T04-34-49-404Z.json',
  parserCorrection: 'Original parser omitted suite lines with timing suffixes and counted repeated failure summaries. Raw command exits/logs remain unchanged; this analysis supersedes its parsed suite lists.',
  parserNegativeControls: 'PASS', commands: [], fullRegression: 'NOT_PROVEN', reseal: 'HELD' };
for (const item of original.commands) {
  const education = item.command.includes('education');
  const priorDir = education ? 'batch2o-care-catalog' : 'batch2n-care-browser';
  const file = education ? 'education-verify.log' : 'healthcare-verify.log';
  const baselineLog = fs.readFileSync(path.join(__dirname, item.log), 'utf8');
  const currentLog = fs.readFileSync(path.join(root, `docs/audits/preschool-full-audit-20261020/${priorDir}/${file}`), 'utf8');
  const baseline = parse(baselineLog), current = parse(currentLog);
  const delta = { suitesOnlyBaseline: differences(baseline.failedSuites, current.failedSuites),
    suitesOnlyCurrent: differences(current.failedSuites, baseline.failedSuites),
    casesOnlyBaseline: differences(baseline.failedTestHeadings, current.failedTestHeadings),
    casesOnlyCurrent: differences(current.failedTestHeadings, baseline.failedTestHeadings) };
  const same = Object.values(delta).every(list => list.length === 0);
  output.commands.push({ command: item.command, actualNativeExitCodeBaseline: item.actualNativeExitCode,
    actualNativeExitCodeCurrentRetained: 1, baselineLog: item.log, currentRetainedLog: `${priorDir}/${file}`,
    baseline, current, delta, result: same && item.actualNativeExitCode === 1
      ? 'SAME_FAILED_SUITE_AND_CASE_IDENTITIES_ON_BASELINE' : 'INSPECT_DIFFERENCE',
    baselineSummaries: baselineLog.split(/\r?\n/).filter(line => /^(Test Suites:|Tests:)/.test(line)),
    currentRetainedSummaries: currentLog.split(/\r?\n/).filter(line => /^(Test Suites:|Tests:)/.test(line)) });
}
output.limitations = 'Retained current runs and fresh baseline use placeholder Supabase credentials. Matching failures prove reproduction on the baseline in this unavailable environment, not behavior on a real schema, not a blanket waiver, and not full-regression PASS.';
fs.writeFileSync(path.join(__dirname, 'baseline-analysis.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ parserNegativeControls: 'PASS', results: output.commands.map(item => ({ command: item.command,
  nativeExit: item.actualNativeExitCodeBaseline, suites: item.baseline.failedSuites.length,
  failureHeadings: item.baseline.failedTestHeadings.length, result: item.result,
  deltaCounts: Object.fromEntries(Object.entries(item.delta).map(([key, values]) => [key, values.length])) })), reseal: 'HELD' }));
