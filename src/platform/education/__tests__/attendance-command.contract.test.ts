import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { AttendanceCommandDatabase } from '@/types/education-attendance-command.database.types';
import {
  EducationAttendanceCommandError,
  assertAttendanceCommandSuccess,
  parseAttendanceCommandResult,
  type ScopedDailyAttendanceInput,
} from '../contracts/attendance-command.contract';
import { EducationScopedAttendanceCommand } from '../contracts/attendance-command.contract.impl';

type ScopedRpc = AttendanceCommandDatabase['public']['Functions']['edu_set_scoped_daily_attendance'];
type ScopedResultRow = ScopedRpc['Returns'][number];
type RpcError = { code?: string; message: string };

const input: ScopedDailyAttendanceInput = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  actorId: '20000000-0000-4000-8000-000000000002',
  branchId: '30000000-0000-4000-8000-000000000003',
  enrollmentId: '40000000-0000-4000-8000-000000000004',
  courseId: '50000000-0000-4000-8000-000000000005',
  studentPartyId: '60000000-0000-4000-8000-000000000006',
  requestId: 'opaque-canonical-admission-request',
  expectedRole: 'admin_staff',
  status: 'present',
  schoolDay: '2026-10-23',
  rollCallTime: '2026-10-23T05:00:00.000Z',
};

function resultRow(overrides: Partial<ScopedResultRow> = {}): ScopedResultRow {
  return {
    id: '70000000-0000-4000-8000-000000000007',
    event_id: '80000000-0000-4000-8000-000000000008',
    tenant_id: input.tenantId,
    enrollment_id: input.enrollmentId,
    status: input.status,
    school_day: input.schoolDay,
    roll_call_time: input.rollCallTime,
    created_at: '2026-10-23T05:00:01.000Z',
    updated_at: '2026-10-23T05:00:01.000Z',
    ...overrides,
  };
}

function setup(data: ScopedRpc['Returns'] | null = [resultRow()], error: RpcError | null = null) {
  const rpc = jest.fn<Promise<{ data: ScopedRpc['Returns'] | null; error: RpcError | null }>,
    [name: 'edu_set_scoped_daily_attendance', args: ScopedRpc['Args']]>()
    .mockResolvedValue({ data, error });
  const client = { rpc };
  const command = new EducationScopedAttendanceCommand(client as unknown as SupabaseClient<Database>);
  return { command, rpc };
}

