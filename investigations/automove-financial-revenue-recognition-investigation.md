# Investigation: AutoMove Financial Revenue Recognition

## Hand-off Brief

1. **What happened.** After PR #318, AutoMove no longer emits invalid `PACKAGE_SALE` from booking/deposit producer, but vehicle sale revenue recognition remains unproven.
2. **Where the case stands.** Status: Concluded for repository trace; stronghold is PR #318 merge commit `fdcd3dca84c6f8caedeeeb8ba65972f61a17bf57` on `main`.
3. **What's needed next.** Treat vehicle sale revenue recognition as a product capability gap requiring an approved canonical contract before schema or service implementation.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-10-14 |
| Status | Concluded |
| System | BELLA SPA ERP / AutoMove on `origin/main` |
| Evidence sources | GitHub PR #318, repository source, migrations, generated contracts, tests |

## Problem Statement

The user clarified that PR #318 only fixes mistaken accounting event emission during booking/deposit, and does not prove AutoMove has a complete vehicle sale revenue recognition flow. The investigation must determine whether a separate canonical mechanism exists on `main`.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| PR #318 merge state | Available | Merge commit `fdcd3dca84c6f8caedeeeb8ba65972f61a17bf57` confirmed on `origin/main`. |
| Source code trace | Available | AutoMove, Finance, accounting worker, migrations, generated types, and tests traced. |
| Production DB | Not in scope | No Production access or mutation authorized. |
| E2E DB | Previously audited | Earlier read-only audit found `auto_sales` absent; this case did not re-query DB. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Search for AutoMove sale recognition commands/events/tables | High | Done | No implementation of `sale_revenue_recognized`, `auto_vehicle_sales`, `auto_sale_revenue`, or `auto_sales` schema found in source/migrations/generated types. |
| 2 | Trace booking/delivery/completed state to accounting or reports | High | Done | Booking/deposit/delivery flows update operational state; analytics RPCs use status labels but do not establish accounting recognition. |
| 3 | Trace Finance postings for vehicle sales | High | Done | `PACKAGE_SALE` posts to 3387 deferred revenue; P&L gross revenue reads 511; no AutoMove vehicle sale 511 posting path found. |
| 4 | Record capability gap or proven mechanism | High | Done | Capability gap recorded below. |

## Timeline of Events

| Time | Event | Source | Confidence |
| --- | --- | --- | --- |
| 2026-10-14T03:15:30Z | PR #318 merged to `main` | GitHub PR metadata | Confirmed |

## Confirmed Findings

### Finding 1: PR #318 removed AutoMove booking/deposit `PACKAGE_SALE` emissions

**Evidence.**

- `src/modules/bella-auto/services/AutoSalesProvider.ts:9-12` states booking/deposit updates are not vehicle sale revenue recognition and must not emit `PACKAGE_SALE` until an approved `payment_received / sale_revenue_recognized` contract exists.
- `src/modules/bella-auto/services/AutoSalesProvider.ts:70-89` inserts `auto_bookings` only.
- `src/modules/bella-auto/services/AutoSalesProvider.ts:176-186` updates `deposit_paid`, `payment_status`, and booking `status`.
- `src/modules/bella-auto/services/AutoSalesProvider.ts:192-205` records a customer touchpoint after full deposit and explicitly avoids `PACKAGE_SALE`.
- `src/__tests__/auto-phase4-sales-lead.test.ts:177-186` asserts `AutoSalesProvider` no longer contains `enqueueWithAutoClient` or `PACKAGE_SALE` producer code and includes the P0 contract note.

**Grade:** Confirmed.

### Finding 2: AutoMove route-level booking/deposit flows do not create accounting recognition

**Evidence.**

- `src/app/api/bella-auto/bookings/route.ts:127-144` creates an `auto_bookings` record with `total_price`, `deposit_amount`, and `deposit_paid`.
- `src/app/api/bella-auto/bookings/route.ts:151-160` updates `auto_vehicles.status = 'allocated'` when a VIN is assigned.
- `src/app/api/bella-auto/bookings/[id]/confirm-deposit/route.ts:60-67` updates booking deposit totals and payment status.
- `src/app/api/bella-auto/bookings/[id]/confirm-deposit/route.ts:74-91` inserts `auto_deposits`.
- The same route returns success at `src/app/api/bella-auto/bookings/[id]/confirm-deposit/route.ts:98-109` without enqueuing accounting outbox or revenue recognition.

