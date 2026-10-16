# AutoMove Financial Source Of Truth Proposal

Date: 2026-10-14
Status: HELD_PENDING_CANONICAL_CONTRACT_APPROVAL_AFTER_P0_FIX
Scope: Business contract proposal plus P0 producer fix and vehicle sale revenue contract status

## Decision Summary

AutoMove does not yet have a proven canonical financial source of truth for vehicle sale revenue, sale-time cost basis, receivables, refunds, and warranty entitlement.

Do not migrate `FinancialReportingService` yet. Do not create `auto_sales` just because stale consumers currently query it. Do not treat booking completion, deposit collection, or full payment as sale revenue unless the revenue recognition contract below is satisfied.

Post-PR #318 update: the invalid AutoMove `PACKAGE_SALE` producer fix is proven on `main`, and the remaining gap is a missing canonical vehicle sale revenue recognition capability. The focused business contract draft is now recorded in `docs/architecture/AUTOMOVE_VEHICLE_SALE_REVENUE_CONTRACT_2026_10_14.md`.

## Evidence Basis

### Legal / Accounting Principle

Reference sources:

- Cong Bao / Government Gazette: Thong tu 99/2025/TT-BTC, issued 2025-10-27, effective 2026-01-01.
- Ministry of Finance Q&A referencing revenue recognition principles under Thong tu 99/2025/TT-BTC and VAS 14.

Revenue recognition for vehicle sales must follow the accounting principle that revenue is recognized only when the relevant revenue recognition conditions are satisfied, including transfer of substantial risks and benefits/control, reliable revenue measurement, expected economic benefit, and reliable cost measurement.

For AutoMove, this means:

- Booking creation is not revenue recognition.
- Deposit receipt is not revenue recognition.
- Full cash collection is not revenue recognition by itself.
- Vehicle handover is important evidence, but it is not sufficient alone if the sales contract, control transfer, revenue amount, and cost basis are not established.
- Invoice/tax timing must be handled separately from accounting revenue recognition.

### Repository Evidence

Known current evidence on `main`:

- `auto_bookings.total_price` is documented as negotiated sale price.
- `auto_bookings.deposit_amount` and `deposit_paid` track deposit requirements and paid deposit.
- `auto_deposits` tracks deposit payment history.
- Analytics RPCs currently use `auto_bookings.status = 'completed'` and `auto_vehicles.status = 'delivered'` as sales/revenue signals.
- `VehicleAllocationService.confirmDelivery` transitions the vehicle to `delivered`, but does not establish a financial recognition event.
- `FinancialReportingService` queries stale `auto_sales` / `purchase_price` / `make` / `model` fields that are not proven in the E2E schema or generated types.
- `WarrantyService.validateWarrantyCoverage` still expects warranty terms from stale `auto_sales`.

### P0 `PACKAGE_SALE` Trace Evidence

The pre-fix AutoMove producer was not contract-compatible with the accounting worker and did not prove vehicle sale revenue recognition.

Repository evidence on `platform/main`:

