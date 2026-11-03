# Bella Preschool Fixed / Recurring Fee Program — Contract Design Proposal

**Date:** 2026-11-03  
**Status:** `PROPOSED — CONTRACT DESIGN`  
**Product Owner scope decision:** Fixed / Recurring first; Meal Usage and Event Participation deferred, confirmed 2026-11-03.  
**Authority:** design proposal only. No new contract, schema, migration, runtime implementation, F01 integration, Production change, or publication is approved by this document.  
**Baseline:** `origin/main` `b3ccd5903b9ef03395e91be88e30c2a424878992`.

## 1. Scope and design boundary

This proposal covers Bella Preschool fixed and recurring fees with a determinable amount per service period: tuition and other approved recurring fee items. The supplied collection policy is monthly service periods with payment due from the 1st through the 5th of the applicable month; each obligation still resolves its exact due date from its authoritative billing-period record. It defines the Product-owned pricing source, assignment resolution, Enrollment commitment, immutable period snapshot, Fee Obligation semantics, and the boundary to Finance.

Meal attendance and usage settlement, event participation/guardian consent, a general promotion engine, mid-period proration, and broad repricing rules for all current students are outside this first contract design. If an excluded or unresolved rule is required to calculate a particular charge, that charge remains on hold. No default price, period, discount behavior, or accounting treatment may fill the gap.

This is a Product-specific capability proposal. It does not create a new Education Kernel, modify the Education Enrollment contract, or grant F01 implementation authority. The Education Finance Product Definition Gate remains recorded as `IN PROGRESS`; this scoped design proposal does not declare that gate or the broader Product Definition complete.

This proposal follows the approved first-scope boundary in the [Fee Program Product Definition](EDUCATION_FEE_PROGRAM_PRODUCT_DEFINITION_PROPOSAL.md) and retains the status in the [Education Finance Product Definition Gate](EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md).

## 2. Evidence and current-state mapping

The repository's [Education Enrollment public contract](../../src/platform/education/contracts/enrollment.contract.ts) exposes Enrollment create/read DTOs. The DTO does not contain a fee-program/version binding. This proposal therefore places the proposed fee commitment in the Bella Preschool Product ownership boundary and references the canonical Enrollment ID through its public contract. It does not propose a direct write to `edu_enrollments` or an Education Kernel entity change.

The P7.1 migration defines `edu_fin_fee_structures` with tenant/program, fee code/type, amount, currency, billing cycle and active flag; it has no fee-version/effective-date fields in that migration. It also defines billing periods with start/end, due date and status, and student discount profiles with validity dates. These migration definitions are source evidence, not proof of the current database catalog or its data.

The current [TuitionBillingService](../../src/products/bella-education/finance/services/tuition-billing.service.ts) selects the first active `TUITION` structure, accepts billing-period ID and due date from its caller, and calculates discounts from active student profiles. This source behavior does not establish a unique enrollment assignment, a historical price version, or an authoritative due-date resolution. It is not the proposed resolver contract.

Finance has a typed [semantic receivable contract](../../src/platform/finance/contracts/receivable-charge.contract.ts). Its `recognizeTuitionServiceReceivable` input carries one aggregate amount, currency, service-period dates, recognition/due dates and business-source identifiers. The implementation creates a draft invoice, adds an invoice line, finalizes it and returns Finance invoice/transaction/receivable identifiers plus policy evidence. This is a multi-step TypeScript orchestration; same-transaction composition with an Education operation has not been proven.

The source migration for the current `finance_finalize_invoice` calls F1 with `ACCRUAL`. That is a source finding about the existing path, not approval to use it for this fee program. Finance must determine the treatment for the actual service/billing timing before a path is selected.

The same Finance contract has `allocateConfirmedPaymentToInvoiceReceivable`, which accepts invoice/source identifiers, amount, currency, method, received time and an idempotency key. Its implementation posts a cash receipt, projects cash, finds the resulting movement and allocates it. The result identifies the transaction, movement and allocations; the interface does not expose a separate payment-status enum or actor/payment-evidence fields.

Repository and migration inspection do not prove a live DB schema, source rows, grants, transaction boundary, or Finance policy suitability for advance billing. Those remain `NOT_PROVEN` and belong to later authorized verification.

