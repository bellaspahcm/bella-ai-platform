import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { PreschoolRegistryContractImpl } from '../preschool-registry.contract.impl';
import { isPreschoolRegistryPage, normalizeRegistryQuery } from '../preschool-registry.contract';

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const tenantId = id(1), courseId = id(2), branchId = id(3);
function page() {
  return { tenantId, request: normalizeRegistryQuery({}), totals: { students: 1, active: 0, pending: 1 }, filteredTotal: 1, nextOffset: null,
    students: [{ id: id(4), tenantId, partyId: id(5), studentCode: 'SYN-01', name: 'Synthetic pending child', gender: null, dob: null,
      enrollments: [{ id: id(6), courseId, courseCode: 'SYN-C', courseTitle: 'Synthetic class', branchId, branchName: 'Synthetic branch', status: 'pending' }] }] };
}
const rpc = jest.fn<() => Promise<{ data: unknown; error: { code: string } | null }>>();
const client = { rpc } as unknown as SupabaseClient<Database>;
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: page(), error: null }); });
describe('Preschool registry public boundary', () => {
  it('reads pending children with the caller RPC, without sending tenant or actor selectors', async () => {
    const result = await new PreschoolRegistryContractImpl(client).read(tenantId);
    expect(result.students[0].enrollments[0].status).toBe('pending');
    expect(rpc).toHaveBeenCalledWith('edu_preschool_student_registry', { p_query: '', p_status: 'all', p_course_id: null, p_branch_id: null, p_offset: 0, p_limit: 20 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each(['42501', '22023', '57014', 'XX000'])('fails closed on provider %s', async code => {
    rpc.mockResolvedValue({ data: null, error: { code } });
    await expect(new PreschoolRegistryContractImpl(client).read(tenantId)).rejects.toMatchObject({ status: code === '42501' ? 403 : code === '22023' ? 400 : 503 });
  });
  it.each([{ limit: 0 }, { limit: 51 }, { offset: -1 }, { offset: 100001 }, { status: 'cancelled' }, { query: '\u0001' }, { query: 'x'.repeat(81) }, { courseId: 'bad' }])('rejects invalid input without RPC: %j', async input => {
    await expect(new PreschoolRegistryContractImpl(client).read(tenantId, input as Parameters<PreschoolRegistryContractImpl['read']>[1])).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('uses literal search input, preserving percent and underscore', async () => {
    const data = page(); data.request = normalizeRegistryQuery({ query: '%_name' }); rpc.mockResolvedValue({ data, error: null });
    await new PreschoolRegistryContractImpl(client).read(tenantId, { query: '  %_name  ' });
    expect(rpc).toHaveBeenCalledWith('edu_preschool_student_registry', expect.objectContaining({ p_query: '%_name' }));
  });
  it.each(['wrong-tenant', 'foreign-child', 'extra-contact', 'extra-health', 'duplicate', 'truncated', 'wrong-page', 'wrong-status', 'foreign-course'])('rejects malformed or scoped response: %s', async fault => {
    const data = page();
    if (fault === 'wrong-tenant') data.tenantId = id(99);
    if (fault === 'foreign-child') data.students[0].tenantId = id(99);
    if (fault === 'extra-contact') Object.assign(data.students[0], { phone: 'must not escape' });
    if (fault === 'extra-health') Object.assign(data.students[0].enrollments[0], { medicalNote: 'must not escape' });
    if (fault === 'duplicate') { data.students.push(data.students[0]); data.filteredTotal = 2; data.totals.students = 2; }
    if (fault === 'truncated') { data.filteredTotal = 2; data.totals.students = 2; }
    if (fault === 'wrong-page') data.request.offset = 20;
    if (fault === 'wrong-status') data.students[0].enrollments[0].status = 'cancelled';
    if (fault === 'foreign-course') data.request.courseId = courseId;
    rpc.mockResolvedValue({ data, error: null });
    await expect(new PreschoolRegistryContractImpl(client).read(tenantId)).rejects.toMatchObject({ status: 503 });
  });
  it('does not force mutually exclusive counts when a child has both active and pending enrollments', () => {
    const data = page(); data.totals.active = 1;
    data.students[0].enrollments.push({ ...data.students[0].enrollments[0], id: id(7), status: 'active' });
    expect(isPreschoolRegistryPage(data)).toBe(true);
  });
  it('does not expose a continuation beyond the bounded offset ceiling', () => {
    const data = page(); data.request = normalizeRegistryQuery({ offset: 100000, limit: 1 });
    data.totals.students = 100002; data.filteredTotal = 100002;
    expect(isPreschoolRegistryPage(data, data.request)).toBe(true);
    const malformed = { ...data, nextOffset: 100001 };
    expect(isPreschoolRegistryPage(malformed, data.request)).toBe(false);
  });
});