**Grade:** Confirmed.

### Finding 3: Delivery is operational evidence only, not financial recognition

**Evidence.**

- `src/modules/bella-auto/services/VehicleAllocationService.ts:128-152` confirms delivery by transitioning a vehicle to `delivered`.
- `src/modules/bella-auto/services/VehicleStatusMachineService.ts:108-112` sets `delivered_at`, `delivered_to_customer_id`, and `delivery_notes` when status becomes `delivered`.
- `src/modules/bella-auto/services/VehicleStatusMachineService.ts:121-145` updates `auto_vehicles` and inserts `auto_vehicle_status_logs`; no accounting outbox or sale revenue event is emitted in this transition.

**Grade:** Confirmed.

### Finding 4: Existing schema supports booking/deposit/vehicle lifecycle, but not canonical vehicle sale recognition

**Evidence.**

- `supabase/migrations/20260803240000_create_auto_leads_bookings.sql:38-62` creates `auto_bookings` with `total_price`, deposit fields, `status`, and nullable `accounting_entry_id`.
- `supabase/migrations/20260804310000_create_auto_deposits_tracking.sql:7-30` creates `auto_deposits` for deposit payment history.
- `supabase/migrations/20260803210000_create_auto_vehicles.sql:40-58` creates `list_price`, `cost_price`, lifecycle status, and delivery fields.
- `rg` returned `NO_AUTO_SALES_TYPE` for `auto_sales:` across `src/types/database.types.ts`, `src/types/supabase-generated.ts`, and `src/types/supabase-bella-auto.ts`.
- `rg` returned `NO_AUTO_REVENUE_SCHEMA_MATCH` for `auto_revenue` table creation/generated types.

**Grade:** Confirmed.

### Finding 5: `FinancialReportingService` and warranty validation still reference stale `auto_sales`

**Evidence.**

- `src/modules/bella-auto/services/FinancialReportingService.ts:85-86` declares a legacy client for `auto_sales`.
- `src/modules/bella-auto/services/FinancialReportingService.ts:164-179` reads completed `auto_sales` joined to `auto_vehicles` and expects `purchase_price`.
- `src/modules/bella-auto/services/FinancialReportingService.ts:307-312` and `src/modules/bella-auto/services/FinancialReportingService.ts:407-412` read commission and sale price from `auto_sales`.
- `src/modules/bella-auto/services/WarrantyService.ts:86-87` declares a runtime client for `auto_sales`.
- `src/modules/bella-auto/services/WarrantyService.ts:209-210` reads warranty terms from `auto_sales`.
- Existing proposal already records that `auto_sales` is absent from inspected E2E DB and stale for reporting/warranty (`docs/architecture/AUTOMOVE_FINANCIAL_SOURCE_OF_TRUTH_PROPOSAL_2026_10_14.md:96`, `docs/architecture/AUTOMOVE_FINANCIAL_SOURCE_OF_TRUTH_PROPOSAL_2026_10_14.md:278`).

**Grade:** Confirmed.

### Finding 6: Finance `PACKAGE_SALE` is deferred revenue, not direct AutoMove vehicle sale revenue

**Evidence.**

- `src/app/api/cron/accounting-worker/route.ts:821-832` routes `PACKAGE_SALE` to `RevenueRecognitionService.handlePackageSale` and requires `totalAmount`, `paymentMethod`, and `description`.
- `src/services/revenue-recognition.ts:54-93` posts a valid package sale as debit cash/bank and credit `3387` unearned revenue, with optional VAT.
- `src/services/revenue-recognition.ts:96-166` moves service/session completion to `5113`/`5111` via `SESSION_DONE`, not via AutoMove vehicle delivery.
- `supabase/migrations/20260525150000_accounting_reports.sql:153-161` calculates gross revenue from posted journal lines where account code starts with `511`.
- `supabase/migrations/20260525150000_accounting_reports.sql:395-401` separately reports `3387` as unearned revenue.

**Grade:** Confirmed.

### Finding 7: Analytics RPCs label completed bookings as revenue but do not establish accounting source of truth

**Evidence.**

