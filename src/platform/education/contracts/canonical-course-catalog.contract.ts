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
