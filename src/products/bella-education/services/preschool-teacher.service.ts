import type { ICanonicalCourseCatalogContract } from '@/platform/education/contracts/canonical-course-catalog.contract';
import type {
  IPreschoolTeacherContract, PreschoolTeacherContext,
} from '@/platform/education/contracts/teacher-assignment.contract';
import type { PreschoolChainService } from './preschool-chain.service';
import { bellaEducationManifest } from '../manifest';

type BranchCourseAssignments = Pick<PreschoolChainService, 'listCourseAssignments'>;

/** Preschool workflow boundary; Education owns assignment and Party candidate RPC parsing. */
export class PreschoolTeacherProductService {
  constructor(
    private readonly teachers: IPreschoolTeacherContract,
    private readonly branchCourses: BranchCourseAssignments,
    private readonly catalog: ICanonicalCourseCatalogContract,
  ) {}

  private assertCapability(): void {
    if (!bellaEducationManifest.enabledCapabilities?.includes('preschool_teacher_management')) {
      throw new Error('PRESCHOOL_TEACHER_CAPABILITY_DISABLED');
    }
  }

  async listMappedClasses(context: PreschoolTeacherContext) {
    this.assertCapability();
    const [mappings, courses] = await Promise.all([
      this.branchCourses.listCourseAssignments(context.tenantId, context.actorId, context.branchId),
      this.catalog.listCourses(context.tenantId),
    ]);
    const byId = new Map(courses.map(course => [course.id, course]));
    if (mappings.some(mapping => mapping.tenant_id !== context.tenantId
      || mapping.branch_id !== context.branchId || !byId.has(mapping.course_id))) {
      throw new Error('PRESCHOOL_TEACHER_CLASS_MAPPING_UNAVAILABLE');
    }
    return mappings.map(mapping => byId.get(mapping.course_id))
      .filter((course): course is NonNullable<typeof course> => course !== undefined && course.status === 'active')
      .map(course => ({ id: course.id, code: course.courseCode, title: course.title }));
  }

  listCandidates(context: PreschoolTeacherContext, query: string, confirmedOnly: boolean,
    onDate: string, offset: number, limit: number) {
    this.assertCapability();
    return this.teachers.listCandidates(context, query, confirmedOnly, onDate, offset, limit);
  }

  confirm(context: PreschoolTeacherContext, input: Parameters<IPreschoolTeacherContract['confirm']>[1]) {
    this.assertCapability();
    return this.teachers.confirm(context, input);
  }

  revoke(context: PreschoolTeacherContext, input: Parameters<IPreschoolTeacherContract['revoke']>[1]) {
    this.assertCapability();
    return this.teachers.revoke(context, input);
  }

  assign(context: PreschoolTeacherContext, input: Parameters<IPreschoolTeacherContract['assign']>[1]) {
    this.assertCapability();
    return this.teachers.assign(context, input);
  }

  listCourseTeachers(context: PreschoolTeacherContext, courseId: string,
    onDate: string, offset: number, limit: number) {
    this.assertCapability();
    return this.teachers.listCourseTeachers(context, courseId, onDate, offset, limit);
  }

  terminate(context: PreschoolTeacherContext, input: Parameters<IPreschoolTeacherContract['terminate']>[1]) {
    this.assertCapability();
    return this.teachers.terminate(context, input);
  }
}