- `supabase/migrations/20260804320000_analytics_rpcs.sql:106-119` calculates top-model "revenue" from `SUM(b.total_price)` where `b.status = 'completed'` and `v.status = 'delivered'`.
- `supabase/migrations/20260804320000_analytics_rpcs.sql:152-180` calculates monthly "revenue" from completed `auto_bookings.total_price`.
- `docs/architecture/AUTOMOVE_FINANCIAL_SOURCE_OF_TRUTH_PROPOSAL_2026_10_14.md:200-205` explicitly rejects implicit revenue recognition from booking creation, deposit receipt, full payment, vehicle delivery alone, or raw booking status.

**Grade:** Confirmed.

### Finding 8: Rollback/use-case examples mention revenue tables, but they are not canonical evidence

**Evidence.**

- `src/lib/bella-auto/rollback-use-cases/LoanDisbursementRollback.ts:148-164` inserts `auto_revenue`, and `src/lib/bella-auto/rollback-use-cases/LoanDisbursementRollback.ts:206-215` sketches a debit bank / credit revenue accounting record.
- `src/lib/bella-auto/rollback-use-cases/ServiceCompletionRollback.ts:140-153` inserts `auto_revenue`.
- No `auto_revenue` schema or generated type was found (`NO_AUTO_REVENUE_SCHEMA_MATCH`).
- Call-site trace found those rollback use cases referenced by tests and exports, not by a production AutoMove sale recognition route/service.

**Grade:** Confirmed for existence; not proof of canonical runtime capability.

## Deduced Conclusions

1. AutoMove currently has operational booking/deposit/delivery primitives, but not a proven canonical vehicle sale revenue recognition mechanism.
2. `auto_bookings.status = completed`, `auto_vehicles.status = delivered`, or `auto_bookings.total_price` may be useful evidence candidates, but they are not sufficient as accounting source of truth without a recognition command and sale-time snapshots.
3. `FinancialReportingService` remains a stale consumer because its source table/fields (`auto_sales`, `purchase_price`, warranty fields) are not backed by repo schema/generated contracts or the prior E2E DB audit.
4. Existing Finance OS package/session revenue machinery cannot be reused for AutoMove vehicle sale revenue by name alone: `PACKAGE_SALE` records deferred revenue in `3387`, while recognized P&L revenue is read from `511`.
5. The correct next implementation is not a local service patch. It is an approved AutoMove financial source-of-truth contract and then a scoped schema/service batch.

## Hypothesized Paths

### Hypothesis 1: AutoMove has no separate canonical vehicle sale revenue recognition flow on `main`

**Status:** Confirmed by repository trace

**Theory:** Existing code has booking/deposit/delivery states and stale reporting references, but no approved `sale_revenue_recognized` contract or Finance posting path for vehicle sales.

**Supporting indicators:** PR #318 docs keep financial source of truth held and forbid `FinancialReportingService` migration.

**Would confirm:** Exhaustive source/migration/test trace finds no explicit recognition command/event/table or TK511 posting path for AutoMove vehicle sales.

**Would refute:** A concrete service/route/migration/test shows an AutoMove vehicle sale completion event that snapshots revenue/cost basis and posts/feeds recognized revenue reports.

**Resolution:** Confirmed for repository trace on `origin/main` commit `fdcd3dca84c6f8caedeeeb8ba65972f61a17bf57`. Runtime Production DB was not inspected in this case and remains out of scope.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Runtime DB schema for production AutoMove sales objects | Would prove actual deployed tables beyond repo | Out of scope unless separately authorized. |
| Business owner decisions for sale recognition command/cost/warranty | Needed before implementation | Separate contract approval. |
| Approved canonical name/schema for sale recognition object | Needed before migration | Owner/architecture decision. |
| Approved ledger mapping for vehicle sale revenue and cost of goods sold | Needed before Finance integration | Accounting policy evidence and owner approval. |

## Source Code Trace

