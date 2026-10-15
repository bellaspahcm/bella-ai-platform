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

## Bella Test Origin

Live read-only inspection of the database configured for localhost proved:

- `public.users` has an existing staff record named Bella Test, role `ktv`,
  status `active`, created 2026-07-19.
- It belongs to the same tenant as the screenshot booking and Cao Thi Thuy Van.
  Stored tenant name is Bella Spa Headquarter, product key `bella_babycare`.
- No matching `auth.users.id` exists for Bella Test. The real assigned technician
  does have a matching Auth identity.
- `autoAssignKtv` in `src/services/booking-decision.service.ts` reads candidate
  `users` filtered by input tenant, role `ktv`, status `active`. It does not verify
  Auth identity. Thus the name is persisted staff data, not a fabricated UI name
  or a cross-tenant candidate in this case.
- The staff management UI is Settings -> Nhan su & Quyen. The suggestion filter,
  ranking, staff records, Auth accounts and permissions are not changed by this
  batch. No staff cleanup or provisioning was authorized/performed.

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

No migrations, DB privileges/RLS/RPC/trigger changes, financial earning-policy
changes, staff cleanup or AI changes. Direct DB privilege enforcement, concurrent
production mutation tests, refund/reconfirmation loyalty correctness, authenticated
Production UI E2E and Go-Live are not proven by this application-boundary repair.
