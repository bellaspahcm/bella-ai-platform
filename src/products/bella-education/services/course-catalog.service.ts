/**
 * BELLA EDUCATION — COURSE CATALOG PRODUCT SERVICE
 *
 * Handles academic course registries and prerequisites displays.
 * Consumes the public IEducationCourseContract without direct DB access.
 *
 * @module src/products/bella-education/services/course-catalog.service
 */

import { IEducationCourseContract, EducationCourseDTO } from '../../../platform/education/contracts/course.contract';
import {
  type CreateCanonicalCourseInput,
  type CreatedCanonicalCourse,
  type ICanonicalCourseCommandContract,
} from '../../../platform/education/contracts/canonical-course-catalog.contract';
import { bellaEducationManifest } from '../manifest';

export class CourseCatalogProductService {
  constructor(private readonly courseContract: IEducationCourseContract) {}

  private assertCapability(capabilityId: string) {
    const capabilities = bellaEducationManifest.capabilities || [];
    if (!capabilities.includes(capabilityId)) {
      throw new Error(`MANIFEST_VIOLATION: Capability '${capabilityId}' is not enabled in product manifest.`);
    }
  }

  /**
   * Retrieves all courses for a given tenant.
   */
  async getCourses(tenantId: string): Promise<readonly EducationCourseDTO[]> {
    this.assertCapability('course_catalog_query');
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');

    return this.courseContract.listCourses(tenantId);
  }
}

/** Preschool Product application service; it delegates writes to Education's public command. */
export class PreschoolClassroomCommandProductService {
  constructor(private readonly courseCommand: ICanonicalCourseCommandContract) {}

  async createCourse(input: CreateCanonicalCourseInput): Promise<CreatedCanonicalCourse> {
    if (!bellaEducationManifest.capabilities?.includes('preschool_classroom_create')) {
      throw new Error("MANIFEST_VIOLATION: Capability 'preschool_classroom_create' is not enabled in product manifest.");
    }
    return this.courseCommand.createCourse(input);
  }
}