| Element | Detail |
| --- | --- |
| Error origin | No runtime error; source-of-truth gap investigation. |
| Trigger | User requested continuation after PR #318 clarification. |
| Condition | Vehicle sale revenue recognition is `NOT_PROVEN` after P0 producer fix. |
| Related files | `src/modules/bella-auto/services/AutoSalesProvider.ts`, `src/app/api/bella-auto/bookings/route.ts`, `src/app/api/bella-auto/bookings/[id]/confirm-deposit/route.ts`, `src/modules/bella-auto/services/VehicleAllocationService.ts`, `src/modules/bella-auto/services/VehicleStatusMachineService.ts`, `src/modules/bella-auto/services/FinancialReportingService.ts`, `src/modules/bella-auto/services/WarrantyService.ts`, `src/app/api/cron/accounting-worker/route.ts`, `src/services/revenue-recognition.ts`, `supabase/migrations/20260525150000_accounting_reports.sql`, `supabase/migrations/20260803210000_create_auto_vehicles.sql`, `supabase/migrations/20260803240000_create_auto_leads_bookings.sql`, `supabase/migrations/20260804310000_create_auto_deposits_tracking.sql`, `supabase/migrations/20260804320000_analytics_rpcs.sql` |

## Conclusion

**Confidence:** High for repository trace; Medium for full deployed-system state because Production DB was not queried in this case.

AutoMove does not have a proven canonical vehicle sale revenue recognition flow on `main`. The repo contains booking/deposit tracking, VIN allocation and delivery evidence, analytics that label completed bookings as revenue, stale `auto_sales` consumers, and shared package/session accounting mechanics. It does not contain a canonical `sale_revenue_recognized` command/table/event, sale-time revenue and cost-basis snapshot, warranty entitlement source, or AutoMove vehicle-sale posting path to recognized revenue.

Therefore:

```ini
AUTOMOVE_PACKAGE_SALE_PRODUCER_FIX = PROVEN_ON_MAIN
BOOKING_DEPOSIT_CASH_TRACKING      = EXISTS_PARTIAL
VEHICLE_HANDOVER_EVIDENCE          = EXISTS_OPERATIONAL_ONLY
VEHICLE_SALE_REVENUE_RECOGNITION   = CAPABILITY_GAP_CONFIRMED_BY_REPO_TRACE
AUTO_SALES_SCHEMA_CONTRACT         = NOT_PROVEN
FINANCIAL_REPORTING_SERVICE        = STALE_CONSUMER_HELD
SCHEMA_MIGRATION                   = NOT_AUTHORIZED
PRODUCTION_MUTATION                = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS    = NOT_READY
```

## Recommended Next Steps

### Fix direction

Do not patch `FinancialReportingService` against `auto_bookings` or current `auto_vehicles.cost_price`. Define and approve a canonical AutoMove sale recognition contract first.

### Diagnostic

Remaining diagnostic work requires owner/accounting decisions, not more grep:

1. Approve the command that can emit `sale_revenue_recognized`.
2. Approve the required evidence: booking, delivered VIN, customer, recognized amount, sale-time cost basis, warranty entitlement, actor authority, and idempotency key.
3. Approve ledger semantics for vehicle revenue and cost of goods sold using authoritative accounting evidence.
4. Only then design migration/service changes and E2E/RLS verification.

## Reproduction Plan

Verification plan for future implementation:

1. Non-Production DB migration creates/updates only the approved canonical contract.
2. Happy path: booking + deposit + delivery + explicit recognition command produces recognized sale snapshot and ledger evidence.
3. Negative path: booking only, deposit only, full payment only, and delivery only do not produce recognized vehicle sale revenue.
4. Cost basis remains historical after later `auto_vehicles.cost_price` changes.
5. Warranty entitlement reads from the recognized sale contract, not stale `auto_sales`.

## Side Findings

1. `src/lib/accounting-outbox.ts:4-7` still contains a comment saying `createBooking, recordRemainingPayment -> PACKAGE_SALE`. The active AutoMove provider no longer does this after PR #318, so this appears stale. Do not treat it as runtime evidence.
2. `src/lib/business-rules/financial-integrity.ts:93-120` and `src/services/reconciliation-actions.ts:348-361` still model package/service `revenue` records with `PACKAGE_SALE` side effects. That is shared/service finance behavior, not a proven AutoMove vehicle sale recognition contract.
3. `src/platform/mobility/__tests__/automove-available-vehicles-contract.test.ts:133` expects warranty validation source to contain `.from('auto_sales')`, which preserves the known stale boundary rather than proving the schema is valid.
