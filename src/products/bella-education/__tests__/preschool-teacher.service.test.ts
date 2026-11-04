import { describe, expect, it, jest } from '@jest/globals';
import type { ICanonicalPreschoolAdminCourseReadContract } from '@/platform/education/contracts/canonical-course-catalog.contract';
import type { IPreschoolTeacherContract, PreschoolTeacherContext } from '@/platform/education/contracts/teacher-assignment.contract';
import type { PreschoolChainService } from '../services/preschool-chain.service';
import { PreschoolTeacherProductService } from '../services/preschool-teacher.service';

const context: PreschoolTeacherContext = {
  tenantId: '00000000-0000-4000-8000-000000000001',
  actorId: '00000000-0000-4000-8000-000000000002',
  branchId: '00000000-0000-4000-8000-000000000003',
};

describe('PreschoolTeacherProductService class list', () => {
  it('uses the admin Preschool read contract and returns only active classes mapped to the selected branch', async () => {
    const listCourseAssignments = jest.fn(async () => [
      { tenant_id: context.tenantId, branch_id: context.branchId, course_id: 'active-course' },
      { tenant_id: context.tenantId, branch_id: context.branchId, course_id: 'archived-course' },
    ]);
    const listPreschoolAdminCourses = jest.fn(async () => [
      { id: 'active-course', tenantId: context.tenantId, courseCode: 'MAM-1', title: 'Lớp Mầm 1', status: 'active' as const },
      { id: 'archived-course', tenantId: context.tenantId, courseCode: 'MAM-0', title: 'Lớp cũ', status: 'archived' as const },
      { id: 'unmapped-course', tenantId: context.tenantId, courseCode: 'CHOI-1', title: 'Lớp Chồi 1', status: 'active' as const },
    ]);
    const teachers = {} as unknown as IPreschoolTeacherContract;
    const branchCourses = { listCourseAssignments } as unknown as Pick<PreschoolChainService, 'listCourseAssignments'>;
    const catalog = {
      listPreschoolAdminCourses,
      getPreschoolAdminCourse: jest.fn(),
    } as ICanonicalPreschoolAdminCourseReadContract;
    const service = new PreschoolTeacherProductService(teachers, branchCourses, catalog);

    await expect(service.listMappedClasses(context)).resolves.toEqual([
      { id: 'active-course', code: 'MAM-1', title: 'Lớp Mầm 1' },
    ]);
    expect(listCourseAssignments).toHaveBeenCalledWith(context.tenantId, context.actorId, context.branchId);
    expect(listPreschoolAdminCourses).toHaveBeenCalledWith(context.tenantId);
  });

  it('fails closed when a branch mapping points to a class outside the verified tenant catalog', async () => {
    const listCourseAssignments = jest.fn(async () => [
      { tenant_id: context.tenantId, branch_id: context.branchId, course_id: 'unresolved-course' },
    ]);
    const catalog = {
      listPreschoolAdminCourses: jest.fn(async () => []),
      getPreschoolAdminCourse: jest.fn(),
    } as ICanonicalPreschoolAdminCourseReadContract;
    const service = new PreschoolTeacherProductService(
      {} as unknown as IPreschoolTeacherContract,
      { listCourseAssignments } as unknown as Pick<PreschoolChainService, 'listCourseAssignments'>,
      catalog,
    );

    await expect(service.listMappedClasses(context)).rejects.toThrow('PRESCHOOL_TEACHER_CLASS_MAPPING_UNAVAILABLE');
  });
});
