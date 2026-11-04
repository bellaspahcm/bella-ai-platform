import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanViolations } from './ci-run-education-architecture.mjs';

function compareBaseline(baseline, current) {
  const added = [];
  const reduced = [];
  const signatures = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  for (const signature of [...signatures].sort()) {
    const baselineCount = baseline[signature] ?? 0;
    const currentCount = current[signature] ?? 0;
    const delta = currentCount - baselineCount;

    if (delta > 0) {
      added.push({ signature, baselineCount, currentCount, delta });
    } else if (delta < 0) {
      reduced.push({ signature, baselineCount, currentCount, delta });
    }
  }

  return {
    status: added.length > 0 ? 'BLOCK' : 'ALLOW',
    added,
    reduced,
  };
}

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

const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'bella-fee-guard-'));
const adapterDir = path.join(fixtureRoot, 'fee-program');
const adapter = path.join(adapterDir, 'fee-program.persistence.ts');
const other = path.join(fixtureRoot, 'service.ts');
try {
  await mkdir(adapterDir);
  const rpc = "client.rpc('preschool_publish_fee_program_version', {})";
  await writeFile(adapter, `export function run(client: Client) { return ${rpc}; }`);
  let result = await scanViolations(fixtureRoot);
  assert.deepEqual(result.directDatabaseAccess, {});
  for (const invalid of [
    "client.rpc('other_rpc', {})",
    "client.rpc(name, {})",
    "client['rpc']('preschool_publish_fee_program_version', {})",
    "Reflect.get(client, 'rpc')('preschool_publish_fee_program_version', {})",
    "client.rpc('preschool_publish_fee_program_version', {}); client.rpc('other_rpc', {})",
  ]) {
    await writeFile(adapter, `export function run(client: Client, name: string) { return ${invalid}; }`);
    result = await scanViolations(fixtureRoot);
    assert.ok(Object.keys(result.directDatabaseAccess).length > 0, invalid);
  }
  await writeFile(adapter, `export function run(client: Client) { return ${rpc}; }`);
  await writeFile(other, `client.rpc('preschool_publish_fee_program_version', {});\nclient.from('edu_students');`);
  result = await scanViolations(fixtureRoot);
  assert.equal(Object.values(result.directDatabaseAccess).reduce((a, b) => a + b, 0), 2);
  for (const invalid of [
    "client['rpc']('preschool_publish_fee_program_version', {})",
    "client.rpc(\n  'preschool_publish_fee_program_version', {})",
    "const rpcName = 'preschool_publish_fee_program_version'; client.rpc(rpcName, {})",
  ]) {
    await writeFile(other, invalid);
    result = await scanViolations(fixtureRoot);
    assert.ok(Object.keys(result.directDatabaseAccess).length > 0, invalid);
  }
  console.log('PASS EDUCATION SCANNER: exact adapter/RPC allowed; other paths, RPCs, dynamic and bracket calls blocked');
} finally {
  await unlink(adapter).catch(() => {});
  await unlink(other).catch(() => {});
  await rmdir(adapterDir).catch(() => {});
  await rmdir(fixtureRoot);
}
