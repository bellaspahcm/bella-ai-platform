'use strict';
// Local disposable Supabase DB only. Do not log keys, passwords, or tokens.
const { spawnSync } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const container = 'supabase_db_bella-preschool-532b3b8a';
const containerId = 'e981480aea7809a19969471f54275f719dc5afa995587aae903764a0a6b9ed45';
const profile = 'C:/Users/DELL/AppData/Local/Bella/Preschool/DisposableProfiles/bella-preschool-532b3b8a';
const cli = 'C:/Users/DELL/AppData/Roaming/npm/node_modules/supabase/dist/supabase.js';
const tenant = 'a0000000-0000-4000-8000-8ac103f865e8';
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('LOCAL_DB_COMMAND_FAILED');
  return result.stdout.trim();
}
function sql(query) {
  return docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], query);
}
function assert(condition, label) { if (!condition) throw new Error(label); console.log(`PASS ${label}`); }
function claimsSql(actorId) {
  return `SELECT set_config('request.jwt.claim.sub','${actorId}',true); SELECT set_config('request.jwt.claim.role','authenticated',true); SELECT set_config('request.jwt.claims','{"sub":"${actorId}","role":"authenticated"}',true);`;
}
function payload(title, year, weekNumber, extra = {}) {
  return {
    title, weekNumber, year, startDate: '2049-12-01', endDate: '2049-12-07', status: 'DRAFT',
    days: [{ dayOfWeek: 'MON', menuDate: '2049-12-01', mealsPayload: [], ...extra }],
  };
}
async function closeQuietly(client) { if (client) await client.end().catch(() => {}); }

