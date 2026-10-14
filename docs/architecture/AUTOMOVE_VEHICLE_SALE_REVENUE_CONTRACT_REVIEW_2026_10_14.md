# AutoMove Vehicle Sale Revenue Contract Review

Date: 2026-10-14
Scope: Architecture and accounting contract review only
Reviewer posture: no implementation, no schema, no service migration, no Production

## Review Result

The draft is directionally correct and preserves the required boundary: booking, deposit, payment, handover, and revenue recognition are separate business events.

The contract is not approved for implementation yet. It still requires owner and accounting decisions for actor authority, exact evidence checklist, revenue amount source, cost-basis calculation, warranty entitlement source, ledger mapping, and reversal/adjustment rules.

```ini
CONTRACT_REVIEW_RESULT              = CHANGES_REQUIRED
VEHICLE_SALE_REVENUE_CONTRACT       = DESIGN_DRAFT_PENDING_OWNER_ACCOUNTING_APPROVAL
BUSINESS_CONTRACT_APPROVED          = FALSE
SCHEMA_MIGRATION                    = NOT_AUTHORIZED
FINANCIAL_REPORTING_SERVICE         = HELD
WARRANTY_SERVICE_MIGRATION          = HELD
PRODUCTION_MUTATION                 = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS     = NOT_READY
```

## Evidence Reviewed

- `docs/architecture/AUTOMOVE_VEHICLE_SALE_REVENUE_CONTRACT_2026_10_14.md`
- `docs/architecture/AUTOMOVE_FINANCIAL_SOURCE_OF_TRUTH_PROPOSAL_2026_10_14.md`
- `docs/architecture/AUTOMOVE_FINANCIAL_SOURCE_OF_TRUTH_REVIEW_2026_10_14.md`
- `investigations/automove-financial-revenue-recognition-investigation.md`
- `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`

## Decision Matrix

| Decision | Review status | Rationale |
| --- | --- | --- |
| `recognize_vehicle_sale_revenue` must be an explicit command gated by control-transfer evidence, measurable sale price, and measurable related cost. | APPROVED | This matches the Business Semantic Gate and prevents booking, deposit, payment, or delivery from being treated as revenue by implication. |
| Exact command authority, required booking state, accepted handover evidence, and required actor role. | NOT_PROVEN | The draft correctly marks these as owner decisions. Existing code shows operational booking/deposit/delivery facts, but not the approved recognition authority or evidence checklist. |
| `payment_received`, `vehicle_handover_confirmed`, and `sale_revenue_recognized` are distinct events. | APPROVED | This directly resolves the P0 producer error without turning payment collection into vehicle sale revenue. |
| `PACKAGE_SALE` may represent AutoMove vehicle sale revenue. | REJECTED | Prior trace shows valid `PACKAGE_SALE` enters deferred-revenue behavior and is not an approved vehicle sale recognition contract. Reusing it would violate the contract boundary. |
| Revenue snapshot must include sale price, discounts, adjustments, payments, receivable amount, customer, vehicle, booking, and handover reference. | APPROVED | The minimum payload is appropriate for a canonical recognized-sale event. |
| Source of actual sale price and discount/adjustment rules. | NOT_PROVEN | `auto_bookings.total_price` is only a candidate. It is not approved as the final recognized revenue amount source. |
| Sale-time cost basis must be snapshotted and historical reports must not recompute profit from current `auto_vehicles.cost_price`. | APPROVED | This protects historical profit reporting from mutable inventory cost values. |
| Cost basis formula and included components, including transport, registration, refurbishment, warranty reserve, trade-in, accessories, discounts, and later cost adjustments. | NOT_PROVEN | These require accounting owner approval before schema or reporting implementation. |
| Ledger mapping for vehicle sale revenue, COGS, customer advances, receivables, refunds, and reversals. | NOT_PROVEN | The draft correctly keeps account mapping under Finance/accounting ownership. No implementation should post TK 511 or COGS without that approval. |
| Cancellation, refund, reversal, and adjustment must be append-only and reference the original recognition event. | APPROVED | This preserves auditability and prevents silent mutation of recognized financial history. |
| Exact pre-recognition cancellation, deposit refund, post-recognition reversal, partial refund, and price adjustment rules. | NOT_PROVEN | The event family is proposed, but owner policy and accounting effect are not yet approved. |
| Warranty entitlement must come from or be linked to the recognized sale contract, not stale `auto_sales` or claim rows. | APPROVED | This removes the stale warranty source and prevents entitlement inference from current claims or vehicle display data. |
| Warranty terms source, start date, end date, mileage limit, transfer, void, and adjustment rules. | NOT_PROVEN | These are still owner/warranty decisions. `WarrantyService` migration remains held. |
| Idempotency must be scoped to the vehicle sale transaction and must not collide with booking, deposit, package sale, adjustment, or reversal events. | APPROVED | The draft gives the correct invariant and avoids the P0 outbox collision risk. |
| Exact persisted sale transaction identity and final idempotency key material. | NOT_PROVEN | The proposed key shape is acceptable as a draft, but the canonical persisted sale object and runtime uniqueness mechanism are not approved yet. |
| Tax invoice timing and tax treatment are out of scope. | APPROVED | The draft correctly separates accounting revenue recognition from tax/compliance obligations. |

