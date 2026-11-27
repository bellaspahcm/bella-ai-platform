# Approved Core Change - Accounting TT99 Full COA Expansion

Status: APPROVED, limited to the repository owner's explicit conversation approval to expand the shared Core Accounting Chart of Accounts and profile to support Circular 99/2025/TT-BTC (`TT99`). This records existing authority for the machine guard; it does not modify frozen Healthcare/Logistics kernels or `src/platform/finance/`.

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-026",
  "status": "APPROVED",
  "pr": 616,
  "approvedCoreFiles": [
    "src/core/services/accounting/__tests__/tt99-coa.test.ts",
    "src/core/services/accounting/coa.ts",
    "src/core/services/accounting/tt99-coa.ts",
    "src/core/services/accounting/types.ts"
  ],
  "approver": "Repository owner via explicit conversation approval",
  "approvedDate": "2026-11-27",
  "purpose": "Expand Core Platform Accounting COA catalog, seeding action, and standard_profile type to support Circular 99/2025/TT-BTC (TT99) while keeping existing TT133/TT200 behavior and src/platform/finance/ intact.",
  "contractChange": true,
  "schemaChange": true,
  "rpcChange": false,
  "apiChange": true,
  "ownershipChange": false
}
-->

## Authority And Boundary

The repository owner explicitly approved expanding the shared Core Accounting Chart of Accounts (`src/core/services/accounting/`) to support Circular 99/2025/TT-BTC (`TT99`), reusing Core Accounting across verticals including Bella Interior.

- Additive only: adds `TT99_FULL_COA_CATALOG` (`src/core/services/accounting/tt99-coa.ts`), idempotent tenant-isolated `seedTT99ChartOfAccounts()` (`src/core/services/accounting/coa.ts`), `'TT99'` in `AccountingStandardProfile` (`src/core/services/accounting/types.ts`), and unit tests (`src/core/services/accounting/__tests__/tt99-coa.test.ts`).
- Preserves existing `TT133` and `TT200` profiles, RLS tenant isolation (`accounting_accounts`), and admin/super_admin RBAC checks.
- Does not modify `src/platform/finance/` or any frozen Healthcare (`H1-H12`) / Logistics (`E7.1-E7.3`) kernel artifacts.

## Verification And Rollback

- Local typecheck (`node scripts/ci-run-typecheck.mjs changed`) passed with zero diagnostics.
- Local unit tests (`tt99-coa.test.ts` and `accounting-engine.test.ts`, 23 tests) passed.
- Core Freeze verification must match this exact 4-file `src/core/` set and PR #616.
- Rollback: revert PR #616; the additive migration only extends the `accounting_event_templates_standard_profile_check` constraint and seeds `TT99` templates.
