import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockGetUser = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockListCurriculums = jest.fn();
const mockSaveCurriculum = jest.fn();
const mockListLessonPlans = jest.fn();
const mockSaveLessonPlan = jest.fn();
const mockDeleteLessonPlan = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

jest.mock('@/lib/supabase-admin-env', () => ({
  getSupabaseAdminUrl: () => 'https://mock.supabase.co',
  getSupabaseAdminKey: () => 'mock-service-role-key',
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

jest.mock('@/products/bella-education/learning-development/curriculum/curriculum.service', () => ({
  CurriculumService: jest.fn().mockImplementation(() => ({
    listCurriculums: mockListCurriculums,
    saveCurriculum: mockSaveCurriculum,
    listLessonPlans: mockListLessonPlans,
    saveLessonPlan: mockSaveLessonPlan,
    deleteLessonPlan: mockDeleteLessonPlan,
  })),
}));

const { GET, POST, DELETE } = require('../route') as typeof import('../route');
// Test-only local URL; not a real HTTP call. nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
const TEST_BASE_URL = 'http://localhost/api/education/curriculum';

describe('Curriculum & Lesson Plan API Route (/api/education/curriculum)', () => {
  const actorId = '00000000-0000-4000-8000-000000000001';
  const tenantId = '00000000-0000-4000-8000-000000000002';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'No session' } } as never);

      const request = new Request(TEST_BASE_URL);
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe('CURRICULUM_UNAUTHENTICATED');
    });

    it('returns 200 with curriculums and lesson plans when authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: null } as never);
      mockGetCurrentUser.mockResolvedValueOnce({ id: actorId, tenant_id: tenantId, role: 'admin' } as never);
      mockListCurriculums.mockResolvedValueOnce([{ id: 'curr-1', name: 'Curriculum 1' }] as never);
      mockListLessonPlans.mockResolvedValueOnce([{ id: 'plan-1', title: 'Lesson 1' }] as never);

      const request = new Request(TEST_BASE_URL);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.curriculums).toHaveLength(1);
      expect(json.lessonPlans).toHaveLength(1);
    });

    it('returns lessons only when ?type=lessons', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: null } as never);
      mockGetCurrentUser.mockResolvedValueOnce({ id: actorId, tenant_id: tenantId, role: 'admin' } as never);
      mockListLessonPlans.mockResolvedValueOnce([{ id: 'plan-1', title: 'Lesson 1' }] as never);

      const request = new Request(TEST_BASE_URL + "?type=lessons&weekNumber=44");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.lessonPlans).toHaveLength(1);
    });
  });

  describe('POST', () => {
    const validLesson = {
      weekNumber: 44,
      year: 2026,
      academicYear: '2026-2027',
      theme: 'Thế giới động vật',
      subjectDomain: 'Phát triển Thể chất',
      title: 'Bật qua vật cản',
      plannedDate: '2026-10-26',
      status: 'APPROVED',
      objectives: { knowledge: 'Biết bật', skills: 'Khéo léo', attitude: 'Hào hứng' },
      activitySteps: [],
    };

    it('returns 403 when role is not authorized', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: null } as never);
      mockGetCurrentUser.mockResolvedValueOnce({ id: actorId, tenant_id: tenantId, role: 'parent' } as never);

      const request = new Request(TEST_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLesson),
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('returns 200 when saving valid lesson plan', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: null } as never);
      mockGetCurrentUser.mockResolvedValueOnce({ id: actorId, tenant_id: tenantId, role: 'admin' } as never);
      mockSaveLessonPlan.mockResolvedValueOnce({ success: true, id: 'saved-plan-1' } as never);

      const request = new Request(TEST_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLesson),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.id).toBe('saved-plan-1');
    });
  });

  describe('DELETE', () => {
    it('returns 200 when deleting lesson plan by id', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: null } as never);
      mockGetCurrentUser.mockResolvedValueOnce({ id: actorId, tenant_id: tenantId, role: 'admin' } as never);
      mockDeleteLessonPlan.mockResolvedValueOnce({ success: true, id: 'plan-to-del' } as never);

      const request = new Request(TEST_BASE_URL + "?id=plan-to-del", {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });
  });
});

