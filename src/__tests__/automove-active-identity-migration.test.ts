import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve('supabase/migrations/20261015030000_guard_automove_active_identity_access.sql'), 'utf8');
const reads = ['auto_vehicles', 'auto_leads', 'auto_bookings', 'auto_deposits'];
const updates = reads.slice(1);
const policies = [...sql.matchAll(/CREATE POLICY (\w+) ON public\.(\w+)\s+AS RESTRICTIVE FOR (SELECT|UPDATE) TO authenticated\s+([\s\S]*?);/g)];

it('adds only the four SELECT and three UPDATE guards, preserving existing policy names', () => {
  expect(policies.map(match => [match[1], match[2], match[3]])).toEqual([
    ...reads.map(table => [`${table}_active_identity_select_guard`, table, 'SELECT']),
    ...updates.map(table => [`${table}_active_identity_update_guard`, table, 'UPDATE']),
  ]);
  expect([...sql.matchAll(/DROP POLICY IF EXISTS (\w+) ON public\.(\w+)/g)].map(match => [match[1], match[2]]))
    .toEqual(policies.map(match => [match[1], match[2]]));
  expect(sql.match(/CREATE POLICY/g)).toHaveLength(7);
  expect(sql.match(/AS RESTRICTIVE/g)).toHaveLength(7);
});

it('intersects existing policies with Auth subject, live active profile and active owning tenant', () => {
  for (const [, , table, command, body] of policies) {
    expect(body).toContain('u.id = (SELECT auth.uid())');
    expect(body).toContain("u.status = 'active'");
    expect(body).toContain(`u.tenant_id = ${table}.tenant_id`);
    expect(body).toContain("t.status = 'active'");
    expect(body).toContain('public.users u JOIN public.tenants t ON t.id = u.tenant_id');
    expect(body.includes('WITH CHECK')).toBe(command === 'UPDATE');
    if (command === 'UPDATE') {
      const [using, check] = body.split('WITH CHECK');
      expect(using.replace(/^USING\s*/, '').trim()).toBe(check.trim());
    }
  }
  expect(sql).not.toMatch(/auth\.jwt|app_metadata|is_hq|product_key|get_auth_tenant_id|tenant_id\s+IS\s+NULL/i);
});

it('fails closed on missing dependencies without changing helpers, grants, schemas or other commands', () => {
  expect(sql).toContain("to_regclass('public.users')");
  expect(sql).toContain("to_regclass('public.tenants')");
  expect(sql).toContain('SELECT relrowsecurity');
  expect(sql).toContain('p.polpermissive');
  expect(sql).toContain("'authenticated'::regrole::oid = ANY(p.polroles)");
  expect(sql).not.toMatch(/\b(?:GRANT|REVOKE|CREATE TABLE|ALTER TABLE|CREATE FUNCTION|CREATE OR REPLACE FUNCTION)\b/i);
  expect(sql).not.toMatch(/FOR (ALL|INSERT|DELETE)|\b(?:INSERT INTO|UPDATE public|DELETE FROM|COMMIT|DISABLE ROW LEVEL)\b/i);
});

it('keeps verification explicitly non-Production, certificate-verified and rollback-only', () => {
  const verifier = readFileSync(resolve('scripts/verify-automove-active-identity-access.ts'), 'utf8');
  expect(verifier).toContain("'bmnbqbcdbuklhopfbopv.supabase.co'");
  expect(verifier).toContain('new Client(saleChainConnection(');
  expect(verifier).toContain('ALLOW_E2E_ACTIVE_IDENTITY_VERIFICATION');
  expect(verifier).toContain("finally { await db.query('rollback'); }");
  expect(verifier).toContain('await cleanupProof()');
  expect(verifier).not.toMatch(/rejectUnauthorized:\s*false|query\(['"]commit['"]\)|insert into supabase_migrations/i);
});
