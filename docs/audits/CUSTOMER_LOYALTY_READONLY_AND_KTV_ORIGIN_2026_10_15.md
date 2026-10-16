# Customer Loyalty Read-Only and KTV Origin

Date: 2026-10-15
Authority: user requires automatically calculated loyalty not be manually edited;
asks why Bella Test appears as an AI technician suggestion.

## Loyalty Repair

- Live read-only inspection proved the enabled `revenue` trigger
  `trg_calculate_loyalty_points` calls `tr_calculate_loyalty_points`, which calls
  `increment_loyalty_points` on confirmed booking revenue, floor(amount/100000).
- The persisted balances for the five supplied screenshot customers match the
  sum of points from current confirmed positive receipts.
- BabyCare/Beauty customer edit modal now renders a readonly output supplied from
  the persisted customer, not an input. Points are absent from editor state and
  therefore from its save payload.
- Shared customer create/update actions omit client-supplied `loyalty_points`,
  including stale clients and tampered requests. Other profile fields and tenant
  filters retain existing behavior. Audit-failure rollback excludes the old
  points snapshot, so it cannot overwrite concurrently accrued points.
- The legacy exported `addLoyaltyPoints` action has no runtime callers (only its
  unit test). It now rejects without invoking a database RPC. Confirmed-revenue
  trigger accrual remains unchanged.

## Bella Test Origin - Initial Investigation

Live read-only inspection of the database configured for localhost proved:

- `public.users` has an existing staff record named Bella Test, role `ktv`,
  status `active`, created 2026-07-19.
- It belongs to the same tenant as the screenshot booking and Cao Thi Thuy Van.
  Stored tenant name is Bella Spa Headquarter, product key `bella_babycare`.
- No matching `auth.users.id` exists for Bella Test. The real assigned technician
  does have a matching Auth identity.
- At initial investigation, `autoAssignKtv` in `src/services/booking-decision.service.ts` read candidate
  `users` filtered by input tenant, role `ktv`, status `active`. It does not verify
  Auth identity. Thus the name is persisted staff data, not a fabricated UI name
  or a cross-tenant candidate in this case.
- The staff management UI is Settings -> Nhan su & Quyen. The initial loyalty
  delivery did not change the suggestion filter. No staff cleanup or provisioning
  was authorized/performed. The subsequently authorized filter repair is below.

## Verification

- 3 focused Jest suites / 32 tests passed: customer actions, BabyCare/Beauty
  customer card/modal, and customer page. Covers nonzero/null points display,
  immutable control, create/update tampering, direct increment denial, rollback,
  editable ordinary fields and existing tenant isolation assertions.
- Full TypeScript: zero diagnostics.
- Changed-file ESLint: passed; existing CLI `.eslintignore` deprecation only.
- Architecture Guard and `git diff --check`: passed.
- Actual editor component + actual global CSS + theme resolver browser fixtures:
  BabyCare/Beauty at 1440px and 390px. All four cases show readonly 45 points,
  allow notes editing, and submit without `loyalty_points`; no horizontal document
  overflow or page errors. Screenshots inspected. Fixture save callback is not a
  persisted database write.
- Production inspection used `BEGIN READ ONLY`. No customer, staff, revenue,
  Auth or other Production record was modified.

## Boundaries

The initial loyalty delivery made no migrations, DB privileges/RLS/RPC/trigger,
financial earning-policy, staff cleanup or AI changes. Direct DB privilege enforcement, concurrent
production mutation tests, refund/reconfirmation loyalty correctness, authenticated
Production UI E2E and Go-Live are not proven by this application-boundary repair.

## Authorized Follow-Up - Official AI Technician Accounts

User authority: AI may only recommend KTVs with officially assigned login accounts.

Root cause: candidate queries checked role/status/tenant only. The apply action
also trusted the supplied KTV ID without rechecking account eligibility.

- Added a booking-local, server-only eligibility helper, reusing the existing
  Auth Admin `getUserById` API and `@bella/shared` technician/admin role contracts.
- Identity eligibility requires matching Auth/profile ID, same tenant, officially
  assigned `ktv` / `ktv_lead` role, active status, no resignation, and an Auth
  identity that is not deleted, anonymous or currently banned. Expired bans allow
  restored accounts. Names and user-editable metadata do not confer eligibility.
- Caller tenant is checked against `getCurrentUser`; the caller's active profile
  and role are reread from the database, not assumed from the cached user shape.
- The caller-scoped Supabase client reads profiles. Admin credentials verify
  candidate Auth identities only; no privileged profile reads/writes in runtime.
- Filter before workload queries and ranking so invalid staff cannot occupy the
  top slots, appear as alternatives, or win via customer preference.
- Applying a suggestion requires a current tenant admin, tenant-owned booking,
  and fresh selected-KTV eligibility. Stale/tampered selections cause no update.
- Missing verifier configuration or unexpected Auth failures fail closed. A 404
  missing identity is excluded without hiding other valid candidates.
- Ranking scores, capacity algorithms, manual non-AI assignment paths, staff
  data/provisioning, Auth/RLS/Platform/branch contracts and schemas are unchanged.

Fresh evidence:
- 6 focused Jest suites / 95 tests passed, including the existing loyalty tests.
  Actual helper -> assignment provider -> suggestion action is exercised with
  table-aware DB mocks and mocked Auth responses. Orphan/invalid identities never
  reach the provider; missing verification cannot produce unverified candidates.
- Full TypeScript: zero diagnostics after reading caller status through the
  canonical profile contract (no changes to shared/generated user types).
- Read-only live Auth Admin API inspection confirms Bella Test has no matching
  identity and is ineligible; Cao Thi Thuy Van has a matching identity and remains
  eligible. No employee/profile/account/booking was modified for this inspection.
- Live inspection used privileged read access for support evidence, not an
  authenticated RLS/browser E2E. No claim of production assignment mutation,
  atomic Auth/profile revocation, full RLS proof or Go-Live readiness.
- The older `booking-flow.integration` seed creates public staff without Auth
  identities and uses a mocked actor. It was not executed against Production;
  those fixtures are not positive evidence for this stricter account invariant.
  A complete authenticated Real DB booking-chain run remains NOT_PROVEN here.
