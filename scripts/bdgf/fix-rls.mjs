import pkg from 'pg';
const { Client } = pkg;

const url = process.env.DATABASE_ADMIN_URL;
if (!url) {
  throw new Error('DATABASE_ADMIN_URL must be configured through an approved secret manager.');
}
const c = new Client({connectionString: url});
await c.connect();

console.log('Fixing RLS policy...\n');

// Drop existing policy
await c.query("DROP POLICY IF EXISTS block_rest_api_access ON tenants");
console.log('✅ Dropped existing policy');

// Enable RLS
await c.query("ALTER TABLE tenants ENABLE ROW LEVEL SECURITY");
console.log('✅ RLS enabled');

// Create strict policy that blocks ALL REST API access
await c.query(`
  CREATE POLICY block_rest_api_access ON tenants
    FOR ALL
    USING (false)
    WITH CHECK (false)
`);
console.log('✅ Created blocking policy');

// Verify
const check = await c.query(`
  SELECT relrowsecurity, COUNT(pol.polname) as policy_count
  FROM pg_class rel
  LEFT JOIN pg_policy pol ON pol.polrelid = rel.oid
  WHERE rel.relname = 'tenants' AND rel.relnamespace = 'public'::regnamespace
  GROUP BY rel.relrowsecurity
`);

console.log('\nVerification:');
console.log('  RLS enabled:', check.rows[0].relrowsecurity);
console.log('  Policies:', check.rows[0].policy_count);
console.log('\n✅ Authority #3 remediation complete\n');

await c.end();
