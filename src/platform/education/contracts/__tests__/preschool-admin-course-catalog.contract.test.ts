import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { CanonicalCourseCatalogContractImpl } from '../canonical-course-catalog.contract.impl';

const tenantId = '00000000-0000-4000-8000-000000000001';
const courseId = '00000000-0000-4000-8000-000000000002';
const row = {
  id: courseId, tenant_id: tenantId, course_code: 'SYN-01', title: 'Synthetic class',
  status: 'active', prerequisite_course_codes: ['PRE-01'],
};
const makeContract = (rpc: jest.Mock) => new CanonicalCourseCatalogContractImpl(
  { rpc } as unknown as SupabaseClient<Database>,
);

describe('Preschool administrator course read contract', () => {
  it('lists class identity through the zero-tenant-input RPC and strips detail-only fields', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [row], error: null });
    const result = await makeContract(rpc).listPreschoolAdminCourses(tenantId);
    expect(rpc).toHaveBeenCalledWith('edu_preschool_admin_course_catalog', { p_course_id: null });
    expect(result).toEqual([{
      id: courseId, tenantId, courseCode: 'SYN-01', title: 'Synthetic class', status: 'active',
    }]);
  });

  it('reads only the requested class through the same admin RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [row], error: null });
    const result = await makeContract(rpc).getPreschoolAdminCourse(tenantId, courseId);
    expect(rpc).toHaveBeenCalledWith('edu_preschool_admin_course_catalog', { p_course_id: courseId });
    expect(result).toEqual({
      id: courseId, tenantId, courseCode: 'SYN-01', title: 'Synthetic class', status: 'active', prerequisites: ['PRE-01'],
    });
  });

  it('fails closed on foreign tenant rows, malformed shapes, and provider errors', async () => {
    const foreign = jest.fn().mockResolvedValue({ data: [{ ...row, tenant_id: '00000000-0000-4000-8000-000000000099' }], error: null });
    await expect(makeContract(foreign).listPreschoolAdminCourses(tenantId)).rejects.toThrow('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
    const malformed = jest.fn().mockResolvedValue({ data: [{ ...row, prerequisite_course_codes: null }], error: null });
    await expect(makeContract(malformed).getPreschoolAdminCourse(tenantId, courseId)).rejects.toThrow('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
    const failed = jest.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'private detail' } });
    await expect(makeContract(failed).listPreschoolAdminCourses(tenantId)).rejects.toThrow('CANONICAL_COURSE_CATALOG_UNAVAILABLE');
  });

  it('rejects an invalid tenant or class identifier before RPC access', async () => {
    const rpc = jest.fn();
    await expect(makeContract(rpc).listPreschoolAdminCourses('foreign')).rejects.toThrow('CANONICAL_COURSE_TENANT_REQUIRED');
    await expect(makeContract(rpc).getPreschoolAdminCourse(tenantId, 'not-a-uuid')).rejects.toThrow('CANONICAL_COURSE_INVALID_REQUEST');
    expect(rpc).not.toHaveBeenCalled();
  });
});
