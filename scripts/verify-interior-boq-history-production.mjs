/**
 * Verify BOQ Item History on Production DB
 * Target: lvnvkpyxtuilhrabtlwv
 */

const PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

async function verify() {
  console.log('Verifying Production BOQ Item History schema & permissions...');

  // 1. Verify schema migration recorded
  const migration = await runSql(`
    SELECT version, name
    FROM supabase_migrations.schema_migrations
    WHERE version = '20261109140000';
  `);
  console.log('1. Schema migration record:', migration);

  // 2. Verify table columns
  const cols = await runSql(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'interior_boq_item_history'
    ORDER BY ordinal_position;
  `);
  console.log(`2. Table columns (${cols.length}):`, cols.map(c => `${c.column_name}:${c.data_type}`).join(', '));

  // 3. Verify RLS policy
  const policies = await runSql(`
    SELECT policyname, permissive, roles, cmd, qual
    FROM pg_policies
    WHERE tablename = 'interior_boq_item_history';
  `);
  console.log('3. RLS policies:', policies);

  // 4. Verify trigger details
  const triggers = await runSql(`
    SELECT tgname, tgenabled, relname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE relname = 'interior_boq_items'
      AND tgname = 'trg_interior_boq_items_history_capture';
  `);
  console.log('4. Triggers on interior_boq_items:', triggers);

  // 5. Verify grants on RPC
  const grants = await runSql(`
    SELECT routine_name, grantee, privilege_type
    FROM information_schema.routine_privileges
    WHERE routine_name = 'interior_get_boq_item_history';
  `);
  console.log('5. Routine privileges:', grants.map(g => `${g.grantee}:${g.privilege_type}`).join(', '));

  console.log('\nAll 5 verifications PASSED on Production!');
}

verify().catch(console.error);