async function main() {
  assert(docker(['inspect', container, '--format', '{{.Id}}']) === containerId, 'LOCAL_CONTAINER_ID');
  const status = spawnSync(process.execPath, [cli, 'status', '--workdir', profile, '--output', 'json'], { encoding: 'utf8', windowsHide: true });
  if (status.status !== 0) throw new Error('LOCAL_STATUS_FAILED');
  const cfg = JSON.parse(status.stdout);
  assert(cfg.API_URL === 'http://127.0.0.1:32314' && typeof cfg.DB_URL === 'string', 'LOCAL_DB_IDENTITY');
  const admin = createClient(cfg.API_URL, cfg.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `f09-atomic-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString('hex');
  const token = randomUUID();
  let actorId;
  let menuId;
  let clientA;
  let clientB;
  let observer;
  let bPromise;
  let aOpen = false;
  let cleaned = true;
  try {
    const authUser = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (authUser.error || !authUser.data.user) throw new Error('AUTH_FIXTURE_CREATE_FAILED');
    actorId = authUser.data.user.id;
    sql(`INSERT INTO public.users(id,email,full_name,role,status,tenant_id) VALUES ('${actorId}','${email}','F09 atomic fixture','admin','active','${tenant}');`);
    const caller = createClient(cfg.API_URL, cfg.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await caller.auth.signInWithPassword({ email, password });
    if (signed.error || signed.data.user?.id !== actorId) throw new Error('AUTH_SIGN_IN_FAILED');

    const pairs = sql(`SELECT y||':'||w FROM generate_series(2047,2050) AS ys(y) CROSS JOIN generate_series(1,53) AS ws(w) WHERE NOT EXISTS (SELECT 1 FROM public.edu_weekly_menus m WHERE m.tenant_id='${tenant}' AND m.year=y AND m.week_number=w AND m.age_group='ALL') ORDER BY y,w LIMIT 2;`).split(/\r?\n/).filter(Boolean);
    if (pairs.length !== 2) throw new Error('NO_FREE_WEEK_FIXTURES');
    const [rollbackYear, rollbackWeek] = pairs[0].split(':').map(Number);
    const [concurrentYear, concurrentWeek] = pairs[1].split(':').map(Number);

    const rollbackTitle = `F09 rollback ${token}`;
    const badPayload = payload(rollbackTitle, rollbackYear, rollbackWeek, { caloriesKcal: 'invalid-calories' });
    const rollbackClient = new Client({ connectionString: cfg.DB_URL, application_name: 'f09_rollback_probe' });
    await rollbackClient.connect();
    try {
      await rollbackClient.query('BEGIN');
      await rollbackClient.query(claimsSql(actorId));
      let caught;
      try {
        await rollbackClient.query('SELECT public.preschool_save_weekly_menu($1::uuid,$2::uuid,$3::jsonb)', [tenant, actorId, JSON.stringify(badPayload)]);
      } catch (error) { caught = error; }
      await rollbackClient.query('ROLLBACK');
      assert(caught?.code === '22P02', 'ROLLBACK_INJECTED_FAILURE');
      const residue = sql(`SELECT (SELECT count(*) FROM public.edu_weekly_menus WHERE tenant_id='${tenant}' AND title='${rollbackTitle}') || ':' || (SELECT count(*) FROM public.edu_weekly_menu_days d JOIN public.edu_weekly_menus m ON m.id=d.menu_id WHERE m.tenant_id='${tenant}' AND m.title='${rollbackTitle}');`);
      assert(residue === '0:0', 'ROLLBACK_MASTER_AND_DAYS_CLEAN');
    } finally { await closeQuietly(rollbackClient); }

    const initial = await caller.rpc('preschool_save_weekly_menu', {
      p_tenant_id: tenant, p_actor_id: actorId, p_payload: payload(`F09 concurrent ${token}`, concurrentYear, concurrentWeek),
    });
    if (initial.error || !initial.data?.menuId || !initial.data?.updatedAt) throw new Error('CONCURRENCY_FIXTURE_CREATE_FAILED');
    menuId = initial.data.menuId;
    const updatePayloadA = { ...payload(`F09 winner A ${token}`, concurrentYear, concurrentWeek), menuId, expectedUpdatedAt: initial.data.updatedAt };
    const updatePayloadB = { ...payload(`F09 winner B ${token}`, concurrentYear, concurrentWeek), menuId, expectedUpdatedAt: initial.data.updatedAt };
    clientA = new Client({ connectionString: cfg.DB_URL, application_name: `f09_concurrency_a_${token}` });
    clientB = new Client({ connectionString: cfg.DB_URL, application_name: `f09_concurrency_b_${token}` });
    observer = new Client({ connectionString: cfg.DB_URL, application_name: `f09_concurrency_observer_${token}` });
    await Promise.all([clientA.connect(), clientB.connect(), observer.connect()]);
    await clientA.query('BEGIN');
    aOpen = true;
    await clientA.query(claimsSql(actorId));
    await clientA.query('SELECT public.preschool_save_weekly_menu($1::uuid,$2::uuid,$3::jsonb)', [tenant, actorId, JSON.stringify(updatePayloadA)]);
    await clientB.query('BEGIN');
    await clientB.query(claimsSql(actorId));
    bPromise = clientB.query('SELECT public.preschool_save_weekly_menu($1::uuid,$2::uuid,$3::jsonb)', [tenant, actorId, JSON.stringify(updatePayloadB)]).then(() => null, error => error);
    let blocked = false;
    const appNameB = `f09_concurrency_b_${token}`;
    for (let attempt = 0; attempt < 100; attempt++) {
      const state = await observer.query('SELECT state,wait_event_type FROM pg_stat_activity WHERE application_name=$1', [appNameB]);
      if (state.rows[0]?.state === 'active' && state.rows[0]?.wait_event_type === 'Lock') { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(blocked, 'CONCURRENCY_BARRIER_LOCK_OBSERVED');
    await clientA.query('COMMIT');
    aOpen = false;
    const conflict = await bPromise;
    assert(conflict?.code === '40001' && /WEEKLY_MENU_VERSION_CONFLICT/.test(conflict.message), 'CONCURRENT_SAME_VERSION_ONE_WINNER');
    await clientB.query('ROLLBACK');
    const winner = sql(`SELECT title FROM public.edu_weekly_menus WHERE tenant_id='${tenant}' AND id='${menuId}';`);
    assert(winner === `F09 winner A ${token}`, 'CONCURRENCY_SINGLE_WINNER_READBACK');
  } finally {
    if (aOpen) await clientA?.query('ROLLBACK').catch(() => {});
    if (bPromise) await Promise.race([bPromise, new Promise(resolve => setTimeout(resolve, 2000))]).catch(() => {});
    await Promise.all([closeQuietly(clientA), closeQuietly(clientB), closeQuietly(observer)]);
    if (menuId) {
      try { sql(`BEGIN; DELETE FROM public.edu_weekly_menu_days WHERE tenant_id='${tenant}' AND menu_id='${menuId}'; DELETE FROM public.edu_weekly_menus WHERE tenant_id='${tenant}' AND id='${menuId}' AND title LIKE 'F09 %'; COMMIT;`); }
      catch { cleaned = false; }
    }
    if (actorId) {
      try { sql(`DELETE FROM public.users WHERE id='${actorId}' AND tenant_id='${tenant}' AND full_name='F09 atomic fixture';`); }
      catch { cleaned = false; }
      if ((await admin.auth.admin.deleteUser(actorId)).error) cleaned = false;
    }
    assert(cleaned, 'ATOMICITY_FIXTURE_CLEANUP');
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
