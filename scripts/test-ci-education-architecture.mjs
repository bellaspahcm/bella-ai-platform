import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compareBaseline, getAllTsFiles, scanViolations, scanDatabaseAccesses, compareResourceAccesses, resourceAccessSignature,
  legacyBaselineDigest, loadDispositionMetadata, validateDispositionMetadata, evaluateDatabaseControls } from './ci-run-education-architecture.mjs';

const reviewed = {
  "scheduling/repositories/preschool-scheduling.repository.ts:L42 - Direct database query targeting '.from('edu_' is prohibited in the Product layer.": 1,
};

const same = compareBaseline(reviewed, reviewed);
assert.equal(same.status, 'ALLOW');
assert.equal(same.added.length, 0);
console.log('PASS EDUCATION ARCH SAME BASELINE = ALLOW');

const withNewViolation = {
  ...reviewed,
  "learning-development/new-risk.service.ts:L10 - Direct database query targeting '.from('edu_' is prohibited in the Product layer.": 1,
};
const added = compareBaseline(reviewed, withNewViolation);
assert.equal(added.status, 'BLOCK');
assert.equal(added.added.length, 1);
console.log('PASS EDUCATION ARCH NEW VIOLATION = BLOCK');

const reduced = compareBaseline(reviewed, {});
assert.equal(reduced.status, 'ALLOW');
assert.equal(reduced.reduced.length, 1);
console.log('PASS EDUCATION ARCH DEBT REDUCTION = ALLOW');

test('line movement is allowed but increasing an existing signature count blocks', () => {
  const signature = Object.keys(reviewed)[0];
  const movedSignature = signature.replace(':L42', ':L90');
  assert.equal(compareBaseline(reviewed, { [movedSignature]: 1 }).status, 'ALLOW');
  const comparison = compareBaseline(reviewed, { [movedSignature]: 2 });
  assert.equal(comparison.status, 'BLOCK');
  assert.equal(comparison.added[0].delta, 1);
});

async function fixture(t, files) {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'bella-education-guard-'));
  t.after(async () => {
    const resolved = path.resolve(fixtureRoot);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir())
      || !path.basename(resolved).startsWith('bella-education-guard-')) {
      throw new Error('Unexpected fixture cleanup path');
    }
    await rm(resolved, { recursive: true, force: true });
  });
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(fixtureRoot, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return fixtureRoot;
}

test('the real scanner covers Product TSX, API, UI, and repeated calls on one line', async t => {
  const root = await fixture(t, {
    'product/read.ts': "client.from('edu_courses');",
    'product/panel.tsx': 'type Event<T = any> = { payload: T }; const view = <div/>;',
    'api/route.ts': "import { Student } from '@/platform/education/domain/student'; client.from('students');",
    'api/route.tsx': "client.rpc('read_students');",
    'ui/page.tsx': "import { Patient } from '@/products/bella-medical/patient'; client.from('students'); client.from('students'); const view = <div/>;",
    'product/__tests__/ignored.tsx': "client.rpc('ignored');",
    'product/ignored.d.ts': 'type Ignored = any;',
  });
  const roots = ['product', 'api', 'ui'].map(name => path.join(root, name));
  const files = (await Promise.all(roots.map(getAllTsFiles))).flat();
  assert.equal(files.length, 5);
  const result = await scanViolations(roots);
  assert.equal(Object.values(result.directDatabaseAccess).reduce((sum, count) => sum + count, 0), 5);
  assert.ok(Object.keys(result.directDatabaseAccess).some(key => key.includes('route.tsx')));
  assert.ok(Object.values(result.directDatabaseAccess).includes(2));
  assert.equal(Object.keys(result.internalKernelImports).length, 1);
  assert.equal(Object.keys(result.crossVerticalLeakage).length, 1);
  assert.equal(Object.keys(result.explicitAny).length, 1);
});

