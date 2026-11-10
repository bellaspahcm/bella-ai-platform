const PROJECT_REF = 'lvnvkpyxtuilhrabtlwv';
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function checkRevisions() {
  const query = `
    SELECT id, project_id, version_number, title, status, submitted_by, approved_by, submitted_by_user_id, approved_by_user_id
    FROM interior_design_revisions
    ORDER BY version_number DESC;
  `;
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  console.log('Production design revisions:', await res.json());
}

checkRevisions().catch(console.error);