## 3. Ownership and contract dependency

| Data or decision | Owner | Boundary |
|---|---|---|
| Fee Program, immutable versions, assignments, explicit discount policy and applicability | Bella Preschool Product | Product-owned public capability; tenant scoped |
| Canonical Enrollment identity and lifecycle | Education Enrollment contract | Read/reference through the public contract; this proposal adds no Kernel write |
| Service-period source and due date | Bella Preschool billing-period source, validated for the Enrollment/tenant | Resolver must return one applicable period or fail closed |
| Fee calculation and snapshot | Bella Preschool Product | Explainable, version-bound, immutable after confirmation |
| Fee Obligation business meaning and retry identity | Bella Preschool Product | Separate from Finance invoice, AR and payment records |
| Finance acceptance, invoice, AR, payment, reconciliation, accounting and audit | Finance OS/Platform | Finance validates and owns financial processing and state |

Dependency path:

```text
Education Enrollment public read
  → Bella Preschool Fee Assignment + Program/Item Version resolver
  → Enrollment Fee Commitment
  → Service-period pricing snapshot + Fee Obligation
  → Finance obligation intake/acceptance
  → Finance invoice state
  → Finance payment/settlement state
```

Education supplies the business basis and calculated amount. It does not select GL accounts, issue accounting entries, or decide whether Finance recognizes revenue immediately or defers it.

## 4. Proposed logical contract model

These are semantic contract requirements, not approved TypeScript interfaces or persistence schemas.

### 4.1 Program, version and assignment

- A Fee Program is tenant scoped and contains one or more recurring Fee Items.
- A Program Version groups the policy configuration effective for enrollment resolution. Each Fee Item Version carries the item identity, amount, currency, recurrence basis, effective interval and any explicitly approved pricing rule.
- A Fee Assignment binds an exact target (such as a class, group or student) to a Program Version for an effective interval. This proposal defines no specificity priority. The resolver evaluates the approved assignment rules and returns exactly one complete applicable set; zero or multiple results produce `NOT_FOUND` or `AMBIGUOUS` and no obligation.
- A version already referenced by an Enrollment commitment or service-period snapshot is immutable. Corrections are additive and linked to the original decision/record.

### 4.2 Enrollment commitment

When a pending Enrollment is confirmed, the Product resolves the uniquely applicable assignment and records an Enrollment Fee Commitment referencing the Enrollment, Program Version and all applicable Fee Item Versions. The commitment preserves the version initially offered/accepted; repricing never overwrites it.

The design proposes a Product-owned reference/commitment operation that consumes a canonical Enrollment identifier obtained through the Education public contract. How that operation composes atomically with F01 admission confirmation is outside this document and remains a separate ACR-controlled design/implementation decision.

### 4.3 Service-period pricing snapshot

For each Enrollment and recurring service period, the Product resolves the applicable Fee Item Version and creates an immutable calculation snapshot. The snapshot must be sufficient to reconstruct the result without consulting mutable “current price” data and contains at minimum:

- tenant, Enrollment, Program Version, Fee Item Version and Assignment references;
- service-period ID, start/end dates and the applicable due date from that same authoritative period, consistent with the supplied 1st–5th collection window;
- the Enrollment's original committed version;
- the version actually applied to this period;
- any separate, effective-dated price-change decision when those versions differ, including decision reference, effective period, actor and reason;
- currency, quantity, unit, effective unit price, gross amount, discount/promotion policy version and amount actually applied, and net amount;
- calculation basis, source reference/revision, calculation timestamp and immutable request identity.

If no approved price-change decision exists, use the Enrollment's committed version only when it remains valid for the service period. If it is expired, unavailable or ambiguous, hold the period. Do not silently substitute a newer version. Commercial repricing terms and approver roles remain open.

Discount handling is limited to rules explicitly approved for this scope. A discount is applied only when its eligibility, effective version and calculation rule resolve deterministically. Otherwise hold the affected obligation. This proposal does not define stacking, promotion combinations, proration or an engine for arbitrary rules.

### 4.4 Fee Obligation lifecycle and idempotency

