// Manual probe for disposable fixtures in the Bella Interior isolated E2E project.
// Supply one JSON line on stdin: { key, pass, id, actors }. Never print credentials.
const readline = require('node:readline');

const BASE = 'https://bmnbqbcdbuklhopfbopv.supabase.co';
if (process.stdin.isTTY) process.stdin.setRawMode(true);
const input = readline.createInterface({ input: process.stdin, terminal: false });
input.once('line', async (line) => {
  input.close();
  try {
    const { key, pass, id, actors } = JSON.parse(line);
    const tokens = {};
    for (const actor of actors) {
      const response = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: key, 'content-type': 'application/json' },
        body: JSON.stringify({ email: actor.email, password: pass }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Auth ${actor.k} returned HTTP ${response.status} (${error.error_code || error.code || error.error || 'unknown'})`);
      }
      const body = await response.json();
      if (!body.access_token) throw new Error(`Auth ${actor.k} returned no access token`);
      tokens[actor.k] = body.access_token;
    }
    console.log('Five synthetic E2E actors authenticated');

    async function request(actor, method, path, body, extraHeaders = {}) {
      const response = await fetch(`${BASE}${path}`, {
        method,
        headers: { apikey: key, authorization: `Bearer ${tokens[actor]}`, 'content-type': 'application/json',
          prefer: 'return=representation', ...extraHeaders },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, data };
    }
    let failures = 0;
    function check(label, result, passed) {
      console.log(`${passed ? 'PASS' : 'FAIL'} ${label}: HTTP ${result.status}`);
      if (!passed) failures++;
    }
    const emptyOrForbidden = r => r.status === 403 || (r.status >= 200 && r.status < 300 && Array.isArray(r.data) && r.data.length === 0);
    const customer = `/rest/v1/interior_customers?id=eq.${id.customer}&select=id,name`;
    let r = await request('admin', 'GET', customer);
    check('Admin reads same-tenant CRM', r, r.status === 200 && r.data?.length === 1 && r.data[0].id === id.customer);
    r = await request('none', 'GET', customer);
    check('Actor without CRM read denied', r, emptyOrForbidden(r));
    r = await request('reader', 'GET', customer);
    check('Read-only actor reads CRM', r, r.status === 200 && r.data?.length === 1);
    r = await request('reader', 'PATCH', customer, { name: 'Unauthorized change' });
    check('Read-only actor cannot update CRM', r, emptyOrForbidden(r));
    r = await request('reader', 'DELETE', customer);
    check('Read-only actor cannot delete CRM', r, emptyOrForbidden(r));
    r = await request('none', 'POST', '/rest/v1/interior_customers', { tenant_id: id.tenantA, code: 'SEC-E2E-NO-CREATE', name: 'Denied' });
    check('Actor without create denied', r, r.status === 401 || r.status === 403);
    r = await request('other', 'GET', customer, undefined, { 'x-tenant-id': id.tenantA, 'x-user-id': id.admin });
    check('Other tenant with forged identity headers denied', r, emptyOrForbidden(r));
    const session = `/rest/v1/interior_acceptance_sessions?id=eq.${id.session}&select=id`;
    r = await request('admin', 'PATCH', session, { approval_status: 'APPROVED' });
    check('Direct approval status write denied', r, r.status === 401 || r.status === 403);
    r = await request('admin', 'PATCH', session, { approved_by_actor_id: id.admin });
    check('Direct approver identity write denied', r, r.status === 401 || r.status === 403);
    r = await request('admin', 'POST', '/rest/v1/rpc/interior_decide_acceptance_session', { p_session_id: id.session, p_decision: 'APPROVED' });
    check('Approval RPC denies actor without action', r, r.status >= 400 && r.status < 500 && /INTERIOR_PERMISSION_DENIED/.test(String(r.data?.message)));
    r = await request('approver', 'POST', '/rest/v1/rpc/interior_decide_acceptance_session', { p_session_id: id.session, p_decision: 'APPROVED' });
    check('Approval RPC accepts authorized actor', r, r.status === 200 && r.data?.approval_status === 'APPROVED' && r.data?.approved_by_actor_id === id.approver);
    const upload = await fetch(`${BASE}/storage/v1/object/interior-site-evidence/${id.tenantB}/invalid-path.pdf`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${tokens.approver}`, 'content-type': 'application/pdf' },
      body: '%PDF-1.4\nSecurity fixture\n',
    });
    const uploadData = await upload.json().catch(() => ({}));
    r = { status: upload.status, data: uploadData };
    const storageDenied = upload.status === 401 || upload.status === 403 ||
      (upload.status === 400 && (String(uploadData.statusCode) === '403' || /row.level security|unauthorized/i.test(String(uploadData.message))));
    check('Direct untrusted Storage upload denied', r, storageDenied);
    if (!storageDenied) console.log(`Storage rejection: ${uploadData.error || uploadData.code || 'unknown'}; ${uploadData.message || ''}`);
    process.exitCode = failures ? 1 : 0;
  } catch (error) {
    console.error(`Probe could not complete: ${error.message}`);
    process.exitCode = 1;
  }
});
