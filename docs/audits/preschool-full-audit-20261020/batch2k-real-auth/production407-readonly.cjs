const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), assert = require('node:assert/strict');
const projectId = 'prj_Rgncynqz8ptznREGggMxPfjwoikW', source = 'ecfaf23ab06d043c5f2caec38ea67856705b6c26', branch = 'main';
assert.equal(JSON.parse(fs.readFileSync('D:/Antigravity/Projects/BELLA SPA ERP/.vercel/project.json')).projectId, projectId);
const cli = path.join(process.env.APPDATA, 'npm/node_modules/vercel/dist/vc.js'), commands = [];
function api(route) {
  const result = cp.spawnSync(process.execPath, [cli, 'api', route, '--method', 'GET', '--raw'], { encoding: 'utf8', timeout: 30000, maxBuffer: 12000000, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  commands.push({ route, method: 'GET', exitCode: result.status }); if (result.status !== 0) throw Error('VERCEL_METADATA_READ_FAILED'); return JSON.parse(result.stdout);
}
async function main() {
  const report = { checkedAt: new Date().toISOString(), project: projectId, source, branch, productionMutation: 'NOT_PERFORMED', deploymentInitiated: false, protectionConfigurationChanged: false, realSupabaseUserSession: false, businessRowContentsSaved: false, commands, result: 'NOT_PROVEN' };
  try {
    const project = api('/v9/projects/' + projectId), prod = project.targets?.production;
    if (!prod?.id) throw Error('EXACT_PRODUCTION_NOT_FOUND');
    const detail = api('/v13/deployments/' + prod.id);
    const aliases = (detail.alias || []).map(value => typeof value === 'string' ? value : value.alias);
    const actualSource = detail.meta?.githubCommitSha || detail.gitSource?.sha;
    report.production = {id:prod.id,source:actualSource,readyState:detail.readyState,target:detail.target,canonicalAliasAssigned:aliases.includes('bella-spa-erp.vercel.app')};
    if(actualSource !== source || detail.readyState !== 'READY' || detail.target !== 'production' || !report.production.canonicalAliasAssigned) throw Error('EXACT_SOURCE_NOT_READY_ON_PRODUCTION');
    const selected = {uid:prod.id};
    report.deployment = {...report.production,url:'https://bella-spa-erp.vercel.app'};
    const origin = new URL(report.deployment.url); assert(origin.hostname.endsWith('.vercel.app'));
    const local = require('dotenv').parse(fs.readFileSync('D:/Antigravity/Projects/BELLA SPA ERP/.env.local'));
    const bypass = local.E2E_VERCEL_AUTOMATION_BYPASS_SECRET || local.VERCEL_AUTOMATION_BYPASS_SECRET || Object.entries(project.protectionBypass || {}).find(([,value]) => value.scope === 'automation-bypass')?.[0];
    report.existingVercelAutomationAccess = !!bypass;
    const probes = [
      ['POST', '/api/education/ai/copilot', 401, 'COPILOT_UNAUTHENTICATED'],
      ['POST', '/api/education/care/medication', 410, 'PRESCHOOL_MEDICATION_DISABLED'],
      ['GET', '/api/education/care/bulk', 401, 'CARE_UNAUTHENTICATED'],
      ['POST', '/api/education/care/bulk', 401, 'CARE_UNAUTHENTICATED'],
      ['POST', '/api/education/portal/token', 401, 'PORTAL_UNAUTHENTICATED'],
      ['GET', '/api/education/portal/invalid', 401, 'TOKEN_MALFORMED'],
      ['POST', '/api/education/portal/invalid/chat', 401, 'TOKEN_MALFORMED'],
      ['POST', '/api/education/portal/invalid/copilot', 401, 'TOKEN_MALFORMED'],
      ['POST', '/api/education/announcements', 401, 'ANNOUNCEMENT_UNAUTHENTICATED'],
      ['GET', '/api/education/courses', 401, 'COURSE_UNAUTHENTICATED'],
      ['GET', '/api/education/courses/00000000-0000-4000-8000-000000000099', 401, 'COURSE_UNAUTHENTICATED'],
    ];
    report.tests = [];
    for (const [method, resource, status, code] of probes) for (const spoof of [false, true]) {
      const headers = {}; if (bypass) headers['x-vercel-protection-bypass'] = bypass;
      if (spoof) Object.assign(headers, { 'x-mock-role': 'SUPER_ADMIN', 'x-mock-user-email': 'synthetic@example.invalid', Cookie: 'mock_user_email=synthetic@example.invalid' });
      const response = await fetch(origin.origin + resource + (spoof ? '?tenantId=foreign&tenantId=other' : ''), { method, headers, ...(method === 'POST' ? { body: '{malformed' } : {}), redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(25000) });
      const body = await response.json().catch(() => null), cache = response.headers.get('cache-control');
      const directives = (cache || '').toLowerCase().split(',').map(value => value.trim());
      // Copilot deliberately preserves its existing {error} DTO; other routes use {success:false,error}.
      // Validate that exact Copilot error-only shape, rather than invent a shared response contract.
      const bodyKeys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).sort() : [];
      const shape = resource === '/api/education/ai/copilot' ? JSON.stringify(bodyKeys) === '["error"]' : body?.success === false;
      const denial = response.status === status && shape && body?.error === code;
      report.tests.push({ method, resource, spoof, status: response.status, expectedCodeMatched: body?.error === code, responseKeys: bodyKeys, approvedErrorShapeMatched: shape, applicationDenial: denial, cacheControl: cache, result: denial && directives.includes('no-store') && !directives.includes('public') ? 'PASS' : 'FAIL' });
    }
    const finalDetail = api('/v13/deployments/' + selected.uid), finalProject = api('/v9/projects/' + projectId);
    report.productionSourceStable = (finalDetail.meta?.githubCommitSha || finalDetail.gitSource?.sha) === source && finalDetail.readyState === 'READY';
    report.productionTargetUnchangedDuringProbes = finalProject.targets?.production?.id === prod?.id;
    report.result = report.tests.length === 22 && report.tests.every(test => test.result === 'PASS') && report.productionSourceStable && report.productionTargetUnchangedDuringProbes ? 'PASS' : 'FAIL';
  } catch (error) { report.errorCode = error.message?.startsWith('PRODUCTION_') || error.message?.startsWith('EXACT_') ? error.message : 'PRODUCTION_VERIFICATION_UNAVAILABLE'; }
  const stamp = report.checkedAt.replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(__dirname, 'production407-' + stamp + '.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'production407-latest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({result:report.result,production:report.production,tests:report.tests?.length,passed:report.tests?.filter(t=>t.result==='PASS').length,errorCode:report.errorCode,commands}));
  if(report.result !== 'PASS') process.exitCode = 1;
}
main().catch(() => { console.error('PRODUCTION_READ_ONLY_FAILED'); process.exitCode = 1; });
