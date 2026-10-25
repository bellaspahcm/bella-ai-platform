import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { EnrollmentContractImpl } from '../enrollment.contract.impl';

const mockPublish = jest.fn(async (_event: unknown) => undefined);
jest.mock('@/platform/host/event-bus', () => ({ eventBus: { publish: (event: unknown) => mockPublish(event) } }));
jest.mock('@/lib/supabase-server', () => ({ createClient: jest.fn(() => { throw Error('NO_DEFAULT_CLIENT'); }) }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const input = { tenantId: id(1), courseId: id(2), studentPartyId: id(3), guardianPartyId: id(4), requestId: id(5) };
const actorId = id(6);
const enrollment = { id: id(7), tenantId: input.tenantId, courseId: input.courseId, studentPartyId: input.studentPartyId,
  status: 'active', enrolledAt: '2026-10-23T00:00:00.000Z' };
function setup(data: unknown = { enrollment, isDuplicate: false }, error: { code: string; message?: string } | null = null) {
  const rpc = jest.fn(async (_name: string, _args: unknown) => ({ data, error }));
  const profile = { id: actorId, tenant_id: input.tenantId, role: 'admin', status: 'active' };
  const q = { eq: jest.fn(() => q), maybeSingle: jest.fn(async () => ({ data: profile, error: null as unknown })) };
  const client = { rpc, auth: { getUser: jest.fn(async () => ({ data: { user: { id: actorId } }, error: null as unknown })) },
    from: jest.fn(() => ({ select: jest.fn(() => q) })) };
  return { rpc, client, profile, q, contract: new EnrollmentContractImpl(client as unknown as SupabaseClient<Database>) };
}
beforeEach(() => jest.clearAllMocks());

describe('ACR-2026-021 explicit Preschool atomic enrollment capability', () => {
  it('calls only the new RPC through the verified caller, then publishes after its committed response', async () => {
    const { rpc, contract } = setup();
    expect(await contract.enrollPreschoolStudent(input)).toEqual(enrollment);
    expect(rpc).toHaveBeenCalledWith('edu_preschool_enroll_student', {
      p_course_id: input.courseId, p_student_party_id: input.studentPartyId, p_guardian_party_id: input.guardianPartyId, p_request_id: input.requestId,
    });
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish.mock.calls[0][0]).toMatchObject({ eventType: 'edu.enrollment.created.v1', tenantId: input.tenantId,
      aggregateId: enrollment.id, userId: actorId, payload: { enrollmentId: enrollment.id, status: 'active' } });
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(mockPublish.mock.invocationCallOrder[0]);
  });

  it('publishes nothing while the database result is still pending', async () => {
    const { rpc, contract } = setup();
    let release!: (value: { data: unknown; error: null }) => void;
    rpc.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = contract.enrollPreschoolStudent(input);
    await new Promise(resolve => setImmediate(resolve));
    expect(mockPublish).not.toHaveBeenCalled();
    release({ data: { enrollment, isDuplicate: false }, error: null });
    await pending; expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('normalizes accepted uppercase UUID selectors before writing and comparing the committed response', async () => {
    const hexId = 'abcdefab-abcd-4abc-8abc-abcdefabcdef';
    const { contract, profile, rpc } = setup({ enrollment: { ...enrollment, tenantId: hexId, courseId: hexId, studentPartyId: hexId }, isDuplicate: false });
    profile.tenant_id = hexId;
    const upper = hexId.toUpperCase();
    const result = await contract.enrollPreschoolStudent({ tenantId: upper, courseId: upper, studentPartyId: upper, guardianPartyId: upper, requestId: upper });
    expect(result.tenantId).toBe(hexId);
    expect(rpc).toHaveBeenCalledWith('edu_preschool_enroll_student', { p_course_id: hexId, p_student_party_id: hexId, p_guardian_party_id: hexId, p_request_id: hexId });
  });

  it('reports publication failure without attempting a second database mutation or false success', async () => {
    const { contract, rpc } = setup();
    mockPublish.mockRejectedValueOnce(new Error('adapter unavailable'));
    await expect(contract.enrollPreschoolStudent(input)).rejects.toThrow('adapter unavailable');
    expect(rpc).toHaveBeenCalledTimes(1); expect(mockPublish).toHaveBeenCalledTimes(1);
    // Durable delivery requires a separately owned outbox; this bounded capability
    // proves ordering, and deliberately does not claim crash-safe delivery.
  });

  it('returns the same valid retry without publishing a second event', async () => {
    const { contract } = setup({ enrollment, isDuplicate: true });
    expect(await contract.enrollPreschoolStudent(input)).toEqual(enrollment);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it.each(['42501', '23505', '22023', '23514', '0A000', '22003'])('denies database error %s with no success event or fallback', async code => {
    const { rpc, contract, client } = setup(null, { code });
    await expect(contract.enrollPreschoolStudent(input)).rejects.toMatchObject({ code: code === '42501' ? 'DENIED' : code === '23505' ? 'CONFLICT' : code === '22023' ? 'INVALID_REQUEST' : 'UNAVAILABLE' });
    expect(mockPublish).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1); expect(client.from).toHaveBeenCalledTimes(1);
  });

  it.each(Object.keys(input))('rejects invalid %s before identity or database calls', async key => {
    const { contract, client, rpc } = setup();
    await expect(contract.enrollPreschoolStudent({ ...input, [key]: 'invalid' })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(client.auth.getUser).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
  });

  it.each([
    ['ENROLLMENT_STUDENT_ACCESS_DENIED', 'STUDENT_DENIED'],
    ['ENROLLMENT_GUARDIAN_RELATIONSHIP_REQUIRED', 'GUARDIAN_REQUIRED'],
    ['arbitrary sensitive provider detail', 'DENIED'],
  ])('preserves only whitelisted legacy denial %s', async (message, code) => {
    await expect(setup(null, { code: '42501', message }).contract.enrollPreschoolStudent(input)).rejects.toMatchObject({ code });
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('never creates a default/privileged client', async () => {
    await expect(new EnrollmentContractImpl().enrollPreschoolStudent(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it.each([{ tenant_id: id(99) }, { role: 'super_admin' }, { role: 'admin_staff' }, { status: 'inactive' }, { id: id(99) }])('rejects forged/mismatched caller profile before mutation %j', async override => {
    const { profile, rpc, contract } = setup(); Object.assign(profile, override);
    await expect(contract.enrollPreschoolStudent(input)).rejects.toMatchObject({ code: 'DENIED' });
    expect(rpc).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
  });

  it.each([null, {}, { enrollment }, { enrollment, isDuplicate: 'false' },
    { enrollment: { ...enrollment, tenantId: id(99) }, isDuplicate: false },
    { enrollment: { ...enrollment, studentPartyId: id(99) }, isDuplicate: false },
    { enrollment: { ...enrollment, courseId: id(99) }, isDuplicate: false },
    { enrollment: { ...enrollment, status: 'pending' }, isDuplicate: false },
    { enrollment: { ...enrollment, enrolledAt: 'invalid' }, isDuplicate: false },
  ])('rejects malformed/mismatched committed response with no false success event %j', async data => {
    await expect(setup(data).contract.enrollPreschoolStudent(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
