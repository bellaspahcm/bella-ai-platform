import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve('supabase/migrations/20261015010000_authorize_automove_catalog_tenant_reads.sql'), 'utf8');
const tables = ['auto_brands', 'auto_models', 'auto_variants'];

it('restricts reads on exactly the three approved catalogs without dropping legacy/write policies', () => {
  expect([...sql.matchAll(/CREATE POLICY (\w+) ON public\.(\w+)/g)].map(match => match[2])).toEqual(tables);
  expect([...sql.matchAll(/DROP POLICY IF EXISTS (\w+) ON public\.(\w+)/g)].map(match => match[1]))
    .toEqual(tables.map(table => `${table}_tenant_read_guard`));
  expect(sql.match(/AS RESTRICTIVE FOR SELECT TO authenticated/g)).toHaveLength(3);
  expect(sql).not.toMatch(/CREATE POLICY[^;]*FOR (ALL|INSERT|UPDATE|DELETE)/i);
});

it('binds Auth identity to the active canonical profile and active owning tenant without HQ bypass', () => {
  expect(sql.match(/u\.id = \(SELECT auth\.uid\(\)\)/g)).toHaveLength(3);
  expect(sql.match(/u\.status = 'active'/g)).toHaveLength(3);
  expect(sql.match(/t\.status = 'active'/g)).toHaveLength(3);
  for (const table of tables) expect(sql).toContain(`u.tenant_id = ${table}.tenant_id`);
  expect(sql).not.toMatch(/is_hq_super_admin|get_auth_tenant_id|CREATE\s+(OR REPLACE\s+)?FUNCTION/i);
});

it('changes only SELECT grants and rejects write-impact or missing dependency preconditions', () => {
  expect(sql.match(/\b(?:GRANT|REVOKE)\s+SELECT ON TABLE/g)).toHaveLength(2);
  expect(sql).not.toMatch(/\b(?:GRANT|REVOKE)\s+(?:ALL|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)/i);
  expect(sql).toContain("has_table_privilege('authenticated', target_oid, 'INSERT,UPDATE,DELETE')");
  expect(sql).toContain("has_any_column_privilege('authenticated', target_oid, 'INSERT,UPDATE')");
  expect(sql).toContain('p.polpermissive');
  expect(sql).toContain('SELECT relrowsecurity');
  expect(sql).not.toMatch(/CREATE\s+TABLE|ALTER\s+TABLE|DISABLE\s+ROW\s+LEVEL/i);
});