test('public contracts, unknown, comments, and literal any text remain allowed', async t => {
  const root = await fixture(t, {
    'page.tsx': "import type { StudentDTO } from '@/platform/education/contracts/student.contract'; const value: unknown = 'any'; // any\nconst view = <div>any</div>;",
  });
  const result = await scanViolations([root]);
  for (const category of Object.values(result)) assert.deepEqual(category, {});
});

test('resource inventory separates mixed ownership without approving a baseline exception', async t => {
  const root = await fixture(t, {
    'route.tsx': [
      "client.from('edu_courses'); client.from('edu_fin_invoices');",
      'client.rpc(\n  `preschool_save_care_records`\n);',
      "client.from(tableName); client.rpc(`command_${suffix}`);",
      "// client.from('edu_comment_only');",
      'const example = "client.rpc(\'string_only\')";',
      "/* client.from('edu_block_comment'); */",
      'Array.from({ length: 2 }); Buffer.from(payload);',
    ].join('\n'),
  });
  const inventory = await scanDatabaseAccesses([root]);
  assert.deepEqual(inventory.map(item => [item.method, item.target]), [
    ['from', 'edu_courses'], ['from', 'edu_fin_invoices'],
    ['rpc', 'preschool_save_care_records'], ['from', null], ['rpc', null],
  ]);
  assert.equal(inventory[2].line, 2);
  assert.equal(inventory[4].targetExpression, '`command_${suffix}`');
  const raw = await scanViolations([root]);
  assert.equal(compareBaseline({}, raw.directDatabaseAccess).status, 'BLOCK');
});

test('resource enforcement blocks target substitution hidden by the legacy prefix signature', async t => {
  const root = await fixture(t, { 'route.ts': "client.from('edu_fin_invoices').select('*');" });
  const before = await scanDatabaseAccesses([root]);
  const beforeRaw = await scanViolations([root]);
  const exact = { [resourceAccessSignature(before[0])]: 1 };
  assert.equal(compareResourceAccesses(exact, before).status, 'ALLOW');
  await writeFile(path.join(root, 'route.ts'), "client.from('edu_enrollments').select('*');");
  const after = await scanDatabaseAccesses([root]);
  const afterRaw = await scanViolations([root]);
  assert.deepEqual(beforeRaw.directDatabaseAccess, afterRaw.directDatabaseAccess);
  assert.equal(compareBaseline(beforeRaw.directDatabaseAccess, afterRaw.directDatabaseAccess).status, 'ALLOW');
  assert.notEqual(before[0].target, after[0].target);
  assert.equal(compareResourceAccesses(exact, after).status, 'BLOCK');
  assert.equal(compareResourceAccesses(beforeRaw.directDatabaseAccess, before).status, 'BLOCK');
});

test('mixed ownership needs separate exact caller/resource/operation counts', async t => {
  const root = await fixture(t, {
    'route.ts': "client.from('edu_fin_invoices').select('*'); client.from('edu_enrollments').select('*');",
  });
  const accesses = await scanDatabaseAccesses([root]);
  const approved = { [resourceAccessSignature(accesses[0])]: 1 };
  assert.equal(compareResourceAccesses(approved, accesses.slice(0, 1)).status, 'ALLOW');
  const mixed = compareResourceAccesses(approved, accesses);
  assert.equal(mixed.status, 'BLOCK');
  assert.equal(mixed.added.length, 1);
  assert.match(mixed.added[0].signature, /edu_enrollments/);
  assert.equal(compareResourceAccesses(approved, [accesses[0], accesses[0]]).status, 'BLOCK');
  assert.equal(compareResourceAccesses(approved, [{ ...accesses[0], file: 'other.ts' }]).status, 'BLOCK');
  assert.equal(compareResourceAccesses(approved, [{ ...accesses[0], line: 999 }]).status, 'ALLOW');
});

