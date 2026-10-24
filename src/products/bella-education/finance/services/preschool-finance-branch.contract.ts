/** Product public branch surface. Actor/tenant must come from validated Auth. */
export const FINANCE_BRANCH_READ_RPC = 'preschool_finance_read_branch';
export const FINANCE_BRANCH_COMMAND_RPC = 'preschool_finance_branch_command';

export interface FinanceBranchContext {
  readonly tenantId: string;
  readonly actorId: string;
  readonly branchId: string;
}

export interface FinanceBranchOption {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
}

export interface FinanceBranchStudent {
  readonly enrollmentId: string;
  readonly courseId: string;
  readonly studentPartyId: string;
  readonly studentId: string;
  readonly studentCode: string;
  readonly displayName: string;
}

// The server-only RPC owns role/branch/mapping checks and final writes after
// locks. Directory reads never select a branch, even when there is only one.
// Tenant billing-period configuration is a catalog, not branch assignment.
// The global service-period completion action is unavailable in this contract.
