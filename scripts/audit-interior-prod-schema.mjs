const PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function runQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function inspect() {
  console.log('=== PRODUCTION SCHEMA AUDIT (lvnvkpyxtuilhrabtlwv) ===\n');

  // 1. All interior tables
  const tables = await runQuery(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'interior_%'
    ORDER BY table_name;
  `);
  console.log('1. Interior Tables:', tables.map(t => t.table_name));

  // 2. Check design revisions columns
  const revCols = await runQuery(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'interior_design_revisions'
    ORDER BY ordinal_position;
  `);
  console.log('2. Columns of interior_design_revisions:', revCols.map(c => `${c.column_name} (${c.data_type})`));

  // 3. Check interior_boqs columns
  const boqCols = await runQuery(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'interior_boqs'
    ORDER BY ordinal_position;
  `);
  console.log('3. Columns of interior_boqs:', boqCols.map(c => `${c.column_name} (${c.data_type})`));

  // 4. All interior RPCs
  const rpcs = await runQuery(`
    SELECT proname, prosecdef
    FROM pg_proc
    WHERE proname LIKE 'interior_%' OR proname LIKE '%boq%'
    ORDER BY proname;
  `);
  console.log('4. Interior & BOQ RPCs:', rpcs.map(r => r.proname));

  // 5. Existing constraints on interior tables
  const constraints = await runQuery(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public' AND tc.table_name LIKE 'interior_%'
    ORDER BY tc.table_name, tc.constraint_name;
  `);
  console.log(`5. Total Constraints on interior_* tables: ${constraints.length}`);
}

inspect().catch(console.error);

