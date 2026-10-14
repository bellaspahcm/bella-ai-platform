# AutoMove Vehicle Sale Revenue Recognition Contract

Date: 2026-10-14
Status: DESIGN_DRAFT_PENDING_OWNER_ACCOUNTING_APPROVAL
Scope: Business contract design only

## Decision Summary

AutoMove has a confirmed product capability gap: vehicle sale revenue recognition is not yet represented by a canonical contract on `main`.

This document proposes the business contract for that missing capability. It does not authorize schema, migration, service implementation, `FinancialReportingService` migration, warranty service migration, Finance posting changes, or Production mutation.

```ini
REVENUE_RECOGNITION_CAPABILITY = GAP_CONFIRMED
CANONICAL_CONTRACT             = DESIGN_DRAFT
OWNER_ACCOUNTING_APPROVAL      = REQUIRED
SCHEMA_MIGRATION               = NOT_AUTHORIZED
FINANCIAL_REPORTING_SERVICE    = HELD
WARRANTY_SERVICE_MIGRATION     = HELD
PRODUCTION_MUTATION            = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY
```

## Non-Goals

- Do not create `auto_sales` to satisfy stale consumers.
- Do not implement schema, migrations, routes, services, or tests in this batch.
- Do not change Finance posting rules or ledger account mappings.
- Do not change `FinancialReportingService` or `WarrantyService`.
- Do not infer tax invoice timing from accounting recognition.
- Do not mutate Production.

## Success Signal For This Batch

This design batch is successful when the repository contains a focused vehicle sale revenue recognition contract that:

1. separates payment/deposit from revenue recognition;
2. defines the proposed command, event, aggregate, payload, invariants, and idempotency boundary;
3. marks owner/accounting decisions still required before implementation;
4. preserves `SCHEMA_MIGRATION = NOT_AUTHORIZED` and `PRODUCTION_MUTATION = NOT_PERFORMED`;
5. gives reviewers a concrete checklist for business/accounting approval.

## Evidence Basis

### Repository Evidence

- PR #318 removed invalid AutoMove booking/deposit `PACKAGE_SALE` producer emissions.
- `AutoSalesProvider` now treats booking/deposit updates as non-revenue events.
- `confirm-deposit` persists deposit state in `auto_bookings` and `auto_deposits`, but does not create accounting outbox or recognized sale revenue.
- `VehicleAllocationService.confirmDelivery` and `VehicleStatusMachineService` record operational delivery evidence, but do not emit sale revenue recognition.
- `FinancialReportingService` and `WarrantyService` still reference stale `auto_sales`.
- Generated database types do not prove `auto_sales` or `auto_revenue` as canonical AutoMove sale recognition schema.
- `PACKAGE_SALE` posts to `3387` deferred revenue when valid; gross revenue reporting reads account code `511%`.
- Analytics RPCs use completed bookings and delivered vehicles as revenue labels, but those are not an accounting source of truth.

Detailed trace: `investigations/automove-financial-revenue-recognition-investigation.md`.

### Legal / Accounting Evidence

The effective accounting reference for this design is Thong tu 99/2025/TT-BTC, issued on 2025-10-27 and effective from 2026-01-01, as published by Cong Bao. The Ministry of Finance Q&A for revenue recognition also references the principle that revenue recognition depends on the nature of the contract, obligations performed, control/risk transfer, reliable revenue measurement, expected economic benefit, and reliable cost measurement.

References:

- Cong Bao: `https://congbao.chinhphu.vn/van-ban/thong-tu-so-99-2025-tt-btc-46529/59631.htm`
- Ministry of Finance Q&A: `https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/161918`
- Bao Chinh Phu summary of Decree 70/2025/ND-CP invoice timing changes: `https://www2.en.baochinhphu.vn/chinh-sach-moi-co-hieu-luc-tu-thang-6-2025-102250531232407142.htm`

This contract intentionally separates accounting recognition from invoice/tax timing. Tax and invoice rules require a separate Tax/Compliance contract.

## Ownership

