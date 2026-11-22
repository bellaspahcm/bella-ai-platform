// Real HTTP probe against a disposable fixture and the local E2E-configured app.
// One JSON fixture line on stdin; credentials are never logged or written here.
const fs = require('node:fs');
const readline = require('node:readline');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const env = dotenv.parse(fs.readFileSync('.env.e2e'));
const target = 'bmnbqbcdbuklhopfbopv';
const remote = `https://${target}.supabase.co`;
function claim(key) { try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { return {}; } }
if (env.NEXT_PUBLIC_SUPABASE_URL !== remote || claim(env.SUPABASE_SERVICE_ROLE_KEY || '').ref !== target ||
    claim(env.SUPABASE_SERVICE_ROLE_KEY || '').role !== 'service_role' || claim(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').ref !== target) {
  throw new Error('E2E_SUPABASE_TARGET_REJECTED');
}
const service = createClient(remote, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
if (process.stdin.isTTY) process.stdin.setRawMode(true);
const input = readline.createInterface({ input: process.stdin, terminal: false });
input.once('line', async line => {
  input.close();
  const f = JSON.parse(line);
  const tokens = {};
  const findings = [];
  const filter = process.env.INTERIOR_PROBE_FILTER ? new RegExp(process.env.INTERIOR_PROBE_FILTER) : null;
  async function run(name, fn) {
    if (filter && !filter.test(name)) return;
    try {
      const result = await fn();
      findings.push({ name, ...result });
      console.log(`${result.pass ? 'PASS' : 'FAIL'} ${name}: ${result.detail}`);
    } catch (e) {
      findings.push({ name, pass: false, detail: e.message });
      console.log(`FAIL ${name}: ${e.message}`);
    }
  }
  const result = (pass, detail) => ({ pass: Boolean(pass), detail });
  async function http(actor, method, path, body, { app = true, headers = {}, raw = false } = {}) {
    const url = (app ? 'http://127.0.0.1:4319' : remote) + path;
    const res = await fetch(url, {
      method, headers: { authorization: `Bearer ${tokens[actor]}`, ...(app ? {} : { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY }),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(120000),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }
  const isDenied = r => r.status === 403 && /INTERIOR_(PERMISSION_DENIED|ACCESS_DENIED)/.test(String(r.data?.error));
  const isRlsDenied = r => (r.status === 403 && (r.data?.code === '42501' || /row.level security|permission denied/i.test(String(r.data?.message)))) ||
    (r.status >= 200 && r.status < 300 && Array.isArray(r.data) && r.data.length === 0);
  const describe = r => `HTTP ${r.status}${r.data?.error ? ` error=${r.data.error}` : ''}${r.data?.code ? ` code=${r.data.code}` : ''}`;
  async function row(table, id) {
    const { data, error } = await service.from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`DB ${table}: ${error.message}`);
    return data;
  }
  try {
    for (const actor of f.actors) {
      const res = await fetch(`${remote}/auth/v1/token?grant_type=password`, { method: 'POST',
        headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ email: actor.email, password: f.pass }), signal: AbortSignal.timeout(30000) });
      const data = await res.json();
      if (!res.ok || !data.access_token) throw new Error(`Auth ${actor.k}: HTTP ${res.status}, ${data.error_code || 'no token'}`);
      tokens[actor.k] = data.access_token;
    }
    console.log(`Authenticated ${f.actors.length} synthetic actors on isolated E2E`);
    const root = `/api/interior/crm/customers/${f.customer}`;
    for (const kind of ['contacts', 'addresses']) {
      const singular = kind === 'contacts' ? 'contact' : 'address';
      const table = `interior_customer_${kind}`;
      const create = kind === 'contacts' ? { name: 'Fixture contact', phone: '000' } : { fullAddress: 'Fixture address', city: 'Fixture city' };
      const update = kind === 'contacts' ? { name: 'Fixture updated' } : { fullAddress: 'Fixture updated' };
      let created;
      await run(`Application ${singular} create OWNER`, async () => {
        const r = await http('owner', 'POST', `${root}/${kind}`, create);
        created = r.data?.data?.id;
        const db = created ? await row(table, created) : null;
        return result(r.status === 201 && db?.tenant_id === f.tenantA && db.customer_id === f.customer, describe(r));
      });
      await run(`Application ${singular} read EXECUTIVE`, async () => {
        const r = await http('reader', 'GET', `${root}/${kind}`);
        return result(r.status === 200 && r.data?.data?.some(x => x.id === created), describe(r));
      });
      for (const [method, suffix, payload] of [['POST', '', create], ['PATCH', `/${created}`, update], ['DELETE', `/${created}`, undefined]]) {
        await run(`Application ${singular} ${method} read-only denied`, async () => {
          const r = await http('reader', method, `${root}/${kind}${suffix}`, payload);
          const db = await row(table, created);
          return result(isDenied(r) && db, describe(r));
        });
      }
      await run(`Application ${singular} update OWNER`, async () => {
        const r = await http('owner', 'PATCH', `${root}/${kind}/${created}`, update);
        const db = await row(table, created);
        return result(r.status === 200 && (kind === 'contacts' ? db?.name : db?.full_address) === 'Fixture updated', describe(r));
      });
      await run(`Application ${singular} delete OWNER`, async () => {
        const r = await http('owner', 'DELETE', `${root}/${kind}/${created}`);
        return result(r.status === 200 && !(await row(table, created)), describe(r));
      });
      const restPayload = kind === 'contacts'
        ? { tenant_id: f.tenantA, customer_id: f.customer, name: 'REST fixture', phone: '000' }
        : { tenant_id: f.tenantA, customer_id: f.customer, full_address: 'REST fixture', city: 'Fixture city' };
      let restId;
      await run(`PostgREST ${singular} create OWNER`, async () => {
        const r = await http('owner', 'POST', `/rest/v1/${table}`, restPayload, { app: false, headers: { prefer: 'return=representation' } });
        restId = r.data?.[0]?.id;
        return result(r.status === 201 && restId && await row(table, restId), describe(r));
      });
      const endpoint = `/rest/v1/${table}?id=eq.${restId}`;
      await run(`PostgREST ${singular} read EXECUTIVE`, async () => {
        const r = await http('reader', 'GET', endpoint, undefined, { app: false });
        return result(r.status === 200 && r.data?.length === 1, describe(r));
      });
      const restUpdate = kind === 'contacts' ? { name: 'REST updated' } : { full_address: 'REST updated' };
      for (const [method, path, payload] of [['POST', `/rest/v1/${table}`, restPayload], ['PATCH', endpoint, restUpdate], ['DELETE', endpoint, undefined]]) {
        await run(`PostgREST ${singular} ${method} read-only denied`, async () => {
          const r = await http('reader', method, path, payload, { app: false, headers: { prefer: 'return=representation' } });
          const db = await row(table, restId);
          return result(isRlsDenied(r) && db && (kind === 'contacts' ? db.name : db.full_address) === 'REST fixture', describe(r));
        });
      }
      await run(`PostgREST ${singular} update OWNER`, async () => {
        const r = await http('owner', 'PATCH', endpoint, restUpdate, { app: false, headers: { prefer: 'return=representation' } });
        const db = await row(table, restId);
        return result(r.status === 200 && (kind === 'contacts' ? db?.name : db?.full_address) === 'REST updated', describe(r));
      });
      await run(`PostgREST ${singular} delete OWNER`, async () => {
        const r = await http('owner', 'DELETE', endpoint, undefined, { app: false, headers: { prefer: 'return=representation' } });
        return result(r.status === 200 && !(await row(table, restId)), describe(r));
      });
    }
    const campaignUrl = p => `/api/interior/delivery/acceptance/campaigns?projectId=${p}`;
    for (const actor of ['branch', 'project']) {
      for (const [project, allowed] of [[f.projectA, true], [f.projectB, false]]) {
        await run(`Application campaign read ${actor} ${allowed ? 'in' : 'outside'} scope`, async () => {
          const r = await http(actor, 'GET', campaignUrl(project));
          return result(allowed ? r.status === 200 : isDenied(r), describe(r));
        });
      }
    }
    await run('Application rejects forged actor header', async () => {
      const r = await http('other', 'GET', campaignUrl(f.projectA), undefined, { headers: { 'x-user-id': f.owner } });
      return result(isDenied(r), describe(r));
    });
    await run('PostgREST project scoped read excludes other project', async () => {
      const r = await http('project', 'GET', `/rest/v1/interior_acceptance_sessions?id=in.(${f.sessionA},${f.sessionB})&select=id`, undefined, { app: false });
      return result(r.status === 200 && r.data?.length === 1 && r.data[0].id === f.sessionA, describe(r));
    });
    await run('PostgREST branch scoped read excludes other branch', async () => {
      const r = await http('branch', 'GET', `/rest/v1/interior_acceptance_sessions?id=in.(${f.sessionA},${f.sessionB})&select=id`, undefined, { app: false });
      return result(r.status === 200 && r.data?.length === 1 && r.data[0].id === f.sessionA, describe(r));
    });
    const campaignBody = { projectId: f.projectA, campaignCode: `EXTRA-${f.tag}`, campaignName: 'Security fixture' };
    await run('Application campaign create denies reader', async () => {
      const r = await http('reader', 'POST', '/api/interior/delivery/acceptance/campaigns', campaignBody);
      return result(isDenied(r), describe(r));
    });
    await run('Application campaign create allows project scoped PM', async () => {
      const r = await http('project', 'POST', '/api/interior/delivery/acceptance/campaigns', campaignBody);
      const db = r.data?.data?.id ? await row('interior_acceptance_campaigns', r.data.data.id) : null;
      return result(r.status === 201 && db?.project_id === f.projectA && db.created_by_user_id === f.project, describe(r));
    });
    await run('PostgREST campaign update denies reader', async () => {
      const r = await http('reader', 'PATCH', `/rest/v1/interior_acceptance_campaigns?id=eq.${f.campaignA}`, { campaign_name: 'Spoof' }, { app: false, headers: { prefer: 'return=representation' } });
      const db = await row('interior_acceptance_campaigns', f.campaignA);
      return result(isRlsDenied(r) && db?.campaign_name === 'Security A', describe(r));
    });
    await run('PostgREST campaign update allows project scoped PM', async () => {
      const r = await http('project', 'PATCH', `/rest/v1/interior_acceptance_campaigns?id=eq.${f.campaignA}`, { description: 'Scoped fixture' }, { app: false, headers: { prefer: 'return=representation' } });
      const db = await row('interior_acceptance_campaigns', f.campaignA);
      return result(r.status === 200 && r.data?.length === 1 && db?.description === 'Scoped fixture', describe(r));
    });
    const sessions = '/api/interior/delivery/acceptance/sessions';
    const sessionBody = { campaignId: f.campaignA, projectId: f.projectA, sessionCode: `EXTRA-${f.tag}`, sessionType: 'ITEM_BASED', inspectionScope: 'Fixture', inspectionDate: '2026-11-21', customerRepresentative: 'Fixture' };
    await run('Application session read allows project scoped PM', async () => {
      const r = await http('project', 'GET', `${sessions}?projectId=${f.projectA}`);
      return result(r.status === 200 && r.data?.data?.some(s => s.id === f.sessionA), describe(r));
    });
    await run('Application session create denies reader', async () => {
      const r = await http('reader', 'POST', sessions, sessionBody);
      return result(isDenied(r), describe(r));
    });
    await run('Application session create allows project scoped PM', async () => {
      const r = await http('project', 'POST', sessions, sessionBody);
      const db = r.data?.data?.id ? await row('interior_acceptance_sessions', r.data.data.id) : null;
      return result(r.status === 201 && db?.project_id === f.projectA && db.recorder_actor_id === f.project, describe(r));
    });
    await run('PostgREST session update denies reader', async () => {
      const r = await http('reader', 'PATCH', `/rest/v1/interior_acceptance_sessions?id=eq.${f.sessionB}`, { inspection_result: 'ACCEPTED_WITHOUT_ISSUES' }, { app: false, headers: { prefer: 'return=representation' } });
      const db = await row('interior_acceptance_sessions', f.sessionB);
      return result(isRlsDenied(r) && db?.inspection_result === 'PENDING_REMEDIATION', describe(r));
    });
    await run('PostgREST session rejects spoofed recorder', async () => {
      const payload = { tenant_id: f.tenantA, campaign_id: f.campaignA, project_id: f.projectA, session_code: `SPOOF-${f.tag}`, session_type: 'ITEM_BASED', inspection_scope: 'Fixture', inspection_date: '2026-11-21', recorder_actor_id: f.other, customer_representative: 'Fixture' };
      const r = await http('project', 'POST', '/rest/v1/interior_acceptance_sessions', payload, { app: false });
      return result(r.status === 403 && r.data?.code === '42501', describe(r));
    });
    await run('PostgREST session rejects mismatched campaign project', async () => {
      const payload = { tenant_id: f.tenantA, campaign_id: f.campaignB, project_id: f.projectA, session_code: `MISMATCH-${f.tag}`, session_type: 'ITEM_BASED', inspection_scope: 'Fixture', inspection_date: '2026-11-21', recorder_actor_id: f.project, customer_representative: 'Fixture' };
      const r = await http('project', 'POST', '/rest/v1/interior_acceptance_sessions', payload, { app: false, headers: { prefer: 'return=representation' } });
      return result((r.status === 403 && r.data?.code === '42501') || (r.status === 409 && r.data?.code === '23503'), describe(r));
    });
    const notes = `/api/interior/delivery/acceptance/sessions/${f.sessionA}/notes`;
    const noteBody = { category: 'GENERAL_NOTE', severity: 'low', assessmentStatus: 'NO_ISSUES', description: 'Security synthetic note', createdByUserId: f.other };
    await run('Application note read allows project scoped PM', async () => {
      const r = await http('project', 'GET', notes);
      return result(r.status === 200 && Array.isArray(r.data?.data), describe(r));
    });
    await run('Application note create denies reader', async () => {
      const r = await http('reader', 'POST', notes, noteBody);
      return result(isDenied(r), describe(r));
    });
    await run('Application note create allows PM and ignores spoofed actor', async () => {
      const r = await http('project', 'POST', notes, noteBody);
      const db = r.data?.data?.id ? await row('interior_acceptance_notes', r.data.data.id) : null;
      return result(r.status === 201 && db?.created_by_user_id === f.project && db.session_id === f.sessionA, describe(r));
    });
    await run('PostgREST note insert rejects spoofed actor', async () => {
      const r = await http('project', 'POST', '/rest/v1/interior_acceptance_notes', { tenant_id: f.tenantA, session_id: f.sessionA, category: 'GENERAL_NOTE', description: 'Spoof', created_by_user_id: f.other }, { app: false });
      return result(r.status === 403 && r.data?.code === '42501', describe(r));
    });
    await run('PostgREST approval RPC denies exact permission', async () => {
      const r = await http('reader', 'POST', '/rest/v1/rpc/interior_decide_acceptance_session', { p_session_id: f.sessionA, p_decision: 'APPROVED' }, { app: false });
      return result(r.status === 400 && /INTERIOR_PERMISSION_DENIED/.test(String(r.data?.message)), describe(r));
    });
    const ev = `/api/interior/delivery/acceptance/sessions/${f.sessionA}/evidence`;
    const pdf = Buffer.from('%PDF-1.4\nSynthetic fixture\n%%EOF\n');
    const upload = extra => ({ fileBase64: pdf.toString('base64'), fileName: 'fixture.pdf', evidenceCategory: 'OVERALL', ...extra });
    await run('Application evidence denies actor without upload', async () => {
      const r = await http('reader', 'POST', ev, upload());
      return result(isDenied(r), describe(r));
    });
    await run('Application evidence rejects fake PDF', async () => {
      const r = await http('pm', 'POST', ev, upload({ fileBase64: Buffer.from('fake pdf').toString('base64'), mimeType: 'application/pdf' }));
      return result(r.status === 415 && /Unsupported|unrecognized/.test(String(r.data?.error)), describe(r));
    });
    await run('Application evidence rejects over 10 MiB', async () => {
      const large = Buffer.alloc(10 * 1024 * 1024 + 1, 0x41); pdf.copy(large);
      const r = await http('pm', 'POST', ev, upload({ fileBase64: large.toString('base64') }));
      return result(r.status === 413, describe(r));
    });
    const prefix = `${f.tenantA}/${f.projectA}/acceptance/${f.sessionA}`;
    await run('Application evidence cleans up mismatched note upload', async () => {
      const before = await service.storage.from('interior-site-evidence').list(prefix);
      if (before.error) throw before.error;
      const r = await http('pm', 'POST', ev, upload({ noteId: f.noteB }));
      const after = await service.storage.from('interior-site-evidence').list(prefix);
      if (after.error) throw after.error;
      return result(r.status === 500 && /ACCEPTANCE_NOTE_NOT_FOUND/.test(String(r.data?.error)) && before.data.length === after.data.length, describe(r));
    });
    let evidence;
    await run('Application evidence uploads valid PDF into server path', async () => {
      const r = await http('pm', 'POST', ev, upload({ bucketId: 'forged', storagePath: 'forged', tenantId: f.tenantB, actorId: f.other, mimeType: 'image/png' }));
      evidence = r.data?.data;
      const db = evidence?.id ? await row('interior_acceptance_evidence_objects', evidence.id) : null;
      return result(r.status === 201 && db?.tenant_id === f.tenantA && db.uploaded_by_user_id === f.pm && db.bucket_id === 'interior-site-evidence' && db.storage_path.startsWith(prefix + '/') && db.mime_type === 'application/pdf', describe(r));
    });
    await run('Uploaded evidence is not public', async () => {
      if (!evidence?.storagePath) throw new Error('valid upload prerequisite failed');
      const res = await fetch(`${remote}/storage/v1/object/public/interior-site-evidence/${evidence.storagePath}`, { signal: AbortSignal.timeout(30000) });
      return result([400, 401, 403, 404].includes(res.status), `HTTP ${res.status}`);
    });
    await run('Application approval denies reader', async () => {
      const r = await http('reader', 'POST', `/api/interior/delivery/acceptance/sessions/${f.sessionA}/approval`, { decision: 'APPROVED' });
      return result(isDenied(r), describe(r));
    });
    await run('Application approval allows authorized actor and records audit', async () => {
      const r = await http('pm', 'POST', `/api/interior/delivery/acceptance/sessions/${f.sessionA}/approval`, { decision: 'APPROVED', approvedByActorId: f.other });
      const db = await row('interior_acceptance_sessions', f.sessionA);
      const audit = await service.from('interior_acceptance_approval_audit').select('actor_id,decision').eq('session_id', f.sessionA);
      return result(r.status === 200 && db?.approval_status === 'APPROVED' && db.approved_by_actor_id === f.pm && !audit.error && audit.data?.some(a => a.actor_id === f.pm && a.decision === 'APPROVED'), describe(r));
    });
    console.log(`RESULT ${findings.filter(x => x.pass).length}/${findings.length} PASS`);
    process.exitCode = findings.every(x => x.pass) ? 0 : 1;
  } catch (e) {
    console.error(`Probe incomplete: ${e.message}`);
    process.exitCode = 1;
  }
});