test('SQL write/returning, bracket calls and multiline literals retain the actual operation', async t => {
  const root = await fixture(t, {
    'route.ts': [
      "client.from('edu_fin_invoices').update({}).eq('id', id).select('id');",
      "client['from'](\n 'edu_fin_invoices'\n)['delete']().eq('id', id).select('id');",
      "client.from('edu_fin_invoices').upsert([]).select('id');",
      "client.from('edu_fin_invoices').insert({}).select('id');",
      "client['rpc']('preschool_save_care_records', {});",
    ].join('\n'),
  });
  const accesses = await scanDatabaseAccesses([root]);
  assert.deepEqual(accesses.map(x => x.operation), ['update', 'delete', 'upsert', 'insert', 'execute']);
  const approvedRead = { [resourceAccessSignature({ ...accesses[0], operation: 'select' })]: 1 };
  assert.equal(compareResourceAccesses(approvedRead, accesses.slice(0, 1)).status, 'BLOCK');
});

test('unknown target/operation cannot be approved by a wildcard or even its own unresolved key', async t => {
  const root = await fixture(t, {
    'route.ts': "client.from(tableName).select('*'); client.rpc(RPC_NAME); client.from('edu_courses'); client.rpc(`rpc_${name}`);",
  });
  const accesses = await scanDatabaseAccesses([root]);
  const fakeApproval = Object.fromEntries(accesses.map(x => [resourceAccessSignature(x), 1]));
  const comparison = compareResourceAccesses(fakeApproval, accesses);
  assert.equal(comparison.status, 'BLOCK');
  assert.equal(comparison.unresolved.length, 4);
});

test('malformed source fails closed and shadowed conversion names do not hide client calls', async t => {
  const root = await fixture(t, { 'route.ts': "const Array = client; Array.from(tableName);" });
  const accesses = await scanDatabaseAccesses([root]);
  assert.equal(accesses.length, 1);
  assert.equal(compareResourceAccesses({}, accesses).status, 'BLOCK');
  await writeFile(path.join(root, 'route.ts'), 'const broken = ;');
  await assert.rejects(scanDatabaseAccesses([root]), /Cannot parse Education source/);
});

test('resource identity preserves literal line-like text and rejects invalid reviewed counts', () => {
  const access = { file: 'route.ts', caller: 'GET', method: 'rpc', schema: '<client-default>', target: 'command:L10', operation: 'execute' };
  const key = resourceAccessSignature(access);
  const approved = { [key]: 1 };
  assert.equal(compareResourceAccesses(approved, [access]).status, 'ALLOW');
  assert.equal(compareResourceAccesses(approved, [{ ...access, target: 'command:L20' }]).status, 'BLOCK');
  for (const value of [0, -1, 1.5, '1', NaN]) {
    assert.equal(compareResourceAccesses({ [key]: value }, [access]).status, 'BLOCK');
  }
});

test('the actual CLI allows contract-only code and blocks a call hidden inside matching legacy debt', async t => {
  const legacy = "service.ts:L1 - Direct database query targeting '.from('edu_' is prohibited in the Product layer.";
  const baseline = { [legacy]: 1 };
  // This historical fixture deliberately records a different exact target;
  // the matching prefix/count cannot approve edu_fin_invoices.
  const metadata = policyFixture(baseline, [policyEntry('D1', 'src/products/bella-education/service.ts', '<module>', 'edu_courses')]);
  const root = await fixture(t, {
    '.github/ci/education-architecture-baselines.json': JSON.stringify({ directDatabaseAccess: { violations: baseline } }),
    '.github/ci/education-architecture-dispositions.json': JSON.stringify(metadata),
    'src/products/bella-education/service.ts': "import type { StudentDTO } from '@/platform/education/contracts/student.contract';",
  });
  const command = fileURLToPath(new URL('./ci-run-education-architecture.mjs', import.meta.url));
  const options = { cwd: root, encoding: 'utf8', env: { ...process.env, CI_EDUCATION_ARCHITECTURE_BASELINES: '.github/ci/education-architecture-baselines.json' } };
  const allowed = spawnSync(process.execPath, [command], options);
  assert.equal(allowed.status, 0, allowed.stderr);
  await writeFile(path.join(root, 'src/products/bella-education/service.ts'), "client.from('edu_fin_invoices').select('*');");
  const denied = spawnSync(process.execPath, [command], options);
  assert.equal(denied.status, 1, denied.stderr);
  assert.match(denied.stdout, /matches reviewed baseline/);
  assert.match(denied.stderr, /Unreviewed resource/);
  assert.match(denied.stderr, /baseline policy: BLOCK/);
  await writeFile(path.join(root, 'src/products/bella-education/service.ts'), 'const invoke = client.rpc.bind(client);');
  const aliasDenied = spawnSync(process.execPath, [command], options);
  assert.equal(aliasDenied.status, 1, aliasDenied.stderr);
  assert.match(aliasDenied.stderr, /Unreviewed resource/);
  await writeFile(path.join(root, 'src/products/bella-education/service.ts'), 'const example = "client.rpc(\'read_feed\')"; /* client.from(\'edu_courses\') */');
  const exampleAllowed = spawnSync(process.execPath, [command], options);
  assert.equal(exampleAllowed.status, 0, exampleAllowed.stderr);
});

