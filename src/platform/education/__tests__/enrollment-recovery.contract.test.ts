import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { EnrollmentRecoveryContractImpl } from '../contracts/enrollment-recovery.contract.impl';
import { EducationEnrollmentRecoveryConflictError } from '../contracts/enrollment-recovery.contract';

const input = {
  tenantId: 'a8d63141-a595-4c3a-959a-06aa2696d74a',
  requestId: ' admission/request:opaque ',
  studentPartyId: '8a4f036b-fbfa-4192-afc9-a8aeaa196386',
  courseId: '526cfb41-3d59-48d6-866b-53b8b414979f',
};
const row = {
  id: 'e2f88a25-5dfb-45ac-8501-507ff9710e55',
  tenant_id: input.tenantId,
  request_id: input.requestId,
  student_party_id: input.studentPartyId,
  course_id: input.courseId,
  status: 'active',
  enrolled_at: '2026-10-19T04:00:00+00:00',
  created_at: '2026-10-19T04:00:00+00:00',
  updated_at: '2026-10-19T04:00:00+00:00',
};

function boundary(body: unknown = [row], status = 200) {
  const requests: Array<{ url: URL; method: string }> = [];
  const fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: new URL(String(url)), method: init?.method ?? 'GET' });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '0' },
    });
  });
  const client = createClient<Database>('http://127.0.0.1:54321', 'unit-test-key', {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { contract: new EnrollmentRecoveryContractImpl(client), requests, fetch };
}

describe('Education read-only enrollment request recovery (accepted ADR)', () => {
  it.each(['pending', 'active', 'completed', 'cancelled'])(
    'returns canonical persisted %s enrollment without eligibility, writes or events',
    async status => {
      const { contract, requests } = boundary([{ ...row, status }]);
      await expect(contract.getEnrollmentByRequest(input)).resolves.toEqual({
        id: row.id,
        tenantId: input.tenantId,
        studentPartyId: input.studentPartyId,
        courseId: input.courseId,
        status,
        enrolledAt: '2026-10-19T04:00:00.000Z',
      });
      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe('GET');
      expect(requests[0].url.pathname).toBe('/rest/v1/edu_enrollments');
      expect(requests[0].url.searchParams.get('tenant_id')).toBe(`eq.${input.tenantId}`);
      expect(requests[0].url.searchParams.get('request_id')).toBe(`eq.${input.requestId}`);
      expect(requests[0].url.searchParams.has('status')).toBe(false);
      expect(requests[0].url.searchParams.has('student_party_id')).toBe(false);
      expect(requests[0].url.searchParams.has('course_id')).toBe(false);
    }
  );

  it('returns null only for a successful tenant-scoped absent read', async () => {
    const { contract } = boundary([]);
    await expect(contract.getEnrollmentByRequest(input)).resolves.toBeNull();
  });

  it.each(['tenantId', 'studentPartyId', 'courseId', 'all'] as const)(
    'recovers the same canonical result when UUID input %s uses uppercase',
    async field => {
      const { contract, requests } = boundary();
      const variant = {
        ...input,
        tenantId: field === 'tenantId' || field === 'all' ? input.tenantId.toUpperCase() : input.tenantId,
        studentPartyId: field === 'studentPartyId' || field === 'all' ? input.studentPartyId.toUpperCase() : input.studentPartyId,
        courseId: field === 'courseId' || field === 'all' ? input.courseId.toUpperCase() : input.courseId,
      };
      await expect(contract.getEnrollmentByRequest(variant)).resolves.toMatchObject({
        id: row.id, tenantId: input.tenantId,
        studentPartyId: input.studentPartyId, courseId: input.courseId,
      });
      expect(requests[0].url.searchParams.get('tenant_id')).toBe(`eq.${input.tenantId}`);
      expect(requests[0].url.searchParams.get('request_id')).toBe(`eq.${input.requestId}`);
    }
  );

  it.each(['studentPartyId', 'courseId'] as const)(
    'throws typed generic conflict on expected %s mismatch instead of false absence',
    async field => {
      const { contract, requests } = boundary();
      const failure = contract.getEnrollmentByRequest({ ...input, [field]: 'different-canonical-id' });
      await expect(failure).rejects.toBeInstanceOf(EducationEnrollmentRecoveryConflictError);
      await expect(failure).rejects.toMatchObject({
        code: 'EDUCATION_ENROLLMENT_RECOVERY_CONFLICT',
        message: 'Enrollment recovery context conflicts with the existing request',
      });
      await failure.catch(error => {
        expect(String(error)).not.toContain(row.student_party_id);
        expect(String(error)).not.toContain(row.course_id);
        expect(JSON.stringify(error)).not.toContain(row.id);
      });
      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe('GET');
    }
  );

  it.each(['tenant_id', 'request_id'] as const)(
    'fails closed if a response does not match the queried %s',
    async field => {
      const { contract } = boundary([{ ...row, [field]: 'wrong-scope' }]);
      await expect(contract.getEnrollmentByRequest(input)).rejects.toThrow('Invalid enrollment recovery result');
    }
  );

  it.each(['tenantId', 'requestId', 'studentPartyId', 'courseId'] as const)(
    'rejects empty %s before reading',
    async field => {
      const { contract, fetch } = boundary();
      await expect(contract.getEnrollmentByRequest({ ...input, [field]: ' \t ' })).rejects.toThrow(
        'Enrollment recovery requires tenantId, requestId, studentPartyId and courseId'
      );
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it('does not turn permission denial into null', async () => {
    const { contract } = boundary({ code: '42501', message: 'permission denied for table edu_enrollments' }, 403);
    await expect(contract.getEnrollmentByRequest(input)).rejects.toMatchObject({ code: '42501' });
  });

  it('does not turn unavailable DB into null', async () => {
    const { contract } = boundary({ code: 'PGRST000', message: 'database unavailable' }, 503);
    await expect(contract.getEnrollmentByRequest(input)).rejects.toMatchObject({ code: 'PGRST000' });
  });

  it('does not turn unexpected multiple rows into absence or choose one', async () => {
    const { contract } = boundary([row, { ...row, id: 'another-enrollment' }]);
    await expect(contract.getEnrollmentByRequest(input)).rejects.toMatchObject({ code: 'PGRST116' });
  });

  it('propagates transport failure rather than create or false absence', async () => {
    const { contract, fetch } = boundary();
    fetch.mockRejectedValue(new DOMException('connection interrupted', 'AbortError'));
    await expect(contract.getEnrollmentByRequest(input)).rejects.toThrow('connection interrupted');
  });
});
