import { AttendanceContractImpl } from '../attendance.contract.impl';

const tenantId = '10000000-0000-4000-8000-000000000001';
const enrollmentId = '10000000-0000-4000-8000-000000000002';
const eventId = '10000000-0000-4000-8000-000000000003';
const projectionId = '10000000-0000-4000-8000-000000000004';
const input = { tenantId, enrollmentId, status: 'present' as const, rollCallTime: '2026-10-22T17:30:00.000Z' };
const state = { id: projectionId, tenant_id: tenantId, enrollment_id: enrollmentId, school_day: '2026-10-23',
  status: 'present', event_id: eventId, roll_call_time: '2026-10-23T00:30:00+07:00',
  created_at: input.rollCallTime, updated_at: input.rollCallTime };

function fixture() {
  const client = { from: jest.fn(() => { throw new Error('DIRECT_TABLE_ACCESS_FORBIDDEN'); }),
    rpc: jest.fn().mockResolvedValue({ data: [state], error: null }) };
  return { client, contract: new AttendanceContractImpl(client as never) };
}

describe('recordAttendance through the authorized atomic RPC', () => {
  afterEach(() => jest.useRealTimers());

  it('returns persisted history identity, preserves the DTO and makes one caller RPC', async () => {
    const { client, contract } = fixture();
    expect(await contract.recordAttendance(input)).toEqual({ id: eventId, tenantId, enrollmentId,
      status: 'present', rollCallTime: state.roll_call_time });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith('edu_set_daily_attendance', {
      p_tenant_id: tenantId, p_enrollment_id: enrollmentId, p_status: 'present',
      p_roll_call_time: input.rollCallTime, p_school_day: '2026-10-23',
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('uses one stable timestamp when the caller omits it', async () => {
    jest.useFakeTimers().setSystemTime(new Date(input.rollCallTime));
    const { client, contract } = fixture();
    await expect(contract.recordAttendance({ tenantId, enrollmentId, status: 'present' })).resolves.toMatchObject({ id: eventId });
    expect(client.rpc.mock.calls[0][1].p_roll_call_time).toBe(input.rollCallTime);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('accepts PostgreSQL-normalized UUIDs when caller UUIDs contain uppercase letters', async () => {
    const { client, contract } = fixture();
    const canonicalTenant = 'abcdef00-0000-4000-8000-000000000001';
    const canonicalEnrollment = 'abcdef00-0000-4000-8000-000000000002';
    client.rpc.mockResolvedValue({ data: [{ ...state, tenant_id: canonicalTenant, enrollment_id: canonicalEnrollment }], error: null });
    await expect(contract.recordAttendance({ ...input, tenantId: canonicalTenant.toUpperCase(),
      enrollmentId: canonicalEnrollment.toUpperCase() })).resolves.toMatchObject({ id: eventId,
      tenantId: canonicalTenant, enrollmentId: canonicalEnrollment });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('preserves legacy PostgreSQL UUID identities without imposing version or variant bits', async () => {
    const { client, contract } = fixture();
    const legacyTenant = '00000000-0000-0000-0000-000000000088';
    const legacyEnrollment = '00000000-0000-0000-0000-000000000089';
    client.rpc.mockResolvedValue({ data: [{ ...state, tenant_id: legacyTenant, enrollment_id: legacyEnrollment }], error: null });
    await expect(contract.recordAttendance({ ...input, tenantId: legacyTenant, enrollmentId: legacyEnrollment }))
      .resolves.toMatchObject({ id: eventId, tenantId: legacyTenant, enrollmentId: legacyEnrollment });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each(['compact', 'braced'])('accepts equivalent PostgreSQL UUID input in %s form', async form => {
    const { client, contract } = fixture();
    const format = (value: string) => form === 'compact' ? value.replace(/-/g, '') : `{${value}}`;
    await expect(contract.recordAttendance({ ...input, tenantId: format(tenantId), enrollmentId: format(enrollmentId) }))
      .resolves.toMatchObject({ id: eventId, tenantId, enrollmentId });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each(['42501', '23514', 'PGRST202'])('propagates RPC failure %s without direct-write fallback', async code => {
    const { client, contract } = fixture();
    client.rpc.mockResolvedValue({ data: null, error: { code, message: `RPC_${code}` } });
    await expect(contract.recordAttendance(input)).rejects.toThrow(`RPC_${code}`);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('propagates a rejected transport without retry or direct write', async () => {
    const { client, contract } = fixture();
    client.rpc.mockRejectedValue(new Error('NETWORK_UNAVAILABLE'));
    await expect(contract.recordAttendance(input)).rejects.toThrow('NETWORK_UNAVAILABLE');
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('preserves the existing missing-enrollment error without another read or write', async () => {
    const { client, contract } = fixture();
    client.rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'ATTENDANCE_ENROLLMENT_NOT_FOUND' } });
    await expect(contract.recordAttendance(input)).rejects.toThrow(`Enrollment ${enrollmentId} not found`);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each([
    { event_id: undefined }, { event_id: 'not-an-event-id' }, { tenant_id: enrollmentId },
    { enrollment_id: tenantId }, { status: 'absent' }, { roll_call_time: undefined },
    { roll_call_time: 'invalid' }, { roll_call_time: '2026-10-22T17:31:00Z' },
  ])('rejects incomplete or mismatched committed response %#', async delta => {
    const { client, contract } = fixture();
    client.rpc.mockResolvedValue({ data: [{ ...state, ...delta }], error: null });
    await expect(contract.recordAttendance(input)).rejects.toThrow('ATTENDANCE_EVENT_UNAVAILABLE');
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('rejects an empty RPC response without inventing a history event', async () => {
    const { client, contract } = fixture();
    client.rpc.mockResolvedValue({ data: [], error: null });
    await expect(contract.recordAttendance(input)).rejects.toThrow('no state returned');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('rejects invalid time before any RPC', async () => {
    const { client, contract } = fixture();
    await expect(contract.recordAttendance({ ...input, rollCallTime: 'invalid' })).rejects.toThrow('INVALID_ROLL_CALL_TIME');
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });
});
