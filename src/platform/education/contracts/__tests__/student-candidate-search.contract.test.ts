import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { StudentContractImpl } from '../student.contract.impl';
import { EducationCandidateReadError } from '../student.contract';

jest.mock('../../student/student.service', () => ({ StudentService: {} }));
jest.mock('@/lib/supabase-server', () => ({ createClient: jest.fn() }));

const id = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const tenantId = id(1), actorId = id(2), courseId = id(3), studentId = id(4), guardianId = id(5);
type Row = Record<string, unknown>;
type Result = { data: Row[] | Row | null; count: number | null; error: unknown };
const result = (data: Row[] | Row | null, error: unknown = null, count = Array.isArray(data) ? data.length : null): Result => ({ data, error, count });
const party = (partyId: string, displayName = 'An') => ({ id: partyId, tenant_id: tenantId, display_name: displayName, party_type: 'person', deleted_at: null });
const student = (partyId = studentId, status = 'enrolled') => ({ party_id: partyId, tenant_id: tenantId, academic_status: status });
const relationship = (target = studentId, source = guardianId) => ({ id: id(6), tenant_id: tenantId, source_party_id: source,
  target_party_id: target, relationship_type: 'guardian_of', active_from: '2026-10-22', active_to: '2026-10-22' });

function setup(overrides: Partial<Record<string, Result[]>> = {}) {
  const queues: Record<string, Result[]> = {
    users: [result({ id: actorId, tenant_id: tenantId, role: 'admin', status: 'active' })],
    tenants: [result({ id: tenantId, status: 'active', product_key: 'bella_preschool' })],
    edu_courses: [result({ id: courseId, tenant_id: tenantId, status: 'active' })],
    party_parties: [result([party(studentId)]), result([party(guardianId, 'Guardian')])],
    students: [result([student()])], edu_enrollments: [result([])], party_relationships: [result([relationship()])],
    ...overrides,
  };
  const calls: { table: string; operation: string; args: unknown[] }[] = [];
  const from = jest.fn((table: string) => {
    const response = queues[table]?.shift();
    if (!response) throw new Error(`UNEXPECTED_READ_${table}`);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'ilike', 'order', 'limit', 'gt', 'in', 'or', 'maybeSingle']) {
      builder[method] = (...args: unknown[]) => { calls.push({ table, operation: method, args }); return builder; };
    }
    builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(response).then(resolve, reject);
    return builder;
  });
  const getUser = jest.fn(async () => ({ data: { user: { id: actorId } }, error: null as unknown }));
  const client = { auth: { getUser }, from } as unknown as SupabaseClient<Database>;
  return { contract: new StudentContractImpl(client), calls, from, getUser };
}

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-21T18:30:00Z')); });
afterEach(() => { jest.useRealTimers(); });