| Contract / Data | Owner | Status |
| --- | --- | --- |
| Vehicle identity, VIN, catalog display, lifecycle | Mobility OS | Existing foundation; product consumers should use public Mobility contract. |
| Booking, deposit, handover workflow facts | AutoMove Product | Existing partial operational capability. |
| Vehicle sale recognition decision | AutoMove Financial Contract | Proposed by this document; not yet approved. |
| Ledger posting mechanics and account mapping | Finance OS / accounting owner | Approval required before implementation. |
| Tax invoice timing and tax treatment | Tax / Compliance | Out of scope. |
| Warranty entitlement created by sale | AutoMove Financial Contract + Warranty owner | Proposed linkage; exact terms require approval. |

## Locked Principles

These principles are approved or directly supported by prior evidence:

1. Booking creation is not vehicle sale revenue.
2. Deposit receipt is not vehicle sale revenue.
3. Full deposit payment is not vehicle sale revenue.
4. Vehicle delivery is required evidence, but not sufficient by itself.
5. `PACKAGE_SALE` must not be reused for vehicle sale revenue without an approved contract.
6. `FinancialReportingService` must not be migrated to `auto_bookings.total_price` or current `auto_vehicles.cost_price` as a shortcut.
7. Warranty validation must not depend on stale `auto_sales`.
8. Revenue recognition must be explicit, auditable, idempotent, tenant-bound, and append-only.

## Proposed Canonical Contract

### Command

```text
recognize_vehicle_sale_revenue
```

Status: `PROPOSED_FOR_OWNER_REVIEW`

Purpose: create the canonical `sale_revenue_recognized` event for one completed vehicle sale after all business and accounting evidence is validated.

This command must be the only command allowed to create initial recognized vehicle sale revenue.

### Event

```text
sale_revenue_recognized
```

Status: `PROPOSED_FOR_OWNER_REVIEW`

Meaning:

- The sale has satisfied the approved revenue recognition conditions.
- Revenue amount is snapshotted.
- Cost basis is snapshotted.
- Booking, vehicle, customer, handover evidence, and warranty entitlement are linked.
- Later correction uses adjustment or reversal events; the original recognition is not silently mutated.

### Logical Aggregate

```text
VehicleSaleRecognition
```

Status: `LOGICAL_CONTRACT_ONLY`

No table name is approved by this document. Candidate names such as `auto_vehicle_sale_recognitions` or `auto_sale_revenue_recognitions` require schema design approval later.

## Recognition Preconditions

The command may emit `sale_revenue_recognized` only when all required checks pass.

| Check | Contract | Status |
| --- | --- | --- |
| Tenant boundary | Booking, vehicle, customer, handover evidence, payments, warranty terms, and actor must belong to the same tenant. | LOCKED |
| Actor authority | Actor must have owner-approved financial recognition permission. | OWNER_DECISION_REQUIRED |
| Booking link | Booking must exist and link the customer and vehicle or vehicle allocation. | PROPOSED |
| Booking state | Booking must not be cancelled, refunded, or already recognized. Exact required state is not yet approved. | OWNER_DECISION_REQUIRED |
| Vehicle state | VIN must be delivered or have approved equivalent control-transfer evidence. | PROPOSED |
| Handover evidence | Must include handover timestamp, customer, vehicle, actor, and evidence reference. Exact evidence checklist requires owner approval. | OWNER_DECISION_REQUIRED |
| Revenue amount | Recognized sale price must be determined and snapshotted. `auto_bookings.total_price` is only a candidate source. | OWNER_DECISION_REQUIRED |
| Cost basis | Sale-time cost basis must be determined and snapshotted. Current `auto_vehicles.cost_price` alone is not sufficient for historical proof. | OWNER_DECISION_REQUIRED |
| Payment treatment | Deposits and payments must be classified as customer advance, receivable settlement, or cash collection; not duplicate revenue. | LOCKED |
| Warranty entitlement | Warranty terms must be selected or linked at recognition time. | OWNER_DECISION_REQUIRED |
| Idempotency | The same sale must not be recognized twice. | LOCKED |

## Proposed Defaults Pending Approval

This section records the proposed AutoMove business/accounting defaults for owner review. These are design proposals, not accounting approval and not implementation authorization.

### 1. Recognition authority and evidence

Proposed default:

- Only an assigned accounting-capable actor or approved delegated workflow may execute `recognize_vehicle_sale_revenue`.
- The command must verify one unique vehicle sale transaction, matching tenant, customer, vehicle, and booking/sales agreement.
- The command must verify final sale evidence, control-transfer or handover evidence, measurable sale amount, reliable related cost, and no prior successful initial recognition for the same sale.
- `delivered` is operational evidence only. It is not enough to auto-recognize revenue.
- Missing evidence must reject the command with a reason; it must not create a partial recognized sale.