- Pre-fix `src/modules/bella-auto/services/AutoSalesProvider.ts:109-123` enqueued `PACKAGE_SALE` at booking creation with `referenceType = BOOKING`, `referenceId = booking.id`, and payload fields such as `totalPrice` and `depositAmount`.
- `src/modules/bella-auto/services/AutoSalesProvider.ts:188-200` marks a booking `confirmed` when paid deposit reaches required deposit amount.
- Pre-fix `src/modules/bella-auto/services/AutoSalesProvider.ts:222-235` then enqueued another `PACKAGE_SALE` with `referenceType = REVENUE`, `referenceId = bookingId`, and payload fields `depositAmount` / `amountPaid`. The payload did not include the accounting worker's required `totalAmount` or `description`.
- `src/lib/business-rules/accounting-outbox.ts:14-35` shows the canonical helper shape for package-sale accounting events: `referenceType = REVENUE`, `referenceId = revenueId`, payload `totalAmount`, `vatRate`, `paymentMethod`, `description`, and `branchId`.
- `src/app/api/cron/accounting-worker/route.ts:178-197` requires typed payload fields and throws when required number/string fields are missing.
- `src/app/api/cron/accounting-worker/route.ts:823-832` routes `PACKAGE_SALE` to `RevenueRecognitionService.handlePackageSale` using `totalAmount`, `paymentMethod`, and `description`.
- `src/services/revenue-recognition.ts:54-93` posts valid `PACKAGE_SALE` as cash/bank debit and `3387` unearned revenue credit, with optional VAT; it does not post directly to account `511`.
- `supabase/migrations/20260525150000_accounting_reports.sql:153-161` calculates gross revenue from posted journal lines where `account_code LIKE '511%'`.
- `supabase/migrations/20260525130000_accounting_outbox.sql:56-58` originally made outbox idempotency unique on `(event_type, reference_id)`, and `:121-124` returned `NULL` on conflict. `supabase/migrations/20260607023000_harden_accounting_outbox_idempotency.sql` later hardened this to `(tenant_id, event_type, reference_type, reference_id)` and returns the existing outbox id on duplicate enqueue.
- `src/app/api/cron/accounting-worker/route.ts:938-960` triggers MISA `sync_invoice` after a successful `PACKAGE_SALE` journal, but invoice/tax timing remains separate from accounting revenue recognition.

P0 conclusion:

```ini
PACKAGE_SALE_PRODUCER_CONTRACT      = FAIL_CONFIRMED_PRE_FIX
PACKAGE_SALE_LEDGER_IMPACT          = PROVEN_AS_3387_DEFERRED_REVENUE_WHEN_VALID
PACKAGE_SALE_DIRECT_511_REVENUE     = NOT_PROVEN
OUTBOX_IDEMPOTENCY_FOR_DEPOSIT      = HARDENING_EXISTS_ON_MAIN_VERIFY_RUNTIME_BEFORE_RELYING
DEPOSIT_FULL_PAYMENT_REVENUE        = NOT_ALLOWED
OWNER_P0_PACKAGE_SALE_MEANING       = APPROVED
```

This evidence blocks any assumption that fully paid deposit equals recognized vehicle sale revenue. It also blocks fixing the producer mechanically until the owner decides whether AutoMove `PACKAGE_SALE` represents `payment_received` / customer advance or `sale_revenue_recognized`.

Owner P0 decision recorded after review:

```ini
OWNER_DECISION_P0                       = APPROVED
PAYMENT_RECEIVED_SEPARATE_FROM_REVENUE = APPROVED
PACKAGE_SALE_FOR_VEHICLE_REVENUE       = NOT_ALLOWED_WITHOUT_APPROVED_CONTRACT
BOOKING_CREATION_ACCOUNTING_EVENT      = NOT_ALLOWED
DEPOSIT_FULL_PAYMENT_REVENUE           = NOT_ALLOWED
OUTBOX_IDEMPOTENCY_FIX                 = APPROVED_IN_SCOPE
```

Scoped implementation direction:

- Booking creation must not emit `PACKAGE_SALE`.
- Full deposit payment must not emit `PACKAGE_SALE` as vehicle sale revenue.
- Deposit/payment collection remains a `payment_received` / customer advance candidate until a canonical payment event contract is approved with source record, payment method, idempotency key, and ledger semantics.
- The producer must not rely on booking-time outbox side effects to represent financial recognition.
- Current scoped local implementation removes `PACKAGE_SALE` emission from AutoMove `createBooking` and `recordDepositPayment`; this is not a schema change and not a Production change.
- Local review confirmed the producer no longer emits `PACKAGE_SALE`, while deposit transaction persistence in `AutoSalesProvider` remains a pre-existing absence rather than a regression caused by this fix.

Known E2E read-only evidence:

- `auto_sales` is absent from the inspected E2E DB.
- `auto_bookings` and `auto_deposits` were not present in the inspected E2E DB, even though they exist in migrations and generated types.
- `auto_vehicles` has `list_price`, `cost_price`, delivery/allocation state, and catalog linkage.
- `purchase_price`, `make`, and `model` are not columns of `auto_vehicles`.

