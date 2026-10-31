import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { CurriculumService } from '../curriculum.service';
import type { SaveLessonPlanInput, SaveCurriculumInput } from '../curriculum.contract';

describe('CurriculumService', () => {
  const tenantId = '00000000-0000-4000-8000-000000000001';
  const actorId = '00000000-0000-4000-8000-000000000002';

  let mockSupabase: unknown;
  let service: CurriculumService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Curriculums', () => {
    it('lists curriculums with parsed subjects', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn<() => Promise<{ data: unknown[]; error: null }>>().mockResolvedValue({
          data: [
            {
              id: 'curr-1',
              tenant_id: tenantId,
              code: 'MOET_STANDARD',
              name: 'Chương trình GDMN Chuẩn',
              description: 'Chuẩn Bộ GD&ĐT',
              age_group: 'ALL',
              academic_year: '2026-2027',
              total_weeks: 35,
              status: 'ACTIVE',
              subjects_payload: [
                { code: 'THE_CHAT', name: 'Thể dục sáng', domain: 'Thể chất', weeklyPeriods: 3, color: 'bg-emerald-50' },
              ],
              created_at: '2026-09-01T00:00:00Z',
              updated_at: '2026-09-01T00:00:00Z',
            },
          ],
          error: null,
        }),
      };

      mockSupabase = {
        from: jest.fn().mockReturnValue(mockQuery),
      };

      service = new CurriculumService(mockSupabase as never);

      const result = await service.listCurriculums(tenantId);
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('MOET_STANDARD');
      expect(result[0].subjects).toHaveLength(1);
      expect(result[0].subjects[0].name).toBe('Thể dục sáng');
    });

    it('validates required fields when saving curriculum', async () => {
      service = new CurriculumService({} as never);

      const resNoTenant = await service.saveCurriculum('', {
        code: 'TEST',
        name: 'Test',
        status: 'ACTIVE',
        subjects: [],
      });
      expect(resNoTenant.success).toBe(false);
      expect(resNoTenant.error).toBe('TENANT_REQUIRED');

      const resNoName = await service.saveCurriculum(tenantId, {
        code: 'TEST',
        name: '',
        status: 'ACTIVE',
        subjects: [],
      });
      expect(resNoName.success).toBe(false);
      expect(resNoName.error).toBe('NAME_REQUIRED');
    });
  });

  describe('Lesson Plans', () => {
    const validPlan: SaveLessonPlanInput = {
      weekNumber: 44,
      year: 2026,
      academicYear: '2026-2027',
      theme: 'Thế giới động vật',
      subjectDomain: 'Phát triển Thể chất',
      title: 'Bật qua vật cản 15-20cm',
      plannedDate: '2026-10-26',
      status: 'APPROVED',
      objectives: {
        knowledge: 'Trẻ biết cách nhún bật qua vật cản',
        skills: 'Rèn luyện cơ chân và khả năng định hướng',
        attitude: 'Trẻ hào hứng tham gia vận động',
      },
      materials: 'Vật cản xốp, vạch xuất phát, nhạc sôi động',
      activitySteps: [
        {
          stepNumber: 1,
          stepName: '1. Khởi động',
          durationMinutes: 5,
          teacherAction: 'Cho trẻ đi vòng tròn theo nhạc',
          childrenAction: 'Đi các kiểu chân theo hiệu lệnh',
        },
      ],
    };

    it('validates lesson plan fields', async () => {
      service = new CurriculumService({} as never);

      const resNoTitle = await service.saveLessonPlan(tenantId, actorId, { ...validPlan, title: '' });
      expect(resNoTitle.success).toBe(false);
      expect(resNoTitle.error).toBe('TITLE_REQUIRED');

      const resNoDate = await service.saveLessonPlan(tenantId, actorId, { ...validPlan, plannedDate: 'invalid' });
      expect(resNoDate.success).toBe(false);
      expect(resNoDate.error).toBe('INVALID_DATE');
    });

    it('saves a new lesson plan successfully', async () => {
      const mockInsertSingle = jest.fn<() => Promise<{ data: { id: string }; error: null }>>().mockResolvedValue({
        data: { id: 'created-plan-uuid' },
        error: null,
      });

      mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: mockInsertSingle,
            }),
          }),
        }),
      };

      service = new CurriculumService(mockSupabase as never);

      const result = await service.saveLessonPlan(tenantId, actorId, validPlan);
      expect(result.success).toBe(true);
      expect(result.id).toBe('created-plan-uuid');
    });

    it('deletes a lesson plan', async () => {
      const mockEq2 = jest.fn<() => Promise<{ error: null }>>().mockResolvedValue({ error: null });
      const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq1 });

      mockSupabase = {
        from: jest.fn().mockReturnValue({ delete: mockDelete }),
      };

      service = new CurriculumService(mockSupabase as never);

      const result = await service.deleteLessonPlan(tenantId, 'plan-to-delete');
      expect(result.success).toBe(true);
    });
  });
});