```ini
RECOGNITION_AUTHORITY_DEFAULT       = PROPOSED
CONTROL_TRANSFER_EVIDENCE_DEFAULT   = PROPOSED
DELIVERED_STATUS_AUTO_REVENUE       = REJECTED
RECOGNITION_AUTHORITY_APPROVAL      = NOT_PROVEN
HANDOVER_EVIDENCE_POLICY_APPROVAL   = NOT_PROVEN
```

### 2. Sale price and adjustments

Proposed default:

- Recognized sale price comes from the approved final sale document or approved sale agreement, not raw `auto_bookings.total_price`.
- Initial recognition snapshots contract sale price, discounts, approved adjustments, net transaction value, currency, and separately tracked indirect tax fields when applicable.
- Deposits and payments reduce customer advance or receivable balances; they do not add a second revenue amount.
- Trade-in treatment requires a separate approved accounting rule and must not be silently netted against vehicle sale revenue.

```ini
SALE_PRICE_SOURCE_DEFAULT           = PROPOSED_FINAL_APPROVED_SALE_DOCUMENT
DISCOUNT_ADJUSTMENT_DEFAULT         = PROPOSED_SNAPSHOT_AT_RECOGNITION
TRADE_IN_TREATMENT_DEFAULT          = PROPOSED_SEPARATE_ACCOUNTING_RULE_REQUIRED
SALE_PRICE_SOURCE_APPROVAL          = NOT_PROVEN
DISCOUNT_ADJUSTMENT_APPROVAL        = NOT_PROVEN
TRADE_IN_ACCOUNTING_APPROVAL        = NOT_PROVEN
```

### 3. Sale-time cost basis

Proposed default:

- Each recognized vehicle sale must snapshot immutable `cost_basis_at_sale`.
- The default candidate is purchase cost plus directly attributable costs needed to bring the vehicle to its current location and sale-ready condition, net of directly related reductions.
- Current `auto_vehicles.cost_price` may be source evidence but must not be used to recompute historical profit after recognition.
- Transport, registration, refurbishment, accessories, warranty reserves, and similar costs are included only when accounting policy approves capitalization for that component.
- If reliable cost basis is not available, the command must stop or route through an approved exception process; it must not estimate cost silently.

```ini
COST_BASIS_DEFAULT                  = PROPOSED_IMMUTABLE_SALE_TIME_SNAPSHOT
CURRENT_COST_PRICE_AS_HISTORY       = REJECTED
COST_BASIS_EXCEPTION_PROCESS        = PROPOSED_OWNER_APPROVED_EXCEPTION_REQUIRED
COST_BASIS_FORMULA_APPROVAL         = NOT_PROVEN
COST_COMPONENT_CAPITALIZATION_RULES = NOT_PROVEN
```

### 4. Cancellation, refund, reversal, and adjustment

Proposed default:

- Before revenue recognition, booking cancellation and deposit refund are booking/payment events, not revenue reversal.
- After payment but before revenue recognition, refund or receivable effects must be handled as customer advance, cash, payable, or receivable treatment under Finance approval.
- After revenue recognition, reversal or adjustment must create a new append-only event referencing the original `recognition_id`.
- Partial refund or post-sale discount must state reason, evidence, actor authority, accounting period, and financial effect.
- Booking status changes must not automatically reverse accounting history.

```ini
PRE_RECOGNITION_CANCEL_DEFAULT      = PROPOSED_NO_REVENUE_REVERSAL
POST_RECOGNITION_REVERSAL_DEFAULT   = PROPOSED_APPEND_ONLY_REFERENCE_ORIGINAL
BOOKING_STATUS_AUTO_LEDGER_REVERSAL = REJECTED
REVERSAL_ADJUSTMENT_POLICY_APPROVAL = NOT_PROVEN
REFUND_ACCOUNTING_POLICY_APPROVAL   = NOT_PROVEN
```

### 5. Warranty entitlement

Proposed default:

