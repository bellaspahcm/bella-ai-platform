import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { CURRENT_ACTOR_PROFILE_RPC } from '@/platform/security/current-actor.contract';
import { EnrollmentContractImpl } from '../enrollment.contract.impl';

const mockPublish = jest.fn(async (_event: unknown) => undefined);
jest.mock('@/platform/host/event-bus', () => ({ eventBus: { publish: (event: unknown) => mockPublish(event) } }));
jest.mock('@/lib/supabase-server', () => ({ createClient: jest.fn(() => { throw Error('NO_DEFAULT_CLIENT'); }) }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const input = { tenantId: id(1), courseId: id(2), studentPartyId: id(3), guardianPartyId: id(4), requestId: id(5) };
const actorId = id(6);
const enrollment = { id: id(7), tenantId: input.tenantId, courseId: input.courseId, studentPartyId: input.studentPartyId,
  status: 'active', enrolledAt: '2026-10-23T00:00:00.000Z' };

function setup(
  data: unknown = { enrollment, isDuplicate: false },
  mutationError: { code: string; message?: string } | null = null,
  profileError: { code: string; message?: string } | null = null,
  profileOverride: Record<string, unknown> = {},
) {
  const profile = {
    id: actorId, email: 'admin@example.test', full_name: null, avatar_url: null,
    tenant_id: input.tenantId, role: 'admin', status: 'active', tenant_status: 'active',
    ...profileOverride,
  };
  const mutationRpc = jest.fn(async (_args: unknown) => ({ data, error: mutationError }));
  const rpc = jest.fn(async (name: string, args?: unknown) => {
    if (name === CURRENT_ACTOR_PROFILE_RPC) return { data: profileError ? null : [profile], error: profileError };
    if (name === 'edu_preschool_enroll_student') return mutationRpc(args);
    return { data: null, error: { code: '42883', message: 'FUNCTION_NOT_FOUND' } };
  });
  const client = {
    rpc,
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: actorId } }, error: null as unknown })) },
    from: jest.fn(() => { throw new Error('DIRECT_USERS_READ_FORBIDDEN'); }),
  };
  return { rpc, mutationRpc, client, profile, contract: new EnrollmentContractImpl(client as unknown as SupabaseClient<Database>) };
}

beforeEach(() => jest.clearAllMocks());

