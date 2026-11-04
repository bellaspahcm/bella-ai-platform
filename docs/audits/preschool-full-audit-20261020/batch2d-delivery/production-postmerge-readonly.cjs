const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const dir = __dirname;
const expectedProject = 'prj_Rgncynqz8ptznREGggMxPfjwoikW';
const expectedSource = '30134055d1ff5b846584e57833816f076034cdea';
const alias = 'bella-spa-erp.vercel.app';
const cli = path.join(process.env.APPDATA, 'npm/node_modules/vercel/dist/vc.js');
assert.equal(JSON.parse(fs.readFileSync('.vercel/project.json')).projectId, expectedProject);
const commands = [];
function api(route) {
  const result = cp.spawnSync(process.execPath, [cli, 'api', route, '--method', 'GET', '--raw'], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 12000000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  commands.push({ route, method: 'GET', exitCode: result.status });
  if (result.status !== 0) throw new Error('VERCEL_METADATA_READ_FAILED');
  return JSON.parse(result.stdout);
}
async function main() {
  const report = { checkedAt: new Date().toISOString(), project: expectedProject,
    expectedSource, productionMutation: 'NOT_PERFORMED', deploymentInitiated: false,
    protectionConfigurationChanged: false, authCredentialsUsed: false,
    businessRowContentsSaved: false, result: 'NOT_PROVEN', commands };
  try {
    const project = api('/v9/projects/' + expectedProject);
    const target = project.targets?.production;
    assert(target?.id, 'Production target identity unavailable');
    const deployment = api('/v13/deployments/' + target.id);
    const source = deployment.meta?.githubCommitSha || deployment.gitSource?.sha;
    const aliases = (deployment.alias || []).map(value => typeof value === 'string' ? value : value.alias);
    report.production = { id: target.id, source, readyState: deployment.readyState,
      target: deployment.target, canonicalAliasAssigned: aliases.includes(alias) };
    if (source !== expectedSource || deployment.readyState !== 'READY' || deployment.target !== 'production' || !aliases.includes(alias)) {
      const list = api('/v6/deployments?projectId=' + expectedProject + '&limit=15');
      report.candidateDeployments = list.deployments
        .filter(item => (item.meta?.githubCommitSha || item.gitSource?.sha) === expectedSource)
        .map(item => ({ id: item.uid, source: expectedSource, readyState: item.readyState, target: item.target }));
      report.reason = 'EXPECTED_SOURCE_NOT_YET_PROVEN_ON_CANONICAL_PRODUCTION_ALIAS';
    } else {
      const probes = [
        ['anonymousList', '/api/education/courses', {}],
        ['forgedList', '/api/education/courses?tenantId=00000000-0000-4000-8000-000000000099', {
          'x-mock-role': 'admin', 'x-mock-user-email': 'synthetic@example.invalid',
          Cookie: 'mock_user_email=synthetic@example.invalid',
        }],
        ['anonymousDetail', '/api/education/courses/00000000-0000-4000-8000-000000000099', {}],
        ['forgedDetail', '/api/education/courses/00000000-0000-4000-8000-000000000099?tenantId=00000000-0000-4000-8000-000000000099', {
          'x-mock-role': 'admin', Cookie: 'mock_user_email=synthetic@example.invalid',
        }],
      ];
      report.tests = [];
      for (const [name, resource, headers] of probes) {
        try {
          const response = await fetch('https://' + alias + resource, {
            headers, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(25000),
          });
          const body = await response.json().catch(() => null);
          const denial = response.status === 401 && body?.success === false && body?.error === 'COURSE_UNAUTHENTICATED';
          report.tests.push({ name, status: response.status, applicationDenial: denial,
            errorCode: denial ? 'COURSE_UNAUTHENTICATED' : null,
            returnedClassroomCount: Array.isArray(body?.classrooms) ? body.classrooms.length : 0,
            cacheControl: response.headers.get('cache-control'), result: denial ? 'PASS' : 'FAIL' });
        } catch (error) { report.tests.push({ name, result: 'NOT_PROVEN', errorType: error.name }); }
      }
      const finalProject = api('/v9/projects/' + expectedProject);
      report.productionTargetStableDuringProbes = finalProject.targets?.production?.id === target.id;
      report.result = report.productionTargetStableDuringProbes && report.tests.every(test => test.result === 'PASS')
        ? 'PASS' : report.tests.some(test => test.result === 'FAIL') ? 'FAIL' : 'NOT_PROVEN';
    }
  } catch (error) { report.errorType = error.name; }
  const name = 'production-postmerge-' + report.checkedAt.replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(dir, name), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'production-postmerge-latest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
main().catch(() => { console.error('POSTMERGE_READ_ONLY_VERIFICATION_FAILED'); process.exitCode = 1; });
