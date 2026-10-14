# AutoMove Financial Source Of Truth Review

Date: 2026-10-14
Reviewed artifact: `docs/architecture/AUTOMOVE_FINANCIAL_SOURCE_OF_TRUTH_PROPOSAL_2026_10_14.md`
Review result: CHANGES_REQUIRED
Implementation authorization: NOT_GRANTED

## Review Scope

This review checks whether the proposed AutoMove financial business contract is ready to be approved as the canonical source of truth for later schema and service implementation.

No schema, migration, runtime service, or Production change is authorized by this review.

## Evidence Checked

- Proposal artifact created on 2026-10-14 and revised to reflect the four review decision groups.
- Bella engineering constitution business semantic gate.
- Current repository evidence on `platform/main` for bookings, deposits, vehicle delivery, warranty validation, analytics RPCs, and financial reporting.
- P0 `PACKAGE_SALE` trace on `platform/main`: AutoMove producer, accounting outbox idempotency, accounting worker payload contract, `RevenueRecognitionService.handlePackageSale`, and accounting reports.
- Official public metadata for Thong tu 99/2025/TT-BTC: issued 2025-10-27, effective 2026-01-01.

## Result By Review Gate

| Gate | Result | Finding |
| --- | --- | --- |
| Revenue recognition | CONFLICT_CONFIRMED | Proposal correctly separates booking, deposit, payment, handover, and revenue recognition. P0 trace confirmed the pre-fix AutoMove `PACKAGE_SALE` producer contract failed the accounting worker shape and valid `PACKAGE_SALE` posts to `3387` deferred revenue rather than direct `511` revenue. The main migration set includes idempotency hardening, but target runtime must prove it before relying on it. |
| Sale-time cost basis | PARTIAL | Proposal correctly requires `cost_basis_at_sale` and rejects mutable current `cost_price` as historical proof. It still needs a canonical rule for deriving/snapshotting cost basis. |
| Cancellation, refund, adjustment | PARTIAL | Proposal correctly requires append-only adjustment/reversal facts. It still needs approved state transitions and financial effects for pre-recognition cancellation, post-recognition reversal, partial refund, and price adjustment. |
| Warranty entitlement | PARTIAL | Proposal correctly rejects stale `auto_sales` as warranty source and requires warranty entitlement on the recognized sale contract. It still needs approved rules for warranty start, end, mileage limit, and exceptions. |

## Required Changes Before Approval

### P0. `PACKAGE_SALE` Producer And Revenue Semantics

The review now has enough evidence to classify the pre-fix AutoMove `PACKAGE_SALE` semantics as a confirmed conflict, not merely missing documentation.

Confirmed evidence:

- Pre-fix `AutoSalesProvider.createBooking` emitted `PACKAGE_SALE` with `referenceType = BOOKING` and `referenceId = booking.id`.
- Pre-fix `AutoSalesProvider.recordDepositPayment` emitted `PACKAGE_SALE` with `referenceType = REVENUE` and the same booking id as `referenceId` when required deposit is fully paid.
- The deposit payload contains `depositAmount` / `amountPaid`, but the accounting worker requires `totalAmount` and `description`.
- The canonical package-sale helper expects a revenue id and payload fields matching the worker contract.
- When a `PACKAGE_SALE` event is valid, `RevenueRecognitionService.handlePackageSale` posts debit cash/bank and credit `3387` unearned revenue, not direct `511` revenue.
- Gross revenue reporting reads posted journal lines where account code starts with `511`.
- The original accounting outbox uniqueness constraint was `(event_type, reference_id)`, but `20260607023000_harden_accounting_outbox_idempotency.sql` hardens the canonical migration to `(tenant_id, event_type, reference_type, reference_id)` and returns the existing outbox id on duplicate enqueue. Target runtime must still prove that hardening is applied before relying on it.

Review status:

```ini
PACKAGE_SALE_PRODUCER_CONTRACT      = FAIL_CONFIRMED_PRE_FIX
PACKAGE_SALE_LEDGER_IMPACT          = PROVEN_AS_3387_DEFERRED_REVENUE_WHEN_VALID
PACKAGE_SALE_DIRECT_511_REVENUE     = NOT_PROVEN
OUTBOX_IDEMPOTENCY_FOR_DEPOSIT      = HARDENING_EXISTS_ON_MAIN_VERIFY_RUNTIME_BEFORE_RELYING
DEPOSIT_FULL_PAYMENT_REVENUE        = NOT_ALLOWED
OWNER_P0_PACKAGE_SALE_MEANING       = APPROVED
```

Owner P0 decision:

```ini
OWNER_DECISION_P0                       = APPROVED
PAYMENT_RECEIVED_SEPARATE_FROM_REVENUE = APPROVED
PACKAGE_SALE_FOR_VEHICLE_REVENUE       = NOT_ALLOWED_WITHOUT_APPROVED_CONTRACT
OUTBOX_IDEMPOTENCY_FIX                 = APPROVED_IN_SCOPE
```

