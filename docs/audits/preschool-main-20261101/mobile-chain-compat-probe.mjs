import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = 'D:/CodexWorktrees/preschool-sealed-release-20261102/BELLA SPA ERP';
const evidence = path.dirname(fileURLToPath(import.meta.url));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'apps/mobile/package-lock.json')));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bella-query-compat-'));
const npm = (args, cwd) => {
  const result = spawnSync(process.env.ComSpec, ['/d', '/s', '/c', 'npm ' + args.join(' ')], { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 8e6 });
  if (result.status !== 0) throw new Error(`npm failed: ${result.stderr.slice(-3000)}`);
};
const url = (dir, file) => pathToFileURL(path.join(dir, 'node_modules', file)).href;
const record = { scope: 'Existing Core7.21.2 and Routers7.6.0; public query-string API replacement; synthetic concrete routes, not device E2E', checks: [] };
try {
  const fixtures = [];
  for (const [name, query] of [['before', '7.1.3'], ['after', '9.5.1']]) {
    const dir = path.join(temp, name);
    fs.mkdirSync(dir);
    const core = lock.packages['node_modules/@react-navigation/core'];
    const deps = Object.fromEntries(Object.keys(core.dependencies).map(key => [key, lock.packages['node_modules/' + key]?.version]));
    Object.assign(deps, { '@react-navigation/core': '7.21.2', '@react-navigation/routers': '7.6.0', 'query-string': query, react: '18.3.1' });
    deps['decode-uri-component'] = name === 'before' ? '0.2.2' : '0.5.1';
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ private: true, dependencies: deps, overrides: { 'query-string': query } }));
    npm(['install', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund', '--silent'], dir);
    if (name === 'after') {
      // Mirror the scoped Metro bridge in this Node helper fixture: change only
      // module wiring, not the actual upstream helper implementations.
      const bridge = path.join(dir, 'query-string-compat.mjs');
      fs.writeFileSync(bridge, `import queryString from './node_modules/query-string/index.js';\nexport const parse = queryString.parse;\nexport const stringify = queryString.stringify;\n`);
      for (const helper of ['getStateFromPath.js', 'getPathFromState.js']) {
        const target = path.join(dir, 'node_modules/@react-navigation/core/lib/module', helper);
        fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(/from ['"]query-string['"]/, `from '${pathToFileURL(bridge).href}'`));
      }
      record.fixtureWiring = 'After fixture imports the scoped public parse/stringify bridge; upstream function logic unchanged. Real Metro resolution tested separately.';
    }
    const getStateFromPath = (await import(url(dir, '@react-navigation/core/lib/module/getStateFromPath.js'))).getStateFromPath;
    const getPathFromState = (await import(url(dir, '@react-navigation/core/lib/module/getPathFromState.js'))).getPathFromState;
    const queryString = name === 'before' ? createRequire(path.join(dir, 'x.cjs'))('query-string') : (await import(url(dir, 'query-string/index.js'))).default;
    fixtures.push({ getStateFromPath, getPathFromState, queryString });
  }
  const config = { screens: { login: 'login', home: 'home', schedule: 'schedule', profile: 'profile' } };
  for (const input of ['/login', '/home', '/schedule', '/profile', '/home/', '/schedule?date=2026-11-02', '/login?returnTo=%2Fhome', '/profile?name=Ch%C3%A0o%20b%C3%A9', '/home?space=a+b&plus=a%2Bb', '/home?empty=&flag', '/home?tag=one&tag=two', '/profile?email=synthetic%40example.test', '/home?next=%2Fprofile%3Fx%3D1', '/home?hash=x%23y', '/home?null=null&false=false&zero=0', '/home?value=%E0%A4%A', '/unknown']) {
    const results = fixtures.map(f => { const state = f.getStateFromPath(input, config); return { state, path: state ? f.getPathFromState(state, config) : undefined }; });
    record.checks.push({ kind: 'linking', input, pass: isDeepStrictEqual(results[0], results[1]), ...(isDeepStrictEqual(results[0], results[1]) ? {} : { results }) });
  }
  for (const params of [{}, { date: '2026-11-02' }, { name: 'Chào bé' }, { space: 'a b', plus: 'a+b' }, { returnTo: '/home?x=1#y' }, { flag: null, empty: '' }, { tag: ['one', 'two'] }, { enabled: false, zero: 0 }, { omit: undefined, keep: 'yes' }, { emoji: '🙂' }, { value: "!()*'~" }, { value: '%zz' }, { values: ['a', null, ''] }, { constructor: 'safe' }]) {
    const results = fixtures.map(f => f.queryString.stringify(params, { sort: false }));
    record.checks.push({ kind: 'Expo stringify', pass: results[0] === results[1], results });
  }
  record.versions = { core: '7.21.2', routers: '7.6.0', queryString: ['7.1.3', '9.5.1'], decode: ['0.2.2', '0.5.1'] };
  record.passed = record.checks.filter(c => c.pass).length;
  record.failed = record.checks.filter(c => !c.pass).length;
  fs.writeFileSync(path.join(evidence, 'mobile-chain-20261102-existing-core-parity.json'), JSON.stringify(record, null, 2));
  console.log(JSON.stringify({ passed: record.passed, failed: record.failed, failures: record.checks.filter(c => !c.pass) }));
  if (record.failed) process.exitCode = 1;
} finally {
  if (!path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(temp).startsWith('bella-query-compat-')) throw new Error('Unsafe cleanup target');
  fs.rmSync(temp, { recursive: true, force: true });
}
