import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { CanonicalCourseCommandContractImpl } from '../canonical-course-catalog.contract.impl';

// Approved invariant: a single atomic command returns canonical identity + branch + retry receipt.
const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const branchId = '00000000-0000-4000-8000-000000000003';
const operationKey = '00000000-0000-4000-8000-000000000004';
const id = '00000000-0000-4000-8000-000000000005';
const input = { tenantId, actorId, branchId, operationKey, courseCode: ' syn-01 ', title: ' Synthetic class ' };
const result = { id, tenantId, branchId, operationKey, courseCode: 'SYN-01', title: 'Synthetic class', status: 'active' };
const rpc = jest.fn<(...args: unknown[]) => Promise<{ data: unknown; error: { code: string; message: string } | null }>>();
const from = jest.fn(() => { throw new Error('Direct writes forbidden'); });
const command = new CanonicalCourseCommandContractImpl({ rpc, from } as unknown as SupabaseClient<Database>);
beforeEach(() => { jest.clearAllMocks(); rpc.mockResolvedValue({ data: result, error: null }); });

describe('canonical course atomic command', () => {
  it('uses existing Course normalization and only the declared atomic transaction', async () => {
    expect(await command.createCourse(input)).toEqual(result);
    expect(rpc).toHaveBeenCalledWith('edu_create_preschool_course', {
      p_tenant_id: tenantId, p_actor_id: actorId, p_branch_id: branchId, p_operation_key: operationKey,
      p_course_id: expect.stringMatching(/^[0-9a-f-]{36}$/), p_course_code: 'SYN-01', p_title: 'Synthetic class',
    });
    expect(from).not.toHaveBeenCalled();
  });
  it('returns recovered server identity for retries, never the new preallocated id', async () => {
    expect(await command.createCourse(input)).toEqual(result);
    expect(await command.createCourse(input)).toEqual(result);
    expect(rpc.mock.calls.map(call => (call[1] as Record<string, unknown>).p_operation_key)).toEqual([operationKey, operationKey]);
  });
  it('normalizes validated UUID input before dispatch and accepts the matching database representation', async () => {
    const tenant = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    const actor = 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB';
    const branch = 'CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC';
    const operation = 'DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD';
    const identity = { ...result, tenantId: tenant.toLowerCase(), branchId: branch.toLowerCase(), operationKey: operation.toLowerCase() };
    rpc.mockResolvedValue({ data: identity, error: null });
    expect(await command.createCourse({ ...input, tenantId: tenant, actorId: actor, branchId: branch, operationKey: operation })).toEqual(identity);
    expect(rpc).toHaveBeenCalledWith('edu_create_preschool_course', expect.objectContaining({
      p_tenant_id: tenant.toLowerCase(), p_actor_id: actor.toLowerCase(), p_branch_id: branch.toLowerCase(), p_operation_key: operation.toLowerCase(),
    }));
  });
  it.each([
    { tenantId: '' }, { actorId: 'forged' }, { branchId: '' }, { operationKey: 'bad' },
    { courseCode: ' ' }, { title: '' }, { courseCode: 'x'.repeat(81) }, { title: 'x'.repeat(201) },
  ])('rejects invalid input before dependencies %#', async patch => {
    await expect(command.createCourse({ ...input, ...patch })).rejects.toMatchObject({ code: 'CANONICAL_COURSE_INVALID_REQUEST', status: 400 });
    expect(rpc).not.toHaveBeenCalled(); expect(from).not.toHaveBeenCalled();
  });
  it.each([
    ['42501', 'CANONICAL_COURSE_ACCESS_DENIED', 403], ['23505', 'CANONICAL_COURSE_CONFLICT', 409],
    ['22023', 'CANONICAL_COURSE_INVALID_REQUEST', 400], ['PGRST202', 'CANONICAL_COURSE_UNAVAILABLE', 503],
    ['42883', 'CANONICAL_COURSE_UNAVAILABLE', 503], ['unknown', 'CANONICAL_COURSE_UNAVAILABLE', 503],
  ])('maps %s without fallback or provider detail', async (code, expected, status) => {
    rpc.mockResolvedValue({ data: null, error: { code: String(code), message: 'private provider detail' } });
    await expect(command.createCourse(input)).rejects.toMatchObject({ message: expected, status });
    expect(from).not.toHaveBeenCalled();
  });
  it.each([
    null, [], {}, { ...result, id: '' }, { ...result, tenantId: 'foreign' }, { ...result, branchId: 'foreign' },
    { ...result, operationKey: 'foreign' }, { ...result, title: 'Changed' }, { ...result, courseCode: 'Changed' }, { ...result, status: 'draft' },
  ])('rejects unconfirmed response identity %#', async data => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(command.createCourse(input)).rejects.toMatchObject({ code: 'CANONICAL_COURSE_UNAVAILABLE', status: 503 });
  });
  it('fails closed on transport error', async () => {
    rpc.mockRejectedValue(new Error('private transport'));
    await expect(command.createCourse(input)).rejects.toMatchObject({ code: 'CANONICAL_COURSE_UNAVAILABLE', status: 503 });
    expect(from).not.toHaveBeenCalled();
  });
});
