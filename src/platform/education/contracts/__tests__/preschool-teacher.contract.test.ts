import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { PreschoolTeacherContractImpl } from '../preschool-teacher.contract.impl';

const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const branchId = '00000000-0000-4000-8000-000000000003';
const teacherPartyId = '00000000-0000-4000-8000-000000000004';
const confirmationId = '00000000-0000-4000-8000-000000000005';
const courseId = '00000000-0000-4000-8000-000000000006';
const assignmentId = '00000000-0000-4000-8000-000000000007';
const context = { tenantId, actorId, branchId };
const confirmation = { id: confirmationId, tenant_id: tenantId, branch_id: branchId,
  teacher_party_id: teacherPartyId, valid_from: '2026-09-01', valid_to: null,
  attestation: 'Đã đối chiếu hồ sơ nhân sự', confirmed_by: actorId, confirmed_at: '2026-10-25T00:00:00Z',
  revoked_at: null, revoked_by: null, revocation_reason: null };
const assignment = { assignment_id: assignmentId, tenant_id: tenantId, course_id: null,
  canonical_course_id: courseId, canonical_teacher_confirmation_id: confirmationId,
  teacher_party_id: teacherPartyId, role: 'lead_teacher', academic_year: '2026-2027',
  effective_start_date: '2026-09-01', effective_end_date: null, status: 'active' };
const rpc = jest.fn<(...args: unknown[]) => Promise<{ data: unknown; error: { code: string; message: string } | null }>>();
const from = jest.fn(() => { throw new Error('direct table access forbidden'); });
const contract = new PreschoolTeacherContractImpl({ rpc, from } as unknown as SupabaseClient<Database>);
beforeEach(() => { jest.clearAllMocks(); });

describe('Preschool teacher public contract', () => {
  it('reads bounded candidates from the service-only RPC and retains effective confirmation proof', async () => {
    rpc.mockResolvedValue({ data: { tenantId, branchId, onDate: '2026-10-25', confirmedOnly: true,
      offset: 0, limit: 20, filteredTotal: 1, nextOffset: null,
      parties: [{ partyId: teacherPartyId, displayName: 'Giáo viên thật', confirmations: [{
        confirmationId, validFrom: '2026-09-01', validTo: null, confirmedBy: actorId,
        confirmedAt: '2026-10-25T00:00:00Z',
      }] }] }, error: null });
    const page = await contract.listCandidates(context, '', true, '2026-10-25', 0, 20);
    expect(page.parties[0].confirmations[0].confirmationId).toBe(confirmationId);
    expect(rpc).toHaveBeenCalledWith('preschool_teacher_candidates', expect.objectContaining({
      p_tenant_id: tenantId, p_actor_id: actorId, p_branch_id: branchId, p_confirmed_only: true,
    }));
    expect(from).not.toHaveBeenCalled();
  });
  it('binds confirmation idempotency key to exact response and actor', async () => {
    rpc.mockResolvedValue({ data: confirmation, error: null });
    const input = { operationKey: confirmationId, teacherPartyId, validFrom: '2026-09-01',
      validTo: null, attestation: confirmation.attestation };
    expect((await contract.confirm(context, input)).id).toBe(confirmationId);
    expect(rpc).toHaveBeenCalledWith('preschool_confirm_teacher', expect.objectContaining({
      p_operation_key: confirmationId, p_teacher_party_id: teacherPartyId, p_valid_to: null,
    }));
    rpc.mockResolvedValue({ data: { ...confirmation, teacher_party_id: actorId }, error: null });
    await expect(contract.confirm(context, input)).rejects.toMatchObject({ status: 503 });
  });
  it('uses canonical identity for assignment and rejects legacy course identity', async () => {
    rpc.mockResolvedValue({ data: assignment, error: null });
    const input = { operationKey: assignmentId, courseId, confirmationId, teacherPartyId,
      role: 'lead_teacher' as const, academicYear: '2026-2027',
      effectiveStartDate: '2026-09-01', effectiveEndDate: null };
    expect((await contract.assign(context, input)).courseId).toBe(courseId);
    expect(rpc).toHaveBeenCalledWith('edu_assign_preschool_teacher', expect.objectContaining({
      p_course_id: courseId, p_confirmation_id: confirmationId, p_operation_key: assignmentId,
    }));
    rpc.mockResolvedValue({ data: { ...assignment, course_id: courseId }, error: null });
    await expect(contract.assign(context, input)).rejects.toMatchObject({ status: 503 });
    expect(from).not.toHaveBeenCalled();
  });
  it.each([
    ['42501', 403], ['22023', 400], ['23505', 409], ['PGRST202', 503],
  ])('maps SQL error %s without leaking provider detail', async (code, status) => {
    rpc.mockResolvedValue({ data: null, error: { code: String(code), message: 'secret provider detail' } });
    await expect(contract.listCandidates(context, '', false, '2026-10-25', 0, 20)).rejects.toMatchObject({ status });
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects invalid page and actor before the RPC', async () => {
    await expect(contract.listCandidates(context, '', false, '2026-10-25', 0, 51)).rejects.toMatchObject({ status: 400 });
    await expect(contract.listCandidates({ ...context, actorId: 'forged' }, '', false, '2026-10-25', 0, 20)).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
