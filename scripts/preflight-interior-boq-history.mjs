/**
 * Pre-flight Schema Inspection on Production DB
 * Target: lvnvkpyxtuilhrabtlwv
 */

const PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function check() {
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('tenants', 'interior_boqs', 'interior_boq_items', 'interior_sync_idempotency', 'interior_boq_item_history');
  `;
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  console.log('Production existing tables:', data);

  // Check existing triggers on interior_boq_items
  const trgRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'interior_boq_items';
      `
    }),
  });
  const trgData = await trgRes.json();
  console.log('Production existing triggers on interior_boq_items:', trgData);

  // Check columns of interior_boq_items
  const colRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'interior_boq_items'
        ORDER BY ordinal_position;
      `
    }),
  });
  const colData = await colRes.json();
  console.log('Columns of interior_boq_items on Production:', colData.map(c => `${c.column_name} (${c.data_type})`).join(', '));
}

check().catch(console.error);

