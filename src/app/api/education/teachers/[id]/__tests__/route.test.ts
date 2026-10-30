import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CurrentActorProfileRow } from '@/platform/security/current-actor.contract';

const tenantId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const teacherPartyId = '00000000-0000-4000-8000-000000000004';

const actor: CurrentActorProfileRow = {
  id: actorId,
  tenant_id: tenantId,
  email: 'admin@preschool.example.invalid',
  full_name: 'Admin User',
  avatar_url: null,
  role: 'admin',
  status: 'active',
  tenant_status: 'active',
};

const auth = jest.fn<() => Promise<{ data: { user: { id: string } | null }; error: null }>>();
const profile = jest.fn<() => Promise<{ data: CurrentActorProfileRow[] | null; error: null }>>();
const tenant = jest.fn<() => Promise<{ data: { id: string; status: string; product_key: string }; error: null }>>();
const readerFrom = jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: tenant }) }) }));
const reader = jest.fn(() => ({ auth: { getUser: auth }, rpc: profile, from: readerFrom }));

const writerRpc = jest.fn<(...args: unknown[]) => Promise<{ data: unknown; error: { code: string; message: string } | null }>>();
const writer = jest.fn(() => ({ rpc: writerRpc }));
const adminKey = jest.fn<() => string | undefined>();

jest.mock('@/lib/supabase-server', () => ({ createClient: reader }));
jest.mock('@supabase/supabase-js', () => ({ createClient: writer }));
jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://synthetic.invalid',
  getSupabaseAdminKey: adminKey,
}));

// Import route after mocks
const { GET, PATCH } = require('../route') as typeof import('../route');

const sampleProfile = {
  partyId: teacherPartyId,
  name: 'Cô Nguyễn Thị Mai',
  phone: '0901234567',
  email: 'mai.nguyen@preschool.example.invalid',
  address: 'Hà Nội',
  joinedDate: '01/08/2023',
  degree: 'Cử nhân Sư phạm Mầm non',
  totalExperience: '5 năm kinh nghiệm',
  workloadHours: 35,
  maxWorkloadHours: 40,
  status: 'Đã xác nhận',
  role: 'Giáo viên chủ nhiệm',
  currentClass: 'Lớp Chồi 1',
  compliance: {
    officialRecords: true,
    healthCheck: true,
    firstAidWarning: 'valid',
  },
};

const makeGetRequest = (id: string) =>
  new Request(`http://localhost/api/education/teachers/${id}`);

const makePatchRequest = (id: string, body: unknown) =>
  new Request(`http://localhost/api/education/teachers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  adminKey.mockReturnValue('synthetic-key');
  auth.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
  profile.mockResolvedValue({ data: [actor], error: null });
  tenant.mockResolvedValue({ data: { id: tenantId, status: 'active', product_key: 'bella_preschool' }, error: null });
  writerRpc.mockResolvedValue({ data: sampleProfile, error: null });
});

describe('Preschool Teacher 360 Detail API (/api/education/teachers/[id])', () => {
  describe('GET', () => {
    it('returns teacher profile with 200 and private headers', async () => {
      const response = await GET(makeGetRequest(teacherPartyId), {
        params: Promise.resolve({ id: teacherPartyId }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ success: true, profile: sampleProfile });
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(writerRpc).toHaveBeenCalledWith('preschool_admin_get_teacher_profile', {
        p_tenant_id: tenantId,
        p_actor_id: actorId,
        p_teacher_party_id: teacherPartyId,
      });
    });

    it('rejects invalid teacher UUID with 400', async () => {
      const response = await GET(makeGetRequest('invalid-uuid'), {
        params: Promise.resolve({ id: 'invalid-uuid' }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('PRESCHOOL_TEACHER_INVALID_REQUEST');
      expect(writerRpc).not.toHaveBeenCalled();
    });

    it('returns 404 when teacher profile is not found', async () => {
      writerRpc.mockResolvedValue({
        data: null,
        error: { code: '44404', message: 'Not found' },
      });

      const response = await GET(makeGetRequest(teacherPartyId), {
        params: Promise.resolve({ id: teacherPartyId }),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('PRESCHOOL_TEACHER_NOT_FOUND');
    });

    it('returns 403 when caller is not allowed or across tenant', async () => {
      writerRpc.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      const response = await GET(makeGetRequest(teacherPartyId), {
        params: Promise.resolve({ id: teacherPartyId }),
      });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe('PRESCHOOL_TEACHER_ACCESS_DENIED');
    });
  });

  describe('PATCH', () => {
    it('updates teacher profile and returns 200 with updated data', async () => {
      const updatedProfile = {
        ...sampleProfile,
        name: 'Cô Nguyễn Thị Mai Anh',
        phone: '0988888888',
        workloadHours: 38,
      };
      writerRpc.mockResolvedValue({ data: updatedProfile, error: null });

      const patchBody = {
        name: 'Cô Nguyễn Thị Mai Anh',
        phone: '0988888888',
        workloadHours: 38,
        compliance: {
          officialRecords: true,
          healthCheck: true,
          firstAidWarning: 'valid',
        },
      };

      const response = await PATCH(makePatchRequest(teacherPartyId, patchBody), {
        params: Promise.resolve({ id: teacherPartyId }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ success: true, profile: updatedProfile });
      expect(writerRpc).toHaveBeenCalledWith('preschool_admin_update_teacher_profile', {
        p_tenant_id: tenantId,
        p_actor_id: actorId,
        p_teacher_party_id: teacherPartyId,
        p_name: 'Cô Nguyễn Thị Mai Anh',
        p_phone: '0988888888',
        p_email: null,
        p_address: null,
        p_joined_date: null,
        p_degree: null,
        p_total_experience: null,
        p_workload_hours: 38,
        p_compliance: {
          officialRecords: true,
          healthCheck: true,
          firstAidWarning: 'valid',
        },
      });
    });

    it('rejects disallowed fields with 400', async () => {
      const patchBody = {
        name: 'Test',
        maliciousField: 'hack',
      };

      const response = await PATCH(makePatchRequest(teacherPartyId, patchBody), {
        params: Promise.resolve({ id: teacherPartyId }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('PRESCHOOL_TEACHER_INVALID_REQUEST');
      expect(writerRpc).not.toHaveBeenCalled();
    });

    it('rejects name exceeding 120 characters with 400', async () => {
      const patchBody = {
        name: 'A'.repeat(125),
      };

      const response = await PATCH(makePatchRequest(teacherPartyId, patchBody), {
        params: Promise.resolve({ id: teacherPartyId }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('PRESCHOOL_TEACHER_INVALID_REQUEST');
      expect(writerRpc).not.toHaveBeenCalled();
    });
  });
});