test('a multiline receiver keeps the member location used by frozen occurrence evidence', async t => {
  const root = await fixture(t, { 'route.ts': "const result = client\n  .from(\n    'edu_courses'\n  ).select('*');" });
  const [access] = await scanDatabaseAccesses([root]);
  assert.equal(access.line, 2);
  assert.equal(access.column, 4);
  assert.equal(access.target, 'edu_courses');
  assert.equal(access.operation, 'select');
});

test('same-file handler substitution is a different caller and never inherits an exact exception', async t => {
  const root = await fixture(t, {
    'route.ts': "export async function GET() { return client.rpc('read_feed'); }\nexport async function POST() { return client.rpc('read_feed'); }",
  });
  const accesses = await scanDatabaseAccesses([root]);
  assert.deepEqual(accesses.map(x => x.caller), ['GET', 'POST']);
  const approved = { [resourceAccessSignature(accesses[0])]: 1 };
  assert.equal(compareResourceAccesses(approved, accesses.slice(0, 1)).status, 'ALLOW');
  assert.equal(compareResourceAccesses(approved, accesses.slice(1)).status, 'BLOCK');
});

test('an explicit schema substitution changes resource identity and an unknown schema stays blocked', async t => {
  const root = await fixture(t, {
    'route.ts': "client.schema('public').from('edu_courses').select('*'); client.schema('private').from('edu_courses').select('*'); client.schema(SCHEMA).from('edu_courses').select('*');",
  });
  const accesses = await scanDatabaseAccesses([root]);
  assert.deepEqual(accesses.map(x => x.schema), ['public', 'private', null]);
  const approved = { [resourceAccessSignature(accesses[0])]: 1, [resourceAccessSignature(accesses[2])]: 1 };
  assert.equal(compareResourceAccesses(approved, accesses.slice(0, 1)).status, 'ALLOW');
  assert.equal(compareResourceAccesses(approved, accesses.slice(1, 2)).status, 'BLOCK');
  assert.equal(compareResourceAccesses(approved, accesses.slice(2)).status, 'BLOCK');
});

test('bound, extracted, destructured and computed member calls remain unresolved and block', async t => {
  const root = await fixture(t, {
    'route.ts': [
      "const bound = client.rpc.bind(client); bound('read_feed');",
      "const extracted = client.from; extracted('edu_courses');",
      "const { rpc: invoke } = client; invoke('read_feed');",
      "client[methodName]('read_feed');",
      "client['r' + 'pc']('read_feed');",
      "client.rpc.call(client, 'read_feed');",
    ].join('\n'),
  });
  const accesses = await scanDatabaseAccesses([root]);
  assert.equal(accesses.length, 6);
  assert.deepEqual(accesses.map(x => x.form), ['reference', 'reference', 'binding', 'computed', 'computed', 'reference']);
  const comparison = compareResourceAccesses({}, accesses);
  assert.equal(comparison.status, 'BLOCK');
  assert.equal(comparison.unresolved.length, 6);
});