## Ownership

| Data / Contract | Owner | Notes |
| --- | --- | --- |
| Vehicle identity, VIN, catalog display, lifecycle state | Mobility OS | Product consumers should use the Mobility public contract for vehicle identity/display. |
| Booking, deposit, handover workflow facts | AutoMove Product | AutoMove owns the sales workflow event facts before accounting posting. |
| Sale revenue recognition decision | AutoMove Financial Contract | This contract determines when a sale is reportable as revenue. |
| Accounting posting / journal mapping | Finance OS | Finance owns posting mechanics and accounting outputs. No account-code mapping is approved by this proposal. |
| Tax invoice / tax revenue timing | Tax / Compliance contract | Out of scope for this proposal; must not be inferred from accounting recognition. |

## Canonical Event Contract

### `booking_created`

Creates the customer purchase intent / booking record.

Required meaning:

- A customer has selected or reserved a vehicle or variant.
- `total_price` may represent negotiated price for the booking.
- No accounting revenue is recognized.
- No cost basis is consumed.

### `deposit_received`

Records customer money received before sale revenue recognition.

Required meaning:

- A confirmed deposit/payment event exists.
- The amount contributes to cash received / customer advance / receivable settlement tracking.
- It does not itself recognize vehicle sale revenue.

### `vehicle_handover_confirmed`

Records operational delivery evidence.

Required meaning:

- The specific vehicle/VIN was handed over to the customer.
- The handover actor, timestamp, customer, vehicle, booking, and evidence metadata are recorded.
- This is necessary evidence for revenue recognition, but the financial recognition event must still validate the accounting conditions.

### `sale_revenue_recognized`

Canonical financial event for AutoMove vehicle sales reporting.

Required meaning:

- The sale has satisfied the approved revenue recognition conditions.
- Revenue amount is determined and snapshotted.
- Cost basis at the time of recognition is determined and snapshotted.
- Customer, booking, vehicle, handover evidence, and warranty entitlement are linked.
- The event is immutable or append-only with explicit adjustment/reversal events.

### `payment_received`

Records payment collection against a booking or recognized sale.

Required meaning:

- Payment collection reduces outstanding receivable or customer advance depending on sale state.
- It does not create duplicate revenue.

### `sale_cancelled`

Cancels a booking or sale workflow before revenue recognition, or initiates reversal handling after recognition.

Required meaning:

- Cancellation before `sale_revenue_recognized` must not create revenue.
- Cancellation after `sale_revenue_recognized` must use an approved adjustment/reversal event.

### `refund_issued`

Records money returned to the customer.

Required meaning:

- Refunds are payment/cash events.
- Revenue impact depends on whether revenue was recognized and whether an approved adjustment/reversal exists.

### `sale_revenue_adjusted`

Adjusts a previously recognized sale.

Required meaning:

- Adjustment reason, amount, original recognition, approver, and evidence are recorded.
- It does not mutate the original recognized sale silently.

## Contract Revision Decisions

This section records the minimum decisions required by the business contract review. It separates principles that can be locked now from business rules that remain `NOT_PROVEN`.

### 1. Revenue Recognition Criteria

Locked contract principles:

- `sale_revenue_recognized` must be emitted by an explicit financial recognition command, not implicitly by booking creation, deposit receipt, full payment, or vehicle delivery alone.
- The command must validate tenant boundary, booking linkage, customer linkage, vehicle linkage, handover evidence, recognized sale price, and cost basis before emitting the event.
- `auto_bookings.status = 'completed'` is not authoritative for revenue until its business meaning and transition path are proven. It may become a derived state after recognition, but that is not approved yet.
- `auto_bookings.total_price` is only a repository candidate for negotiated sale price. The recognized revenue amount must be snapshotted into the recognized sale event.
- Current AutoMove `PACKAGE_SALE` emission is not approved as a vehicle sale revenue recognition event. The producer contract is incompatible with the accounting worker, and a valid `PACKAGE_SALE` currently posts to deferred revenue `3387`, not directly to P&L revenue account `511`.
- Deposit receipt and full deposit payment must remain `payment_received` / customer advance candidates until the owner explicitly approves a separate `sale_revenue_recognized` command and evidence contract.

