# Bella Preschool Fixed / Recurring Fee — Finance Contract Gap Review

**Date:** 2026-11-03  
**Status:** `PROPOSED — FINANCE CONTRACT PENDING REVIEW`  
**Scope decision:** Fixed / Recurring first; Meal Usage and Event Participation are deferred.  
**Authority:** Read-only source review and contract proposal. This document does not approve a contract change, implementation, migration, database access change, F1/F2 change, F01 integration, or Production operation.

## 1. Review question and evidence boundary

This review asks whether Bella Preschool can submit a fixed/recurring Fee Obligation to Finance, receive an acceptance receipt without issuing an invoice, and later read invoice and payment states independently.

The source review covered the exported Finance contracts and SDK barrel, the semantic receivable service and its Supabase gateway, the Finance invoice and payment-allocation RPC migrations, the Finance F3 receivables constitution, ACR-2026-007, and the Finance generic service-receivable architecture gate. No database connection, live catalog, grants, runtime flow, or test suite was exercised. Findings below describe repository source; live/runtime behavior remains `NOT_PROVEN`.

“Public contract” in this review means a supported typed capability exposed for product consumers. An exported Finance service adapter, a gateway method, a table query, or an RPC used inside Finance is not automatically a cross-product contract merely because source code can import or call it.

## 2. Findings

| Need | Existing source capability | Gap / conclusion |
|---|---|---|
| Receive an obligation and acknowledge Finance acceptance without issuing an invoice | `ISemanticReceivableChargeContract.recognizeTuitionServiceReceivable` accepts tuition amount, customer, service period, recognition/due dates, and source identity. It returns invoice, transaction, and receivable identifiers after the recognition path completes. | **No separate intake/acceptance receipt was found** in the typed Finance contract. The service creates or reuses a draft invoice, adds a line when absent, finalizes it, then reads the resulting charge. This is not an interim acknowledgement contract. Do not use it as one unless Finance explicitly confirms the business and accounting semantics fit. |
| Read invoice state | The Finance service/gateway has `findInvoiceByNumber`, `readCharge`, and direct Finance invoice/receivable-position reads. `FinanceInvoiceSnapshot` includes a raw status string; `FinanceChargeReadModel` returns charge identifiers/counts. | **No invoice lifecycle query is declared by `ISemanticReceivableChargeContract` or in the Finance `contracts/` package.** The exported gateway port is an implementation-facing service boundary, not yet established as the supported Education read contract; `readCharge` itself does not return lifecycle status, issue/due timestamps, or observation provenance. Finance can confirm whether an existing read should be supported/promoted or whether a narrow consumer read is missing. |
| Read payment/settlement state | `allocateConfirmedPaymentToInvoiceReceivable` is a command that returns transaction, cash movement, allocation identifiers, allocated amount, and duplicate indication. The internal gateway can query open receivables and allocations; `ICashReportingEngine.getCashMovements` reads cash movements. | **No public invoice-level payment/settlement read contract was found in the Finance `contracts/` package.** Internal queries expose pieces (open balance/allocation/cash movement), not one canonical payment state with observation time and provenance. A cash movement is not an invoice payment state: it does not by itself establish allocation, remaining receivable, or `PARTIAL`/`PAID` status. The allocation command result is not a status query. |

### Reusable Finance surface

- The semantic receivable contract is a possible reuse point for invoice recognition **after** Finance confirms its semantics and invoice timing. Its current tuition path creates/finalizes an invoice; it does not stop at obligation acceptance.
- The confirmed-payment allocation contract is a possible Finance-owned command after payment confirmation and a Finance invoice/receivable exists. It returns identifiers for that operation, but does not fill the separate payment-state read requirement.
- The service's exported `FinanceReceivableChargeGateway` has internal invoice, open-receivable, allocation, and charge-read methods. Some can supply source facts, but the current consumer contract does not define the required invoice lifecycle/payment observation semantics or their status/provenance contract. Finance must determine whether to expose/reuse these safely for Product consumers.
- F1 `ILedgerEngine` is a ledger posting/reversal/reporting surface. It is not an Education obligation intake, invoice-status, or payment-status contract. Education must not use it to select accounts or accounting treatment.
- F2 `ICashReportingEngine` can report cash movements and positions. Those facts are useful Finance evidence but are not a canonical invoice settlement read.
- The Finance invoice lifecycle and payment-allocation RPCs are Finance-owned implementation boundaries. Their use by the current Finance service does not authorize Education to call them directly or query Finance tables.
- ACR-2026-007 approves a narrowly scoped Core consumer of the existing confirmed-payment-to-AR allocation contract. It does not approve a new Education consumer, a new acceptance/read contract, a schema/RPC change, or an accounting-policy choice.

