const PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function check() {
  const query = `
    SELECT version, name
    FROM supabase_migrations.schema_migrations
    WHERE version LIKE '202611%'
    ORDER BY version ASC;
  `;
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  console.log('Production 202611 migrations:', await res.json());
}

check().catch(console.error);

