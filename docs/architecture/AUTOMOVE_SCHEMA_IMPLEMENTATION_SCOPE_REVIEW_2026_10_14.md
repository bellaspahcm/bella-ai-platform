# AutoMove Schema and Implementation Scope Review

Date: 2026-10-14
Scope: review only

## Decision

The Accounting Policy v1 implementation plan is ready to advance to a narrow schema and implementation authorization review. This document does not authorize code mutation, schema migration, or Production mutation.

```ini
SCHEMA_AND_IMPLEMENTATION_SCOPE_REVIEW = COMPLETE
ACCOUNTING_POLICY_V1                   = APPROVED_FOR_IMPLEMENTATION
BUSINESS_CONTRACT_APPROVED             = LIMITED_TO_APPROVED_SCOPE
SCHEMA_MIGRATION                       = NOT_YET_AUTHORIZED
CODE_MUTATION                          = NOT_STARTED
PRODUCTION_MUTATION                    = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS        = NOT_READY
```
## Evidence Read

Current AutoMove schema already has operational source data candidates:

- `auto_bookings` stores `booking_number`, `total_price`, `deposit_amount`, `deposit_paid`, `payment_status`, business `status`, and optional `accounting_entry_id` in `supabase/migrations/20260803240000_create_auto_leads_bookings.sql`.
- `auto_vehicles` stores `list_price`, `cost_price`, delivery fields, lifecycle `status`, and RLS in `supabase/migrations/20260803210000_create_auto_vehicles.sql`.
- `auto_deposits` stores booking-linked payment amount, payment method/date/reference, status, audit fields, RLS, and grants in `supabase/migrations/20260804310000_create_auto_deposits_tracking.sql`.

The existing policy and Finance primitives are useful but not sufficient by themselves:

- `policy_registry` exists with `policy_id`, semver `version`, `status`, optional `tenant_id`, `is_active`, effective/expiry dates, config, metadata, and unique `(policy_id, version)` in `supabase/migrations/20260701000001_create_policy_registry.sql`.
- `policy_registry` currently has a unique active index on `policy_id` only, not on `(tenant_id, policy_id)`. It can support a single global active AutoMove policy, but it is not proven suitable for tenant-specific active accounting policies without further schema review.
- `DefaultPolicyContextResolver` documents the correct principle of resolving policy by tenant and event timestamp, but its current implementation returns a default in-memory policy and leaves database loading as future work in `src/platform/finance/resolvers/policy-context-resolver.service.ts`.
- Accounting journal tables already protect posted entries from mutation and validate balanced postings in `supabase/migrations/20260524000000_accounting_core.sql`, but vehicle-sale ledger mapping remains unapproved.
- `accounting_outbox` has already been hardened to tenant/event/reference-scoped idempotency in `supabase/migrations/20260607023000_harden_accounting_outbox_idempotency.sql`. AutoMove should follow that principle for recognition idempotency, but should not reuse booking/deposit/package keys as vehicle-sale recognition keys.

Current gaps remain:

- There is no proven `sale_revenue_recognized` persistence object.
- There is no trusted AutoMove accounting policy resolver backed by approved policy state.
- There is no immutable vehicle sale recognition snapshot.
- There is no append-only adjustment/reversal object for recognized vehicle sales.
- `FinancialReportingService` and `WarrantyService` still remain held because the canonical financial source of truth is not implemented.

## Review Result By Condition

### 1. Trusted Policy Source

Status: `SCHEMA_SCOPE_REQUIRED`

The implementation must resolve `accounting_policy_id` and `accounting_policy_version` from a trusted source. Caller payload must not be authoritative.

Approved minimum:

- A resolver receives tenant, effective recognition timestamp, and AutoMove policy family id.
- It selects an approved/active policy version effective for that timestamp.
- It rejects missing, draft, future, expired, inactive, or ambiguous policies.
- It writes resolved policy id/version into the sale recognition snapshot.

Open schema decision:

- If Accounting Policy v1 is global across AutoMove tenants, existing `policy_registry` may be reused with a dedicated policy id such as `AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY`.
- If per-tenant active policy versions are required, existing `policy_registry` is not enough as-is because the active uniqueness constraint is global by `policy_id`. A minimal additive policy-assignment or AutoMove-specific policy table must be reviewed separately.

Not allowed:

- Trust `accounting_policy_version` from request payload.
- Use the current default in-memory Finance resolver as proof of approved policy state.
- Build a broad policy engine before the narrow AutoMove policy storage requirement is proven insufficient.

### 2. Historical Immutability

Status: `ADDITIVE_SCHEMA_REQUIRED`

AutoMove needs an immutable recognized-sale snapshot. Existing mutable booking, deposit, and vehicle rows are candidate inputs, not historical reporting truth.

Recommended minimum object:

`auto_vehicle_sale_recognitions`

Required properties:

- Tenant and sale transaction identity.
- Booking, vehicle, customer, and optional handover references.
- Resolved `accounting_policy_id` and `accounting_policy_version`.
- Recognition timestamp, actor, authority/evidence reference, and recognition basis.
- Snapshot of recognized sale price, discount amount, approved price adjustments, currency, tax-separated fields when applicable, deposits received, payments received, and receivable amount at recognition.
- Snapshot of `cost_basis_at_sale`, cost basis source, and cost-basis component summary under approved Accounting Policy v1.
- Optional warranty entitlement reference or warranty snapshot fields if the approved policy requires them for reporting or entitlement proof.
- Status field that cannot be used to rewrite financial facts after recognition.