describe('Education scoped Attendance public command', () => {
  it('requires an explicit trusted client instead of choosing an implicit privileged client', () => {
    expect(() => new EducationScopedAttendanceCommand(undefined as unknown as SupabaseClient<Database>))
      .toThrow('ATTENDANCE_EXPLICIT_TRUSTED_CLIENT_REQUIRED');
  });

  it('forwards the exact trusted actor, role, branch and canonical context to the scoped RPC', async () => {
    const fixture = setup();
    await expect(fixture.command.setDailyAttendance(input)).resolves.toEqual({
      id: resultRow().id, tenantId: input.tenantId, enrollmentId: input.enrollmentId,
      schoolDay: input.schoolDay, status: input.status, eventId: resultRow().event_id,
      rollCallTime: input.rollCallTime, createdAt: resultRow().created_at, updatedAt: resultRow().updated_at,
    });
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
    expect(fixture.rpc).toHaveBeenCalledWith('edu_set_scoped_daily_attendance', {
      p_tenant_id: input.tenantId, p_actor_id: input.actorId, p_expected_role: input.expectedRole,
      p_branch_id: input.branchId, p_enrollment_id: input.enrollmentId, p_course_id: input.courseId,
      p_student_party_id: input.studentPartyId, p_request_id: input.requestId,
      p_status: input.status, p_roll_call_time: input.rollCallTime, p_school_day: input.schoolDay,
    });
  });

  it('routes Preschool through the Product transaction that locks assignments and resolves request identity', async () => {
    const fixture = setup();
    await expect(fixture.command.setPreschoolDailyAttendance(input)).resolves.toMatchObject({
      tenantId: input.tenantId, enrollmentId: input.enrollmentId, status: input.status,
    });
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
    expect(fixture.rpc).toHaveBeenCalledWith('preschool_set_scoped_daily_attendance', {
      p_tenant_id: input.tenantId, p_actor_id: input.actorId, p_expected_role: input.expectedRole,
      p_branch_id: input.branchId, p_enrollment_id: input.enrollmentId, p_course_id: input.courseId,
      p_student_party_id: input.studentPartyId,
      p_status: input.status, p_roll_call_time: input.rollCallTime, p_school_day: input.schoolDay,
    });
  });

  it.each([
    ['42501', 'ATTENDANCE_CURRENT_ACCESS_DENIED', 403],
    ['23505', 'ATTENDANCE_CANONICAL_CONFLICT', 409],
  ] as const)('preserves Product transaction SQL%s denial without a generic-command fallback', async (code, expectedCode, status) => {
    const fixture = setup(null, { code, message: 'controlled Product denial' });
    await expect(fixture.command.setPreschoolDailyAttendance(input))
      .rejects.toMatchObject({ code: expectedCode, status });
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
  });

  it('rejects a mismatched Product transaction read-back', async () => {
    const fixture = setup([resultRow({ status: 'absent' })]);
    await expect(fixture.command.setPreschoolDailyAttendance(input))
      .rejects.toMatchObject({ code: 'ATTENDANCE_CANONICAL_CONFLICT', status: 409 });
  });

  it('rejects invalid Preschool canonical IDs before sending a write', async () => {
    const fixture = setup();
    await expect(fixture.command.setPreschoolDailyAttendance({ ...input, branchId: 'invalid' }))
      .rejects.toMatchObject({ status: 400 });
    expect(fixture.rpc).not.toHaveBeenCalled();
  });

  it.each(['present', 'absent', 'excused'] as const)('preserves the validated requested %s status', async (status) => {
    const fixture = setup([resultRow({ status })]);
    await expect(fixture.command.setDailyAttendance({ ...input, status })).resolves.toMatchObject({ status });
  });

  it('accepts the same roll-call instant represented with an explicit timezone offset', () => {
    expect(parseAttendanceCommandResult([resultRow({ roll_call_time: '2026-10-23T12:00:00+07:00' })], input))
      .toMatchObject({ rollCallTime: '2026-10-23T12:00:00+07:00' });
  });

  it('reconciles uppercase UUID spelling without turning a committed result into conflict', async () => {
    const tenant = 'abcdefab-cdef-4abc-8abc-abcdefabcdef';
    const enrollment = 'fedcbafe-dcba-4abc-8abc-fedcbafedcba';
    const fixture = setup([resultRow({ tenant_id: tenant, enrollment_id: enrollment })]);
    await expect(fixture.command.setDailyAttendance({ ...input, tenantId: tenant.toUpperCase(), enrollmentId: enrollment.toUpperCase() }))
      .resolves.toMatchObject({ tenantId: tenant, enrollmentId: enrollment });
  });

  it('rejects noncanonical UUID input before sending a write', async () => {
    const fixture = setup();
    await expect(fixture.command.setDailyAttendance({ ...input, tenantId: ' ' + input.tenantId }))
      .rejects.toMatchObject({ status: 400 });
    expect(fixture.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['tenant_id', 'foreign-tenant'],
    ['enrollment_id', 'foreign-enrollment'],
    ['status', 'absent'],
    ['school_day', '2026-10-24'],
    ['roll_call_time', '2026-10-23T05:01:00.000Z'],
    ['roll_call_time', 'not-a-timestamp'],
  ] as const)('rejects a returned %s context mismatch rather than returning attendance', async (field, value) => {
    const fixture = setup([resultRow({ [field]: value })]);
    await expect(fixture.command.setDailyAttendance(input)).rejects.toMatchObject({
      code: 'ATTENDANCE_CANONICAL_CONFLICT', status: 409,
    });
  });

  it.each([
    null, undefined, [], [resultRow(), resultRow()], {}, [null], [[]], ['invalid-row'],
  ])('rejects missing, multiple or malformed read-back results (%p)', (value: unknown) => {
    expect(() => parseAttendanceCommandResult(value, input)).toThrow('ATTENDANCE_COMMAND_READBACK_INVALID');
  });

  it.each(['id', 'event_id', 'created_at', 'updated_at'] as const)(
    'rejects invalid %s in the public result', (field) => {
      expect(() => parseAttendanceCommandResult([resultRow({ [field]: 'invalid' })], input))
        .toThrow('ATTENDANCE_COMMAND_READBACK_INVALID');
    },
  );

  it.each([
    ['42501', 'ATTENDANCE_CURRENT_ACCESS_DENIED', 403],
    ['23505', 'ATTENDANCE_CANONICAL_CONFLICT', 409],
    ['22023', 'ATTENDANCE_INPUT_INVALID', 400],
    ['22007', 'ATTENDANCE_INPUT_INVALID', 400],
    ['22008', 'ATTENDANCE_INPUT_INVALID', 400],
    ['22P02', 'ATTENDANCE_INPUT_INVALID', 400],
  ] as const)('maps SQL%s before attempting to parse an empty response', async (code, expectedCode, status) => {
    const fixture = setup(null, { code, message: 'controlled failure' });
    await expect(fixture.command.setDailyAttendance(input)).rejects.toBeInstanceOf(EducationAttendanceCommandError);
    await expect(fixture.command.setDailyAttendance(input)).rejects.toMatchObject({ code: expectedCode, status });
  });

  it('retains unclassified database failures instead of reporting absent attendance', async () => {
    const fixture = setup(null, { code: 'XX001', message: 'controlled storage failure' });
    await expect(fixture.command.setDailyAttendance(input))
      .rejects.toThrow('ATTENDANCE_COMMAND_FAILED [XX001]: controlled storage failure');
  });

  it('retains a database failure whose SQLSTATE is unavailable', () => {
    expect(() => assertAttendanceCommandSuccess({ message: 'controlled transport failure' }))
      .toThrow('ATTENDANCE_COMMAND_FAILED [UNKNOWN]: controlled transport failure');
  });

  it('accepts only a successful error result before parsing the returned row', () => {
    expect(() => assertAttendanceCommandSuccess(null)).not.toThrow();
  });

  it('propagates a rejected RPC transport promise without converting it to not-found', async () => {
    const fixture = setup();
    fixture.rpc.mockRejectedValue(new Error('controlled disconnected transport'));
    await expect(fixture.command.setDailyAttendance(input)).rejects.toThrow('controlled disconnected transport');
  });
});