Scoped implementation may remove invalid AutoMove `PACKAGE_SALE` producer emissions and prevent booking/deposit updates from masquerading as vehicle revenue. It still may not introduce schema, mutate Production, or migrate `FinancialReportingService`.

```ini
AUTOMOVE_PACKAGE_SALE_PRODUCER_FIX = REVIEWED_LOCAL_PENDING_PR
DEPOSIT_STATUS_UPDATE              = PROVEN_BY_UNIT
AUTO_DEPOSITS_ROUTE_PATH           = UNCHANGED_BY_BATCH
DEPOSIT_TRANSACTION_RECORD_IN_PROVIDER = NOT_PRESENT_PRE_FIX
E2E_PRODUCER_FLOW                  = NOT_EXECUTABLE_ON_CURRENT_E2E_SCHEMA
```

### 1. Revenue Recognition Criteria

The contract must define the exact command and minimum evidence required to emit `sale_revenue_recognized`.

Minimum required decisions:

- Which workflow command confirms the recognition event.
- Required booking states before recognition.
- Required vehicle lifecycle state and handover evidence.
- Required revenue amount source.
- Required actor/role or system authority.
- Whether `auto_bookings.status = completed` is a derived state, an input state, or no longer authoritative for revenue.

Recommended direction:

`sale_revenue_recognized` should be emitted only by an explicit financial recognition command after validating handover evidence, recognized sale price, cost basis, customer/vehicle/booking linkage, and tenant boundary.

### 2. Cost Basis Rule

The contract must define how `cost_basis_at_sale` is produced.

Minimum required decisions:

- Source column or upstream contract for base cost.
- Whether transport, registration, refurbishment, warranty reserve, trade-in, discount, or accessory cost is included.
- What happens if current `auto_vehicles.cost_price` changes after recognition.
- Whether cost basis can be adjusted after recognition, and through which event.

Recommended direction:

Persist a sale-time snapshot. Reports must read `cost_basis_at_sale`, not current vehicle inventory cost.

### 3. Cancellation / Refund / Adjustment State Machine

The contract must define lifecycle and effects for:

- Booking cancelled before revenue recognition.
- Deposit refunded before revenue recognition.
- Sale reversed after revenue recognition.
- Partial refund after revenue recognition.
- Sale price adjustment after recognition.
- Warranty entitlement voided or preserved after reversal.

Recommended direction:

Original recognition events should remain immutable. Corrections should be represented as explicit adjustment or reversal events with actor, reason, timestamp, evidence, and idempotency key.

### 4. Warranty Entitlement

The contract must define warranty entitlement source and linkage.

Minimum required decisions:

- Whether warranty terms are copied into the recognized sale event.
- Whether warranty start is handover date, recognition date, invoice date, or another contract date.
- How mileage limit is sourced.
- Whether warranty terms can be adjusted, voided, or transferred.
- How `WarrantyService.validateWarrantyCoverage` should query the canonical entitlement after implementation.

Recommended direction:

Warranty validation should use the approved sale/warranty entitlement contract, not `auto_sales`.

## Non-Blocking Strengths

- The proposal correctly blocks stale `FinancialReportingService` migration.
- It correctly avoids creating `auto_sales` solely to satisfy current stale queries.
- It preserves separation between deposit/payment, revenue recognition, receivable, and tax/invoice concerns.
- It assigns vehicle identity/display to Mobility OS and accounting posting mechanics to Finance OS.

## Revision Reflection

The proposal now reflects the four required decision groups as contract principles plus explicit `NOT_PROVEN` items.

| Review requirement | Reflected in proposal | Approval status |
| --- | --- | --- |
| Revenue recognition criteria | YES | Still needs evidence for command, states, amount source, actor authority, and `completed` semantic. |
| Cost basis rule | YES | Still needs evidence for base source, included cost components, and adjustment event. |
| Cancellation/refund/adjustment lifecycle | YES | Still needs evidence for cancellation, refund, reversal, adjustment, warranty-after-reversal, and authority rules. |
| Warranty entitlement | YES | Still needs evidence for warranty source, start date, mileage source, adjustment, void/transfer, and service query contract. |
| P0 `PACKAGE_SALE` semantics | YES | Owner decision recorded: deposit/full payment is payment/customer-advance candidate, not vehicle sale revenue; `PACKAGE_SALE` cannot be reused for vehicle revenue without an approved contract. |

## Remaining Decisions Pending Confirmation