The Education Fee Obligation is the Product's confirmed business claim for one Enrollment/service-period calculation. It is distinct from a Finance acknowledgement, invoice, receivable balance and payment. Candidate lifecycle semantics are:

```text
CALCULATED → CONFIRMED → SUBMITTED → FINANCE_ACCEPTED
                                 ↘ FINANCE_REJECTED
                                 ↘ UNKNOWN (outcome must be reconciled)
```

`CONFIRMED` means the Education snapshot is durably recorded. `FINANCE_ACCEPTED` means Finance has acknowledged the obligation under its contract; it does not mean an invoice was issued or paid. Invoice status and payment/settlement status are separate Finance-owned values/read models. Their exact enums are not prescribed here.

Candidate business identity is tenant + Enrollment + service-period ID + fee-program/obligation purpose, with the included Fee Item Versions fixed by the immutable request. A same-identity/same-payload retry returns the existing canonical result. A same-identity/different-payload request conflicts; corrections use a linked adjustment rather than replacing history. Timeout leaves the result `UNKNOWN` until a read/retry with the same identity reconciles it. This is an idempotent-effect requirement, not a claim of exactly-once delivery.

## 5. Proposed public contract boundaries

### Education / Bella Preschool

The Product needs contract capabilities equivalent to:

1. **Resolve fee assignment and commitment** for `(tenant, enrollment, service period)` and return the exact effective Program/Item versions and provenance, or a typed no-match/ambiguous/invalid-period result.
2. **Create/read Enrollment Fee Commitment** referencing the initial accepted versions while preserving the Enrollment's canonical identity and tenant.
3. **Calculate and confirm a service-period obligation** from that commitment and period, persisting the complete immutable snapshot and stable business idempotency identity.
4. **Submit/reconcile obligation state** through a Finance-owned contract and read the separate Finance acknowledgement, invoice and payment observations without synthesizing financial success.

These operations are candidate boundaries for Contract Design. Exact ownership between an Education OS shared contract and Bella Preschool Product contract, concrete function names, storage and event transport require review against existing public contract rules before implementation. The fee/pricing semantics remain Product owned.

### Finance OS/Platform

The current `recognizeTuitionServiceReceivable` is reusable only if Finance confirms the semantic and accounting policy fits the service period being billed. It currently couples recognition with invoice creation/finalization and expects one aggregate amount; it does not expose a separate obligation-acceptance receipt. Do not treat it as an approved generic pre-service invoice operation.

Contract Design should first ask Finance to identify an existing public operation/read model that can:

- accept an immutable Education Fee Obligation and return a canonical accepted/rejected/conflict receipt;
- issue or report the invoice separately from obligation acceptance;
- report payment/settlement state separately from invoice state;
- preserve the Education source/version/snapshot reference and stable idempotency/correlation identity;
- return canonical Finance IDs and failure reasons while keeping Finance responsible for ledger treatment.

The repository scan did not find this three-state boundary in the current typed Finance contract. If Finance confirms no equivalent exists, propose a narrow Finance-owned extension for review. Do not add it in this Product document, call Finance tables directly, duplicate Finance logic, or make Education choose accounting treatment.

### Mapping to existing Finance capabilities

| Requirement | Existing candidate | Reuse result / gap |
|---|---|---|
| Recognize a tuition service receivable | `recognizeTuitionServiceReceivable` | Carries amount, currency, period, dates and business source; creates/finalizes invoice and returns IDs/policy evidence. Its semantics and timing may not fit advance billing; no separate intake acceptance. |
| Preserve item-level fee snapshot | Business source ID + aggregate tuition input | Current typed tuition input lacks itemized fee/version/discount snapshot. A source reference alone does not establish that the historical snapshot is immutable or readable. |
| Distinguish Finance acceptance from invoice issuance | No matching operation identified in current typed contract | Gap to confirm with Finance owner; current recognition call proceeds through invoice finalization. |
| Read invoice state | Finance invoice lifecycle/read implementation | Invoice lifecycle exists in SQL/source, but this scan did not establish a suitable public Product read contract for the required state. |
| Record payment and allocate to invoice | `allocateConfirmedPaymentToInvoiceReceivable` | Takes invoice/source, amount, currency, method, received time and idempotency key; returns receipt transaction, movement and allocation. It does not return a canonical payment-status enum or carry the full actor/evidence fields required by the admission policy. |
| Finance accounting decision | Finance semantic/account mapping path | Finance owns mapping and posting. Suitability for recurring tuition billed before/during service remains a Finance decision; no F1 `ACCRUAL` assumption is made. |

