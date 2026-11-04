const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const out = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8').replace(/^\uFEFF/, ''));
const save = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const root = path.resolve(out, '../../..');
const migrationRoot = path.join(root, 'supabase/migrations');
const files = fs.readdirSync(migrationRoot).filter(f => f.endsWith('.sql')).sort();
const rawVersion = f => f.match(/^(\d{8}|\d{14})_.+\.sql$/)?.[1];
const normalize = v => v.length === 8 ? v + '000000' : v;
const local = files.filter(rawVersion).map(file => ({ file, version: rawVersion(file), normalized: normalize(rawVersion(file)) }));
const localSet = new Set(local.map(x => x.normalized));
const rawLocalSet = new Set(local.map(x => x.version));
const grouped = new Map();
const rawGrouped = new Map();
for (const item of local) grouped.set(item.normalized, [...(grouped.get(item.normalized) || []), item.file]);
for (const item of local) rawGrouped.set(item.version, [...(rawGrouped.get(item.version) || []), item.file]);
const duplicateVersions = [...grouped].filter(([, names]) => names.length > 1).map(([version, names]) => ({ version, files: names }));
const byName = (a, key) => new Map(a.map(x => [key(x), x]));
const catalogs = {};
const summaries = {};
for (const env of ['primary', 'e2e']) {
  const response = read(`catalog-${env}.json`);
  const c = response.rows?.[0]?.catalog;
  if (!c || c.read_only !== 'on') throw new Error(`READ_ONLY_CATALOG_REQUIRED:${env}`);
  catalogs[env] = c;
  const remoteSet = new Set(c.migrations.map(m => normalize(m.version)));
  const pending = local.filter(m => !remoteSet.has(m.normalized));
  const remoteOnly = c.migrations.filter(m => !localSet.has(normalize(m.version)));
  const withTenant = c.tables.filter(t => t.columns.some(col => col.name === 'tenant_id'));
  const summary = {
    sourceRevision: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    environment: env,
    observedAt: c.observed_at,
    transactionReadOnly: c.read_only,
    tenantRowCount: c.tenant_row_count,
    tenantIsolationBehavior: 'NOT_PROVEN: catalog and aggregate count are not role/tenant adversarial tests',
    localSqlFiles: files.length,
    recognizedMigrationFiles: local.length,
    uniqueNormalizedLocalVersions: localSet.size,
    uniqueRawLocalVersions: rawLocalSet.size,
    versionComparisonMethod: 'Existing checker convention: pad 8-digit versions with 000000. Raw versions are also retained; normalization is not migration identity or SQL equivalence.',
    invalidMigrationFilenames: files.filter(f => !rawVersion(f)),
    duplicateVersions,
    duplicateRawVersions: [...rawGrouped].filter(([, names]) => names.length > 1).map(([version, names]) => ({ version, files: names })),
    remoteMigrationRows: c.migrations.length,
    pendingLocalFileCount: pending.length,
    pendingLocalVersionCount: new Set(pending.map(m => m.normalized)).size,
    remoteOnlyCount: remoteOnly.length,
    pendingLocal: pending,
    remoteOnly,
    rawPendingLocal: local.filter(m => !c.migrations.some(r => r.version === m.version)),
    rawRemoteOnly: c.migrations.filter(m => !rawLocalSet.has(m.version)),
    remoteOnlyLocalNameCounterparts: remoteOnly.map(m => ({
      remoteVersion: m.version,
      name: m.name,
      localFiles: local.filter(l => l.file.endsWith(`_${m.name}.sql`)),
      statementEquivalence: 'NOT_PROVEN: matching name and signature do not establish identical applied statements',
    })),
    tables: c.tables.length,
    rlsEnabled: c.tables.filter(t => t.rls).length,
    rlsDisabled: c.tables.filter(t => !t.rls).map(t => ({ name: t.name, anonSelect: t.anon_select, authenticatedSelect: t.authenticated_select })),
    tablesWithTenantId: withTenant.length,
    tenantTablesWithoutRls: withTenant.filter(t => !t.rls).map(t => t.name),
    rlsTablesWithoutPolicies: c.tables.filter(t => t.rls && !c.policies.some(p => p.tablename === t.name)).map(t => t.name),
    policies: c.policies.length,
    unconditionalPolicyCandidates: c.policies.filter(p => /^\(?true\)?$/.test(p.qual || '') || /^\(?true\)?$/.test(p.with_check || '')),
    functions: c.functions.length,
    securityDefinerFunctions: c.functions.filter(f => f.security_definer).length,
    anonExecutableSecurityDefinerCount: c.functions.filter(f => f.security_definer && f.anon_execute).length,
    schemaMatchWithGit: 'NOT_PROVEN: history and live catalog do not establish full replay equivalence',
  };
  summaries[env] = summary;
  save(`migration-${env}-reconciliation.json`, summary);
}
const a = catalogs.primary, b = catalogs.e2e;
const differences = {};
for (const [kind, key] of [
  ['tables', x => x.name],
  ['policies', x => `${x.schemaname}.${x.tablename}.${x.policyname}`],
  ['functions', x => `${x.schema}.${x.name}(${x.identity_arguments})`],
]) {
  const am = byName(a[kind], key), bm = byName(b[kind], key);
  differences[kind] = {
    primaryOnly: [...am.keys()].filter(k => !bm.has(k)),
    e2eOnly: [...bm.keys()].filter(k => !am.has(k)),
    changed: [...am.keys()].filter(k => bm.has(k) && JSON.stringify(am.get(k)) !== JSON.stringify(bm.get(k))).map(k => ({ key: k, primary: am.get(k), e2e: bm.get(k) })),
  };
}
save('catalog-environment-differences.json', differences);
console.log(JSON.stringify({
  environments: Object.fromEntries(Object.entries(summaries).map(([env, s]) => [env, {
    tenantRows: s.tenantRowCount, localFiles: s.localSqlFiles, rawLocalIds: s.uniqueRawLocalVersions,
    remoteRows: s.remoteMigrationRows, rawPendingFiles: s.rawPendingLocal.length,
    rawPendingIds: new Set(s.rawPendingLocal.map(m => m.version)).size, rawRemoteOnly: s.rawRemoteOnly.length,
    normalizedPendingFiles: s.pendingLocalFileCount, normalizedPendingVersions: s.pendingLocalVersionCount,
    duplicateRawIds: s.duplicateRawVersions.length, normalizedCollisions: s.duplicateVersions.length,
    tables: s.tables, rlsEnabled: s.rlsEnabled,
    rlsDisabled: s.rlsDisabled.length, policies: s.policies, functions: s.functions,
    securityDefiner: s.securityDefinerFunctions, anonSecurityDefiner: s.anonExecutableSecurityDefinerCount,
  }])),
  differences: Object.fromEntries(Object.entries(differences).map(([kind, v]) => [kind, {
    primaryOnly: v.primaryOnly.length, e2eOnly: v.e2eOnly.length, changed: v.changed.length,
  }])),
}, null, 2));