Decisions still requiring evidence:

```ini
REVENUE_RECOGNITION_COMMAND        = NOT_PROVEN
REQUIRED_BOOKING_STATE             = NOT_PROVEN
REQUIRED_HANDOVER_EVIDENCE         = NOT_PROVEN
REVENUE_AMOUNT_SOURCE              = CANDIDATE_auto_bookings.total_price_NOT_PROVEN
RECOGNITION_ACTOR_AUTHORITY        = NOT_PROVEN
AUTO_BOOKINGS_COMPLETED_SEMANTIC   = NOT_PROVEN
PACKAGE_SALE_PRODUCER_CONTRACT     = FAIL_CONFIRMED_PRE_FIX
AUTOMOVE_PACKAGE_SALE_PRODUCER_FIX = PROVEN_ON_MAIN
REVENUE_RECOGNITION_CAPABILITY     = GAP_CONFIRMED_BY_REPO_TRACE
VEHICLE_SALE_REVENUE_CONTRACT      = DESIGN_DRAFT_PENDING_OWNER_ACCOUNTING_APPROVAL
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
```

### 2. Cost Basis Rule

Locked contract principles:

- Historical profit reporting must use `cost_basis_at_sale`, persisted at revenue recognition time.
- Current `auto_vehicles.cost_price` must not be used to recompute historical profit after recognition.
- Any post-recognition cost correction must be represented by an explicit adjustment event linked to the original recognized sale.

Decisions still requiring evidence:

```ini
COST_BASIS_BASE_SOURCE             = NOT_PROVEN
INCLUDE_TRANSPORT_COST             = NOT_PROVEN
INCLUDE_REGISTRATION_COST          = NOT_PROVEN
INCLUDE_REFURBISHMENT_COST         = NOT_PROVEN
INCLUDE_WARRANTY_RESERVE           = NOT_PROVEN
INCLUDE_TRADE_IN_IMPACT            = NOT_PROVEN
INCLUDE_DISCOUNTS_OR_ACCESSORIES   = NOT_PROVEN
COST_BASIS_ADJUSTMENT_EVENT        = NOT_PROVEN
```

### 3. Cancellation / Refund / Adjustment

Locked contract principles:

- Cancellation before `sale_revenue_recognized` must not create vehicle sale revenue.
- Refunds are payment/cash events first; their revenue effect depends on whether revenue has already been recognized.
- Recognized financial events must not be deleted or silently mutated.
- Reversal and adjustment events must reference the original recognized sale and record reason, actor, timestamp, evidence, and financial effect.
- Warranty entitlement is not automatically voided by every reversal or refund; the result must follow the approved sale/warranty terms.

Decisions still requiring evidence:

```ini
PRE_RECOGNITION_BOOKING_CANCEL_RULE = NOT_PROVEN
PRE_RECOGNITION_DEPOSIT_REFUND_RULE = NOT_PROVEN
POST_RECOGNITION_REVERSAL_RULE      = NOT_PROVEN
POST_RECOGNITION_PARTIAL_REFUND     = NOT_PROVEN
SALE_PRICE_ADJUSTMENT_RULE          = NOT_PROVEN
WARRANTY_AFTER_REVERSAL_RULE        = NOT_PROVEN
REVERSAL_OR_ADJUSTMENT_AUTHORITY    = NOT_PROVEN
```

### 4. Warranty Entitlement

Locked contract principles:

- Warranty entitlement must have a canonical source linked to the recognized sale.
- Warranty validation must not read stale `auto_sales`.
- Warranty validation must not infer entitlement from claim rows or current vehicle display data.
- The recognized sale contract should carry or link to the warranty terms used for the sale.

Decisions still requiring evidence:

```ini
WARRANTY_TERMS_SOURCE               = NOT_PROVEN
WARRANTY_TERMS_COPIED_TO_SALE_EVENT = NOT_PROVEN
WARRANTY_START_DATE_RULE            = NOT_PROVEN
WARRANTY_MILEAGE_LIMIT_SOURCE       = NOT_PROVEN
WARRANTY_ADJUSTMENT_RULE            = NOT_PROVEN
WARRANTY_VOID_OR_TRANSFER_RULE      = NOT_PROVEN
WARRANTY_SERVICE_QUERY_CONTRACT     = NOT_PROVEN
```

## Minimum Data Contract For `sale_revenue_recognized`

The eventual persisted contract should include, at minimum:

| Field | Purpose |
| --- | --- |
| `tenant_id` | Tenant isolation boundary. |
| `recognition_id` | Stable identifier for the recognized sale event. |
| `booking_id` | Link to the booking / sales agreement. |
| `vehicle_id` | Link to the delivered VIN. |
| `customer_id` | Customer receiving the vehicle. |
| `recognized_at` | Revenue recognition timestamp. |
| `recognized_by` | Actor/system that confirmed recognition. |
| `recognition_basis` | Evidence summary for accounting conditions. |
| `handover_confirmed_at` | Operational handover timestamp. |
| `handover_evidence` | Metadata/reference for handover proof. |
| `sale_price_recognized` | Revenue amount used for reports. |
| `cost_basis_at_sale` | Historical cost basis snapshot for profit reporting. |
| `currency` | Currency for monetary fields. |
| `deposit_received_total` | Deposit received up to recognition. |
| `receivable_amount_at_recognition` | Remaining amount due after recognized revenue and deposits/payments. |
| `payment_status_at_recognition` | Snapshot; not the source of revenue truth. |
| `warranty_start_date` | Warranty entitlement start. |
| `warranty_end_date` | Warranty entitlement end. |
| `warranty_mileage_limit` | Warranty entitlement mileage limit, if applicable. |
| `source_vehicle_cost_price` | Source value used to derive cost basis, for audit. |
| `status` | Recognized, adjusted, reversed, or voided. |
| `idempotency_key` | Prevent duplicate recognition for the same sale. |
| `created_at` / `updated_at` | Audit timestamps. |

## Required State Rules

1. A booking may move through deposit and fulfillment states without recognizing revenue.
2. A vehicle may be delivered without automatically creating reportable revenue unless the financial recognition command validates the required conditions.
3. A sale must not be recognized more than once for the same tenant, booking, and vehicle combination.
4. Revenue reports must read from recognized sale events, not from deposit totals, stale `auto_sales`, or raw booking status alone.
5. Profit reports must use `cost_basis_at_sale`, not mutable current `auto_vehicles.cost_price`.
6. Warranty validation must use recognized sale warranty entitlement, not stale `auto_sales`.
7. Cancellation and refund flows must preserve the original event and add explicit adjustment/reversal facts.
8. Finance/accounting postings may be emitted after recognition, but posting rules and account mappings require separate Finance approval.

## Proposed Reporting Boundary

After implementation approval, `FinancialReportingService` should read vehicle sale profitability from the recognized sale contract:

- vehicle sales revenue = sum of recognized sale revenue, adjusted by approved revenue adjustment events;
- vehicle count = count of recognized sale events, not delivered vehicles alone;
- gross profit = recognized revenue minus `cost_basis_at_sale`;
- vehicle display = Mobility public contract / catalog chain;
- deposits and receivables = separate payment/receivable metrics, not revenue.

Until then:

```ini
FINANCIAL_REPORTING_SERVICE = NOT_AUTHORIZED_FOR_MIGRATION
```

## Open Questions Before Schema Approval

