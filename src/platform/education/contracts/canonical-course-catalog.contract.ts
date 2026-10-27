/** Minimal identity from canonical Education courses; no legacy Training projection. */
export interface CanonicalCourseCatalogItem {
  readonly id: string;
  readonly tenantId: string;
  readonly courseCode: string;
  readonly title: string;
  readonly status: 'draft' | 'active' | 'archived';
}

export interface ICanonicalCourseCatalogContract {
  listCourses(tenantId: string): Promise<readonly CanonicalCourseCatalogItem[]>;
}

export interface CreateCanonicalCourseInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly operationKey: string;
  readonly branchId: string;
  readonly courseCode: string;
  readonly title: string;
}

export interface CreatedCanonicalCourse extends CanonicalCourseCatalogItem {
  readonly branchId: string;
  readonly operationKey: string;
}

export interface ICanonicalCourseCommandContract {
  createCourse(input: CreateCanonicalCourseInput): Promise<CreatedCanonicalCourse>;
}

export class CanonicalCourseCommandError extends Error {
  constructor(readonly code: 'CANONICAL_COURSE_INVALID_REQUEST' | 'CANONICAL_COURSE_ACCESS_DENIED'
    | 'CANONICAL_COURSE_CONFLICT' | 'CANONICAL_COURSE_UNAVAILABLE', readonly status: 400 | 403 | 409 | 503) {
    super(code);
    this.name = 'CanonicalCourseCommandError';
  }
}
