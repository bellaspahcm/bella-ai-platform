import { PreschoolStudentAttendanceHistoryContractImpl } from '../preschool-student-attendance-history.contract.impl';

const tenant = '10000000-0000-4000-8000-000000000001';
const enrollment = '20000000-0000-4000-8000-000000000002';
const row = { id: '30000000-0000-4000-8000-000000000003', tenant_id: tenant, enrollment_id: enrollment, status: 'present', roll_call_time: '2026-10-27T05:00:00Z' };
function client(data: unknown, error: unknown = null) {
  const rpc = jest.fn().mockResolvedValue({ data, error });
  return { rpc };
}

it('reads history through the caller RPC without supplying a tenant', async () => {
  const c = client([row]);
  const result = await new PreschoolStudentAttendanceHistoryContractImpl(c as never).getAuthorizedHistory(tenant, enrollment);
  expect(c.rpc).toHaveBeenCalledWith('edu_preschool_admin_student_attendance_history', { p_enrollment_id: enrollment });
  expect(result).toEqual([{ id: row.id, tenantId: tenant, enrollmentId: enrollment, status: 'present', rollCallTime: row.roll_call_time }]);
});
it('preserves an authorized empty history', async () => {
  await expect(new PreschoolStudentAttendanceHistoryContractImpl(client([]) as never).getAuthorizedHistory(tenant, enrollment)).resolves.toEqual([]);
});
it.each([
  null, [{ ...row, tenant_id: '40000000-0000-4000-8000-000000000004' }],
  [{ ...row, enrollment_id: '40000000-0000-4000-8000-000000000004' }],
  [{ ...row, status: 'invalid' }], [{ ...row, roll_call_time: 'bad' }], [row, row], Array(1000).fill(row),
])('fails closed for malformed, duplicate, foreign or capped data %#', async data => {
  await expect(new PreschoolStudentAttendanceHistoryContractImpl(client(data) as never).getAuthorizedHistory(tenant, enrollment)).rejects.toThrow('PRESCHOOL_HISTORY_UNAVAILABLE');
});
it('does not turn a denied RPC into an empty history', async () => {
  await expect(new PreschoolStudentAttendanceHistoryContractImpl(client(null, { code: '42501' }) as never).getAuthorizedHistory(tenant, enrollment)).rejects.toThrow('PRESCHOOL_HISTORY_UNAVAILABLE');
});
it('rejects malformed selectors before contacting the database', async () => {
  const c = client([]);
  await expect(new PreschoolStudentAttendanceHistoryContractImpl(c as never).getAuthorizedHistory(tenant, 'bad')).rejects.toThrow('PRESCHOOL_HISTORY_INVALID_REQUEST');
  expect(c.rpc).not.toHaveBeenCalled();
});
