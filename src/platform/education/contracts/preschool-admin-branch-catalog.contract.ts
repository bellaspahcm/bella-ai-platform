export interface PreschoolAdminBranchCatalogItem {
  readonly id: string;
  readonly name: string;
}

/** Read-only current-caller branch catalog for an active Preschool administrator. */
export interface IPreschoolAdminBranchCatalogContract {
  listCurrentPreschoolAdminBranches(): Promise<readonly PreschoolAdminBranchCatalogItem[]>;
}