- Warranty entitlement source is the approved warranty policy and sale-specific terms effective for the vehicle at sale recognition.
- The recognition contract should snapshot or link warranty package, start date, end date, mileage limit, transfer rule, void rule, and evidence reference.
- Warranty claims prove claim activity only; they do not establish entitlement.
- Stale `auto_sales` is not an approved warranty source.
- Warranty entitlement and warranty cost/reserve treatment are separate decisions. Missing a complete warranty module must not automatically block revenue recognition if the related obligation can be measured and handled under approved accounting policy.

```ini
WARRANTY_ENTITLEMENT_DEFAULT        = PROPOSED_APPROVED_POLICY_AND_SALE_TERMS
WARRANTY_CLAIMS_AS_ENTITLEMENT      = REJECTED
STALE_AUTO_SALES_AS_ENTITLEMENT     = REJECTED
WARRANTY_TERMS_POLICY_APPROVAL      = NOT_PROVEN
WARRANTY_COST_RESERVE_APPROVAL      = NOT_PROVEN
```

### 6. Sale transaction identity and idempotency

Proposed default:

- Create a canonical vehicle sale transaction identity independent from booking and payment records.
- One sale transaction may have only one successful initial `sale_revenue_recognized` event.
- Adjustment and reversal events use their own identities and reference the original recognition.
- `bookingId` and `depositId` are not sufficient substitutes for the sale transaction identity.
- The final table name, transaction boundary, and uniqueness mechanism require later schema approval.

```ini
SALE_TRANSACTION_IDENTITY_DEFAULT   = PROPOSED_CANONICAL_VEHICLE_SALE_TRANSACTION
BOOKING_ID_AS_SALE_IDENTITY         = REJECTED
DEPOSIT_ID_AS_SALE_IDENTITY         = REJECTED
IDEMPOTENCY_STORAGE_APPROVAL        = NOT_PROVEN
SCHEMA_NAME_APPROVAL                = NOT_PROVEN
```

## Proposed Accounting Policy v1

This section converts the proposed defaults into a versioned accounting-policy proposal for AutoMove. It is intended to let the product keep moving without hard-coding accounting rules that may change later.

This policy is not officially adopted until approved by the authorized business/accounting owner.

```ini
ACCOUNTING_POLICY_RESEARCH       = INITIAL_RESEARCH_COMPLETE
ACCOUNTING_POLICY_PROPOSAL       = READY_FOR_CONTRACT_UPDATE
POLICY_ID                        = AUTOMOVE_VEHICLE_SALE_ACCOUNTING_POLICY
POLICY_VERSION                   = v1_PROPOSED
POLICY_STATUS                    = PROPOSED_PENDING_OWNER_ACCOUNTING_APPROVAL
BUSINESS_CONTRACT_APPROVED       = FALSE
OWNER_ACCOUNTING_APPROVAL        = NOT_PROVEN
SCHEMA_MIGRATION                 = NOT_AUTHORIZED
CODE_MUTATION                    = NOT_AUTHORIZED
PRODUCTION_MUTATION              = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS  = NOT_READY
```

Limited implementation approval recorded from this review cycle:

```ini
APPROVAL_SCOPE                     = ACCOUNTING_POLICY_V1_PROPOSED_DEFAULTS
ACCOUNTING_POLICY_V1               = APPROVED_FOR_IMPLEMENTATION
TRUSTED_POLICY_RESOLUTION          = REQUIRED
HISTORICAL_POLICY_IMMUTABILITY     = REQUIRED
BUSINESS_CONTRACT_APPROVED         = LIMITED_TO_APPROVED_SCOPE
SCHEMA_MIGRATION                   = NOT_YET_AUTHORIZED
PRODUCTION_MUTATION                = NOT_AUTHORIZED
```

This approval authorizes planning for trusted policy resolution, policy-version persistence, immutable historical snapshots, and append-only adjustments. It does not authorize schema migration, Production mutation, or treating the proposed accounting policy as officially adopted under the company's accounting governance process.

### Policy basis

Initial legal/accounting basis:

- Thong tu 99/2025/TT-BTC is the starting accounting-regime reference for financial years beginning on or after 2026-01-01, subject to the entity's applicable regime and transition rules.
- Revenue recognition is separated from cash collection and invoice timing.
- Invoice timing for goods must be handled by Tax/Compliance rules and must not be collapsed into the accounting recognition event.
- Bella must preserve enough evidence to inspect, reconcile, and adjust accounting decisions later.

