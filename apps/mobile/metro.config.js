// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// Force Metro to use local node_modules, not root monorepo node_modules
const localNodeModules = path.resolve(projectRoot, 'node_modules');

const config = getDefaultConfig(projectRoot);

// Override all Metro module paths to use local node_modules only
config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [localNodeModules];
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Force Metro resolver to use local packages
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      return path.join(localNodeModules, name.toString());
    },
  }
);

// Core and Expo Router use namespace imports from the old CommonJS package.
// Keep their public parse/stringify calls compatible with query-string's ESM API.
const previousResolveRequest = config.resolver.resolveRequest;
const queryStringConsumers = [
  path.join(localNodeModules, '@react-navigation', 'core') + path.sep,
  path.join(localNodeModules, 'expo-router') + path.sep,
];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'query-string' &&
    queryStringConsumers.some((prefix) => context.originModulePath.startsWith(prefix))
  ) {
    return {
      type: 'sourceFile',
      filePath: path.join(projectRoot, 'src', 'lib', 'query-string-compat.js'),
    };
  }
  return previousResolveRequest
    ? previousResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