test('neither database gate treats quoted examples or inline block comments as executable calls', async t => {
  const root = await fixture(t, {
    'route.tsx': [
      'const sqlExample = "client.from(\'edu_courses\')";',
      'const rpcExample = "client.rpc(\'read_feed\')";',
      "/* client.rpc('read_feed'); client.from('edu_courses'); */ const view = <div/>;",
      "const ignored = 1; /* client.from('students') */",
    ].join('\n'),
  });
  const inventory = await scanDatabaseAccesses([root]);
  assert.deepEqual(inventory, []);
  assert.deepEqual((await scanViolations([root])).directDatabaseAccess, {});
});

function policyEntry(id, file, caller, target, operation = 'select', method = 'from') {
  return { id, file, caller, method, schema: '<client-default>', target, operation, maxOccurrences: 1 };
}

function policyFixture(baseline = {}, knownDebt = [], approvedExceptions = []) {
  return { version: 1, policyId: 'fixture', sourceBase: 'f'.repeat(40),
    approval: { scope: 'local-enforcement', decision: 'Synthetic control fixture', exceptionIds: approvedExceptions.map(entry => entry.id) },
    legacyBaselineDigest: legacyBaselineDigest(baseline), knownDebt, approvedExceptions };
}

async function policySource(t) {
  const root = await fixture(t, {
    'src/products/bella-education/repo.ts': "export function read() { client.from('edu_old').select('*'); }",
    'src/app/api/education/route.ts': "export function POST() { client.rpc('approved_command'); client.from('edu_courses').select('*'); client.rpc(NAME); }",
  });
  const product = path.join(root, 'src/products/bella-education');
  const api = path.join(root, 'src/app/api/education');
  const baseline = (await scanViolations([product], product)).directDatabaseAccess;
  const accesses = await scanDatabaseAccesses([product, api], root);
  const raw = (await scanViolations([product, api], product)).directDatabaseAccess;
  const debt = policyEntry('D1', 'src/products/bella-education/repo.ts', 'read', 'edu_old');
  const exception = policyEntry('E1', 'src/app/api/education/route.ts', 'POST', 'approved_command', 'execute', 'rpc');
  return { root, product, api, baseline, accesses, raw, metadata: policyFixture(baseline, [debt], [exception]) };
}

test('the configured policy is exactly the owner-approved frozen debt and seven identities', () => {
  const repository = fileURLToPath(new URL('../', import.meta.url));
  const baseline = JSON.parse(readFileSync(path.join(repository, '.github/ci/education-architecture-baselines.json'), 'utf8')).directDatabaseAccess.violations;
  const metadata = loadDispositionMetadata(path.join(repository, '.github/ci/education-architecture-dispositions.json'));
  assert.deepEqual(validateDispositionMetadata(metadata, baseline), []);
  assert.equal(metadata.sourceBase, 'f1299e3138f3700062a1ed84271db315737b0071');
  assert.equal(metadata.knownDebt.length, 263);
  assert.equal(metadata.knownDebt.reduce((sum, entry) => sum + entry.maxOccurrences, 0), 265);
  assert.deepEqual(metadata.approvedExceptions.map(entry => entry.id).sort(), ['M004', 'M066', 'M067', 'M068', 'M069', 'M070', 'M071']);
  const digest = entries => createHash('sha256').update(JSON.stringify(entries.map(entry =>
    [entry.file, entry.caller, entry.method, entry.schema, entry.target, entry.operation, entry.maxOccurrences]).sort())).digest('hex');
  assert.equal(digest(metadata.knownDebt), '1e636b3dd29b0ff75999c15f3dd638aa1440fbc40cc3c55736a00a6f9fcb5d44');
  assert.equal(digest(metadata.approvedExceptions), '4c0aecfb05cddbc9d264a746f095fbeb436f9f2ba2fd5970caf018b0b776a30d');
});