```ini
LEGAL_BASIS_TT99                  = REFERENCED
INVOICE_TIMING_ND70               = REFERENCED_FOR_TAX_INVOICE_BOUNDARY
TAX_INVOICE_RULE_IMPLEMENTATION   = OUT_OF_SCOPE_SEPARATE_CONTRACT
```

### Policy 1. Sale price and revenue

Proposed policy:

- Use the final approved sale contract, order, or vehicle sale document as the recognized sale amount source.
- Store pre-tax sale price, indirect tax fields when applicable, discount amount, approved adjustments, total payment amount, and currency separately.
- Do not use `auto_bookings.total_price` as the default source of truth unless the owner approves it as the final sale amount source.
- Recognize revenue only when the applicable accounting recognition conditions and transaction substance are satisfied.
- Do not recognize revenue merely because a deposit was received, full payment was received, an invoice was issued, or a vehicle is operationally marked delivered.

```ini
POLICY_SALE_PRICE_SOURCE          = PROPOSED_FINAL_APPROVED_SALE_DOCUMENT
POLICY_REVENUE_RECOGNITION_BASIS  = PROPOSED_ACCOUNTING_CONDITIONS_AND_TRANSACTION_SUBSTANCE
AUTO_BOOKINGS_TOTAL_PRICE_SOURCE  = NOT_APPROVED_AS_DEFAULT
PAYMENT_AS_REVENUE                = REJECTED
INVOICE_AS_SOLE_REVENUE_TRIGGER   = REJECTED
```

### Policy 2. Deposits and payments

Proposed policy:

- Deposit received before revenue recognition is tracked separately from vehicle sale revenue.
- Partial payments are payment events and must not imply sale revenue by themselves.
- Cancellation or refund before revenue recognition must resolve customer advance, payable, receivable, cash, or contractual forfeiture treatment under approved accounting policy.
- Reports must reconcile cash received, receivable remaining, customer advance, refund obligation, and recognized revenue separately.

```ini
POLICY_DEPOSIT_TREATMENT          = PROPOSED_CUSTOMER_ADVANCE_OR_APPROVED_PAYMENT_CLASSIFICATION
POLICY_PAYMENT_EVENT              = PROPOSED_SEPARATE_FROM_REVENUE
POLICY_DEPOSIT_FORFEITURE_RULE    = NOT_PROVEN
POLICY_REFUND_OBLIGATION_RULE     = NOT_PROVEN
```

### Policy 3. Vehicle cost basis

Proposed policy:

- Use the inventory accounting method selected and consistently applied by the enterprise.
- Snapshot sale-time cost basis, cost components, method, source references, and effective policy version.
- Do not recompute historical profit from current `auto_vehicles.cost_price`.
- Correct errors or approved cost changes through linked adjustment entries, not mutation of the original recognition event.

Open accounting decisions:

- Which inventory cost method applies to AutoMove vehicles.
- Which components are capitalized into vehicle cost basis.
- How trade-in, refurbishment, warranty reserve, registration, accessories, discounts, and rebates affect cost basis.

```ini
POLICY_COST_BASIS                 = PROPOSED_INVENTORY_METHOD_SNAPSHOT_AT_RECOGNITION
CURRENT_COST_PRICE_AS_HISTORY     = REJECTED
POLICY_COST_METHOD_APPROVAL       = NOT_PROVEN
POLICY_COST_COMPONENT_APPROVAL    = NOT_PROVEN
```

### Policy 4. Handover and invoice boundary

Proposed policy:

- Vehicle handover is an operational event with timestamp, actor, customer, vehicle, and evidence reference.
- Transfer of ownership or use rights, accounting revenue recognition, and invoice issuance are related but separate controls.
- `HANDED_OVER` or `delivered` status must not be the sole automatic trigger for revenue recognition.
- The system should later detect missing invoice evidence or timing mismatches, but tax invoice implementation remains separate.

```ini
POLICY_HANDOVER_EVENT             = PROPOSED_SEPARATE_OPERATIONAL_EVENT
HANDED_OVER_AUTO_REVENUE          = REJECTED
INVOICE_TIMING_CONTRACT           = OUT_OF_SCOPE_TAX_COMPLIANCE_CONTRACT
INVOICE_RECONCILIATION_CONTROL    = PROPOSED_FOR_LATER_IMPLEMENTATION
```

### Policy 5. Reversal and adjustment

Proposed policy:

- Never delete or overwrite a recognized financial event.
- Reversal and adjustment events must reference the original `recognition_id`.
- Each adjustment must record reason, actor, timestamp, evidence reference, affected accounting period, and policy version.
- Cancellation before recognition is not a revenue reversal.
- Adjustments affecting closed accounting periods must follow an approved closed-period correction process.

```ini
POLICY_REVERSAL_MODEL             = PROPOSED_APPEND_ONLY_REFERENCE_ORIGINAL
POLICY_CLOSED_PERIOD_ADJUSTMENT   = NOT_PROVEN
BOOKING_STATUS_AUTO_LEDGER_CHANGE = REJECTED
```

### Policy 6. Policy versioning and audit

Proposed policy:

- Each policy must have `policy_id`, version, status, legal basis, effective date, approval actor, approval timestamp, and audit trail.
- Transactions must store the policy version applied at recognition time.
- Policy changes apply according to approved effective date and scope; they must not silently recalculate historical transactions.
- Accounting, tax, invoice, and internal workflow policies should be separate but linkable configurations.

```ini
POLICY_VERSIONING_MODEL           = PROPOSED
TRANSACTION_POLICY_VERSION_SNAPSHOT = PROPOSED_REQUIRED
RETROACTIVE_RECALCULATION_DEFAULT = REJECTED
POLICY_AUDIT_TRAIL                = PROPOSED_REQUIRED
```

## Minimum Event Payload

The initial recognized sale event must carry or reference these facts:

| Field | Requirement |
| --- | --- |
| `tenant_id` | Required tenant boundary. |
| `recognition_id` | Stable event identifier. |
| `idempotency_key` | Unique key for initial recognition. |
| `booking_id` | Required booking/sales agreement reference. |
| `vehicle_id` | Required delivered VIN reference. |
| `customer_id` | Required customer reference. |
| `recognized_at` | Recognition timestamp. |
| `recognized_by` | Authorized actor/system. |
| `recognition_basis` | Evidence summary for accounting recognition. |
| `handover_evidence_ref` | Reference to handover evidence. |
| `handover_confirmed_at` | Handover timestamp or approved equivalent. |
| `sale_price_recognized` | Recognized revenue amount snapshot. |
| `discount_amount` | Discount snapshot if applicable. |
| `price_adjustment_amount` | Approved adjustment included at initial recognition, if any. |
| `cost_basis_at_sale` | Historical cost snapshot. |
| `cost_basis_source_ref` | Source evidence for cost basis. |
| `currency` | Monetary currency, expected VND unless approved otherwise. |
| `deposit_received_total` | Deposits received before recognition. |
| `payment_received_total` | Total payments received before recognition. |
| `receivable_amount_at_recognition` | Remaining receivable after payments/customer advance handling. |
| `warranty_entitlement_ref` | Warranty terms or entitlement reference. |
| `warranty_start_date` | Owner-approved start date. |
| `warranty_end_date` | Owner-approved end date. |
| `warranty_mileage_limit` | Owner-approved mileage limit, if applicable. |
| `accounting_policy_id` | Policy identifier applied to the recognition. |
| `accounting_policy_version` | Policy version applied to the recognition. |
| `status` | Initial status must be recognized. |
| `created_at` | Audit timestamp. |

## Idempotency

Initial recognition must be unique for:

```text
tenant_id + booking_id + vehicle_id + recognition_kind = vehicle_sale_initial
```

The implementation may use a derived `idempotency_key`, but it must be stable for the same business sale and must not collide with booking creation, deposit receipt, package sale, or adjustment events.

Adjustment and reversal events must use separate idempotency keys and reference the original `recognition_id`.

## Ledger Boundary

This document approves business semantics, not journal implementation.

Locked ledger boundaries:

1. Deposit receipt must not post direct vehicle sale revenue.
2. Valid `PACKAGE_SALE` currently represents deferred revenue behavior, not recognized vehicle sale revenue.
3. P&L vehicle sale revenue must come from the approved recognition contract and Finance-approved posting path.
4. Any direct use of account code `511` for vehicle sale revenue requires accounting owner approval and authoritative legal/source evidence.
5. Any cost-of-goods-sold posting for vehicle inventory requires accounting owner approval and a proven cost-basis contract.

Required owner decision before implementation:

