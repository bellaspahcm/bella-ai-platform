/* Audit evidence only. Does not change application code or contact a real DB. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const out = __dirname;
const roots = ['src/app/api/education', 'src/app/dashboard/education', 'src/products/bella-education', 'src/platform/education'];
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name).replaceAll('\\', '/')]);
}
const files = roots.flatMap(walk);
const tests = files.filter(file => /\.test\.tsx?$/.test(file));
const probeMode = process.argv.includes('--probes');
const securityMode = process.argv.includes('--security');
const conformanceMode = process.argv.includes('--conformance');
const selected = probeMode ? ['docs/audits/preschool-operations-20261031/behavior-probes.probe.ts']
  : conformanceMode ? ['src/products/bella-education/__tests__/bella-education-conformance.integration.test.ts',
    'src/products/bella-education/__tests__/bella-education-customization-conformance.integration.test.ts',
    'src/products/bella-education/__tests__/bella-education-extension-conformance.integration.test.ts']
  : securityMode ? ['src/__tests__/auth-guards.test.ts', 'src/__tests__/preschool-containment.test.ts',
    'src/__tests__/education-attendance-request-context.test.ts', 'src/__tests__/proxy-course-catalog-cache.test.ts',
    'src/__tests__/supabase-server-env.test.ts', 'src/platform/security/__tests__/current-actor-contract.test.ts']
  : tests.filter(file => !/(real-db|real\.db|\.integration\.|conformance|verification-gates)/.test(file));
const routes = files.filter(file => file.endsWith('/route.ts')).map(file => {
  const source = fs.readFileSync(file, 'utf8');
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = parsed.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text);
  return { file, methods: [...source.matchAll(/export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE)/g)].map(match => match[1]),
    imports, tables: [...new Set([...source.matchAll(/\.from\(['"]([^'"]+)/g)].map(match => match[1]))],
    rpcs: [...new Set([...source.matchAll(/\.rpc\(['"]([^'"]+)/g)].map(match => match[1]))],
    privilegedClientReference: /getSupabaseAdminKey|requireSupabaseAdminEnv|createAdminClient|createAdminOperationClient|createOperationClient/.test(source),
    privateCacheReference: /private, no-store|PRIVATE_HEADERS|privateHeaders|COURSE_PRIVATE_HEADERS|CANONICAL_COURSE_HEADERS/.test(source) };
});
const inventory = { sourceRevision: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
  branch: spawnSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).stdout.trim(),
  scopeFiles: files.length, pages: files.filter(file => file.endsWith('/page.tsx')), routes,
  selectedLocalTests: selected, excludedTests: tests.filter(file => !selected.includes(file)),
  limitation: 'Static inventory flags are review leads, not findings. Local mocks do not prove DB/RLS/browser/Production.' };
if (!probeMode && !securityMode && !conformanceMode) {
  fs.writeFileSync(path.join(out, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
  const routeLines = ['# Preschool API surface inventory', '',
    'Source: ' + inventory.sourceRevision + '. Generated from source; flags are review leads, not effective DB/authorization proof.', '',
    '| Route | Methods | Privileged client reference | Tables (literal) | RPC (literal) |',
    '| --- | --- | --- | --- | --- |',
    ...routes.map(route => '| `' + route.file.replace('src/app', '').replace('/route.ts', '') + '` | '
      + route.methods.join(', ') + ' | ' + (route.privilegedClientReference ? 'YES — inspect contract' : 'No local reference')
      + ' | ' + route.tables.join(', ') + ' | ' + route.rpcs.join(', ') + ' |'), '',
    'Dynamic RPC names, imported factories and contract-owned queries require tracing their owning source. GET-only/read-only/held handlers are identified in REPORT.md; an exported method alone does not mean mutation is enabled.', ''];
  fs.writeFileSync(path.join(out, 'ROUTE_MATRIX.md'), routeLines.join('\n'));
  const sourceFiles = files.filter(file => /\.tsx?$/.test(file) && !/(\.test\.|__tests__)/.test(file));
  const migrations = fs.readdirSync('supabase/migrations').filter(file => /(education|preschool|edu_|parent_communication|current_actor|platform_identity)/.test(file))
    .map(file => 'supabase/migrations/' + file);
  const governance = ['docs/governance/BELLA_AI_CODING_CONSTITUTION.md', 'docs/governance/OPERATIONAL_RULES.md',
    'docs/governance/BELLA_BMAD_ORCHESTRATION.md', 'docs/governance/OPERATIONAL_READINESS_SOP.md',
    'docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md', 'docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md',
    'src/lib/supabase-server.ts', 'src/services/user-actions.ts', 'src/proxy.ts'];
  fs.writeFileSync(path.join(out, 'source-hashes.json'), JSON.stringify({ sourceRevision: inventory.sourceRevision,
    algorithm: 'SHA-256 of observed working-tree bytes', files: [...new Set([...sourceFiles, ...migrations, ...governance])]
      .map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') })) }, null, 2) + '\n');
}
console.log(JSON.stringify({ scopeFiles: files.length, routes: routes.length, pages: inventory.pages.length,
  selectedTests: selected.length, excludedTests: inventory.excludedTests.length }));
if (!process.argv.includes('--run')) process.exit(0);
const prefix = probeMode ? 'probe' : securityMode ? 'security' : conformanceMode ? 'conformance' : 'local';
const log = fs.openSync(path.join(out, prefix + '-tests.log'), 'w');
const args = ['node_modules/jest/bin/jest.js', '--runInBand', '--runTestsByPath', ...selected,
  '--json', '--outputFile=' + path.join(out, prefix + '-tests.json'), '--silent',
  ...(probeMode ? ['--testMatch=**/docs/audits/preschool-operations-20261031/behavior-probes.probe.ts'] : [])];
const started = new Date().toISOString();
const result = spawnSync(process.execPath, args, { stdio: ['ignore', log, log], windowsHide: true,
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://mock.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-audit-public-key', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-audit-public-key',
    SUPABASE_URL: 'https://mock.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key', SUPABASE_SECRET_KEY: 'synthetic-audit-secret-key',
    DATABASE_URL: '', SUPABASE_DATABASE_URL: '', SUPABASE_DB_URL: '', PRESCHOOL_PROOF_DB_URL: '',
    NEXT_TELEMETRY_DISABLED: '1' } });
fs.closeSync(log);
const summary = { started, finished: new Date().toISOString(), exitCode: result.status, signal: result.signal,
  sourceRevision: inventory.sourceRevision,
  command: 'node docs/audits/preschool-operations-20261031/audit-local.cjs --run' + (probeMode ? ' --probes' : securityMode ? ' --security' : conformanceMode ? ' --conformance' : ''),
  environment: 'Local Jest; synthetic Supabase configuration; external/Real DB suites excluded',
  selectedTests: selected.length };
if (fs.existsSync(path.join(out, prefix + '-tests.json'))) {
  const report = JSON.parse(fs.readFileSync(path.join(out, prefix + '-tests.json'), 'utf8'));
  for (const key of ['numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites',
    'numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests', 'success']) summary[key] = report[key];
  summary.failures = report.testResults.filter(test => test.status !== 'passed').map(test => ({ file: path.relative(process.cwd(), test.name),
    status: test.status, assertions: test.assertionResults.filter(assertion => assertion.status === 'failed')
      .map(assertion => ({ title: assertion.fullName, failureMessages: assertion.failureMessages })), message: test.message }));
}
fs.writeFileSync(path.join(out, prefix + '-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
process.exitCode = result.status ?? 1;