test('both gates share exact dispositions while preserving raw calls and unresolved denials', async t => {
  const input = await policySource(t);
  const before = JSON.stringify(input.metadata);
  const result = evaluateDatabaseControls(input.baseline, input.raw, input.accesses, input.metadata);
  assert.deepEqual(result.configurationErrors, []);
  assert.equal(result.recognizedDebt.length, 1);
  assert.equal(result.recognizedExceptions.length, 1);
  assert.equal(result.blocked.length, 2);
  assert.equal(result.rawLegacy.currentTotal, 3);
  assert.equal(result.legacy.currentTotal, 2);
  assert.equal(result.legacy.added.reduce((sum, entry) => sum + entry.delta, 0), 1);
  assert.equal(result.resources.added.reduce((sum, entry) => sum + entry.delta, 0), 2);
  assert.equal(result.resources.unresolved.length, 1);
  assert.equal(result.status, 'BLOCK');
  assert.equal(JSON.stringify(input.metadata), before);
});

test('same/reduced debt is allowed; a new exact target or caller cannot borrow the prefix budget', async t => {
  const input = await policySource(t);
  for (const source of ["export function read() { client.from('edu_old').select('*'); }", 'export function read() {}']) {
    await writeFile(path.join(input.product, 'repo.ts'), source);
    const accesses = await scanDatabaseAccesses([input.product], input.root);
    const raw = (await scanViolations([input.product], input.product)).directDatabaseAccess;
    assert.equal(evaluateDatabaseControls(input.baseline, raw, accesses, input.metadata).status, 'ALLOW');
  }
  for (const source of [
    "export function read() { client.from('edu_new').select('*'); }",
    "export function other() { client.from('edu_old').select('*'); }",
    "export function read() { client.from('edu_old').update({}).select('id'); }",
    "export function read() { client.schema('private').from('edu_old').select('*'); }",
  ]) {
    await writeFile(path.join(input.product, 'repo.ts'), source);
    const accesses = await scanDatabaseAccesses([input.product], input.root);
    const raw = (await scanViolations([input.product], input.product)).directDatabaseAccess;
    assert.equal(evaluateDatabaseControls(input.baseline, raw, accesses, input.metadata).status, 'BLOCK');
  }
});

test('an extra occurrence exceeds either debt or exception quota without subtracting an entire signature', async t => {
  const input = await policySource(t);
  await writeFile(path.join(input.api, 'route.ts'), "export function POST() { client.rpc('approved_command'); client.rpc('approved_command'); }");
  let accesses = await scanDatabaseAccesses([input.api], input.root);
  let raw = (await scanViolations([input.api], input.product)).directDatabaseAccess;
  const result = evaluateDatabaseControls(input.baseline, raw, accesses, input.metadata);
  assert.equal(result.recognizedExceptions.length, 1);
  assert.equal(result.blocked.length, 1);
  assert.equal(result.rawLegacy.currentTotal, 2);
  assert.equal(result.legacy.currentTotal, 1);
  assert.equal(result.status, 'BLOCK');
  await writeFile(path.join(input.product, 'repo.ts'), "export function read() { client.from('edu_old').select('*'); client.from('edu_old').select('*'); }");
  accesses = await scanDatabaseAccesses([input.product], input.root);
  raw = (await scanViolations([input.product], input.product)).directDatabaseAccess;
  const debtResult = evaluateDatabaseControls(input.baseline, raw, accesses, input.metadata);
  assert.equal(debtResult.recognizedDebt.length, 1);
  assert.equal(debtResult.blocked.length, 1);
  assert.equal(debtResult.status, 'BLOCK');
});