Required protection:

- No update path may mutate recognized sale price, cost basis, policy id/version, core evidence references, tenant, vehicle, booking, customer, or transaction identity after recognition.
- Historical reports must read the recognition snapshot and linked adjustments, not current `auto_vehicles.cost_price`, current booking totals, or claim rows.

Not allowed:

- Use current `auto_vehicles.cost_price` as historical profit source after recognition.
- Use `auto_bookings.total_price` as automatic recognized revenue without approved recognition command validation.
- Create `auto_sales` only to satisfy legacy service queries.

### 3. Idempotency and Reversal

Status: `ADDITIVE_SCHEMA_REQUIRED`

Initial recognition and later corrections need separate identities.

Recommended minimum:

- Persist a canonical `sale_transaction_id` or recognition business key.
- Enforce one initial recognition per `(tenant_id, sale_transaction_id)`.
- Store a separate idempotency key for the initial recognition command.
- Retry with the same key returns the existing recognition result or fails closed without duplicate financial effect.

Adjustment/reversal object:

`auto_vehicle_sale_recognition_adjustments`

Required properties:

- Tenant and original `recognition_id`.
- Adjustment or reversal type.
- Separate adjustment idempotency key.
- Reason, actor, timestamp, evidence reference, affected accounting period, and policy id/version.
- Amount deltas or reversal effect fields, without editing the original recognition snapshot.

Required protection:

- Reversal/adjustment cannot delete or overwrite the original recognition.
- Closed-period behavior remains blocked until accounting approval defines it.
- Adjustment and reversal keys must not collide with booking, deposit, payment, handover, package sale, or initial recognition keys.

Not allowed:

- Reuse `booking_id` or `deposit_id` as the sole sale recognition identity.
- Reuse `PACKAGE_SALE` for vehicle sale revenue.
- Post ledger entries for TK 511, COGS, customer advances, refunds, or reversals until Finance/accounting mapping is separately approved.

## Recommended Minimal Implementation Boundary

The smallest future implementation scope, if separately authorized, should be:

1. Add trusted policy resolution for AutoMove Accounting Policy v1.
2. Add immutable vehicle-sale recognition persistence.
3. Add append-only adjustment/reversal persistence or explicitly block adjustment/reversal commands until the table exists.
4. Add an application command boundary such as `recognizeVehicleSaleRevenue` that validates tenant consistency, authority, handover evidence, resolved policy, sale amount snapshot, cost-basis snapshot, and idempotency.
5. Keep ledger posting behind a `NOT_AUTHORIZED` boundary until ledger account mapping is approved.
6. Keep `FinancialReportingService` migration held until recognition persistence exists and Real DB tests prove reports read the canonical snapshot.
7. Keep `WarrantyService` migration held until warranty entitlement source is approved or recognition snapshot explicitly carries the required entitlement fields.

## Required Non-Production Verification

Before any implementation can be sealed, the following must pass on a non-Production database:

- Trusted resolver rejects caller-supplied or unapproved policy versions.
- Active policy is resolved by tenant/effective timestamp according to the approved storage model.
- Recognition stores policy id/version and immutable financial snapshots.
- Later policy changes do not alter historical recognition.
- Later `auto_vehicles.cost_price` changes do not alter historical gross profit.
- Booking, deposit, payment, handover, and invoice events do not independently create recognized sale revenue.
- Duplicate recognition is denied or returns the existing recognition without duplicate financial effect.
- Adjustment/reversal references original recognition and does not mutate original snapshot.
- Cross-tenant recognition, policy resolution, and readback are denied by RLS.
- Existing sealed AutoMove producer behavior remains intact: booking/deposit flow does not emit `PACKAGE_SALE`.

## Authorization Required Before Migration

Do not implement until a separate authorization explicitly approves:

```ini
TRUSTED_POLICY_STORAGE_MODEL       = REQUIRED
RECOGNITION_TABLE_SCHEMA           = REQUIRED
ADJUSTMENT_REVERSAL_TABLE_SCHEMA   = REQUIRED
RLS_AND_GRANTS_SCOPE               = REQUIRED
RECOGNITION_COMMAND_BOUNDARY       = REQUIRED
NON_PRODUCTION_REAL_DB_TEST_PLAN   = REQUIRED
LEDGER_POSTING_SCOPE               = NOT_AUTHORIZED
PRODUCTION_MUTATION                = NOT_AUTHORIZED
```

## Final Status

```ini
SCHEMA_AND_IMPLEMENTATION_SCOPE_REVIEW = COMPLETE
RECOMMENDED_NEXT_BATCH                 = ADDITIVE_SCHEMA_AUTHORIZATION_REVIEW
CODE_MUTATION                          = NOT_STARTED
SCHEMA_MIGRATION                       = NOT_YET_AUTHORIZED
FINANCIAL_REPORTING_SERVICE            = HELD
WARRANTY_SERVICE_MIGRATION             = HELD
PRODUCTION_MUTATION                    = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS        = NOT_READY
```