## 6. Failure, authorization and history requirements

- Tenant and actor authorization are enforced at the owning contract boundary; caller-supplied tenant or actor values do not grant authority.
- Enrollment, assignment, program version, fee item and billing period must all resolve within the same tenant.
- No assignment, multiple assignments, inactive/expired version, missing/ambiguous period or unknown discount rule yields no confirmed obligation and no Finance request.
- Finance timeout or unavailable readback is `UNKNOWN`, not accepted, invoiced or paid. Retry/reconciliation uses the same immutable business identity.
- Once confirmed, commitment and period snapshot are append-only. A correction records a new linked decision/snapshot and does not rewrite an issued invoice or prior calculation.
- Finance is the only source for invoice, receivable, payment, reconciliation and accounting status. Education projections carry source identity and observation time and may be stale/unknown.
- Events (if used) follow durable persistence. This proposal does not prescribe event infrastructure or a new abstraction.

## 7. Contract acceptance criteria

The Fixed / Recurring contract design is ready for owner review when it can demonstrate:

1. A unique, tenant-scoped assignment resolver for an Enrollment and service period; no priority fallback is invented.
2. An Enrollment commitment retains its original Program/Item versions through repricing.
3. Each service-period snapshot identifies both the committed versions and the actually applied versions, and contains enough immutable values/provenance to reconstruct the calculation.
4. A different period version requires a separate effective-dated, actor-attributed, reasoned decision; absent or invalid decision holds the period.
5. The billing-period ID and due date resolve from one authoritative, applicable period. Missing or ambiguous period holds the obligation.
6. Discounts are limited to deterministic approved rules; unsupported or ambiguous discount cases are held.
7. Education obligation confirmation, Finance acceptance, invoice state and payment state are independently represented and read back from their owners.
8. Same-key replay is stable; changed payload conflicts; timeout is reconciled without duplicate effect or false success.
9. Finance reuse/extension and accounting semantics are reviewed by the Finance owner; no direct Product writes to Finance/Education-owned data and no accounting rule is selected in Education.
10. Tenant isolation, authorization, audit provenance, rollback and failure behavior are specified for later implementation verification.

These are design acceptance criteria. They have not been run as tests and do not prove database or runtime behavior.

## 8. Decisions retained for later

| Topic | Treatment in this first design |
|---|---|
| Mid-period proration | Out of scope; hold if a fee calculation depends on it. |
| Assignment precedence | No generic ranking; exact one result or hold. |
| Discounts | Support only explicitly approved deterministic rules; broader stacking/promotions deferred. |
| Active Enrollment repricing | Preserve original commitment; period-specific change needs an explicit decision. Commercial policy remains open. |
| Billing calendar edge cases | Require valid period/due date source; holidays/time zone exceptions remain open. |
| Finance accounting treatment | Finance owner decision before integration; this document selects none. |
| Meal Usage and Event Participation | Later design phases; no model expansion here. |

## 9. Design decision and next review

**Proposed direction:** keep program/version/assignment and pricing snapshots in the Bella Preschool Product boundary; bind them to the canonical Enrollment by reference; create immutable period obligations; send them through a Finance-owned intake/processing boundary with distinct acceptance, invoice and payment observations. Reuse the existing Finance tuition-recognition and payment contracts only where Finance confirms their semantics and state/read requirements fit. Otherwise return a narrowly scoped Finance contract proposal for owner review.

**Open review items:** Finance owner to identify the canonical obligation-acceptance and invoice/payment read contracts; confirm the treatment/eligibility of recurring tuition invoices for their service-period timing; Product Owner to confirm the commercial rule for a future-period version change if needed. These items do not authorize implementation.

**Status:** proposal for Product Owner and Finance owner review. The Product Definition Gate remains as recorded (`IN PROGRESS`); no gate PASS, contract approval, migration, implementation, F01 integration, F1/F2 change, commit, push, merge or Production approval is claimed.
