import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Execute the real scanner against isolated fixtures, not a copy of its comparator.
const scanner = fileURLToPath(new URL('./ci-run-education-architecture.mjs', import.meta.url));
const adapter = 'care-wellbeing/nutrition/weekly-menu.persistence.ts';
const cases = [
  { name: 'registered adapter RPC allowed', file: adapter, source: "client.rpc('preschool_save_weekly_menu', {});", expected: 0 },
  { name: 'service RPC denied', file: 'care-wellbeing/nutrition/weekly-menu.service.ts', source: "client.rpc('preschool_save_weekly_menu', {});", expected: 1 },
  { name: 'adapter other RPC denied', file: adapter, source: "client.rpc('another_rpc', {});", expected: 1 },
  { name: 'adapter direct table write denied', file: adapter, source: "client.from('edu_weekly_menus').insert({});", expected: 1 },
  { name: 'service dynamic RPC denied', file: 'care-wellbeing/nutrition/weekly-menu.service.ts', source: "client.rpc(name, {});", expected: 1 },
  { name: 'adapter bracket RPC denied', file: adapter, source: "client['rpc']('another_rpc', {});", expected: 1 },
  { name: 'service bracket table denied', file: 'care-wellbeing/nutrition/weekly-menu.service.ts', source: "client['from']('edu_weekly_menus').insert({});", expected: 1 },
  { name: 'wrong adapter path denied', file: 'care-wellbeing/nutrition/other.persistence.ts', source: "client.rpc('preschool_save_weekly_menu', {});", expected: 1 },
  { name: 'kernel table denied', file: adapter, source: "client.from('edu_enrollments').select('*');", expected: 1 },
  { name: 'kernel RPC denied', file: adapter, source: "client.rpc('preschool_assign_chain', {});", expected: 1 },
  { name: 'invalid manifest denied', file: adapter, source: 'export const ready = true;', invalidManifest: true, expected: 1 },
  { name: 'other product cannot call RPC', file: 'src/products/bella-land/weekly-menu.ts', outsideRoot: true, source: "client.rpc('preschool_save_weekly_menu', {});", expected: 1 },
  { name: 'other product constant alias cannot call RPC', file: 'src/products/bella-land/weekly-menu.ts', outsideRoot: true, source: "const name = 'preschool_save_weekly_menu'; client.rpc(name, {});", expected: 1 },
  { name: 'weekly service destructured RPC denied', file: 'care-wellbeing/nutrition/weekly-menu.service.ts', source: "const { rpc } = client; rpc('preschool_save_weekly_menu', {});", expected: 1 },
  { name: 'adapter computed dynamic method denied', file: adapter, source: "client[method]('another_rpc', {});", expected: 1 },
  { name: 'other product TSX caller denied', file: 'src/products/bella-land/weekly-menu.tsx', outsideRoot: true, source: "client.rpc('preschool_save_weekly_menu', {});", expected: 1 },
  { name: 'missing manifest denied', file: adapter, source: 'export const ready = true;', manifestMode: 'missing', expected: 1 },
  { name: 'duplicate manifest key denied', file: adapter, source: 'export const ready = true;', manifestMode: 'duplicate', expected: 1 },
  { name: 'incorrect adapter path denied', file: adapter, source: 'export const ready = true;', manifestMode: 'path', expected: 1 },
  { name: 'incorrect manifest type denied', file: adapter, source: 'export const ready = true;', manifestMode: 'type', expected: 1 },
];

let failed = 0;
for (const item of cases) {
  const fixture = mkdtempSync(path.join(tmpdir(), 'bella-f09-guard-'));
  try {
    const file = item.outsideRoot ? path.join(fixture, item.file) : path.join(fixture, 'src/products/bella-education', item.file);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, item.source);
    const baseline = path.join(fixture, 'baseline.json');
    writeFileSync(baseline, JSON.stringify({}));
    const manifest = path.join(fixture, '.github/ci/education-product-persistence-ownership.json');
    mkdirSync(path.dirname(manifest), { recursive: true });
    const manifestData = item.invalidManifest ? { invalid: true } : {
      product: 'bella_preschool', adapter: 'src/products/bella-education/' + adapter,
      rpc: 'preschool_save_weekly_menu', tables: ['public.edu_weekly_menus', 'public.edu_weekly_menu_days'],
    };
    if (item.manifestMode === 'path') manifestData.adapter = '../weekly-menu.persistence.ts';
    if (item.manifestMode === 'type') manifestData.tables = 'public.edu_weekly_menus';
    if (item.manifestMode !== 'missing') {
      const serialized = JSON.stringify(manifestData);
      writeFileSync(manifest, item.manifestMode === 'duplicate' ? serialized.replace('{', '{"rpc":"other",') : serialized);
    }
    const result = spawnSync(process.execPath, [scanner], {
      cwd: fixture, encoding: 'utf8',
      env: { ...process.env, CI_EDUCATION_ARCHITECTURE_BASELINES: baseline },
    });
    try {
      assert.equal(result.status, item.expected, result.stderr || result.error?.message);
      console.log(`PASS ${item.name}`);
    } catch {
      failed++;
      console.error(`FAIL ${item.name}: expected exit ${item.expected}, received ${result.status}`);
    }
  } finally {
    const safeRoot = path.resolve(tmpdir());
    const target = path.resolve(fixture);
    if (path.dirname(target) !== safeRoot || !path.basename(target).startsWith('bella-f09-guard-')) {
      throw new Error('UNSAFE_FIXTURE_CLEANUP_TARGET');
    }
    rmSync(target, { recursive: true, force: true });
  }
}
if (failed) process.exitCode = 1;
