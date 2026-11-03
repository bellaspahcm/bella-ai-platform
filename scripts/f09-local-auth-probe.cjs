'use strict';
// Local disposable stack only. Never print credentials or tokens.
const { spawnSync } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const container = 'supabase_db_bella-preschool-532b3b8a';
const containerId = 'e981480aea7809a19969471f54275f719dc5afa995587aae903764a0a6b9ed45';
const profile = 'C:/Users/DELL/AppData/Local/Bella/Preschool/DisposableProfiles/bella-preschool-532b3b8a';
const cli = 'C:/Users/DELL/AppData/Roaming/npm/node_modules/supabase/dist/supabase.js';
const tenant = 'a0000000-0000-4000-8000-8ac103f865e8';
const ids = [];
const menuIds = [];
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    const error = result.stderr.match(/(?:ERROR|FATAL):\s*([^\r\n]+)/)?.[1] ?? 'UNKNOWN';
    throw new Error(`LOCAL_DATABASE_COMMAND_FAILED:${error}`);
  }
  return result.stdout.trim();
}
function sql(query) { return docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], query); }
function requireTrue(value, label) { if (!value) throw new Error(label); console.log('PASS ' + label); }

async function main() {
  requireTrue(docker(['inspect', container, '--format', '{{.Id}}']) === containerId, 'LOCAL_CONTAINER_ID');
  const status = spawnSync(process.execPath, [cli, 'status', '--workdir', profile, '--output', 'json'], { encoding: 'utf8', windowsHide: true });
  if (status.status !== 0) throw new Error('LOCAL_STATUS_FAILED');
  const config = JSON.parse(status.stdout);
  requireTrue(config.API_URL === 'http://127.0.0.1:32314', 'LOCAL_API_IDENTITY');
  const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const password = randomBytes(24).toString('hex');
  const token = randomUUID();
const tenantB = 'a8f9c54a-919f-4052-b04e-e9c50f5e39c3';
  const sessions = {};
  let tenantBCreated = false;
  let incomplete = false;
  try {
    if (sql(`SELECT count(*) FROM public.tenants WHERE id='${tenantB}' AND product_key='bella_preschool' AND status='active';`) !== '1') {
      throw new Error('RETAINED_TENANT_B_FIXTURE_NOT_FOUND');
    }
    for (const entry of [{ key: 'adminA', role: 'admin', tenant }, { key: 'staffA', role: 'admin_staff', tenant }, { key: 'adminB', role: 'admin', tenant: tenantB }]) {
      const { role } = entry;
      const email = `f09-${entry.key}-${token}@example.invalid`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw new Error('AUTH_FIXTURE_CREATE_FAILED');
      const id = created.data.user.id;
      ids.push(id);
      sql(`INSERT INTO public.users(id,email,full_name,role,status,tenant_id) VALUES ('${id}','${email}','F09 temporary','${role}','active','${entry.tenant}');`);
      const client = createClient(config.API_URL, config.ANON_KEY, options);
      const signed = await client.auth.signInWithPassword({ email, password });
      if (signed.error || signed.data.user?.id !== id) throw new Error('AUTH_SIGN_IN_FAILED');
      const payload = { title: 'F09 temporary', weekNumber: 52, year: 2048, startDate: '2048-12-21', endDate: '2048-12-27', status: 'DRAFT', days: [{ dayOfWeek: 'MON', menuDate: '2048-12-21', mealsPayload: [] }] };
      const args = { p_tenant_id: entry.tenant, p_actor_id: id, p_payload: payload };
      const result = await client.rpc('preschool_save_weekly_menu', args);
      if (role === 'admin') {
        if (result.error) throw new Error(`AUTH_ADMIN_RPC_ERROR:${result.error.code ?? 'UNKNOWN'}:${result.error.message ?? 'NO_MESSAGE'}`);
        requireTrue(!result.error && typeof result.data?.menuId === 'string', 'AUTH_ADMIN_RPC_ALLOWED');
        menuIds.push({ id: result.data.menuId, tenant: entry.tenant });
        sessions[entry.key] = { client, id, menuId: result.data.menuId, payload };
        const wrongTenant = await client.rpc('preschool_save_weekly_menu', { ...args, p_tenant_id: randomUUID() });
        requireTrue(Boolean(wrongTenant.error) && wrongTenant.error.code === '42501', 'AUTH_FORGED_TENANT_DENIED');
        const wrongActor = await client.rpc('preschool_save_weekly_menu', { ...args, p_actor_id: randomUUID() });
        requireTrue(Boolean(wrongActor.error) && wrongActor.error.code === '42501', 'AUTH_FORGED_ACTOR_DENIED');
        const direct = await client.from('edu_weekly_menus').insert({ tenant_id: entry.tenant, week_number: 51, year: 2048, start_date: '2048-12-14', end_date: '2048-12-20', title: 'F09 direct', status: 'DRAFT' });
        requireTrue(Boolean(direct.error) && direct.error.code === '42501', 'AUTH_DIRECT_INSERT_DENIED');
        const read = await client.from('edu_weekly_menus').select('id,title,updated_at,edu_weekly_menu_days(id)').eq('id', result.data.menuId).single();
        requireTrue(!read.error && read.data?.id === result.data.menuId && read.data.edu_weekly_menu_days.length === 1, 'AUTH_ADMIN_DETAIL_READ');
        const list = await client.from('edu_weekly_menus').select('id').eq('tenant_id', entry.tenant);
        requireTrue(!list.error && list.data.some(row => row.id === result.data.menuId), 'AUTH_ADMIN_LIST_READ');
        const update = await client.rpc('preschool_save_weekly_menu', { ...args, p_payload: { ...payload, menuId: result.data.menuId, expectedUpdatedAt: result.data.updatedAt, title: 'F09 temporary edited' } });
        requireTrue(!update.error && update.data?.menuId === result.data.menuId, 'AUTH_ADMIN_UPDATE');
        const reload = await client.from('edu_weekly_menus').select('id,title').eq('id', result.data.menuId).single();
        requireTrue(!reload.error && reload.data?.title === 'F09 temporary edited', 'AUTH_ADMIN_RELOAD');
      } else {
        requireTrue(Boolean(result.error) && result.error.code === '42501', 'AUTH_STAFF_WITHOUT_GRANT_DENIED');
      }
    }
    const { client: a, id: actorA } = sessions.adminA;
    const b = sessions.adminB;
    const foreignRead = await a.from('edu_weekly_menus').select('id').eq('id', b.menuId);
    requireTrue(!foreignRead.error && foreignRead.data.length === 0, 'AUTH_REAL_TENANT_B_READ_DENIED');
    const foreignWrite = await a.rpc('preschool_save_weekly_menu', { p_tenant_id: tenantB, p_actor_id: actorA, p_payload: b.payload });
    requireTrue(Boolean(foreignWrite.error) && foreignWrite.error.code === '42501', 'AUTH_REAL_TENANT_B_WRITE_DENIED');
  } finally {
    for (const item of menuIds) {
      try { sql(`BEGIN; DELETE FROM public.edu_weekly_menu_days WHERE tenant_id='${item.tenant}' AND menu_id='${item.id}'; DELETE FROM public.edu_weekly_menus WHERE tenant_id='${item.tenant}' AND id='${item.id}' AND title IN ('F09 temporary','F09 temporary edited'); COMMIT;`); } catch { incomplete = true; }
    }
    for (const id of ids) {
      try { sql(`DELETE FROM public.users WHERE id='${id}' AND tenant_id IN ('${tenant}','${tenantB}') AND full_name='F09 temporary';`); } catch { incomplete = true; }
      const deleted = await admin.auth.admin.deleteUser(id);
      if (deleted.error) incomplete = true;
    }
    if (incomplete) throw new Error('LOCAL_FIXTURE_CLEANUP_INCOMPLETE');
    console.log('PASS LOCAL_FIXTURE_CLEANUP');
    if (tenantBCreated) console.log(`LOCAL_TENANT_B_RETAINED ${tenantB}`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
