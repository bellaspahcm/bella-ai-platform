import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { CanonicalCourseCatalogContractImpl } from '@/platform/education/contracts/canonical-course-catalog.contract.impl';

const tenant = 'synthetic-tenant';
const row = { id: 'synthetic-course', tenant_id: tenant, course_code: 'SYNTHETIC', title: 'Synthetic course', status: 'active' };
let result: { data: unknown; count: number | null; error: unknown };
const query = { select: jest.fn(), eq: jest.fn(), order: jest.fn() };
const from = jest.fn(() => query);
const client = { from } as unknown as SupabaseClient<Database>;
beforeEach(() => {
  jest.clearAllMocks(); result = { data: [row], count: 1, error: null };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockImplementation(() => Promise.resolve(result));
});
test('Reads minimal canonical fields with exact tenant and caller client', async () => {
  expect(await new CanonicalCourseCatalogContractImpl(client).listCourses(tenant)).toEqual([{ id: row.id, tenantId: tenant, courseCode: row.course_code, title: row.title, status: 'active' }]);
  expect(from).toHaveBeenCalledWith('edu_courses'); expect(query.eq).toHaveBeenCalledWith('tenant_id', tenant);
  expect(query.select).toHaveBeenCalledWith('id, tenant_id, course_code, title, status', { count: 'exact' });
});
test('Legitimate empty query remains empty', async () => {
  result = { data: [], count: 0, error: null }; expect(await new CanonicalCourseCatalogContractImpl(client).listCourses(tenant)).toEqual([]);
});
test.each(['', ' synthetic-tenant', 'synthetic-tenant '])('Tenant must be present and exact: %s', async invalid => {
  await expect(new CanonicalCourseCatalogContractImpl(client).listCourses(invalid)).rejects.toThrow('CANONICAL_COURSE_TENANT_REQUIRED'); expect(from).not.toHaveBeenCalled();
});
test.each([
  { data: null, count: 0, error: null }, { data: [], count: null, error: null },
  { data: [row], count: 2, error: null }, { data: [row], count: 1, error: { message: 'sensitive' } },
  { data: [{ ...row, tenant_id: 'foreign' }], count: 1, error: null },
  { data: [{ ...row, status: 'unrecognized' }], count: 1, error: null },
  { data: [{ ...row, title: null }], count: 1, error: null },
  { data: [row, row], count: 2, error: null },
])('Invalid/truncated/error query never becomes a successful list %#', async invalid => {
  result = invalid; await expect(new CanonicalCourseCatalogContractImpl(client).listCourses(tenant)).rejects.toThrow('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
});
