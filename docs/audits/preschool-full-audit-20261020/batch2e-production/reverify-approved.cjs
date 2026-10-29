const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const dir = __dirname;
const scopePath = path.join(dir, '../batch1/reviewed-scope.json');
const approved = JSON.parse(fs.readFileSync(scopePath));
const executionScope = JSON.parse(fs.readFileSync(path.join(dir, '../batch2a-rpc-20261021/execution-manifest.json')));
const expectedProject = 'lvnvkpyxtuilhrabtlwv';
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(scopePath)).digest('hex'), '071c9dea409ff70660842b34b63f12f02b3fc755c7eb5e9ceee6a92d7442be9c');
assert.equal(approved.targetProject, expectedProject);
assert.equal(executionScope.target, expectedProject);
assert.deepEqual(approved.tables, executionScope.tables);
assert.equal(new Set(approved.tables).size, 32);
const env = require('dotenv').parse(fs.readFileSync('.env.local'));
const origin = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
assert.equal(origin, 'https://' + expectedProject + '.supabase.co');
const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
for (const [key, role] of [[anon, 'anon'], [service, 'service_role']]) {
  const claim = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
  assert.equal(claim.ref, expectedProject);
  assert.equal(claim.role, role);
}
async function request(resource, key, body) {
  try {
    const response = await fetch(origin + '/rest/v1/' + resource, {
      method: body ? 'POST' : 'GET', headers: { apikey: key, Authorization: 'Bearer ' + key,
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { /* empty service RPC response is expected */ }
    return { status: response.status, code: typeof json?.code === 'string' ? json.code : null,
      denied: response.status >= 400 && ['42501', 'PGRST202'].includes(json?.code),
      ok: response.ok, returnedRowCount: Array.isArray(json) ? json.length : 0 };
  } catch (error) { return { status: null, errorType: error.name, denied: false, ok: false }; }
}
async function bounded(items, fn) {
  const result = new Array(items.length);
  let index = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < items.length) { const current = index++; result[current] = await fn(items[current]); }
  }));
  return result;
}
async function main() {
  const reads = await bounded(approved.tables.flatMap(table => ['none', 'target', 'other'].map(variant => ({ table, variant }))), async item => {
    const filter = item.variant === 'none' ? '' : '&tenant_id=eq.' + (item.variant === 'target'
      ? 'ed100000-0000-0000-0000-000000000001' : '00000000-0000-4000-8000-000000000099');
    return { ...item, ...await request(item.table + '?select=tenant_id&limit=1' + filter, anon) };
  });
  const serviceReads = await bounded(approved.tables, async table => ({ table,
    ...await request(table + '?select=tenant_id&limit=0', service) }));
  const anonymousRpc = await request('rpc/exec_sql', anon, { sql_query: 'SELECT 1' });
  const maintenanceRpc = await request('rpc/exec_sql', service, { sql_query: 'SELECT 1' });
  const result = { checkedAt: new Date().toISOString(), project: expectedProject,
    scope: 'Exact approved32 direct relations and exec_sql SELECT1 privilege probe',
    productionBusinessMutation: 'NOT_PERFORMED', anonymousUserJwt: false,
    secretsSaved: false, businessRowContentsSaved: false, reads, serviceReads,
    anonymousRpc, maintenanceRpc, anonymousDenied: reads.filter(item => item.denied).length,
    anonymousRequests: reads.length, serviceAllowed: serviceReads.filter(item => item.ok).length,
    result: reads.length === 96 && reads.every(item => item.denied) && serviceReads.every(item => item.ok)
      && anonymousRpc.denied && maintenanceRpc.ok ? 'PASS' : 'FAIL' };
  fs.writeFileSync(path.join(dir, 'approved-http.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ project: expectedProject, result: result.result,
    anonymousDenied: result.anonymousDenied, anonymousRequests: result.anonymousRequests,
    serviceAllowed: result.serviceAllowed, anonymousRpc: anonymousRpc.status, maintenanceRpc: maintenanceRpc.status }));
  if (result.result !== 'PASS') process.exitCode = 1;
}
main().catch(error => { console.error(error.name + ':VERIFICATION_FAILED'); process.exitCode = 1; });