describe('ACR-2026-021 — bounded caller-scoped Enrollment candidate read', () => {
  it.each([
    ['enrolled', 'active'], ['on_leave', 'suspended'], ['graduated', 'suspended'],
  ])('reads only Student DTO fields while retaining existing %s mapping and latest enrollment ordering', async (stored, publicStatus) => {
    const { contract, calls } = setup({ students: [result({ party_id: studentId, tenant_id: tenantId, student_code: 'S-01', academic_status: stored })] });
    expect(await contract.getStudent(tenantId, studentId)).toEqual({ partyId: studentId, tenantId, studentCode: 'S-01', academicStatus: publicStatus });
    expect(calls).toContainEqual({ table: 'students', operation: 'select', args: ['party_id, tenant_id, student_code, academic_status'] });
    expect(calls).toContainEqual({ table: 'students', operation: 'eq', args: ['tenant_id', tenantId] });
    expect(calls).toContainEqual({ table: 'students', operation: 'eq', args: ['party_id', studentId] });
    expect(calls).toContainEqual({ table: 'students', operation: 'order', args: ['enrollment_date', { ascending: false }] });
    expect(calls).toContainEqual({ table: 'students', operation: 'limit', args: [1] });
    expect(calls.every(call => call.operation !== 'select' || call.args[0] !== '*')).toBe(true);
  });

  it('returns null for an unavailable Student row without substituting identity', async () => {
    expect(await setup({ students: [result(null)] }).contract.getStudent(tenantId, studentId)).toBeNull();
  });

  it('does not fall back to a privileged read when a narrow Student lookup is denied', async () => {
    const { contract, from } = setup({ students: [result(null, { code: '42501' })] });
    await expect(contract.getStudent(tenantId, studentId)).rejects.toThrow('EDUCATION_STUDENT_LOOKUP_UNAVAILABLE');
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('returns only minimal validated RPC fields with the verified caller client', async () => {
    const rpc = jest.fn(async () => ({ data: page(), error: null }));
    const { contract, client } = rpcSetup(rpc);
    const result = await contract.searchEnrollmentCandidates({ courseId, query: ' An ', limit: 10 });
    expect(result).toEqual(page());
    expect(rpc).toHaveBeenCalledWith('edu_preschool_enrollment_candidates', { p_course_id: courseId, p_query: 'An', p_limit: 10, p_cursor: undefined });
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it.each([{ query: '' }, { query: 'a' }, { query: 'x'.repeat(81) }, { query: 'a\nb' }, { query: '**' },
    { limit: 0 }, { limit: 21 }, { limit: 1.5 }, { cursor: 'invalid' }, { courseId: 'invalid' }])('rejects invalid input before Auth/RPC: %j', async override => {
    const rpc = jest.fn(); const { contract, client } = rpcSetup(rpc);
    await expect(contract.searchEnrollmentCandidates({ courseId, query: 'An', ...override })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(rpc).not.toHaveBeenCalled(); expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it('normalizes accepted uppercase Course and cursor UUIDs before RPC and readback', async () => {
    const c = 'abcdefab-abcd-4abc-8abc-abcdefabcdef', cursor = 'abcdefaa-abcd-4abc-8abc-abcdefabcdef';
    const rpc = jest.fn(async () => ({ data: { ...page(), courseId: c, candidates: [], nextCursor: null }, error: null }));
    const { contract } = rpcSetup(rpc);
    expect((await contract.searchEnrollmentCandidates({ courseId: c.toUpperCase(), cursor: cursor.toUpperCase(), query: 'An' })).courseId).toBe(c);
    expect(rpc).toHaveBeenCalledWith('edu_preschool_enrollment_candidates', { p_course_id: c, p_query: 'An', p_limit: 20, p_cursor: cursor });
  });

  it('has no default or privileged fallback', async () => {
    await expect(new StudentContractImpl().searchEnrollmentCandidates({ courseId, query: 'An' })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    const rpc = jest.fn(async () => ({ data: null, error: { code: '42501' } })); const { contract, client } = rpcSetup(rpc);
    await expect(contract.searchEnrollmentCandidates({ courseId, query: 'An' })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(rpc).toHaveBeenCalledTimes(1); expect(client.from).toHaveBeenCalledTimes(1);
  });

  it.each(['teacher', 'admin_staff', 'super_admin'])('denies role %s before RPC', async role => {
    const rpc = jest.fn(); const { contract } = rpcSetup(rpc, role);
    await expect(contract.searchEnrollmentCandidates({ courseId, query: 'An' })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    null, { ...page(), tenantId: id(99) }, { ...page(), courseId: id(99) }, { ...page(), nextCursor: 'invalid' },
    { ...page(), candidates: [candidate(), candidate()] },
    { ...page(), candidates: [{ ...candidate(), guardians: [] }] },
    { ...page(), candidates: [{ ...candidate(), guardians: [{ guardianPartyId: studentId, guardianLabel: 'Self' }] }] },
    { ...page(), candidates: [{ ...candidate(), studentLabel: '' }] },
    { ...page(), candidates: [{ ...candidate(), guardians: [candidate().guardians[0], candidate().guardians[0]] }] },
  ])('fails closed on malformed or mismatched RPC response %j', async data => {
    const { contract } = rpcSetup(jest.fn(async () => ({ data, error: null })));
    await expect(contract.searchEnrollmentCandidates({ courseId, query: 'An' })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });

  it('preserves an empty scanned page cursor without substituting candidates', async () => {
    const { contract } = rpcSetup(jest.fn(async () => ({ data: { ...page(), candidates: [], nextCursor: studentId }, error: null })));
    expect(await contract.searchEnrollmentCandidates({ courseId, query: 'An' })).toEqual({ ...page(), candidates: [], nextCursor: studentId });
  });
});

function candidate() { return { studentPartyId: studentId, studentLabel: 'An', guardians: [{ guardianPartyId: guardianId, guardianLabel: 'Guardian' }] }; }
function page() { return { tenantId, courseId, candidates: [candidate()], nextCursor: null }; }
function rpcSetup(rpc: jest.Mock, role = 'admin') {
  const q = { eq: jest.fn(() => q), maybeSingle: jest.fn(async () => ({ data: { id: actorId, tenant_id: tenantId, role, status: 'active' }, error: null })) };
  const client = { rpc, auth: { getUser: jest.fn(async () => ({ data: { user: { id: actorId } }, error: null })) }, from: jest.fn(() => ({ select: jest.fn(() => q) })) };
  return { client, contract: new StudentContractImpl(client as unknown as SupabaseClient<Database>) };
}