describe('ACR-2026-021 explicit Preschool atomic enrollment capability', () => {
  it('resolves the authenticated actor through the Platform profile RPC before mutation, then publishes after commit', async () => {
    const { rpc, mutationRpc, client, contract } = setup();
    expect(await contract.enrollPreschoolStudent(input)).toEqual(enrollment);
    expect(rpc).toHaveBeenNthCalledWith(1, CURRENT_ACTOR_PROFILE_RPC);
    expect(rpc).toHaveBeenNthCalledWith(2, 'edu_preschool_enroll_student', {
      p_course_id: input.courseId, p_student_party_id: input.studentPartyId, p_guardian_party_id: input.guardianPartyId, p_request_id: input.requestId,
    });
    expect(client.from).not.toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish.mock.calls[0][0]).toMatchObject({ eventType: 'edu.enrollment.created.v1', tenantId: input.tenantId,
      aggregateId: enrollment.id, userId: actorId, payload: { enrollmentId: enrollment.id, status: 'active' } });
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(mutationRpc.mock.invocationCallOrder[0]);
    expect(mutationRpc.mock.invocationCallOrder[0]).toBeLessThan(mockPublish.mock.invocationCallOrder[0]);
  });

  it('publishes nothing while the database result is still pending', async () => {
    const { mutationRpc, contract } = setup();
    let release!: (value: { data: unknown; error: null }) => void;
    mutationRpc.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = contract.enrollPreschoolStudent(input);
    await new Promise(resolve => setImmediate(resolve));
    expect(mockPublish).not.toHaveBeenCalled();
    release({ data: { enrollment, isDuplicate: false }, error: null });
    await pending; expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('normalizes accepted uppercase UUID selectors before writing and comparing the committed response', async () => {
    const hexId = 'abcdefab-abcd-4abc-8abc-abcdefabcdef';
    const { contract, rpc, profile } = setup({ enrollment: { ...enrollment, tenantId: hexId, courseId: hexId, studentPartyId: hexId }, isDuplicate: false }, null, null,
      { tenant_id: hexId });
    profile.tenant_id = hexId;
    const upper = hexId.toUpperCase();
    const result = await contract.enrollPreschoolStudent({ tenantId: upper, courseId: upper, studentPartyId: upper, guardianPartyId: upper, requestId: upper });
    expect(result.tenantId).toBe(hexId);
    expect(rpc).toHaveBeenNthCalledWith(2, 'edu_preschool_enroll_student', { p_course_id: hexId, p_student_party_id: hexId, p_guardian_party_id: hexId, p_request_id: hexId });
  });

  it('reports publication failure without attempting a second database mutation or false success', async () => {
    const { contract, mutationRpc } = setup();
    mockPublish.mockRejectedValueOnce(new Error('adapter unavailable'));
    await expect(contract.enrollPreschoolStudent(input)).rejects.toThrow('adapter unavailable');
    expect(mutationRpc).toHaveBeenCalledTimes(1); expect(mockPublish).toHaveBeenCalledTimes(1);
    // Durable delivery requires a separately owned outbox; this bounded capability
    // proves ordering, and deliberately does not claim crash-safe delivery.
  });

  it('returns the same valid retry without publishing a second event', async () => {
    const { contract } = setup({ enrollment, isDuplicate: true });
    expect(await contract.enrollPreschoolStudent(input)).toEqual(enrollment);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it.each(['42501', '23505', '22023', '23514', '0A000', '22003'])('maps mutation database error %s without a false success or direct table read', async code => {
    const { rpc, contract, client, mutationRpc } = setup(null, { code });
    await expect(contract.enrollPreschoolStudent(input)).rejects.toMatchObject({ code: code === '42501' ? 'DENIED' : code === '23505' ? 'CONFLICT' : code === '22023' ? 'INVALID_REQUEST' : 'UNAVAILABLE' });
    expect(mockPublish).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(2); expect(mutationRpc).toHaveBeenCalledTimes(1);
    expect(client.from).not.toHaveBeenCalled();
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

  it.each([
    { tenant_id: id(99) }, { role: 'super_admin' }, { role: 'admin_staff' }, { status: 'inactive' },
    { tenant_status: 'inactive' }, { id: id(99) },
  ])('rejects forged/mismatched caller profile before mutation %j', async override => {
    const { profile, rpc, mutationRpc, contract } = setup(undefined, null, null, override);
    Object.assign(profile, override);
    await expect(contract.enrollPreschoolStudent(input)).rejects.toMatchObject({ code: 'DENIED' });
    expect(rpc).toHaveBeenCalledTimes(1); expect(rpc).toHaveBeenCalledWith(CURRENT_ACTOR_PROFILE_RPC);
    expect(mutationRpc).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
  });

  it('denies a profile RPC permission failure and does not mutate', async () => {
    const { rpc, mutationRpc, contract } = setup(undefined, null, { code: '42501' });
    await expect(contract.enrollPreschoolStudent(input)).rejects.toMatchObject({ code: 'DENIED' });
    expect(rpc).toHaveBeenCalledTimes(1); expect(mutationRpc).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
  });

  it('reports an unavailable profile RPC without attempting mutation', async () => {
    const { rpc, mutationRpc, contract } = setup(undefined, null, { code: '08006' });
    await expect(contract.enrollPreschoolStudent(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(rpc).toHaveBeenCalledTimes(1); expect(mutationRpc).not.toHaveBeenCalled(); expect(mockPublish).not.toHaveBeenCalled();
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