## 3. Invoice timing and transaction boundary

The current `recognizeTuitionServiceReceivable` path is an orchestration over several calls: resolve semantic accounts, find/create a draft invoice, save metadata, check/add a line, finalize, and read the charge. The draft creation and line addition are separate RPC calls from finalization. The finalization RPC itself locks the invoice and invokes F1 posting before recording Finance receivable facts and invoice state; the F3 constitution requires this Finance accrual workflow to be atomic.

This source shape does **not** establish a single transaction across the Education obligation write and Finance invoice lifecycle. It also does not establish an intake-only Finance persistence step. Any design that relies on a shared Education–Finance transaction is therefore `NOT_PROVEN` and must not be assumed.

Finance must confirm the point at which a recurring Preschool obligation becomes an invoice, how invoice issue timing relates to its service period and the 01–05 collection window, and the applicable accounting treatment. The current finalize migration sends `ACCRUAL`; that is evidence of the current implementation path, not approval that it fits this product or timing. No accounting treatment is selected here.

For a future contract, keep the ownership boundary explicit:

1. Education durably records its immutable obligation and submission identity before requesting Finance processing.
2. Finance records an acceptance/rejection receipt under its own boundary. Acceptance means only the Finance-defined receipt semantics; it must not imply invoice issuance or payment unless Finance expressly defines that state transition.
3. Invoice and settlement are observed separately from Finance. A timeout or unreadable response remains `UNKNOWN` until reconciled.
4. If an event/outbox is used, it follows durable persistence. The implementation mechanism is not prescribed by this review.

### Recovery cases to settle in the contract

| Interrupted point | Source of truth | Minimal recovery behavior |
|---|---|---|
| Education saved an obligation; Finance may not have received it | Education proves the obligation and its stable tenant-scoped submission identity. Finance must be able to report receipt state by that identity even before an invoice exists. | Keep the Education submission pending/unknown. A `NO_RECEIPT` result is actionable only under Finance-defined lookup/idempotency consistency semantics that also account for an in-flight acceptance. Resubmit only with the same immutable payload and same idempotency identity. Do not create a second obligation identity or retry with a new key. |
| Finance accepted; Education lost the reply | Finance's durable acceptance/rejection receipt, queryable by the same tenant-scoped obligation identity even before invoice creation. | Education reads/replays using the same identity and adopts the same canonical receipt. Do not issue another obligation or invoice because the response was lost. |
| Finance created a draft invoice; finalization/issue did not complete | Finance invoice lifecycle and linked obligation/source identity. | Read the existing invoice and its canonical state; Finance continues or repairs that invoice using its own lifecycle/idempotency boundary. Do not create a replacement invoice. Education must not describe a draft as issued or settled. |
| Finance posted a cash receipt; allocation did not complete | Finance cash receipt/movement and Finance receivable allocation/position. | Read both receipt and allocation facts. Finance resumes/reconciles allocation against the same payment identity without reposting cash. A receipt with no allocation is not invoice settlement; Education must not report the obligation paid. |

The labels “pending”, “unknown”, and “received but unallocated” above describe recovery conditions, not approved enum values. Finance owns the canonical statuses and read semantics. `UNKNOWN` is an integration observation state while owner truth cannot be read, not a financial success/failure state.

This recovery path needs only stable identity, idempotent commands, owner-backed reads/receipts, and reconciliation. It does not presume a new workflow engine, distributed transaction, or separate orchestration platform.

**Pre-invoice lookup is a decision-critical capability.** The inspected tuition contract accepts business source type/ID, while the Finance service builds an invoice number and its gateway looks up an existing invoice by that number. That lookup can find an invoice; it cannot establish whether Finance accepted an obligation before any invoice exists. No pre-invoice receipt lookup keyed by a tenant-scoped external obligation identity was found in the inspected public Finance contracts. Finance must confirm whether another supported surface provides this. If not, it is part of the contract gap: Education cannot safely distinguish “not received” from “accepted but not yet invoiced” after a timeout, and must remain `UNKNOWN` until Finance can answer by the same identity.