test('missing, invalid, wildcard, overlapping, unknown and quota-drift metadata fail closed', async t => {
  const input = await policySource(t);
  const mutated = change => { const value = structuredClone(input.metadata); change(value); return value; };
  const cases = [null, {}, mutated(value => { value.version = 99; }),
    mutated(value => { value.approval.scope = 'runtime'; }),
    mutated(value => { value.approval.exceptionIds = ['other']; }),
    mutated(value => { value.approvedExceptions.push({ ...value.approvedExceptions[0], id: { toString: null } }); }),
    mutated(value => { value.legacyBaselineDigest = '0'.repeat(64); }),
    mutated(value => { value.knownDebt[0].maxOccurrences = 2; }),
    mutated(value => { value.approvedExceptions[0].file = 'src/app/api/education/*'; }),
    mutated(value => { value.approvedExceptions[0].file = 'src/app/api/education/../outside.ts'; }),
    mutated(value => { value.approvedExceptions[0].caller = '*'; }),
    mutated(value => { value.approvedExceptions[0].target = null; }),
    mutated(value => { value.approvedExceptions[0].schema = null; }),
    mutated(value => { value.approvedExceptions[0].operation = null; }),
    mutated(value => { value.approvedExceptions[0].maxOccurrences = 0; }),
    mutated(value => { value.approvedExceptions[0].maxOccurrences = 2; }),
    mutated(value => { value.approvedExceptions[0].maxOccurrences = 1.5; }),
    mutated(value => { value.approvedExceptions.push({ ...value.approvedExceptions[0], id: 'E2' }); value.approval.exceptionIds.push('E2'); }),
    mutated(value => { value.approvedExceptions[0].fileGlob = '*'; }),
  ];
  for (const metadata of cases) {
    const result = evaluateDatabaseControls(input.baseline, input.raw, input.accesses, metadata);
    assert.ok(result.configurationErrors.length > 0);
    assert.equal(result.status, 'BLOCK');
    assert.equal(result.recognizedExceptions.length, 0);
    assert.equal(result.recognizedDebt.length, 0);
  }
});

test('a mismatched legacy observation cannot silently consume an exception', async t => {
  const input = await policySource(t);
  const approved = input.accesses.filter(access => access.target === 'approved_command');
  const result = evaluateDatabaseControls(input.baseline, {}, approved, input.metadata);
  assert.equal(result.status, 'BLOCK');
  assert.ok(result.configurationErrors.some(message => message.includes('Legacy observation mismatch')));
});

test('the actual CLI admits exactly a configured command; sibling SQL and missing metadata remain blocked', async t => {
  const baseline = {};
  const metadata = policyFixture(baseline, [], [policyEntry('E1', 'src/app/api/education/route.ts', 'POST', 'approved_command', 'execute', 'rpc')]);
  const root = await fixture(t, {
    '.github/ci/education-architecture-baselines.json': JSON.stringify({ directDatabaseAccess: { violations: baseline } }),
    '.github/ci/education-architecture-dispositions.json': JSON.stringify(metadata),
    'src/app/api/education/route.ts': "export function POST() { client.rpc('approved_command'); }",
  });
  const command = fileURLToPath(new URL('./ci-run-education-architecture.mjs', import.meta.url));
  const run = () => spawnSync(process.execPath, [command], { cwd: root, encoding: 'utf8',
    env: { ...process.env, CI_EDUCATION_ARCHITECTURE_BASELINES: '.github/ci/education-architecture-baselines.json' } });
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /raw legacy matches: 1/);
  assert.match(result.stdout, /approved paths 1; blocked 0/);
  await writeFile(path.join(root, 'src/app/api/education/route.ts'), "export function POST() { client.rpc('approved_command'); client.from('edu_courses').select('*'); }");
  result = run();
  assert.equal(result.status, 1);
  assert.match(result.stdout, /approved paths 1; blocked 1/);
  await writeFile(path.join(root, '.github/ci/education-architecture-dispositions.json'), '{');
  result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /disposition policy error/);
  await rm(path.join(root, '.github/ci/education-architecture-dispositions.json'));
  assert.equal(run().status, 1);
});
