const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');
const { transformSync } = require('@babel/core');

const projectRoot = path.resolve(__dirname, '..');
const configFile = path.join(projectRoot, 'metro.config.js');
const bridgeFile = path.join(projectRoot, 'src/lib/query-string-compat.js');
function loadResolver(previous) {
  const sandbox = {
    __dirname: projectRoot,
    module: { exports: {} },
    require: (name) => name === 'expo/metro-config'
      ? { getDefaultConfig: () => ({ resolver: { resolveRequest: previous } }) }
      : require(name),
  };
  vm.runInNewContext(fs.readFileSync(configFile, 'utf8'), sandbox, { filename: configFile });
  return sandbox.module.exports.resolver.resolveRequest;
}

test('Core and Expo namespace imports resolve to the public API bridge', () => {
  const resolver = loadResolver();
  for (const consumer of ['@react-navigation/core/lib/module/getStateFromPath.js', 'expo-router/build/fork/getPathFromState.js', 'expo-router/build/fork/getPathFromState-forks.js', 'expo-router/build/global-state/routeInfo.js']) {
    const originModulePath = path.join(projectRoot, 'node_modules', consumer);
    const result = resolver({ originModulePath }, 'query-string', 'ios');
    assert.equal(result.type, 'sourceFile');
    assert.equal(result.filePath, bridgeFile);
  }
});

test('bridge imports the real package without a resolution cycle', () => {
  const expected = { type: 'sourceFile', filePath: 'actual-library' };
  const context = { originModulePath: bridgeFile, resolveRequest: () => expected };
  assert.equal(loadResolver()(context, 'query-string', 'web'), expected);
});

test('unrelated and similarly named consumers keep default resolution', () => {
  let calls = 0;
  const resolver = loadResolver();
  for (const consumer of ['src/app.js', 'node_modules/expo-router-extra/index.js', 'node_modules/@react-navigation/core-extra/index.js']) {
    const context = { originModulePath: path.join(projectRoot, consumer), resolveRequest: (ctx, name, platform) => {
      calls += 1; assert.equal(ctx, context); assert.equal(name, 'query-string'); assert.equal(platform, 'android'); return 'default';
    } };
    assert.equal(resolver(context, 'query-string', 'android'), 'default');
  }
  assert.equal(calls, 3);
});

test('other package imports and any existing custom resolver are preserved', () => {
  let called = false;
  const context = { originModulePath: path.join(projectRoot, 'node_modules/expo-router/build/index.js') };
  const resolver = loadResolver((ctx, name, platform) => {
    called = true; assert.equal(ctx, context); assert.equal(name, 'react'); assert.equal(platform, 'web'); return 'previous';
  });
  assert.equal(resolver(context, 'react', 'web'), 'previous');
  assert.equal(called, true);
});

test('compiled bridge exposes unchanged public parse/stringify functions', async () => {
  const queryString = (await import(pathToFileURL(require.resolve('query-string')).href)).default;
  const code = transformSync(fs.readFileSync(bridgeFile, 'utf8'), {
    configFile: false, babelrc: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const sandbox = { exports: {}, require: (name) => {
    assert.equal(name, 'query-string');
    return { __esModule: true, default: queryString };
  } };
  vm.runInNewContext(code, sandbox, { filename: bridgeFile });
  assert.equal(sandbox.exports.parse, queryString.parse);
  assert.equal(sandbox.exports.stringify, queryString.stringify);
  assert.equal(sandbox.exports.stringify({ flag: null, tag: ['a', 'b'], name: 'Chào bé' }, { sort: false }), 'flag&tag=a&tag=b&name=Ch%C3%A0o%20b%C3%A9');
  assert.deepEqual(sandbox.exports.parse('tag=a&tag=b&empty=&flag'), queryString.parse('tag=a&tag=b&empty=&flag'));
});