**A negative lookup must be safe under concurrency.** Finance must define lookup and intake against the same tenant-scoped identity/idempotency mechanism. A lookup must not return actionable `NO_RECEIPT` while an earlier submission with that identity can still commit unseen. Finance may expose an explicit in-progress result or otherwise serialize/coordinate lookup and acceptance; the contract must define which outcomes mean `NO_RECEIPT`, `PROCESSING`, accepted/rejected, and `UNKNOWN`. Repeating the intake with the same identity and identical immutable payload must converge on one canonical receipt; a changed payload with that identity must conflict. These are semantic guarantees, not a prescribed database or locking design.

## 4. Idempotency, failure, and reconciliation requirements

The existing recognition path constructs a deterministic invoice number from tenant, semantic/source identity, service period, and recognition date, then uses the persistent invoice `posting_attempt_id` and request hash for finalization. The tuition contract does not accept an Education obligation idempotency key or return a distinct obligation-acceptance receipt. The payment command accepts an idempotency key; its implementation posts a cash receipt, projects the cash movement, finds the movement, and allocates it through multiple calls.

These are useful source-level mechanisms, but they do not prove end-to-end exactly-once delivery, changed-payload conflict behavior for a Fee Obligation, or recovery behavior in the live environment. The next Finance contract should specify at least:

- A stable tenant-scoped external obligation identity/idempotency key and a canonical request fingerprint over immutable economic facts.
- Same key plus same payload returns the same canonical receipt/result; same key plus changed payload returns a conflict requiring an explicit correction path.
- A Finance acceptance receipt with a stable reference, acceptance/rejection result, decision time, and rejection reason/code where applicable.
- A timeout or lost reply is `UNKNOWN`. Reconciliation uses the same identity and reads Finance state before any new submission; callers do not report accepted, invoiced, or paid from an unconfirmed response.
- Finance-defined recovery for a draft invoice or cash receipt that exists while a later step (line, finalization, projection, or allocation) did not complete. Retrying must not create a second invoice, receipt, or allocation.
- Invoice and payment/settlement read results identify their owner, observed/effective timestamp, source reference, and whether the value may be stale. A payment state must not be synthesized from cash receipt alone.

The current multi-call paths expose partial-failure points. In particular, confirmed payment can have a posted cash receipt before projection/allocation completes. A later read/reconciliation must distinguish that fact from successful invoice allocation. Do not collapse the result to `PAID` on the Education side.

## 5. Minimal extension proposal — for Finance review only

First, Finance should identify whether an existing supported contract outside the inspected typed surface already provides the required receipt and read semantics. If none exists, the narrowest contract gap is:

1. **Obligation intake/receipt:** a Finance-owned idempotent command accepting the immutable Education obligation identity and agreed economic snapshot, returning accepted/rejected with canonical Finance reference and receipt metadata. Finance must also support lookup by that same tenant-scoped identity before an invoice exists, so a caller can distinguish no receipt from a received/processing/accepted/rejected request. `NO_RECEIPT` must be consistent with concurrent intake under the same idempotency mechanism; same-identity/same-payload replay converges on one receipt, while a changed payload conflicts. It must be a distinct stage from invoice issue unless Finance chooses and documents a combined semantic.
2. **Invoice observation:** a Finance-owned read of the invoice linked to that obligation, including Finance's canonical lifecycle state, relevant issue/due timestamps, and source/provenance.
3. **Settlement observation:** a Finance-owned read of payment allocation and remaining receivable for that invoice, with Finance's canonical state and observation/provenance metadata.

These are requirements, not prescribed method names, DTOs, schema, or RPCs. Finance may satisfy them with one contract exposing separate command/read operations or by reusing an existing public surface. No new contract, RPC, table, or migration is authorized by this proposal.

## 6. Four Finance owner decisions

