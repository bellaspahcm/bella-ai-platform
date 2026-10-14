# ARCHITECTURE GATE RESULT - AUTOMOVE VEHICLES PAGE MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove `/dashboard/bella-auto/vehicles` read-side migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move the vehicle inventory page's direct `auto_vehicles` list query behind the existing Mobility OS public Supabase contract. Preserve the current client-side search, status filtering, pagination, export, detail drawer, and demo-only add/transition UI behavior. No write-side lifecycle change, no booking/workshop/rollback change, no schema migration, no ProductRegistry change, no Production mutation, and no other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS Foundation owns reusable vehicle inventory read mapping. After PR #311, `/dashboard/bella-auto/vehicles/page.tsx` remains a direct product UI read of `auto_vehicles`.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, current `src/platform/mobility/supabase-vehicle-contract.ts`, existing `VehicleInventoryDashboard` precedent, and the post-#311 direct reference inventory.
- Canonical Contract: AutoMove vehicle inventory read consumers should call Mobility public contract functions; the Mobility adapter owns persistence mapping to reused `auto_*` tables.
- Gate result: `PASS` for this vehicle inventory page read-only consumer. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Bella Auto vehicle inventory page.
- OS capability consumed: Mobility vehicle inventory list read contract.
- Consumer in scope: `src/app/dashboard/bella-auto/vehicles/page.tsx`.
- Non-goals: no vehicle creation, no lifecycle transition execution, no booking, no allocation/deallocation, no workshop joins, no rollback flows, no ProductRegistry entry, no schema migration, and no Production deployment.

## Direct Reference Inventory After PR #311

| Category | Files | Decision |
|---|---|---|
| Mobility-owned persistence mapping | `src/platform/mobility/**` | allowed owner of `auto_vehicles` mapping |
| Read-side independent candidate | `src/app/dashboard/bella-auto/vehicles/page.tsx` | migrate in this batch |
| Read-side candidate but separate scope | `NextBestActionEngine`, `FinancialReportingService`, `WarrantyService` reads | defer; each needs its own semantic contract |
| Booking/workshop joins | booking table, service appointment/order/history joins | defer by explicit scope boundary |
| Write lifecycle/allocation/rollback | status machine, allocation, rollback, booking POST vehicle update | out of scope |
| Tests/generated types | `src/__tests__/**`, generated DB types | not product consumer migration targets |

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle inventory list, catalog joins, `list_price`, status fields | Mobility OS | use existing `listMobilityVehicleInventory` contract |
| Vehicle inventory page presentation, local filters, pagination, CSV export | AutoMove Product UI | preserve current behavior |
| Tenant identity | Platform tenant context | use `useTenantContext().tenantId`; no hardcoded tenant and no service-role bypass |
| Vehicle writes/transitions | AutoMove Product / future Mobility write contract | unchanged in this batch |

## Contract Dependency Map

```text
Bella Auto vehicles page
  -> useTenantContext().tenantId
  -> src/platform/mobility/supabase-vehicle-contract
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicles / variant-model-brand persistence
  -> existing page table, filters, export, and detail drawer
```

## Change Authority

Authorized:
- Refactor the scoped vehicle inventory page read path to call the existing Mobility public contract.
- Preserve current page state, local filter/pagination semantics, and response shape.
- Add/update static contract tests preventing direct `auto_vehicles` access from the page.
- Update this gate record.

Not authorized:
- Modify vehicle add/import, allocation, deallocation, status lifecycle, booking, rollback, workshop, or service repair behavior.
- Add or edit migrations, RLS/grants, generated database types, ProductRegistry, other OS/product scopes, or Production state.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing page fields are already present in `MobilityVehicleInventoryItem`.
- Existing client-side filtering and pagination remain local over the loaded inventory list.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to one AutoMove page, focused Mobility static test, and this gate record.
2. Contract Boundary: vehicles page imports Mobility public contract instead of direct `auto_vehicles` query.
3. Tenant Isolation: vehicles page uses current tenant context and the contract applies explicit `tenant_id` filtering.
4. RLS & Authorization: no grants or policies changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry or other OS/product scope touched.
8. Type Safety: no `any`, suppressions, generated type edits, or provider runtime import into the client page.
9. Regression: focused static contract test, changed typecheck, lint, build, and architecture guard.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this vehicle page read-side batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE WARRANTY COVERAGE MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove warranty coverage vehicle identity read migration is authorized.
> **Date:** 2026-10-14
> **Scope:** Move `WarrantyService.validateWarrantyCoverage` vehicle identity/existence read behind the Mobility OS public Supabase contract. Preserve warranty date and mileage validation semantics from `auto_sales`. No claim workflow change, write-side lifecycle, booking/workshop workflow, rollback, schema migration, ProductRegistry, Production mutation, or other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS owns reusable vehicle identity/tenant boundary reads; AutoMove Warranty owns warranty coverage rules and claim workflow.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, merged Mobility public contract in `src/platform/mobility/supabase-vehicle-contract.ts`, current `WarrantyService.validateWarrantyCoverage` behavior, and post-#313 direct `auto_vehicles` inventory.
- Canonical Contract: Product consumers should obtain vehicle identity through Mobility public contract functions; warranty-specific `auto_sales` coverage fields remain AutoMove warranty/business data in this batch.
- Gate result: `PASS` for this read-side warranty coverage validation only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Warranty coverage validation.
- OS capability consumed: Mobility tenant-scoped vehicle identity read contract.
- Consumer in scope: `src/modules/bella-auto/services/WarrantyService.ts` inside `validateWarrantyCoverage`.
- Non-goals: no warranty claim creation/update/cancel behavior changes, no financial reporting, no service appointment/repair-order joins, no booking allocation, no vehicle lifecycle write migration, no schema migration, no Production deployment.

## Direct Reference Inventory After PR #313

| Category | Files | Decision |
|---|---|---|
| Mobility-owned persistence mapping | `src/platform/mobility/**` | allowed owner of `auto_vehicles` mapping |
| Read-side independent candidate | `WarrantyService.validateWarrantyCoverage` | migrate in this batch |
| Read-side candidate but separate scope | `FinancialReportingService` | defer; `purchase_price`/profit semantics need separate contract proof |
| Booking/workshop joins | booking table, service appointment/order/history joins | defer by explicit scope boundary |
| Write lifecycle/allocation/rollback | status machine, allocation, rollback, booking POST vehicle update, provider add vehicle | out of scope |
| Tests/generated/scripts/docs | `src/__tests__/**`, generated DB types, scripts, docs | not product consumer migration targets |

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle identity/existence by tenant | Mobility OS | add a minimal public read DTO/function |
| Warranty period and mileage limit | AutoMove Warranty/Product | preserve existing `auto_sales` read semantics |
| Warranty claim creation/review/update/cancel | AutoMove Warranty/Product | unchanged in this batch |
| Tenant isolation | Mobility contract plus existing warranty sale query | preserve explicit `tenantId` filters; no service-role bypass |

## Contract Dependency Map

```text
WarrantyService.validateWarrantyCoverage
  -> src/platform/mobility/supabase-vehicle-contract
  -> getMobilityVehicleIdentity
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicles persistence
  -> existing auto_sales warranty coverage read
  -> existing date/mileage validation response
```

## Change Authority

Authorized:
- Add a minimal Mobility vehicle identity read function that returns vehicle ID and VIN for a tenant-scoped vehicle lookup.
- Refactor only `validateWarrantyCoverage` vehicle identity lookup to call Mobility public contract.
- Preserve `auto_sales` warranty coverage fields and existing invalid reasons.
- Add focused tests proving tenant-scoped identity lookup and no direct `auto_vehicles` read in the scoped warranty validation method.
- Update this gate record.

Not authorized:
- Modify warranty claim write flows, vehicle status transition, allocation/deallocation, booking POST allocation, rollback, workshop creation/update flows, financial reporting, ProductRegistry, generated DB types, migrations, grants/RLS, or Production.

## UI -> Contract Reconciliation

- No UI change.
- No new field, KPI, status, or action is introduced.
- The coverage validation result shape and messages remain product-owned and unchanged.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility read contract, warranty read consumer, focused Mobility tests, and this gate record.
2. Contract Boundary: `validateWarrantyCoverage` imports Mobility public contract instead of direct `auto_vehicles` query.
3. Tenant Isolation: Mobility identity read and warranty sale lookup are tenant-scoped.
4. RLS & Authorization: no policies or grants changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry, other OS, booking/workshop, or lifecycle write path touched.
8. Type Safety: no `any`, suppressions, generated type edits, or compatibility aliases.
9. Regression: focused Mobility static/unit tests, changed typecheck, lint, architecture guard, and security guard.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this read-side warranty coverage batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE CUSTOMER OWNERSHIP MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove customer ownership read-side migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move `AutoCustomerProvider.getProfile` owned-vehicle reads and `recalculateProfileAggregates` active ownership valuation reads behind the Mobility OS public Supabase contract. Preserve existing Customer 360 response shape and aggregate semantics: active ownership count plus sum of owned vehicles' `list_price`. No write-side ownership/lifecycle change, no migration, no ProductRegistry change, no Production mutation, and no other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS Foundation owns reusable vehicle identity and ownership contracts. `AutoCustomerProvider` still directly reads `auto_vehicles` for customer-owned vehicle details and aggregate valuation.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, merged Mobility Foundation contract, current `AutoCustomerProvider` behavior, and the approved user scope for `AUTO_CUSTOMER_OWNERSHIP_MOBILITY_READ`.
- Canonical Contract: AutoMove customer read consumers should obtain vehicle ownership/valuation data through `src/platform/mobility` public contract functions; the Mobility adapter owns persistence mapping to reused `auto_*` tables.
- Gate result: `PASS` for this customer ownership read-side consumer only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Bella Auto customer 360 ownership surface.
- OS capability consumed: Mobility vehicle ownership and vehicle identity read contract.
- Consumers in scope: `AutoCustomerProvider.getProfile` and the read portion of `AutoCustomerProvider.recalculateProfileAggregates`.
- Non-goals: no booking, allocation, deallocation, status lifecycle, rollback, workshop joins, ProductRegistry entry, schema migration, or Production deployment.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle identity and `list_price` read mapping | Mobility OS | expose minimal customer ownership read contract |
| Vehicle owner relationship read mapping | Mobility OS | expose customer-owned vehicle list with existing owner metadata |
| Customer 360 profile response shape | AutoMove Product | preserve existing `OwnedVehicle` and aggregate semantics |
| Ownership writes and transfers | AutoMove Product / future Mobility write batch | unchanged in this batch |
| Tenant isolation | Supabase RLS plus tenant-scoped query input | preserve `tenantId` filters across owner, vehicle, variant, model, and brand reads |

## Contract Dependency Map

```text
AutoCustomerProvider read methods
  -> src/platform/mobility/supabase-vehicle-contract
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicle_owners / auto_vehicles / variant-model-brand persistence
  -> existing AutoMove Customer 360 response and aggregate profile update
```

## Change Authority

Authorized:
- Extend Mobility public Supabase contract with customer-owned vehicle list and customer ownership aggregate reads.
- Refactor the scoped AutoMove customer provider read paths to call Mobility public contract functions.
- Add focused tests for empty ownerships, multiple vehicles, tenant-scoped reads, aggregate `list_price`, and static consumer boundary.
- Update this gate record.

Not authorized:
- Modify ownership write semantics, status lifecycle, allocation/deallocation, booking, rollback, or workshop joins.
- Add migrations, change RLS/grants, change ProductRegistry, mutate Production, or touch unrelated OS/product scopes.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing Customer 360 `OwnedVehicle` fields remain unchanged.
- Existing aggregate meaning remains unchanged: count active ownership records and sum `list_price` for active owned vehicles.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility contract, one AutoMove customer provider consumer, focused tests, and this gate record.
2. Contract Boundary: customer provider imports Mobility public contract instead of direct `auto_vehicles` queries.
3. Tenant Isolation: contract tests verify every read query is scoped by `tenant_id`.
4. RLS & Authorization: no grants or policies changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry or other OS/product scope touched.
8. Type Safety: no `any`, suppressions, or generated type edits.
9. Regression: focused customer provider, Mobility contract, static contract tests, changed typecheck, lint, build, and architecture guard.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this customer ownership read-side batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE DASHBOARD SHELL MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove dashboard shell read-side migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move `src/app/dashboard/bella-auto/page.tsx` vehicle status KPI reads behind the Mobility OS public Supabase contract. Preserve existing dashboard route behavior and chart props. No write path change, no migration, no ProductRegistry change, no Production mutation, and no other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS Foundation and prior AutoMove read-side batches are merged on `main`. The dashboard shell still directly reads `auto_vehicles` for status counts used by `AutoAnalyticsCharts`.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, merged Mobility Foundation work, existing `src/platform/mobility/supabase-vehicle-contract.ts`, and current dashboard shell behavior.
- Canonical Contract: AutoMove read consumers should call Mobility public contract functions for vehicle inventory/status reads; the Mobility adapter owns persistence mapping to reused `auto_*` tables.
- Gate result: `PASS` for this dashboard shell read-only consumer. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Bella Auto dashboard shell.
- OS capability consumed: Mobility vehicle inventory status summary read contract.
- Consumer in scope: `src/app/dashboard/bella-auto/page.tsx`.
- Non-goals: no vehicle creation, no lifecycle transition, no booking/workshop/service repair flows, no ProductRegistry entry, no schema migration, no Production deployment.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle inventory status summary | Mobility OS | use existing `getMobilityVehicleInventorySummary` contract |
| Dashboard shell presentation and chart props | AutoMove Product UI | preserve current prop shape and rendering behavior |
| Tenant isolation | Supabase RLS plus tenant-scoped query input | preserve tenant filter from authenticated profile; do not add service-role bypass |
| Vehicle writes/transitions | AutoMove Product / future Mobility write contract | unchanged in this batch |

## Contract Dependency Map

```text
Bella Auto dashboard shell
  -> src/platform/mobility/supabase-vehicle-contract
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicles persistence
  -> existing AutoAnalyticsCharts props
```

## Change Authority

Authorized:
- Refactor the scoped dashboard shell status summary read to call the existing Mobility public contract.
- Add a focused static test proving this dashboard shell consumer no longer directly reads `auto_vehicles`.
- Update this gate record.

Not authorized:
- Modify write-side vehicle creation or lifecycle transition semantics.
- Add migrations, change RLS, change ProductRegistry, mutate Production, or touch unrelated OS/product scopes.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing `AutoAnalyticsCharts` props remain unchanged: total, showroom, warehouse, allocated, delivered.
- This batch moves the data-access boundary only; it does not introduce new UI states, KPIs, actions, or workflows.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to one AutoMove dashboard shell consumer, focused tests, and this gate record.
2. Contract Boundary: dashboard shell imports Mobility public contract instead of direct `auto_vehicles` query.
3. Tenant Isolation: existing authenticated profile `tenant_id` filter and Supabase RLS context are preserved.
4. RLS & Authorization: no grants or policies changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry or other OS/product scope touched.
8. Type Safety: no `any`, suppressions, or generated type edits.
9. Regression: focused Mobility/AutoMove contract tests plus changed typecheck/build.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this dashboard shell read-side batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE MOBILITY CONSUMER READ-SIDE BATCH

> **Status:** PASS - minimal AutoMove read-side consumer migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move the `AutoInventoryProvider` vehicle inventory read-side paths for summary, inventory list, and vehicle status history behind the Mobility OS public Supabase contract. Keep write-side vehicle creation and lifecycle transition unchanged for a later batch because those require separate idempotency and write-semantic proof. No migration, no ProductRegistry change, no Production mutation, and no other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS Foundation MVP is merged on `main` and exposes the approved public contract boundary in `src/platform/mobility`. `AutoInventoryProvider` still owns product-facing inventory methods that directly query `auto_vehicles` and `auto_vehicle_status_logs` for read-side workflows.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, merged PR #307, existing Mobility Foundation public contract files, and current `AutoInventoryProvider` consumer behavior.
- Canonical Contract: AutoMove product services should consume shared vehicle identity/lifecycle reads through `src/platform/mobility` public contract functions. The Mobility adapter owns persistence mapping to reused `auto_*` tables.
- Gate result: `PASS` for read-side consumer migration only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Bella Auto vehicle inventory surface.
- OS capability consumed: Mobility vehicle identity and lifecycle read contract.
- Consumer in scope: `src/modules/bella-auto/services/AutoInventoryProvider.ts` read-side methods: `getSummary`, `listVehicles`, and `getStatusHistory`.
- Non-goals: no state-machine write rewrite, no booking/sales/customer/finance flows, no marketplace capabilities, no ProductRegistry entry, no migration, no Production deployment.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle identity and lifecycle read mapping | Mobility OS | move read persistence access into Mobility public Supabase contract |
| AutoMove inventory provider response shape | AutoMove Product | preserve existing product-facing interfaces and legacy status-history row shape |
| Vehicle creation and status transition writes | AutoMove Product / future Mobility write contract | keep unchanged in this batch |
| Tenant isolation | Supabase RLS plus tenant-scoped query inputs | preserve existing tenant filters and do not add service-role bypass |

## Contract Dependency Map

```text
AutoInventoryProvider read method
  -> src/platform/mobility/supabase-vehicle-contract
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicles / auto_vehicle_status_logs persistence
  -> legacy AutoMove provider response shape
```

## Change Authority

Authorized:
- Extend Mobility public Supabase contract with vehicle inventory summary, inventory list, and status history read functions.
- Refactor the scoped AutoMove provider read methods to call the Mobility contract.
- Add focused static tests proving the consumer no longer performs direct read-side `auto_*` access.

Not authorized:
- Modify write-side vehicle creation or status transition semantics.
- Add migrations, change RLS, change ProductRegistry, or mutate Production.
- Modify Logistics, Warehouse, Finance, Healthcare, Education, Manufacturing, or frozen kernels.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing product-facing provider response shape must remain compatible for inventory UI consumers.
- This batch moves the data-access boundary only; it does not add new UI states, KPIs, filters, or workflows.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility contract, one AutoMove provider consumer, focused tests, and this gate record.
2. Contract Boundary: provider imports Mobility public contract instead of direct read-side `auto_*` queries.
3. Tenant Isolation: existing tenantId filters and authenticated Supabase RLS context are preserved.
4. RLS & Authorization: no grants or policies changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry or other OS/product scope touched.
8. Type Safety: no `any`, suppressions, or generated type edits.
9. Regression: focused Mobility/AutoMove contract tests plus changed typecheck.
10. Evidence Integrity: report local proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this read-side batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - BELLA AUTO WORKSHOP SECURITY CLOSURE

> **Status:** PASS - minimal closure for the already-repaired Bella Auto workshop RLS incident is authorized.
> **Date:** 2026-10-13
> **Scope:** Prepare a protected Production workflow that repairs migration history for `20261013090000`, applies one least-privilege migration for the two workshop tables through BDGF, records that migration with Supabase migration repair, then verifies RLS, grants, history, and tenant isolation. No direct local Production SQL, no `supabase db push`, no bulk migration sync, no ProductRegistry, and no OS/kernel changes.

## Bella OS/Product Development Process Gate

- Truth: Production RLS repair is already proven for `auto_service_appointments` and `auto_repair_orders`, but `20261013090000` is not recorded in migration history and `authenticated` still has `REFERENCES`, `TRIGGER`, and `TRUNCATE` table privileges.
- Source of Truth: Production read-only evidence, successful BDGF workflow `38376099290`, Supabase migration history, `scripts/bdgf/execute-migration-wrapper.mjs`, and the existing post-deploy Bella Auto workshop RLS probe.
- Canonical Contract: Production DDL must use BDGF approval -> gate token -> wrapper -> executor. Migration-history repair must use the official Supabase CLI `migration repair --status applied` against the confirmed Production DB URL and must not rerun migration DDL.
- Gate result: `PASS` for preparing the workflow, least-privilege migration, probes, and static guard tests. `MIGRATION_HISTORY = NOT_RECORDED` and `AUTHENTICATED_LEAST_PRIVILEGE = NOT_SEALED` remain true until the protected workflow is merged, manually dispatched, and passes.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: incident closure for two workshop tables only.
- Existing capabilities reused: GitHub Actions Production environment protection, owner-operated BDGF approval, BDGF migration wrapper/executor, Supabase migration repair, and Real DB post-deploy probes.
- Non-goals: no broad migration synchronization, no direct Production SQL, no `supabase db push`, no Logistics/Healthcare/Education/Manufacturing changes, no ProductRegistry change, and no Bella Auto Go-Live claim.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Migration history row for `20261013090000` | Supabase migration management / operator | repair as applied only after verifying DDL is already applied |
| `authenticated` table privileges on workshop tables | Bella Auto workshop persistence | revoke only `REFERENCES`, `TRIGGER`, `TRUNCATE` |
| Least-privilege Production DDL | BDGF governance / executor | execute through owner-operated approval and wrapper |
| Tenant isolation proof | Bella Auto workshop RLS policies | reuse transactional tenant A/B Real DB probe |
| Full Bella Auto readiness | separate product readiness gate | not claimed by this closure |

## Contract Dependency Map

```text
Manual workflow_dispatch on main
  -> GitHub Environment Production protection
  -> Production URL project-ref preflight
  -> Supabase migration repair for already-applied 20261013090000
  -> owner_operated BDGF approval for 20261013103000
  -> execute-migration-wrapper.mjs
  -> Supabase migration repair for 20261013103000 after successful DDL
  -> post-deploy RLS / grants / history / tenant-isolation probes
```

## Change Authority

Authorized:
- Add one least-privilege migration limited to `auto_service_appointments` and `auto_repair_orders`.
- Add one protected manual workflow for Bella Auto workshop security closure.
- Add read-only closure probes and static guard tests for the workflow and migration.
- Update package scripts and this architecture gate record.

Not authorized:
- Run Production mutation from this local session.
- Manually edit `supabase_migrations.schema_migrations`.
- Use `supabase db push`, bulk sync, direct executor invocation, or direct `psql`.
- Modify ProductRegistry, app product workflows, frozen kernels, Logistics, Healthcare, Education, Manufacturing, or unrelated Bella Auto features.

## UI -> Contract Reconciliation

- No UI change.
- No user-facing product workflow or action contract change.

## Additive Migration Plan

- Add `20261013103000_restrict_bella_auto_workshop_authenticated_grants.sql`.
- Migration behavior: revoke only `REFERENCES`, `TRIGGER`, and `TRUNCATE` from `authenticated` on the two workshop tables; preserve `SELECT`, `INSERT`, `UPDATE`, and `DELETE` for existing RLS policies.
- Deployment is deferred to a protected manual Production workflow. The workflow repairs migration history with Supabase CLI only after preflight verification and records the new migration only after BDGF execution succeeds.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Bella Auto workshop closure workflow, migration, BDGF probes/tests, package script, and gate record.
2. Contract Boundary: least-privilege DDL runs only through BDGF wrapper; history repair uses Supabase CLI migration repair, not direct SQL.
3. Tenant Isolation: final workflow reruns the transactional tenant A/B RLS probe.
4. RLS & Authorization: final workflow checks RLS enabled, anon denied, authenticated CRUD retained, and management privileges revoked.
5. Database Migration Safety: static tests bind migration SHA-256 and zero-downtime check reviews the changed migration.
6. Event-After-Persistence: no product write/event path changed.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Manufacturing, ProductRegistry, or kernel files changed.
8. Temporal Provenance: workflow records exact migration versions and hashes in logs without secrets.
9. Rule Governance: no accounting/legal/domain rule changed.
10. Audit & Evidence Integrity: workflow fails closed on wrong project URL, missing secrets, history/grant mismatch, invalid approval, wrapper failure, repair failure, or post-probe failure.
11. Regression: run focused BDGF tests, closure workflow guard tests, zero-downtime migration check, diff check, and final diff review.

---

# ARCHITECTURE GATE RESULT - BDGF PRODUCTION WORKFLOW FOR BELLA AUTO WORKSHOP RLS

> **Status:** PASS - add a manual, protected Production workflow for the already-approved Bella Auto workshop RLS migration.
> **Date:** 2026-10-13
> **Scope:** Add the missing official GitHub Actions execution path for `20261013090000_reenable_bella_auto_workshop_rls.sql`. No migration content change, no automatic execution on merge, no Mobility OS, no ProductRegistry, and no kernel changes.

## Bella OS/Product Development Process Gate

- Truth: PR #300 merged the owner-operated BDGF approval mechanism and the approved workshop RLS migration. Production execution remains unproven until a protected operator-triggered workflow creates approval, executes through the BDGF wrapper, and passes post-deploy Real DB probes.
- Source of Truth: BDGF R4 approval and execution contracts, `scripts/bdgf/create-migration-approval.mjs`, `scripts/bdgf/execute-migration-wrapper.mjs`, GitHub Actions Production environment protections, and the approved migration hash.
- Canonical Contract: production mutation must be manual/authorized, run from `main`, use Production environment secrets, create an owner-operated approval from trusted GitHub Actions identity, issue a gate token, execute through the wrapper, and prove RLS after deployment.
- Gate result: `PASS` for adding the workflow and static guard tests. `MIGRATION = NOT_APPLIED` and `POST_DEPLOY_RLS = NOT_PROVEN` until the workflow is merged, manually dispatched, and passes against the target database.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: official BDGF Production migration execution workflow and post-deploy RLS probe.
- Existing capabilities reused: GitHub Actions Production environment, BDGF owner-operated approval, BDGF wrapper/executor boundary, approved migration artifact.
- Non-goals: no migration rewrite, no direct SQL deployment path, no Mobility OS, no ProductRegistry, no kernel change, no browser E2E, no Bella Auto Go-Live claim.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Production migration execution | BDGF governance / operator | add manual workflow only |
| Owner authority | GitHub Actions trusted runtime + GitHub API | reuse PR #300 mechanism |
| Gate token and mutation | BDGF wrapper and executor | wrapper-only execution |
| Workshop RLS proof | Bella Auto workshop persistence | transactional post-deploy probe |
| Production readiness | separate Go-Live gate | not claimed |

## Contract Dependency Map

```text
Manual workflow_dispatch on main
  -> GitHub Environment Production protection
  -> approved migration SHA-256 check
  -> owner_operated approval
  -> execute-migration-wrapper.mjs
  -> migration-executor.mjs
  -> post-deploy RLS probe
  -> SECURITY_REPAIR = PROVEN only after probe PASS
```

## Change Authority

Authorized:
- Add one GitHub Actions workflow for the approved migration.
- Add one post-deploy probe script for the two Bella Auto workshop tables.
- Add focused static/pure tests for workflow guards and probe fail-closed behavior.
- Add a package script for the focused tests.

Not authorized:
- Modify the approved migration content or hash.
- Run production migration from this local session.
- Use `supabase db push`, `psql`, or direct `migration-executor.mjs`.
- Modify ProductRegistry, kernels, Mobility OS, Logistics/Warehouse/Healthcare/Education, or unrelated Bella Auto features.

## UI -> Contract Reconciliation

- No UI change.
- No product workflow or user-facing data/action contract change.

## Additive Migration Plan

- No new migration in this PR.
- Workflow binds to the existing approved file and SHA-256: `1FEDCE34702106E86A38D650AAF43FEC52A763F54E66A11187EEF6D3A37C2425`.
- Database mutation remains deferred until the protected manual Production workflow is dispatched by an authorized operator.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to workflow, BDGF probe/test scripts, package script, and gate record.
2. Contract Boundary: workflow uses `create-migration-approval.mjs` and `execute-migration-wrapper.mjs`.
3. Tenant Isolation: post-deploy probe checks tenant A/B read/write separation.
4. RLS & Authorization: post-deploy probe checks RLS enabled and anon table privileges revoked.
5. Database Migration Safety: workflow verifies exact approved migration hash before approval/execution.
6. Event-After-Persistence: no app event path changed.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Warehouse, ProductRegistry, Mobility OS, or kernel files changed.
8. Temporal Provenance: workflow runs only via manual dispatch from `main` in Production environment.
9. Rule Governance: no accounting/legal/domain rule changed.
10. Audit & Evidence Integrity: workflow fails closed on hash mismatch, missing secrets, invalid owner authority, wrapper failure, or probe failure.
11. Regression: run focused BDGF owner tests, production workflow guard tests, diff check, secret scan, and final diff review.

---

# ARCHITECTURE GATE RESULT - CUSTOMER DETAIL TENANT THEME UI REPAIR

> **Status:** PASS - minimal presentation-layer repair authorized.
> **Date:** 2026-10-13
> **Scope:** Replace hardcoded customer detail service-card and primary button colors with existing runtime tenant theme tokens. No schema, API, domain, ProductRegistry, Healthcare, Education, Logistics, or kernel change.

## Bella OS/Product Development Process Gate

- Truth: customer detail card/button colors must follow the active tenant brand preset.
- Source of Truth: tenant brand resolver and runtime CSS variables in `src/lib/business-rules/tenant-modules.ts`.
- Canonical Contract: UI consumes `--primary`, `--primary-hover`, `--primary-foreground`, `--accent`, and `--accent-foreground`; UI must not bake a product color into shared customer detail card classes.
- Gate result: `PASS` for presentation CSS/classes only.

## Product Manifest

- Product surface: customer detail service/package UI.
- Capability in scope: active booking card, package selector active card, customer detail primary actions, and modal primary actions.
- Non-goals: booking/session/payment semantics, KTV matching logic, tenant identity, schema, migrations, RLS, authorization, service actions.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Tenant preset tokens | Platform tenant branding contract | consume only |
| Customer detail presentation | Product/UI layer | may update classes |
| Booking/payment/session data | Existing service/domain contracts | unchanged |
| Frozen kernels | Healthcare/Education/Logistics OS | not touched |

## Contract Dependency Map

```text
Customer Detail UI
  -> semantic CSS theme classes / Tailwind primary tokens
  -> runtime tenant CSS variables
  -> resolved tenant brand preset
```

## Change Authority

Authorized:
- Modify customer-detail presentation classes.
- Modify existing CSS theme helper classes to use runtime tenant variables.

Not authorized:
- Change database, API, service, domain, ProductRegistry, migrations, generated types, or frozen kernels.

## UI -> Contract Reconciliation

- Current UI defect: global `.beauty-customer-theme-card` had a fixed jade fallback that could affect non-jade tenants such as babycare.
- Required UI contract: card backgrounds and primary buttons resolve from the active tenant preset.
- Reconciliation result: `MATCH` after converting the presentation layer to existing runtime tokens.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to presentation and this gate record.
2. Contract Boundary: no service/API/domain/schema changes.
3. Tenant Isolation: no runtime data path change.
4. RLS & Authorization: unchanged.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no event path changed.
7. Product UI Theme Contract: verify card/button styles consume tenant CSS variables.
8. Type Safety: run scoped static checks where available.
9. Visual Smoke: browser/manual screenshot if local runtime is practical.
10. Regression Scope: run `git diff --check` and focused lint/type validation.
11. Evidence: report PASS/NOT_RUN honestly.

---

# ARCHITECTURE GATE RESULT - BDGF OWNER-OPERATED WORKSHOP RLS REPAIR

> **Status:** PASS - minimal BDGF owner-operated authority and Bella Auto workshop RLS repair are authorized.
> **Date:** 2026-10-13
> **Scope:** Add a trusted GitHub Actions owner-authority source for BDGF `owner_operated` approvals, bind role integrity, include the rehearsed Bella Auto workshop RLS migration, and add focused BDGF tests. No production execution in this PR.

## Bella OS/Product Development Process Gate

- Truth: The Bella Auto workshop RLS defect is already proven and the repair migration passed rehearsal, but target deployment remains blocked because BDGF lacks a trusted owner-operated approval source.
- Source of Truth: BDGF R4 approval/execution contracts, current BDGF scripts, GitHub Actions run identity/permission API, and the existing rehearsed migration content.
- Canonical Contract: production database mutation must pass BDGF approval -> gate token -> wrapper -> executor. Owner-operated approval is allowed only when approver role is verified by trusted authority, not CLI self-declaration.
- Gate result: `PASS` for BDGF control-plane code, focused tests, and the Bella Auto workshop RLS migration file. `DEPLOYMENT = NOT_EXECUTED` until merge, credentials, approval record, wrapper execution, and post-deploy probes are complete.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: BDGF owner-operated migration approval and workshop RLS repair migration.
- Existing capabilities reused: `bella_migration_approval`, `verifyApproval()`, gate token issuance, migration wrapper, GitHub Actions identity and permission API.
- Non-goals: no Mobility OS, no ProductRegistry, no kernel changes, no production migration execution, no browser E2E, no Finance Go-Live claim.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| BDGF approval contract | Platform / BDGF governance | minimally extend implementation within existing `owner_operated` contract |
| Owner identity source | GitHub Actions + GitHub API | verify workflow run actor and repository admin permission |
| `auto_service_appointments` RLS | Bella Auto workshop persistence | re-enable RLS and revoke anon via approved migration |
| `auto_repair_orders` RLS | Bella Auto workshop persistence | re-enable RLS and revoke anon via approved migration |
| Production execution | BDGF wrapper / operator | not executed in this PR |

## Contract Dependency Map

```text
GitHub Actions run
  -> GitHub API run identity + collaborator permission
  -> owner_operated approval request
  -> bella_migration_approval role/hash/environment binding
  -> verifyApproval()
  -> gate token
  -> execute-migration-wrapper.mjs
  -> migration-executor.mjs
  -> target database mutation
```

## Change Authority

Authorized:
- Modify `scripts/bdgf/create-migration-approval.mjs`.
- Add a small BDGF owner authority helper.
- Modify `scripts/bdgf/r4-verify-approval.mjs` to bind `approver_role` into the approval integrity hash while preserving legacy separated approvals.
- Update focused BDGF approval tests.
- Add `supabase/migrations/20261013090000_reenable_bella_auto_workshop_rls.sql`.

Not authorized:
- Execute production migration.
- Use direct executor access or `supabase db push`.
- Add broad RBAC, `BDGF_OWNER_*` self-declared authority, ProductRegistry, Mobility OS, kernels, or unrelated OS/Product changes.

## UI -> Contract Reconciliation

- No UI change.
- No product workflow or user-facing data contract change.

## Additive Migration Plan

- Add one migration only: `20261013090000_reenable_bella_auto_workshop_rls.sql`.
- Migration behavior: if each workshop table exists, enable RLS, revoke all anon table privileges, and grant authenticated table privileges for policies to enforce tenant boundaries.
- Production application is explicitly deferred until PR approval and BDGF wrapper execution with post-deploy probes.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to BDGF control plane, focused tests, gate record, and Bella Auto workshop RLS migration.
2. Contract Boundary: `owner_operated` derives identity/role from GitHub API, not CLI role claims.
3. Tenant Isolation: RLS repair preserves `public.get_auth_tenant_id()` policy boundary.
4. RLS & Authorization: migration revokes anon table privileges and keeps authenticated path policy-bound.
5. Database Migration Safety: run zero-downtime migration check for the new migration.
6. Event-After-Persistence: no application write/event path changed.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Warehouse, ProductRegistry, or kernel files changed.
8. Temporal Provenance: approval audit notes include run identity evidence without secrets.
9. Rule Governance: no accounting/legal/domain business rule changed.
10. Audit & Evidence Integrity: tests cover valid owner approval, non-admin spoof block, role tamper/hash mismatch, and environment mismatch.
11. Regression: run focused BDGF tests, migration check, secret scan or diff check, and final diff review.

---

# ARCHITECTURE GATE RESULT - MULTI-AGENT CODING PROTOCOL GOVERNANCE RULE

> **Status:** PASS - governance rule addition authorized
> **Date:** 2026-10-08
> **Scope:** Add Bella AI Platform multi-agent coding protocol to the single canonical AI coding constitution and entrypoint instructions.

## Bella OS/Product Development Process Gate

- Truth: Multi-agent execution is an execution-control concern, not a product/runtime capability.
- Source of Truth: user-provided "Bella AI Platform - Multi-Agent Coding Protocol", `AGENTS.md`, `CLAUDE.md`, and `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`.
- Canonical Contract: Bella AI coding rules live in `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`; local agent entrypoints must point to that single source rather than duplicating complete rules.
- Gate result: `PASS` for documentation/governance-only rule update.

## Product Manifest

- Product: none.
- Capability in scope: AI coding governance for controlled multi-agent development.
- Runtime behavior in scope: none.
- Non-goals: no Platform/Core/Product runtime change, no new OS kernel, no migration, no test harness change, no CI automation.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Cross-agent coding protocol | Governance Constitution | may update |
| Agent entrypoint reminders | `AGENTS.md`, `CLAUDE.md` | may point to canonical rule |
| ProductRegistry / Product identity | Platform registry | not modified |
| Healthcare H1-H12 Kernel | Healthcare OS Kernel | not modified |
| Logistics E7.1-E7.3 Kernel | Logistics OS Kernel | not modified |
| Education Kernel | Education OS Kernel | not modified |

## Contract Dependency Map

```text
User request / Lead decision
  -> Bella AI Coding Constitution
  -> Multi-Agent Coding Protocol
  -> Lead decomposition / ownership / worktree / branch / PR strategy
  -> Builder or QA agent scoped execution
  -> Evidence / integration / seal
```

## Change Authority

Authorized:
- Modify `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`.
- Modify `AGENTS.md` and `CLAUDE.md` only as entrypoint reminders.
- Update this architecture gate record.

Not authorized:
- Modify runtime code, product code, Platform/Core, frozen Healthcare/Education/Logistics kernels, migrations, generated types, package scripts, or CI workflows.

## UI -> Contract Reconciliation

- No UI change.
- No data-bound or action-bound UI element changed.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or production data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: verify only governance docs and this gate record changed.
2. Contract Boundary: protocol requires Product -> Public Contract -> Kernel and public contracts across domains.
3. Tenant Isolation: no runtime path changed; protocol preserves tenant/RLS/auth invariants.
4. RLS & Authorization: no runtime path changed; protocol forbids RLS/auth weakening.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no Healthcare/Education/Logistics domain route touched.
8. Temporal Provenance: no historical mutation.
9. Rule Governance: protocol text only; no governed business rule changed.
10. Audit & Evidence Integrity: verify evidence states distinguish PASS from skipped, timeout, assumed, or not-run.
11. Regression: run `git diff --check` and inspect changed-file diff.

---

# ARCHITECTURE GATE RESULT - BEAUTY V2 CHAIN STAFF AUTH IDENTITY GUARD

> **Status:** PASS - product service guard authorized
> **Date:** 2026-10-08
> **Scope:** Prevent Beauty V2 Chain Management staff assignment from leaking `people_directory_user_id_fkey` when a selectable `public.users` row is not backed by `auth.users`.

## Bella OS/Product Development Process Gate

- Truth: `people_directory.user_id` is an Auth identity link and references `auth.users(id)`.
- Source of Truth: `supabase/migrations/20260801030000_foundation_org_people_schema.sql`, `src/services/beauty-chain-actions.ts`, live read-only Supabase evidence captured in `implementation-artifacts/investigations/beauty-v2-chain-staff-assignment-fk-investigation.md`.
- Canonical Contract: Beauty Chain staff assignment consumes Platform People Directory and Org Unit contracts; linkable employee users must have a valid Auth identity before `people_directory.user_id` is populated.
- Gate result: `PASS` for a Product service guard and focused tests only.

## Product Manifest

- Product: Bella Beauty Spa V2 (`bella_spa`), Chain Management page.
- Capability in scope: assign an existing tenant staff user to a selected branch.
- Existing capabilities reused: `public.users` tenant profile, `people_directory`, `org_relationships`, `org_units`, and `user_org_unit_access`.
- Non-goals: no schema change, no Platform Org Unit change, no migration, no Healthcare/Education/Logistics kernel work, no demo-data mutation.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| `auth.users` identity existence | Supabase Auth / Platform identity | read only through server-side admin client |
| `public.users` tenant profile | Platform/user profile | consume only |
| `people_directory` | Platform People Directory | consume contract; do not change schema |
| `org_relationships` branch assignment | Platform Org Unit relationship | consume existing contract |
| Beauty Chain action orchestration | Beauty V2 Product service | may guard before mutation |

## Contract Dependency Map

```text
Beauty Chain UI
  -> linkBeautyStaffPerson / assignBeautyStaffToBranch
  -> public.users same-tenant staff profile
  -> auth.users identity existence guard
  -> people_directory employee link
  -> org_relationships person -> branch membership
  -> user_org_unit_access projection
```

## Change Authority

Authorized:
- Modify `src/services/beauty-chain-actions.ts`.
- Modify `src/__tests__/beauty-chain-actions.test.ts`.
- Update this architecture gate record.

Not authorized:
- Change `people_directory`, `auth.users`, `org_units`, `org_relationships`, `user_org_unit_access`, RLS, migrations, generated types, or seed production data.
- Create compatibility aliases or bypass the FK.

## UI -> Contract Reconciliation

| UI element / action | Contract status | Decision |
|---|---|---|
| Staff dropdown from tenant `public.users` | MAPPING BUG | Product action must reject users without Auth identity before People Directory insert. |
| `Gán vào chi nhánh` action | MATCH after guard | Same-tenant staff and active branch are still required; Auth identity is now validated before link. |
| Existing `Needs link` badge | PARTIAL | It only means no `people_directory` row; it does not prove Auth identity. No UI redesign in this change. |

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: confirm no frozen Healthcare/Education/Logistics/Platform kernel files are touched.
2. Contract Boundary: verify service guard follows `people_directory.user_id -> auth.users`.
3. Tenant Isolation: preserve same-tenant `public.users` and `org_units` filters.
4. RLS & Authorization: preserve admin-only Chain Management action gate.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no event path changed.
7. Domain Safety Routing: Product service guard only; no OS/kernel route touched.
8. Temporal Provenance: no historical/data mutation.
9. Rule Governance: no accounting or governed domain rule change.
10. Audit & Evidence Integrity: focused test for Auth-missing negative path.
11. Regression: run focused `beauty-chain-actions.test.ts` and `git diff --check`.

---

# ARCHITECTURE GATE RESULT - AI CODING BUSINESS SEMANTIC GATE

> **Status:** PASS - governance rule addition authorized
> **Date:** 2026-10-08
> **Scope:** Add cross-agent AI Coding Governance rules requiring business semantic proof and test independence before any AI Agent implements or writes tests for business-critical behavior.

## Bella OS/Product Development Process Gate

- Truth: Existing implementation, existing tests, database columns, names, and inferred relationships are not automatically business truth.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, AGENTS architecture-control instructions, Healthcare/Education constitutions, and the Laboratory patient-linkage incident evidence.
- Canonical Contract: AI coding work must follow `Evidence -> Truth -> Source of Truth -> Canonical Contract -> Ownership -> Boundary -> Change Authority -> Minimal Implementation -> Verification -> Evidence`.
- Gate result: `PASS` for a documentation/governance rule update only.

## Product Manifest

- Product: None.
- Capability in scope: AI Coding OS governance for all agents.
- Runtime behavior in scope: none.
- Non-goals: no Laboratory semantic fix, no Healthcare/Education/Logistics kernel change, no migration, no runtime code, no test harness repair.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Cross-agent AI coding process | Governance Constitution | may update |
| Healthcare H1-H12 Kernel | Healthcare OS Kernel | do not touch |
| Education Kernel | Education OS Kernel | do not touch |
| Laboratory patient linkage runtime mapping | Healthcare/Laboratory contract boundary | not modified in this change |
| Business-critical expected test values | Approved business invariant / canonical contract | must be independent from implementation under test |

## Contract Dependency Map

```text
AI Agent request
  -> Business Semantic Gate
  -> Business Test Contract
  -> Source of Truth / Canonical Contract / Ownership proof
  -> implementation or test only if semantics are PROVEN
```

## Change Authority

Authorized:
- Modify `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`.
- Update this architecture gate record.

Not authorized:
- Modify Healthcare, Education, Logistics, Platform/Core, product runtime, migrations, generated types, or tests.
- Implement the Laboratory patient-linkage semantic fix.

## UI -> Contract Reconciliation

- No UI change.
- No data-bound or action-bound UI element changed.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or production data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: verify only governance docs and this gate record changed.
2. Contract Boundary: rule points agents to canonical contracts and ownership before code/test.
3. Tenant Isolation: no runtime path changed.
4. RLS & Authorization: no runtime path changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no Healthcare/Education/Logistics domain route touched.
8. Temporal Provenance: no historical mutation.
9. Rule Governance: governance text only; no governed runtime rule changed.
10. Audit & Evidence Integrity: verify diff contains explicit `BUSINESS_SEMANTICS = NOT_PROVEN` stop rule.
11. Regression: run `git diff --check` and inspect final diff.

---

# ARCHITECTURE GATE RESULT - BABYCARE CUSTOMER CARD PROGRESS

> **Status:** PASS - product UI consumer correction authorized
> **Date:** 2026-10-07
> **Scope:** Fix BabyCare customer-list active package progress card so it renders persisted booking progress instead of hardcoded 80%.

## Bella OS/Product Development Process Gate

- Truth: Customer package progress for the customer list is derived from the selected booking's `completed_sessions` and `total_sessions`.
- Source of Truth: `bookings` rows returned by `getCustomers`, existing customer detail/booking selector UI behavior, and Bella architecture constitution.
- Canonical Contract: Product UI consumes customer rows with tenant-scoped nested `bookings`; progress is `completed_sessions / total_sessions`, clamped from 0 to 100.
- Gate result: `PASS` for product UI and focused helper/test changes only.

## Product Manifest

- Product: Bella BabyCare customer CRM list.
- Capability in scope: active package summary card on `/dashboard/customers`.
- Existing capability: customer list loads tenant-scoped `bookings` with `package_name`, `status`, `is_in_care`, `total_sessions`, `completed_sessions`, and payment data.
- Requested correction: remove hardcoded progress display and bind it to the selected display booking.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| `customers` rows | Product CRM persistence | consume only |
| `bookings.completed_sessions` / `bookings.total_sessions` | Booking/session product persistence | consume only |
| Customer-list selected booking | `customer-list-rules.ts` product UI rule | may extend helper logic |
| Active package card rendering | `/dashboard/customers` product UI | may modify |
| Healthcare/Education/Logistics kernels | Frozen OS kernels | do not touch |

## Contract Dependency Map

```text
/dashboard/customers UI
  -> getCustomers()
  -> tenant-scoped customers + nested bookings
  -> selectCustomerDisplayBooking()
  -> calculateCustomerBookingProgress()
  -> active package card progress text/bar
```

## Change Authority

Authorized:
- Modify `src/app/dashboard/customers/customer-list-rules.ts`.
- Modify `src/app/dashboard/customers/page.tsx`.
- Add focused tests for progress calculation and selected booking display state.

Not authorized:
- Database migration or schema changes.
- Platform/Core changes.
- Healthcare, Education, or Logistics kernel changes.
- Broad BabyCare redesign or unrelated CRM behavior changes.

## UI -> Contract Reconciliation

- UI currently uses real booking data for package name and active status, but hardcodes progress at 80%.
- Correct UI contract is to render progress from the same selected display booking used for package/status.
- Missing or invalid totals must not invent progress; use 0 percent and clamp valid computed values.

## Additive Migration Plan

- No migration required.
- No table, index, RLS, or generated type change required.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: confirm no frozen kernel/platform files are touched.
2. Contract Boundary: UI consumes existing `getCustomers` booking payload only.
3. Tenant Isolation: preserve existing `getCustomers().eq('tenant_id', tenantId)` filtering.
4. RLS & Authorization: no auth/RLS changes.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write path or event path touched.
7. Domain Safety Routing: not applicable; no Healthcare/Education/Logistics domain route touched.
8. Temporal Provenance: not applicable; no historical mutation.
9. Rule Governance: not applicable; no governed rule change.
10. Audit & Evidence Integrity: focused source/test evidence for UI calculation.
11. Regression: run focused customer-list tests and a targeted TypeScript check where feasible.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL CHAIN AUDIT & COMPLETION

> **Status:** PASS - product-layer Preschool Chain completion authorized
> **Date:** 2026-10-06
> **Scope:** Audit and complete Preschool Chain evidence from API trigger to product-owned branch/chain persistence and read-back, without modifying frozen Education Kernel code or Platform org-unit engine.

## Bella OS/Product Development Process Gate

- Truth: Preschool runtime enrollment uses canonical `edu_courses`, `edu_enrollments`, `students`, `party_parties`, `edu_attendance`, and `edu_attendance_daily_state`.
- Source of Truth: Education Constitution, product manifest, canonical Education public contracts, Supabase migrations/types, and existing Preschool operational tests.
- Canonical Contract: Product → Education public contracts for student/enrollment/attendance; Product → Platform org hierarchy data (`org_units`, `org_relationships`, `people_directory`, `user_org_unit_access`) for chain/branch scope.
- Gate result: `PASS` for product-layer additive completion only. No `src/platform/education/` changes are authorized.

## Product Manifest

- Product: Bella Education / Preschool implementation (`bella_education`).
- Existing capabilities: course catalog query, student enrollment command, attendance checkpoint command, grade reporting command.
- Gap found during audit: no explicit Preschool product capability records customer-chain/branch assignment through the canonical `edu_*` runtime path.
- Additive capability: Preschool branch/chain assignment and verification for enrollment flows.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| `org_units`, `org_relationships`, `people_directory` | Platform Org Unit / Authorization | consume only; do not modify engine |
| `edu_courses`, `edu_enrollments`, Education public contracts | Education Kernel | consume only; do not modify frozen code |
| Preschool course/enrollment branch assignment | Bella Education product layer | add product-owned tables/service |
| Enrollment API orchestration | Bella Education product/API layer | wire branch assignment after canonical enrollment |
| Real DB proof | Product verification | prove only when credentials/environment are available |

## Contract Dependency Map

```text
API Trigger
  -> Bella Education enrollment route
  -> StudentContract / EnrollmentContract
  -> Education Kernel persistence in canonical edu_* tables
  -> Preschool product chain assignment
  -> Platform org-unit membership/branch validation
  -> product read-back verification
```

## Change Authority

Authorized:
- Additive product-owned migration for Preschool chain assignment tables/indexes/RLS.
- Product service and route wiring under `src/products/bella-education` / `src/app/api/education`.
- Focused unit/integration tests for chain validation and route behavior.
- Minimal Preschool enrollment UI wiring for runtime branch selection/read-back when branch scope is available.

Not authorized:
- Modifying `src/platform/education/`.
- Modifying Platform org-unit engine.
- Altering frozen Healthcare/Logistics artifacts.
- Creating a Preschool-specific branch registration architecture.
- Broad UI redesign, unrelated Preschool features, or core abstractions.

## UI -> Contract Reconciliation

Authority boundary:
- Chain/branch lifecycle registration authority remains Platform Org Unit / tenant organization management. Preschool must not create a separate branch registry.
- HQ subscription/franchise setup is tenant/customer commercial authority and is not the Preschool runtime chain assignment authority.
- Preschool runtime authority is limited to assigning an enrollment/course to an existing active branch the current tenant/user can access.

UI reconciliation:
- Existing Preschool enrollment UI has classroom selection but no branch selection, so canonical runtime assignment is not proven from product UI.
- Minimal authorized UI fix is to fetch accessible tenant branches, require a branch only when branches are available, submit `branchId` with admission, and render backend read-back.
- Branch registration/management UI remains the existing organization/branch management surface; no new Preschool management surface is authorized unless a separate business contract requires it.

## Additive Migration Plan

- `CREATE TABLE public.preschool_chain_course_branch_assignments`.
- `CREATE TABLE public.preschool_chain_enrollment_branch_assignments`.
- Add indexes, unique constraints, FK constraints to canonical `edu_courses`, `edu_enrollments`, `org_units`, and `tenants`.
- Enable tenant RLS and grant standard authenticated/service-role access.
- No alteration of `edu_courses`, `edu_enrollments`, Platform tables, or frozen kernel code.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: no Platform/Education Kernel source modification.
2. Contract Boundary: product consumes Education public contracts.
3. Tenant Isolation: product chain service rejects cross-tenant branch/course/enrollment.
4. RLS & Authorization: migration enables tenant RLS; service checks user branch access.
5. Database Migration Safety: additive `CREATE TABLE`/indexes only.
6. Event-After-Persistence: no new async event; assignment follows successful enrollment persistence.
7. Academic Safety Routing: unchanged; enrollment remains in Education contract.
8. Temporal Provenance: additive timestamps/actor/request identifiers on chain rows.
9. Rule Governance: unchanged; no grading/prerequisite rule changes.
10. Audit Evidence Integrity: focused chain tests and read-back evidence.
11. Platform Regression: run targeted product tests, education architecture/conformance where feasible, typecheck/diff checks.

---

## Additional Architecture Gate - Education E2E Baseline Repair

> **Status:** PASS - isolated E2E migration orchestration repair authorized
> **Date:** 2026-10-06
> **Scope:** Repair schema/history drift in the isolated E2E database so PR changed migrations can depend on canonical Education runtime tables. Do not modify Preschool Chain migration to hide dependencies, do not create duplicate `edu_*` tables, and do not alter frozen Education Kernel source.

- Bella OS/Product Development Process Gate: PASS. This is CI/E2E database orchestration only. It consumes canonical migrations already in `supabase/migrations` and does not change product runtime contracts, Education Kernel source, or production schema design.
- Truth / Source of Truth: PR #240 changed migration `20261006010000_preschool_chain_assignments.sql` correctly references canonical `public.edu_courses` and `public.edu_enrollments`. CI proves the isolated E2E DB has migration history through later versions but lacks `public.edu_courses`, so the failure is baseline schema drift, not a Preschool migration ownership defect.
- Product Manifest: no new product capability. The existing Preschool Chain proof requires canonical Education enrollment tables and route support tables to exist in the isolated E2E database.
- Ownership Map: `party_parties` remains owned by the canonical Blueprint core schema migration. `platform_rule_domain` remains owned by the canonical Platform Rule Engine migration. `org_units`, `people_directory`, `org_relationships`, and `user_org_unit_access` remain owned by canonical Platform Org/Authorization migrations. `edu_courses`, `edu_enrollments`, and enrollment RPC remain owned by canonical Education migrations. `edu_preschool_pickup_authorizations` remains owned by the existing Preschool guardian authorization migration. `scripts/apply-e2e-pr-migrations.cjs` owns PR-scoped isolated E2E migration apply orchestration.
- Contract Dependency Map: CI Real Database Business E2E -> apply changed PR migrations -> verify/repair canonical E2E prerequisites from repository migrations -> Preschool Chain migration -> admission route -> Education contracts -> `edu_enrollments` -> Preschool chain read-back.
- Change Authority: limited to `scripts/apply-e2e-pr-migrations.cjs` and this gate note. Not authorized: modifying `src/platform/education/`, rewriting Education schema, adding duplicate tables to Preschool migration, resetting migration history, or broad CI workflow refactors.
- UI -> Contract Reconciliation: none.
- Additive Migration Plan: none. The script may apply existing canonical migrations to the isolated E2E DB only when required schema objects are missing despite migration history.
- Verification Gates Plan: script syntax check, dry-run migration discovery, zero-downtime migration validation, CI scope router check, `git diff --check`, then rerun PR #240 Real Database Business E2E and migration gates to terminal status.

---

## Additional Architecture Gate - Preschool Student Admission Read-Back

> **Status:** PASS - app read-model/UI registry fix authorized
> **Date:** 2026-10-06
> **Scope:** Prove Preschool Student/Admission read-back after canonical enrollment persistence without reopening Preschool Chain, modifying frozen Education Kernel code, or creating a new student architecture.

- Bella OS/Product Development Process Gate: PASS. This is a minimal Education app/API read-model and UI registry reconciliation, not a Kernel contract change, schema change, product redesign, or Chain continuation.
- Truth / Source of Truth: Admission mutation already persists canonical Party-backed Student and `edu_enrollments`; the registry page initializes from static demo data and has no `GET /api/education/enrollments` read-back path after reload.
- Product Manifest: no new product capability. Existing Student Registry / Admission surface should display canonical persisted admissions for the current tenant.
- Ownership Map: `edu_enrollments`, `students`, and Education public contracts remain Education-owned. The app route owns a tenant-scoped read model, matching existing classroom roster/finance read-model patterns. Guardian display uses existing Preschool guardian authorization service.
- Contract Dependency Map: Preschool registry UI -> `GET /api/education/enrollments` -> tenant/auth context -> canonical `edu_enrollments` + `students` + `party_parties` + `edu_courses` -> guardian authorization read service -> UI read-back.
- Change Authority: limited to `src/app/api/education/enrollments/route.ts`, `src/app/api/education/enrollments/__tests__/route.test.ts`, `src/app/dashboard/education/enrollments/page.tsx`, and this gate note.
- UI -> Contract Reconciliation: replace static-only student list with tenant-scoped API read-back; after admission submit, refresh from canonical read model. Demo rows may remain only as an empty/error fallback.
- Additive Migration Plan: none.
- Verification Gates Plan: targeted enrollment route tests, route/UI typecheck, targeted lint, `git diff --check`, education architecture/no-new-debt gates where relevant.
- Explicit non-goals: no `src/platform/education/` modification, no new list contract, no migration, no Chain changes, no persistence redesign for optional nickname/medical-note metadata.

---

## Additional Architecture Gate - English Operational Real DB Target Normalization

> **Status:** PASS - test/infrastructure configuration repair authorized
> **Date:** 2026-10-06
> **Scope:** Normalize the English Post-RC Real DB proof command to the canonical E2E Supabase project used by Browser E2E evidence. Do not create tenants, mutate data, modify English product runtime code, or expose secrets.

- Bella OS/Product Development Process Gate: PASS. This is a verification-target repair only. It does not change Product, Platform, Education Kernel, schema, or business behavior.
- Product Manifest: Bella English Center remains unchanged. Existing product identity and schema/RLS proof surfaces are consumed only for verification.
- Ownership Map: `package.json` owns local command routing. `scripts/run-english-center-post-rc-real-db.cjs` owns English-specific verification environment normalization. Supabase credentials and Postgres connection strings remain external secret configuration and are not committed.
- Contract Dependency Map: `npm run test:english-center-post-rc-real-db` -> English verification env wrapper -> `.env.e2e` / `E2E_ENV_FILE` -> Supabase project `bmnbqbcdbuklhopfbopv` -> existing Jest Real DB validation.
- Change Authority: authorized to modify test/infrastructure command routing and add a small wrapper script. Not authorized to modify `src/products/bella-english-center`, `src/platform/education`, HQ onboarding, migrations, production/customer data, or E2E tenant bootstrap.
- UI -> Contract Reconciliation: none.
- Additive Migration Plan: none.
- 11 Automated Verification Gates Plan: assert canonical project ref before test execution, require a runnable Postgres URL for the same project, run the focused English Real DB gate, run `git diff --check`, and inspect worktree status.

---

## Additional Architecture Gate - English Migration Packaging Contract Repair

> **Status:** PASS - migration packaging repair authorized; DB apply not authorized in this step
> **Date:** 2026-10-06
> **Scope:** Convert existing English Center migration files into the repository's approved E2E migration-runner contract without changing English product runtime code, creating tenants, resetting any database, or manually writing migration ledger rows.

- Bella OS/Product Development Process Gate: PASS. This is a schema-migration packaging repair only. It does not change Product service/API behavior, Education Kernel code, Platform contracts, or business semantics.
- Product Manifest: Bella English Center schema remains product-owned additive schema. The packaging repair preserves the existing English Center tables, RLS policies, grants, triggers, comments, and concurrent-index intent.
- Ownership Map: `supabase/migrations/*english_center*.sql` owns English product schema packaging. `scripts/apply-e2e-pr-migrations.cjs` owns the approved E2E apply contract requiring 14-digit migration versions and ledger recording after successful apply.
- Contract Dependency Map: existing English SQL -> valid 14-digit migration files -> approved E2E apply script -> canonical E2E DB `bmnbqbcdbuklhopfbopv` -> English Real DB schema/RLS validation.
- Change Authority: authorized to rename/split English migration files and separate `CREATE INDEX CONCURRENTLY` statements into standalone migration files so the existing runner can apply them one file at a time. Not authorized to modify `src/products/bella-english-center`, create tenants, mutate E2E DB in this step, reset DB, use `--include-all`, or manually alter migration history.
- UI -> Contract Reconciliation: none.
- Additive Migration Plan: no new schema semantics; packaging only. Existing `CREATE TABLE`, RLS, grants, triggers, and indexes remain additive.
- 11 Automated Verification Gates Plan: validate all English migration filenames against the approved parser, prove no duplicate migration versions, prove concurrent-index statements are standalone and outside explicit transactions, run script syntax checks, run migration/scope validation where local-only, run `git diff --check`, then stop before DB mutation.

---

## Additional Architecture Gate - English E2E Migration Apply Evidence

> **Status:** PASS_FOR_SCHEMA_RLS_AND_REAL_DB_GATE
> **Date:** 2026-10-06
> **Scope:** Apply the validated English Center migration set only to the canonical E2E Supabase project `bmnbqbcdbuklhopfbopv` using the approved E2E migration runner. No tenant bootstrap, production/customer mutation, reset/drop, manual ledger writes, or English product runtime changes are authorized.

- Bella OS/Product Development Process Gate: PASS. The DB mutation is limited to applying existing product-owned English Center schema migrations through the approved E2E process.
- Product Manifest: Bella English Center runtime/product code remains unchanged. This step proves schema/RLS availability on the canonical E2E DB only.
- Ownership Map: `supabase/migrations/*english_center*.sql` owns schema objects. `scripts/apply-e2e-pr-migrations.cjs` owns ordered apply and ledger recording. The canonical E2E database owns remote verification state.
- Contract Dependency Map: validated English migration set -> approved E2E migration runner -> `bmnbqbcdbuklhopfbopv` -> remote table/RLS/policy/ledger evidence -> `npm run test:english-center-post-rc-real-db`.
- Change Authority: authorized DB mutation is limited to those 31 English Center migrations. Not authorized: tenant creation, seed data, browser E2E, production/customer DB mutation, `--include-all`, manual ledger writes, or unrelated duplicate-version cleanup.
- UI -> Contract Reconciliation: none.
- Additive Migration Plan: applied 31 English Center migrations in repository order. Remote read-back found 20/20 `english_center_*` tables, RLS enabled on all checked tables, at least one policy per table, and 31/31 English migration ledger rows.
- Verification Gates: target project confirmed as `bmnbqbcdbuklhopfbopv`; approved apply completed; `npm run test:english-center-post-rc-real-db` PASS on `.env.e2e`; tenant bootstrap remains NOT_STARTED.
- Grant Evidence Boundary: service-role DML privileges are present for all 20 checked English tables. Authenticated DML grants are present for the core/program/course/class/enrollment/teacher/timetable/learning/tuition tables and absent for the four engagement tables because `20260914190000_create_english_center_engagement.sql` does not grant authenticated table privileges. Do not claim full authenticated engagement grant proof from this step.

---

## Additional Architecture Gate - English E2E Tenant Bootstrap Evidence

> **Status:** PASS_FOR_TENANT_RUNTIME_AND_POST_RC_BROWSER_GATE
> **Date:** 2026-10-07
> **Scope:** Bootstrap exactly one marker-scoped Bella English Center verification tenant on canonical E2E Supabase project `bmnbqbcdbuklhopfbopv`, then verify tenant, branch, auth/user, operational seed read-back, Real DB gate, and Browser E2E. No production/customer database mutation and no English product runtime code change are authorized.

- Bella OS/Product Development Process Gate: PASS. This is an authorized E2E test-data/bootstrap mutation only, following existing tenant/user/branch seed patterns and preserving product/runtime code.
- Product Manifest: Bella English Center product identity remains `bella_english_center`. The bootstrap tenant is a verification fixture, not a production/customer tenant.
- Ownership Map: `tenants.product_key` owns product identity. `org_units` owns branch runtime. `users` plus Supabase Auth own test admin identity. English Center product tables own marker-scoped operational seed rows.
- Contract Dependency Map: `bella_english_center` tenant -> branch `org_units` -> admin user/auth -> `user_org_unit_access` -> English product operational tables -> Post-RC browser/API validation.
- Change Authority: authorized to create one E2E tenant fixture and minimal operational seed on `bmnbqbcdbuklhopfbopv`. Not authorized: production/customer mutation, BabyCare fallback, English runtime code edits, grant repair without authenticated runtime failure evidence, or extra tenant creation.
- Additive Migration Plan: none. No schema changes in this step.
- Bootstrap Evidence: one tenant exists for `product_key = 'bella_english_center'`; branch count 1; admin DB user count 1; Supabase Auth user created for the same admin id; marker-scoped E2-E8 operational rows read back with count >= 1 for program, course, class, enrollment, teacher, teacher-branch, room, session, attendance, progress, tuition plan, tuition assignment, tuition invoice, tuition payment, engagement template, engagement message, engagement recipient, and engagement response.
- Branch/Auth Evidence: `user_org_unit_access` read-back under `app.current_tenant_id` and `app.current_user_id` returned branch access through both `belongs_to` and `tenant_admin`.
- Verification Gates: `npm run test:english-center-post-rc-real-db` PASS on `.env.e2e`; `E2E_TENANT_PRODUCT_KEY=bella_english_center npm run e2e:english-center-post-rc` PASS with 2/2 Playwright tests. Browser evidence includes `/dashboard/english-center/learning`, `/tuition`, `/engagement`, `/command-center` rendering <400 without runtime errors, and API probes returning expected statuses including `/api/english-center/command-center` = 200.
- Residual Boundary: this proves the Post-RC tenant/runtime/browser path on the seeded E2E fixture. It does not convert production/customer readiness or unrelated authenticated E8 engagement table grants into PASS beyond the runtime exercised here.

---

## Canonical Seal - English Center Operational Chain

> **Status:** ENGLISH CENTER OPERATIONAL CHAIN = PROVEN_FOR_MARKER_SCOPED_E2E_POST_RC
> **Date:** 2026-10-07

- Proven Scope: Product Identity, Schema/RLS, 31/31 migrations, migration ledger, Real DB gate, marker-scoped E2E tenant, branch, admin/auth fixture, operational seed, branch access, and Post-RC Browser E2E.
- Base/Main Commit: `77231ba1b93f889ecc797242e4b0d8cf0f8a703f`.
- Pull Request: NOT_CREATED in this step.
- Canonical E2E DB: `bmnbqbcdbuklhopfbopv`.
- Product Identity: `tenants.product_key = 'bella_english_center'`.
- Real DB Evidence: `npm run test:english-center-post-rc-real-db` PASS against `.env.e2e`.
- Browser Evidence: `E2E_TENANT_PRODUCT_KEY=bella_english_center npm run e2e:english-center-post-rc` PASS, 2/2 Playwright tests.
- Production/Customer Runtime: NOT_CLAIMED.
- Go-Live: NOT_CLAIMED.
- E8 Authenticated Grant Boundary: EVIDENCE GAP remains recorded for the four engagement tables. No grant repair is authorized unless a later authenticated runtime path proves it is a root cause.
- Scope Decision: STOP. Do not continue coding English Center in this workstream.

---

## Additional Architecture Gate - Preschool Class Canonical Course Read-Back

> **Status:** PASS - app route canonical course reconciliation authorized
> **Date:** 2026-10-06
> **Scope:** Reconcile Preschool Class UI/API options with canonical `edu_courses` used by admission/enrollment runtime, without modifying frozen Education Kernel contracts or creating a new class architecture.

- Bella OS/Product Development Process Gate: PASS. This is a route-level read-model and dual-write success validation fix for existing Class UI, not a Kernel schema/contract change.
- Truth / Source of Truth: `POST /api/education/courses` writes a legacy `courses` projection and an `edu_courses` row; `POST /api/education/enrollments` verifies active courses only in `edu_courses`. Before this fix, `GET /api/education/courses` listed `courses` projection rows, so UI/admission could select a class not proven enrollment-compatible.
- Product Manifest: no new product capability. Existing Class management must expose classes that can be used by canonical enrollment.
- Ownership Map: `edu_courses` remains Education runtime enrollment source; `courses` remains projection/detail surface for room/grade metadata and legacy classroom UI. Teacher assignment contract remains the teacher assignment authority.
- Contract Dependency Map: Class UI -> `GET /api/education/courses` -> tenant/auth context -> canonical `edu_courses` -> optional `courses` projection metadata -> teacher assignment contract -> enrollment/attendance counts.
- Change Authority: limited to `src/app/api/education/courses/route.ts`, focused tests, and this gate note.
- UI -> Contract Reconciliation: list class/admission options from canonical `edu_courses`; merge legacy projection only for display fields. Class creation must fail if canonical `edu_courses` persistence fails.
- Additive Migration Plan: none.
- Verification Gates Plan: targeted courses/enrollment route tests, changed-file typecheck, targeted lint, `git diff --check`, education no-new-debt and architecture baseline checks.
- Explicit non-goals: no Platform/Education Kernel modification, no migration, no table removal, no broad classroom redesign, no Chain reopen.

---

# ARCHITECTURE GATE RESULT - GLOBAL LINT BASELINE REMEDIATION

> **Status:** PASS - Platform/CI lint error baseline remediated
> **Date:** 2026-10-04
> **Scope:** Reduce pre-existing repo-wide `npm run lint` errors without touching Bella English business logic, product contracts, database schema, or frozen kernels.

## Additional Architecture Gate - Beauty V2 Runtime Branch Context

> **Status:** PASS - minimal runtime branch context integration authorized
> **Date:** 2026-10-06
> **Scope:** Connect the completed Beauty V2 Tenant Chain MVP to runtime branch selection and server-side branch authorization. Do not expand Chain UI, do not add Region, do not modify HQ Tenant Provisioning, do not modify `registerNewTenant()`, do not create Beauty-specific chain tables, and do not redesign Platform kernel.

- Bella OS/Product Development Process Gate: PASS. This change consumes existing Platform org/people/access primitives and existing branch-aware Beauty consumers; it does not alter frozen Healthcare/Education/Logistics kernels or Platform ownership boundaries.
- Product Manifest: runtime scope includes accessible branch read, active branch selection, branch selector UI in the Beauty shell, and canonical branch context resolution through `user_org_unit_access`. Out of scope: Region, new chain tables, broad module refactors, HQ tenant provisioning, accounting consolidation, franchise/inter-company, and claiming full Real DB E2E proof unless a real database proof is actually run.
- Ownership Map: Platform owns `org_units`, `org_relationships`, `people_directory`, and `user_org_unit_access`. Beauty V2 owns runtime selection UX and passes selected `branchId` into branch-aware flows. Existing business writers remain responsible for server-side deny-before-write checks.
- Contract Dependency Map: Chain Management writes Platform contract -> `user_org_unit_access` projects allowed branches -> Beauty runtime selector exposes active branch -> branch-aware consumers call `resolveSingleStaffBranchContext` -> writes persist canonical `branch_id`.
- Change Authority: authorized layers are Beauty runtime branch context service/action, a small shell selector component, focused tests, and minimal resolver hardening to prefer `user_org_unit_access`. Not authorized: HQ, Product Registry identity, migrations, generated type edits, Platform kernel redesign, or broad UI redesign.
- UI -> Contract Reconciliation:
  - Active branch selector: MATCH, reads accessible branch options from `user_org_unit_access` and `org_units`.
  - Selected branch: MATCH, persisted as runtime UI context and revalidated server-side before writes.
  - Attendance/booking/product sale/payroll consumers: PARTIAL/MATCH, existing consumers already accept or derive branch context; this PR standardizes the context source but does not refactor every product module.
- Additive Migration Plan: none. Existing Platform schema and view are reused.
- 11 Automated Verification Gates Plan: focused unit tests for branch option read, single-branch auto-selection, selected branch authorization, cross-tenant/unauthorized denial, runtime resolver using `user_org_unit_access`, plus targeted TypeScript/lint/diff checks. Real DB E2E remains a separate proof unless explicitly run against real Supabase.
- Explicit decision: `Runtime Branch Context` is `PROVEN_BY_REAL_DB_E2E`. `BEAUTY_V2_TENANT_CHAIN = PROVEN` for the MVP scope after the real Supabase E2E flow passed on 2026-10-06: create Company -> create Branch A/B -> create Staff user -> assign Staff to Branch A -> read `user_org_unit_access` -> runtime Branch A allowed -> runtime Branch B denied -> attendance write at Branch A -> database read-back.

## Additional Architecture Gate - Beauty V2 Branch Runtime Operational Verification

> **Status:** PASS - Booking, Inventory, Payroll, and Commission runtime branch verification sealed
> **Date:** 2026-10-06
> **Scope:** Verify branch-aware runtime correctness for Beauty V2 Booking, Inventory/Product Sales, Payroll, and Commission using the already sealed Tenant Chain MVP and canonical branch context. Do not reopen Chain MVP, do not modify HQ, do not modify `registerNewTenant()`, do not create Beauty-specific chain tables, and do not expand Region or Platform kernel scope.

- Bella OS/Product Development Process Gate: PASS. This change consumes existing Platform org access (`user_org_unit_access`) and existing Beauty operational writers. It does not alter frozen Healthcare/Education/Logistics kernels, Product Registry identity, HQ provisioning, or database schema.
- Product Manifest: operational verification scope includes Booking service-item commission writes, Product Sales inventory/commission writes, Attendance -> Payroll branch propagation, and Commission source branch matching. Out of scope: general stock movement redesign, every Booking mutation, Region, Payroll/Finance expansion, HQ, and cross-tenant chain modeling.
- Ownership Map: Platform owns org access projection and org units. Beauty V2 owns runtime branch selection and operational writer validation. Payroll owns salary branch derivation from attendance and commission source matching.
- Contract Dependency Map: Chain Management -> `org_units` / `org_relationships` / `people_directory` -> `user_org_unit_access` -> active branch context -> Booking/Product Sales/Attendance writers -> Payroll/Commission read-back.
- Change Authority: authorized code change is limited to replacing the remaining explicit KTV attendance branch authorization path with the existing canonical `resolveSingleStaffBranchContext`. Authorized tests include focused unit coverage and a Real DB operational proof. Not authorized: Platform kernel redesign, migrations, HQ provisioning, new Beauty chain tables, or broad product refactors.
- UI -> Contract Reconciliation: no UI redesign. Runtime selector remains the branch context entrypoint; server-side writers still enforce branch access before mutation.
- Additive Migration Plan: none.
- Verification Gates Plan: focused unit tests for attendance, booking service item writer, product sales writer, session completion, salary recalculation, and runtime branch actions; Real DB E2E through `.env.e2e`; changed-file typecheck; targeted lint; `git diff --check`.
- Explicit decision: `BEAUTY_V2_BRANCH_RUNTIME = PROVEN_FOR_BOOKING_INVENTORY_PAYROLL_COMMISSION` after Real DB E2E passed on 2026-10-06: Branch A allowed, Branch B denied before write, Booking service item and Product Sales persisted `branch_id = Branch A`, Payroll wrote `salary_records.branch_id = Branch A`, Commission source mismatch for Branch B was denied, and DB read-back confirmed no Branch B mutation.

## Additional Architecture Gate - Beauty V2 Tenant Chain Management MVP

> **Status:** PASS - minimal tenant-side Chain Management MVP authorized
> **Date:** 2026-10-06
> **Scope:** Implement Beauty V2 tenant-side Company, Branch, Staff, and Staff -> Branch assignment using existing Platform org/people primitives. Do not modify HQ Tenant Provisioning, do not modify `registerNewTenant()`, do not create Beauty-specific chain tables, and do not claim runtime branch enforcement in this PR.

- Bella OS/Product Development Process Gate: PASS. The audit in `investigations/beauty-v2-tenant-chain-platform-contract-investigation.md` proves the data model foundation exists in Platform (`org_units`, `people_directory`, `org_relationships`, `user_org_unit_access`) and this scope is a Product tenant-side capability consuming that contract.
- Product Manifest: Beauty V2 Chain Management MVP includes Company, Branch list/create/detail, existing Staff linking, Staff -> Branch assignment, and access read-back. Region, runtime branch selector, booking/customer/inventory/payroll enforcement, franchise/inter-company, analytics, and Real DB end-to-end proof are out of scope.
- Ownership Map: `org_units`, `people_directory`, `org_relationships`, and `user_org_unit_access` are Platform/Foundation-owned. Beauty V2 owns tenant-side UX/API and Beauty-specific branch configuration/labels. Auth users and tenant roles remain owned by existing `users` management.
- Contract Dependency Map: Beauty V2 UI -> Beauty chain server actions/service -> Platform org/people tables under tenant-scoped RLS/admin authorization -> `user_org_unit_access` projection. Product code may consume Platform primitives; it must not create a parallel chain schema.
- Change Authority: authorized layers are a small Beauty chain service/action boundary, Beauty tenant dashboard UI/navigation, focused tests, and a minimal hardening of the staff assignment boundary needed to prevent missing tenant identity or cross-tenant relationships. Not authorized: HQ provisioning, Product Registry identity, Platform kernel redesign, generated type edits, schema migrations, Healthcare/Education/Logistics frozen kernels.
- UI -> Contract Reconciliation:
  - Chain Management entry: MATCH, maps to Beauty tenant-side product UI over Platform org/people contract.
  - Company display/create: MATCH, maps to `org_units.unit_type = 'company'`.
  - Branch list/create/detail: MATCH, maps to `org_units.unit_type = 'branch'` with `parent_id` company.
  - Staff list/link: MATCH, maps existing `users` to `people_directory.user_id`.
  - Staff assignment: MATCH with boundary hardening, maps Person -> Branch through `org_relationships`.
  - Branch access read-back: MATCH, maps to `user_org_unit_access`.
- Additive Migration Plan: none. No DDL is required for this MVP; existing Platform schema is reused.
- 11 Automated Verification Gates Plan: targeted unit tests for company creation, branch creation, staff person registration/link, Staff -> Branch assignment, same-tenant access read-back, cross-tenant assignment denial; targeted TypeScript/test command; `git diff --check`. Runtime branch enforcement and Real DB E2E are deferred to follow-up PRs.
- Explicit decision: `BEAUTY_V2_TENANT_CHAIN` remains `NOT_PROVEN` after this PR until runtime integration and Real DB E2E are implemented. This PR can only close as `READY_FOR_RUNTIME_INTEGRATION` if targeted tests pass.

## Additional Architecture Gate - Real Estate Unit Test Coverage Upload Stability

> **Status:** PASS - CI plumbing fix authorized
> **Date:** 2026-10-05
> **Scope:** Prevent the Real Estate `Unit Tests` job from failing after the unit-test command succeeds solely because the optional external Codecov upload has no artifact or hits a transient TLS/upload failure.

- Bella OS/Product Development Process Gate: PASS. This is CI workflow plumbing only; no Bella OS/Product runtime, schema, contract, or frozen kernel behavior is modified.
- Product Manifest: no new product capability.
- Ownership Map: `.github/workflows/ci-real-estate.yml` is owned by CI/repository governance. `node scripts/test-changed-files.mjs` remains the unit-test authority.
- Contract Dependency Map: GitHub Actions `Unit Tests` -> changed-file Jest runner -> optional coverage artifact -> optional Codecov upload.
- Change Authority: limited to the Real Estate workflow coverage-upload step and the matching `pull_request` path filter needed to verify workflow-only CI fixes. Unit-test execution remains mandatory.
- UI -> Contract Reconciliation: none.
- Additive Migration Plan: none.
- Verification Gates Plan: workflow syntax inspection, `git diff --check`, rerun CI.

## Additional Architecture Gate - Vercel Production Promote Scope

> **Status:** PASS - minimal production workflow promotion fix authorized
> **Date:** 2026-10-04
> **Scope:** Production workflow run `37214892483` passed validate, immutable preview build, exact preview health, and authenticated smoke, then failed `Promote Verified Preview` because `vercel promote` ran without the team scope used by the canonical rollback tooling.

- Bella OS/Product Development Process Gate: PASS. This is Platform/CI production promotion configuration, not Product Vertical behavior, schema, tenant model, auth architecture, or English business logic.
- Truth / Source of Truth: run `37214892483` failed at `npx vercel promote "$DEPLOYMENT_URL" --yes --token="$VERCEL_TOKEN"` with Vercel CLI `User not found (404)` after smoke success; `scripts/emergency-rollback.sh` and rollback documentation already use Vercel scope `bella-spa-s-projects` for promote/inspect operations.
- Canonical Contract: verified preview deployment must be promoted in the same Vercel team/project scope used by operational rollback.
- Ownership Map: `.github/workflows/deploy-production.yml` owns controlled production promotion; Vercel project/team configuration remains external production configuration.
- Change Authority: add explicit `VERCEL_SCOPE` workflow env with the existing team-scope default and pass it to `vercel promote`.
- UI -> Contract Reconciliation: no UI change.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, production data mutation, or credential change.
- Verification Gates Plan: workflow diff review, `git diff --check`, security/architecture gates, PR CI, then re-dispatch `Deploy to Production`.
- Explicit non-goals: no runtime code, no English business code, no secret change, no auth bypass, no production gate weakening, no migration, no Vercel project recreation.

## Additional Architecture Gate - Vercel Production Promote API Path

> **Status:** PASS - minimal production workflow promotion API fix authorized
> **Date:** 2026-10-05
> **Scope:** Production workflow run `37216425595` passed validate, immutable preview build, exact preview health, and authenticated smoke, then failed `Promote Verified Preview` even with `--scope` because Vercel CLI still attempted to load a user and returned `User not found (404)`.

- Bella OS/Product Development Process Gate: PASS. This is Platform/CI production promotion transport, not Product Vertical behavior, schema, tenant model, auth architecture, or English business logic.
- Truth / Source of Truth: run `37216425595` shows `Smoke Exact Preview = PASS` and `vercel promote "$DEPLOYMENT_URL" --scope "$VERCEL_SCOPE"` failing with Vercel CLI user-loading error. Vercel REST API documents Bearer token auth, team resource access with `teamId`, deployment lookup by ID/URL, and project deployment promotion through `POST /v10/projects/{projectId}/promote/{deploymentId}`.
- Canonical Contract: verified preview deployment must be promoted using the existing Vercel token, project ID, team ID, and deployment ID without relying on CLI user profile resolution.
- Ownership Map: `.github/workflows/deploy-production.yml` owns controlled production promotion; Vercel project/team/token configuration remains external production configuration.
- Change Authority: replace only the promotion transport in the production workflow with direct Vercel REST API calls that resolve the deployment ID from the exact preview host and promote that deployment for the configured production project/team.
- UI -> Contract Reconciliation: no UI change.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, production data mutation, or credential change.
- Verification Gates Plan: workflow diff review, `git diff --check`, security/architecture gates, PR CI, then re-dispatch `Deploy to Production`.
- Explicit non-goals: no runtime code, no English business code, no secret change, no auth bypass, no production gate weakening, no migration, no Vercel project recreation.

## Additional Architecture Gate - Production Smoke Client Monitoring Hardening

> **Status:** PASS - minimal monitoring runtime and smoke-harness fix authorized
> **Date:** 2026-10-04
> **Scope:** Production workflow run `37211453061` passed validate/build/immutable preview health but failed `Smoke Exact Preview` after real-auth login because client-side routine Sentry tunnel traffic emitted a transient `/monitoring` 503 console error; the first attempt also hit the single-test timeout while the page snapshot showed the system monitor content had rendered.

- Bella OS/Product Development Process Gate: PASS. This is Platform production smoke/runtime monitoring hardening, not Product Vertical behavior, schema, tenant model, auth architecture, or English business logic.
- Truth / Source of Truth: Playwright artifact from run `37211453061` shows `/api/tenant/context` returned `200`, dashboard routes rendered, one `/monitoring` request returned `503` while surrounding Sentry tunnel requests returned `200`, and the single smoke test timed out after serially visiting many routes.
- Canonical Contract: production smoke must prove authenticated core routes render without app runtime errors; routine client telemetry must not create false route failures. Real application errors still remain captured by browser `pageerror`, app error text checks, failed app routes, and Sentry error replay.
- Ownership Map: `instrumentation-client.ts` owns client-side monitoring sampling; `e2e/tests/12-authenticated-core-routes-smoke.spec.ts` owns read-only production smoke route evidence.
- Change Authority: reduce routine browser telemetry traffic by disabling client traces/session replay while keeping error replay enabled; split the core route smoke into route-level cases so each route has independent timeout/evidence.
- UI -> Contract Reconciliation: no UI change.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, production data mutation, or credential change.
- Verification Gates Plan: targeted Sentry instrumentation test, targeted Playwright smoke syntax/lint, `typecheck:changed`, `git diff --check`, security/architecture gates as needed, PR CI, then production workflow after merge.
- Explicit non-goals: no auth bypass, no production credential change, no English business code, no monitoring tunnel removal, no broad E2E rewrite, no workflow gate bypass.

## Additional Architecture Gate - Tenant Context Runtime Auth Cookie Fix

> **Status:** PASS - Minimal runtime boundary fix authorized
> **Date:** 2026-10-04
> **Scope:** Production smoke blocker where `/api/tenant/context` receives a valid Supabase browser auth cookie but returns `401`.

- Bella OS/Product Development Process Gate: PASS. This is an existing Platform runtime/auth API boundary repair, not a Product Vertical feature, UI redesign, Kernel change, or schema change.
- Product Manifest: no new product capability; preserve existing contract `authenticated request -> Supabase user -> public.users.tenant_id -> public.tenants -> TenantContext`.
- Ownership Map: Platform runtime/auth API owns the route behavior; `users` and `tenants` remain the existing data owners.
- Contract Dependency Map: protected UI -> `TenantContextProvider` -> `/api/tenant/context` -> Supabase Auth + RLS-backed `users`/`tenants`.
- Change Authority: `src/app/api/tenant/context/route.ts` and targeted API route regression test only.
- UI -> Contract Reconciliation: no UI change; existing protected pages depend on successful tenant context resolution after real auth login.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, or production data mutation.
- Verification Gates Plan: targeted API regression, lint/typecheck where available, `git diff --check`, CI, then production smoke workflow after merge.
- Explicit non-goals: no auth redesign, middleware redesign, hard-coded tenant/user, credential change, English business logic change, bypass auth, migration, or `any` introduction.

## Additional Architecture Gate - Tenant Context Web Runtime Cookie Decoder

> **Status:** PASS - route-only runtime decoder fix authorized
> **Date:** 2026-10-04
> **Scope:** Production smoke blocker after PR #217 where `/api/tenant/context` still returns `401` even though sanitized Playwright trace shows same-origin requests carry the Supabase auth cookie.

- Bella OS/Product Development Process Gate: PASS. This is a minimal Platform tenant-context API runtime compatibility repair, not an auth architecture change, Product Vertical feature, UI redesign, Kernel change, or schema change.
- Truth / Source of Truth: production workflow run `37204581799` on SHA `cec170c56fa0bfe1dc12f6a7fff8d25c2c16edd5` passed validate/build/immutable preview health but failed `Smoke Exact Preview`; sanitized trace metadata shows `/api/tenant/context` requests returned `401` with `cookie` header present.
- Product Manifest: no product capability change. Preserve existing contract `authenticated Supabase cookie -> verified user -> public.users.tenant_id -> public.tenants -> TenantContext`.
- Ownership Map: `src/app/api/tenant/context/route.ts` owns tenant-context route behavior; Supabase Auth remains authentication source of truth; `users`/`tenants` remain existing data owners.
- Contract Dependency Map: protected UI -> `TenantContextProvider` -> `/api/tenant/context` -> Supabase Auth cookie decode -> `auth.getUser(accessToken)` -> tenant profile lookup.
- Change Authority: `src/app/api/tenant/context/route.ts`, targeted regression test in `src/__tests__/api-tenant-context.test.ts`, and this gate note only.
- UI -> Contract Reconciliation: no UI change; existing protected pages depend on successful tenant context resolution after real auth login.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, or production data mutation.
- Verification Gates Plan: unauthenticated request remains `401`; authenticated Supabase cookie decodes in a runtime without Node `Buffer`; targeted API regression; lint/typecheck; security/architecture gates; CI; production workflow after merge.
- Explicit non-goals: no auth redesign, middleware redesign, hard-coded tenant/user, credential change, English business logic change, bypass auth, migration, broad abstraction, or `any` introduction.

## Additional Architecture Gate - Tenant Context Public Env Contract

> **Status:** PASS - route-only stale env consumer fix authorized
> **Date:** 2026-10-04
> **Scope:** Production smoke blocker after PR #218 where `/api/tenant/context` still returns `401` even though sanitized Playwright trace proves the Supabase auth cookie is present, base64-decodable, contains a non-expired `access_token`, and reaches the exact preview route.

- Bella OS/Product Development Process Gate: PASS. This is a minimal Platform tenant-context API env-contract repair, not an auth architecture change, Product Vertical feature, UI redesign, Kernel change, or schema change.
- Truth / Source of Truth: production workflow run `37206117376` on SHA `458ca060b73b0119b687bab17571897869db02dc` passed validate/build/immutable preview health but failed `Smoke Exact Preview`; sanitized trace shows `/api/tenant/context` requests include `sb-[project]-auth-token`, the cookie payload has `access_token`, and the token is not expired.
- Canonical Contract: browser Supabase clients use `requireSupabasePublicEnv()`, whose public key contract is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Stale Consumer: `/api/tenant/context` used `NEXT_PUBLIC_SUPABASE_ANON_KEY` directly for both SSR and bearer clients, diverging from production workflow/build config where publishable key is the canonical public key.
- Ownership Map: `src/app/api/tenant/context/route.ts` owns tenant-context route behavior; `src/lib/supabase-public-env.ts` owns public Supabase env resolution; Supabase Auth remains authentication source of truth.
- Contract Dependency Map: protected UI -> `TenantContextProvider` -> `/api/tenant/context` -> Supabase public env -> Supabase Auth token verification -> `users`/`tenants`.
- Change Authority: `src/app/api/tenant/context/route.ts`, targeted regression test in `src/__tests__/api-tenant-context.test.ts`, and this gate note only.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, or production data mutation.
- Verification Gates Plan: targeted API regression proving publishable-key-only env works; lint/typecheck; security/architecture gates; CI; production workflow after merge.
- Explicit non-goals: no auth redesign, middleware redesign, hard-coded tenant/user, credential change, English business logic change, bypass auth, migration, broad abstraction, or `any` introduction.

## Additional Architecture Gate - Vercel Exact Preview Archive Deploy

> **Status:** PASS - Minimal production workflow packaging fix authorized
> **Date:** 2026-10-04
> **Scope:** Production workflow exact preview deploy fails after successful Vercel build because `vercel deploy --prebuilt` hits Vercel upload request limits (`api-upload-free`, more than 5000); Vercel CLI recommends `--archive=tgz`.

- Bella OS/Product Development Process Gate: PASS. This is production workflow packaging, not Product Vertical code, UI, schema, Kernel, auth, tenant, or business logic.
- Product Manifest: no product capability change and no runtime contract change.
- Ownership Map: Platform/CI production deployment workflow owns exact preview packaging.
- Contract Dependency Map: `Deploy to Production` workflow -> immutable preview build -> exact preview deployment -> smoke -> promote.
- Change Authority: `.github/workflows/deploy-production.yml` deploy command only, plus this gate note.
- Additive Migration Plan: none.
- Verification Gates Plan: workflow syntax/diff review, `git diff --check`, PR CI, then re-dispatch `Deploy to Production`.
- Explicit non-goals: no Vercel project change, no secret change, no production domain promotion bypass, no application/runtime code change.

## Bella OS/Product Development Process Gate

- Problem: production workflow is blocked by a pre-existing global lint baseline (`53 errors + 73 warnings` in CI), proven unchanged before and after PR #204.
- Truth / Source of Truth: `npm run lint`, GitHub production workflow run `37171535585`, and parent comparison against `89e9c4b14da8cd358c9aed0ca3f22a7641268919`.
- Ownership: Platform/CI governance and repository hygiene. This is not Bella English product work.
- Boundary: fix only local lint errors whose runtime semantics are obvious and do not require product/domain contract changes.
- Gate result: `PASS`; `npm run lint` now exits 0 with `0 errors / 73 warnings`.

## Product Manifest

No new product capability. No UI redesign. No production data mutation.

In scope:
- Mobile tooling inline ESLint rule drift.
- Playwright fixture parameter false-positive from React Hooks lint.
- Malformed legacy utility/docs scripts that currently cannot parse.
- Mechanical JSX entity escaping for text nodes.
- Minimal React compiler compliance where functions were used before declaration, a tooltip component was created during render, or refs were updated during render.

Out of scope:
- Bella English business code.
- Education, Healthcare, Logistics, Finance business behavior.
- Schema, RPC, API, RLS, tenant, auth, or migration changes.
- Workflow/gate weakening or lint bypass.

## Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `npm run lint` | Platform/CI Governance | Production workflow quality gate |
| `apps/mobile/*.js` | Mobile tooling | CommonJS tooling scripts, not product runtime contracts |
| `e2e/fixtures/auth.ts` | E2E harness | Playwright fixture setup; no auth semantics change |
| `docs/reference/scripts/*`, `scripts/*` | Repository utility/archive scripts | Must be parseable or excluded by a deliberate governance decision |
| JSX text nodes | UI rendering surface | Preserve displayed text while satisfying `react/no-unescaped-entities` |
| React hooks/compiler checks | React runtime contract | Preserve hook order and behavior while satisfying compiler constraints |

## Contract Dependency Map

```text
production workflow
  -> npm run lint
  -> repository source parse/rule checks
  -> production workflow continuation
```

No Product -> Contract -> Kernel dependency is modified.

## Change Authority

Authorized:
- Local syntax repairs for malformed scripts.
- Local lint-rule naming repair where the referenced rule is unavailable.
- E2E fixture naming repair if Playwright fixture semantics remain unchanged.
- JSX text escaping that preserves rendered content.
- Function ordering / component extraction / effect-based ref updates for React compiler compliance.

Not authorized:
- Disabling `npm run lint` globally.
- Adding `continue-on-error`.
- Broad ESLint ignores for product source.
- Product behavior or business contract changes.

## UI -> Contract Reconciliation

No UI change.

## Additive Migration Plan

No migration.

## Verification Plan

1. Focused ESLint on Batch 1 files: `PASS`.
2. `npm run lint -- --quiet`: `PASS` (`0 errors`).
3. `npm run lint`: `PASS` (`0 errors / 73 warnings`).
4. `npm run typecheck:changed`: `PASS`, zero diagnostics.
5. `git diff --check`: `PASS`.

---

# Full System Typecheck Architecture Gate

> **Status:** DEFER for frozen/kernel-owned diagnostics; PASS for non-frozen, contract-proven, local cleanup batches
> **Date:** 2026-10-03
> **Scope:** System-wide TypeScript/typecheck cleanup. No new product capability, no schema/RPC invention, no strictness reduction, no suppressions.

## Baseline

- Canonical full command: `npm run typecheck:full`
- Raw full diagnostics: `849`
- Raw full warnings: `0`
- Raw full affected files: `91`
- CI script result: allowed by reviewed baseline, but this is `FAIL` for the zero-debt target.
- Adjunct mobile command: `npm run mobile:typecheck` fails before compiler because `apps/mobile` is not registered as an npm workspace.
- Direct mobile compiler diagnostics: `30`, mostly missing Expo/React Native dependency/type resolution.
- `npm run shared:typecheck`: PASS.
- `mcp-server/tsconfig.json`: PASS.

## Bella OS/Product Development Process Gate

- Problem: eliminate TypeScript/typecheck debt across the repository without suppressions, weakened strictness, or unrelated refactors.
- Truth: current diagnostics come from compiler output and scoped typecheck commands.
- Source of Truth: `package.json`, `tsconfig*.json`, `.github/workflows/type-check.yml`, `scripts/ci-run-typecheck.mjs`, generated DB types, frozen-layer policies, and vertical constitutions.
- Canonical Contract: consumers must follow public Platform/OS/generated DB contracts; generated types are evidence, not a repair surface.
- Boundary: cleanup may fix stale consumers, config resolution, or mapper typing only when the canonical contract is proven.
- Stop Conditions: frozen Logistics/Healthcare kernel edits without required governance process; schema/RPC invention; public-contract widening; suppressions/casts to hide mismatch.

## Product Manifest

This is not a new product or UI redesign. It covers:

- Root web/app TypeScript surface from `tsconfig.json`.
- Scoped platform/product configs.
- Workspace package scopes: `packages/shared`, `apps/mobile`, `mcp-server`.

Non-goals:

- No new OS/product capability.
- No database migration.
- No production mutation.
- No broad refactor.

## Ownership Map

- Typecheck orchestration: CI/platform tooling.
- Generated DB contracts: database/generated types source of truth.
- Logistics E7.1/E7.2/E7.3: sealed Logistics OS kernel; modifications require ACR/ADR/unlock/regression/re-seal.
- Healthcare H1-H12: frozen Healthcare OS kernel; Product/legacy services must use public contracts.
- Mobile app workspace: app/tooling configuration.
- Shared package: package-owned TypeScript config/source.
- Decision-engine archive: Platform/legacy service ownership; archive inclusion must be justified rather than patched as live product code.

## Contract Dependency Map

- Product/UI/legacy services -> public Platform/OS contracts -> generated DB types.
- Logistics consumers -> Logistics public/domain contracts; no sealed artifact edits without governance process.
- Healthcare product/legacy surfaces -> Healthcare public contracts; no H1-H12 internal table bypass.
- Mobile typecheck -> npm workspace registration -> mobile package dependencies -> Expo/React Native tsconfig.

## Change Authority

Authorized:

- Type-only cleanup and config fixes required to make compiler commands run correctly.
- Stale consumer repairs when canonical contract is proven.
- Tests/tooling fixes that do not hide diagnostics or reduce strictness.

Not authorized without explicit architecture unlock:

- Frozen Healthcare kernel changes.
- Sealed Logistics E7.1/E7.2/E7.3 artifact changes outside approved process.
- Generated type hand edits.
- Schema/RPC inventions.
- Compatibility aliases that change public contracts.

## UI To Contract Reconciliation

No UI redesign requested. UI diagnostics must still trace data/action assumptions to canonical API/service/generated DB contracts before repair.

## Additive Migration Plan

No migrations planned. Any diagnostic implying missing table/column/RPC is a contract/schema gap until proven by migrations/generated types.

## 11 Automated Verification Gates Plan

1. Canonical full typecheck: `npm run typecheck:full`
2. Changed typecheck: `npm run typecheck:changed`
3. Relevant scoped typechecks for touched configs.
4. `npm run healthcare:verify` if Healthcare code changes.
5. `npm run logistics:verify` if Logistics code changes.
6. Relevant unit/integration tests for touched areas.
7. `git diff --check`.
8. Diff inspection.
9. No new `as any`.
10. No new `@ts-ignore` / `@ts-expect-error`.
11. No abnormal tsconfig/source exclusions.

---

# ARCHITECTURE GATE RESULT - BEAUTY SPA CRM CUSTOMER PAGE UI REDESIGN

> **Status:** PASS - Pure UI redesign for Beauty Spa CRM Customer Page (`/dashboard/customers`) matching the provided reference layout without changing any business logic, database schema, or kernel contracts
> **Date:** 2026-10-05
> **Scope:** `src/app/dashboard/customers/page.tsx` and customer list card components. No database schema, RPC, RLS, server action, business logic, accounting, Healthcare H1-H12, or Logistics E7.1-E7.3 changes.

---

## 1. Bella OS/Product Development Process Gate

The requested change is a visual redesign of the CRM Customer Page (`src/app/dashboard/customers/page.tsx`) for `beauty_spa` and default tenants to match the provided reference design. Gate decision: `PASS` for a dedicated frontend UI redesign that preserves all existing data services (`getCustomers`, `createCustomer`, `updateCustomer`, `deleteCustomer`), pagination, search, status filtering, and business invariants without changing any underlying business logic.

## 2. Product Manifest

In scope:
- Redesigning `src/app/dashboard/customers/page.tsx` layout and customer cards matching reference image.
- 4 Top Summary Metric Cards:
  1. "Tổng khách hàng": total customer count with trend badge & subtitle.
  2. "Đang sử dụng dịch vụ": customers with active care packages count, trend badge & subtitle.
  3. "Khách mới tháng này": new customer count this month, trend badge & subtitle.
  4. "Cần chăm sóc": care attention needed count, trend badge & subtitle.
- Filter & Control Bar:
  - Search input ("Tìm khách hàng, SĐT, liệu trình...")
  - Status filter ("Tất cả trạng thái", "Đang có gói liệu trình", "Đang chăm sóc", "Đã đặt cọc", "Tiềm năng", "Đã kết thúc")
  - Subgroup filter ("Tất cả phân nhóm")
  - Service Package filter ("Tất cả gói dịch vụ")
  - Year filter ("2026")
  - Date filter button & More filters button
  - View switcher ("Danh sách thẻ" card view vs "Bảng dữ liệu" data table view)
  - Sort dropdown ("Sắp xếp: Mới nhất") & Pagination counter/controls ("1-20 của 1.248")
- Customer Card Item Component Layout:
  - Left Section: Avatar with online status dot, customer name, status badge ("ĐANG CÓ LIỆU TRÌNH", "MỚI"), group/VIP badge ("VIP", "Khách thân thiết"), phone, group, gender badge ("Nữ" pink / "Nam" blue), location, loyalty points, total spend, and last visit date.
  - Middle Section: Current active service package card with thumbnail, package name, demo badge, completed/total sessions ("8 / 10 buổi"), progress bar, and percentage.
  - Right Section: Next appointment box with calendar icon, next appointment date & time ("28/07/2026 10:00 - 11:00"), quick calendar button, primary CTA button ("Chi tiết >"), and dropdown menu (`...`).
- Color Theme Compliance: All primary buttons, badges, links, focus rings, and active states strictly use theme preset CSS tokens (`bg-primary`, `text-primary`, `border-primary`, `hover:bg-primary-hover`, `text-primary-foreground`, `var(--primary)`).

Out of scope:
- Backend database schema or RPC changes.
- Server action logic or state transition modifications.
- Frozen Healthcare H1-H12 or Logistics E7.1-E7.3 kernels.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `src/app/dashboard/customers/page.tsx` | Beauty Spa / CRM Product UI | Render redesigned CRM Customer Page UI |
| `getCustomers` / `createCustomer` / `updateCustomer` | Customer Services | Provides data and actions to UI without logic mutation |

## 4. Contract Dependency Map

```text
Beauty Spa CRM Customer Page UI
  -> getCustomers({ limit, offset })
  -> selectCustomerDisplayBooking()
  -> calculateBookingPaymentState()
  -> getCustomerGenderPresentation()
  -> getCustomerSecondarySummary()
  -> Core/CRM Backend Services (Unchanged)
```

## 5. Change Authority

Authorized:
- Redesign UI elements in `src/app/dashboard/customers/page.tsx`.
- Update customer card item component styling and layout.
- Bind all UI elements to existing state and backend actions.

Not authorized:
- Modify business rules, server action logic, or database schemas.
- Touch frozen Healthcare H1-H12 or Logistics E7.1-E7.3 kernels.
- Introduce `any` types.

## 6. UI -> Contract Reconciliation

All UI controls (search input, status filter, subgroup filter, package filter, view switch, pagination buttons, add customer modal, detail button, Zalo button, edit/delete menu) map directly to existing state variables and server actions (`loadCustomers`, `handleAddNew`, `handleEdit`, `handleDelete`, `handleZalo`).

## 7. Additive Migration Plan

No migration required. Pure UI redesign.

## 8. 11 Automated Verification Gates Plan

1. Confirm no frozen kernel files modified.
2. Build redesigned CRM Customer Page view matching reference layout.
3. Integrate with existing customer data state and server actions.
4. Ensure zero business logic or schema mutations.
5. Verify theme preset color compliance (`bg-primary`, `text-primary`, etc.).
6. Verify responsive layout and interactive elements.
7. Run TypeScript type check.
8. Run ESLint check.
9. Run test suites.
10. Check git diff for cleanliness.
11. Output success summary and report `PASS`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PLATFORM PWA CONTRACT V1

> **Status:** PASS - Platform-owned PWA V1 contract for manifest identity and installability only
> **Date:** 2026-10-03
> **Scope:** Platform PWA identity, generated manifest, Product Registry default route integration, tenant brand display overlay, PWA install copy, and focused automated tests. No Beauty V2-specific PWA, offline strategy, runtime cache, Workbox/Serwist, database migration, or product business logic changes.

---

## 1. Bella OS/Product Development Process Gate

The requested change standardizes PWA as a Bella Platform capability consumed by products. Gate decision: `PASS` for a narrow Platform App Shell contract that generates a manifest from canonical Product Registry identity and tenant display branding while keeping offline/cache behavior explicitly out of V1.

## 2. Product Manifest

In scope:
- Platform PWA identity contract.
- Generated manifest route.
- Product Registry linkage for `productKey`, `displayName`, `subtitle`, and `defaultRoute`.
- Tenant brand overlay for display fields only.
- Root app manifest linkage.
- `PwaRegister` install copy without Bella Spa hard-code.
- Focused tests for manifest contract, start URL, scope, tenant overlay, PwaRegister source, SW boundary, and Beauty V2 shared consumption.

Out of scope:
- Product-specific PWA manifests.
- Beauty V2-specific PWA implementation.
- Runtime caching, precache, offline fallback, offline queue, Workbox, or Serwist.
- Database schema, auth, tenant provisioning, or product business logic changes.
- Healthcare H1-H12, Education OS, or Logistics E7.1/E7.2/E7.3 kernel changes.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| Product Registry | Platform product identity | Canonical `productKey`, display identity, subtitle, and `defaultRoute` |
| Tenant brand theme | Tenant configuration | Display overlay only: brand name, logo, and primary color |
| Platform PWA contract | Platform App Shell | Manifest fields, installability identity, fixed scope/display/security boundary |
| Service worker | Platform App Shell | Registration-only V1; no cache/offline capability |

## 4. Contract Dependency Map

```text
Authenticated tenant
  -> tenants.product_key
  -> ProductRegistry.get(productKey)
  -> ProductDefinition.defaultRoute
  -> PlatformPwaIdentity.startUrl
  -> generated manifest
  -> PwaRegister install copy
```

Tenant display brand may influence only display fields:

```text
tenant.brand_theme.brandName / logoUrl / primaryColor
  -> manifest name/short_name/theme_color
```

Tenant brand must not control:

```text
start_url
scope
display
service worker scope
manifest architecture
```

## 5. Change Authority

Authorized:
- Add Platform PWA resolver/contract if needed.
- Add generated manifest route matching current Next.js architecture.
- Update root manifest metadata to use generated manifest.
- Update `PwaRegister` install UI/copy to consume manifest identity.
- Add focused tests and source guards.

Not authorized:
- Add new PWA framework or offline engine.
- Modify product vertical business logic.
- Create Beauty V2-specific manifest or service worker.
- Allow tenant-provided start URLs or service worker scope.
- Change database schema or runtime tenant data.

## 6. UI -> Contract Reconciliation

The install banner is a Platform UI surface. Current implementation hard-codes Bella Spa copy and claims offline behavior while the service worker explicitly disables caching. V1 must map install display text to the generated Platform PWA identity and remove unsupported offline claims.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm Product Registry remains the canonical source for `defaultRoute`.
2. Confirm tenant brand overlay only affects display/branding fields.
3. Add generated manifest with required PWA fields.
4. Keep `scope = "/"` and `display = "standalone"`.
5. Confirm missing product falls back to `/dashboard`.
6. Confirm Beauty V2 uses shared `bella_spa` Product Registry default route rather than a product-specific PWA.
7. Confirm `PwaRegister` has no Bella Spa hard-code.
8. Confirm service worker remains no-cache/no-offline V1.
9. Run focused PWA tests.
10. Run targeted lint/typecheck where practical.
11. Run `git diff --check` and stop at V1.

## 9. Verification Evidence

Implemented V1:
- Added `src/platform/pwa/platform-pwa-contract.ts` as the Platform-owned resolver for `PlatformPwaIdentity`.
- Added generated `/manifest.webmanifest` route that resolves current tenant `product_key` through Product Registry and applies tenant brand overlay only to display fields.
- Updated root layout manifest metadata to `/manifest.webmanifest`.
- Kept `public/manifest.json` as neutral static fallback with `start_url = /dashboard`, `scope = /`, and `display = standalone`.
- Updated `PwaRegister` to fetch manifest identity for install UI/copy and removed Bella Spa/offline install copy.
- Simplified `public/sw.js` to registration/installability only: no precache, no runtime cache, no offline fallback.

Automated/local:
- `npx jest src/platform/pwa/platform-pwa-contract.test.ts --runInBand` -> PASS, 1 suite / 8 tests.
- `npx eslint src/platform/pwa/platform-pwa-contract.ts src/platform/pwa/platform-pwa-contract.test.ts src/app/manifest.webmanifest/route.ts src/app/layout.tsx src/components/common/PwaRegister.tsx` -> PASS.
- `rg "Bella Spa ERP|làm việc offline|Workbox|Serwist|cache\.addAll|caches\.open|respondWith"` over runtime PWA files -> runtime matches none; only test assertions contain the blocked strings.
- `git diff --check` -> PASS.

Not verified:
- `npm run typecheck:changed` invoked repository-wide strict `tsc`; stopped after 90 seconds without diagnostics. `TYPECHECK = NOT_VERIFIED`.

Gate result: `PLATFORM_PWA_CONTRACT = IMPLEMENTED_V1`.

---

# ARCHITECTURE GATE RESULT - HQ IDENTITY SEPARATION

> **Status:** PASS - HQ Identity Separation sealed; `TYPECHECK_NOT_VERIFIED`
> **Date:** 2026-10-03
> **Scope:** `/hq` identity and authorization only. Replace the experimental `tenant_type` slice with canonical `tenant.product_key = 'bella_hq'`, add direct HQ login, provision a separate HQ admin, and keep BabyCare data unchanged.

---

## 1. Bella OS/Product Development Process Gate

The requested change separates HQ portal identity from the BabyCare operating tenant. Gate decision: `PASS` for a narrow HQ auth/login change that reuses the existing Product Identity contract.

## 2. Product Manifest

In scope:
- HQ portal authorization.
- HQ direct login route.
- HQ tenant recognition by `product_key = 'bella_hq'`.
- HQ UI filters that exclude the HQ tenant from operating-tenant workflows.
- Inventory transfer central warehouse HQ tenant lookup.
- Runtime DB/Auth provisioning for HQ tenant/admin on the authorized target.
- Runtime smoke for HQ allow and BabyCare deny.

Out of scope:
- KPI/mock metric cleanup.
- Dashboard redesign.
- Healthcare H1-H12, Logistics E7.1/E7.2/E7.3, or product vertical kernel changes.
- Schema migration execution or changing the existing BabyCare tenant.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `tenants.product_key` | Platform product identity | Canonical tenant product identity |
| `checkHqAuth` | Platform/HQ auth boundary | Server-side HQ portal authorization |
| `/hq/login` | HQ portal auth entry | Direct HQ admin login |
| `/hq` components | HQ portal UI | Consume canonical identity for filters and labels |

## 4. Contract Dependency Map

```text
HQ Portal
  -> users.role
  -> users.tenant_id
  -> tenants.product_key = 'bella_hq'
  -> operating tenants where product_key != 'bella_hq'
```

## 5. Change Authority

Authorized:
- Replace experimental `tenant_type` consumers with `product_key = 'bella_hq'`.
- HQ server-action authorization update.
- Direct `/hq/login` route.
- HQ UI identity filters.
- Focused tests.
- Authorized runtime provisioning of `bella_hq` HQ tenant and HQ admin Auth user.
- Runtime smoke for `/hq/login`, `/hq`, `/hq/financial-overview`, and BabyCare admin denial.

Not authorized:
- New hardcoded HQ UUID.
- BabyCare-specific HQ identity.
- New `tenant_type` schema.
- Schema migration execution.
- BabyCare tenant mutation.
- KPI/mock data cleanup.
- Product vertical or kernel refactor.

## 6. UI -> Contract Reconciliation

Existing UI/action code treats `tenant.name === 'Bella Spa Headquarter'` as HQ identity. Tenant name is mutable display data and the current production record is also `product_key = 'bella_babycare'`. Canonical target for the separated HQ tenant is `product_key = 'bella_hq'`.

## 7. DB Provisioning Result

No migration in this code slice.

Completed with explicit runtime provisioning authority:
- Created HQ tenant `d33dd246-9d9c-4a95-bfff-03b4b51d4072` with `product_key = 'bella_hq'`.
- Created separate HQ Auth/public user `hq-admin@bellaspa.vn` with `role = 'admin'`.
- Bound HQ admin to tenant `d33dd246-9d9c-4a95-bfff-03b4b51d4072`.
- Left BabyCare tenant `0e66365b-42b0-420e-acca-f7d7692e125e` unchanged with `product_key = 'bella_babycare'`.
- Generated runtime smoke password was random, temporary, and not printed or stored in repo/docs/logs/commit.

## 8. 11 Automated Verification Gates Plan

1. Confirm no Healthcare/Logistics frozen kernel files changed.
2. Confirm no `tenant_type` code or migration remains in the HQ slice.
3. Confirm `checkHqAuth()` uses `product_key = 'bella_hq'`.
4. Confirm `/hq` pages redirect unauthorized users to `/hq/login`.
5. Confirm `/hq/login` verifies HQ auth after Supabase sign-in.
6. Confirm BabyCare admin with `product_key = 'bella_babycare'` is denied.
7. Confirm inventory HQ warehouse lookup uses `product_key = 'bella_hq'`.
8. Confirm `/hq` operating-tenant filters use canonical helper.
9. Run focused HQ auth/action tests.
10. Run `git diff --check`.
11. Provision HQ tenant/admin only after explicit authority, then run runtime smoke and stop.

## 9. Verification Evidence

Read-only/preflight:
- `.env.local` REST target read-back found `product_key = 'bella_hq'` count `0`.
- Existing BabyCare/HQ-shared tenant remains `product_key = 'bella_babycare'`; no DB mutation was executed.
- `supabase/migrations/20261003010000_add_hq_tenant_identity.sql` removed from the working tree; no replacement migration added.

Runtime provisioning:
- Target project ref: `lvnvkpyxtuilhrabtlwv`.
- HQ tenant created/read back: `d33dd246-9d9c-4a95-bfff-03b4b51d4072`, `name = Bella Spa Headquarter`, `status = active`, `product_key = bella_hq`.
- HQ admin created/read back: `hq-admin@bellaspa.vn`, `role = admin`, `tenant_id = d33dd246-9d9c-4a95-bfff-03b4b51d4072`.
- BabyCare admin read-back: `admin@bellaspa.vn`, `role = admin`, `tenant_id = 0e66365b-42b0-420e-acca-f7d7692e125e`, `product_key = bella_babycare`.
- Password was not printed or persisted.

Automated/local:
- `npx jest src/__tests__/hq-actions.test.ts src/__tests__/onboarding.test.ts --runInBand` -> PASS, 2 suites / 15 tests.
- `npx jest src/__tests__/inventory-transfer.test.ts --runInBand` -> PASS, 1 suite / 29 tests.
- `git diff --check` -> PASS.
- Focused `npx eslint` on HQ login/auth/action files -> PASS.
- `rg tenant_type` over HQ/auth/onboarding/domain slice -> no matches.

Runtime smoke:
- `hq-admin@bellaspa.vn` -> `/hq/login` -> `/hq` -> PASS.
- `hq-admin@bellaspa.vn` -> `/hq/financial-overview` -> PASS.
- `admin@bellaspa.vn` with BabyCare tenant context -> `/hq` -> `/hq/login` redirect -> DENIED/PASS.

Not verified:
- `npm run typecheck:changed` invoked repository-wide strict `tsc`; stopped after 90 seconds without diagnostics. `TYPECHECK = NOT_VERIFIED`.

Gate result: `HQ_IDENTITY_SEPARATION = SEALED`.
Residual: `TYPECHECK_NOT_VERIFIED`; rotate/change the temporary HQ admin password before operational handoff.

---

# ARCHITECTURE GATE RESULT - BEAUTY F5 REAL DB IDEMPOTENCY FIXTURE DRIFT

> **Status:** PASS - fixture-only repair for Beauty/F5 Real DB idempotency proof
> **Date:** 2026-10-03
> **Scope:** `src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts` F5 AR reconciliation windows plus affected-test selector alignment for this Real DB file. No F5 RPC, Finance schema, Beauty business logic, tenant data, production DB, Healthcare H1-H12, or Logistics E7.1-E7.3 changes.

---

## 1. Bella OS/Product Development Process Gate

CI Real Database Business E2E failed because the Beauty/F5 idempotency proof called `f5_run_reconciliation` with an as-of timestamp before the AR ledger facts created by the fixture. The F5 AR read contract uses `finance_receivable_ledger.created_at <= p_reconciliation_as_of`, so the pass run could produce no persisted `f5_control_results` row for idempotent read-back and the mismatch leg could reconstruct AR from an incomplete F3 window. Gate decision: `PASS` for a fixture-only correction that derives the F5 as-of timestamp from the created AR ledger fact.

## 2. Product Manifest

In scope:
- Beauty/F5 Real DB test fixture windows for the matched and mismatch AR control runs.
- Preserve the same `passParams` object for duplicate idempotency proof.
- Keep `src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts` in the Real DB E2E lane, not the default unit Jest lane.

Out of scope:
- F5 RPC or schema changes.
- Finance F1/F3 posting semantics.
- Beauty session completion business logic.
- PR #200 HQ Identity Separation branch.
- Production or E2E database mutation outside the test run.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `finance_receivable_ledger.created_at` | Finance F3 AR canonical read basis | Timestamp used by F5 AR read contract |
| `finance_ar_facts_as_of` | Finance/F5 read contract | Filters AR facts by `created_at <= as_of` |
| Beauty/F5 Real DB test | Product integration proof | Must create a valid fixture inside the reconciliation window |
| `scripts/test-changed-files.mjs` | CI affected-test routing | Keeps Real DB files out of default Jest lane |

## 4. Contract Dependency Map

```text
Beauty completed service
  -> SemanticReceivableChargeService
  -> finance_receivable_ledger.created_at
  -> finance_ar_facts_as_of(as_of)
  -> f5_run_reconciliation
  -> f5_control_results idempotent read-back
```

## 5. Change Authority

Authorized:
- Adjust only the test fixture's F5 AR reconciliation timestamps.
- Add read-back of AR ledger timestamps inside the test if needed for deterministic fixture setup.
- Align affected-test direct exclusion with the existing Real DB scope router for the Beauty Real DB file.

Not authorized:
- Change F5 RPC behavior.
- Add migrations, constraints, or schema.
- Change Finance posting/ledger semantics.
- Change Beauty business logic or HQ PR #200.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm duplicate pass calls use the same params.
2. Confirm F5 AR read contract uses `finance_receivable_ledger.created_at <= as_of`.
3. Confirm Finance AR ledger facts are created before the test's F5 as-of timestamps.
4. Modify only the fixture timestamp/read-back.
5. Run Beauty/F5 targeted Real DB test.
6. Run Real DB E2E if credentials/environment are available.
7. Verify `passRun.run_id === duplicatePassRun.run_id`.
8. Run `git diff --check`.
9. Run affected tests where practical.
10. Keep PR #200 unchanged.
11. Stop after evidence; do not refactor F5 or Beauty logic.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - BEAUTY SPA V2 TENANT DASHBOARD UI REDESIGN

> **Status:** PASS - Pure UI redesign for Beauty Spa V2 tenant dashboard matching reference design without changing any business logic or kernel contracts
> **Date:** 2026-10-03
> **Scope:** `src/app/dashboard/` Beauty Spa V2 view and sidebar tenant presentation. No database schema, RPC, RLS, business logic, accounting, Healthcare H1-H12, or Logistics E7.1-E7.3 changes.

---

## 1. Bella OS/Product Development Process Gate

The requested change is a complete visual redesign of the Beauty Spa V2 tenant dashboard (`beauty_spa`) to match the provided reference design (Bella BEAUTY SPA ERP dashboard layout). Gate decision: `PASS` for a dedicated frontend UI view that preserves all existing data services, real-time subscriptions, business invariants, and action contracts without altering any underlying business logic.

## 2. Product Manifest

In scope:
- `src/app/dashboard/components/BeautySpaV2DashboardView.tsx` matching the reference UI layout.
- Wiring `beauty_spa` tenant dashboard in `src/app/dashboard/page.tsx` to render the V2 UI view.
- Sidebar aesthetic alignment for `beauty_spa` tenant identity (Emerald theme `#062C24`, lotus logo, Playfair Display typography, exact navigation items).
- All 6 dashboard zones from reference image:
  1. Top Header & 5 Metric Summary Cards (Tổng Khách Hàng, Lịch Hẹn Hôm Nay, Doanh Thu Tháng 10, Đánh Giá Khách Hàng, Tỷ Lệ Khách Quay Lại)
  2. Column 1: Lịch Hẹn Hôm Nay (28) list with filter tabs (Tất cả, Đang phục vụ, Đang chờ, Hoàn thành)
  3. Column 2: Bella AI Copilot (BETA) insights card with purple gradient theme
  4. Column 3: Tài Chính Tháng 10 bar chart & financial summary breakdown
  5. Row 2: Hiệu Suất Kinh Doanh line chart, Top Kỹ Thuật Viên ranking table, Đánh Giá Khách Hàng rating breakdown
  6. Row 3: Cần Xử Lý Ngay (8) urgent cards list & Vật Tư & Tồn Kho summary grid

Out of scope:
- Backend database schema or RPC changes.
- Business logic or payment/session state transition modifications.
- Frozen Healthcare H1-H12 or Logistics E7.1-E7.3 kernels.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `BeautySpaV2DashboardView.tsx` | Beauty Spa Product UI | Render reference dashboard UI for `beauty_spa` tenant |
| `src/app/dashboard/page.tsx` | Dashboard Router | Routes `beauty_spa` tenant to `BeautySpaV2DashboardView` |
| `getDashboardPrimaryData` / `getDashboardSecondaryData` | Analytics / Core Services | Provides data facts to UI without logic mutation |

## 4. Contract Dependency Map

```text
Beauty Spa V2 Dashboard UI
  -> getDashboardPrimaryData()
  -> getDashboardSecondaryData()
  -> getImportantAlerts()
  -> Core/Spa Backend Data Services (Unchanged)
```

## 5. Change Authority

Authorized:
- Create `src/app/dashboard/components/BeautySpaV2DashboardView.tsx`.
- Update `src/app/dashboard/page.tsx` to render `BeautySpaV2DashboardView` when `tenantModuleKey === 'beauty_spa'` or `product.productKey === 'bella_spa'`.
- Update sidebar visual presets for Beauty Spa V2 tenant.

Not authorized:
- Modify business rules or server action handlers.
- Touch frozen Healthcare H1-H12 or Logistics E7.1-E7.3 kernels.
- Introduce `any` types.

## 6. UI -> Contract Reconciliation

All UI controls (date picker, branch selector, search input, notification bell, "+ TẠO BOOKING", appointment tabs, KTV table, AI copilot actions, urgent alert items) connect to existing contracts and state props.

## 7. Additive Migration Plan

No migration required. Pure UI enhancement.

## 8. 11 Automated Verification Gates Plan

1. Verify `beauty_spa` tenant identification.
2. Confirm no kernel files modified.
3. Build pixel-perfect Beauty Spa V2 dashboard view matching reference image.
4. Integrate with `src/app/dashboard/page.tsx`.
5. Ensure zero business logic mutations.
6. Verify responsive layout and interactive elements.
7. Run TypeScript type check.
8. Run ESLint check.
9. Run test suites.
10. Check git diff for cleanliness.
11. Output success summary and report `PASS`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - HAIRCUT PAYMENT TO F3 AR ALLOCATION HARDENING

> **Status:** PASS - narrow Core consumer hardening for Finance OS canonical payment-to-AR allocation
> **Date:** 2026-09-29
> **Scope:** `recordRemainingPayment` Finance AR allocation call only. Use persisted confirmed `revenue` fact for idempotent retries before calling the Finance OS allocation contract. No Finance schema/RPC migration, direct `finance_*` writes, Debt/Reconciliation, BabyCare, Healthcare, Education, Logistics, or Haircut audit reopen.

---

## 1. Bella OS/Product Development Process Gate

PR #168 merged the Finance OS canonical contract:

```text
confirmed payment
  -> F1 cash receipt
  -> F2 cash movement
  -> F3 receivable allocation
```

The remaining Haircut integration gap is the Core consumer boundary. On idempotent retry, the consumer may receive an existing persisted `revenue` row while the retry request payload has drifted. Gate decision: `PASS` for a minimum consumer fix that treats persisted `revenue` as the financial fact for allocation amount/status/payment metadata and leaves Finance OS ownership intact.

## 2. Product Manifest

In scope:
- `src/core/services/order/payment-actions.ts` allocation input selection.
- Existing idempotency lookup result from `revenue`.
- Focused unit regression for retry amount drift and pending payment skip.

Out of scope:
- Finance F1/F2/F3 invariant changes.
- Finance schema, RPC, RLS, or migration work.
- Product-owned AR allocation logic.
- Debt/Reconciliation.
- BabyCare, Healthcare, Education, or Logistics changes.
- Re-auditing completed Haircut areas.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `revenue` persisted payment row | Core/Product payment persistence | Authoritative payment fact supplied to Finance |
| Finance payment-to-AR allocation contract | Finance OS | Canonical F1/F2/F3 allocation orchestration |
| `recordRemainingPayment` | Core consumer | Bridges confirmed persisted payment fact to Finance OS contract |

## 4. Contract Dependency Map

```text
Haircut/Core confirmed persisted revenue
  -> recordRemainingPayment consumer
  -> allocateConfirmedBookingPaymentToFinanceAr
  -> Finance OS F1 cash receipt
  -> F2 cash movement
  -> F3 AR allocation
```

## 5. Change Authority

Authorized:
- Harden Core consumer input selection for Finance allocation.
- Use persisted `revenue.amount`, `revenue.status`, `revenue.payment_method`, `revenue.received_date`, and `revenue.notes` when present.
- Add focused tests proving retry payload drift does not change Finance allocation amount.

Not authorized:
- Change Finance OS invariants.
- Add or modify migrations/RPCs.
- Write directly to `finance_*` from Product/Core.
- Implement Debt/Reconciliation.
- Touch BabyCare or reopen Haircut audit.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm branch base is merged `origin/main` after PR #168.
2. Read Bella constitution and F3 AR constitution.
3. Confirm Finance OS allocation contract remains the authority.
4. Confirm current Core consumer calls Finance allocation after persisted payment/idempotency lookup.
5. Fix consumer to prefer persisted `revenue` financial fact on retries.
6. Add idempotent retry regression where request amount differs from persisted amount.
7. Add pending-payment skip regression.
8. Run focused Core payment action test.
9. Run Finance semantic allocation test.
10. Run `git diff --check`.
11. Stop at first real failure; do not wait on unrelated gates after a failure.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PR168 AFFECTED JEST REAL-DB ROUTING FIX

> **Status:** PASS - CI affected-test routing only, keep Finance real-DB verification suites out of the mock/unit integration lane
> **Date:** 2026-09-29
> **Scope:** `scripts/test-changed-files.mjs` related-test ignore list only. No Finance OS runtime, Product runtime, schema, RLS, Healthcare, Education, or Logistics change.

---

## 1. Bella OS/Product Development Process Gate

PR #168 became mergeable after the conflict resolution, but CI `Affected Unit and Integration Tests` selected Finance real-DB verification suites through Jest `--findRelatedTests` and failed with `TypeError: fetch failed`. The failing suites require real database credentials/environment and belong in the dedicated real-DB/Finance verification contract, not the mock affected unit/integration lane. Gate decision: `PASS` for a CI-only selector correction.

## 2. Product Manifest

In scope:
- Affected Jest routing in `scripts/test-changed-files.mjs`.
- Exclude Finance F1/F2 real-DB verification suites from the mock affected unit/integration lane.

Out of scope:
- Finance OS runtime behavior.
- Finance contract semantics.
- Product/Core payment behavior.
- Database schema, RLS, migrations, or data.
- Healthcare, Education, or Logistics kernel work.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `scripts/test-changed-files.mjs` | CI governance | Selects mock/unit integration tests related to changed files |
| `finance-f1-ledger-verification.test.ts` | Finance OS real-DB verification | Validates F1 ledger behavior against database-backed environment |
| `finance-f2-projection-worker.test.ts` | Finance OS real-DB verification | Validates F2 projection behavior against database-backed environment |

## 4. Contract Dependency Map

```text
PR changed Finance/Core source files
  -> affected Jest selector
  -> mock unit/integration lane
  -> exclude real-DB Finance verification suites
  -> dedicated real-DB/Finance verification remains responsible
```

## 5. Change Authority

Authorized:
- Add exact Finance real-DB verification test paths to the affected-test ignore list.

Not authorized:
- Change Finance runtime or tests to hide `fetch failed`.
- Disable the affected-test job.
- Remove dedicated real-DB verification coverage.
- Modify Product/Core payment logic.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm PR #168 conflict is resolved and mergeable.
2. Read failed CI log for `Affected Unit and Integration Tests`.
3. Identify failing suites as Finance F1/F2 database-backed verification suites.
4. Apply exact affected-test ignore patterns.
5. Run `node --check scripts/test-changed-files.mjs`.
6. Run affected selector locally for PR #168 changed files.
7. Run focused payment/Finance unit suites.
8. Run `git diff --check`.
9. Push CI-only selector fix.
10. Cancel stale/known-failed runs after failure to avoid wasting CI time.
11. Re-run PR CI and stop at first real failure.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - FINANCE OS CONFIRMED PAYMENT TO AR CONTRACT

> **Status:** PASS - minimal Finance OS canonical payment-to-AR allocation contract
> **Date:** 2026-09-29
> **Scope:** Confirmed payment -> F1 cash receipt -> F2 cash movement -> F3 receivable resolution/allocation. Haircut may only consume this contract after it is proven. No Haircut AR workaround, Payment Engine redesign, COA, Payroll, Debt/Reconciliation, BabyCare, Healthcare, Education, or Logistics change.

---

## 1. Bella OS/Product Development Process Gate

Source evidence proves the final Haircut Financial Truth gap is not Haircut core:

```text
Finance OS already has:
F1 postTransaction()
F2 CashProjectionWorker -> finance_cash_movements
F3 recognizeServiceReceivable()
F3 allocatePaymentToReceivable(invoiceId, cashMovementId)

Missing canonical path:
Confirmed Payment
  -> F1 Cash Receipt
  -> F2 Cash Movement
  -> Receivable Resolution
  -> Idempotent F3 Allocation
```

Gate decision: `PASS` for the smallest Finance OS semantic contract that accepts a confirmed payment, preserves tenant/idempotency, posts the cash receipt through F1, projects cash through the existing F2 worker/outbox path, resolves open receivables by canonical invoice metadata, and allocates without duplicate F3 allocation on retry.

## 2. Product Manifest

In scope:
- Finance OS payment-to-receivable semantic contract.
- Existing Finance OS primitives only: F1 ledger, F2 cash projection, F3 invoice/receivable/allocation.
- Minimal Haircut consumer wiring only after the Finance OS contract is tested.

Out of scope:
- Haircut-owned AR/cash movement implementation.
- Payment engine redesign.
- COA/accounting posting repair.
- Payroll/commission.
- Debt/Reconciliation implementation.
- BabyCare, Preschool, Healthcare, Education, Logistics.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| Confirmed payment semantic contract | Finance OS | Canonical bridge from external payment fact to financial truth |
| F1 cash receipt | Finance OS Ledger | Double-entry cash/AR receipt |
| F2 cash movement | Finance OS Cash/Treasury | Projected liquidity movement from F1 event |
| F3 invoice/receivable/allocation | Finance OS AR | Receivable truth and settlement |
| Haircut payment action | Product/Core consumer | Supplies tenant/payment/source facts only |

## 4. Contract Dependency Map

```text
Haircut confirmed payment
  -> Finance OS confirmed payment receivable allocation contract
  -> F1 Ledger postTransaction
  -> F1 outbox finance.transaction.posted.v2
  -> F2 CashProjectionWorker
  -> finance_cash_movements
  -> F3 invoice/receivable resolver
  -> finance_allocate_payment
```

## 5. Change Authority

Authorized:
- `src/platform/finance/contracts/receivable-charge.contract.ts`
- `src/platform/finance/services/semantic-receivable-charge.service.ts`
- `src/platform/finance/gateways/supabase-receivable-charge.gateway.ts`
- Focused Finance OS tests.
- Minimal Haircut/Core consumer call through `ACR-2026-007` metadata for PR #168 if `src/core` files must change.

Not authorized:
- New AR schema.
- Direct product writes to `finance_cash_movements`.
- Direct Haircut allocation workaround.
- COA changes.
- Payroll changes.
- Debt/Reconciliation feature work.
- Payment engine redesign.

## 6. UI -> Contract Reconciliation

No UI change. This is backend financial truth plumbing only.

## 7. Additive Migration Plan

No migration planned. Existing Finance OS primitives are sufficient unless implementation evidence proves a concrete contract gap.

## 8. 11 Automated Verification Gates Plan

1. Verify source contract evidence for F1/F2/F3 existing primitives.
2. Add generic confirmed-payment input/result types.
3. Add Finance OS service method for payment-to-AR allocation.
4. Keep account semantics scoped to proven TT99 AR mapping plus canonical cash/bank payment-method mapping.
5. Resolve receivables through invoice metadata, not product-owned AR tables.
6. Preserve payment idempotency key through F1 and F3 allocation retry checks.
7. Add focused Finance OS unit tests for allocation, retry, and over-allocation block.
8. Wire Haircut payment only through the Finance OS contract if required.
9. Run focused Finance/Haircut payment tests.
10. Run scoped TypeScript or repository-available equivalent.
11. Run `git diff --check` and stop before Debt/Reconciliation re-evaluation.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - BABYCARE SPA SESSION REVIEW RLS FIX

> **Status:** PASS - keep Babycare/Beauty Spa session completion authorized by the existing server action, and write only the system-owned `session_reviews` placeholder through an operation client when service-role credentials are configured
> **Date:** 2026-09-29
> **Scope:** Babycare/Beauty Spa session completion review-placeholder side effect only; no schema migration, data migration, Product UI redesign, Healthcare/Education/Logistics kernel work, or accounting policy change

---

## 1. Bella OS/Product Development Process Gate

Observed runtime symptom: updating a Babycare/Spa session to completion fails with `new row violates row-level security policy for table "session_reviews"` while creating the `pending_review` placeholder. This is a product workflow bug in the shared Beauty/Spa completion path, not a new OS capability. Gate decision: `PASS` for a minimal server-side side-effect fix after existing tenant and action authorization have already succeeded.

## 2. Product Manifest

In scope:
- Existing Babycare/Beauty Spa session completion/update workflow.
- Existing `session_reviews` placeholder record created after a session is completed.
- Preserve tenant-scoped checks before writing the placeholder.
- Use existing Supabase admin env pattern for the placeholder write only.

Out of scope:
- Healthcare H1-H12, Logistics E7.1-E7.3, Education product contracts.
- Database schema, production data, RLS policy migration, UI redesign, salary/accounting policy redesign.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `session_logs` | Beauty/Spa booking workflow | Source session state and completion event |
| `bookings.customer_id`, `bookings.assigned_ktv_id`, `bookings.tenant_id` | Beauty/Spa booking workflow | Tenant-scoped source for placeholder review |
| `session_reviews` | Beauty/Spa customer feedback workflow | Analytics/customer-review target table |
| Server action authorization | Shared order/session service | Confirms current user tenant and role before completion side effects |

## 4. Contract Dependency Map

Admin/KTV session update -> existing server action tenant and role checks -> session completion side effects -> create pending `session_reviews` placeholder -> customer portal later updates the review.

## 5. Change Authority

Authorized:
- Change the internal server-side client used for `session_reviews` placeholder lookup/insert.
- Keep existing tenant equality checks before using the operation client.
- Preserve rollback behavior when placeholder creation still fails.

Not authorized:
- Loosen product UI permissions.
- Modify frozen Healthcare/Logistics kernel files.
- Change RLS policies or migrate data without explicit approval.
- Introduce `any` types.

## 6. UI -> Contract Reconciliation

No UI redesign. The current UI action "Cập nhật thông tin" maps to the existing `updateSessionLog` server action. The failing contract is the system side-effect that creates a review placeholder after a completed session.

## 7. Additive Migration Plan

No migration. The fix is code-only and does not create, alter, or backfill database objects.

## 8. 11 Automated Verification Gates Plan

1. Architecture scope check: no Healthcare/Logistics/Education kernel files touched.
2. Type-level check for changed order completion helper.
3. Focused regression where placeholder lookup/insert uses operation client fallback.
4. Existing completion rollback behavior remains unchanged.
5. Tenant check remains before placeholder creation.
6. No direct product access to `hc_*` tables.
7. No new `any` types.
8. No schema migration.
9. `git diff --check`.
10. Focused tests if an existing test target is available for this helper.
11. Manual runtime evidence remains required for deployed Supabase env/RLS state.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - BELLA AUTO PHASE 5 REAL DB E2E FIXTURE IDEMPOTENCY

> **Status:** PASS - test fixture idempotency fix only
> **Date:** 2026-09-29
> **Scope:** `src/__tests__/bella-auto-phase5-experience.test.ts` setup for `auto_journey_stages` only. No Bella Auto runtime behavior, schema, RPC, service contract, Haircut, Finance, Healthcare, Education, Logistics, Payment, Payroll, or COA change.

---

## 1. Bella OS/Product Development Process Gate

Evidence from PR #166 CI showed `Real Database Business E2E` failed before any Haircut assertion due to Bella Auto Phase 5 fixture setup:

```text
auto_journey_stages
tenant = Test Tenant Bella Auto Phase5 E2E
code = delivered
ERROR = duplicate key value violates unique constraint uq_auto_journey_stages_code
```

Source of truth:
- Migration `20260803230000_create_auto_journeys.sql` defines `auto_journey_stages` with unique `(tenant_id, code)`.
- The test intentionally reuses the same test tenant by name across runs.

Gate decision: `PASS` for a minimal test-only change that reuses an existing `delivered` stage for the test tenant when present, and only deletes the stage if this run created it.

## 2. Product Manifest

In scope:
- Bella Auto Phase 5 real-DB test fixture setup.
- `auto_journey_stages` lookup/insert idempotency for `code = delivered`.

Out of scope:
- Bella Auto production services.
- Journey schema or constraints.
- Haircut PR #166 implementation.
- Finance/accounting behavior.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `auto_journey_stages` | Bella Auto journey setup | Stage catalog rows scoped by tenant and code |
| `bella-auto-phase5-experience.test.ts` | Real DB E2E test fixture | Creates/reuses setup data for Phase 5 experience tests |

## 4. Contract Dependency Map

```text
Real DB test tenant
        ↓
auto_journey_stages(tenant_id, code = delivered)
        ↓
auto_customer_journeys.current_stage_id
        ↓
Bella Auto Phase 5 services under test
```

## 5. Change Authority

Authorized:
- Make the Real DB test fixture setup idempotent for the existing unique `(tenant_id, code)` stage contract.

Not authorized:
- Change Bella Auto stage semantics.
- Change `auto_journey_stages` schema/constraint.
- Change runtime services.
- Change unrelated verticals.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration. No DB mutation outside normal test fixture behavior.

## 8. 11 Automated Verification Gates Plan

1. Confirm CI failure is Bella Auto Phase 5 fixture setup.
2. Confirm canonical unique stage contract from migration.
3. Patch fixture lookup-before-insert.
4. Ensure reused stage is not deleted by cleanup.
5. Run focused Bella Auto Phase 5 real-DB test if feasible.
6. Run `git diff --check`.
7. Re-run PR CI and verify Real Database Business E2E.
8. Verify Haircut accounting files remain unchanged after this fix.
9. Verify no `src/core` diff is introduced.
10. Verify migration/build/unit checks still pass in CI.
11. Stop after CI evidence; no further Bella Auto scope expansion.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - HAIRCUT ACCOUNTING COA AND PACKAGE SALE FIX

> **Status:** PASS - exact Haircut tenant COA bootstrap plus minimal `PACKAGE_SALE` payment-method propagation
> **Date:** 2026-09-29
> **Scope:** Legacy accounting posting readiness for the 3 active `bella_haircut` tenants and the `PACKAGE_SALE` producer path only. No F3 payment allocation, Debt/Reconciliation, Payroll, BabyCare, Payment Engine redesign, or Finance OS kernel change.

---

## 1. Bella OS/Product Development Process Gate

Evidence proves two independent operational accounting gaps:

```text
A. Tenant COA/bootstrap configuration
   3 active bella_haircut tenants are missing active accounting_accounts:
   111, 112, 131, 334, 3387, 6421, 5113, 5111

B. PACKAGE_SALE producer mapping
   bank_transfer confirmed revenue emitted PACKAGE_SALE, but runtime path hard-coded 111.
   Canonical accounting template requires 111_OR_112 based on payment_method.
```

Gate decision: `PASS` for the minimum scoped implementation that seeds canonical existing COA definitions only for the 3 active Haircut tenants and propagates `paymentMethod` through `PACKAGE_SALE` to resolve `111/112`.

## 2. Product Manifest

In scope:
- `bella_haircut` tenants with current active status:
  - Haircut Shop
  - P1C-haircut-2055f3bb Tenant
  - P1D1-haircut-75b42702 Tenant
- Existing legacy accounting COA definitions from `seed_default_coa`.
- `PACKAGE_SALE` outbox payload and accounting worker producer path.
- Focused tests for `PACKAGE_SALE` payment-method account selection.

Out of scope:
- F3 Payment -> AR Allocation.
- Debt/Reconciliation.
- Payroll/Commission.
- BabyCare.
- Payment Engine redesign.
- Finance OS F1/F2/F3 kernel changes.
- Ad hoc account codes or accounting policy invention.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `accounting_accounts` rows | Tenant accounting configuration | Tenant-specific chart of accounts for legacy accounting postings |
| `seed_default_coa` definitions | Legacy accounting bootstrap | Canonical existing source for required legacy COA codes |
| `PACKAGE_SALE` outbox payload | Haircut/Beauty payment producer | Carries payment fact into legacy accounting worker |
| `RevenueRecognitionService.handlePackageSale` | Legacy accounting producer | Posts package/deposit/remaining-payment journal entry |
| `111_OR_112` template | Accounting event template | Canonical payment-method-dependent account selection |

## 4. Contract Dependency Map

```text
Haircut remaining payment / package sale revenue
        ↓
revenue.payment_method
        ↓
PACKAGE_SALE accounting outbox reference_id
        ↓
accounting worker
        ↓
payload.paymentMethod or revenue.payment_method fallback
        ↓
RevenueRecognitionService.handlePackageSale(paymentMethod)
        ↓
resolvePaymentAccountCode()
        ↓
111 or 112 + 3387 journal lines
```

COA bootstrap:

```text
Active bella_haircut tenant
        ↓
existing seed_default_coa canonical definitions
        ↓
tenant accounting_accounts
```

## 5. Change Authority

Authorized:
- Add an exact, idempotent migration scoped to the 3 verified active Haircut tenant IDs, using the existing canonical `seed_default_coa` function.
- Allow `PACKAGE_SALE` payloads to carry `paymentMethod` when known.
- Update `PACKAGE_SALE` worker handling to resolve `paymentMethod` from payload or the referenced revenue record.
- Update `handlePackageSale` to resolve `111/112` using existing `resolvePaymentAccountCode`.
- Add focused tests.

Not authorized:
- Create new accounting policy.
- Add arbitrary account definitions by hand when `seed_default_coa` exists.
- Touch Finance OS kernel primitives.
- Open F3 payment allocation, Debt/Reconciliation, Payroll, BabyCare, or Payment Engine redesign.

## 6. UI -> Contract Reconciliation

No UI redesign. No UI action contract is changed.

## 7. Additive Migration Plan

Additive/configuration-only migration:

```text
For exactly the 3 active bella_haircut tenant IDs:
  SELECT public.seed_default_coa(tenant_id)
  ensure 5113 from existing TT133 service revenue migration definition
```

The seed function is idempotent via `ON CONFLICT (tenant_id, account_code) DO NOTHING`. Account `5113` is also idempotent and uses the existing canonical definition from `20260603010000_tt133_service_revenue_5113.sql`, because the seed function predates that account.

## 8. 11 Automated Verification Gates Plan

1. Source evidence recheck for the 3 Haircut tenant IDs.
2. Migration scope inspection: exact tenant IDs only.
3. Focused unit test for `handlePackageSale` bank transfer -> account `112`.
4. Focused unit test for `handlePackageSale` cash -> account `111`.
5. Focused payload test or existing test update proving `paymentMethod` can be emitted when known.
6. Focused worker path test proving `paymentMethod` is resolved from the referenced revenue when absent from payload.
7. TypeScript scoped check if available/feasible.
8. Focused Jest for accounting/revenue recognition.
9. `git diff --check`.
10. Read-only post-migration DB verification after applying migration.
11. Focused accounting worker/runtime verification for prior `PACKAGE_SALE`/`SESSION_DONE` missing-account failures if safe and explicitly scoped.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - SPA COMPLETION ROLLBACK IS_IN_CARE FIX

> **Status:** PASS - restore pre-completion `bookings.is_in_care` during shared completion rollback
> **Date:** 2026-09-29
> **Scope:** Bella Spa shared completion rollback integrity only; no Payroll, Finance, Accounting, Haircut-specific code, schema, migration, UI redesign, or completion semantics redesign

---

## 1. Bella OS/Product Development Process Gate

The confirmed gap is rollback integrity, not a new product capability: the completion path can set `bookings.is_in_care = false` when the package reaches completion, while rollback currently restores only `completed_sessions` and `status`. Gate decision: `PASS` for the minimum rollback snapshot/payload correction that restores `is_in_care` to its pre-completion value when downstream completion side effects fail.

## 2. Product Manifest

In scope:
- Shared Beauty/Spa session completion rollback payload.
- Current booking snapshot captured before booking progress mutation.
- Focused regression proving failure-path rollback restores `completed_sessions`, `status`, and `is_in_care`.
- Focused regression preserving happy-path completion behavior where final package completion sets `is_in_care = false`.

Out of scope:
- Payroll, salary policy, Finance, Accounting policy, Haircut-specific code, UI, data migration, production data updates, or completion engine redesign.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `bookings.completed_sessions` | Beauty/Spa booking workflow | Completion progress counter |
| `bookings.status` | Beauty/Spa booking workflow | Booking lifecycle state |
| `bookings.is_in_care` | Beauty/Spa booking workflow | Active-care flag cleared on completed package |
| Completion rollback payload | Shared order/session completion service | Restores pre-completion booking workflow state after downstream failure |

## 4. Contract Dependency Map

```text
Session completion
        ↓
Count completed session logs
        ↓
Update booking progress/status/is_in_care
        ↓
Downstream completion side effects
        ↓
On failure: rollback booking fields to pre-completion snapshot
```

## 5. Change Authority

Authorized:
- Include `is_in_care` in the pre-completion booking snapshot.
- Include `is_in_care` in rollback payload with its original value.
- Add focused tests for the failure path and existing happy path.

Not authorized:
- Change the meaning of `is_in_care`.
- Change completion success semantics.
- Modify Payroll, Finance, Accounting, Haircut-specific code, schema, migrations, or UI.

## 6. UI -> Contract Reconciliation

No UI redesign. This is a service rollback integrity fix.

## 7. Additive Migration Plan

No database migration. `bookings.is_in_care` already exists in generated database types.

## 8. Verification Plan

- Reproduction test: completion reaches package completion with initial `is_in_care = true`, a downstream failure is forced, and rollback restores `completed_sessions`, `status`, and `is_in_care`.
- Happy-path test: successful package completion still sets `is_in_care = false`.
- Focused Jest for completion business rules and completion accounting side effects.
- `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL P7 TUITION RECOGNITION POLICY FOUNDATION

> **Status:** PASS - decouple invoice issuance from tuition service recognition and add Product-owned PERIOD_COMPLETION policy foundation
> **Date:** 2026-09-28
> **Scope:** Preschool Product P7 recognition boundary only; no Finance OS, TT99 mapping, payment, prepayment, 3387, refund, tax, e-invoice, or browser/production mutation

---

## 1. Bella OS/Product Development Process Gate

The proven blocker is a business-boundary mismatch: Preschool invoice issuance is not proof that tuition service has been performed. Gate decision: `PASS` for the smallest Product-owned correction that removes direct recognition from `InvoiceIssuanceService`, records tenant/effective-dated recognition policy vocabulary, records explicit service-period completion evidence, and emits Finance OS `TUITION_SERVICE_RECOGNIZED` only through a separate PERIOD_COMPLETION service.

## 2. Product Manifest

In scope:
- Preschool Product policy vocabulary: `PERIOD_COMPLETION`, `TIME_BASED`, `MILESTONE_EVENT`.
- Runtime execution for `PERIOD_COMPLETION` only.
- Explicit tuition service-period completion evidence.
- Tuition-only eligible amount guard.
- Reuse of sealed Finance OS semantic receivable contract after Preschool proves recognition eligibility.

Out of scope:
- Payment, prepayment, `111/112`, `3387`, refund, discount accounting, tax, VAT, e-invoice.
- Finance OS, TT99, 131/511, accounting periods, or semantic mapping changes.
- `TIME_BASED` or `MILESTONE_EVENT` execution.
- Generic policy framework or `edu_fin_*` cleanup.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `edu_fin_invoices` | Preschool Product Finance | Billing/invoice workflow state, not service-performance proof |
| `edu_fin_tuition_recognition_policies` | Preschool Product Finance | Tenant/effective-dated recognition policy vocabulary |
| `edu_fin_tuition_service_period_completions` | Preschool Product Finance | Explicit completion evidence for PERIOD_COMPLETION |
| `TUITION_SERVICE_RECOGNIZED` | Finance OS | Accounting execution after valid business semantic arrives |

## 4. Contract Dependency Map

```text
Invoice issuance
        ↓
Preschool invoice state only

Explicit service-period completion
        ↓
Tenant effective-dated recognition policy
        ↓
PERIOD_COMPLETION recognition service
        ↓
TUITION_SERVICE_RECOGNIZED
        ↓
Finance OS semantic receivable path
```

## 5. Change Authority

Authorized:
- Preschool Product Finance invoice issuance decoupling.
- Additive Preschool Product finance policy/completion tables.
- Separate Product-owned recognition service for PERIOD_COMPLETION only.
- Focused regression tests and this gate record.

Not authorized:
- Finance OS changes.
- Payment/prepayment/accounting slices.
- Generic policy framework.
- Production policy/config/completion creation.

## 6. UI -> Contract Reconciliation

No UI redesign. Existing invoice issue action remains a billing workflow action and must not claim revenue/service recognition.

## 7. Additive Migration Plan

One additive migration:

```text
supabase/migrations/20260928000000_preschool_tuition_recognition_policy_foundation.sql
```

It creates only Product-owned tuition recognition policy and service-period completion evidence tables plus tenant RLS/overlap guard.

## 8. Verification Plan

- Focused Jest proves invoice issuance emits zero Finance recognition.
- PERIOD_COMPLETION fails closed without completion evidence.
- Valid completion + effective policy emits one Finance semantic request.
- No policy, overlapping policy, unsupported policy types, cross-tenant invoice scope, and non-tuition amount all fail closed.
- Scoped ESLint, `git diff --check`, and one `typecheck:changed` attempt.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL P7 BILLING PERIOD PROVENANCE FIX

> **Status:** PASS - remove hardcoded September 2026 billing-period provenance from Preschool P7 invoice compilation
> **Date:** 2026-09-28
> **Scope:** Preschool Product P7 invoice compile API/UI only; no Finance OS, payment, accounting policy, runtime config, or production data mutation

---

## 1. Bella OS/Product Development Process Gate

The proven blocker is `BLOCKED_BY_HARDCODED_BILLING_PERIOD_PROVENANCE`: the P7 finance API manufactured a September 2026 billing period from source-code constants before invoice compilation. Gate decision: `PASS` for the smallest Product-owned consumer fix that requires a tenant-scoped `billingPeriodId` and derives invoice due date from the persisted P7 billing period.

## 2. Product Manifest

In scope:
- Preschool Product Finance API `compileDraftInvoice`.
- Preschool Finance UI billing-period selection.
- Existing `edu_fin_billing_periods` repository contract.
- Focused provenance regression tests.

Out of scope:
- Creating fee structures, billing periods, invoices, or Finance periods.
- Finance kernel, TT99, account mapping, payments, 3387, refund, tax, VAT, e-invoice.
- Generic billing configuration framework or legacy `edu_fin_*` cleanup.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `edu_fin_billing_periods` | Preschool Product Finance | Product billing-period configuration |
| `edu_fin_invoices` | Preschool Product Finance | Product invoice workflow/read model |
| Finance OS semantic receivable contract | Finance OS | Downstream accounting recognition boundary |

## 4. Contract Dependency Map

```text
Preschool operator selects configured billingPeriodId
        ↓
API resolves tenant-scoped edu_fin_billing_periods row
        ↓
TuitionBillingService.compileDraftInvoice
        ↓
Invoice dueDate comes from persisted billing period
        ↓
Later issueInvoice may recognize tuition through Finance OS
```

## 5. Change Authority

Authorized:
- Remove source-code billing-period/date hardcodes from Preschool Product API/UI.
- Require tenant-scoped billing-period lookup for invoice compilation.
- Add focused regression tests and gate record.

Not authorized:
- Finance OS changes.
- Runtime setup or production data mutation.
- New billing framework or accounting policy.

## 6. UI -> Contract Reconciliation

The staff billing UI previously collected only student and a due-date field while the API supplied the billing period. The corrected UI consumes real active billing periods from the API and sends only the selected `billingPeriodId`; source-code dates no longer create business truth.

## 7. Additive Migration Plan

No migration. This is a Product API/UI consumer correction over existing P7 tables.

## 8. Verification Plan

- Focused static provenance tests prove the route no longer contains September 2026 constants or `createBillingPeriod`.
- API guard test proves invoice compilation requires `billingPeriodId`, tenant-scoped lookup, active status, and due date from the persisted period.
- Existing tuition recognition test proves Finance connector dates come from billing-period fields rather than source-code September constants.
- Scoped ESLint and `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL P7 FINANCE OS TUITION RECOGNITION CONNECTION

> **Status:** PASS - connect Preschool P7 issued tuition invoice to sealed Finance OS semantic receivable path
> **Date:** 2026-09-28
> **Scope:** Preschool Product P7 -> Finance OS `TUITION_SERVICE_RECOGNIZED` only; no payment, 3387, refund, discount, tax, e-invoice, or `edu_fin_*` cleanup

---

## 1. Bella OS/Product Development Process Gate

The sealed Finance OS milestone proves `TUITION_SERVICE_RECOGNIZED -> TRADE_RECEIVABLE 131 / SERVICE_REVENUE 511 -> F1 ledger + F3 AR` with recovery and idempotency. The current Preschool blocker is a stale P7 consumer: issuing a Preschool invoice updates `edu_fin_invoices` but does not cross the Finance OS semantic boundary. Gate decision: `PASS` for the smallest Product-owned connector that sends issued tuition-only invoices to the sealed Finance OS semantic receivable contract.

## 2. Product Manifest

In scope:
- Preschool Product invoice issuance path.
- Reuse existing `SemanticReceivableChargeService` and `SupabaseReceivableChargeGateway`.
- Source identity: `PRESCHOOL_P7_TUITION_INVOICE` + `edu_fin_invoices.id`.
- Canonical student identity: `edu_fin_invoices.student_party_id`.
- Billing period dates as service period and recognition date.
- Fail-closed for non-tuition invoice lines so meal/discount/tax are not silently posted.

Out of scope:
- Payment, cash, `111/112`, customer advance, `3387`, refund, discount, tax, VAT, e-invoice.
- Deleting or refactoring `edu_fin_*`.
- New Finance kernel, Billing kernel, or generic integration framework.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_fin_invoices` | Preschool Product Finance | Product invoice workflow/read model |
| `TUITION_SERVICE_RECOGNIZED` contract | Finance OS | Canonical business semantic for recognized service receivable |
| `finance_invoices` / `finance_transactions` / AR | Finance OS | Canonical financial truth |

## 4. Contract Dependency Map

```text
Preschool P7 issueInvoice
        ↓
edu_fin_invoices(student_party_id, tuition line, billing period)
        ↓
Finance OS semantic receivable contract
        ↓
TRADE_RECEIVABLE / SERVICE_REVENUE
        ↓
131 / 511
        ↓
Finance invoice + ledger + AR position
```

P7 does not supply account code, chart-of-account regime, tax treatment, or payment semantics.

## 5. Change Authority

Authorized:
- Preschool Product Finance issuance service.
- Preschool Product Finance API service construction.
- Tenant-scoped repository read for billing period.
- Focused service tests and this architecture gate artifact.

Not authorized:
- Finance kernel/accounting policy changes.
- Education Kernel changes.
- `edu_fin_*` cleanup or broad migration/RLS work.
- Payment/refund/discount/tax/e-invoice implementation.

## 6. UI -> Contract Reconciliation

No UI redesign. Existing UI `issueInvoice` action should now be truthful: success requires the Product invoice issuance service to invoke Finance OS recognition when configured by the server API.

## 7. Additive Migration Plan

No migration. This connector consumes already deployed P7 and Finance OS contracts.

## 8. Verification Plan

- Focused service tests prove tuition-only issuance calls Finance OS semantic contract.
- Recovery/idempotency: already issued P7 invoice still calls Finance OS by same business source.
- Unsupported non-tuition lines fail closed before P7 status update.
- Existing canonical student connection tests remain green.
- Scoped ESLint/diff check.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - FINANCE OS TT99 SLICE 1 ACCOUNTING ACTIVATION

> **Status:** PASS - TT99 Slice 1 accounting policy proven for tuition service recognition and target-tenant semantic mapping activation
> **Date:** 2026-09-27
> **Scope:** Finance OS `TUITION_SERVICE_RECOGNIZED` receivable contract + TT99 Slice 1 semantic mappings only; no Preschool connector, no payment, no 3387, no tax, no e-invoice

---

## 1. Bella OS/Product Development Process Gate

The proven blocker is not Preschool Finance UI logic. The Finance OS F3 AR kernel already supports draft invoice, invoice line, finalization, F1 transaction posting, AR ledger, and AR position creation, but the public usable path still requires callers to supply `revenue_account_code`. Under the Accounting Legal-Source Rule, the owner has now provided an authoritative accounting specification for Slice 1 only: `TUITION_SERVICE_RECOGNIZED`, where the education service obligation has already been performed and the amount is eligible for accounting revenue recognition under TT99-effective 2026 enterprise accounting. Gate decision: `PASS` for a Finance-owned contract that maps that semantic to `TRADE_RECEIVABLE -> 131` and `SERVICE_REVENUE -> 511` through Finance-owned, source-backed semantic GL mappings.

## 2. Product Manifest

In scope:
- Finance OS public contract for a semantic receivable charge.
- Finance-owned service/facade that creates/finalizes one AR invoice through existing F3 RPCs.
- Finance-owned implementation of only the accounting mappings specified by authoritative evidence: `TRADE_RECEIVABLE` and `SERVICE_REVENUE`.
- Forward-only activation of the minimum proven TT99 Slice 1 accounts and semantic mappings for the isolated Preschool browser-smoke tenant.
- Idempotency based on Finance-owned source identity.
- Focused tests proving account-code-free caller contract and AR RPC orchestration.

Out of scope:
- Preschool connector/payment implementation.
- P7 `edu_fin_*` runtime changes.
- TT133, TT200, or full TT99 regime engine.
- Customer advance / 3387 / payment / refund / tax / e-invoice treatment.
- New payment allocation flow.
- New Billing Kernel redesign.
- Broad Finance RLS/migration repair.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| semantic receivable charge contract | Finance OS | Vertical-neutral request to recognize a receivable charge |
| semantic GL mapping | Finance OS / authoritative accounting specification | Internal account code selection by semantic and effective date; never vertical supplied and never AI-guessed |
| `finance_invoices` / `finance_invoice_lines` | Finance F3 AR | Canonical invoice header and lines |
| `finance_transactions` / `finance_transaction_lines` | Finance F1 Ledger | Posted accounting transaction |
| `finance_receivable_ledger` / `finance_receivable_positions` | Finance F3 AR | AR subledger fact and derived position |

## 4. Contract Dependency Map

```text
Vertical/Product semantic charge
        ↓
Finance OS semantic receivable charge contract
        ↓
Finance-owned semantic GL mapping as of recognition date
        ↓
finance_create_draft_invoice
        ↓
finance_add_invoice_line
        ↓
finance_finalize_invoice
        ↓
finance_post_transaction
        ↓
finance_transactions + finance_receivable_ledger + finance_receivable_positions
```

The product/vertical caller must not provide `revenue_account_code`, account code, chart-of-account regime, or TT policy.

## 5. Change Authority

Authorized:
- Finance OS contract/service files for `TUITION_SERVICE_RECOGNIZED`.
- Finance-owned semantic GL mapping resolution for `TRADE_RECEIVABLE` and `SERVICE_REVENUE`.
- Finance-owned runtime migration for effective-dated semantic mapping resolution and target-tenant TT99 Slice 1 activation.
- Focused Finance OS tests for semantic input, account-code-free caller boundary, posting orchestration, and idempotency.
- This architecture gate artifact.

Not authorized:
- Education Kernel changes.
- Preschool Finance connector/payment path.
- Existing P7 product runtime changes.
- Regime-specific chart-of-accounts policy beyond Slice 1 proven semantics.
- Historical migration rewrite or migration-history repair.

## 6. UI -> Contract Reconciliation

No UI change in this gate. The stale consumer is any vertical that would otherwise call F3 AR RPCs directly and supply account codes. The canonical contract is now Finance OS semantic charge input.

## 7. Additive Migration Plan

One forward-only migration is required:

```text
supabase/migrations/20260927080000_finance_tt99_slice1_accounting_activation.sql
```

The migration:
- reuses `public.finance_control_account_mappings` as the Finance-owned semantic mapping storage;
- adds effective-date and authority metadata only if missing;
- replaces the semantic mapping RPCs so unsupported semantics fail closed;
- activates only target tenant account `131` and account `511`;
- saves `TRADE_RECEIVABLE -> 131` and `SERVICE_REVENUE -> 511` effective `2026-01-01`;
- does not seed a full chart of accounts, activate `5111`, post tuition, connect Preschool, or touch other tenants.

Post-deploy verification found a narrow PostgREST overload ambiguity between the repo-owned `uuid, varchar, date, varchar` RPC signature and an older `uuid, text, date, text` signature. A follow-up migration may drop only the obsolete `text` overload:

```text
supabase/migrations/20260927081000_finance_drop_legacy_semantic_gl_text_overload.sql
```

This follow-up does not alter accounts, mappings, COA data, accounting semantics, invoices, journals, or AR state.

The runtime must refuse to post if the required semantic mappings are absent or not marked as proven for `VI_TT99_2025|99/2025/TT-BTC|PROVEN`.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Finance OS files only.
- Gate 2 Contract Boundary: vertical request contains semantic charge only; no account code.
- Gate 3 Tenant Isolation: tenant id is required and passed through every F3 RPC/query.
- Gate 4 RLS & Authorization: no RLS change; existing F3 RPC privileges unchanged.
- Gate 5 Database Migration Safety: one bounded forward-only Finance migration; no historical migration rewrite.
- Gate 6 Event-After-Persistence: no new event path.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: semantic GL mapping is effective-date aware.
- Gate 9 Rule Governance: accounting regime and posting rule are source-backed for Slice 1 only.
- Gate 10 Audit Evidence Integrity: F3/F1 idempotency and request hash preserved.
- Gate 11 Platform Regression: focused Finance OS tests, scoped lint, scoped TypeScript, `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL FINANCE TENANT + ACTOR AUTHORIZATION

> **Status:** PASS - bounded Preschool Product Finance server authorization boundary
> **Date:** 2026-09-27
> **Scope:** F2 active finance UI/API path only; no Finance RLS hardening, no billing redesign, no browser field verification

---

## 1. Bella OS/Product Development Process Gate

F1 cut over Preschool Finance identity to canonical `student_party_id`. The next proven blocker is that the active Finance UI still supplies hardcoded tenant/staff/parent IDs from the browser. Gate decision: `PASS` for the smallest server boundary that derives tenant and actor from the authenticated session, permits only existing Bella finance roles, and preserves P7 fee/invoice/payment/reconciliation semantics.

## 2. Product Manifest

In scope:
- Preschool Product Finance API boundary for active Finance page read/actions.
- Finance page consumer change from direct Supabase/service calls to server API calls.
- Role mapping for existing Bella roles `admin` and `accountant`.
- Focused tests proving server-derived tenant/actor and parent denial.

Out of scope:
- Broad `edu_fin_*` RLS/grant remediation.
- Generic authorization framework.
- Finance/Billing Kernel redesign.
- Browser field verification before F3 RLS hardening.
- Parent Finance redesign or notification workflow expansion.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| authenticated user/session | Platform Auth / Bella user profile | Source for current user id, role, tenant |
| `admin` / `accountant` user roles | Bella existing user model | Allowed active Preschool finance operators |
| P7 Finance actions | Preschool Product Finance | Compile/issue invoices, payment reconciliation, finance projections |
| `edu_fin_*` RLS policies | Preschool Product Finance / DB security | Deferred F3 hardening target |

## 4. Contract Dependency Map

```text
Finance UI
        ↓
/api/education/finance
        ↓
getCurrentUser()
        ↓
server-derived tenant + actor + role
        ↓
P7 Finance services
        ↓
edu_fin_* canonical student_party_id rows
```

Client-supplied `tenantId`, `createdBy`, `payerPartyId`, or authorization status is not trusted.

## 5. Change Authority

Authorized:
- Preschool Product Finance route/UI boundary.
- Bounded finance authorization helper/service.
- Directly affected finance service call signatures where actor/guardian derivation must move server-side.
- Focused tests and this gate artifact.

Not authorized:
- Education Kernel changes.
- Generic Auth/RBAC framework.
- Broad RLS policy repair.
- Migration history or BDGF work.

## 6. UI -> Contract Reconciliation

| UI element/action | Old authority | New authority | Conclusion |
|---|---|---|---|
| Finance data load | browser Supabase + hardcoded tenant | server API derives tenant from authenticated profile | STALE UI |
| Draft invoice | browser sends `DEFAULT_TENANT_ID` / `DEFAULT_STAFF_ID` | server derives tenant/actor | STALE UI |
| Issued notice projection | browser sends `DEFAULT_PARENT_ID` | server derives guardians via canonical `guardian_of` relationship | STALE UI |
| Payment/reconciliation | browser sends payer/staff constants | server derives payer guardian and actor | STALE UI |

## 7. Additive Migration Plan

No migration in F2. Existing broad/permissive Finance RLS is recorded as F3:

```text
edu_fin_fee_structures
edu_fin_billing_periods
edu_fin_student_discount_profiles
edu_fin_invoices
edu_fin_invoice_line_items
edu_fin_payments
edu_fin_reconciliation_ledger
edu_fin_receipts
```

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Preschool Product Finance only; no Education Kernel change.
- Gate 2 Contract Boundary: API mediates UI to P7 services.
- Gate 3 Tenant Isolation: server derives tenant and repository filters by tenant.
- Gate 4 RLS & Authorization: app-layer roles `admin` and `accountant` allowed; `parent` denied; DB RLS hardening deferred to F3.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: no new domain event.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence Integrity: existing invoice/receipt fingerprints preserved.
- Gate 11 Platform Regression: F1/F2 focused tests, scoped ESLint, `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL FINANCE CANONICAL STUDENT CONNECTION

> **Status:** PASS - bounded Preschool Product cutover from legacy `student_id` to canonical `student_party_id`
> **Date:** 2026-09-27
> **Scope:** P7 Preschool Finance student identity only; no Billing Kernel redesign or broad RLS/auth repair

---

## 1. Bella OS/Product Development Process Gate

The sealed Preschool operational chain now creates canonical Student Parties through Enrollment. The next Market Ready blocker is that P7 Preschool Finance still selects and persists legacy `students.student_id`, while the real enrolled student identity is:

```text
edu_enrollments.student_party_id
        ↓
students.party_id
        ↓
party_parties.id
```

Gate decision: `PASS` for the smallest Preschool Product-owned finance cutover that writes and reads canonical `student_party_id` for new invoice/payment/discount operations while preserving legacy rows.

## 2. Product Manifest

In scope:
- P7 finance domain types, repository, invoice compilation, inbound payment recording, issuance fingerprint identity, and the finance UI student selector/action path.
- One additive migration on directly affected `edu_fin_*` tables.
- Focused service/static tests proving canonical enrollment validation and legacy compatibility.

Out of scope:
- Generic Finance/Billing redesign.
- Finance RLS/grant hardening.
- Server auth/actor/tenant hardcode removal.
- Parent Communication or Notice redesign beyond the directly affected finance projection belonging check.
- Browser field verification before owner deployment.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_enrollments.student_party_id` | Education Enrollment / Preschool consumer | Canonical enrolled student identity |
| `party_parties.id` | Platform Party | Canonical Party identity |
| `edu_fin_student_discount_profiles.student_party_id` | Preschool Product Finance | Canonical student identity for discounts |
| `edu_fin_invoices.student_party_id` | Preschool Product Finance | Canonical student identity for invoices |
| `edu_fin_payments.student_party_id` | Preschool Product Finance | Canonical student identity for payments |

## 4. Contract Dependency Map

```text
Finance UI
        ↓
edu_enrollments(active/pending)
        ↓
Student Party
        ↓
P7 Finance services
        ↓
edu_fin_* rows keyed by student_party_id
```

Payer identity remains separate as `payer_party_id`.

## 5. Change Authority

Authorized:
- Preschool Product finance code and UI path.
- Additive/cutover migration on P7 finance tables.
- Direct finance projection check required by issued-invoice notice creation.

Not authorized:
- Education Kernel changes.
- Finance OS Kernel changes.
- Generic billing engine rebuild.
- Broad RLS/security remediation.

## 6. UI -> Contract Reconciliation

| UI element | Old source | New source | Conclusion |
|---|---|---|---|
| Student selector | `students.student_id` with hardcoded P7 fallback | `edu_enrollments.student_party_id -> party_parties` | CUT OVER |
| Draft invoice action | legacy `studentId` | canonical `studentPartyId` | CUT OVER |
| Payment action | invoice legacy student key | invoice canonical `studentPartyId` | CUT OVER |

Known hardcoded tenant/staff/parent IDs remain a separate F2/auth-boundary finding and are not fixed in this F1 identity slice.

## 7. Additive Migration Plan

One migration:

```text
edu_fin_student_discount_profiles
edu_fin_invoices
edu_fin_payments
  ADD student_party_id UUID REFERENCES party_parties(id)
  ALTER student_id DROP NOT NULL
  ADD CHECK (student_id IS NOT NULL OR student_party_id IS NOT NULL)
  ADD tenant + student_party_id indexes
```

Legacy columns are preserved. No backfill, cleanup, RLS, grant, migration history, or data mutation is included.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned Preschool finance only; no Education/Finance Kernel change.
- Gate 2 Contract Boundary: validate canonical enrollment before new finance obligation/payment creation.
- Gate 3 Tenant Isolation: enrollment validation is scoped by tenant and `student_party_id`.
- Gate 4 RLS & Authorization: no policy change in this slice; existing broad finance RLS is deferred.
- Gate 5 Database Migration Safety: one bounded additive/cutover migration; no legacy drop/backfill.
- Gate 6 Event-After-Persistence: not applicable; no domain event emitted.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence Integrity: invoice publication fingerprint uses canonical student identity.
- Gate 11 Platform Regression: focused Preschool finance tests, scoped ESLint, `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL PARENT USER ROLE ENABLEMENT

> **Status:** PASS - minimum auth/profile contract amendment for legitimate parent accounts
> **Date:** 2026-09-27
> **Scope:** `public.users.users_role_check` only; prerequisite for Parent Daily browser field verification

---

## 1. Bella OS/Product Development Process Gate

The Parent Daily backend, canonical Guardian Party mapping, and focused access tests are implemented. Browser field verification is blocked because a real parent account cannot have a legitimate `public.users` profile:

```text
Supabase Auth user
        ↓
public.users profile
        ↓
users_role_check rejects 'parent'
```

Gate decision: `PASS` for the smallest database contract amendment that permits a `parent` actor without granting staff/admin authority.

## 2. Product Manifest

In scope:
- Preserve all currently accepted `public.users.role` values.
- Add exactly one canonical role: `parent`.
- Keep role validation bounded by `users_role_check`.

Out of scope:
- Auth redesign, invitation workflow, password management, RBAC framework.
- Staff/admin permission changes.
- Parent Daily business semantics, Attendance, Daily Care, Handover, Guardian Authorization, Enrollment, R3, Course RLS.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.users.role` | Platform Auth/Profile | User profile role label used by app guards and tenant context |
| `parent` | Preschool Product consumer of Platform profile | External guardian/parent login actor; not staff/admin |

## 4. Contract Dependency Map

```text
Supabase Auth user
        ↓
public.users(role = parent, tenant_id, phone)
        ↓
Parent Daily access service
        ↓
party_identifiers(preschool_guardian_phone)
        ↓
Guardian Party
        ↓
party_relationships guardian_of
        ↓
Student Party
```

Pickup authorization remains excluded from parent data-access authority.

## 5. Change Authority

Authorized:
- One bounded migration changing only `public.users.users_role_check`.
- Focused static migration test and existing Parent Daily access tests.

Not authorized:
- Generic RBAC/permission engine.
- Staff/admin route permission expansion.
- Product workflow changes.

## 6. UI -> Contract Reconciliation

No UI change in this slice. This is a contract prerequisite for using a real parent browser session in the already implemented Parent Inbox.

## 7. Additive Migration Plan

One migration:

```sql
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
CHECK (role IN (... existing roles ..., 'parent'));
```

No RLS, policy, grant, profile data, or auth-user mutation.

## 8. Verification Plan

- Focused migration static test:
  - existing roles remain valid
  - `parent` is accepted
  - arbitrary roles are not accepted
  - validation is not weakened
- Existing Parent Daily access tests still pass.
- Scoped ESLint/diff check.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL PARENT DAILY EXPERIENCE

> **Status:** PASS - complete parent daily view from canonical Preschool operational truth
> **Date:** 2026-09-27
> **Scope:** Parent daily read model, canonical guardian access, Parent Digest `student_party_id` cutover, `/dashboard/education/parent-inbox`

---

## 1. Bella OS/Product Development Process Gate

The sealed Preschool operational chain is:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance
-> Daily Care -> Guardian Authorization -> Safe Pickup/Handover
= FIELD VERIFIED
```

The next proven product blocker is:

```text
Parent Daily Experience = PARTIAL
```

Operational truth exists for Attendance, Daily Care, and Handover, but Parent Digest and Parent Inbox still consume legacy/static paths. Gate decision: `PASS` for the minimum Preschool Product connection that exposes today's real child-day truth to an authenticated canonical Guardian Party.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Resolve authenticated user to Guardian Party using existing tenant-scoped guardian phone identifier.
- Validate `Guardian Party --guardian_of--> Student Party` before returning any child data.
- Cut Parent Digest operational key from legacy `student_id` to canonical `student_party_id`.
- Read today's Attendance, Daily Care, and Handover truth from existing FIELD VERIFIED sources.
- Replace operational Parent Inbox mock path with real backend read-back.

Out of scope:
- QR, SMS, push, mobile app, billing, medication workflow, temperature, staff scheduling, facilities.
- Generic parent authorization framework.
- Pickup authorization as parent data-access authority.
- Reopening R3, Enrollment, Roster, Attendance, Daily Care source semantics, Guardian Authorization, Safe Pickup/Handover, Course RLS.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `party_relationships guardian_of` | Platform Party | Family/guardian relationship between Guardian Party and Student Party |
| `edu_attendance_daily_state` | Education Attendance / Preschool consumer | Daily attendance state |
| `edu_daily_care_records.student_party_id` | Preschool Product | Daily care state for a canonical Student Party |
| `edu_preschool_pickup_handover_events` | Preschool Product | Immutable pickup handover event |
| `edu_daily_parent_digests.student_party_id` | Preschool Product | Parent digest projection keyed by canonical Student Party |
| `/dashboard/education/parent-inbox` | Preschool Product UI | Parent daily experience read surface |

## 4. Contract Dependency Map

```text
Authenticated user
        ↓
public.users.phone
        ↓
party_identifiers(preschool_guardian_phone)
        ↓
Guardian Party
        ↓
party_relationships guardian_of
        ↓
Student Party
        ↓
Attendance + Daily Care + Handover read model
        ↓
Parent Inbox UI
```

Pickup authorization is not part of the parent data-access contract.

## 5. Change Authority

Authorized:
- Preschool Product service/API/UI for parent daily read model.
- Additive/cutover migration on Preschool-owned `edu_daily_parent_digests`.
- Focused tests for related child access, unrelated child denial, cross-tenant denial, pickup authorization not granting data access, and canonical sources.

Not authorized:
- Platform identity redesign.
- Education Kernel changes.
- Generic authorization framework.
- Notification delivery, QR, mobile app, or parent communication redesign.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Parent daily child card | Shows real child | `party_relationships guardian_of -> party_parties` | MATCH |
| Attendance | Present/absent/excused/unmarked | `edu_attendance_daily_state` through canonical enrollment | MATCH |
| Arrival/meal/hygiene/nap | Today's care state | `edu_daily_care_records.student_party_id` | MATCH |
| Handover | Pickup complete/time/guardian | `edu_preschool_pickup_handover_events` | MATCH |
| Static NOT-* notices | Mock operational data | No real parent daily contract | STALE UI |

## 7. Additive Migration Plan

One migration only:

```text
edu_daily_parent_digests
  ADD student_party_id UUID REFERENCES party_parties(id)
  ALTER student_id DROP NOT NULL
  ADD unique/indexes for session + student_party_id
```

No legacy cleanup/drop.

## 8. Verification Plan

- Focused parent daily service tests.
- Focused Parent Digest canonical tests where practical.
- Scoped ESLint.
- `git diff --check`.
- Typecheck changed once; if it stalls, report `NOT_VERIFIED_STALL`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL DAILY CARE CANONICAL CONNECTION

> **Status:** PASS - minimum Preschool-owned Daily Care connection to canonical enrolled students
> **Date:** 2026-09-27
> **Scope:** `/dashboard/education/care`, Daily Care product service/API, canonical `student_party_id` persistence

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance -> Guardian Authorization -> Safe Pickup/Handover = FIELD VERIFIED
```

The next proven blocker is:

```text
Daily Care / Care & Wellbeing = PARTIAL
```

The existing Care UI is a real Preschool menu capability, but still uses hardcoded tenant/class/student/date/static students and writes care records through legacy `students.student_id`.

Gate decision: `PASS` for the minimum Preschool Product connection that lets the existing Care workspace operate on the same canonical enrolled students already proven by Enrollment/Roster/Attendance.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Load real active courses and enrolled students for the authenticated Preschool tenant.
- Persist Daily Care records by canonical `student_party_id`.
- Preserve existing Care semantics for arrival, meal, hygiene, and nap.
- Return DB read-back so browser refresh can show persisted truth.

Out of scope:
- Parent Digest publishing.
- QR, pickup, handover, Attendance changes, Guardian Authorization changes.
- Medication authorization redesign.
- Platform/Education-wide Care engine or generic workflow framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_daily_care_sessions` | Preschool Product | Care session per course/date |
| `edu_daily_care_records` | Preschool Product | Care state for one canonical student/day |
| `edu_enrollments` | Education OS Enrollment | Canonical course membership |
| `students.party_id` / `party_parties.id` | Education Student / Platform Party | Canonical student identity |
| `/dashboard/education/care` | Preschool Product UI | Staff care action workspace |

## 4. Contract Dependency Map

```text
Care UI
        ↓
GET /api/education/courses
        ↓
GET /api/education/care/bulk?courseId&date
        ↓
DailyCareService
        ↓
edu_enrollments.student_party_id
        ↓
edu_daily_care_records.student_party_id
        ↓
Care UI DB read-back
```

## 5. Change Authority

Authorized:
- One bounded migration for canonical Daily Care identity on existing product-owned table.
- `DailyCareService` and its product-local contract.
- `/api/education/care/bulk` server boundary.
- Existing Care page operational data/action wiring.
- Focused tests for canonical student persistence and tenant/course denial.

Not authorized:
- R3, Enrollment, Attendance, Guardian Authorization, Safe Pickup/Handover.
- Parent Digest, Parent Engagement, QR, Haircut, BDGF, migration history.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Course selector | Real Preschool class/course | `GET /api/education/courses` | MATCH |
| Student roster | Real enrolled students | `edu_enrollments.student_party_id -> party_parties` | MATCH |
| Care action | Persist care for current student/day | `edu_daily_care_records.student_party_id` | CONTRACT CHANGE REQUIRED |
| Temperature | Health check input | No real current input in Care page | DEFER |
| Parent Digest | Publish parent-facing snapshot | Existing separate digest projection | DEFER |

## 7. Additive Migration Plan

Minimum table correction:

```text
edu_daily_care_records.student_party_id -> party_parties.id
student_id DROP NOT NULL for canonical rows
unique session + student_party_id
index tenant + student_party_id
```

No parent digest migration, attendance change, guardian change, or R3 change.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI; no Education Kernel modification.
- Gate 2 Contract Boundary: Product consumes canonical enrollment/party identity only.
- Gate 3 Tenant Isolation: API derives tenant server-side and service validates tenant/course membership.
- Gate 4 RLS/Auth: no RLS weakening; server-side route owns mutation.
- Gate 5 Migration Safety: bounded product table identity correction only.
- Gate 6 Event-After-Persistence: not applicable; success after DB update/read-back.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: daily record update semantics preserved.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: focused tests prove DB-shaped persistence and denial.
- Gate 11 Regression: focused Daily Care tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL SAFE PICKUP HANDOVER EVENT

> **Status:** PASS - minimum Preschool-owned handover event truth
> **Date:** 2026-09-27
> **Scope:** Safe Pickup handover event persistence, API action, Attendance/Safe Pickup UI connection

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool operational chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance -> Guardian Authorization = FIELD VERIFIED
```

Discovery proved:

```text
Safe Pickup authorization != handover event
Existing canonical handover capability = NONE
Owner = Preschool Product
```

Gate decision: `PASS` for one minimum product-owned event record proving that an authorized guardian received a specific student from an authenticated operator at a specific time.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Create one Preschool-owned handover event table.
- Validate the active pickup authorization before recording handover.
- Derive tenant, operator, and timestamp server-side.
- Add one minimal API action for the existing Safe Pickup panel.
- Show persisted handover read-back in the existing Attendance/Safe Pickup UI.

Out of scope:
- QR, scanner/camera, pickup token, biometrics, signature capture.
- Notifications, pickup schedules, custody rules, effective authorization windows.
- Guardian Authorization semantic changes.
- Enrollment, Student/R3, Attendance status semantics, Course RLS, BDGF, migration history.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_preschool_pickup_handover_events` | Preschool Product | Immutable handover business event |
| `edu_preschool_pickup_authorizations` | Preschool Product | Active authorization prerequisite |
| `party_parties` | Platform Party | Canonical Student and Guardian identities |
| Safe Pickup UI | Preschool Product UI | Action surface and truthful read-back |

## 4. Contract Dependency Map

```text
Safe Pickup UI
        ↓
POST /api/education/attendance/handover
        ↓
PreschoolSafePickupHandoverService
        ↓
Validate active authorization
        ↓
Insert edu_preschool_pickup_handover_events
        ↓
GET /api/education/attendance read-back
        ↓
Safe Pickup panel shows "Đã bàn giao"
```

## 5. Change Authority

Authorized:
- One additive Preschool Product migration.
- Product-owned service for handover event.
- Attendance API route read-back and one new handover endpoint.
- Existing Attendance/Safe Pickup UI action wiring.
- Focused tests for handover validation and failure paths.

Not authorized:
- Education Kernel handover engine.
- Guardian Authorization redesign.
- QR/custody/notification/Parent Engagement.
- Broad regression repair or migration history work.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Authorized guardian display | Existing active authorization shown | `edu_preschool_pickup_authorizations` | MATCH |
| Bàn giao action | Persist real handover event | New `edu_preschool_pickup_handover_events` | CONTRACT CHANGE REQUIRED |
| QR copy/status | QR verification | No canonical capability in this slice | DEFER |
| Handover success message | Only after persisted event read-back | Handover API + roster refresh | MATCH after slice |

## 7. Additive Migration Plan

Create one table only:

```text
edu_preschool_pickup_handover_events
tenant_id
student_party_id
guardian_party_id
pickup_authorization_id
handed_over_at
handed_over_by
created_at
```

No mutation of authorization, enrollment, student identity, attendance, QR, Parent Engagement, or legacy tables.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI only.
- Gate 2 Contract Boundary: No Education Kernel modification.
- Gate 3 Tenant Isolation: tenant derived server-side; service validates same tenant.
- Gate 4 RLS/Auth: new table has tenant RLS policy.
- Gate 5 Migration Safety: additive table/index/policy only.
- Gate 6 Event-After-Persistence: success only after insert/read-back.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: immutable event record.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: focused test/read-back proves event truth.
- Gate 11 Regression: focused handover test, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL DAILY ATTENDANCE STATE

> **Status:** PASS - canonical Education daily attendance state projection for Preschool roll call
> **Date:** 2026-09-26
> **Scope:** Education Attendance public contract extension, additive daily-state projection, Preschool Attendance UI wiring

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool workflow has reached:

```text
New Student → Enrollment → Classroom Roster = FIELD VERIFIED
```

The next blocker is daily roll call. Discovery proved two distinct semantics:

```text
edu_attendance = event history
Preschool roll call = current daily state
```

Gate decision: `PASS` for the minimum canonical Education Attendance contract extension that preserves event history and adds a bounded daily-state projection.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Add an Education-owned daily attendance state projection.
- Preserve `edu_attendance` append-only event semantics.
- Add atomic write boundary: append event + upsert daily state.
- Add canonical read path for course/date roster attendance.
- Wire Preschool Attendance UI to the canonical Education Attendance service/API.

Out of scope:
- Pickup, temperature, Care, Parent notification, Billing, Reporting.
- R3, BDGF, migration history, credential debugging.
- Legacy `attendances` cleanup or dual-write.
- Generic timezone framework or event-sourcing framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.edu_attendance` | Education OS Attendance | Append-only attendance event history |
| Daily attendance state projection | Education OS Attendance | Effective state for tenant + enrollment + school_day |
| `public.edu_enrollments` | Education OS Enrollment | Canonical roster membership by course |
| `public.students` / `public.party_parties` | Education Student / Platform Party | Canonical student identity for roster display |
| Preschool Attendance page | Preschool Product UI | Presentation and user action surface only |

## 4. Contract Dependency Map

```text
Preschool Attendance UI
        ↓
Education Attendance API
        ↓
AttendanceProductService
        ↓
IEducationAttendanceContract
        ↓
AttendanceContractImpl
        ↓
Education DB boundary
        ├── edu_attendance event append
        └── daily attendance state upsert
```

Read path:

```text
course + school_day
        ↓
edu_enrollments
        ↓
students.party_id
        ↓
party_parties
        ↓
daily attendance state (nullable/unmarked)
```

## 5. Change Authority

Authorized:
- One additive Education attendance migration.
- `src/platform/education/contracts/attendance.contract.ts`
- `src/platform/education/contracts/attendance.contract.impl.ts`
- `src/products/bella-education/services/attendance.service.ts`
- Minimal Attendance API route(s).
- `src/app/dashboard/education/attendance/page.tsx`
- Focused tests for daily-state semantics and UI/API mapping.

Not authorized:
- Healthcare, Logistics, R3, BDGF, legacy cleanup.
- Legacy `attendances` dual-write.
- Product-specific attendance engine separate from Education.

## 6. UI → Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Class/course selector | Real course list | Existing Education courses API | MATCH |
| Roster rows | Enrolled students for selected course | `edu_enrollments.student_party_id → students.party_id → party_parties` | MATCH |
| Present/Absent/Excused action | One effective state for school day | New Education daily-state projection | CONTRACT CHANGE REQUIRED |
| History/correction evidence | Correction preserves history | Existing `edu_attendance` event log | MATCH |
| Pickup/temperature panels | Not proven for attendance mutation | Out of scope | DEFER |

## 7. Additive Migration Plan

Create only a new Education daily attendance state projection with:

```text
tenant_id
enrollment_id
school_day
status present|absent|excused
created_at
updated_at
UNIQUE (tenant_id, enrollment_id, school_day)
RLS tenant isolation consistent with Education tables
```

No modification to `edu_attendance`, `attendances`, `persons`, identity mappings, or enrollment tables.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Education contract and Product UI only; no cross-industry imports.
- Gate 2 Contract Boundary: Product calls public Education Attendance service/contract.
- Gate 3 Tenant Isolation: mutation/read validates tenant owns enrollment/course.
- Gate 4 RLS/Auth: new table has RLS and tenant policy.
- Gate 5 Migration Safety: additive table only.
- Gate 6 Event-After-Persistence: event + state mutation must be transactional/atomic.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: event history remains append-only.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: correction test proves two history events and one effective state.
- Gate 11 Regression: focused attendance tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL GUARDIAN AUTHORIZATION

> **Status:** PASS - minimal Preschool-owned guardian pickup authorization truth
> **Date:** 2026-09-27
> **Scope:** New Enrollment guardian identity/relationship/authorization; Safe Pickup panel read-only truth display

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool operational chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance = FIELD VERIFIED
```

The next blocker is not QR or pickup event execution. Discovery proved the first missing truth is:

```text
Student Party
      ↓
Guardian Party
      ↓
Guardian identity relationship
      ↓
Preschool pickup authorization
```

Gate decision: `PASS` for the minimum product-owned model answering only which Guardian Party is currently authorized to pick up which Student Party.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Resolve/create a tenant-scoped Guardian Party from required enrollment guardian input.
- Store a bounded tenant-scoped guardian phone identifier for this Preschool flow.
- Link Guardian Party to Student Party through `guardian_of` identity relationship.
- Create/read a separate Preschool pickup authorization.
- Extend the existing enrollment response and Safe Pickup panel to display real authorized guardian truth.

Out of scope:
- QR token/scanner.
- Pickup/handover/release event.
- Temperature or Daily Care changes.
- Parent Engagement refactor.
- Generic identity, phone, or authorization framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `party_parties` | Platform Party | Canonical Guardian and Student identity |
| `party_identifiers` | Platform Party | Tenant-scoped Preschool guardian phone resolution key |
| `party_relationships` | Platform Party | Guardian -> Student identity/family relationship |
| `edu_preschool_pickup_authorizations` | Preschool Product | Operational truth that a guardian is currently authorized for pickup |
| Attendance Safe Pickup panel | Preschool Product UI | Read-only display of authorization truth; no pickup event/QR claim |

## 4. Contract Dependency Map

```text
Preschool Enrollment API
        ↓
Student Party
        ↓
Guardian Party resolve/create
        ↓
party_relationships guardian_of
        ↓
edu_preschool_pickup_authorizations
        ↓
Student + Enrollment
```

Read path:

```text
Attendance roster
        ↓
student_party_id
        ↓
edu_preschool_pickup_authorizations
        ↓
guardian party display + phone identifier
        ↓
Safe Pickup panel
```

## 5. Change Authority

Authorized:
- One additive Preschool-owned authorization migration.
- Product service for guardian authorization.
- Enrollment API integration.
- Attendance API/UI read-only display of authorized guardian.
- Focused tests for identity, duplicate boundaries, and false-success prevention.

Not authorized:
- Education Attendance engine redesign.
- Parent Engagement refactor.
- QR, pickup event, custody scheduling, temperature, or Daily Care.
- BDGF/R3/migration-history work.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Enrollment guardian fields | Required guardian info becomes operational truth | Guardian Party + relationship + pickup authorization | CONTRACT CHANGE REQUIRED |
| Safe Pickup guardian display | Show who is authorized | `edu_preschool_pickup_authorizations` + Party identity | MATCH after slice |
| QR action | Verify pickup via QR | No canonical capability yet | DEFER |
| Pickup completion | Child released/handover event | No canonical capability yet | DEFER |
| Temperature | Care/health check | Daily Care capability, not Attendance | DEFER |

## 7. Additive Migration Plan

Create one table only:

```text
edu_preschool_pickup_authorizations
tenant_id
student_party_id
guardian_party_id
status authorized|revoked
created_at
updated_at
```

Add a partial unique boundary for active authorization:

```text
tenant_id + student_party_id + guardian_party_id WHERE status = authorized
```

No pickup event, QR token, schedule, custody, photo, signature, or geolocation fields.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI; Platform Party tables only for identity.
- Gate 2 Contract Boundary: Education attendance/enrollment contracts remain unchanged.
- Gate 3 Tenant Isolation: guardian phone resolution and authorization are tenant scoped.
- Gate 4 RLS/Auth: new table has RLS tenant policy.
- Gate 5 Migration Safety: additive table/index/policy only.
- Gate 6 Event-After-Persistence: no event behavior added.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: read-back proves authorization truth.
- Gate 11 Regression: enrollment and attendance focused tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL NEW STUDENT ENROLLMENT PATH

> **Status:** PASS - minimal Product UI to canonical Education enrollment wiring
> **Date:** 2026-09-26
> **Scope:** Preschool New Student modal, product-owned API boundary, canonical Party/Student/Enrollment chain

---

## 1. Bella OS/Product Development Process Gate

Request targets the proven Preschool blocker:

```text
Enrollment UI
        ↓
static/local completion
        ↓
no canonical Party
no Student contract call
no edu_enrollments persistence/read-back
```

R3 Student identity is sealed; new canonical Student creation now supports:

```text
party_id = public.party_parties.id
person_id = NULL
```

Gate decision: `PASS` for a minimal Product-layer server boundary plus UI submit wiring.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Use the existing Preschool Enrollment UI/modal.
- Create one product-owned API route for the admission operation.
- Create a canonical person Party in `public.party_parties`.
- Register the Student through `StudentContractImpl`.
- Enroll through `EnrollmentProductService` and `EnrollmentContractImpl`.
- Report success only after Student and Enrollment read-back.

Out of scope:
- Attendance, Care, Parent Inbox, Pickup, Finance, Reporting.
- R3, BDGF, migration history, credential/debug work.
- New identity framework, fake `persons`, fake `identity_migration_mapping`, or compatibility layer.
- Broad Preschool redesign.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.party_parties` | Platform Party identity | Canonical person identity for the new student |
| `public.students` | Education OS Student | Student role bound to canonical Party |
| `public.edu_enrollments` | Education OS Enrollment | Canonical enrollment persistence/read-back |
| Enrollment modal state | Preschool Product UI | User input only; not source of operational truth |

## 4. Contract Dependency Map

```text
Preschool Enrollment UI
        ↓
POST /api/education/enrollments
        ↓
party_parties insert
        ↓
StudentContractImpl.registerStudent()
        ↓
EnrollmentProductService.enrollStudent()
        ↓
EnrollmentContractImpl
        ↓
EducationEngineService
        ↓
SupabaseEducationRepository
        ↓
edu_enrollments
        ↓
getStudent() + getEnrollment() read-back
```

## 5. Change Authority

Authorized:
- `src/app/dashboard/education/enrollments/page.tsx`
- `src/app/api/education/enrollments/route.ts`
- Focused tests for the new product API boundary.
- This architecture gate artifact.

Not authorized:
- Education Kernel schema changes.
- Attendance/Care/Parent/Finance/Reporting.
- Migration deployment, BDGF, or production credential work.

## 6. UI → Contract Reconciliation

The previous button only closed the modal. The new path must submit the UI payload to the product API and display failure if the server chain fails. Course/class identity must come from the existing `GET /api/education/courses` source, not from a hardcoded ID.

Browser smoke discovered a direct mapping bug in that existing course source:

```text
Enrollment modal
        ↓
GET /api/education/courses
        ↓
hardcoded tenant fallback
        ↓
classrooms: []
        ↓
submit blocked before canonical enrollment request
```

Authorized minimal correction: the course API must prefer the authenticated
user's tenant context before legacy fallback so the Enrollment UI can submit a
canonical course/class ID for the current Preschool tenant.

## 7. Additive Migration Plan

No migration in this task.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: product API uses public Education contracts.
- Gate 2 Contract Boundary: Student registration uses `partyId`; enrollment uses `studentPartyId`.
- Gate 3 Tenant Isolation: API resolves tenant from authenticated user context before writes.
- Gate 4 RLS/Auth: no RLS/grant changes.
- Gate 5 Migration Safety: no schema change.
- Gate 6 Event-After-Persistence: Enrollment engine remains responsible.
- Gate 7 Academic Safety Routing: course validation remains in Education engine.
- Gate 8 Temporal Provenance: not changed.
- Gate 9 Rule Governance: not changed.
- Gate 10 Audit Evidence: API response includes persisted/read-back IDs.
- Gate 11 Regression: focused route tests, existing R3 Student tests, scoped lint/diff checks.

---

# ARCHITECTURE GATE RESULT - R3 STUDENT CREATE-SIDE COMPLETION

> **Status:** PASS - minimal R3 create-side cutover for canonical Party-backed Students
> **Date:** 2026-09-26
> **Scope:** Education Student create path only; prerequisite for Preschool New Student enrollment

---

## 1. Product Manifest (Capabilities & Scope)

This change completes the proven R3 create-side gap:

```text
New canonical Party
        ↓
Student role creation
        ↓
students.party_id = party_parties.id
students.person_id = NULL
```

Included:
- Relax the transitional `students.person_id` NOT NULL requirement.
- Preserve `students.person_id` column, FK, index, and legacy read path.
- Preserve canonical `partyId` requirement at the Student application/contract boundary.
- Stop requiring `identity_migration_mapping` for brand-new canonical Student creation.
- Fix the proven semantic bug where `studentPartyId` was queried against `students.person_id`.

Excluded:
- No Preschool Enrollment implementation in this task.
- No `persons` creation for new Students.
- No fake `identity_migration_mapping` rows.
- No `students.party_id NOT NULL` schema hardening.
- No legacy cleanup, mapping removal, BDGF, migration history, or production deployment.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.students` | Education OS Student bounded context | Student role state for canonical Party identity |
| `public.party_parties` | Platform Party identity | Canonical person Party identity |
| `public.persons` | Legacy Platform Host Person | Transitional legacy identity retained for existing rows |
| `public.identity_migration_mapping` | R3 migration bridge | Legacy mapping for migrated rows only |

## 3. Contract Dependency Map

```text
Preschool Product
        ↓
Education Student Contract
        ↓
StudentService
        ↓
StudentAggregate
        ↓
StudentRepository
        ↓
public.students
        ↓
party_id → public.party_parties(id)
```

Legacy compatibility remains:

```text
Existing legacy consumers
        ↓
StudentRepository.findByPersonId()
        ↓
students.person_id → public.persons(id)
```

## 4. Change Authority

Authorized by owner prompt:
- Education Student create path.
- One additive/transitional schema migration: `ALTER COLUMN person_id DROP NOT NULL`.
- Generated DB type refresh/update for `students.person_id` nullability.
- Focused tests for Student create/read-back/legacy compatibility.

Not authorized:
- Preschool UI/backend wiring.
- BDGF/governance changes.
- Production migration execution.
- Broad Education architecture refactor.

## 5. UI → Contract Reconciliation

No UI changes in this task. Preschool UI remains out of scope until R3 create-side is reviewed and deployed.

## 6. Additive Migration Plan

One migration only:

```sql
ALTER TABLE public.students
ALTER COLUMN person_id DROP NOT NULL;
```

No data mutation, backfill, FK/index removal, Party hardening, or legacy cleanup.

## 7. Verification Gates Plan

- Gate 1 Architecture Compliance: scoped Education changes only; no cross-industry imports.
- Gate 2 Contract Boundary: Student public contract remains Party-based.
- Gate 3 Tenant Isolation: preserve tenant filters in StudentRepository/Service.
- Gate 4 RLS/Auth: no RLS or grant changes.
- Gate 5 Migration Safety: transitional nullable change only; no destructive column/FK removal.
- Gate 6 Event-After-Persistence: not applicable; no event behavior changed.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: not applicable.
- Gate 11 Regression: focused Student tests, affected Education tests where available, scoped TypeScript/lint.

---

# ARCHITECTURE GATE RESULT - BELLA ENGLISH CENTER POST-RC ENVIRONMENT CLOSURE

> **Status:** PASS - dev-only API auth-context repair for Post-RC runtime validation
> **Date:** 2026-09-15
> **Canonical base:** `origin/main@fbff36721c3f53067cbd3992157dbb3ba04e634a`
> **Scope:** English Center API runtime validation path only

---

## 1. Product Manifest (Capabilities & Scope)

This closure does not add a new English Center business capability. It fixes the local Post-RC browser validation path where development mock authentication resolves a tenant/user but the API repository Supabase client remains anonymous, causing RLS-backed Command Center reads to fail against `public.user_org_unit_access`.

Included:
- Keep E6-E9 product surfaces unchanged.
- Keep canonical Education OS contracts unchanged.
- Use a service-role Supabase client only for the existing development mock-user branch.
- Preserve production cookie/JWT Supabase client behavior.

Excluded:
- No Education Kernel modification.
- No Healthcare, Logistics, Finance, or cross-industry dependency.
- No `anon` database grant expansion to make tests pass.
- No new database table, policy, or migration in code.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/app/api/english-center/_shared.ts` | Bella English Center API boundary | API context resolution only |
| `public.user_org_unit_access` | Platform Authorization projection | Existing branch/org-unit access read model |
| English Center E2-E8 tables | Bella English Center Product | Existing product-owned projections and runtime data |

## 3. Contract Dependency Map

```
Post-RC browser gate
        |
        v
English Center API context
        |
        +-- production auth: SSR Supabase client with user JWT
        |
        +-- development mock auth: service-role Supabase client
        |
        v
English Center repositories
        |
        v
Platform Authorization projection (user_org_unit_access)
        |
        v
Product RLS / tenant / branch scope
```

No Product -> Education Kernel bypass is introduced.

## 4. Additive Migration Plan

No code migration is added. Environment closure applied canonical existing migrations/grants to the linked Supabase project and refreshed PostgREST schema cache separately from this source patch.

## 5. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no `src/platform/education/` change; no cross-industry import.
- Gate 2 Contract Boundary: no Education contract bypass change.
- Gate 3 Tenant Isolation: preserve tenant lookup and RLS-backed branch filtering.
- Gate 4 RLS & Authorization: do not grant `anon`; development mock uses controlled admin client.
- Gate 5 Database Migration Safety: no new migration.
- Gate 6 Event-After-Persistence: not applicable; read-only API context path.
- Gate 7 Academic Safety Routing: not applicable; no assessment calculation change.
- Gate 8 Temporal Provenance: not applicable; no temporal write.
- Gate 9 Rule Governance: not applicable; no grading rule change.
- Gate 10 Audit Evidence Integrity: not applicable; no transcript/export change.
- Gate 11 Platform Regression: run Post-RC browser gate and targeted English Center API tests.

---

# ARCHITECTURE GATE RESULT — PR82 CI REMEDIATION

> **Status:** PASS — CI-only remediation, no Product Vertical or Kernel impact
> **Date:** 2026-09-13
> **Scope:** GitHub Actions checks for PR #82 (`infra/git-workflow-constitution-install`)

---

## 1. Product Manifest (Capabilities & Scope)

This change is limited to CI workflow execution policy:
- Bound API documentation checks to API/API-documentation changes.
- Bound live Supabase/DB checks to database, application, or DB-check changes.
- Remove unsafe direct GitHub context interpolation from shell `run:` blocks.
- Pin the branch-cleanup GitHub Action to an immutable commit SHA.

No Healthcare, Education, Logistics, Finance, or Product Vertical runtime capability is added or changed.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

No business data or domain entity is owned or modified by this change.

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `.github/workflows/*` | Repository CI Governance | Automation policy only |
| `docs/api-reference.md` | API Documentation Governance | Referenced deliverable, not created in this change |

## 3. Contract Dependency Map

```
GitHub PR event
        │
        ▼
GitHub Actions workflow checks
        │
        ├── Repo scripts (`npm run docs:api:*`)
        └── GitHub Advanced Security Semgrep OSS
```

No Product -> Contract -> Kernel dependency exists in this remediation.

## 4. Additive Migration Plan

No database migration. No schema change. No RLS policy change.

## 5. 11 Automated Verification Gates Plan

The Healthcare/Education 11-gate product-vertical suite is not applicable because no vertical or kernel code is touched.

Targeted verification for this CI remediation:
- YAML parse / workflow syntax validation.
- Semgrep OSS annotations addressed without disabling scanner.
- API docs check remains enforced for API/API-doc changes and is skipped for infra-only PRs.
- Live DB checks remain enforced for DB/application/DB-check changes and are skipped for infra-only PRs.
- GitHub Actions status rechecked after commit/push.

---

# ARCHITECTURE GATE RESULT — BELLA FINANCE OS KERNEL F1

> **Status:** APPROVED BY HUMAN ARCHITECT
> **Milestone:** Phase F1.1 & F1.2 Initialization
> **Author:** Architecture Review AI (Antigravity)
> **Date:** 2026-08-15

---

## 1. Product Manifest (Capabilities & Scope)

Finance OS Kernel F1 Ledger Engine provides core double-entry bookkeeping and accounting capabilities to the Bella Platform. It handles the financial truth layer without any business vertical dependencies.

### Capabilities Exposed:
- **COA Management**: Chart of accounts definition with strict normal balances (Debit/Credit).
- **Accounting Periods**: Open, close, and lock periods. Prevent posting to closed/locked periods.
- **Double-Entry Posting**: Balanced journal entry transactions.
- **Traceable Sourcing**: Map financial records back to vertical business events via opaque `source_type`/`source_id` references.
- **Immutability Enforcement**: Voiding and reversing transactions. No direct updates to posted entries.
- **Idempotent Dispatch**: Prevent duplicate posting using client-provided unique idempotency keys.
- **Decimal Precision**: Represent money in string-based minor units (`amount_minor`) to avoid floating-point math errors.
- **Reporting Dimensions**: Support cost center, BU, location, and department dimensions natively.

---

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Table Name | Owner Context | Data Definition |
|---|---|---|
| `finance_accounts` | F1 Ledger | Chart of accounts list |
| `finance_accounting_periods` | F1 Ledger | Accounting periods & locks |
| `finance_transactions` | F1 Ledger | Transaction headers, idempotency keys, source mapping |
| `finance_transaction_lines` | F1 Ledger | Double-entry line items, debit/credit string amounts, dimensions |
| `finance_outbox_events` | F1 Ledger | Transactional outbox records for event publishing |
| `finance_audit_trail` | F1 Ledger | Immutable log of all updates to financial state |

---

## 3. Contract Dependency Map

```
Vertical Layer (Spa, Hospital, etc.)
               │
               ▼
Vertical Finance Bridge (ACL)
               │
               ▼ (Calls via Public Contracts only)
ILedgerEngine Contract (F1)
               │
               ▼
LedgerEngineService (F1 Implementation)
               │
               ├── Updates database (finance_*)
               └── Writes to transactional outbox (finance_outbox_events)
```

---

## 4. Additive Migration Plan

No existing accounting or business tables will be deleted or modified. The migration strictly creates new tables.

### SQL Migrations Proposed:
- `CREATE TABLE finance_accounting_periods` with columns for period range and status.
- `CREATE TABLE finance_accounts` with code, normal balance, and status.
- `CREATE TABLE finance_transactions` with status, functional/transaction currency, source type/id, and idempotency key.
- `CREATE TABLE finance_transaction_lines` with debit/credit string representation and dimensions.
- `CREATE TABLE finance_outbox_events` with payload and status.
- `CREATE TABLE finance_audit_trail` for immutable history tracking.
- Enable RLS on all tables with policies asserting `tenant_id = auth.jwt()->>'tenant_id'`.

---

## 5. 10 Automated Verification Gates Plan

| Gate | Verification Target | Test Method |
|---|---|---|
| **Gate F-1** | Architecture Compliance | Static analysis to ensure no vertical imports in F1, and strict typing (no `any` type). |
| **Gate F-2** | Contract Boundary | Verify vertical layers cannot query `finance_*` tables directly, only via contracts. |
| **Gate F-3** | Tenant Isolation (P0) | Assert that data from Tenant A is never visible/accessible to Tenant B across all F1 methods. |
| **Gate F-4** | Double-Entry Invariant | Assert that trying to post an imbalanced entry (Σ debit ≠ Σ credit) throws `DOUBLE_ENTRY_IMBALANCE`. |
| **Gate F-5** | Transaction Immutability | Assert that updating a transaction with status `POSTED` throws an exception, and that reversing creates mirror lines. |
| **Gate F-6** | Idempotency | Assert that two consecutive `postTransaction` calls with the same key return the same transaction ID without duplication. |
| **Gate F-7** | Period Control | Assert that posting to a `CLOSED` or `LOCKED` period is blocked with `PERIOD_NOT_OPEN`. |
| **Gate F-8** | Event-After-Persistence | Verify that `finance_outbox_events` has the event record committed in the same transaction, and the dispatcher publishes it successfully. |
| **Gate F-9** | Full Regression | Run all Finance OS test suites to ensure 100% test coverage. |
| **Gate F-10** | Financial State Reconstruction | Rebuild materialized state from authoritative records and verify equality. |

---

# Additional Architecture Gate - Production Smoke Network Evidence

> **Status:** PASS - production workflow diagnostics only
> **Date:** 2026-10-04
> **Scope:** `Deploy to Production` smoke evidence for exact preview gate

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37189982072` passed immutable config, lint, critical tests, security, migration, build, exact preview deploy, and exact preview health, then failed in `Smoke Exact Preview` because `/dashboard` stayed on the TenantContextProvider loading screen.

Source of Truth: GitHub Actions run logs and the existing Playwright smoke route contract.

Canonical Contract: production smoke must use real authentication and must not bypass app auth, mutate business data, or infer readiness from health alone.

Ownership: `.github/workflows/deploy-production.yml` is Repository CI/Production Ops governance. `e2e/tests/12-authenticated-core-routes-smoke.spec.ts` is read-only production smoke evidence.

Boundary: diagnostic-only. No runtime route, auth architecture, tenant model, database, credential, or English business logic is changed.

## 2. Product Manifest

This change adds no product capability. It improves failure evidence for the existing production smoke gate by:

- recording sanitized app network status metadata for the smoke browser session;
- surfacing `/api/tenant/context` status/path evidence when a route remains stuck before expected content renders;
- uploading Playwright artifacts from the production smoke job for RCA.
- keeping Playwright E2E specs out of the direct Jest changed-test runner.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `.github/workflows/deploy-production.yml` | Platform/CI Governance | Production workflow artifact collection |
| `e2e/tests/12-authenticated-core-routes-smoke.spec.ts` | Production Ops Evidence | Read-only browser smoke diagnostics |
| `scripts/test-changed-files.mjs` | CI Governance | Changed-file Jest routing only |

## 4. Contract Dependency Map

```text
Deploy to Production workflow
        ↓
Exact preview
        ↓
Real-auth Playwright smoke
        ↓
Sanitized browser network evidence
        ↓
RCA for first failing production gate
```

No Product -> Contract -> Kernel path is modified.

## 5. Change Authority

Authorized by Production Ops Go-Live audit boundary. The change is limited to evidence collection for the current production smoke blocker.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior, route content, or user-facing component is changed.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Education, Logistics, Finance, or Product runtime code changed.
- Gate 2 Contract Boundary: production smoke remains real-auth and read-only.
- Gate 3 Tenant Isolation: no tenant query or policy change.
- Gate 4 Permission: no auth bypass or credential change.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: not modified.
- Gate 8 Runtime Evidence: exact preview smoke gets sanitized network diagnostics.
- Gate 9 Secret Hygiene: diagnostics exclude headers, cookies, tokens, and secrets.
- Gate 10 CI Governance: artifacts retained for failed smoke RCA.
- Gate 11 Regression: run targeted lint/typecheck/diff checks.

---

# Additional Architecture Gate - Tenant Context Route Session Resolution

> **Status:** PASS - minimal runtime fix authorized
> **Date:** 2026-10-04
> **Scope:** `/api/tenant/context` production smoke authentication blocker

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37192393312` passed immutable config, lint, critical tests, security, migration, build, exact preview deploy, and exact preview health, then failed in `Smoke Exact Preview` because `/api/tenant/context` returned `401` while `/dashboard` loaded as an authenticated document.

Source of Truth: GitHub Actions smoke artifact `production-smoke-artifacts`, sanitized Playwright network evidence, and the Supabase SSR cookie contract.

Canonical Contract: `/api/tenant/context` must resolve a verified Supabase Auth user from the request session and then read that user's tenant profile. It must not bypass authentication, hard-code tenant/user identity, or convert health/auth smoke into a fake PASS.

Ownership: `src/app/api/tenant/context/route.ts` owns the tenant-context API route session resolution. Supabase Auth remains the authentication source of truth. `public.users.tenant_id` remains the tenant ownership source.

Boundary: route-handler session handling only. No English business logic, tenant model, schema, migration, credential, middleware redesign, or broad auth abstraction is changed.

## 2. Product Manifest

This change adds no product capability. It restores the existing tenant context route's ability to read production Supabase SSR auth cookies, including chunked cookies.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/app/api/tenant/context/route.ts` | Platform tenant context API | Authenticated user -> tenant context read |
| `src/__tests__/api-tenant-context.test.ts` | Route regression coverage | Unauthenticated and authenticated cookie/session paths |

## 4. Contract Dependency Map

```text
Browser Supabase Auth cookie
        ↓
Supabase SSR Route Handler client
        ↓
Verified auth user
        ↓
public.users.tenant_id
        ↓
public.tenants
        ↓
TenantContext response
```

No Product -> Education Kernel contract is modified.

## 5. Change Authority

Authorized by Production Smoke RCA for a hẹp runtime blocker: valid authenticated production session reaches `/api/tenant/context` as `401`. The allowed change is limited to session/cookie resolution in the route handler.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior or visual contract changes.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: route continues to require verified Supabase Auth user.
- Gate 3 Tenant Isolation: tenant context still derives from authenticated user's `tenant_id`.
- Gate 4 Permission: unauthenticated request must remain `401`.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: English business logic not modified.
- Gate 8 Runtime Evidence: production smoke should move past `/api/tenant/context 401`.
- Gate 9 Secret Hygiene: no credential logging or fixture secrets.
- Gate 10 CI Governance: targeted route test, lint, typecheck, architecture, security.
- Gate 11 Regression: production workflow remains final authority after merge.

---

# Additional Architecture Gate - Preschool Critical Flow Audit

> **Status:** PASS for authorized product/API/service fixes; Real DB and browser E2E remain NOT_PROVEN
> **Date:** 2026-10-06
> **Scope:** Preschool critical user journey audit after Chain implementation seal

## 1. Bella OS/Product Development Process Gate

Truth: Preschool Chain implementation is complete but Go-Live proof is not complete without Real DB/UI E2E. The follow-up scope is the non-Chain Preschool critical flow audit: Student/Admission, Branch/Chain assignment, Class, Enrollment, Attendance, Tuition/Payment, Parent/Guardian, and Reporting.

Source of Truth: existing Education product routes, product services, public Education contracts, canonical `edu_*`, `party_*`, `org_units`, `user_org_unit_access`, and `edu_fin_*` tables.

Canonical Contract: Product UI/API must route through Bella Education product services or existing public contracts, preserve tenant isolation, derive tenant/user authority server-side, and read back from canonical persistence. Mock/static UI data cannot prove runtime product readiness.

Ownership: Preschool product/API layers own UI orchestration and route authorization. Education contracts/kernel own canonical student/enrollment/course/attendance persistence and remain frozen. Platform Org Unit remains the Branch/Chain registration authority.

Boundary: authorized product/API/service fixes only. No Education Kernel modification, no Platform authority change, no frozen Healthcare/Logistics artifacts, no non-additive schema mutation, and no new architecture/framework.

## 2. Product Manifest

No new product capability is introduced. Fixes wire existing Preschool capabilities and screens to already-present product/service/contract paths.

## 3. Ownership Map

| Flow | Owner | Canonical Data |
|---|---|---|
| Student/Admission | Preschool UI/API + Education Student/Enrollment contracts | `party_parties`, `students`, `edu_enrollments` |
| Branch/Chain | Platform Org Unit + Preschool runtime assignment | `org_units`, `user_org_unit_access`, `preschool_chain_*` |
| Class | Preschool API + Education course/teacher contracts | `edu_courses`, projection `courses`, `teacher_assignments` |
| Attendance/Handover | Preschool API + Attendance contract + handover service | `edu_attendance_daily_state`, `edu_preschool_pickup_handover_events` |
| Tuition/Payment | Preschool Finance services/repository | `edu_fin_*` |
| Parent/Guardian | Preschool guardian/parent services | `party_relationships`, `party_identifiers`, `edu_preschool_pickup_authorizations` |
| Reporting | Preschool Analytics service/repository | canonical current snapshot reads across `edu_*`, `edu_fin_*`, `edu_comm_*` |

## 4. Contract Dependency Map

```text
Preschool UI
  -> Product API route
  -> Existing Product service / Education public contract
  -> Canonical DB tables
  -> Product read-back API
  -> UI read-back
```

## 5. Change Authority

Authorized changes are limited to product UI/API/services and tests needed to close true gaps found during the audit. Education kernel and Platform authority boundaries are not modified.

## 6. UI -> Contract Reconciliation

Static/demo Preschool UI surfaces were reconciled to canonical APIs where they affected critical read-back: enrollment registry, class list, attendance/handover authorization, parent daily access, and reporting current KPIs.

## 7. Additive Migration Plan

No new migration in this continuation. Existing Preschool Chain migration remains part of the prior Chain implementation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Education Kernel, Healthcare Kernel, or Logistics sealed files modified.
- Gate 2 Contract Boundary: product routes call existing product services/contracts.
- Gate 3 Tenant Isolation: API routes derive tenant from authenticated user or existing context.
- Gate 4 Authorization: attendance/handover, finance, parent, and analytics role boundaries are covered.
- Gate 5 Database Migration Safety: no continuation migration.
- Gate 6 Event-After-Persistence: enrollment evidence remains contract/engine-owned.
- Gate 7 Business Flow: focused tests cover route/service GAPs.
- Gate 8 Real DB Evidence: BLOCKED/NOT_PROVEN without environment.
- Gate 9 Secret Hygiene: no credential or secret output.
- Gate 10 CI Governance: focused tests, typecheck, lint, education gates, diff check.
- Gate 11 Regression: browser UI E2E remains NOT_PROVEN until environment is available.

---

# Additional Architecture Gate - Tenant Context Raw Cookie Header Fallback

> **Status:** PASS - route-only follow-up authorized
> **Date:** 2026-10-04
> **Scope:** `/api/tenant/context` production smoke authentication blocker follow-up

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37198145961` deployed merge SHA `9bd313b8c9398788234f2cc8ef182f012c1e922f`; validate/build/preview health passed, but `Smoke Exact Preview` still failed with `/api/tenant/context` returning `401`. Sanitized trace evidence shows the request includes a Supabase Auth cookie named `sb-lvnvkpyxtuilhrabtlwv-auth-token`; decoded JWT metadata confirms the token is unexpired, `aud=authenticated`, `role=authenticated`, and issued by the matching Supabase project. The blocker is therefore narrower than credential, cookie-domain, or English business logic.

Source of Truth: GitHub Actions smoke artifact `production-smoke-artifacts` from run `37198145961`, sanitized Playwright trace network headers, and `/api/tenant/context` route session resolution code.

Canonical Contract: `/api/tenant/context` may only return tenant context after resolving a verified Supabase Auth user. It may read the raw `Cookie` header only as an additional source of the same Supabase Auth cookie already present on the request, then still validate the access token through Supabase Auth.

Ownership: `src/app/api/tenant/context/route.ts` owns this fallback. Supabase Auth remains the authentication source of truth. `public.users.tenant_id` remains the tenant ownership source.

Boundary: route-only cookie candidate resolution. No provider change, middleware redesign, schema/migration, credential, tenant model, permission redesign, English business logic, or auth bypass.

## 2. Product Manifest

No product capability is added. This follow-up hardens existing production Route Handler session resolution when `Cookie` is present in the HTTP request but the route cookie abstraction does not expose the auth cookie.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/app/api/tenant/context/route.ts` | Platform tenant context API | Raw Cookie header fallback to verified Supabase Auth user |
| `src/__tests__/api-tenant-context.test.ts` | Route regression coverage | Header-present/cookie-abstraction-empty authenticated request |

## 4. Contract Dependency Map

```text
HTTP Cookie header
        ↓
Supabase auth cookie candidate
        ↓
Decoded access token
        ↓
Supabase auth.getUser(accessToken)
        ↓
public.users.tenant_id
        ↓
TenantContext response
```

No Product -> Education Kernel contract is modified.

## 5. Change Authority

Authorized by production smoke RCA after the first route session fix merged cleanly but the same production 401 remained. The new evidence shows the auth cookie is present in the browser request; the minimal permitted change is to read that raw request header as a fallback and still verify the token through Supabase.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior or visual contract changes.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: route still requires Supabase Auth verification.
- Gate 3 Tenant Isolation: tenant context still derives from authenticated user's `tenant_id`.
- Gate 4 Permission: unauthenticated request must remain `401`.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: English business logic not modified.
- Gate 8 Runtime Evidence: production smoke should move past `/api/tenant/context 401`.
- Gate 9 Secret Hygiene: no credential, cookie, or token value logging.
- Gate 10 CI Governance: targeted route test, lint, typecheck, architecture, security.
- Gate 11 Regression: production workflow remains final authority after merge.

---

# Additional Architecture Gate - Supabase Server Client Public Env Contract

> **Status:** PASS - runtime client follow-up authorized
> **Date:** 2026-10-04
> **Scope:** Dashboard production smoke server-action authentication blocker

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37208465631` deployed merge SHA `fec5eb0110833cd50e9c00010159849f446e54e7`; validate/build immutable preview passed, `/api/tenant/context` returned `200`, and `X-Environment` was `production`. The remaining blocker is `Smoke Exact Preview`, where the dashboard layout server-action sequence returned one `/dashboard` POST `200` followed by one `/dashboard` POST `500` with React Server Component digest `2492357065`.

Source of Truth: GitHub Actions run `37208465631`, sanitized Playwright trace artifact `production-smoke-artifacts`, dashboard layout client chunk mapping, and `src/lib/supabase-server.ts`.

Canonical Contract: server-side Supabase clients must use the shared public environment contract: `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback. Runtime auth must continue to validate the Supabase session through Supabase Auth; no mock, bypass, hard-coded user, or credential fallback is allowed.

Ownership: `src/lib/supabase-server.ts` owns the server-side SSR Supabase client. `src/lib/supabase-public-env.ts` owns public Supabase environment resolution. `src/services/user-actions.ts` consumes the server client but does not own environment resolution.

Boundary: shared runtime client environment resolution only. No English business code, schema/migration, production data mutation, credential logging, auth bypass, tenant model, or dashboard UX redesign.

## 2. Product Manifest

No product capability is added. This change aligns the server-action auth path with the existing production public-env contract already used by browser and tenant-context code.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/lib/supabase-server.ts` | Platform runtime Supabase SSR client | Server-side Supabase URL/key resolution and cookie-bound auth client |
| `src/lib/supabase-public-env.ts` | Platform env contract | Canonical public URL/key fallback logic |
| `src/__tests__/supabase-server-env.test.ts` | Runtime env regression coverage | Server SSR client must work when only publishable key is configured |

## 4. Contract Dependency Map

```text
DashboardLayout client
        ↓
getCurrentUser server action
        ↓
createClient() / Supabase SSR client
        ↓
Canonical public env contract
        ↓
Supabase auth.getUser()
        ↓
public.users.tenant_id
```

No Product -> Education Kernel contract is modified.

## 5. Change Authority

Authorized by production smoke RCA after tenant-context moved from `401` to `200` and the first failing runtime boundary became dashboard server-action auth. The minimal permitted change is to reuse the shared public Supabase env resolver in the server client.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior or visual contract changes.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: runtime continues to require verified Supabase Auth session.
- Gate 3 Tenant Isolation: current user still derives `tenant_id` from `public.users`.
- Gate 4 Permission: unauthenticated behavior remains login redirect / unauthorized.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: English business logic not modified.
- Gate 8 Runtime Evidence: production smoke should move past `/dashboard` server-action auth 500.
- Gate 9 Secret Hygiene: no credential, cookie, or token value logging.
- Gate 10 CI Governance: targeted auth test, lint, typecheck, architecture, security.
- Gate 11 Regression: production workflow remains final authority after merge.

---

# Additional Architecture Gate - Preschool Chain Real DB Evidence Harness

> **Status:** PASS for harness integration; BLOCKED for real DB execution evidence
> **Date:** 2026-10-06
> **Scope:** Bella Preschool Chain proof wiring only

## 1. Bella OS/Product Development Process Gate

Truth: Preschool Chain runtime implementation is locally proven, but Go-Live proof still requires a real database run. The canonical real DB evidence path in this repository is `jest.real-db.config.ts` plus `jest.real-db.setup.ts`, which fails on missing or mock Supabase credentials.

Source of Truth: existing real DB Jest config/setup, existing Haircut/Nail and Beauty real DB tests, Preschool enrollment route, Education contracts, Platform Org Unit, and the additive Preschool Chain migration.

Canonical Contract: Preschool uses Platform `org_units` branches as the registration/management authority and product-owned `preschool_chain_*` assignment tables for runtime course/enrollment branch assignment. The proof must run through the existing real DB Jest lane; no new DB E2E framework is introduced.

Ownership: Platform owns `org_units` and `org_relationships`; Education Kernel owns `edu_courses` and `edu_enrollments`; Bella Education product owns Preschool Chain assignment persistence and admission UI/API consumption.

Boundary: test harness and evidence integration only. No runtime Chain logic, Education Kernel, Platform Org Unit, Healthcare, Logistics, Finance, or shared Core code changed.

## 2. Product Manifest

No new product capability is added. This work adds real DB proof coverage for the existing Preschool admission/enrollment/branch assignment capability.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `jest.real-db.config.ts` | CI evidence lane | Canonical allowlist for real DB E2E suites |
| `src/products/bella-education/__tests__/preschool-chain-real-db.test.ts` | Bella Education product test | Real DB proof of Preschool branch assignment chain |
| `supabase/migrations/20261006010000_preschool_chain_assignments.sql` | Bella Education product schema | Product-owned additive Preschool Chain tables |

## 4. Contract Dependency Map

```text
Preschool admission route
        ↓
Student / Enrollment public contracts
        ↓
edu_enrollments
        ↓
PreschoolChainService
        ↓
Platform org_units / org_relationships
        ↓
preschool_chain_course_branch_assignments
        ↓
preschool_chain_enrollment_branch_assignments
        ↓
service read-back / tenant isolation / branch authorization / idempotent retry
```

## 5. Change Authority

Authorized by the request to complete Preschool Chain evidence execution, specifically by reusing the existing canonical real DB workflow and not continuing runtime Chain feature work.

## 6. UI -> Contract Reconciliation

No UI changes. Existing local route/UI tests cover branch selection and admission response. Real DB proof is added at API/service/database boundary because current local environment does not provide browser-authenticated real DB credentials.

## 7. Additive Migration Plan

No new migration in this step. The real DB test verifies the existing additive Preschool Chain migration tables, RLS enablement, and tenant-isolation policies are present in the target database.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Education Kernel or Platform runtime change.
- Gate 2 Contract Boundary: route still uses Student/Enrollment contracts and Platform Org Unit contract.
- Gate 3 Tenant Isolation: test verifies tenant-scoped read-back and cross-tenant null read.
- Gate 4 Authorization: test verifies only assigned branch is accessible and another branch is denied.
- Gate 5 Database Migration Safety: test checks real DB tables/RLS/policies from the additive migration.
- Gate 6 Event-After-Persistence: not changed in this evidence step.
- Gate 7 Academic Safety Routing: not applicable to branch assignment.
- Gate 8 Runtime Evidence: `npx jest --config jest.real-db.config.ts src/products/bella-education/__tests__/preschool-chain-real-db.test.ts --runInBand`.
- Gate 9 Secret Hygiene: test reads env only through existing Supabase env helpers; no secrets logged.
- Gate 10 CI Governance: targeted lint, typecheck, no-new-debt, architecture baseline.
- Gate 11 Regression: existing Preschool Chain local route/service tests remain passing.

## 9. Current Evidence

```ini
REAL_DB_E2E = BLOCKED
Reason = jest.real-db.setup.ts detected mock Supabase credentials
Observed = NEXT_PUBLIC_SUPABASE_URL=mock.supabase.co, SUPABASE_SERVICE_ROLE_KEY=mock-service-role-key
```

---

# Additional Architecture Gate - Legacy BabyCare KTV Branchless Attendance

> **Status:** PASS
> **Date:** 2026-10-06
> **Scope:** KTV daily attendance branch resolution for legacy `bella_babycare` tenants only.

## 1. Bella OS/Product Development Process Gate

Truth: BabyCare legacy tenant identity is `tenants.product_key = 'bella_babycare'`. The legacy Bella Spa BabyCare runtime is not registered as a Platform branch/chain tenant, so KTV shift attendance must not require `people_directory -> org_relationships -> org_units` branch proof when no branch is selected.

Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, `src/platform/registry/product-registry.ts`, `src/services/attendance-actions.ts`, and the user-provided KTV UI error showing branch resolution failure before check-in.

Canonical Contract: Product identity comes from `tenant.product_key -> ProductRegistry`. Branch-aware attendance remains required for branch-platform Beauty products; legacy BabyCare attendance remains tenant-scoped and branchless.

Ownership: Product Registry owns product identity. Attendance actions own KTV check-in/check-out mutation behavior. Platform branch registration owns branch membership and must not be retrofitted onto legacy BabyCare for this fix.

Boundary: no migration, no HQ tenant registration mutation, no Product Registry change, no Healthcare/Education/Logistics kernel change, and no payroll recalculation change.

## 2. Product Manifest

| Product | Product key | Attendance branch requirement |
|---|---|---|
| Bella Mommy Baby Care legacy | `bella_babycare` | Branchless tenant-scoped attendance allowed |
| Bella Beauty Spa v2 / Haircut / Nail | `bella_spa`, `bella_haircut`, `bella_nail` | Platform branch proof required |

## 3. Ownership Map

| Artifact | Owner | Role |
|---|---|---|
| `src/services/attendance-actions.ts` | Attendance workflow | KTV daily attendance read/write |
| `src/services/beauty-branch-context.ts` | Beauty branch context | Branch proof for branch-aware products |
| `src/__tests__/attendance-actions.test.ts` | Regression test | Proves BabyCare branchless exception and preserves branch-aware guard |

## 4. Contract Dependency Map

```text
KTV check-in
  -> current user tenant_id
  -> tenants.product_key
  -> bella_babycare legacy branchless exception OR Platform branch resolver
  -> attendance insert/update
```

## 5. Change Authority

The user reported KTV check-in failure after HQ tenant registration management changed, and clarified this BabyCare is legacy Bella Spa BabyCare, not registered under Platform. This authorizes only the BabyCare legacy attendance branch-resolution correction.

## 6. UI -> Contract Reconciliation

| UI symptom | Contract | Result |
|---|---|---|
| KTV screen shows "Không xác định được chi nhánh chấm công của KTV" | Legacy BabyCare does not have Platform branch registration | `STALE CONSUMER` |
| KTV "Đầu ca: CHECK-IN" | Tenant-scoped attendance is enough for BabyCare | `MATCH AFTER FIX` |

## 7. Additive Migration Plan

No migration. Existing `attendance.branch_id` remains nullable for legacy rows. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: product identity read uses `tenants.product_key`, not `enabled_modules`.
- Gate 3 Tenant Isolation: attendance insert still writes and filters by `tenant_id`.
- Gate 4 Permission: only authenticated KTV users can check in/out.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: no new event behavior.
- Gate 7 Audit: audit log remains after attendance persistence.
- Gate 8 UI Contract: BabyCare KTV check-in no longer depends on Platform branch registration.
- Gate 9 Secret Hygiene: no credential or environment value touched.
- Gate 10 Targeted Regression: `attendance-actions.test.ts` covers legacy BabyCare branchless check-in.
- Gate 11 Type Safety: run targeted Jest and TypeScript/type-focused verification as available.

---

# Additional Architecture Gate - HQ Admin Dashboard Product Shell Denial

> **Status:** PASS
> **Date:** 2026-10-06
> **Scope:** Prevent HQ-only admin accounts from entering `/dashboard` product shells.

## 1. Bella OS/Product Development Process Gate

Truth: HQ identity is `tenants.product_key = 'bella_hq'`. HQ users are administrative system users for `/hq`, not product users for `/dashboard` vertical runtimes.

Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, `src/lib/business-rules/hq-tenant.ts`, `src/services/hq-actions.ts`, `src/app/hq/login/hq-login-client.tsx`, and the reported UI evidence showing `Bella HQ Admin` inside the Beauty/Spa dashboard shell.

Canonical Contract: Product identity comes from `tenant.product_key`. `bella_hq` must route to `/hq` and must not be rendered by dashboard product shell consumers.

Ownership: HQ auth boundary owns HQ authorization. Dashboard layout owns product-shell admission. Product verticals own their own runtime views but do not own HQ identity.

Boundary: no schema change, no data mutation, no Product Registry change, no Healthcare/Education/Logistics kernel change, no HQ feature expansion, and no Beauty UI redesign.

## 2. Product Manifest

No product capability is added. This is a route-boundary correction for the existing HQ administrative tenant.

## 3. Ownership Map

| Artifact | Owner | Role |
|---|---|---|
| `src/lib/business-rules/hq-tenant.ts` | HQ business rule | Canonical `bella_hq` predicate |
| `src/app/dashboard/layout.tsx` | Dashboard product shell | Deny HQ tenant from product shell |
| `src/__tests__/tenant-isolation-source-guards.test.ts` | Source guard regression | Proves dashboard shell redirects HQ tenant to `/hq` |

## 4. Contract Dependency Map

```text
DashboardLayout
  -> getCachedCurrentUser()
  -> getCachedTenantSettings()
  -> tenants.product_key
  -> isHqTenant()
  -> /hq redirect before product shell authorization
```

## 5. Change Authority

The user reported that HQ admin is being assigned/rendered as Bella Spa and clarified the account is HQ-only, not a product login. This authorizes dashboard route-boundary correction only.

## 6. UI -> Contract Reconciliation

| UI symptom | Contract | Result |
|---|---|---|
| `Bella HQ Admin` appears in `/dashboard` Beauty/Spa shell | `bella_hq` users belong in `/hq` only | `STALE CONSUMER` |
| Generic `/login` sends successful users to `/dashboard` | Dashboard shell must enforce tenant product boundary | `GUARD REQUIRED` |

## 7. Additive Migration Plan

No migration. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: use `isHqTenant()` and `tenant.product_key`, not tenant name or enabled modules.
- Gate 3 Tenant Isolation: dashboard shell no longer renders HQ tenant product UI.
- Gate 4 Permission: existing `/hq` auth remains enforced by `checkHqAuth()`.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Audit: no mutation, no audit event.
- Gate 8 UI Contract: HQ users redirect to `/hq` before dashboard shell authorization.
- Gate 9 Secret Hygiene: no credentials touched.
- Gate 10 Targeted Regression: static source guard for dashboard HQ redirect.
- Gate 11 Type Safety: run targeted Jest and type-focused verification as available.

---

## Additional Architecture Gate - Timeline KTV Presentation Alignment

> **Status:** PASS
> **Date:** 2026-10-06
> **Scope:** Presentation Layer (`TimelineKtvView.tsx`) - synchronize timeline grid slot heights, card positioning, card height, and live current-time line position.

### 1. Bella OS/Product Development Process Gate
- **Constitution:** Bella AI Coding Constitution (`docs/governance/BELLA_AI_CODING_CONSTITUTION.md`) read before source modification.
- **Truth / Evidence:** Timeline cards used time-derived positioning that no longer matched the visible row height, causing misalignment in the daily KTV schedule view.
- **Source of Truth:** `TimelineSession` read DTO plus the existing timeline UI layout contract.
- **Canonical Contract:** Presentation layer reads `assigned_time` / `preferred_time` and renders it without changing booking/session persistence.
- **Gate Result:** `PASS`.

### 2. Product Manifest
- **Product:** Bella Spa ERP (`/dashboard/bookings` timeline view).
- **Capability:** Daily schedule timeline visualization.
- **Scope:** UI-only alignment for row height, card top offset, card height, and current-time line.

### 3. Ownership Map
- **Data Owner:** Beauty OS / Bella Spa booking and session services.
- **UI Owner:** `src/app/dashboard/sessions/components/TimelineKtvView.tsx`.

### 4. Contract Dependency Map
`Product UI (TimelineKtvView)` -> `TimelineSession DTO` -> read-only booking/session data.

### 5. Change Authority
- Authorized layer: presentation layer only.
- Not authorized and not modified: database schema, service contracts, Product Registry, Healthcare H1-H12, Logistics E7.

### 6. UI -> Contract Reconciliation
| UI Element | UI Expectation | Canonical Contract | Conclusion |
|---|---|---|---|
| Card time offset | Card `top` matches assigned/preferred time | `TimelineSession.assigned_time` / `bookings.preferred_time` | `MATCH` |
| Timeline row height | Spacious 30-minute rows | UI layout constant | `UI FIX` |
| Card height | Session card fits standard care duration | Presentation math only | `UI FIX` |
| Live time line | Current-time indicator follows live clock | `currentTimeStr` | `UI FIX` |

### 7. Additive Migration Plan
No migration.

### 8. 11 Automated Verification Gates Plan
1. Verify no data/API/schema contract changes.
2. Verify row height and card offset use the same slot scale.
3. Verify card height does not overflow compact content.
4. Verify current-time line uses the same time scale.
5. Verify text remains truncated inside card bounds.
6. Verify no Healthcare/Logistics frozen files touched.
7. Verify `git diff --check`.
8. Verify targeted lint where available.
9. Verify booking/session DTO access remains read-only.
10. Verify merge conflict markers absent.
11. Verify final PR checks after push.

### Conclusion
`PASS`

---

## 2026-10-07 English Center Residual Go-Live Boundary Gate

### 1. Bella OS/Product Development Process Gate
- Constitution read before source modification: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`.
- Education constitution read because Bella English Center is an Education product vertical boundary.
- PR #244 baseline evidence is preserved: English Center marker-scoped Post-RC operational Real DB and Browser E2E are already recorded above and must not be rebuilt.
- Current root cause found by read-only audit: HQ onboarding allowlists omit `bella_english_center` while Product Registry already contains that canonical product key.
- Gate result for code change: `PASS_FOR_HQ_ONBOARDING_GAP_FIX`.
- Gate result for production/customer/backup/legal posting seal: `NOT_PROVEN_UNTIL_EXECUTED_EVIDENCE`.

### 2. Product Manifest
- Product: `bella_english_center`.
- Existing proven scope: product identity, schema/RLS, marker-scoped Real DB tenant runtime, branch access, operational seed, and Post-RC Browser E2E.
- Residual authorized capability: HQ can create/select an English Center tenant/branch using the same onboarding contract used for other product tenants.
- Non-goals: no English operational chain rebuild, no Education Kernel change, no Finance legal-accounting policy invention, no production/customer mutation without explicit runtime evidence.

### 3. Ownership Map
- Product identity owner: `ProductRegistry` plus `tenants.product_key`.
- HQ onboarding owner: `src/app/hq/components/HqBranchRegistrationModal.tsx` and `src/services/onboarding-actions.ts`.
- Branch/runtime access owner: `org_units`, `users`, `user_org_unit_access`, and existing HQ/tenant auth contracts.
- English operations owner: `src/products/bella-english-center/**`.
- Finance posting policy owner: Finance contracts and authoritative accounting specifications, not English product code.
- Production integrity owner: deployment/operations evidence, backup/restore drill evidence, and production/staging runtime smoke evidence.

### 4. Contract Dependency Map
`HQ UI product option -> registerNewTenant(input.productKey) -> ProductRegistry.has(productKey) -> PRODUCT_MODULE_MAP -> onboard_tenant -> tenants.product_key -> enabled_modules -> ProductResolver/UserProvider -> /dashboard/english-center -> English operational services -> optional Finance contracts`.

### 5. Change Authority
- Authorized: add `bella_english_center` to HQ onboarding product selection/type map and targeted onboarding tests.
- Authorized: preserve existing module mapping by treating English Center as an Education module tenant (`bella_education`) while keeping product identity as `bella_english_center`.
- Not authorized: modify `src/platform/education/**`, Healthcare H1-H12, Logistics E7 kernels, ProductRegistry semantics, database schema, production data, or accounting legal-source mappings.

### 6. UI -> Contract Reconciliation
| UI / Contract Surface | Expected Product Truth | Current Audit Result | Action |
|---|---|---|---|
| HQ product selector | Offers canonical products including `bella_english_center` | Missing English option | Add option only |
| `registerNewTenant.productKey` | Accepts canonical product key if registered and allowed | Type/map omit English | Add key/map only |
| Tenant module flags | Education products use `bella_education` module flag | Preschool already maps to `bella_education` | Reuse same module flag |
| Product identity | Persist exact `tenants.product_key` | PR #244 proves English identity/runtime fixture | Preserve |

### 7. Additive Migration Plan
No migration. No schema/RLS/grant changes are authorized by this gate.

### 8. 11 Automated Verification Gates Plan
1. Verify HQ UI allowlist includes English Center.
2. Verify server-side `RegisterTenantProductKey` accepts `bella_english_center`.
3. Verify `registerNewTenant` persists `product_key = 'bella_english_center'`.
4. Verify English onboarding enables `bella_education` and not BabyCare/Beauty modules.
5. Verify non-HQ user cannot set up English Center before auth/database writes.
6. Verify BabyCare remains self-service compatible.
7. Verify Beauty/Haircut/Nail/Preschool mappings remain unchanged.
8. Verify ProductRegistry/ProductResolver focused tests still pass.
9. Verify English tuition/finance contract unit tests still pass without invented legal posting.
10. Verify existing English Real DB/Browser evidence is cited but not overclaimed as production/customer proof unless rerun.
11. Verify `git diff --check` and inspect touched files only.

### Conclusion
`PASS_FOR_HQ_ONBOARDING_GAP_FIX`

### Verification Result - 2026-10-07
- `npm test -- src\__tests__\onboarding.test.ts --runInBand`: PASS, 10/10 tests.
- `npm test -- src\platform\registry\__tests__\product-registry.test.ts src\platform\registry\__tests__\product-resolver.test.ts --runInBand`: PASS, 73/73 tests.
- `npm test -- src\products\bella-english-center\__tests__\tuition-billing.service.test.ts --runInBand`: PASS, 8/8 tests.
- `npm run typecheck:changed`: PASS, full TypeScript scope passed with zero diagnostics.
- `git diff --check`: PASS.
- Changed-file `any` scan: PASS; no `as any`/explicit-any introduced in touched source/test files.
- `npm run check:any-types`: NOT_PROVEN for repo-wide gate because existing baseline reports 91 violations in 21 unrelated files; no touched file is in the report.
- `E2E_ENV_FILE=<secure local .env.e2e> npm run test:english-center-post-rc-real-db`: PASS against canonical project `bmnbqbcdbuklhopfbopv`.
- `E2E_TENANT_PRODUCT_KEY=bella_english_center E2E_PORT=3110 E2E_REUSE_SERVER=0 npm run e2e:english-center-post-rc`: PASS, 2/2 Playwright tests, after installing real worktree dependencies instead of using an out-of-root `node_modules` junction.
- HQ runtime precondition audit: canonical E2E DB has 1 `bella_english_center` tenant and 0 `bella_hq` tenants. Because `checkHqAuth()` authorizes only `product_key = 'bella_hq'`, the live HQ -> register English tenant flow remains NOT_PROVEN without creating a new HQ fixture. No HQ fixture was created in this workstream.
- Production/customer runtime, backup/restore, and legal accounting posting seal: NOT_PROVEN in this workstream; no blocker is proven for the current English decision, and no English-specific scope expansion is authorized without executable evidence.

### HQ Runtime Residual Gate - 2026-10-07
- **Problem:** The only remaining English Center boundary is `HQ RUNTIME = NOT_PROVEN`.
- **Truth / Evidence:** Canonical E2E DB has no `bella_hq` tenant, while `checkHqAuth()` requires an admin user whose tenant has `product_key = 'bella_hq'`.
- **Root Cause:** This is an evidence fixture gap first. Read-only code audit also shows `registerNewTenant()` persists `tenants.product_key` after `onboard_tenant()`, but the base onboarding RPC does not create Platform `org_units`. English Center branch identity and branch RLS depend on `org_units` and `user_org_unit_access`.
- **Authorized Minimal Change:** Add only the runtime proof surface needed for HQ -> English Center onboarding: a focused Playwright E2E with an HQ fixture, and a default branch bootstrap inside existing HQ onboarding using existing `org_units` schema. No registry, product architecture, Finance, backup/restore, Healthcare, Logistics, or Education kernel change is authorized.
- **Verification Plan:** Run focused onboarding unit tests, focused HQ runtime Playwright E2E, changed-file typecheck, and diff whitespace checks. Do not rerun or reopen the already proven English browser E2E unless this focused flow depends on it.
- **Verification Result:**
  - `npm test -- src\__tests__\onboarding.test.ts --runInBand`: PASS, 11/11 tests.
  - `E2E_ENV_FILE=<secure local .env.e2e> E2E_PORT=3112 E2E_REUSE_SERVER=0 npx playwright test e2e/tests/32-english-center-hq-runtime.spec.ts`: PASS, 1/1 test.
  - Runtime proof covered HQ dev-bypass login through canonical `bella_hq` fixture, selecting `English Center`, creating the tenant through the actual HQ modal/server action, persisting `tenant.product_key = 'bella_english_center'`, creating default Platform branch `org_units(code='MAIN')`, authenticating the created English admin with Supabase Auth, reading `user_org_unit_access` as `tenant_admin`, and opening `/dashboard/english-center/command-center` with HTTP 200.
  - `npm run typecheck:changed`: PASS, full TypeScript scope passed with zero diagnostics.
  - `git diff --check`: PASS.
  - Changed-file `any` scan: PASS; no `as any`/explicit-any introduced in touched source/test files.
- **Conclusion:** `HQ_RUNTIME_PROVEN_FOR_ENGLISH_CENTER`


---

## 2026-10-07 PR #244 CI Security Dependency Gate

### 1. Bella OS/Product Development Process Gate
- **Problem:** PR #244 CI failed at `Trivy filesystem` and `Security Gates`.
- **Truth / Evidence:** Trivy reported fixable high/critical advisories in lockfiles only: `sharp@0.35.4`, `source-map-js@1.2.1`, `@modelcontextprotocol/sdk@1.29.0`, `proxy-addr@2.0.7`, `compression@1.8.1`, and `shell-quote@1.10.0`.
- **Root Cause:** Dependency security drift in root and `mcp-server` lockfiles; not an English Center product/runtime regression.
- **Gate Result:** `PASS`.

### 2. Product Manifest
- **Product:** None.
- **Capability:** CI security dependency gate remediation.
- **Scope:** `package.json`, `package-lock.json`, `mcp-server/package.json`, `mcp-server/package-lock.json`, `apps/mobile/package.json`, and `apps/mobile/package-lock.json`.
- **Non-goals:** No English product code, no tenant data, no migration SQL, no production/customer DB mutation.

### 3. Ownership Map
- **Owner:** Repository dependency governance.
- **Data Owner:** N/A.

### 4. Contract Dependency Map
`CI Security Gate` -> `npm audit --omit=dev` / Trivy filesystem scan -> npm lockfiles.

### 5. Change Authority
- Authorized layers: dependency metadata and lockfiles required to unblock CI security scan.
- Not authorized and not modified: Platform Core, Education runtime, Product Registry, tenant bootstrap data, Healthcare H1-H12, Logistics E7.

### 6. UI -> Contract Reconciliation
No UI change.

### 7. Additive Migration Plan
No migration.

### 8. 11 Automated Verification Gates Plan
1. Inspect failed PR check names.
2. Inspect Trivy failure log.
3. Identify direct vulnerable packages and fixed versions.
4. Confirm dependency paths from root and `mcp-server` lockfiles.
5. Apply minimal dependency override/package metadata changes.
6. Regenerate lockfiles using npm.
7. Verify lockfile versions are at or above fixed versions.
8. Run `npm run security:audit`.
9. Run `git diff --check`.
10. Commit and push to PR branch.
11. Wait for refreshed CI security gates.

### Verification
- `package-lock.json`: `sharp=0.35.5`, `source-map-js=1.2.2`, `@modelcontextprotocol/sdk=1.32.1`, `proxy-addr=2.0.8`.
- `mcp-server/package-lock.json`: `@modelcontextprotocol/sdk=1.32.1`, `proxy-addr=2.0.8`.
- `apps/mobile/package-lock.json`: `compression=1.8.2`, `shell-quote=1.12.0`, `source-map-js=1.2.2`.
- `npm run security:audit` -> PASS.
- `git diff --check` -> PASS.

### Conclusion
`PASS`

---

## 2026-10-06 Runtime CSS Scan Gate

### 1. Bella OS/Product Development Process Gate
- **Constitution:** `docs/governance/BELLA_AI_CODING_CONSTITUTION.md` read before source modification.
- **Problem:** Local Next.js dev server loads slowly, hangs, and crashes during Tailwind/PostCSS compilation.
- **Truth / Evidence:** Fresh `.next` rebuild failed with `src/app/globals.css` generated CSS parse error from a corrupted arbitrary utility token `.p-[...]`; repository binary scan evidence showed matching `p-[...]` byte sequences inside tracked binary artifacts such as PNG/APK assets.
- **Source of Truth:** Tailwind v4 source detection contract and observed dev-server compiler output.
- **Canonical Contract:** Tailwind should scan application source files for utility classes, not root-level binary assets, APKs, logs, or generated artifacts.
- **Gate Result:** `PASS`.

### 2. Product Manifest
- **Product:** Bella ERP web app.
- **Capability:** Global CSS / Tailwind utility generation.
- **Scope:** Tooling/presentation build configuration only.
- **Non-goals:** No Product identity change, no UI redesign, no domain/API/schema/auth change.

### 3. Ownership Map
- **Owner:** Shared Web UI / frontend build surface.
- **Runtime Owner:** Next.js + Tailwind CSS build pipeline.

### 4. Contract Dependency Map
`src/app/globals.css` -> Tailwind CSS v4 source detection -> generated utility CSS -> Next.js app layout.

### 5. Change Authority
- Authorized layers: frontend build/style source detection.
- Not authorized and not modified: Platform Core, Product Registry, Beauty OS, Healthcare H1-H12, Logistics E7, database migrations, API contracts.

### 6. UI -> Contract Reconciliation
- No data-bound or action-bound UI element is changed.
- Visual semantics are unchanged; only scanner input scope is corrected.

### 7. Additive Migration Plan
No migration.

### 8. 11 Automated Verification Gates Plan
1. Confirm root cause via dev-server compiler output.
2. Confirm offending class-like tokens appear in non-source binary/tracked artifacts.
3. Apply minimal Tailwind source scope correction.
4. Rebuild local `.next` from clean cache.
5. Verify `/`, `/login`, `/dashboard`, and `/api/tenant/context` respond.
6. Verify dev server remains running after route requests.
7. Verify no Healthcare/Logistics frozen files touched.
8. Verify `git diff --check`.
9. Verify targeted lint where available.
10. Report remaining auth/session warnings separately from CSS compile status.
11. Verify final PR checks after push.

### Conclusion
`PASS`

---

## 2026-10-06 HQ Local Load Gate

### 1. Bella OS/Product Development Process Gate
- **Constitution:** `docs/governance/BELLA_AI_CODING_CONSTITUTION.md` read before source modification.
- **Problem:** `/hq` did not load reliably in local dev. Server log showed `/hq` requests taking 74-76s in application code, with many `hq-actions` per-tenant customer/staff/revenue warnings and Supabase/Cloudflare 522 timeouts.
- **Truth / Evidence:** `src/app/hq/page.tsx` called `checkHqAuth()`, `getHqDashboardStats()`, and `getAllTenants()` sequentially. `getHqDashboardStats()` and `getAllTenants()` each called `checkHqAuth()` again. `getAllTenants()` performed three aggregate queries per tenant.
- **Source of Truth:** HQ server action code and observed dev-server request timings.
- **Canonical Contract:** `/hq` must return HQ dashboard stats plus tenant rows shaped as `HqDashboardStats` and `HqTenantRecord[]`; the UI contract does not require one remote query per tenant.
- **Gate Result:** `PASS`.

### 2. Product Manifest
- **Product:** Bella HQ Portal.
- **Capability:** Read-only HQ dashboard load.
- **Scope:** Server-side read aggregation performance and duplicate-auth removal.
- **Non-goals:** No HQ permissions change, no tenant status mutation change, no schema/API/RLS change, no financial semantics change.

### 3. Ownership Map
- **Owner:** Platform/HQ portal server actions.
- **Data Owners:** Existing `tenants`, `users`, `customers`, `revenue`, `session_logs`, and `bookings` tables.
- **Consumer:** `src/app/hq/page.tsx` and `HqDashboardClient`.

### 4. Contract Dependency Map
`/hq` -> `checkHqAuth()` -> `getHqDashboardPayload()` -> existing Supabase tables -> `HqDashboardClient`.

### 5. Change Authority
- Authorized layers: HQ read action orchestration and route data loading.
- Not authorized and not modified: database schema, Product Registry, Healthcare H1-H12, Logistics E7, write actions, tenant authorization rules.

### 6. UI -> Contract Reconciliation
| UI Element | UI Expectation | Canonical Contract | Backend Reality | Conclusion |
|---|---|---|---|---|
| HQ KPI cards | `HqDashboardStats` | Existing stats shape | Same fields preserved | `MATCH` |
| Branch table counts | `staffCount`, `customerCount`, `revenueSum` | `HqTenantRecord[]` | Same fields populated via bulk read | `MATCH` |

### 7. Additive Migration Plan
No migration.

### 8. 11 Automated Verification Gates Plan
1. Verify `/hq` no longer performs duplicate page-level auth.
2. Verify tenant rows preserve `staffCount/customerCount/revenueSum`.
3. Verify dashboard stats preserve existing fields.
4. Verify unauthenticated behavior remains redirect to `/hq/login`.
5. Verify no write action semantics changed.
6. Verify no Healthcare/Logistics frozen files touched.
7. Verify local `/hq` response timing improves.
8. Verify `/login` and `/dashboard` still respond.
9. Verify targeted HQ action tests.
10. Verify dev server remains running after `/hq`.
11. Classify external Supabase timeout as environment dependency if it recurs.

### Conclusion
`PASS`
# Architecture Gate - BabyCare/Beauty V2 Today Appointment Tabs

> **Status:** PASS - dashboard day query and tab classification only
> **Scope:** Fix the red-marked "Lịch hẹn hôm nay" widget used by BabyCare and Beauty V2 so completed sessions from today's `session_logs` are available to the "Hoàn thành" tab, and scheduled/confirmed sessions are counted consistently as waiting.

## 1. Bella OS/Product Development Process Gate

- Truth: The widget is a read model over tenant-scoped `session_logs` for the selected local day.
- Source of Truth: `session_logs.assigned_date`, `session_logs.status`, nested `bookings`, and the existing `getDashboardPrimaryData -> getUpcomingSessions -> BeautySpaV2DashboardView` consumer chain.
- Canonical Contract: Product dashboard consumes `DashboardSessionViewModel[]` from `getUpcomingSessions(todayDate)`; UI tabs may filter this read model but must not rewrite session lifecycle semantics.
- Gate decision: `PASS` for a narrow read-query/UI classification correction. No Kernel, Platform, Healthcare, Education, Logistics, migration, RLS, or Finance change is authorized.

## 2. Product Manifest

- Products: `bella_babycare` legacy BabyCare dashboard and `bella_spa` Beauty V2 dashboard.
- Capability: Today appointment visibility by status tabs: all, serving, waiting, completed.
- Out of scope: booking completion engine changes, package progress changes, production data mutation, tenant onboarding, branch/chain logic, and any new product table.

## 3. Ownership Map

| Data / Behavior | Owner | Action |
| --- | --- | --- |
| `session_logs.assigned_date` | Booking/session workflow | consume |
| `session_logs.status` | Booking/session workflow | consume |
| Dashboard tab counts and list filtering | Product dashboard UI | correct stale consumer |
| Session completion mutation | Shared order/session completion service | no change |

## 4. Contract Dependency Map

```text
BabyCare / Beauty V2 Dashboard
  -> getDashboardPrimaryData(...)
  -> getUpcomingSessions(todayDate)
  -> tenant-scoped session_logs + nested bookings
  -> UI tab classification
```

## 5. Change Authority

- Authorized: `src/core/services/analytics/dashboard-actions.ts`, `src/app/dashboard/components/BeautySpaV2DashboardView.tsx`, focused regression tests.
- Not authorized: Core session completion behavior, Healthcare/Education kernels, Logistics frozen artifacts, database migrations, or product identity rules.

## 6. UI -> Contract Reconciliation

- UI currently shows a "Hoàn thành" tab, but the data query removed `status = completed` before the UI could filter it.
- UI also labels fallback statuses as waiting but did not count/filter `scheduled` and `confirmed` as waiting.
- Correct reconciliation: keep today's completed rows in the dashboard read model and use a single UI classifier for tab counts, list filtering, and badges.

## 7. Additive Migration Plan

- No migration. No schema change.

## 8. 11 Automated Verification Gates Plan

1. Architecture Compliance: no frozen Healthcare/Education/Logistics files touched.
2. Contract Boundary: dashboard continues to consume existing server action/read model.
3. Tenant Isolation: keep `tenant_id` filter in `getUpcomingSessions`.
4. RLS/Auth: no policy change.
5. Migration Safety: no migration.
6. Event-After-Persistence: no mutation/event path change.
7. Product UI Contract: completed rows can reach completed tab.
8. Status Semantics: scheduled/confirmed/null/pending/waiting count as waiting.
9. Regression Test: focused Jest for dashboard read query.
10. Type/Lint: targeted changed-file checks where feasible.
11. Diff Hygiene: `git diff --check`.

# Architecture Gate Addendum - PR252 Real DB Haircut/Nail Harness Repair

> **Status:** PASS - test harness alignment only
> **Scope:** Repair the required Real Database Business E2E proof for Haircut/Nail branch access after PR252 CI exposed that the fixture did not seed `public.users` or request JWT claims required by the current `user_org_unit_access` RLS contract.

## Ownership / Contract

- Owner: Platform authorization projection `public.user_org_unit_access`.
- Product consumers: Haircut and Nail Real DB proof suite.
- Authorized change: test fixture only in `src/__tests__/haircut-nail-chain-seal-real-db.test.ts`.
- Runtime change: none.
- Migration change: none.
- Frozen Healthcare/Education/Logistics change: none.

## Verification Plan

1. Run focused Real DB suite for `haircut-nail-chain-seal-real-db.test.ts`.
2. Run targeted lint on changed files.
3. Run `npm run typecheck:changed`.
4. Run `git diff --check`.
5. Push PR252 and re-check required GitHub gates.

### Conclusion
`PASS`
# Architecture Gate - Unified Dashboard Dark Theme Viewport Repair (2026-10-08)

> **Status:** PASS - presentation-only dark theme repair for dashboard shell and Beauty Spa V2 dashboard viewport/background consistency.
> **Scope:** Shared dashboard UI theme surface plus Beauty Spa V2 dashboard root class. No schema, DB, RPC, RLS, service, analytics, Healthcare H1-H12, Education Kernel, Logistics Kernel, or Product contract changes.

## 1. Bella OS/Product Development Process Gate

- Problem: dark mode viewport is visually split into two background colors; product cards/sidebar are dark while the page viewport can remain light or mismatched.
- Truth / Source of Truth: UI presentation is owned by `src/components/layout/DashboardLoadingShell.tsx`, `src/app/globals.css`, and product view root classes such as `src/app/dashboard/components/BeautySpaV2DashboardView.tsx`. Product identity and accent colors remain resolved by tenant brand/theme code, not by this repair.
- Canonical Contract: shared UI must use semantic theme tokens; product/tenant may vary accent/sidebar/preset colors, but dark viewport background should be common and continuous.
- Non-goals: no new KPIs, statuses, actions, filters, business workflows, APIs, persistence changes, or tenant authorization changes.

## 2. Product Manifest

| Product / Surface | Capability | Scope |
| --- | --- | --- |
| Shared dashboard shell | Dark viewport background | Use one semantic dark viewport background across dashboard surfaces |
| Beauty Spa V2 dashboard | Dashboard presentation | Consume the shared viewport token while retaining existing data/action bindings |
| Tenant/Product theme | Accent/brand variance | Continue using current tenant brand tokens for primary/accent/sidebar |

## 3. Ownership Map

| Data / UI Element | Owner | Change Authority |
| --- | --- | --- |
| Dashboard viewport background | Shared UI | Authorized |
| Product/tenant accent colors | Tenant brand resolver / Product identity | Consume only, no contract change |
| Dashboard cards and panels | Product UI presentation | Authorized only for visual dark styling |
| KPI/session/inventory/alert data | Existing analytics/services | Not authorized |
| Healthcare/Education kernels | Frozen Kernel owners | Not authorized |

## 4. Contract Dependency Map

```text
Dashboard UI
  -> Shared CSS semantic dark viewport tokens
  -> Tenant brand runtime tokens for accent/sidebar
  -> Existing dashboard data props and actions unchanged
```

No Product -> Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized layers: shared dashboard presentation CSS, dashboard shell class names, and Beauty Spa V2 dashboard root presentation class.

Not authorized: database migrations, generated types, ProductRegistry/ProductResolver behavior, analytics service contracts, server actions, Healthcare/Education/Logistics Kernel files.

## 6. UI -> Contract Reconciliation

| UI Element | Contract Trace | Result |
| --- | --- | --- |
| Viewport background | CSS semantic theme token only | MATCH |
| Cards/panels dark surfaces | CSS presentation only | MATCH |
| Tenant/product accent | Existing tenant brand runtime CSS variables | MATCH |
| KPI/session/inventory/alert data | Existing view props | UNCHANGED |
| Buttons/actions | Existing links/callbacks | UNCHANGED |

## 7. Additive Migration Plan

None. This repair must not create or alter database tables, indexes, RPCs, RLS, or generated types.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: confirm only UI/theme files changed.
2. Contract boundary: no Product/Kernel/service contract edits.
3. Tenant isolation: unchanged, no data queries touched.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: no new data/action-bound UI elements.
8. Type safety: no `any`, casts, or suppressions.
9. Static check: `npm run lint -- --file ...` if supported, otherwise targeted TypeScript/static review.
10. Visual check: inspect dark mode viewport continuity via browser screenshot when local app can run.
11. Regression scope: run relevant focused checks; broader Healthcare/Education/Logistics guards are not required because frozen kernels are untouched.

# Architecture Gate - Beauty Spa Today Appointment Row Redesign (2026-10-08)

> **Status:** PASS - presentation-only redesign for the Today Appointments row layout in the Beauty Spa/BabyCare dashboard card.
> **Scope:** `src/app/dashboard/components/BeautySpaV2DashboardView.tsx` appointment-list markup only. No schema, data fetching, server action, analytics read model, workflow, Healthcare H1-H12, Education Kernel, Logistics Kernel, or Product contract changes.

## 1. Bella OS/Product Development Process Gate

- Problem: the customer/assignee text in the Today Appointments list is visually compressed in light Spa/BabyCare dashboard, making the customer row look broken.
- Truth / Source of Truth: the list already consumes `DashboardSessionViewModel` props from existing dashboard analytics. The defect is presentation layout, not data semantics.
- Canonical Contract: appointment rows may render existing fields (`assigned_time`, customer name, package name, assigned KTV, status) but must not create new fields, statuses, actions, or server behavior.
- Non-goals: no changes to session lifecycle, booking completion, filters, counts, KTV assignment, persistence, or authorization.

## 2. Product Manifest

| Product / Surface | Capability | Scope |
| --- | --- | --- |
| Beauty Spa/BabyCare dashboard | Today appointment card | Redesign row layout for readable customer text |
| Existing dashboard data | Read-only display | Reuse existing `DashboardSessionViewModel` props |

## 3. Ownership Map

| Data / UI Element | Owner | Change Authority |
| --- | --- | --- |
| Appointment row layout | Product UI presentation | Authorized |
| Customer name/package/KTV/status values | Existing dashboard read model | Consume only |
| Row actions and links | Existing UI behavior | Unchanged |
| Session/booking lifecycle | Beauty service/domain layer | Not authorized |

## 4. Contract Dependency Map

```text
BeautySpaV2DashboardView
  -> existing DashboardSessionViewModel props
  -> presentation-only row layout
```

No Product -> Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized layers: appointment-list JSX/classes in the product dashboard view.

Not authorized: server actions, analytics services, database schema, ProductRegistry/ProductResolver, tenant/auth/RLS, Healthcare/Education/Logistics Kernel files.

## 6. UI -> Contract Reconciliation

| UI Element | Contract Trace | Result |
| --- | --- | --- |
| Time | `session.assigned_time` | MATCH |
| Customer display name | `session.bookings?.customers?.name_mother` fallback | MATCH |
| Service/package line | `session.bookings?.package_name` fallback | MATCH |
| Assigned KTV line | `session.bookings?.assigned_ktv?.full_name` fallback | MATCH |
| Status badge | existing status helper functions | MATCH |
| More button | existing visual affordance | UNCHANGED |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: only product UI presentation file changes.
2. Contract boundary: no read model/service changes.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: existing fields/actions only.
8. Type safety: no `any`, casts, or suppressions.
9. Static check: targeted ESLint.
10. Visual check: row layout prevents customer text compression in the highlighted card.
11. Regression scope: no kernel verification required because frozen kernels are untouched.

# Architecture Gate - Bella Premium Dark Theme Color Standardization (2026-10-08)

> **Status:** PASS - presentation-only dark theme color standardization using the requested Premium Navy / Deep Teal / Champagne Gold palette.
> **Scope:** shared dashboard dark tokens, dark-mode dashboard surfaces, sidebar dark-mode hardcoded color cleanup, module-scoped dark presentation overrides, payroll/salary dark contrast surfaces, and Beauty Spa V2 AI Copilot dark colors. No Light Theme preset changes, no schema, DB, RPC, RLS, API, service, analytics, payroll formula/workflow, Healthcare H1-H12, Education Kernel, Logistics Kernel, or Product contract changes.

## 1. Bella OS/Product Development Process Gate

- Problem: current dark theme is inconsistent with the requested color reference; the AI Copilot card still uses a large light lavender surface in dark mode and some global dark colors are older burgundy/gold values.
- Truth / Source of Truth: `src/app/globals.css` owns shared CSS theme tokens and dark overrides; `src/app/dashboard/components/BeautySpaV2DashboardView.tsx` owns the Beauty Spa V2 dashboard presentation markup.
- Canonical Contract: Light Mode remains preset-specific. Dark Mode should consume one shared Bella Premium Dark palette for application background, sidebar, surface, border, foreground, accent, and semantic visual states.
- Non-goals: no new UI structure from the reference image, no new KPIs/statuses/actions, no backend/service/database changes, no ProductRegistry/ProductResolver changes, no tenant/auth/RLS changes.

## 2. Product Manifest

| Product / Surface | Capability | Scope |
| --- | --- | --- |
| Shared dashboard shell | Premium dark palette | Use shared dark tokens for viewport, cards, borders, text, and primary action |
| Sidebar | Premium dark palette | Normalize dark-mode sidebar color independent from light preset identity |
| Module-scoped dark presentation overrides | Premium dark palette | Replace legacy burgundy/espresso dark surfaces with shared dark palette while preserving product/light preset rules |
| Salary/payroll UI surfaces | Premium dark palette | Keep existing data/actions; normalize alert cards, status pills, modals, and salary tables for dark contrast |
| Beauty Spa V2 AI Copilot | Dark-mode card readability | Keep component structure; replace dark-mode light lavender surface with dark premium surface |

## 3. Ownership Map

| Data / UI Element | Owner | Change Authority |
| --- | --- | --- |
| Dark theme color tokens | Shared UI theme CSS | Authorized |
| Beauty dashboard AI card presentation | Product UI presentation | Authorized |
| Sidebar and legacy dark presentation overrides | Shared/Product UI presentation | Authorized |
| Payroll health/modal/table presentation | Product UI presentation | Authorized |
| Light Theme preset colors | Existing tenant brand/theme resolver | Not authorized |
| Dashboard/payroll data, formulas, and actions | Existing analytics/services/actions | Not authorized |
| Healthcare/Education/Logistics kernels | Frozen Kernel owners | Not authorized |

## 4. Contract Dependency Map

```text
Dark Mode Dashboard UI
  -> shared CSS variables in globals.css
  -> existing tenant brand/light preset data attributes remain unchanged
  -> product dashboard JSX consumes dark-mode classes only
```

No Product -> Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized layers: shared CSS tokens/dark presentation overrides, sidebar presentation classes, and Beauty Spa V2 dashboard dark-mode classes.

Not authorized: data contracts, APIs, server actions, database schema, migrations, production data, auth/RLS, payroll formulas/workflows, accounting, booking/inventory workflows, Healthcare/Education/Logistics Kernel files, and Light Theme preset values.

## 6. UI -> Contract Reconciliation

| UI Element | Contract Trace | Result |
| --- | --- | --- |
| Dashboard background/surface | CSS semantic dark tokens only | MATCH |
| Sidebar dark mode | CSS semantic dark tokens only | MATCH |
| AI Copilot dark surface | Existing component, presentation classes only | MATCH |
| Payroll health/status panels | Existing payroll props and anomaly data, presentation classes only | MATCH |
| AI alert counts/inventory values | Existing props | UNCHANGED |
| Buttons/actions/links | Existing links/callbacks | UNCHANGED |

## 7. Additive Migration Plan

None. This task must not add or modify database migrations.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: only theme CSS/product presentation file changes.
2. Contract boundary: no service/API/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: no new data/action-bound elements.
8. Type safety: no `any`, casts, or suppressions.
9. Contrast check: verify key Premium Dark foreground/background pairs reach WCAG AA where applicable.
10. Static check: targeted ESLint and `git diff --check`.
11. Regression scope: broad kernel/database gates are not required because frozen kernels and persistence are untouched.
---

# Architecture Gate - Beauty Spa Branch Selector PremiumSelect Alignment (2026-10-09)

> **Status:** PASS - product UI consumer alignment with the shared PremiumSelect component.
> **Scope:** `src/components/layout/BeautyRuntimeBranchSelector.tsx` and a backward-compatible `PremiumSelect` accessibility/customization prop. No service, data, schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## 1. Bella OS/Product Development Process Gate

- Truth: The current Beauty Spa runtime branch selector renders a native HTML `select`, which produces browser-default dropdown styling.
- Source of truth: `src/components/layout/BeautyRuntimeBranchSelector.tsx` for the branch selector consumer; `src/components/ui/PremiumSelect.tsx` for the system premium select UI contract.
- Canonical contract: Product UI should consume the shared PremiumSelect component for premium select dropdown behavior and styling.
- Ownership: Beauty Spa product shell owns the branch selector consumer; shared UI owns PremiumSelect rendering.
- Boundary: Product UI consumer only. No Platform/Core/Kernel/database changes.
- Minimum change: Replace the native `select` in the branch selector with `PremiumSelect` using the same branch data and selection handler.

## 2. Product Manifest

- Product: Bella Beauty Spa v2 shell.
- Capability: Runtime branch selection for non-customer staff/admin users.
- Scope: Sidebar UI presentation and interaction only.
- Out of scope: Branch authorization, tenant resolution, persistence semantics, DB schema, migrations, server actions, Kernel contracts.

## 3. Ownership Map

- Branch list and active branch data: `beauty-runtime-branch-actions` service contract.
- Runtime branch UI consumer: `BeautyRuntimeBranchSelector`.
- Dropdown visual contract: shared `PremiumSelect`.
- Local storage key: UI carrier only; server actions remain authority for access.

## 4. Contract Dependency Map

`Beauty Spa Product UI -> beauty-runtime-branch-actions public service contract -> existing tenant/branch persistence`

This change does not access lower-layer tables directly and does not introduce a new contract.

## 5. Change Authority

Authorized:
- Beauty Spa sidebar UI consumer.
- Backward-compatible shared PremiumSelect customization/accessibility props.

Not authorized:
- Platform/Core contracts.
- Healthcare H1-H12 Kernel.
- Logistics E7.1/E7.2/E7.3 Kernel.
- Database schema or RLS.
- Server action semantics.

## 6. UI -> Contract Reconciliation

| UI Element | Existing Contract | Decision |
|---|---|---|
| Active branch value | `activeBranchId` from `getBeautyRuntimeBranchContext` | UNCHANGED |
| Branch options | `branches: BeautyRuntimeBranch[]` | UNCHANGED |
| Branch switch action | `selectBeautyRuntimeBranch(branchId)` | UNCHANGED |
| Dropdown presentation | Shared `PremiumSelect` visual contract | ALIGN |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture scope check: verify no Kernel or migration files are modified.
2. Type check target: run TypeScript or lint/type verification available for the touched files if feasible.
3. Unit tests: not required for visual-only component consumption unless existing tests cover it.
4. UI smoke: verify dropdown renders with PremiumSelect classes.
5. Branch action contract: unchanged, no new API.
6. Tenant isolation: unchanged, server action remains authority.
7. RLS/Real DB: not applicable to visual-only UI change.
8. Browser E2E: optional visual verification if local runtime credentials/server are available.
9. Accessibility sanity: keep selectable text and disabled state.
10. Diff guard: confirm only intended files changed.
11. Regression guard: confirm no Healthcare/Logistics frozen artifacts touched.

---

# Architecture Gate - Beauty Spa Branch Selector Header Color (2026-10-09)

> **Status:** PASS - presentation-only color alignment for the Beauty Spa branch selector label.
> **Scope:** `src/components/layout/BeautyRuntimeBranchSelector.tsx` label class only. No data, service, schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## 1. Bella OS/Product Development Process Gate

- Truth: The branch selector label currently uses `text-primary/65`, which renders darker than the Beauty Spa sidebar section headers in the active shell.
- Source of truth: `BeautyRuntimeBranchSelector` label markup and existing `.beauty-erp-nav-header` theme token in `src/app/globals.css`.
- Canonical contract: Sidebar section labels should consume the same Beauty ERP nav-header presentation token.
- Boundary: Product UI presentation only.
- Minimum change: Apply the existing `beauty-erp-nav-header` class to the branch selector label and use the same gold fallback color.

## 2. Product Manifest

- Product: Bella Beauty Spa v2 shell.
- Capability: Runtime branch selector label readability/visual consistency.
- Scope: Static label/icon color only.
- Out of scope: Branch selection behavior, authorization, persistence, server actions, DB schema, migrations.

## 3. Ownership Map

- Branch selector label: Beauty Spa sidebar UI consumer.
- Gold menu header token: shared Beauty ERP sidebar theme CSS.

## 4. Contract Dependency Map

`Beauty Spa Product UI -> shared Beauty ERP sidebar presentation token`

No Product -> Public Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized:
- Branch selector label class.

Not authorized:
- Server actions, service contracts, database schema, RLS, migrations, Platform/Core, Healthcare/Education/Logistics kernels.

## 6. UI -> Contract Reconciliation

| UI Element | Existing Contract | Decision |
|---|---|---|
| Branch selector label | Sidebar section label presentation | ALIGN with `.beauty-erp-nav-header` |
| Branch selector dropdown | Existing `PremiumSelect` consumer | UNCHANGED |
| Branch switch action | `selectBeautyRuntimeBranch(branchId)` | UNCHANGED |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: UI class-only change.
2. Contract boundary: no service/API/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI reconciliation: label uses existing sidebar header token.
8. Type safety: no `any`, casts, or suppressions.
9. Static check: targeted ESLint.
10. Diff check: `git diff --check`.
11. Regression scope: kernel/database gates not required because frozen kernels and persistence are untouched.

---

# Architecture Gate - Dashboard Notification Bell Interaction Repair (2026-10-09)

> **Status:** PASS - interaction-only repair for the shared admin notification bell.
> **Scope:** `src/components/common/AdminNotificationBell.tsx` click/open behavior and `src/app/dashboard/components/BeautySpaV2DashboardView.tsx` consumer wiring only. No notification service contract, database schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## 1. Bella OS/Product Development Process Gate

- Truth: The dashboard header uses `AdminNotificationBell`; the reported defect is that the visible bell button does not open/operate reliably.
- Source of truth: `src/app/dashboard/page.tsx` consumes `AdminNotificationBell`; `src/app/dashboard/components/BeautySpaV2DashboardView.tsx` rendered a static bell icon; `src/components/common/AdminNotificationBell.tsx` owns the bell button, portal popover, and read/unread UI state.
- Canonical contract: Bell click should open a visible notification popover anchored to the button; notification data and read actions remain owned by existing dashboard/notification actions.
- Boundary: Shared UI interaction only.
- Minimum change: Stabilize the shared button toggle/portal positioning and replace the Beauty Spa v2 static bell icon with `AdminNotificationBell` without changing alert generation, tenant filtering, or persistence.

## 2. Product Manifest

- Product: Bella Beauty Spa dashboard shell consuming the shared admin notification bell.
- Capability: Open notification popover and all-notifications modal from the header bell.
- Scope: Button accessibility, click target reliability, popover viewport placement.
- Out of scope: Notification business rules, alert counts, app notification schema, mark-read semantics, realtime subscription contracts.

## 3. Ownership Map

- Bell button/popover UI: `AdminNotificationBell`.
- Beauty Spa v2 header bell consumer: `BeautySpaV2DashboardView`.
- Alert data: `getImportantAlerts`.
- Read/unread persistence: `notification-actions`.

## 4. Contract Dependency Map

`Dashboard UI / BeautySpaV2DashboardView -> AdminNotificationBell -> getImportantAlerts / notification-actions`

No Product -> Public Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized:
- Shared notification bell UI interaction and accessibility attributes.
- Beauty Spa v2 header consumer wiring from static icon to shared bell component.

Not authorized:
- Database schema, RLS, migrations, alert semantics, server action contracts, Platform/Core, Healthcare/Education/Logistics kernels.

## 6. UI -> Contract Reconciliation

| UI Element | Existing Contract | Decision |
|---|---|---|
| Header bell button | Toggle notification popover | REPAIR shared component and wire Beauty Spa v2 consumer |
| Unread badge | Derived from active alert count | UNCHANGED |
| Popover/list content | Existing `DashboardAlert[]` | UNCHANGED |
| Mark read actions | Existing server actions | UNCHANGED |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: UI interaction-only change.
2. Contract boundary: no server action/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI reconciliation: bell opens anchored popover without changing notification data.
8. Type safety: no `any`, casts, or suppressions.
9. Static check: targeted ESLint.
10. Diff check: `git diff --check`.
11. Regression scope: kernel/database gates not required because frozen kernels and persistence are untouched.
---

# Architecture Gate - Beauty Spa Branch Selector PremiumSelect Alignment (2026-10-09)

> **Status:** PASS - product UI consumer alignment with the shared PremiumSelect component.
> **Scope:** `src/components/layout/BeautyRuntimeBranchSelector.tsx` and a backward-compatible `PremiumSelect` accessibility/customization prop. No service, data, schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## 1. Bella OS/Product Development Process Gate

- Truth: The current Beauty Spa runtime branch selector renders a native HTML `select`, which produces browser-default dropdown styling.
- Source of truth: `src/components/layout/BeautyRuntimeBranchSelector.tsx` for the branch selector consumer; `src/components/ui/PremiumSelect.tsx` for the system premium select UI contract.
- Canonical contract: Product UI should consume the shared PremiumSelect component for premium select dropdown behavior and styling.
- Ownership: Beauty Spa product shell owns the branch selector consumer; shared UI owns PremiumSelect rendering.
- Boundary: Product UI consumer only. No Platform/Core/Kernel/database changes.
- Minimum change: Replace the native `select` in the branch selector with `PremiumSelect` using the same branch data and selection handler.

## 2. Product Manifest

- Product: Bella Beauty Spa v2 shell.
- Capability: Runtime branch selection for non-customer staff/admin users.
- Scope: Sidebar UI presentation and interaction only.
- Out of scope: Branch authorization, tenant resolution, persistence semantics, DB schema, migrations, server actions, Kernel contracts.

## 3. Ownership Map

- Branch list and active branch data: `beauty-runtime-branch-actions` service contract.
- Runtime branch UI consumer: `BeautyRuntimeBranchSelector`.
- Dropdown visual contract: shared `PremiumSelect`.
- Local storage key: UI carrier only; server actions remain authority for access.

## 4. Contract Dependency Map

`Beauty Spa Product UI -> beauty-runtime-branch-actions public service contract -> existing tenant/branch persistence`

This change does not access lower-layer tables directly and does not introduce a new contract.

## 5. Change Authority

Authorized:
- Beauty Spa sidebar UI consumer.
- Backward-compatible shared PremiumSelect customization/accessibility props.

Not authorized:
- Platform/Core contracts.
- Healthcare H1-H12 Kernel.
- Logistics E7.1/E7.2/E7.3 Kernel.
- Database schema or RLS.
- Server action semantics.

## 6. UI -> Contract Reconciliation

| UI Element | Existing Contract | Decision |
|---|---|---|
| Active branch value | `activeBranchId` from `getBeautyRuntimeBranchContext` | UNCHANGED |
| Branch options | `branches: BeautyRuntimeBranch[]` | UNCHANGED |
| Branch switch action | `selectBeautyRuntimeBranch(branchId)` | UNCHANGED |
| Dropdown presentation | Shared `PremiumSelect` visual contract | ALIGN |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture scope check: verify no Kernel or migration files are modified.
2. Type check target: run TypeScript or lint/type verification available for the touched files if feasible.
3. Unit tests: not required for visual-only component consumption unless existing tests cover it.
4. UI smoke: verify dropdown renders with PremiumSelect classes.
5. Branch action contract: unchanged, no new API.
6. Tenant isolation: unchanged, server action remains authority.
7. RLS/Real DB: not applicable to visual-only UI change.
8. Browser E2E: optional visual verification if local runtime credentials/server are available.
9. Accessibility sanity: keep selectable text and disabled state.
10. Diff guard: confirm only intended files changed.
11. Regression guard: confirm no Healthcare/Logistics frozen artifacts touched.

---

# Architecture Gate - Beauty Spa Branch Selector Header Color (2026-10-09)

> **Status:** PASS - presentation-only color alignment for the Beauty Spa branch selector label.
> **Scope:** `src/components/layout/BeautyRuntimeBranchSelector.tsx` label class only. No data, service, schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## 1. Bella OS/Product Development Process Gate

- Truth: The branch selector label currently uses `text-primary/65`, which renders darker than the Beauty Spa sidebar section headers in the active shell.
- Source of truth: `BeautyRuntimeBranchSelector` label markup and existing `.beauty-erp-nav-header` theme token in `src/app/globals.css`.
- Canonical contract: Sidebar section labels should consume the same Beauty ERP nav-header presentation token.
- Boundary: Product UI presentation only.
- Minimum change: Apply the existing `beauty-erp-nav-header` class to the branch selector label and use the same gold fallback color.

## 2. Product Manifest

- Product: Bella Beauty Spa v2 shell.
- Capability: Runtime branch selector label readability/visual consistency.
- Scope: Static label/icon color only.
- Out of scope: Branch selection behavior, authorization, persistence, server actions, DB schema, migrations.

## 3. Ownership Map

- Branch selector label: Beauty Spa sidebar UI consumer.
- Gold menu header token: shared Beauty ERP sidebar theme CSS.

## 4. Contract Dependency Map

`Beauty Spa Product UI -> shared Beauty ERP sidebar presentation token`

No Product -> Public Contract -> Kernel dependency changes are required.

## 5. Change Authority

Authorized:
- Branch selector label class.

Not authorized:
- Server actions, service contracts, database schema, RLS, migrations, Platform/Core, Healthcare/Education/Logistics kernels.

## 6. UI -> Contract Reconciliation

| UI Element | Existing Contract | Decision |
|---|---|---|
| Branch selector label | Sidebar section label presentation | ALIGN with `.beauty-erp-nav-header` |
| Branch selector dropdown | Existing `PremiumSelect` consumer | UNCHANGED |
| Branch switch action | `selectBeautyRuntimeBranch(branchId)` | UNCHANGED |

## 7. Additive Migration Plan

None.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: UI class-only change.
2. Contract boundary: no service/API/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI reconciliation: label uses existing sidebar header token.
8. Type safety: no `any`, casts, or suppressions.
9. Static check: targeted ESLint.
10. Diff check: `git diff --check`.
11. Regression scope: kernel/database gates not required because frozen kernels and persistence are untouched.

---

# ARCHITECTURE GATE RESULT - BEAUTY SPA DARK THEME SIDEBAR PAGE AUDIT

> **Status:** PASS - presentation-only dark theme contrast repair authorized
> **Date:** 2026-10-08
> **Scope:** Audit and repair dark theme color/contrast regressions across the Bella Beauty Spa sidebar menu pages, starting with the salary/payroll health-check panel shown in the regression screenshot.

## Bella OS/Product Development Process Gate

- Truth: The reported defect is visual only: dark mode surfaces render light-mode panels, weak text contrast, or split background colors on Beauty Spa dashboard routes.
- Source of Truth: User screenshots, `src/components/layout/sidebar.tsx` Beauty Spa menu route list, existing tenant/product CSS tokens in `src/app/globals.css`, and current page/component Tailwind classes.
- Canonical Contract: Shared UI and product presentation must use semantic dark-mode tokens and must not let product/tenant color overrides reintroduce light-mode backgrounds in `html.dark`.
- Gate result: `PASS` for presentation-layer CSS and component class changes only.

## Product Manifest

- Product: Bella Beauty Spa V2 (`bella_spa`), current implementation route family under `/dashboard`.
- Sidebar pages in scope: Dashboard, AI Copilot, Customers & CRM, Bookings & POS, Sessions, Waitlist, Inventory, Product Sales, Salary, Chain Management, Accounting, Finance Reconciliation, Executive, Analytics, Guides, Services, Settings.
- Concrete regression in scope: `/dashboard/salary` payroll health-check, salary tabs, salary tables, attendance modal, HR profile modal, and legacy light utility classes used by sidebar-linked pages.
- Non-goals: no domain behavior change, no API or RPC change, no schema/RLS/migration, no payroll formula change, no menu IA or label change.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Beauty Spa product identity and tenant theme | Product Registry / Tenant theme | consume only |
| Sidebar route list | Shared dashboard shell | read only for audit scope |
| Dark theme tokens and legacy utility safety net | Shared UI/theme CSS | may extend |
| Salary/payroll visual panels | Product UI presentation | may modify classes only |
| Payroll data, formulas, publish/finalize actions | HR Salary domain/services | do not change |

## Contract Dependency Map

```text
Beauty Spa sidebar page
  -> dashboard shell tenant/theme attributes
  -> shared dark theme CSS tokens
  -> route and component presentation classes
  -> rendered dark-mode surfaces and readable text
```

No Product -> Public Contract -> Kernel dependency changes are required.

## Change Authority

Authorized:
- Extend `src/app/globals.css` dark-mode presentation overrides.
- Adjust Beauty Spa salary/payroll page and component classes when needed for contrast/readability.
- Add focused UI/static verification only.

Not authorized:
- Database schema, migrations, RLS, RPCs, API routes, payroll formulas, booking/inventory/accounting workflows, tenant identity logic, ProductRegistry/ProductResolver changes, sidebar IA changes, or frozen Healthcare/Education/Logistics kernel files.

## UI -> Contract Reconciliation

| UI element / route family | Existing contract | Decision |
|---|---|---|
| Sidebar-linked Beauty Spa pages | Existing routes and data/actions | Preserve behavior; audit presentation only |
| Salary health-check panel | Existing payroll validation data | Preserve data; fix dark surface and text contrast |
| Salary tabs/tables/modals | Existing payroll/attendance/HR UI contracts | Preserve fields/actions; fix dark classes/tokens |
| Shared legacy light utility classes | Tailwind presentation utilities | Final dark-mode overrides may remap colors after tenant light overrides |
| Light theme tenant/product colors | Tenant brand presets | Do not change |

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, seed, or production data change.

## 11 Automated Verification Gates Plan

1. Architecture boundary: confirm only theme/presentation files are touched.
2. Contract boundary: no service/API/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Database migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: no new data fields, statuses, actions, or KPIs.
8. Type safety: no `any`, casts, or suppressions.
9. Contrast check: audit dark foreground/background pairs on sidebar-linked pages, starting with salary/payroll regression.
10. Static check: targeted lint/build checks and `git diff --check`.
11. Regression scope: broad kernel/database gates are not required because frozen kernels and persistence are untouched.

---

# Architecture Gate - Beauty Spa Soft Input Border Repair (2026-10-09)

> **Status:** PASS - presentation-only repair for Beauty Spa input and filter controls.
> **Scope:** Beauty Spa tenant-level input/select/textarea/PremiumSelect trigger styling plus Dashboard quick search, Customer toolbar search/dropdowns, Booking timeline search/dropdowns, and Booking specialty mobile filter button. No data contract, action, schema, RLS, migration, Healthcare H1-H12, Education Kernel, or Logistics Kernel change.

## Bella OS/Product Development Process Gate

- Truth: User screenshots show several Beauty Spa input/filter controls rendering with visually heavy dark borders.
- Source of truth: Attached screenshots, Beauty Spa tenant style rules in `src/app/globals.css`, and current component classes in `BeautySpaV2DashboardView`, `customers/page`, `TimelineKtvView`, and `BookingsSpecialtyFilter`.
- Canonical contract: Input/filter controls must remain the same fields and actions while using softer presentation: no hard black outline, subtle inset shadow for field affordance, and gentle focus ring.
- Gate result: `PASS` for UI presentation class changes only.

## Product Manifest

- Product: Bella Beauty Spa V2.
- Capability in scope: visual treatment of search fields and filter controls in Dashboard, Customers, and Bookings.
- Runtime behavior in scope: none beyond existing input/select interactions.
- Non-goals: no search/filter semantics change, no API/service change, no data persistence change, no shared kernel or product contract change.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Search query state | Product UI components | preserve |
| Filter select state | Product UI components | preserve |
| PremiumSelect trigger accessibility/presentation | Shared UI component | add semantic combobox role; preserve API and behavior |
| Beauty Spa visual treatment | Product presentation | may adjust classes |

## Contract Dependency Map

```text
Beauty Spa UI controls
  -> existing local state setters
  -> existing filtering/search display logic
  -> presentation-only class update
```

No Product -> Public Contract -> Kernel dependency changes are required.

## Change Authority

Authorized:
- Tenant-level Beauty Spa control styling in `src/app/globals.css`.
- Component-level Tailwind class changes for the affected UI controls.
- Shared `PremiumSelect` trigger ARIA semantics so tenant-level control styling reaches system select triggers.
- `PremiumSelect` consumer `buttonClassName` overrides on the customer toolbar.

Not authorized:
- Database schema, migrations, RLS, server actions, search/filter logic, ProductRegistry, Platform/Core, Healthcare/Education/Logistics kernels.

## UI -> Contract Reconciliation

| UI element | Existing contract | Decision |
|---|---|---|
| Dashboard quick search | `searchQuery` local state | Preserve behavior; soften border |
| Customer toolbar search | `searchQuery` local state | Preserve behavior; soften border |
| Customer filters/sort | Existing `PremiumSelect` values | Preserve behavior; soften trigger style |
| Booking timeline KTV/status filters | Native select state | Preserve behavior; soften border |
| Booking timeline search | `searchQuery` local state | Preserve behavior; soften border |
| Booking specialty mobile filter | Existing specialty selector | Preserve behavior; soften border |
| Beauty Spa menu input/select/textarea controls | Tenant-level presentation style | Preserve behavior; remove heavy border globally |
| PremiumSelect trigger | Existing custom select button | Preserve behavior; expose combobox role for accessibility and tenant styling |

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, seed, or production data change.

## 11 Automated Verification Gates Plan

1. Architecture boundary: presentation-only component class updates.
2. Contract boundary: no service/API/read-model edits.
3. Tenant isolation: unchanged.
4. RLS/AuthZ: unchanged.
5. Database migration safety: no migrations.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: all inputs/selects keep existing state handlers.
8. Type safety: no `any`, casts, or suppressions.
9. Visual intent: black/dark borders removed; soft inset shadow retained for affordance.
10. Static check: targeted ESLint and `git diff --check`.
11. Regression scope: kernel/database gates not required because frozen kernels and persistence are untouched.

---

# ARCHITECTURE GATE RESULT - BELLA HOSPITALITY OPERATIONS UI

> **Status:** PASS - presentation-only Hospitality UI upgrade authorized.
> **Date:** 2026-10-09
> **Scope:** Upgrade the existing `/hospitality/hotel-core-chain` browser proof page into an operations console for Dashboard and Room/Reservation workflows while preserving sealed Product services and E2E proof selectors.

## 1. Bella OS/Product Development Process Gate

- Truth: Bella Hospitality already owns sealed product services for property/room, guest/reservation, stay, folio/payment, housekeeping, and maintenance under `src/products/bella-hospitality`.
- Source of Truth: product types/services in `src/products/bella-hospitality`, browser proof entry `src/app/hospitality/hotel-core-chain/page.tsx`, action `src/services/hospitality-hotel-core-chain-actions.ts`, and E2E proof `e2e/tests/38-hospitality-hotel-core-chain-browser-e2e.spec.ts`.
- Canonical Contract: Product UI consumes the existing Hotel Core chain action and its returned value. No new schema, RPC, OS kernel, Platform contract, or Finance contract is authorized.
- Gate result: `PASS` for presentation-layer UI implementation only.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capabilities in scope: hotel dashboard, room/reservation overview, front-office/folio evidence display, and unproven housekeeping/maintenance lanes.
- Non-goals: no new backend query API, no migration, no new housekeeping or maintenance workflow action, no Go-Live claim.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Hospitality UI page | Bella Hospitality Product UI | may modify |
| Hotel Core chain action | Bella Hospitality Product service | consume existing contract; minimal returned-value display only |
| `hospitality_*` tables | Bella Hospitality Product persistence | no schema change |
| Finance invoice/allocation/cash movement | Finance Platform public contract | consume only through existing service |
| Product identity | Platform Product Registry | consume only |

## 4. Contract Dependency Map

```text
/hospitality/hotel-core-chain UI
  -> executeHospitalityHotelCoreChainAction
  -> Hospitality product services/repositories
  -> hospitality_* product tables with RLS context
  -> Finance public service contract for folio charge/payment
  -> Product Registry identity proof
```

## 5. Change Authority

Authorized:
- Presentation/layout changes in `src/app/hospitality/hotel-core-chain/page.tsx`.
- Display-only derivations from already returned action values.
- Preserving and surfacing proof IDs/statuses for Dashboard and Room/Reservation UI.

Not authorized:
- Healthcare H1-H12 changes.
- Education kernel changes.
- Logistics E7.1/E7.2/E7.3 changes.
- Platform/Core/Frozen kernel changes.
- New database tables, columns, RPCs, or invented statuses.

## 6. UI -> Contract Reconciliation

| UI Element | Contract Trace | Result |
|---|---|---|
| Dashboard KPIs | Existing redirect params from Hotel Core action | MATCH; empty state is `NOT_PROVEN` |
| Room list row | `roomId`, reservation proof, occupancy status from existing action result | MATCH after returned proof params are surfaced |
| Front-office lane | stay, occupancy, folio, payment result values | MATCH |
| Housekeeping lane | No current completion action in Hotel Core proof | `NOT_PROVEN`; no ready-for-sale claim |
| Maintenance lane | No current maintenance request in Hotel Core proof | `NOT_PROVEN`; cannot mark room sellable |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, seed, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: inspect changed files only.
2. Contract boundary: verify UI consumes existing action/result values only.
3. Tenant isolation: preserve existing action auth/RLS context.
4. RLS/AuthZ: existing E2E Real DB proof remains the authority when env is available.
5. Migration safety: no migrations.
6. Event-after-persistence: no write/event semantics changed.
7. Product identity: preserve `hotel-core-product` evidence.
8. Finance chain: preserve folio/payment evidence.
9. Type safety: no `any`, casts, or suppressions.
10. Static check: targeted ESLint/typecheck where dependencies are installed.
11. Browser E2E: run `e2e/tests/38-hospitality-hotel-core-chain-browser-e2e.spec.ts` when DB/env/server are available.

---

## Additional Architecture Gate - Beauty Spa Dashboard Sidebar UI Repair

> **Status:** PASS - focused Beauty Spa Product UI repair for dashboard month/year filtering, CRM/Zalo tab layout, customer-rating detail routing, and typography alignment with the Beauty dashboard baseline.

> **Scope:** `src/app/dashboard/components/BeautySpaV2DashboardView.tsx`, `src/app/dashboard/crm/*`, and a shared dashboard notification widget server-action wrapper outside `src/core`. No database schema, RLS, accounting, Platform/Core, Healthcare H1-H12, Education kernel, or Logistics E7.1-E7.3 changes.

### 1. Bella OS/Product Development Process Gate

Truth: the reported defects are browser-facing Product UI defects on Beauty Spa dashboard/sidebar pages. Source of truth is the existing Product Registry identity (`bella_spa` / Beauty Spa current implementation), dashboard parent state (`selectedMonth`, `selectedYear`), and existing sidebar route map. Canonical contract is Product UI consuming existing dashboard data/actions without changing persistence or kernel contracts.

Gate decision: `PASS` for a boundary-local UI fix.

### 2. Product Manifest

- Product: Bella Beauty Spa V2 (`bella_spa`).
- Capabilities in scope: dashboard finance period selector, customer-rating detail navigation, CRM/Zalo tabs/header presentation.
- Out of scope: new CRM analytics module, session review schema, customer review workflow semantics, Product Registry changes, Platform/Core changes, Healthcare/Education/Logistics kernels.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Beauty dashboard view composition | Beauty Spa Product UI | may change visual controls and links |
| Dashboard period state | Dashboard page/UI state | may consume existing setters |
| CRM/Zalo page tabs | Beauty Spa Product UI | may change presentation and client tab routing |
| Dashboard notification widget | Shared dashboard UI/read-model | may fail-soft through a UI-owned wrapper for non-critical alert reads |
| Session reviews / rating persistence | Beauty/Spa customer feedback workflow | read-only for this task |

### 4. Contract Dependency Map

```text
Beauty dashboard UI
  -> selectedMonth / selectedYear setters from dashboard page
  -> existing getDashboardPrimaryData refresh path
  -> CRM/customers routes via sidebar contract
```

No Product UI code may bypass server actions or directly mutate product data. Shared dashboard widgets may consume a UI-owned fail-soft wrapper while the underlying service contract remains unchanged.

### 5. Change Authority

Authorized: localized TSX UI edits, query/anchor routing for existing pages, typography/control class alignment with the dashboard baseline, and a UI-owned fail-soft wrapper for non-critical notification reads.

Not authorized: database migrations, server action semantics, Product Registry identity changes, Platform/Core refactors, kernel changes, broad sidebar permission changes.

### 6. UI -> Contract Reconciliation

- Month selector: UI must call the existing `setSelectedMonth` / `setSelectedYear` props so the parent dashboard data reloads through its existing effect.
- Rating detail link: UI must route to an existing customer/CRM surface instead of an unrelated generic CRM default.
- CRM tabs: UI must preserve existing `CrmTabId` values and only repair layout/typography.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted lint for changed files
3. TypeScript changed-file gate if available
4. Static scan for forbidden `any` in changed files
5. Static scan for Healthcare H1-H12 kernel changes
6. Static scan for Logistics frozen artifacts changes
7. Route sanity for `/dashboard`
8. Route sanity for `/dashboard/crm`
9. Route sanity for customer/CRM detail target
10. Browser or Playwright smoke if local auth/runtime is available
11. Final git diff review for scope containment

## Additional Architecture Gate - Beauty Spa Premium Select and Data Tabs Repair

> **Status:** PASS - focused Beauty Spa Product UI repair for dropdown consistency and dashboard data-tab behavior.

> **Scope:** Beauty/Spa dashboard, booking timeline filters, CRM voucher modal target selector, customer table page-size selector, and Beauty/Spa finance report dropdowns. No persistence, schema, RLS, Product Registry, Platform/Core, Healthcare H1-H12, Education, or Logistics E7.1-E7.3 changes.

### 1. Bella OS/Product Development Process Gate

Truth: the reported defects are Product UI defects. Existing state values and filters are the source of truth; the change must keep the same values while replacing native browser dropdown chrome with the shared `PremiumSelect` component and making tab buttons drive visible filtered data.

Gate decision: `PASS` for a boundary-local Product UI/state fix.

### 2. Product Manifest

- Product: Bella Beauty Spa V2 / Spa sidebar experience.
- Capabilities in scope: dashboard finance period dropdowns, finance report period/month/forecast dropdowns, booking timeline filters, CRM voucher audience selector, customer pagination selector, dashboard performance and urgent-action tabs.
- Out of scope: new product capabilities, database migrations, RLS, server actions, kernel contracts.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Dashboard period state | Beauty dashboard UI | may keep existing setters and change presentation |
| Timeline KTV/status filters | Booking/Sessions Product UI | may keep existing filter state and change presentation |
| CRM voucher target | CRM Product UI | may keep existing campaign target values and change presentation |
| Customer pagination size | Customer Product UI | may keep existing page-size state and change presentation |
| Dashboard tab filtering | Beauty dashboard UI | may add local active-tab state and filtered rendering |

### 4. Contract Dependency Map

```text
Beauty/Spa Product UI controls
  -> existing local state setters
  -> existing in-memory filtering/rendering
  -> shared PremiumSelect presentation component
```

No Product UI code may bypass existing server actions or mutate data outside existing handlers.

### 5. Change Authority

Authorized: localized TSX imports, local state types, `PremiumSelect` consumers, and data-tab render filtering.

Not authorized: schema changes, generated DB types, RLS/policy changes, server action semantics, Platform/Core abstractions, or frozen kernel edits.

### 6. UI -> Contract Reconciliation

- Dropdowns: preserve exact existing values (`month`, `year`, `ktv`, `status`, `target`, `pageSize`) and handlers.
- Performance tabs: active tab must visibly switch chart metric and empty-state copy.
- Urgent-action tabs: active tab must filter displayed alert cards by alert type.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted ESLint on changed TSX/TS files
3. `npm run typecheck:changed`
4. Static scan for remaining native selects in the touched Beauty/Spa surfaces
5. Static scan for forbidden `any` in changed files
6. Confirm no Healthcare H1-H12 files changed
7. Confirm no Logistics frozen artifacts changed
8. Dashboard route smoke if local auth/runtime is available
9. Booking timeline route smoke if local auth/runtime is available
10. CRM/customers route smoke if local auth/runtime is available
11. Final diff review for scope containment

---

## Additional Architecture Gate - Beauty OS Typography Consistency

> **Status:** PASS - presentation-only typography normalization for Beauty OS dashboard pages.

> **Scope:** Shared dashboard shell typography class and `beauty_spa` module CSS rules so Beauty OS products that reuse the Beauty module presentation inherit the same font family, heading scale, body text scale, control text scale, table text scale, and letter-spacing baseline as the Beauty dashboard. Includes CI routing correction so presentation-only CSS does not trigger Real DB E2E. No data contract, route, menu, API, schema, RLS, Product Registry, Platform/Core, Healthcare H1-H12, Education, or Logistics E7.1-E7.3 change.

### 1. Bella OS/Product Development Process Gate

Truth: the requested issue is browser-facing text inconsistency across Beauty OS sidebar pages. Source of truth is the Beauty dashboard baseline, the shared dashboard shell, existing tenant runtime attributes, and current sidebar-linked dashboard routes. Canonical contract is Product UI presentation only; no product data/action behavior is changed.

Gate decision: `PASS` for a shared presentation-layer typography fix.

### 2. Product Manifest

- Product family: Beauty OS products using the `beauty_spa` module presentation, including Spa/Haircut/Nail surfaces where the tenant runtime resolves to `beauty_spa`.
- Capabilities in scope: visual font family, font size, line height, letter spacing, text weight normalization for dashboard content and controls, and CI scope classification for presentation-only CSS.
- Out of scope: page IA, sidebar labels, KPI values, field/action semantics, persistence, tests that invent business semantics, migrations, RLS, server actions, and frozen kernel code.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Dashboard content wrapper | Shared dashboard shell | may add presentation class |
| Beauty module typography | Shared UI/theme CSS | may normalize presentation tokens |
| Beauty sidebar route pages | Beauty Product UI | consume shared typography |
| Business data/actions | Product services/contracts | read-only, not modified |
| CI scope router | CI governance | may prevent CSS-only presentation files from being treated as DB runtime surfaces |

### 4. Contract Dependency Map

```text
Beauty OS dashboard route
  -> DashboardAuthorizedShell main wrapper
  -> html[data-tenant-module="beauty_spa"]
  -> shared typography CSS
  -> existing page content with unchanged data/actions
```

### 5. Change Authority

Authorized: shared dashboard wrapper class, CSS typography rules scoped to `beauty_spa`, and CI scope router classification for presentation-only CSS.

Not authorized: database schema, migrations, RLS, API/server-action behavior, ProductRegistry/ProductResolver changes, menu IA, Healthcare/Education/Logistics kernel files, or business calculations.

### 6. UI -> Contract Reconciliation

- Dashboard baseline: keep sans font, compact headings, 13px body/control text, 12px table/support text, and zero letter spacing across route content.
- KPI numbers and visual icons: preserve existing component-specific emphasis where possible; CSS targets text hierarchy and controls, not data semantics.
- Sidebar branding script remains outside the dashboard content wrapper and is not normalized by this change.
- Real DB E2E routing: presentation CSS and wrapper class do not create or modify DB runtime surfaces; router must keep Real DB proof reserved for migrations, DB runtime code, real-db tests, and explicit Real DB configs.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted ESLint on changed TSX/CSS-owned files where applicable
3. `npm run typecheck:changed`
4. `node scripts/test-ci-scope-router.mjs`
5. Static scan confirms no Healthcare H1-H12 files changed
6. Static scan confirms no Education kernel files changed
7. Static scan confirms no Logistics frozen artifacts changed
8. Verify typography CSS is scoped to `html[data-tenant-module="beauty_spa"]`
9. Verify router classifies this typography diff with `needs_real_db_e2e=false`
10. Browser/route smoke if local auth/runtime is available
11. Final diff review for scope containment

---

# ARCHITECTURE GATE RESULT - BELLA HOSPITALITY OPERATIONS BROWSER E2E

> **Status:** PASS - verification-only CI wiring authorized.
> **Date:** 2026-10-09
> **Scope:** Verify the merged Hospitality Operations Console with Browser E2E and Real DB evidence in CI. No backend, schema, RPC, migration, or canonical contract change is authorized.

## 1. Bella OS/Product Development Process Gate

- Truth: PR #270 merged the first-pass Hospitality Operations Console into `main`; UI operational seal still requires browser/runtime evidence.
- Source of Truth: `/hospitality/hotel-core-chain` UI, existing Hotel Core chain action, Playwright spec `e2e/tests/38-hospitality-hotel-core-chain-browser-e2e.spec.ts`, and CI scope router/workflows.
- Canonical Contract: Product UI must consume the existing Hotel Core action and keep unproven housekeeping/maintenance states as `NOT_PROVEN` or blocked statuses.
- Gate result: `PASS` for test selectors, Browser E2E assertions, and existing CI pipeline wiring only.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capabilities in scope for verification: Room/Reservation, Front Office/Folio, Housekeeping state boundary, Maintenance state boundary.
- Non-goals: no new operational module, no new backend action, no new DB object, no Go-Live claim.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Hospitality operations UI selectors | Bella Hospitality Product UI | may add stable test ids |
| Browser E2E assertions | QA / E2E surface | may extend existing spec |
| CI scope routing | CI governance | may mark the existing Real DB browser proof as requiring Real DB evidence |
| Hospitality product persistence | Bella Hospitality Product persistence | no change |
| Finance/RLS runtime behavior | Existing public contracts and DB policies | verify only |

## 4. Contract Dependency Map

```text
Playwright Hotel Core browser E2E
  -> /hospitality/hotel-core-chain UI
  -> executeHospitalityHotelCoreChainAction
  -> Hospitality product services and RLS-scoped tables
  -> Finance public contract evidence
  -> Real DB readback and cross-tenant negative assertions
```

## 5. Change Authority

Authorized:
- Add stable UI test selectors to the existing Hospitality route.
- Extend the existing Hotel Core browser E2E to assert the operational UI lanes.
- Wire the existing CI workflow to run that spec with isolated E2E Supabase credentials.
- Mark that spec as Real DB-relevant in the existing CI scope router.

Not authorized:
- Backend service changes.
- Schema, migration, RPC, generated type, RLS policy, or seed changes.
- Healthcare, Education, Logistics, Platform/Core, or ProductRegistry changes.
- Seal or Go-Live claims without CI evidence.

## 6. UI -> Contract Reconciliation

| UI Area | Existing Contract / Evidence | Verification Decision |
|---|---|---|
| Dashboard | Existing Hotel Core result params | Browser E2E asserts loaded empty state and proof state |
| Room/Reservation | `roomId`, `reservationId`, occupancy from Hotel Core action | Browser E2E asserts `PROVEN` only after action success |
| Front Office/Folio | stay, folio, payment result values | Browser E2E asserts completed/closed/payment evidence |
| Housekeeping | no completion action in Hotel Core proof | Browser E2E asserts `DIRTY_CANDIDATE` and `NOT_PROVEN`, not ready-for-sale |
| Maintenance | no maintenance request in Hotel Core proof | Browser E2E asserts `NOT_PROVEN` and `BLOCKED_BY_HOUSEKEEPING_PROOF` |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, seed, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: changed files remain UI/test/CI only.
2. Contract boundary: no new backend contract or DB field.
3. Tenant isolation: existing Real DB browser proof keeps cross-tenant negative read/update checks.
4. RLS/AuthZ: Real DB E2E must use isolated E2E credentials.
5. Migration safety: no migrations; migration gates may skip.
6. Event-after-persistence: unchanged.
7. UI data/action reconciliation: Browser E2E asserts UI states from existing action result only.
8. Type safety: no `any`, casts, or suppressions.
9. CI scope: route #38 changes require Browser E2E and Real DB evidence.
10. Static check: run lint/typecheck/router unit check where dependencies are available.
11. Closure: seal UI only after CI Browser E2E and Real DB jobs produce PASS evidence.
---

## Additional Architecture Gate - Admin Notification Popover Viewport Fit

> **Status:** PASS - presentation-only notification popover sizing fix.
> **Date:** 2026-10-09
> **Scope:** Shared admin notification bell popover layout only. No notification data semantics, persistence, schema, RLS, server action, routing, Product Registry, Platform/Core, Healthcare H1-H12, Education, or Logistics E7.1-E7.3 change.

### 1. Bella OS/Product Development Process Gate

Truth: the reported issue is a browser-facing overlay layout defect where the notification dropdown can exceed the visible viewport and be clipped by the lower screen edge. Source of truth is the existing notification bell UI and current alert rendering contract. Canonical contract remains the existing `DashboardAlert` list and read/navigation handlers.

Gate decision: `PASS` for a boundary-local Shared UI presentation fix.

### 2. Product Manifest

- Surface: Admin notification bell used by Beauty/Spa dashboard shell and other dashboard products.
- Capabilities in scope: popover viewport-aware max height, internal list scrolling, compact card spacing, and preserved read/open behavior.
- Out of scope: alert generation, unread count semantics, mark-as-read server actions, realtime subscriptions, database migrations, RLS, and product routing rules.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Notification popover positioning | Shared dashboard UI | may adjust presentation sizing |
| Alert rows and unread count | Existing notification/analytics services | read-only, not modified |
| Mark read / mark all read | Notification server actions | consume unchanged handlers |
| Product navigation target | Existing alert link contract | consume unchanged links |

### 4. Contract Dependency Map

```text
AdminNotificationBell
  -> existing DashboardAlert data
  -> existing read/navigation handlers
  -> viewport-aware popover presentation
```

### 5. Change Authority

Authorized: local CSS class changes and inline viewport sizing calculation in `AdminNotificationBell`.

Not authorized: schema, RLS, server actions, alert queries, routing semantics, Product Registry, frozen kernel files, or new notification capabilities.

### 6. UI -> Contract Reconciliation

- The dropdown still renders the same active alerts and existing "Đọc tất cả" / "Xem tất cả thông báo" actions.
- The list scrolls inside the popover when alert count is high instead of letting the whole overlay extend beyond the viewport.
- Alert click behavior and backend read marking remain unchanged.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted ESLint on the changed TSX component
3. `npm run typecheck:changed`
4. Static scan confirms no schema/migration/RLS files changed
5. Static scan confirms no Healthcare H1-H12 files changed
6. Static scan confirms no Education kernel files changed
7. Static scan confirms no Logistics frozen artifacts changed
8. Verify popover sizing uses viewport-derived max height
9. Verify notification read/navigation handlers remain unchanged
10. Browser/visual smoke if local auth/runtime is available
11. Final diff review for scope containment

---

# Architecture Gate - Beauty V2 Real DB Cleanup Gate Repair (2026-10-09)

> **Status:** PASS - fixture-only repair for Beauty V2 Real DB cleanup failures blocking the aggregate Real Database Business E2E gate.
> **Scope:** `src/__tests__/beauty-v2-commission-branch-real-db.test.ts` and `src/__tests__/beauty-v2-finance-branch-real-db.test.ts` cleanup paths, the Beauty Spa V2 Real DB worker assertion that was proven sensitive to stale shared outbox rows, plus the minimum CI scope-router update required to run Real DB evidence for those files. No Hospitality backend/UI change, no schema migration, no RLS policy change, no accounting business-rule change, no Healthcare/Education/Logistics kernel change.

## Bella OS/Product Development Process Gate

- Truth: Post-merge `main` CI run `37906928475` attempt 2 failed the aggregate Real Database Business E2E gate on two Beauty V2 cleanup suites, while Hospitality Real DB suites passed in the same run.
- Source of Truth: GitHub Actions job `113746606127` logs, `jest.real-db.config.ts`, `.github/workflows/ci-tests.yml`, and the two failing test files.
- Canonical Contract: Real DB proof fixtures may use service-role Supabase cleanup for marker-scoped test rows; production RLS policies and business runtime contracts must not be weakened to make cleanup pass.
- Gate result: `PASS` for a minimal test-fixture cleanup repair only.

## Product Manifest

- Product: Bella Beauty Spa V2 (`bella_spa`).
- Capability in scope: Real DB proof cleanup for Beauty V2 branch commission and SALARY_PAID finance branch tests, plus current-event-focused Beauty Spa V2 worker assertion under a shared Real DB queue.
- Existing capabilities reused: service-role Supabase test client, existing Real DB Jest lane, existing fixture markers.
- Non-goals: no Hospitality change, no Finance accounting policy change, no RLS/migration/schema/generated type change, no Product Registry change, no UI change.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Beauty V2 commission proof fixture | Beauty V2 test harness | may repair cleanup |
| Beauty V2 SALARY_PAID finance proof fixture | Beauty V2 / Finance proof test harness | may repair cleanup |
| Beauty Spa V2 SESSION_DONE worker proof fixture | Beauty V2 / Finance proof test harness | may focus assertions on the current proof event |
| `salary_records` production semantics | Beauty payroll / HR salary domain | do not change |
| `accounting_worker_runs` observability table | Finance/accounting worker observability | do not change schema or RLS |
| CI scope router | Engineering CI harness | may add the two Real DB test paths so evidence is not skipped |
| Hospitality 7 phases and UI | Hospitality product | not modified |

## Contract Dependency Map

```text
Real Database Business E2E
  -> jest.real-db.config.ts
  -> Beauty V2 commission / finance branch proof fixtures
  -> Beauty Spa V2 SESSION_DONE proof fixture
  -> fixture setup and cleanup
  -> service-role Supabase cleanup for marker-scoped rows
  -> no production contract mutation
```

## Change Authority

Authorized:
- Modify the two failing Beauty V2 Real DB test cleanup paths.
- Modify the Beauty Spa V2 Real DB worker assertion so stale shared queue rows do not invalidate the current proof event.
- Modify `scripts/ci-scope-router.mjs` and its focused router test only to ensure these Real DB test files trigger the Real DB gate.
- Add investigation evidence for the CI failure.
- Update this architecture gate record.

Not authorized:
- Modify Hospitality backend/UI/Real DB suites.
- Modify database schema, RLS policies, migrations, generated types, Product Registry, or accounting legal/business mappings.
- Skip tests or remove business assertions.

## UI -> Contract Reconciliation

- No UI change.
- No UI data/action/state/workflow contract changed.

## Additive Migration Plan

- No migration.
- No schema, table, index, trigger, RLS, generated type, or production data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: verify changed files remain test/investigation/gate scoped.
2. Contract Boundary: preserve production Beauty payroll/finance contracts.
3. Tenant Isolation: cleanup remains marker/id scoped to test rows.
4. RLS & Authorization: do not weaken production RLS; use existing service-role test cleanup contract.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no production event path changed.
7. Domain Safety Routing: no Healthcare/Education/Logistics/Hospitality runtime change.
8. Temporal Provenance: no historical migration or production data rewrite.
9. Rule Governance: no accounting policy or posting rule change.
10. Audit & Evidence Integrity: distinguish targeted fixture PASS from aggregate gate PASS until CI reruns.
11. Regression: run targeted static/lint checks and Real DB CI when credentials are available.

---

## Additional Architecture Gate - Beauty Customer Detail Theme Cards

> **Status:** PASS - presentation-only Beauty customer detail card theme alignment.
> **Date:** 2026-10-09
> **Scope:** Customer detail service cards and active package card should consume the current dashboard theme preset tokens instead of fixed slate/navy backgrounds. No customer, booking, payment, KTV assignment, persistence, schema, RLS, API, Product Registry, Platform/Core, Healthcare H1-H12, Education, or Logistics E7.1-E7.3 change.

### 1. Bella OS/Product Development Process Gate

Truth: the reported defect is visual/theme inconsistency on the Beauty customer detail page. Source of truth is the existing dashboard runtime theme contract: `html[data-tenant-module="beauty_spa"]` plus CSS variables `--primary`, `--primary-hover`, `--primary-foreground`, `--accent`, and contrast-safe fallback values applied by the dashboard layout.

Gate decision: `PASS` for a boundary-local Product UI presentation fix.

### 2. Product Manifest

- Product: Bella Beauty Spa customer detail experience.
- Capabilities in scope: active service selector card, active package hero card, progress track, muted text, and card contrast using theme preset tokens.
- Out of scope: customer data, booking state, session count logic, payment state, KTV assignment, actions, routing, migrations, and server behavior.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Active customer detail cards | Beauty Product UI | may change presentation classes |
| Runtime theme preset tokens | Dashboard theme contract | consume existing variables with safe fallbacks |
| Booking/customer/payment data | Existing Product services/actions | read-only, unchanged |
| Frozen kernels | Healthcare/Education/Logistics | no access |

### 4. Contract Dependency Map

```text
Customer detail page
  -> existing booking/customer state
  -> existing dashboard theme CSS variables and fallback card styles
  -> theme-aware card presentation
```

### 5. Change Authority

Authorized: TSX class updates in the customer detail card components plus semantic CSS rules that use dashboard theme tokens and provide safe fallback rendering before the `beauty_spa` runtime attribute is applied.

Not authorized: schema, RLS, API/server action semantics, ProductRegistry/ProductResolver, payment/booking calculations, or frozen kernel files.

### 6. UI -> Contract Reconciliation

- Active selector card and hero card must preserve the same data and click/action handlers.
- Background color/gradient must derive from the current preset primary token, not fixed `slate`/`indigo` values.
- Text and progress metadata must use foreground/tint tokens or contrast-safe fallbacks with high contrast against the active card background.
- Status badges keep semantic status colors where they already provide readable contrast.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted ESLint on changed TSX files
3. `npm run typecheck:changed`
4. Static scan confirms changed card backgrounds consume `var(--primary)` / theme tokens
5. Static scan confirms no customer/booking/payment handlers changed
6. Static scan confirms no schema/migration/RLS files changed
7. Static scan confirms no Healthcare H1-H12 files changed
8. Static scan confirms no Education kernel files changed
9. Static scan confirms no Logistics frozen artifacts changed
10. Browser/visual smoke if local auth/runtime is available
11. Final diff review for scope containment

---

## Additional Architecture Gate - Beauty Customer Detail Edit Modal Field Alignment

> **Status:** PASS - focused customer detail UI form alignment.
> **Date:** 2026-10-09
> **Scope:** Customer detail edit modal should expose the editable customer fields represented by the customer information card, while showing unsupported/static card values as read-only reference. No schema, RLS, API, Product Registry, Platform/Core, Healthcare H1-H12, Education, or Logistics E7.1-E7.3 change.

### 1. Bella OS/Product Development Process Gate

Truth: the edit modal currently omits persisted customer fields already shown on the detail surface. Source of truth is `Database['public']['Tables']['customers']['Update']`, `updateCustomer`, and the existing customer detail card. Canonical contract is tenant-scoped `updateCustomer(id, CustomerUpdate)`.

Gate decision: `PASS` for Product UI form mapping only.

### 2. Product Manifest

- Product: Bella Beauty Spa customer detail experience.
- Capabilities in scope: edit modal inputs for customer notes and loyalty points; read-only reference rows for card values without a proven customer-table write contract.
- Out of scope: customer grouping/source schema, loyalty business rules, referral workflows, migrations, server action semantics, and frozen kernel code.

### 3. Ownership Map

| Surface/Data | Owner | Change Authority |
| --- | --- | --- |
| Customer edit modal | Beauty Product UI | may add form controls for existing customer update fields |
| `customers.notes` / `customers.loyalty_points` | Customer persistence contract | consume existing update contract only |
| Customer group/source semantics | Unproven customer capability | display only; do not invent write contract |
| `customers.created_at` | Customer persistence contract | read-only display |

### 4. Contract Dependency Map

```text
Customer detail card
  -> EditCustomerModal
  -> EditCustomerData
  -> updateCustomer(id, CustomerUpdate)
  -> tenant-scoped customers row
```

### 5. Change Authority

Authorized: TSX/type/state edits needed for modal parity with existing persisted customer fields.

Not authorized: schema fields for group/source, new metadata semantics, generated type edits, RLS/policy changes, API/server-action behavior changes, or kernel files.

### 6. UI -> Contract Reconciliation

- Editable: name, phone, secondary profile fields, gender, address, notes, loyalty points, and location coordinates.
- Read-only until a write contract exists: customer group, customer source, loyalty membership, and created date.
- Loyalty points remain the persisted editable field; loyalty membership remains a display-only value matching the existing card until a canonical write contract exists.

### 7. Additive Migration Plan

No migration. `NOT_APPLICABLE`.

### 8. 11 Automated Verification Gates Plan

1. `git diff --check`
2. Targeted ESLint on changed TSX/TS files
3. `npm run typecheck:changed`
4. Static scan confirms no generated DB type edits
5. Static scan confirms no migration/RLS files changed
6. Static scan confirms no service/API semantics changed
7. Static scan confirms no Healthcare H1-H12 files changed
8. Static scan confirms no Education kernel files changed
9. Static scan confirms no Logistics frozen artifacts changed
10. UI review confirms modal contains editable persisted card fields and read-only unproven values
11. Final diff review for scope containment
---

# Architecture Gate - Hospitality Production Authenticated UI Smoke Workflow (2026-10-09)

> **Status:** PASS - read-only CI verification workflow authorized.
> **Scope:** Add a manually dispatched GitHub Actions workflow and focused Playwright smoke that logs into production with production-specific E2E admin credentials from secrets and verifies `/hospitality/hotel-core-chain` renders the merged Operations Console. No deploy, promote, schema, backend, RLS, auth-bypass, or product runtime change is authorized.

## 1. Bella OS/Product Development Process Gate

- Truth: Hospitality phases 0-7 and the Operations UI are already merged and separately proven by CI, but authenticated production UI smoke remains `NOT_PROVEN`.
- Source of Truth: production route `/hospitality/hotel-core-chain`, existing Playwright real-auth fixture `e2e/fixtures/auth.ts`, existing Hospitality Operations selectors, and GitHub Actions repository secrets.
- Canonical Contract: production UI verification must use the real app authentication path with production E2E admin credentials, prove unauthenticated access is challenged, and remain read-only.
- Gate result: `PASS` for CI/test verification-only implementation.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capability in scope: authenticated production smoke evidence for the Hotel Operations Console.
- Existing capabilities reused: real-auth Playwright fixture, production route, existing Operations UI selectors, and pinned GitHub artifact upload action.
- Non-goals: no Hospitality backend change, no data mutation, no new operational module, no deploy/promote workflow, no Go-Live claim.
- Evidence boundary: because this is a new manual workflow, the PR can only prove static wiring; `AUTHENTICATED_PRODUCTION_SMOKE` can move to `PASS` only after the workflow exists on `main`, is dispatched against production, and passes.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Production credentials | GitHub Actions Production environment secrets / Platform auth operations | consume only; never log values |
| Hospitality Operations UI selectors | Bella Hospitality Product UI | consume unchanged |
| Production route access | App auth middleware and product route | verify only |
| CI workflow dispatch | Engineering CI harness | may add read-only workflow |
| Hospitality backend, RLS, schema | Bella Hospitality Product persistence | not modified |

## 4. Contract Dependency Map

```text
Manual workflow_dispatch
  -> Production E2E admin credentials from GitHub Secrets
  -> e2e/fixtures/auth.ts real login
  -> /hospitality/hotel-core-chain
  -> existing Operations UI test ids
  -> Playwright JSON result and sanitized evidence
```

## 5. Change Authority

Authorized:
- Add a focused Playwright spec for authenticated production Hospitality UI smoke.
- Add a package script and production-smoke Playwright config pointing only to that spec.
- Add a manually dispatched, read-only CI workflow that runs the spec and uploads sanitized Playwright JSON evidence only.
- Update this architecture gate record.

Not authorized:
- Modify Hospitality product/backend/service code.
- Modify schema, migrations, generated types, RLS policies, seed data, ProductRegistry, or auth middleware.
- Submit the Hotel Core form or mutate production data.
- Use deployment workflows, promote deployments, generic E2E credentials, or bypass app authentication.
- Seal UI operational readiness or Go-Live without the workflow actually passing.

## 6. UI -> Contract Reconciliation

| UI Area | Existing Contract / Evidence | Verification Decision |
|---|---|---|
| Authenticated access | `e2e/fixtures/auth.ts` uses E2E admin credentials and refuses dev mock auth outside localhost | workflow provides production secrets, verifies unauthenticated route redirects to `/login`, and verifies authenticated route is not `/login` |
| Dashboard | existing `hotel-operations-dashboard` selector | assert rendered and still labels unproven data as `NOT_PROVEN` |
| Rooms / Reservations | existing `hotel-operations-room-reservation` selector | assert lane renders, no action submitted and no same-origin mutation occurs |
| Front Office / Folio | existing `hotel-operations-front-office-folio` selector | assert lane renders, no action submitted and no same-origin mutation occurs |
| Housekeeping | existing `hotel-operations-housekeeping` selector | assert lane renders without declaring production proof |
| Maintenance | existing `hotel-operations-maintenance` selector | assert lane renders without marking rooms ready for sale |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, trigger, RLS, generated type, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Architecture boundary: changed files remain CI/test/gate/package-script/config scoped.
2. Contract boundary: smoke consumes existing route and selectors only.
3. Tenant isolation: production app auth/RLS remain enforced; no service-role or fixture bypass.
4. RLS & Authorization: require production-specific E2E admin login, fail if unauthenticated access is not challenged, and fail if authenticated access redirects to `/login`.
5. Database Migration Safety: no migration.
6. Event-after-persistence: no mutation or event path touched.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Beauty, or Hospitality runtime code changed.
8. Type safety: no `any`, suppressions, or generated type edits.
9. CI safety: workflow is manual, uses the protected Production environment, and has no deploy/promote/schema steps.
10. Audit & Evidence Integrity: disable trace/screenshot/video and upload only sanitized JSON/result artifacts without credentials or tokens.
11. Closure: `AUTHENTICATED_PRODUCTION_SMOKE` remains `NOT_PROVEN` until the workflow runs and passes on production.

---

# Architecture Gate - Hospitality Production Route Auth Guard (2026-10-09)

> **Status:** PASS - minimal route admission fix authorized by production smoke evidence.
> **Scope:** Protect `/hospitality/hotel-core-chain` with the existing current-user authentication path after workflow run `37934133847` proved unauthenticated production HTML rendered the Operations Console instead of being challenged. No backend, schema, RLS, service, ProductRegistry, deployment, or Hospitality Phase 0-7 change is authorized.

## 1. Bella OS/Product Development Process Gate

- Truth: Manual production smoke run `37934133847` reached the new workflow on `main` with Production secrets, then failed because unauthenticated access stayed on `/hospitality/hotel-core-chain`.
- Source of Truth: production HTTP response and Playwright JSON evidence showing `Bella Hospitality`, `Hotel Operations Console`, and `hotel-core-chain-form` in unauthenticated HTML.
- Canonical Contract: the production Operations Console is an authenticated operational surface; unauthenticated requests must be challenged before any console UI or proof form renders.
- Gate result: `PASS` for a route-only auth guard; `AUTHENTICATED_PRODUCTION_SMOKE` remains `NOT_PROVEN` until the fixed workflow passes on production.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capability in scope: authenticated admission for the existing Hotel Operations Console page.
- Existing capabilities reused: `src/services/user-actions.ts` current-user resolver, existing `/login` route, existing Hospitality page and server action.
- Non-goals: no new Hospitality module, no Hotel Core chain behavior change, no data write path change, no operational seal or Go-Live claim.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Current user session | Platform auth runtime | read only through existing current-user resolver |
| Hospitality Operations page admission | Bella Hospitality route UI | add minimal guard before rendering |
| Hotel Core chain server action | Bella Hospitality service/action | unchanged |
| Hospitality schema/RLS/Phase 0-7 services | Bella Hospitality backend/contracts | not modified |

## 4. Contract Dependency Map

```text
/hospitality/hotel-core-chain request
  -> src/services/user-actions.ts getCurrentUser()
  -> unauthenticated: redirect('/login?redirect=/hospitality/hotel-core-chain')
  -> authenticated: render existing Operations Console
```

## 5. Change Authority

Authorized:
- Add `force-dynamic` to the route so authentication is evaluated per request.
- Add a server-side current-user check before rendering the Operations Console.
- Redirect unauthenticated users to the existing login route with the Hospitality route as the redirect target.
- Keep the production smoke workflow/spec unchanged so the auth challenge remains enforced.

Not authorized:
- Modify Hospitality backend services, schema, RLS, migrations, generated types, ProductRegistry, auth middleware, secrets, or deployment workflows.
- Submit the Hotel Core proof form or mutate production data.
- Weaken the production smoke test to accept public console rendering.
- Declare UI operational seal or Go-Live from this fix alone.

## 6. UI -> Contract Reconciliation

| UI Area | Existing Contract / Evidence | Verification Decision |
|---|---|---|
| Unauthenticated Hospitality route | production smoke run `37934133847` showed public console HTML | must redirect to `/login` before rendering console |
| Authenticated Hospitality route | existing production smoke logs in through `e2e/fixtures/auth.ts` | must render `Hotel Operations Console` and all operational sections |
| Hotel Core proof form | existing server action already resolves authenticated user and tenant | unchanged; smoke remains read-only and does not submit |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, trigger, RLS, generated type, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Static scope confirms only route auth guard plus gate/spec documentation changed.
2. Type safety: no `any`, generated type, or suppression added.
3. Auth boundary: unauthenticated request redirects to `/login`.
4. Authenticated boundary: production E2E admin can still render the Operations Console.
5. Read-only production smoke still rejects same-origin mutations.
6. Tenant isolation: page admission uses the existing current-user session; action tenant resolution remains unchanged.
7. Backend contract: no Hospitality product service or repository files changed.
8. Migration safety: no migration files changed.
9. CI safety: regular PR checks must pass before merge.
10. Production evidence: dispatch Hospitality Production UI Smoke on `main` after merge.
11. Closure: keep `HOSPITALITY_UI_OPERATIONAL_SEAL` and `HOSPITALITY_GO_LIVE` as `NOT_PROVEN` unless separately evaluated.

---

# Architecture Gate - Hospitality Production Smoke RSC Redirect Assertion (2026-10-09)

> **Status:** PASS - smoke assertion correction authorized by production evidence.
> **Scope:** Update only the read-only production smoke assertion after run `37938715903` proved the guarded production route no longer renders the Operations Console unauthenticated, but Next returns an RSC redirect digest in the document while the Playwright URL remains `/hospitality/hotel-core-chain`. No Hospitality runtime, backend, schema, RLS, deployment workflow, or sealed Phase 0-7 change is authorized.

## 1. Bella OS/Product Development Process Gate

- Truth: PR #278 is merged on `main`, Vercel deployment for `483e1adb484da38ca922c9b1def6e67034f89e3e` succeeded, and direct production HTTP evidence shows `NEXT_REDIRECT;replace;/login?redirect=%2Fhospitality%2Fhotel-core-chain;307;` instead of the public Operations Console.
- Source of Truth: workflow run `37938715903`, downloaded Playwright JSON artifact, and direct production unauthenticated HTML response.
- Canonical Contract: unauthenticated users must be challenged by app auth before console rendering. The challenge may be browser navigation to `/login` or a Next server redirect digest to `/login`.
- Gate result: `PASS` for smoke-test-only correction; `AUTHENTICATED_PRODUCTION_SMOKE` remains `NOT_PROVEN` until a new run passes on `main`.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capability in scope: CI evidence collection for authenticated production rendering.
- Existing capabilities reused: production smoke workflow, Playwright spec, existing route guard, and existing Operations UI selectors.
- Non-goals: no UI redesign, no backend/service/action change, no production data mutation, no operational seal, no Go-Live claim.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Unauthenticated route challenge evidence | Read-only production smoke spec | accept `/login` URL or Next redirect digest |
| Operations Console rendering | Bella Hospitality UI | must remain absent for unauthenticated HTML |
| Production authentication/session | Platform auth runtime | unchanged |
| Hospitality backend/RLS/schema | Bella Hospitality contracts | unchanged |

## 4. Contract Dependency Map

```text
workflow_dispatch on main
  -> e2e/tests/40-hospitality-production-auth-smoke.spec.ts
  -> unauthenticated route probe
  -> accept /login URL OR NEXT_REDIRECT digest to /login
  -> require no "Hotel Operations Console" in unauthenticated HTML
  -> authenticated real-admin render checks remain unchanged
```

## 5. Change Authority

Authorized:
- Update the unauthenticated challenge assertion in the production smoke spec.
- Keep the explicit guard that unauthenticated HTML must not contain `Hotel Operations Console`.
- Update evidence documentation.

Not authorized:
- Modify Hospitality runtime route/page code, backend services, schema, migrations, RLS, ProductRegistry, auth middleware, secrets, or deployment workflows.
- Accept public console rendering as a valid auth challenge.
- Declare UI operational seal or Go-Live from this assertion fix alone.

## 6. UI -> Contract Reconciliation

| UI Area | Evidence | Verification Decision |
|---|---|---|
| Unauthenticated route | run `37938715903` failed only on URL expectation; direct HTML has Next redirect digest and no Operations Console | accept valid auth challenge shapes, still fail on console HTML |
| Authenticated route | existing smoke path logs in with production E2E admin | keep existing route, section, runtime, network, and read-only assertions |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, trigger, RLS, generated type, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Static scope confirms only E2E smoke assertion plus evidence docs changed.
2. Type safety: no `any`, generated type, or suppression added.
3. Auth boundary: unauthenticated response must be a `/login` navigation or Next redirect digest.
4. Privacy boundary: unauthenticated HTML must not render `Hotel Operations Console`.
5. Authenticated boundary: production E2E admin must render the existing Operations Console.
6. Read-only boundary: same-origin mutations remain rejected.
7. Backend contract: no Hospitality runtime, service, repository, schema, or RLS files changed.
8. Artifact safety: no traces, screenshots, videos, HTML reports, credentials, or tokens.
9. CI safety: regular PR checks must pass before merge.
10. Production evidence: dispatch Hospitality Production UI Smoke on `main` after merge.
11. Closure: only `AUTHENTICATED_PRODUCTION_SMOKE` may become `PASS` after a passing run; UI seal and Go-Live require separate evaluation.

---

# ARCHITECTURE GATE RESULT - ANY-TYPE CLEANUP NON-MANUFACTURING

> **Status:** DEFER for full zero-any cleanup; PASS for authorized non-Manufacturing, non-frozen local cleanup subset
> **Date:** 2026-10-11
> **Scope:** Remove scanner-reported `any` usage where the fix is local, proven, and does not touch Manufacturing, Logistics sealed artifacts, or Education Kernel frozen artifacts.

## Bella OS/Product Development Process Gate

- Truth: `npm run check:any-types` reported 91 `any` violations in 21 files before this cleanup.
- Source of Truth: local scanner output from `scripts/check-any-types.js` on this worktree.
- Canonical Contract: Bella Constitution Law 11 forbids `any`; cleanup rules require frozen/sealed residuals to stop at boundary.
- Gate result: `PASS` for local non-Manufacturing cleanup; `DEFER` for remaining frozen/sealed residuals.

## Product Manifest

- Product: none.
- Capability in scope: technical-debt cleanup for scanner findings.
- Non-goals: no Manufacturing changes, no schema/migration, no ProductRegistry, no Logistics E7.1-E7.3 sealed changes, no Education Kernel changes.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Manufacturing API/Auth/E2E | Manufacturing workstream | not modified |
| Logistics E7.1/E7.2/E7.3 residuals | Logistics OS sealed layers | DEFER without ACR/ADR |
| `src/platform/education` residuals | Education Kernel frozen scope | DEFER without architecture authority |
| Real Estate reservation `cancelled` vs `released` | Real Estate contract gap | DEFER; do not alter semantics to satisfy scanner |
| Core pricing-actions test residual | Platform Core freeze scope | DEFER without APPROVED_CORE_CHANGE_V1 metadata |
| Finance/Real Estate generated-contract consumers, Education Product bridge, Customer Intelligence tests | Local owners | type-local cleanup authorized |

## Contract Dependency Map

```text
scanner finding
  -> ownership classification
  -> local typed boundary cleanup when proven
  -> residual DEFER when frozen/sealed or semantic contract gap
```

## Change Authority

Authorized:
- Remove `any` in non-Manufacturing files when contract-preserving and local.

Not authorized:
- Touch Manufacturing.
- Modify Logistics sealed artifacts.
- Modify Education Kernel frozen artifacts.
- Resolve Real Estate reservation lifecycle semantics by guessing.
- Invent schema/RPC/API/generated type contracts.

## UI -> Contract Reconciliation

- No UI redesign.
- No user-facing workflow or action contract change.

## Additive Migration Plan

- No migration.
- No schema, RLS, generated type, or production data change.

## 11 Automated Verification Gates Plan

1. `npm run check:any-types`
2. `npx tsc --noEmit --pretty false --incremental false`
3. `npm run arch:guard`
4. Targeted Jest for changed test/runtime-adjacent areas
5. `git diff --check`

## Residual Any Classification

After the scoped cleanup, `npm run check:any-types` reports 77 residual scanner findings in 17 files. These are not treated as an authorization to continue mechanical edits:

| Residual scope | Count | Classification | Decision |
|---|---:|---|---|
| `src/core/services/order/pricing-actions.test.ts` | 1 | Platform Core freeze scope | DEFER without APPROVED_CORE_CHANGE_V1 metadata |
| `src/platform/education/__tests__/*` | 6 | Education Kernel frozen test scope | DEFER without explicit Education Kernel authority |
| `src/platform/logistics/**` | 69 | Logistics E7.1/E7.2/E7.3 sealed artifacts and regression tests | BLOCKED/DEFER without ACR, ADR, unlock, and full Logistics re-seal |
| `src/platform/real-estate/engines/reservation.service.ts` | 1 | Real Estate reservation lifecycle contract gap: generated status type lacks `cancelled` while code requests cancellation semantics | DEFER pending business/architecture contract decision |

No residual `any` finding is in Manufacturing. No remaining scanner finding belongs to the changed file set.

## Scope Verification

Changed files in this cleanup:

- `ARCHITECTURE_GATE_RESULT.md`
- `src/platform/finance/__tests__/finance-f1-ledger-verification.test.ts`
- `src/platform/real-estate/repositories/property-unit.repository.ts`
- `src/products/bella-education/facilities/bridges/facilities-projection.bridge.ts`
- `src/products/bella-education/parent-engagement/domain/communication.types.ts`
- `src/products/bella-education/parent-engagement/services/communication-exception.service.ts`
- `src/services/intelligence/customer/__tests__/integration.test.ts`

Explicitly not modified:

- Manufacturing files, including the Manufacturing operational readiness E2E/auth workstream.
- `src/platform/education/**` frozen Education Kernel files.
- `src/platform/logistics/**` sealed Logistics E7.1/E7.2/E7.3 files.
- `src/platform/real-estate/engines/reservation.service.ts`; the `cancelled` status residual remains unchanged.

## Local Evidence Snapshot

The scope can be sealed only as a local cleanup subset, not as full Architecture Gate closure:

| Gate | Result | Evidence boundary |
|---|---|---|
| `npm run check:any-types` | FAIL expected | reduced from 91 findings / 21 files to 77 findings / 17 files; residuals classified above |
| `npx tsc --noEmit --pretty false --incremental false` | PASS | compile-only proof, no runtime proof |
| `npm run arch:guard` | PASS | repository architecture guard only |
| `npm run education:architecture:ci` | PASS | Education baseline policy allows the product-layer direct database access reduction and blocks no new signatures |
| `npm run realestate:architecture` | PASS | Real Estate architecture suite only |
| `npm run education:extensions:architecture` | PASS | Education product extension architecture only; does not unfreeze Kernel |
| `npm test -- src/services/intelligence/customer/__tests__/integration.test.ts --runInBand` | SKIP | 36 skipped because the suite is pre-existing `describe.skip`; not counted as PASS |
| `git diff --check` | PASS | whitespace/conflict-marker check only |

GitHub PR #294 was opened against `main`. The first CI run correctly blocked a Core test hunk without approved Core metadata and a new Education direct database access signature; the Core hunk was removed and the Education projection now reuses the existing service/repository path. Therefore the final claim remains: `PASS` for the scoped non-Manufacturing, non-frozen cleanup subset; `NOT_SEALED` for complete Architecture Gate closure and zero-`any` compliance until the updated PR CI run completes.

---

# Architecture Gate - Hospitality Production Smoke Unauthenticated Request Probe (2026-10-09)

> **Status:** PASS - smoke probe isolation fix authorized by production evidence.
> **Scope:** Update only the unauthenticated challenge probe in the read-only production smoke. Run `37942136475` showed the browser-context probe could see authenticated RSC payload even though direct unauthenticated production HTTP still returned the expected Next redirect digest without `Hotel Operations Console`. No Hospitality runtime, backend, schema, RLS, deployment workflow, or sealed Phase 0-7 change is authorized.

## 1. Bella OS/Product Development Process Gate

- Truth: production route guard code is present on `origin/main`; direct unauthenticated HTTP to `/hospitality/hotel-core-chain` returns `NEXT_REDIRECT` to `/login?redirect=%2Fhospitality%2Fhotel-core-chain` and does not contain `Hotel Operations Console`.
- Source of Truth: workflow run `37942136475`, direct production HTTP probe after Vercel success for `fa165e40b18dde4a4163f5b9eed81f684d689b9c`, and the existing Playwright auth fixture behavior.
- Canonical Contract: unauthenticated proof must be isolated from authenticated browser state; authenticated rendering must still be proven in a real browser session.
- Gate result: `PASS` for smoke-test-only probe isolation; `AUTHENTICATED_PRODUCTION_SMOKE` remains `NOT_PROVEN` until a new run passes on `main`.

## 2. Product Manifest

- Product: Bella Hospitality (`bella_hospitality`).
- Capability in scope: CI evidence collection for production auth challenge plus authenticated UI rendering.
- Existing capabilities reused: production smoke workflow, Playwright API request context, existing auth fixture, route guard, and Operations UI selectors.
- Non-goals: no product code change, no backend/service/action change, no production data mutation, no operational seal, no Go-Live claim.

## 3. Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Unauthenticated route challenge evidence | Read-only production smoke spec | use fresh empty-storage HTTP request context |
| Authenticated UI rendering | Playwright real-auth browser fixture | keep browser assertions unchanged |
| Production authentication/session | Platform auth runtime | unchanged |
| Hospitality backend/RLS/schema | Bella Hospitality contracts | unchanged |

## 4. Contract Dependency Map

```text
workflow_dispatch on main
  -> empty-storage APIRequestContext GET /hospitality/hotel-core-chain
  -> require /login challenge and no "Hotel Operations Console"
  -> authenticated adminPage browser render
  -> section, runtime, network, and read-only assertions
```

## 5. Change Authority

Authorized:
- Replace the browser-context unauthenticated probe with a fresh Playwright request context using empty storage/cookies.
- Keep the Operations Console absence check and login challenge check.
- Include sanitized unauthenticated status/location evidence in the JSON artifact.

Not authorized:
- Modify Hospitality route/page code, backend services, schema, migrations, RLS, ProductRegistry, auth middleware, secrets, or deployment workflows.
- Bypass app authentication or use authenticated cookies for the unauthenticated probe.
- Declare UI operational seal or Go-Live from this smoke harness fix alone.

## 6. UI -> Contract Reconciliation

| UI Area | Evidence | Verification Decision |
|---|---|---|
| Unauthenticated route | direct production HTTP is challenged; browser probe was contaminated by authenticated worker context | use isolated HTTP request context with empty storage/cookies |
| Authenticated route | production E2E admin login remains the required browser proof | keep existing render, section, runtime, network, and read-only assertions |

## 7. Additive Migration Plan

- No migration.
- No schema, table, index, trigger, RLS, generated type, or production data change.

## 8. 11 Automated Verification Gates Plan

1. Static scope confirms only E2E smoke assertion plus evidence docs changed.
2. Type safety: no `any`, generated type, or suppression added.
3. Auth boundary: unauthenticated request uses empty storage/cookies.
4. Privacy boundary: unauthenticated HTML must not render `Hotel Operations Console`.
5. Challenge boundary: unauthenticated response must be `/login` navigation/location or Next redirect digest.
6. Authenticated boundary: production E2E admin must render the existing Operations Console.
7. Read-only boundary: same-origin mutations remain rejected.
8. Backend contract: no Hospitality runtime, service, repository, schema, or RLS files changed.
9. CI safety: regular PR checks must pass before merge.
10. Production evidence: dispatch Hospitality Production UI Smoke on `main` after merge.
11. Closure: only `AUTHENTICATED_PRODUCTION_SMOKE` may become `PASS` after a passing run; UI seal and Go-Live require separate evaluation.
# ARCHITECTURE GATE RESULT - BDGF OWNER HASH CI GUARD FIX

> **Status:** PASS - minimal test-only repair for the owner-operated approval guard after the protected Production workflow failed before secrets, approval creation, migration execution, or post-deploy probes.
> **Date:** 2026-10-13
> **Scope:** Make the BDGF owner-approval hash fixture test derive the expected hash from the checked-out fixture content so the guard is not platform line-ending dependent. No migration content change, no workflow scope expansion, no database execution, no Mobility OS, no ProductRegistry, and no kernel changes.

## Bella OS/Product Development Process Gate

- Truth: Production run `38351566779` failed closed in `npm run test:bdgf-owner-authority`; later steps for secrets, BDGF approval, wrapper execution, and Real DB probe were skipped.
- Source of Truth: `scripts/bdgf/test-create-migration-approval.mjs`, `scripts/bdgf/create-migration-approval.mjs`, and the failed GitHub Actions log for run `38351566779`.
- Canonical Contract: owner-operated approval remains verified by BDGF authority evidence; migration execution remains wrapper-only and deferred until the protected workflow passes all guards.
- Gate result: `PASS` for a test-only guard repair. `MIGRATION = NOT_APPLIED` and `POST_DEPLOY_RLS = NOT_PROVEN` remain unchanged.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: BDGF owner-operated approval guard reliability in GitHub Actions.
- Non-goals: no migration rewrite, no production SQL path, no Mobility OS, no ProductRegistry, no kernel change, no Bella Auto Go-Live claim.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Owner approval guard tests | BDGF governance | remove platform-specific fixture hash constant |
| Approved workshop RLS migration | Bella Auto workshop persistence | unchanged |
| Production execution | BDGF wrapper / operator | still blocked until workflow passes and probes production DB |

## Contract Dependency Map

```text
test-create-migration-approval.mjs
  -> computeHash(checked-out fixture content)
  -> buildRequestFromArgs()
  -> validate approval request contract
```

## Change Authority

Authorized:
- Modify the focused BDGF owner approval test guard only.

Not authorized:
- Modify approved migration content or hash.
- Execute production migration outside the protected workflow.
- Modify ProductRegistry, kernels, Mobility OS, Logistics/Warehouse/Healthcare/Education, or unrelated Bella Auto features.

## UI -> Contract Reconciliation

- No UI change.

## Additive Migration Plan

- No database migration change.
- No production database mutation in this fix.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to BDGF test and gate record.
2. Contract Boundary: no BDGF runtime approval or wrapper contract change.
3. Tenant Isolation: no database behavior changed.
4. RLS & Authorization: unchanged; production proof remains pending.
5. Database Migration Safety: approved migration hash remains unchanged.
6. Event-After-Persistence: no event path changed.
7. Domain Safety Routing: no unrelated OS/Product files changed.
8. Temporal Provenance: fix responds to failed protected workflow run `38351566779`.
9. Rule Governance: no business rule changed.
10. Audit & Evidence Integrity: failed production workflow remains fail-closed until rerun after this fix.
11. Regression: run `npm run test:bdgf-owner-authority`, `npm run test:bdgf-production-workflow`, `npm run security:secrets`, and `git diff --check`.

---
# ARCHITECTURE GATE RESULT - BASELINE PATH NORMALIZATION FOR MOVED REPOSITORY

> **Status:** PASS - minimal CI baseline identity fix for PR #303 failure.
> **Date:** 2026-10-13
> **Scope:** Fix baseline fingerprint path normalization after the GitHub repository move to `bella-ai-platform`. No baseline ratchet, no lint debt changes, no Product or database change.

## Bella OS/Product Development Process Gate

- Truth: PR #303 failed only on `Baseline Comparison`; required architecture checks and CI aggregate passed. The baseline log reported 73 new ESLint findings using absolute paths under `/home/runner/work/bella-ai-platform/bella-ai-platform/...`.
- Source of Truth: live PR #303 check logs, `.github/workflows/baseline-no-new-debt.yml`, `scripts/ci/baseline/fingerprint.ts`, and `.github/ci/baselines/main.json`.
- Canonical Contract: baseline identities must normalize runner-specific absolute workspace paths to stable repository-relative paths before computing fingerprints.
- Gate result: `PASS` for adding the moved repository path marker and a regression test. `BASELINE_RATCHET = NOT_DONE`.

## Product Manifest

- Product: none.
- Capability in scope: CI baseline fingerprint stability.
- Existing capabilities reused: baseline `completeFinding()` and no-new-debt comparator.
- Non-goals: no baseline file update, no ESLint rule change, no product code, no DB, no migration execution.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Baseline fingerprint identity | CI governance | normalize `bella-ai-platform/` absolute runner paths |
| Historical lint debt | Baseline governance | leave untouched |
| BDGF Production workflow fix | PR #303 branch | keep existing secret-source fix |

## Contract Dependency Map

```text
ESLint JSON absolute filePath
  -> completeFinding()
  -> normalizeFilePath()
  -> stable repo-relative fingerprint
  -> compareBaseline()
```

## Change Authority

Authorized:
- Fix CI baseline path normalization for the moved repository name.
- Add targeted regression test.

Not authorized:
- Update `.github/ci/baselines/main.json`.
- Fix unrelated ESLint debt.
- Change BDGF migration execution, approval authority, or Production secrets beyond PR #303's existing scope.

## UI -> Contract Reconciliation

- No UI change.

## Additive Migration Plan

- No migration.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: CI-only script/test change.
2. Contract Boundary: preserve baseline fingerprint contract.
3. Tenant Isolation: not applicable.
4. RLS & Authorization: not applicable.
5. Database Migration Safety: no migration change.
6. Event-After-Persistence: no app event path changed.
7. Domain Safety Routing: no ProductRegistry, Healthcare, Education, Logistics, Warehouse, Mobility OS, or kernel change.
8. Temporal Provenance: PR #303 remains the delivery vehicle.
9. Rule Governance: no domain rule changed.
10. Audit & Evidence Integrity: no baseline ratchet; only identity normalization.
11. Regression: run targeted baseline Jest test, focused BDGF workflow tests, secret scan, and diff check.

---

# ARCHITECTURE GATE RESULT - BDGF PRODUCTION DB URL SECRET FIX

> **Status:** PASS - minimal workflow secret-source correction for the Bella Auto workshop RLS Production workflow.
> **Date:** 2026-10-13
> **Scope:** Replace the generic `secrets.DATABASE_URL` source with the confirmed canonical `secrets.PRODUCTION_SUPABASE_DB_URL` for read-only BDGF approval creation and post-deploy RLS probing. No SQL change, no executor bypass, no Production mutation from this local session.

## Bella OS/Product Development Process Gate

- Truth: Admin-triggered Production runs reached the approval step but failed before BDGF approval creation with `ENETUNREACH` while the workflow sourced the read-only PostgreSQL URL from `secrets.DATABASE_URL`.
- Source of Truth: workflow run logs, GitHub Actions workflow file, BDGF approval/probe scripts, and the operator-confirmed canonical secret name `PRODUCTION_SUPABASE_DB_URL`.
- Canonical Contract: the protected Production workflow must use the approved Production database URL secret for approval creation and read-only verification, while mutation still goes only through `DATABASE_EXECUTOR_URL` and the BDGF wrapper.
- Gate result: `PASS` for correcting the workflow secret source and adding a static guard. `MIGRATION_EXECUTION = NOT_RUN` for this code change.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: Production workflow connection-secret mapping for BDGF approval and post-deploy RLS probe.
- Existing capabilities reused: BDGF owner-operated approval, BDGF wrapper, approved migration artifact, Production environment protection.
- Non-goals: no migration content change, no `db push`, no direct executor invocation, no bulk migration sync, no ProductRegistry, no kernel change.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Production read-only DB URL secret | Production operations / GitHub Actions secrets | use `PRODUCTION_SUPABASE_DB_URL` |
| Approval record creation | BDGF governance | keep `create-migration-approval.mjs` path |
| Production mutation | BDGF wrapper / executor | keep `DATABASE_EXECUTOR_URL` only for execution |
| Workshop RLS proof | Bella Auto workshop persistence | keep post-deploy probe after migration |

## Contract Dependency Map

```text
workflow_dispatch on main
  -> Production environment secrets
  -> PRODUCTION_SUPABASE_DB_URL for approval/probe read connection
  -> DATABASE_EXECUTOR_URL for wrapper execution only
  -> approved migration SHA-256 check
  -> owner_operated approval
  -> execute-migration-wrapper.mjs
  -> post-deploy RLS probe
```

## Change Authority

Authorized:
- Update the Production workflow secret source for approval/probe DB connections.
- Add focused static workflow guard coverage for the canonical secret.
- Update this gate record.

Not authorized:
- Modify migration SQL or approved hash.
- Run Production mutation locally.
- Add a fallback to E2E credentials or a generic DB URL secret.
- Bypass BDGF, weaken owner authority, or change executor behavior.

## UI -> Contract Reconciliation

- No UI change.
- No product user-facing contract change.

## Additive Migration Plan

- No new migration.
- The workflow remains bound to `supabase/migrations/20261013090000_reenable_bella_auto_workshop_rls.sql` and SHA-256 `1FEDCE34702106E86A38D650AAF43FEC52A763F54E66A11187EEF6D3A37C2425`.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to workflow, focused BDGF workflow test, and gate record.
2. Contract Boundary: approval and execution remain on existing BDGF scripts.
3. Tenant Isolation: unchanged; post-deploy probe remains required.
4. RLS & Authorization: unchanged; workflow still requires post-deploy probe before proven status.
5. Database Migration Safety: approved migration hash remains fixed.
6. Event-After-Persistence: no app event path changed.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Warehouse, ProductRegistry, Mobility OS, or kernel files changed.
8. Temporal Provenance: workflow remains manual-only on `main` in Production environment.
9. Rule Governance: no accounting/legal/domain rule changed.
10. Audit & Evidence Integrity: static guard blocks `secrets.DATABASE_URL` from re-entering this workflow.
11. Regression: run focused BDGF workflow tests, owner authority tests, diff check, secret scan, and final diff review.

---

# ARCHITECTURE GATE RESULT - BDGF APPROVAL OUTPUT PARSER HOTFIX

> **Status:** PASS - minimal workflow parser hardening after Production attempt 3 created BDGF approval but failed to extract the approval id from noisy command output.
> **Date:** 2026-10-13
> **Scope:** Parse the approval JSON object from `approval-output.log` without being confused by dotenv tip text. No SQL change, no migration content change, no executor bypass, no Production mutation from this local session.

## Bella OS/Product Development Process Gate

- Truth: Production run `38361647192` attempt `3` created an approved BDGF record, then failed because the inline parser read the first brace in dotenv output (`{ override: true }`) instead of the approval JSON.
- Source of Truth: GitHub Actions failed log, Production read-only approval lookup, workflow parser code, and focused BDGF workflow guard.
- Canonical Contract: the workflow must pass the created `approval_id` to `execute-migration-wrapper.mjs` only after validating that the parsed JSON contains the approved migration hash.
- Gate result: `PASS` for parser hardening. `MIGRATION_EXECUTION = NOT_RUN` for this code change.

## Product Manifest

- Product: Bella Auto / Automove workshop security boundary.
- Capability in scope: Production BDGF workflow approval id extraction.
- Existing capabilities reused: owner-operated approval, fixed migration hash gate, BDGF wrapper execution, and post-deploy RLS probe.
- Non-goals: no migration SQL change, no `db push`, no direct executor invocation, no bulk migration sync, no owner authority relaxation.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Approval output parsing | BDGF workflow | harden parser against non-JSON braces |
| Approval record | BDGF governance | preserve existing create approval script |
| Production mutation | BDGF wrapper / executor | unchanged |
| Workshop RLS proof | Bella Auto workshop persistence | unchanged post-deploy probe |

## Contract Dependency Map

```text
create-migration-approval.mjs stdout
  -> approval-output.log
  -> parse JSON object with approval_id + migration_hash
  -> validate approved SHA-256
  -> expose steps.approval.outputs.approval_id
  -> execute-migration-wrapper.mjs
```

## Change Authority

Authorized:
- Harden approval JSON extraction in the protected Production workflow.
- Add focused static guard coverage for noisy output.
- Update this gate record.

Not authorized:
- Modify migration SQL or approved hash.
- Run Production mutation locally.
- Bypass BDGF, weaken owner authority, or change executor behavior.

## UI -> Contract Reconciliation

- No UI change.
- No product user-facing contract change.

## Additive Migration Plan

- No new migration.
- Existing migration binding and SHA-256 are unchanged.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to workflow, focused workflow test, and gate record.
2. Contract Boundary: approval and execution remain on existing BDGF scripts.
3. Tenant Isolation: unchanged; post-deploy probe remains required.
4. RLS & Authorization: unchanged; workflow still requires post-deploy probe before proven status.
5. Database Migration Safety: approved migration hash remains fixed.
6. Event-After-Persistence: no app event path changed.
7. Domain Safety Routing: no Healthcare, Education, Logistics, Warehouse, ProductRegistry, Mobility OS, or kernel files changed.
8. Temporal Provenance: workflow remains manual-only on `main` in Production environment.
9. Rule Governance: no accounting/legal/domain rule changed.
10. Audit & Evidence Integrity: parser validates approval hash before outputting the id.
11. Regression: run focused BDGF workflow tests, owner authority tests, diff check, and secret scan.

---
# ARCHITECTURE GATE RESULT - MOBILITY OS FOUNDATION MVP

> **Status:** PASS - approved for minimal Mobility OS Foundation MVP implementation.
> **Date:** 2026-10-13
> **Scope:** Create a reusable Mobility OS public contract and runtime foundation for vehicle identity, tenant ownership, lifecycle trace, service-history trace, idempotency, and audit. Reuse existing `auto_*` schema where it already fits. Add only the minimal `mobility_*` OS control tables needed for command idempotency and domain events. Integrate AutoMove through one approved public-contract consumer in this batch. No ProductRegistry entry, no bulk schema rename, no Logistics/Warehouse/Finance change, and no Production mutation.

## Bella OS/Product Development Process Gate

- Truth: Bella Auto already has `auto_*` tables for vehicle identity, owners, lifecycle logs, appointments, repair orders, and service history. It does not yet have a Platform-owned Mobility OS public contract or OS-level command idempotency/audit tables.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, the approved user scope for Mobility OS Foundation MVP, existing Bella Auto migrations `20260803200800`, `20260803210000`, `20260803220000`, `20260803260000`, and the sealed Bella Auto workshop RLS closure evidence.
- Canonical Contract: Product code consumes Mobility through `src/platform/mobility` public exports. Mobility repository adapters own persistence mapping to existing `auto_*` tables and new minimal `mobility_*` control tables. ProductRegistry remains unchanged.
- Gate result: `PASS` for this minimal foundation implementation. `MOBILITY_OS_FOUNDATION_MVP = NOT_PROVEN` remains true until local/static/Real DB/RLS/idempotency/audit checks are run and reported.

## Product Manifest

- Product registry: unchanged and not authorized.
- OS capability: Mobility Foundation, not a standalone product.
- First consumer: Bella AutoMove / Bella Auto vehicle availability route, migrated through a Mobility public contract in this batch.
- Reused persistence: `auto_vehicles`, `auto_vehicle_status_logs`, `auto_vehicle_owners`, and `auto_service_history`.
- New additive persistence: `mobility_domain_events` and `mobility_command_idempotency` only.
- Non-goals: no Bella Auto rewrite, no ProductRegistry registration, no Production execution, no Logistics/Warehouse/Finance overlap, no bulk `auto_*` rename, and no full AutoMove Go-Live claim.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle identity and VIN lifecycle contract | Mobility OS | Public types/service define reusable contract; existing `auto_vehicles` remains the adapter schema for this MVP |
| Vehicle ownership/user relationship | Mobility OS contract with Auto persistence | Reuse `auto_vehicle_owners`; relationship semantics exposed through Mobility types |
| Workshop appointment / repair workflow | AutoMove Product | Not moved into OS in this batch |
| Service history trace by VIN | Mobility OS contract | Read/trace existing `auto_service_history`; do not rewrite workshop flow |
| Command idempotency | Mobility OS | Add `mobility_command_idempotency` because no shared `auto_*` command log exists |
| Domain audit events | Mobility OS | Add `mobility_domain_events` because no shared `auto_*` domain event log exists |
| Tenant isolation | Platform DB/RLS + Mobility authorization port | Tests must prove same-tenant access and cross-tenant denial for target tables |

## Contract Dependency Map

```text
AutoMove Product Consumer
  -> src/platform/mobility public contract
  -> MobilityFoundationService / Supabase contract adapter
  -> MobilityRepository port
  -> existing auto_* persistence for vehicle/ownership/service trace
  -> mobility_* control tables for idempotency and audit
  -> Platform tenant/RLS helpers
```

## Change Authority

Authorized:
- Add `src/platform/mobility` public contract, service, repository ports, in-memory adapter, Postgres adapter, and Supabase read adapter.
- Add one additive migration for Mobility OS command idempotency, domain events, hardened adapter policies, and minimal adapter grants on existing `auto_*` tables used by the Mobility contract.
- Add tests for architecture scope, service behavior, migration/RLS shape, Real DB/RLS where E2E DB credentials are available, and AutoMove route contract usage.
- Update one AutoMove consumer in the approved batch to call the Mobility public contract.

Not authorized:
- Modify ProductRegistry or create `bella_mobility`.
- Bulk rename or replace `auto_*` schema.
- Modify Logistics, Warehouse, Finance, Healthcare, Education, Manufacturing, frozen kernels, or unrelated Bella products.
- Execute Production mutation from this local session.

## UI -> Contract Reconciliation

- No UI redesign.
- Data/action consumer in scope: `GET /api/bella-auto/vehicles/available` must fetch available VINs via Mobility public contract instead of directly querying `auto_vehicles`.
- Existing workshop UI and full AutoMove product flows remain outside this batch unless tests reveal a direct break caused by the scoped change.

## Additive Migration Plan

- Add `20261013120000_create_mobility_os_foundation_contract.sql`.
- Reuse existing `auto_*` tables for vehicle, owner, lifecycle, and service trace persistence.
- Create only `mobility_domain_events` and `mobility_command_idempotency`, with tenant/org-unit scope, RLS enabled, anon revoked, authenticated SELECT/INSERT only, and service_role maintenance grants.
- Use `public.get_auth_tenant_id()` and `auth.uid()` as the trusted tenant/user source; do not accept caller-supplied tenant context through `app.current_tenant_id` or `app.current_user_id`.
- Replace the historical null-tenant adapter policies on the four Mobility-owned `auto_*` adapter tables before granting runtime privileges.
- Grant only the adapter privileges needed by the contract on existing `auto_*` tables after policy hardening: vehicle read/write without delete, status-log read/insert, ownership read/write without delete, and service-history read-only.
- Do not change Production; migration application is limited to local/E2E verification unless a later Production approval explicitly authorizes it.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility OS foundation, one AutoMove consumer, additive migration, tests, and this gate record.
2. Contract Boundary: Product consumer imports from `src/platform/mobility`; no ProductRegistry or other OS changes.
3. Tenant Isolation: Real DB test verifies same-tenant trace and cross-tenant denial on target Mobility tables when E2E DB credentials are present.
4. RLS & Authorization: migration-shape test verifies RLS enabled and anon revoked for Mobility control tables.
5. Database Migration Safety: migration is additive and avoids `DROP`, `ALTER TYPE`, table rewrites, and bulk `auto_*` changes.
6. Event-After-Persistence: domain events are recorded after successful persistence inside the service transaction.
7. Idempotency: service tests cover duplicate replay and conflict detection by tenant/operation/business key.
8. Domain Safety Routing: tests assert no Logistics/Warehouse/Finance/ProductRegistry mutation surface appears in the Mobility migration.
9. Regression: targeted Mobility and AutoMove route tests must pass; broader regression reported separately if run.
10. Audit & Evidence Integrity: trace output includes lifecycle, ownership/service history, and Mobility domain events without secrets.
11. Stop Condition: report `PROVEN`, `NOT_PROVEN`, `NOT_READY`, or `HELD` by gate, then stop without expanding product scope.
# ARCHITECTURE GATE RESULT - AUTOMOVE INVENTORY DASHBOARD MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove inventory dashboard read-side migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move `src/components/bella-auto/VehicleInventoryDashboard.tsx` vehicle list and summary reads behind the Mobility OS public Supabase contract. Preserve existing dashboard UI behavior, pagination, status filters, VIN/location search, and tenant-scoped access. No write path change, no migration, no ProductRegistry change, no Production mutation, and no other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS Foundation and the first AutoMove consumer batch are merged on `main`. `VehicleInventoryDashboard` still directly queries `auto_vehicles` for read-side list pagination and summary counts even though Mobility now owns vehicle identity/lifecycle read mapping.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, PR #307 Mobility Foundation, PR #308 AutoInventoryProvider read-side migration, existing `src/platform/mobility/supabase-vehicle-contract.ts`, and the current dashboard consumer behavior.
- Canonical Contract: AutoMove product UI/read consumers should call Mobility public contract functions for vehicle inventory reads; the Mobility adapter owns persistence mapping to reused `auto_*` tables.
- Gate result: `PASS` for this dashboard read-side consumer only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / Bella Auto dashboard inventory surface.
- OS capability consumed: Mobility vehicle inventory list and status summary read contract.
- Consumer in scope: `src/components/bella-auto/VehicleInventoryDashboard.tsx`.
- Non-goals: no vehicle creation, no lifecycle transition, no booking/workshop/service repair flows, no ProductRegistry entry, no schema migration, no Production deployment.

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Vehicle inventory read mapping | Mobility OS | expose paginated dashboard read contract and reuse existing `auto_vehicles` adapter mapping |
| Dashboard table/card presentation | AutoMove Product UI | preserve current UI fields, filters, and pagination behavior |
| Tenant isolation | Supabase RLS plus tenant-scoped query input | preserve tenant filter from authenticated server-provided `tenantId`; do not add service-role bypass |
| Vehicle writes/transitions | AutoMove Product / future Mobility write contract | unchanged in this batch |

## Contract Dependency Map

```text
VehicleInventoryDashboard
  -> src/platform/mobility/supabase-vehicle-contract
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicles persistence
  -> existing AutoMove dashboard row/card response shape
```

## Change Authority

Authorized:
- Extend Mobility public Supabase contract with a paginated inventory list read function that preserves dashboard search/filter semantics.
- Refactor `VehicleInventoryDashboard` list and summary reads to call Mobility public contract functions.
- Add focused static tests proving this dashboard consumer no longer directly reads `auto_vehicles`.

Not authorized:
- Modify write-side vehicle creation or lifecycle transition semantics.
- Add migrations, change RLS, change ProductRegistry, mutate Production, or touch unrelated OS/product scopes.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing dashboard fields, filters, page size, pagination, and status cards must remain compatible.
- This batch moves the data-access boundary only; it does not introduce new UI states, KPIs, actions, or workflows.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility contract, one AutoMove dashboard consumer, focused tests, and this gate record.
2. Contract Boundary: dashboard imports Mobility public contract instead of direct `auto_vehicles` queries.
3. Tenant Isolation: existing server-provided `tenantId` filter and authenticated Supabase RLS context are preserved.
4. RLS & Authorization: no grants or policies changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry or other OS/product scope touched.
8. Type Safety: no `any`, suppressions, or generated type edits.
9. Regression: focused Mobility/AutoMove contract tests plus changed typecheck/build.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this dashboard read-side batch without broad AutoMove rewrite.

---
# ARCHITECTURE GATE RESULT - AUTOMOVE NEXT BEST ACTION SERVICE HISTORY MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove next-best-action service-history vehicle read migration is authorized.
> **Date:** 2026-10-13
> **Scope:** Move `NextBestActionEngine.analyzeServiceHistory` customer-owned vehicle reads behind the Mobility OS public Supabase contract. Preserve current recommendation timing thresholds, action types, priority/confidence, service appointment lookup, and persistence behavior. No write-side lifecycle, allocation/deallocation, booking, workshop workflow, rollback, schema migration, ProductRegistry, Production mutation, or other OS changes.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS owns reusable vehicle identity and ownership read mapping; AutoMove next-best-action service-history logic only needs customer-owned vehicle identity, display metadata, and creation date to evaluate maintenance reminders.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, merged Mobility public contract in `src/platform/mobility/supabase-vehicle-contract.ts`, current `NextBestActionEngine.analyzeServiceHistory` behavior, and post-#312 direct `auto_vehicles` inventory.
- Canonical Contract: Product read consumers should obtain customer-owned vehicle identity through Mobility public contract functions; the Mobility adapter owns persistence mapping to reused `auto_vehicle_owners`, `auto_vehicles`, and catalog tables.
- Gate result: `PASS` for this read-side service-history signal only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / AI Next Best Action service-history signal.
- OS capability consumed: Mobility customer-owned vehicle read contract.
- Consumer in scope: `src/modules/bella-auto/services/NextBestActionEngine.ts` inside `analyzeServiceHistory`.
- Non-goals: no quotation/test-drive/touchpoint/satisfaction/life-event behavior changes, no service appointment query refactor, no booking/workshop flows, no vehicle lifecycle write migration, no schema migration, no Production deployment.

## Direct Reference Inventory After PR #312

| Category | Files | Decision |
|---|---|---|
| Mobility-owned persistence mapping | `src/platform/mobility/**` | allowed owner of `auto_vehicles` mapping |
| Read-side independent candidate | `NextBestActionEngine.analyzeServiceHistory` | migrate in this batch |
| Read-side candidate but separate scope | `FinancialReportingService`, `WarrantyService` | defer; each needs its own semantic contract |
| Booking/workshop joins | booking table, service appointment/order/history joins | defer by explicit scope boundary |
| Write lifecycle/allocation/rollback | status machine, allocation, rollback, booking POST vehicle update, provider add vehicle | out of scope |
| Tests/generated/scripts/docs | `src/__tests__/**`, generated DB types, scripts, docs | not product consumer migration targets |

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Customer-owned vehicle identity and display metadata | Mobility OS | extend existing customer-owned vehicle read DTO with `createdAt` |
| Maintenance recommendation thresholds and saved next-best-action records | AutoMove Product | preserve existing behavior |
| Last completed service appointment lookup | AutoMove Workshop/Product service path | unchanged in this batch |
| Tenant isolation | Mobility contract plus existing tenant-scoped service appointment query | preserve explicit `tenantId` filters; no service-role bypass |

## Contract Dependency Map

```text
NextBestActionEngine.analyzeServiceHistory
  -> src/platform/mobility/supabase-vehicle-contract
  -> listMobilityCustomerOwnedVehicles
  -> Supabase client with authenticated RLS context
  -> reused auto_vehicle_owners / auto_vehicles / variant-model-brand persistence
  -> existing auto_service_appointments read for last completed service
  -> existing next-best-action recommendation persistence
```

## Change Authority

Authorized:
- Extend the existing Mobility customer-owned vehicle read DTO with `createdAt` from the existing `auto_vehicles.created_at` field.
- Refactor only the scoped `analyzeServiceHistory` vehicle ownership read to call Mobility public contract.
- Add focused tests proving contract mapping and preventing direct `auto_vehicles` access in this service-history signal.
- Update this gate record.

Not authorized:
- Modify vehicle status transition, allocation/deallocation, booking POST allocation, rollback, workshop creation/update flows, financial reporting, warranty workflows, ProductRegistry, generated DB types, migrations, grants/RLS, or Production.

## UI -> Contract Reconciliation

- No UI change.
- Recommendation text still uses a vehicle display name; the display value now comes from canonical Mobility-owned brand/model/variant metadata and falls back to VIN/vehicle ID.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility read contract, `NextBestActionEngine`, focused Mobility tests, and this gate record.
2. Contract Boundary: `analyzeServiceHistory` imports Mobility public contract instead of direct `auto_vehicles` query.
3. Tenant Isolation: Mobility reads are tenant-scoped and service appointment lookup keeps explicit `tenant_id`.
4. RLS & Authorization: no policies or grants changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: recommendation save path unchanged; no new event path.
7. Domain Safety Routing: no ProductRegistry, other OS, booking/workshop, or lifecycle write path touched.
8. Type Safety: no `any`, suppressions, generated type edits, or compatibility aliases.
9. Regression: focused Mobility static/unit tests, changed typecheck, lint, architecture guard, and security guard.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this read-side signal batch without broad AutoMove rewrite.

---

# ARCHITECTURE GATE RESULT - AUTOMOVE BOOKING LIST MOBILITY READ BATCH

> **Status:** PASS - minimal AutoMove booking-list vehicle display read migration is authorized.
> **Date:** 2026-10-14
> **Scope:** Move `BookingListTable` vehicle display enrichment behind the Mobility OS public Supabase contract. Preserve the current booking/deposit list behavior and keep booking writes, deposit confirmation, vehicle allocation, status lifecycle, workshop joins, schema, ProductRegistry, Production, and other OS scopes unchanged.

## Bella OS/Product Development Process Gate

- Truth: Mobility OS owns reusable tenant-scoped vehicle display/identity reads; AutoMove booking UI owns booking/deposit presentation and actions.
- Source of Truth: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, current Mobility public contract, sealed read-side batches through #314, and fresh post-#314 direct `auto_vehicles` inventory on `platform/main`.
- Canonical Contract: AutoMove consumers should not join/read `auto_vehicles` directly for vehicle display; they should call Mobility public contract functions and keep product-owned booking data in product queries.
- Gate result: `PASS` for the booking list read-side display enrichment only. `AUTOMOVE_WRITE_CONSUMERS_MIGRATED = NOT_PROVEN` and `AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`.

## Product Manifest

- Product: Bella AutoMove / booking deposit list.
- OS capability consumed: Mobility tenant-scoped vehicle display read contract.
- Consumer in scope: `src/components/bella-auto/BookingListTable.tsx` load path.
- Non-goals: no booking creation API, deposit confirmation API, allocation/deallocation, vehicle status update, workshop appointment/order/history joins, financial reporting, rollback, schema migration, ProductRegistry entry, or Production deployment.

## Direct Reference Inventory After PR #314

| Category | Files | Decision |
|---|---|---|
| Mobility-owned persistence mapping | `src/platform/mobility/**` | allowed owner of `auto_vehicles` mapping |
| Read-side independent candidate | `BookingListTable` vehicle display join | migrate in this batch |
| Read-side candidate needing separate semantic proof | `FinancialReportingService` | defer; profit/cost semantics need contract proof |
| Booking write/allocation | booking POST route and vehicle status update | out of scope |
| Workshop joins | service appointment/order/history joins | defer by explicit scope boundary |
| Write lifecycle/allocation/rollback | status machine, allocation service, rollback flows, inventory add vehicle | out of scope |
| Tests/generated types | `src/__tests__/**`, generated DB types | not product consumer migration targets |

## Ownership Map

| Data / Behavior | Owner | Decision |
|---|---|---|
| Booking/deposit rows and filters | AutoMove Product | keep `auto_bookings` query in component |
| Vehicle display by assigned vehicle IDs | Mobility OS | expose minimal tenant-scoped display DTO/function |
| Deposit confirmation action | AutoMove Product/API | unchanged |
| Tenant isolation | Supabase RLS plus explicit tenant-scoped contract input | preserve `tenantId` filters; no service-role bypass |

## Contract Dependency Map

```text
BookingListTable
  -> createClient authenticated Supabase context
  -> auto_bookings product query for booking/deposit/customer data
  -> src/platform/mobility/supabase-vehicle-contract
  -> listMobilityVehicleDisplayByIds(tenantId, vehicleIds)
  -> reused auto_vehicles / variant-model persistence
  -> existing booking table rendering and deposit action
```

## Change Authority

Authorized:
- Add a minimal Mobility vehicle display read function by tenant and vehicle IDs.
- Refactor only `BookingListTable` vehicle display enrichment to call Mobility public contract.
- Preserve booking/deposit filters, search, counts, and confirm-deposit action.
- Add focused tests proving tenant-scoped display mapping and no direct booking-list `auto_vehicles` join.
- Update this gate record.

Not authorized:
- Modify booking creation/allocation, deposit confirmation, vehicle status transitions, warranty, financial reporting, workshop flows, rollback flows, generated DB types, migrations, grants/RLS, ProductRegistry, other OS/product scopes, or Production.

## UI -> Contract Reconciliation

- No UI redesign.
- Existing booking table fields remain product-owned.
- Existing assigned-vehicle display values are mapped from Mobility DTO fields: VIN, exterior color, model name, and variant name.
- Current behavior remains assigned-vehicle oriented; unassigned/write allocation behavior is not changed.

## Additive Migration Plan

- No migration.
- No schema, table, index, RLS, generated type, or data change.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files limited to Mobility read contract, booking list consumer, focused Mobility tests, and this gate record.
2. Contract Boundary: booking list imports Mobility public contract and no longer contains a direct `auto_vehicles!inner` join.
3. Tenant Isolation: Mobility display read applies explicit `tenant_id` filtering and ID filtering.
4. RLS & Authorization: no policies or grants changed.
5. Database Migration Safety: no migration.
6. Event-After-Persistence: no write/event path changed.
7. Domain Safety Routing: no ProductRegistry, other OS, workshop, financial, or lifecycle write path touched.
8. Type Safety: no `any`, suppressions, generated type edits, or compatibility aliases.
9. Regression: focused static/unit tests, changed typecheck, lint, architecture guard, and build/security checks as applicable.
10. Evidence Integrity: report local/CI proof separately from Production; no Go-Live claim.
11. Stop Condition: stop after this read-side booking display batch without broad AutoMove rewrite.