## Blocking Findings

### 1. Business approval is still absent

The draft uses strong contract language, but it still lists owner/accounting decisions as required. That is correct. The review must not promote `DESIGN_DRAFT_PENDING_OWNER_ACCOUNTING_APPROVAL` to `BUSINESS_CONTRACT_APPROVED`.

Required before implementation:

```ini
OWNER_ACCOUNTING_APPROVAL = REQUIRED
BUSINESS_CONTRACT_APPROVED = FALSE
```

### 2. Recognition command is well named, but not fully specified

`recognize_vehicle_sale_revenue` is an acceptable proposed command. The missing parts are the authority model, valid source state, evidence checklist, and failure modes.

Keep:

```ini
RECOGNITION_COMMAND_NAME = APPROVED
RECOGNITION_ACTOR_AUTHORITY = NOT_PROVEN
REQUIRED_BOOKING_STATE = NOT_PROVEN
REQUIRED_HANDOVER_EVIDENCE = NOT_PROVEN
```

### 3. Revenue amount source is not canonical yet

The draft correctly avoids treating `auto_bookings.total_price` as final accounting truth. It must remain a candidate until owner/accounting approval defines the recognized sale amount, discount treatment, and adjustment rules.

```ini
REVENUE_AMOUNT_SOURCE = NOT_PROVEN
DISCOUNT_ADJUSTMENT_RULE = NOT_PROVEN
```

### 4. Cost basis requires accounting policy

The draft correctly rejects mutable current `auto_vehicles.cost_price` as historical proof. It still needs the accounting policy for cost-basis composition and later adjustments.

```ini
COST_BASIS_BASE_SOURCE = NOT_PROVEN
COST_BASIS_INCLUDED_COMPONENTS = NOT_PROVEN
COST_BASIS_ADJUSTMENT_RULE = NOT_PROVEN
```

### 5. Ledger mapping is intentionally not approved

The draft must remain a business contract, not a journal implementation. Any TK 511, COGS, receivable, customer advance, refund, or reversal mapping needs separate Finance/accounting approval with authoritative legal/accounting evidence.

```ini
VEHICLE_REVENUE_POSTING_RULE = NOT_PROVEN
VEHICLE_COGS_POSTING_RULE = NOT_PROVEN
CUSTOMER_ADVANCE_MAPPING = NOT_PROVEN
RECEIVABLE_MAPPING = NOT_PROVEN
```

### 6. Warranty entitlement is conceptually correct but incomplete

The draft correctly blocks stale `auto_sales` and claim-row inference. It still does not prove the warranty package, start date, mileage limit, transfer, void, or adjustment policy.

```ini
WARRANTY_ENTITLEMENT_SOURCE = NOT_PROVEN
WARRANTY_START_DATE_RULE = NOT_PROVEN
WARRANTY_MILEAGE_LIMIT_SOURCE = NOT_PROVEN
WARRANTY_SERVICE_MIGRATION = HELD
```

### 7. Idempotency invariant is correct, final persistence contract is not

The invariant must stand: initial sale recognition can happen once per business sale, and adjustment/reversal keys must be separate. The implementation key cannot be finalized until the persisted recognition object is approved.

```ini
IDEMPOTENCY_INVARIANT = APPROVED
IDEMPOTENCY_STORAGE_CONTRACT = NOT_PROVEN
```

## Required Changes Before Approval

1. Record explicit owner/accounting approval for the command authority and recognition evidence checklist.
2. Define the canonical revenue amount source, including discount and adjustment treatment.
3. Define the accounting-approved sale-time cost-basis formula.
4. Define cancellation, refund, reversal, and adjustment rules with authority and financial effect.
5. Define the warranty entitlement source and effective-date/mileage rules.
6. Define the final persisted recognition object and idempotency key storage.
7. Keep `FinancialReportingService` and `WarrantyService` held until the recognized sale contract is implemented and proven.

## Revision Review: Proposed Defaults

The contract now includes proposed defaults for the six missing decision groups. This is acceptable as a review input because each default is explicitly marked `PROPOSED`, while owner/accounting approval remains `NOT_PROVEN`.

| Decision group | Revision status | Review |
| --- | --- | --- |
| Recognition authority and evidence | APPROVED_AS_PROPOSAL | The default correctly requires an authorized actor, final sale evidence, control-transfer evidence, reliable cost, and duplicate-recognition prevention. Approval remains missing. |
| Sale price and adjustments | APPROVED_AS_PROPOSAL | The default correctly rejects raw `auto_bookings.total_price` as automatic source of truth and separates deposits/payments from recognized revenue. Final source and adjustment policy remain unapproved. |
| Sale-time cost basis | APPROVED_AS_PROPOSAL | The default correctly requires an immutable sale-time snapshot and rejects mutable current `auto_vehicles.cost_price` as historical profit source. Capitalization policy remains unapproved. |
| Cancellation/refund/reversal/adjustment | APPROVED_AS_PROPOSAL | The default correctly separates pre-recognition payment effects from post-recognition append-only financial events. Exact accounting treatment remains unapproved. |
| Warranty entitlement | APPROVED_AS_PROPOSAL | The default correctly rejects claim rows and stale `auto_sales` as entitlement sources and separates entitlement from cost/reserve treatment. Terms and accounting effect remain unapproved. |
| Sale transaction identity/idempotency | APPROVED_AS_PROPOSAL | The default correctly rejects `bookingId` and `depositId` as standalone sale identities. Final persistence and uniqueness contract remain unapproved. |