1. **Finance acceptance:** Does Finance persist a separate acceptance/rejection receipt before invoice creation/finalization? What facts does that receipt confirm, and can Education query that receipt by the same tenant-scoped external obligation identity before an invoice exists? What canonical reference and decision time can Education read, and what concurrency guarantee makes `NO_RECEIPT` safe to act on?
2. **Invoice timing:** When is a recurring Preschool invoice created/finalized relative to the service period and the collection window (days 01–05)? Which Finance-owned accounting treatment applies? Finance chooses; Education does not.
3. **Settlement read:** Which canonical observations distinguish no payment received, payment received but not allocated, partially allocated, and fully settled? What timestamp, source/provenance, and stale/unknown behavior accompany those observations?
4. **Recovery:** For each interruption in §3, what supported Finance lookup/replay/continuation contract restores owner truth using the same identity without duplicate invoice, receipt, or allocation? In particular, can Finance distinguish “no receipt” from “accepted but not yet invoiced” by lookup before invoice creation, including while intake is in flight? Can existing service/gateway reads be supported for this purpose, or is a narrow Finance-owned extension needed?

Authorization and tenant scoping remain mandatory design/implementation criteria, but are not a fifth business decision in this review. The source review does not prove current grants, RLS, or runtime enforcement.

## 7. Acceptance criteria for closing this gap review

- Finance identifies the canonical supported command and separate invoice/payment read surfaces, or confirms the precise missing capabilities.
- Finance can query intake/receipt state by the stable tenant-scoped obligation identity before invoice creation, or confirms that this is a required contract extension. An invoice-number lookup alone does not satisfy this criterion.
- Lookup and intake share defined idempotency/concurrency semantics: no stale or premature `NO_RECEIPT` may race with an in-flight acceptance; same-key/same-payload replay converges on one receipt, and same-key/changed-payload conflicts.
- Acceptance, invoice, and payment semantics are independent and have owner-defined state/provenance.
- Invoice timing and accounting treatment are decided by Finance before choosing a recognition path; no implicit F1 `ACCRUAL` selection.
- Transaction boundaries and recovery for timeout/partial completion are explicit; cross-owner atomicity is not assumed.
- Idempotency covers the immutable obligation identity and payload, including same-key/different-payload conflict behavior.
- Tenant authorization and read access are identified, with runtime proof deferred to a separately authorized implementation/verification phase.

## 8. Status and next step

- Product Definition Gate: `IN PROGRESS`.
- Fixed / Recurring Contract Design: `PROPOSED — CONTRACT DESIGN`.
- Finance Contract: `PENDING REVIEW`.
- F01, F1, F2, schema, database, and Production: outside this worktree's scope; unchanged by this review.
- No tests or runtime checks were run; this is a source-based gap review, not implementation evidence.

Next step: Finance owner answers the four decisions in §6 and confirms whether the existing Finance surface can meet them or a minimal gap remains. Then update the contract proposal only where those answers affect the boundary. Do not proceed to migration or implementation from this document alone.

## 9. Source references

- [Finance contract barrel](../../src/platform/finance/contracts/index.ts)
- [Semantic receivable, tuition, and confirmed-payment contract](../../src/platform/finance/contracts/receivable-charge.contract.ts)
- [Cash reporting contract](../../src/platform/finance/contracts/cash-engine.contract.ts)
- [Ledger contract](../../src/platform/finance/contracts/ledger-engine.contract.ts)
- [Semantic receivable orchestration](../../src/platform/finance/services/semantic-receivable-charge.service.ts)
- [Supabase receivable-charge gateway](../../src/platform/finance/gateways/supabase-receivable-charge.gateway.ts)
- [Finance invoice lifecycle RPCs](../../supabase/migrations/20260817010000_finance_invoice_lifecycle_rpcs.sql)
- [Finance payment allocation RPCs](../../supabase/migrations/20260817020000_finance_payment_allocation_rpcs.sql)
- [F3 Accounts Receivable Constitution](../architecture/F3_ACCOUNTS_RECEIVABLE_CONSTITUTION.md)
- [ACR-2026-007](../architecture/acr/ACR-2026-007-finance-payment-ar-contract-core-consumer.md)
- [Finance OS Generic Service Receivable Architecture Gate](../architecture/ARCHITECTURE_GATE_RESULT_FINANCE_OS_GENERIC_SERVICE_RECEIVABLE.md)