```ini
REVENUE_RECOGNITION_COMMAND        = NOT_PROVEN
REQUIRED_BOOKING_STATE             = NOT_PROVEN
REQUIRED_HANDOVER_EVIDENCE         = NOT_PROVEN
REVENUE_AMOUNT_SOURCE              = CANDIDATE_auto_bookings.total_price_NOT_PROVEN
RECOGNITION_ACTOR_AUTHORITY        = NOT_PROVEN
AUTO_BOOKINGS_COMPLETED_SEMANTIC   = NOT_PROVEN
PACKAGE_SALE_PRODUCER_CONTRACT     = FAIL_CONFIRMED_PRE_FIX
AUTOMOVE_PACKAGE_SALE_PRODUCER_FIX = REVIEWED_LOCAL_PENDING_PR
DEPOSIT_STATUS_UPDATE              = PROVEN_BY_UNIT
AUTO_DEPOSITS_ROUTE_PATH           = UNCHANGED_BY_BATCH
DEPOSIT_TRANSACTION_RECORD_IN_PROVIDER = NOT_PRESENT_PRE_FIX
E2E_PRODUCER_FLOW                  = NOT_EXECUTABLE_ON_CURRENT_E2E_SCHEMA
PACKAGE_SALE_LEDGER_IMPACT         = PROVEN_AS_3387_DEFERRED_REVENUE_WHEN_VALID
PACKAGE_SALE_DIRECT_511_REVENUE    = NOT_PROVEN
OUTBOX_IDEMPOTENCY_FOR_DEPOSIT     = HARDENING_EXISTS_ON_MAIN_VERIFY_RUNTIME_BEFORE_RELYING
OWNER_P0_PACKAGE_SALE_MEANING      = APPROVED
PAYMENT_RECEIVED_SEPARATE_FROM_REVENUE = APPROVED
PACKAGE_SALE_FOR_VEHICLE_REVENUE   = NOT_ALLOWED_WITHOUT_APPROVED_CONTRACT

COST_BASIS_BASE_SOURCE             = NOT_PROVEN
INCLUDE_TRANSPORT_COST             = NOT_PROVEN
INCLUDE_REGISTRATION_COST          = NOT_PROVEN
INCLUDE_REFURBISHMENT_COST         = NOT_PROVEN
INCLUDE_WARRANTY_RESERVE           = NOT_PROVEN
INCLUDE_TRADE_IN_IMPACT            = NOT_PROVEN
INCLUDE_DISCOUNTS_OR_ACCESSORIES   = NOT_PROVEN
COST_BASIS_ADJUSTMENT_EVENT        = NOT_PROVEN

PRE_RECOGNITION_BOOKING_CANCEL_RULE = NOT_PROVEN
PRE_RECOGNITION_DEPOSIT_REFUND_RULE = NOT_PROVEN
POST_RECOGNITION_REVERSAL_RULE      = NOT_PROVEN
POST_RECOGNITION_PARTIAL_REFUND     = NOT_PROVEN
SALE_PRICE_ADJUSTMENT_RULE          = NOT_PROVEN
WARRANTY_AFTER_REVERSAL_RULE        = NOT_PROVEN
REVERSAL_OR_ADJUSTMENT_AUTHORITY    = NOT_PROVEN

WARRANTY_TERMS_SOURCE               = NOT_PROVEN
WARRANTY_TERMS_COPIED_TO_SALE_EVENT = NOT_PROVEN
WARRANTY_START_DATE_RULE            = NOT_PROVEN
WARRANTY_MILEAGE_LIMIT_SOURCE       = NOT_PROVEN
WARRANTY_ADJUSTMENT_RULE            = NOT_PROVEN
WARRANTY_VOID_OR_TRANSFER_RULE      = NOT_PROVEN
WARRANTY_SERVICE_QUERY_CONTRACT     = NOT_PROVEN
```

## Decision

```ini
BUSINESS_CONTRACT_REVIEW_RESULT       = CHANGES_REQUIRED
AUTOMOVE_FINANCIAL_SOURCE_OF_TRUTH    = HELD_PENDING_CONTRACT_REVISION
OWNER_DECISION_P0                     = APPROVED
PACKAGE_SALE_PRODUCER_CONTRACT        = FAIL_CONFIRMED_PRE_FIX
AUTOMOVE_PACKAGE_SALE_PRODUCER_FIX    = REVIEWED_LOCAL_PENDING_PR
DEPOSIT_STATUS_UPDATE                 = PROVEN_BY_UNIT
AUTO_DEPOSITS_ROUTE_PATH              = UNCHANGED_BY_BATCH
DEPOSIT_TRANSACTION_RECORD_IN_PROVIDER = NOT_PRESENT_PRE_FIX
E2E_PRODUCER_FLOW                     = NOT_EXECUTABLE_ON_CURRENT_E2E_SCHEMA
PACKAGE_SALE_FOR_VEHICLE_REVENUE      = NOT_ALLOWED_WITHOUT_APPROVED_CONTRACT
REVENUE_SEMANTICS                     = CONFLICT_CONFIRMED
SCHEMA_MIGRATION                      = NOT_AUTHORIZED
FINANCIAL_REPORTING_SERVICE_MIGRATION = NOT_AUTHORIZED
PRODUCTION_MUTATION                   = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS       = NOT_READY
```

## Next Required Action

Finalize only the approved P0 producer batch:

1. Commit and open PR for the reviewed local P0 producer fix only.
2. Verify remote CI on the PR branch before any merge decision.
3. Keep schema, `FinancialReportingService`, warranty entitlement, cost basis, and Production out of scope until separately approved.