1. What exact operational command confirms `vehicle_handover_confirmed`?
2. Which actor is authorized to execute `sale_revenue_recognized`?
3. What document/evidence is required for control transfer?
4. How is `cost_basis_at_sale` calculated when `auto_vehicles.cost_price` has changed over time?
5. Are discounts, accessories, registration fees, insurance, loan referral commissions, and trade-in handled inside or outside the recognized vehicle sale amount?
6. What are the approved cancellation/refund/reversal rules after recognition?
7. Which contract owns tax invoice timing and tax revenue treatment?
8. Should the persisted object be named `auto_sale_revenue_recognitions`, `auto_vehicle_sales`, or another approved domain name?
9. What canonical event, source record, payment method source, and idempotency key should represent AutoMove deposit `payment_received` without implying vehicle sale revenue?
10. If deposit/payment events later use accounting outbox, what runtime migration evidence proves the hardened tenant/event/reference-type/reference-id idempotency contract is applied in the target environment?

## Implementation Gate

No schema or service change is approved until the following are true:

```ini
BUSINESS_CONTRACT_APPROVED       = TRUE
SALE_COMPLETION_EVENT            = PROVEN
REVENUE_AMOUNT_SOURCE            = PROVEN
SALE_TIME_COST_BASIS             = PROVEN
WARRANTY_ENTITLEMENT_SOURCE      = PROVEN
CANCELLATION_REFUND_RULES        = PROVEN
FINANCE_POSTING_BOUNDARY         = PROVEN
```

## Verification Plan After Approval

When implementation is authorized, use a separate scoped batch:

1. Add the approved additive schema/contract.
2. Add RLS and tenant isolation tests.
3. Add idempotency tests for sale recognition.
4. Add deposit/payment separation tests.
5. Add cancellation/refund/adjustment tests.
6. Add warranty entitlement tests.
7. Update `FinancialReportingService` only after the recognized sale contract is proven.
8. Run Real DB/E2E tests before merging.

## Current Status

```ini
AUTOMOVE_FINANCIAL_SOURCE_OF_TRUTH = HELD_PENDING_CANONICAL_CONTRACT_APPROVAL
FINANCIAL_REPORTING_SERVICE        = NOT_AUTHORIZED_FOR_MIGRATION
OWNER_DECISION_P0                  = APPROVED
PAYMENT_RECEIVED_SEPARATE_FROM_REVENUE = APPROVED
PACKAGE_SALE_PRODUCER_CONTRACT     = FAIL_CONFIRMED_PRE_FIX
AUTOMOVE_PACKAGE_SALE_PRODUCER_FIX = PROVEN_ON_MAIN
REVENUE_RECOGNITION_CAPABILITY     = GAP_CONFIRMED_BY_REPO_TRACE
VEHICLE_SALE_REVENUE_CONTRACT      = DESIGN_DRAFT_PENDING_OWNER_ACCOUNTING_APPROVAL
DEPOSIT_STATUS_UPDATE              = PROVEN_BY_UNIT
AUTO_DEPOSITS_ROUTE_PATH           = UNCHANGED_BY_BATCH
DEPOSIT_TRANSACTION_RECORD_IN_PROVIDER = NOT_PRESENT_PRE_FIX
E2E_PRODUCER_FLOW                  = NOT_EXECUTABLE_ON_CURRENT_E2E_SCHEMA
PACKAGE_SALE_FOR_VEHICLE_REVENUE   = NOT_ALLOWED_WITHOUT_APPROVED_CONTRACT
REVENUE_SEMANTICS                  = CONFLICT_CONFIRMED
REVENUE_RECOGNITION_EVENT          = PROPOSED_AS_sale_revenue_recognized
BOOKING_CREATED                    = NOT_REVENUE
DEPOSIT_RECEIVED                   = NOT_REVENUE
DEPOSIT_FULL_PAYMENT_REVENUE        = NOT_ALLOWED
VEHICLE_HANDOVER_CONFIRMED         = REQUIRED_EVIDENCE_BUT_NOT_ALWAYS_SUFFICIENT
SALE_TIME_COST_BASIS               = REQUIRED_SNAPSHOT
WARRANTY_ENTITLEMENT_SOURCE        = REQUIRED_CONTRACT
CODE_MUTATION                      = NOT_PERFORMED_IN_CONTRACT_DESIGN_BATCH
SCHEMA_MIGRATION                   = NOT_AUTHORIZED
PRODUCTION_MUTATION                = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS    = NOT_READY
```