```ini
VEHICLE_REVENUE_POSTING_RULE = OWNER_ACCOUNTING_DECISION_REQUIRED
VEHICLE_COGS_POSTING_RULE    = OWNER_ACCOUNTING_DECISION_REQUIRED
CUSTOMER_ADVANCE_MAPPING     = OWNER_ACCOUNTING_DECISION_REQUIRED
RECEIVABLE_MAPPING           = OWNER_ACCOUNTING_DECISION_REQUIRED
VAT_OR_TAX_MAPPING           = OUT_OF_SCOPE_SEPARATE_CONTRACT
```

## Payment And Deposit Treatment

Deposits and payments are separate from revenue recognition.

| Event | Meaning | Revenue impact |
| --- | --- | --- |
| `payment_received` | Money collected from customer. | No revenue by itself. |
| `deposit_received` | Payment classified as deposit/customer advance candidate. | No revenue by itself. |
| `sale_revenue_recognized` | Business/accounting conditions satisfied. | Creates recognized sale revenue subject to Finance posting approval. |
| `payment_allocated_to_sale` | Payment/customer advance is associated with recognized sale or receivable. | Settlement only unless paired with approved recognition. |

Open decision: whether AutoMove should introduce a canonical `payment_received` event before or together with sale recognition. This document does not authorize that implementation.

## Cost Basis Rule

The recognized sale must snapshot cost basis at recognition time.

Locked principles:

- Reports must not recompute historical profit from mutable current `auto_vehicles.cost_price`.
- `cost_basis_at_sale` must preserve source evidence.
- Later corrections require `sale_cost_basis_adjusted`, not mutation of the original event.

Owner decisions required:

```ini
COST_BASIS_BASE_SOURCE             = REQUIRED
INCLUDE_TRANSPORT_COST             = REQUIRED
INCLUDE_REGISTRATION_COST          = REQUIRED
INCLUDE_REFURBISHMENT_COST         = REQUIRED
INCLUDE_WARRANTY_RESERVE           = REQUIRED
INCLUDE_TRADE_IN_IMPACT            = REQUIRED
INCLUDE_ACCESSORIES_OR_DISCOUNTS   = REQUIRED
COST_BASIS_ADJUSTMENT_AUTHORITY    = REQUIRED
```

## Warranty Entitlement

Warranty entitlement must be attached to or referenced by the recognized sale.

Locked principles:

- Warranty entitlement must not be inferred from claim rows.
- Warranty entitlement must not be read from stale `auto_sales`.
- Warranty validation should later read the canonical entitlement created or linked during sale recognition.

Owner decisions required:

```ini
WARRANTY_TERMS_SOURCE          = REQUIRED
WARRANTY_START_DATE_RULE       = REQUIRED
WARRANTY_END_DATE_RULE         = REQUIRED
WARRANTY_MILEAGE_LIMIT_SOURCE  = REQUIRED
WARRANTY_TRANSFER_RULE         = REQUIRED
WARRANTY_VOID_OR_ADJUST_RULE   = REQUIRED
```

## Cancellation, Refund, Adjustment

### Before recognition

- Booking cancellation before recognition must not create recognized revenue.
- Deposit refund before recognition is a payment/cash event, not a revenue reversal.
- Any customer advance liability treatment requires Finance approval.

### After recognition

- Reversal must reference the original `recognition_id`.
- Partial refund must be split into payment effect and revenue/receivable effect.
- Price adjustment must create `sale_revenue_adjusted`.
- Cost correction must create `sale_cost_basis_adjusted`.
- Warranty effect must be explicit; do not automatically void warranty for every refund/reversal.

Required event family:

| Event | Purpose | Status |
| --- | --- | --- |
| `sale_revenue_adjusted` | Adjust recognized sale revenue. | PROPOSED |
| `sale_revenue_reversed` | Reverse a recognized sale. | PROPOSED |
| `sale_cost_basis_adjusted` | Adjust sale-time cost basis. | PROPOSED |
| `warranty_entitlement_adjusted` | Adjust warranty terms linked to recognized sale. | PROPOSED |
| `refund_issued` | Record cash/payment refund. | PAYMENT_EVENT_ONLY |

## Reporting Contract

After implementation approval, reports must use the recognized sale contract:

