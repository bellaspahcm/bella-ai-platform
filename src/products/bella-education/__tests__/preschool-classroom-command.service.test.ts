import { describe, expect, it, jest } from '@jest/globals';
import type { CreateCanonicalCourseInput, CreatedCanonicalCourse } from '@/platform/education/contracts/canonical-course-catalog.contract';
import { PreschoolClassroomCommandProductService } from '../services/course-catalog.service';
import { bellaEducationManifest } from '../manifest';

const input: CreateCanonicalCourseInput = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  actorId: '00000000-0000-4000-8000-000000000002',
  branchId: '00000000-0000-4000-8000-000000000003',
  operationKey: '00000000-0000-4000-8000-000000000004',
  courseCode: 'CLASS-01',
  title: 'Lớp mẫu',
};
const created: CreatedCanonicalCourse = {
  id: '00000000-0000-4000-8000-000000000005',
  tenantId: input.tenantId,
  branchId: input.branchId,
  operationKey: input.operationKey,
  courseCode: input.courseCode,
  title: input.title,
  status: 'active',
};

describe('PreschoolClassroomCommandProductService', () => {
  it('declares the create capability and delegates to Education public command', async () => {
    const createCourse = jest.fn<(value: CreateCanonicalCourseInput) => Promise<CreatedCanonicalCourse>>().mockResolvedValue(created);
    const service = new PreschoolClassroomCommandProductService({ createCourse });

    await expect(service.createCourse(input)).resolves.toEqual(created);
    expect(bellaEducationManifest.capabilities).toContain('preschool_classroom_create');
    expect(createCourse).toHaveBeenCalledWith(input);
  });
});
