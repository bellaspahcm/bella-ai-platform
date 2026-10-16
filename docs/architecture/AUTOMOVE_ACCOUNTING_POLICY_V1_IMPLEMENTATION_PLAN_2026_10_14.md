# AutoMove Accounting Policy v1 Minimal Implementation Plan

Date: 2026-10-14
Scope: implementation planning only

## Decision

The proposed AutoMove Accounting Policy v1 defaults are approved for implementation planning within a limited scope.

```ini
APPROVAL_SCOPE                     = ACCOUNTING_POLICY_V1_PROPOSED_DEFAULTS
ACCOUNTING_POLICY_V1               = APPROVED_FOR_IMPLEMENTATION
TRUSTED_POLICY_RESOLUTION          = REQUIRED
HISTORICAL_POLICY_IMMUTABILITY     = REQUIRED
BUSINESS_CONTRACT_APPROVED         = LIMITED_TO_APPROVED_SCOPE
SCHEMA_MIGRATION                   = NOT_YET_AUTHORIZED
PRODUCTION_MUTATION                = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS    = NOT_READY
```

This approval does not replace required business/accounting governance approval for official accounting policy adoption. It authorizes the implementation design to protect policy versioning, immutable history, and trusted policy resolution when schema/code work is separately authorized.

## Contract Check

The current contract is sufficient to plan the minimal implementation because it already defines:

1. `accounting_policy_id` and `accounting_policy_version` on the recognized sale payload.
2. Trusted policy resolution as required.
3. Historical policy immutability as required.
4. Append-only adjustment/reversal events referencing the original `recognition_id`.
5. Separation between booking, deposit, payment, handover, invoice, and revenue recognition.
6. Rejection of `PACKAGE_SALE` as vehicle sale revenue.

Remaining unapproved items:

```ini
OFFICIAL_ACCOUNTING_POLICY_APPROVAL = NOT_PROVEN
LEDGER_ACCOUNT_MAPPING              = NOT_PROVEN
SCHEMA_MIGRATION                    = NOT_YET_AUTHORIZED
PRODUCTION_MUTATION                 = NOT_AUTHORIZED
```

## Minimal Implementation Shape

### Slice 1. Trusted policy source

Goal: make approved accounting policies resolvable from a trusted repository-owned or database-owned source, not from untrusted request payload.

Minimum behavior:

- A recognition command receives business evidence, not a trusted policy version chosen by the caller.
- The application resolves the active approved policy by tenant, policy id, effective date, and policy status.
- The resolver must reject missing, inactive, future, expired, or unapproved policy versions.
- The selected policy id/version is written to the recognition snapshot.

Implementation must not accept `accounting_policy_version` from request payload as authoritative.

### Slice 2. Recognition snapshot immutability

Goal: once recognition succeeds, sale amount, cost basis, policy version, and evidence references are immutable.

Minimum behavior:

- Initial recognition writes a complete snapshot.
- Update paths cannot mutate recognized financial facts.
- Corrections use adjustment or reversal records referencing the original `recognition_id`.
- Historical reports read the stored snapshot and linked adjustments, not current vehicle cost or mutable booking data.

### Slice 3. Idempotent initial recognition

Goal: prevent duplicate recognition for the same vehicle sale transaction.

Minimum behavior:

- A canonical sale transaction identity is required.
- One initial recognition can exist per tenant and sale transaction.
- `bookingId` and `depositId` are supporting references, not standalone sale identities.
- Retry with the same idempotency key returns the existing recognition result or fails closed without duplicate financial effect.

### Slice 4. Adjustment and reversal boundary

Goal: preserve history and make corrections auditable.

Minimum behavior:

- Adjustment and reversal events require reason, actor, timestamp, evidence reference, affected period, and original `recognition_id`.
- Adjustments use separate idempotency keys.
- Closed-period correction behavior remains blocked until accounting approval defines it.

### Slice 5. Contract-aware verification

Goal: prove the implementation respects the accounting boundary.

Required non-Production tests:

- Caller-provided `accounting_policy_version` is ignored or rejected unless it matches trusted resolution rules.
- Unapproved policy version cannot be used.
- Recognized sale stores policy id and version.
- Later policy changes do not alter historical recognition snapshots.
- Later `auto_vehicles.cost_price` changes do not alter historical gross profit.
- Deposit, payment, handover, and invoice events do not create recognized sale revenue by themselves.
- Duplicate recognition is denied or idempotently returns the existing result.
- Adjustment/reversal references original `recognition_id` and does not mutate original snapshot.
- Cross-tenant recognition and policy resolution are denied.

## Explicit Non-Goals

- Do not create or apply schema migration in this planning batch.
- Do not implement recognition code in this planning batch.
- Do not migrate `FinancialReportingService` or `WarrantyService`.
- Do not implement ledger account mapping.
- Do not implement tax invoice rules.
- Do not mutate Production.
- Do not build a broad policy engine beyond the v1 requirements.

## Required Authorization Before Coding

Before code or migration work starts, record a separate implementation authorization covering:

1. Additive schema target and RLS/grants scope.
2. Trusted policy storage source.
3. Sale transaction identity storage.
4. Recognition command boundary.
5. Adjustment/reversal storage and mutation rules.
6. Non-Production Real DB verification plan.

If schema authorization is not granted, implementation must remain held.

## Recommended Minimal Next Batch

```ini
NEXT_BATCH = SCHEMA_AND_IMPLEMENTATION_SCOPE_REVIEW
CODE_MUTATION = NOT_STARTED
SCHEMA_MIGRATION = NOT_YET_AUTHORIZED
PRODUCTION_MUTATION = NOT_AUTHORIZED
```

The next batch should decide the minimal additive schema and command boundary. It should not implement a generic accounting policy engine unless the approved schema review proves that a simpler policy table plus resolver is insufficient.