```ini
PROPOSED_DEFAULTS_RECORDED          = TRUE
PROPOSED_DEFAULTS_REVIEW            = PASS_AS_DRAFT_INPUT
OWNER_ACCOUNTING_APPROVAL           = NOT_PROVEN
BUSINESS_CONTRACT_APPROVED          = FALSE
SCHEMA_MIGRATION                    = NOT_AUTHORIZED
CODE_MUTATION                       = NOT_PERFORMED
PRODUCTION_MUTATION                 = NOT_PERFORMED
```

## Revision Review: Proposed Accounting Policy v1

The contract now includes a versioned `Proposed Accounting Policy v1`. This is acceptable as draft input because it gives AutoMove a reviewable default policy without treating AI research as official accounting approval.

| Policy area | Review status | Review |
| --- | --- | --- |
| Legal basis and invoice boundary | PASS_AS_DRAFT_INPUT | The policy references TT99 as the accounting-regime basis and treats invoice timing as a separate Tax/Compliance boundary. This is the right separation. |
| Sale price and revenue | PASS_AS_DRAFT_INPUT | The policy uses final approved sale evidence as the proposed source and rejects booking total, payment, and invoice issuance as automatic revenue triggers. |
| Deposits and payments | PASS_AS_DRAFT_INPUT | The policy keeps deposits/payments separate from revenue and requires reconciliation of cash, advances, receivables, refund obligations, and recognized revenue. |
| Vehicle cost basis | PASS_AS_DRAFT_INPUT | The policy requires sale-time cost-basis snapshot and rejects current `auto_vehicles.cost_price` as historical recalculation source. |
| Handover and invoice boundary | PASS_AS_DRAFT_INPUT | The policy treats handover as operational evidence, not a universal automatic recognition trigger, and leaves invoice controls to a separate contract. |
| Reversal and adjustment | PASS_AS_DRAFT_INPUT | The policy remains append-only and references the original `recognition_id`. Closed-period adjustment rules remain unapproved. |
| Policy versioning and audit | PASS_AS_DRAFT_INPUT | The policy adds `policy_id`, versioning, effective-date, approval, and audit trail requirements. This supports future legal/policy changes without silently rewriting history. |

Remaining boundary:

```ini
ACCOUNTING_POLICY_RESEARCH       = INITIAL_RESEARCH_COMPLETE
ACCOUNTING_POLICY_PROPOSAL       = READY_FOR_OWNER_ACCOUNTING_REVIEW
POLICY_VERSION                   = v1_PROPOSED
POLICY_STATUS                    = PROPOSED_PENDING_OWNER_ACCOUNTING_APPROVAL
OWNER_ACCOUNTING_APPROVAL        = NOT_PROVEN
BUSINESS_CONTRACT_APPROVED       = FALSE
SCHEMA_MIGRATION                 = NOT_AUTHORIZED
CODE_MUTATION                    = NOT_PERFORMED
PRODUCTION_MUTATION              = NOT_PERFORMED
```

## Final Classification

```ini
REVENUE_RECOGNITION_CONDITIONS      = APPROVED
REVENUE_RECOGNITION_IMPLEMENTATION  = NOT_PROVEN
EVENT_SEPARATION                    = APPROVED
PACKAGE_SALE_FOR_VEHICLE_REVENUE    = REJECTED
FINANCIAL_SNAPSHOT_PRINCIPLE        = APPROVED
FINANCIAL_SNAPSHOT_SOURCES          = NOT_PROVEN
LEDGER_MAPPING                      = NOT_PROVEN
REVERSAL_APPEND_ONLY_PRINCIPLE      = APPROVED
REVERSAL_FINANCIAL_RULES            = NOT_PROVEN
WARRANTY_ENTITLEMENT_PRINCIPLE      = APPROVED
WARRANTY_ENTITLEMENT_RULES          = NOT_PROVEN
IDEMPOTENCY_PRINCIPLE               = APPROVED
IDEMPOTENCY_STORAGE_CONTRACT        = NOT_PROVEN
BUSINESS_CONTRACT_APPROVED          = FALSE
SCHEMA_MIGRATION                    = NOT_AUTHORIZED
CODE_MUTATION                       = NOT_PERFORMED
PRODUCTION_MUTATION                 = NOT_PERFORMED
AUTOMOVE_FULL_PRODUCT_READINESS     = NOT_READY
```

## Next Action

Ask the AutoMove business owner and accounting owner to approve or revise the `NOT_PROVEN` decisions above. Do not design schema, migrate `FinancialReportingService`, migrate `WarrantyService`, or implement ledger posting until those decisions are recorded.
