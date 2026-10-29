const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), assert = require('node:assert/strict');
const projectId = 'prj_Rgncynqz8ptznREGggMxPfjwoikW', source = 'b85722f6eab1aedc3d9bd977bd3deee19e5684e5', branch = 'codex/preschool-authorization-matrix-20261021';
assert.equal(JSON.parse(fs.readFileSync('.vercel/project.json')).projectId, projectId);
const cli = path.join(process.env.APPDATA, 'npm/node_modules/vercel/dist/vc.js'), commands = [];
function api(route) {
  const result = cp.spawnSync(process.execPath, [cli, 'api', route, '--method', 'GET', '--raw'], { encoding: 'utf8', timeout: 30000, maxBuffer: 12000000, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  commands.push({ route, method: 'GET', exitCode: result.status }); if (result.status !== 0) throw Error('VERCEL_METADATA_READ_FAILED'); return JSON.parse(result.stdout);
}
async function main() {
  const report = { checkedAt: new Date().toISOString(), project: projectId, source, branch, productionMutation: 'NOT_PERFORMED', deploymentInitiated: false, protectionConfigurationChanged: false, realSupabaseUserSession: false, businessRowContentsSaved: false, commands, result: 'NOT_PROVEN' };
  try {
    const list = api('/v6/deployments?projectId=' + projectId + '&limit=20');
    const selected = list.deployments.filter(item => (item.meta?.githubCommitSha || item.gitSource?.sha) === source && (item.meta?.githubCommitRef || item.gitSource?.ref) === branch).sort((a,b) => (b.created || b.createdAt) - (a.created || a.createdAt))[0];
    if (!selected) throw Error('EXACT_HEAD_PREVIEW_NOT_FOUND');
    const detail = api('/v13/deployments/' + selected.uid);
    assert.equal(detail.meta?.githubCommitSha || detail.gitSource?.sha, source); assert.notEqual(detail.target, 'production');
    report.deployment = { id: selected.uid, source, url: 'https://' + selected.url, readyState: detail.readyState, target: detail.target || 'preview', errorCode: detail.errorCode || null };
    const project = api('/v9/projects/' + projectId), prod = project.targets?.production;
    report.production = { id: prod?.id, source: prod?.meta?.githubCommitSha || prod?.gitSource?.sha };
    if (detail.readyState !== 'READY') throw Error('PREVIEW_NOT_READY');
    const origin = new URL(report.deployment.url); assert(origin.hostname.endsWith('.vercel.app'));
    const local = require('dotenv').parse(fs.readFileSync('.env.local'));
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
    report.previewSourceStable = (finalDetail.meta?.githubCommitSha || finalDetail.gitSource?.sha) === source && finalDetail.readyState === 'READY';
    report.productionTargetUnchangedDuringProbes = finalProject.targets?.production?.id === prod?.id;
    report.result = report.tests.length === 22 && report.tests.every(test => test.result === 'PASS') && report.previewSourceStable && report.productionTargetUnchangedDuringProbes ? 'PASS' : 'FAIL';
  } catch (error) { report.errorCode = error.message?.startsWith('PREVIEW_') || error.message?.startsWith('EXACT_') ? error.message : 'PREVIEW_VERIFICATION_UNAVAILABLE'; }
  const stamp = report.checkedAt.replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(__dirname, 'preview407-' + stamp + '.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'preview407-latest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
main().catch(() => { console.error('PREVIEW_READ_ONLY_FAILED'); process.exitCode = 1; });
