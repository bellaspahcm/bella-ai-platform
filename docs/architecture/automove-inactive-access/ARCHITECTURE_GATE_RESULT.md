# AutoMove Active Identity Access - Architecture Gate

Date: 2026-10-15
Baseline: `5779c5f75489f79a9c9103d89f2c621592fc90f3` (sealed PR #334).

## 1. Development Process And Business Semantics

Result: **PASS for the approved, limited Non-Production implementation**.
The owner approved the target baseline: Supabase Auth identifies the actor;
current `public.users` and `public.tenants` must both be active and own the row.
JWT metadata cannot override that authority. HQ is identified by `product_key =
bella_hq`, with no implicit AutoMove bypass. This is target-contract approval,
not proof that shared helpers or the existing database already implement it.

The preceding two-tenant rollback probe proved inactive actors could SELECT
vehicles/leads/bookings/deposits and UPDATE leads/bookings/deposits. Suspending
the owning tenant also left those rows readable. Catalog guards already denied
these cases. No accounting semantics change is required.

## 2. Product Manifest

One goal: deny the proven invalid-identity access without disrupting valid
active-tenant sales operations. Add restrictive SELECT guards on exactly
`auto_vehicles`, `auto_leads`, `auto_bookings`, `auto_deposits`; add restrictive
UPDATE guards on exactly the latter three tables. No new ProductRegistry entry.

## 3. Ownership Map

- Platform owns Supabase Auth, `public.users`, `public.tenants`, shared helpers
  and HQ classification. Those definitions are read-only dependencies here.
- Mobility owns vehicle data and its public contract. The vehicle change is
  only the approved database SELECT boundary, not lifecycle behavior.
- AutoMove owns the three sales tables and this scoped policy/verifier change.

## 4. Contract Dependency Map

`AutoMove -> existing Mobility/public sales contracts -> PostgreSQL RLS`.
The new guard intersects existing permissive policies with a live
`auth.uid() -> users -> tenants` predicate. It neither replaces shared helpers
nor grants authority when legacy helpers refuse access.

## 5. Change Authority

Authorized: one forward policy migration; scoped runtime verifier; migration
tests and CI selection; Non-Production verification using two controlled
tenants. Rehearse migration and fixtures inside one rollback transaction.
Not authorized: shared helper/identity changes, Production access or mutation,
bootstrap, Finance posting, refund/cancellation rules, Warranty, commission,
Logistics/Healthcare/Education kernels. The owner subsequently authorized
durable application of this one migration on E2E, verification, then PR/CI.
Production deployment remains unauthorized.

## 6. UI To Contract Reconciliation

No UI/API change. Valid active actors retain existing contract behavior.
Denied SELECT returns no protected rows; denied UPDATE affects no rows or
fails RLS checks. SQL JWT-context tests are not signed-token/browser proof.

## 7. Forward Migration Plan

`20261015030000_guard_automove_active_identity_access.sql` adds seven named
restrictive policies. Require existing tables, enabled RLS and permissive
policies first; fail closed on unmet dependencies. Preserve existing policies,
ACLs, INSERT/DELETE rules, helpers and historical migrations. UPDATE uses both
USING and WITH CHECK. Repeat application must be deterministic.

## 8. Eleven Verification Gates

1. Scope: only the approved four SELECT and three UPDATE boundaries.
2. Authority: Auth subject and current active profile/tenant, no JWT/HQ bypass.
3. Positive reads: each active actor reads its own fixture rows only.
4. Positive writes: active actors persist valid own-row updates.
5. Tenant isolation: cross-tenant reads, updates and reassignment denied.
6. Invalid identity: inactive, missing profile, missing tenant and no subject denied.
7. Tenant state: suspended/terminated owning tenant denied.
8. Anonymous access: denied; existing ACLs and other policies unchanged.
9. Migration: preconditions, repeated application and complete DDL rollback.
10. Regression: focused tests, strict typecheck, lint, migration/architecture guards.
11. Evidence: runtime assertions plus zero remaining fixtures after rollback.

## Checkpoint And Executed Evidence

- Before migration, the repeatable baseline probe found 30 failing assertions
  out of 124, including actual unauthorized persisted UPDATEs for inactive
  actors and suspended/terminated tenants. Its fixtures were fully rolled back.
- After migration rehearsal, 131 runtime assertions passed on exactly two
  controlled E2E tenants. The file was executed twice in the same transaction.
  Positive SELECT/UPDATE, negative identity/tenant cases, SQL claim conflicts,
  HQ non-bypass, reassignment, anonymous access and DELETE denial were exercised.
- Existing booking/allocation and partial-deposit commands ran on that same
  guarded database transaction. Booking retry preserved allocation; deposit
  retry left one receipt and one balance increment.
- Rollback restored the full original policy definitions, table/column ACLs,
  RLS flags, owners and shared helpers. Zero fixture identities, tenants,
  business rows, Mobility events, status logs or idempotency rows remained.
- Local regression: 17 suites / 182 tests PASS, zero skipped tests reported.
- Scoped strict TypeScript: zero diagnostics; ESLint, Architecture Guard,
  zero-downtime check for the one new migration, `git diff --check` and explicit
  seven-file whitespace/conflict validation PASS.
- The actual CI selector was executed locally for the new migration; it ran
  the rollback verifier with all 131 runtime assertions PASS. This is not a
  GitHub Actions/main result. Final diff self-review found no local blocker.

The previous sales-chain verifier now checks exactly its three original
permissive policies; the new verifier separately proves restrictive guards.
CI selection now requires durable migration history and existing guard policies,
then rolls back only test fixtures. It does not replay DDL or silently skip the
runtime verification. No remote CI result is claimed yet.

Verification command (with approved E2E environment loaded process-only):

```powershell
$env:ALLOW_E2E_ACTIVE_IDENTITY_VERIFICATION = '1'
npx tsx scripts/verify-automove-active-identity-access.ts
```

## Durable E2E Application And Verification

Following explicit owner approval, only migration `20261015030000` was applied
using the existing `scripts/apply-e2e-pr-migrations.cjs --files` execution/history
mechanism, with verified TLS and an outer transaction. Commit succeeded after
checking exactly seven restrictive policies and unchanged helpers, existing
policies, owners, RLS flags and table/column ACLs.

Migration SHA-256:
`b3f90e3a740aa8e13711a67285d1b4b040fb130f5f8a5e58e9d3a75a4fbd45ef`.

A fresh connection ran the verifier without `--test-migration`: durable history
was required, all 131 runtime assertions passed, including active/inactive,
tenant isolation, suspended/terminated tenants and valid booking/deposit retry.
Only fixtures were rolled back; applied policies remain in effect. Fixture
cleanup was proven with zero remaining records for the two controlled tenants.
No entire 182-test rerun was needed for this operational application.

```ini
TARGET_IDENTITY_BASELINE = OWNER_APPROVED
ACTIVE_IDENTITY_GUARD = PROVEN_ON_DURABLE_E2E
DURABLE_E2E_MIGRATION = APPLIED_AND_RECORDED
CANONICAL_SHARED_HELPER_ALIGNMENT = NOT_PROVEN
PR_CI_MAIN_SEAL = PENDING
PRODUCTION_ACCESS_AND_MUTATION = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY
GO_LIVE = NOT_PROVEN
```

No global baseline reconciliation, Browser E2E, all-write-operation or Go-Live
claim is made. Shared helper discrepancies remain a separate Platform boundary.