- vehicle sales revenue = recognized sale revenue plus/minus approved revenue adjustments;
- vehicle count = count of active recognized sale events;
- gross profit = recognized sale revenue minus `cost_basis_at_sale` plus/minus approved cost adjustments;
- payment/deposit metrics = separate cash/advance/receivable metrics;
- warranty coverage = canonical warranty entitlement linked to recognized sale;
- vehicle display = Mobility public contract.

Until implementation:

```ini
FINANCIAL_REPORTING_SERVICE = STALE_CONSUMER_HELD
WARRANTY_SERVICE            = STALE_CONSUMER_HELD_FOR_ENTITLEMENT
```

## Verification Contract After Approval

Implementation must prove these cases on a non-Production Real DB environment:

1. Booking only does not create recognized revenue.
2. Deposit only does not create recognized revenue.
3. Full deposit payment does not create recognized revenue.
4. Vehicle delivery only does not create recognized revenue.
5. Explicit recognition command creates exactly one recognized sale for the same tenant, booking, and vehicle.
6. Cross-tenant recognition attempts are denied.
7. Later `auto_vehicles.cost_price` changes do not alter historical sale profit.
8. Warranty validation reads canonical entitlement, not stale `auto_sales`.
9. Cancellation before recognition creates no revenue.
10. Reversal/adjustment after recognition is append-only and references the original event.
11. Ledger posting path is proven separately through Finance-approved account mapping.

## Approval Checklist

The contract can move from `DESIGN_DRAFT` to `BUSINESS_CONTRACT_APPROVED` only when each item is answered:

| Decision | Required owner |
| --- | --- |
| Command name and actor authority | AutoMove owner + accounting owner |
| Required booking state and handover evidence | AutoMove owner |
| Revenue amount source and adjustment rules | AutoMove owner + accounting owner |
| Cost basis source and included components | Accounting owner |
| Payment/customer advance/receivable treatment | Accounting owner |
| Warranty entitlement source and date/mileage rules | AutoMove owner + warranty owner |
| Ledger mapping for revenue and COGS | Finance/accounting owner |
| Tax/invoice boundary | Tax/compliance owner |
| Accounting policy versioning and effective-date rules | Accounting owner + Platform/Mobility |
| Idempotency and tenant isolation invariants | Platform/Mobility + AutoMove |

## Self-Validation

Coherence: the contract has one primary capability, `sale_revenue_recognized`, plus supporting payment, adjustment, reversal, warranty, reporting, and verification boundaries. Every implementation-sensitive rule is either `LOCKED`, `PROPOSED`, or `OWNER_DECISION_REQUIRED`.

Preservation: the load-bearing source claims from the PR #318 follow-up audit are preserved: booking/deposit is not revenue, delivery is operational evidence only, `PACKAGE_SALE` is not vehicle sale revenue, stale `auto_sales` consumers remain held, and implementation/Production remain unauthorized.

Open decisions remain explicit in the approval checklist and must not be filled by implementation inference.

## Current Status

```ini
AUTOMOVE_PACKAGE_SALE_PRODUCER_FIX = PROVEN_ON_MAIN
REVENUE_RECOGNITION_CAPABILITY     = GAP_CONFIRMED
VEHICLE_SALE_REVENUE_CONTRACT      = DESIGN_DRAFT_PENDING_OWNER_ACCOUNTING_APPROVAL
ACCOUNTING_POLICY_V1               = APPROVED_FOR_IMPLEMENTATION
APPROVAL_SCOPE                     = ACCOUNTING_POLICY_V1_PROPOSED_DEFAULTS
TRUSTED_POLICY_RESOLUTION          = REQUIRED
HISTORICAL_POLICY_IMMUTABILITY     = REQUIRED
BUSINESS_CONTRACT_APPROVED         = LIMITED_TO_APPROVED_SCOPE
PAYMENT_RECEIVED_SEPARATE_FROM_REVENUE = APPROVED
PACKAGE_SALE_FOR_VEHICLE_REVENUE   = NOT_ALLOWED_WITHOUT_APPROVED_CONTRACT
FINANCIAL_REPORTING_SERVICE        = HELD
WARRANTY_SERVICE_MIGRATION         = HELD
SCHEMA_MIGRATION                   = NOT_YET_AUTHORIZED
CODE_MUTATION                      = NOT_PERFORMED
PRODUCTION_MUTATION                = NOT_AUTHORIZED
AUTOMOVE_FULL_PRODUCT_READINESS    = NOT_READY
```
