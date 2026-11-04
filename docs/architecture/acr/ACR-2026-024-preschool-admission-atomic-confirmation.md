# ACR-2026-024 — Preschool Admission Atomic Confirmation (F01)

**Date prepared:** 2026-11-02

**Submitted by:** F01 workstream (draft prepared by Codex)

**Status:** `APPROVED — LOCAL/TEST ARTIFACT SCOPE / IMPLEMENTATION WINDOW OPEN / ACCEPTANCE AND RESEAL HELD`

**Owner decisions (2026-11-02):** `APPROVE BOUNDARY IN PRINCIPLE`; omitted `admissionMode` defaults to `DEBT`; `PAID` requires payment evidence and successful Finance reconciliation; Preschool-owned fee/tuition-plan and applicable billing-period data are the source for what the family owes, and missing or ambiguous source data fails closed. Payment collection supports `CASH`, `BANK_TRANSFER_MANUAL`, and `BANK_TRANSFER_AUTO` through one shared Finance Platform payment-confirmation capability. Every confirmation or adjustment must retain the responsible user or identified service actor and an immutable audit event. Education owns the `pending → active` Enrollment transition; Bella Preschool owns admission, fee semantics, pricing, and idempotency; the existing Bella Finance OS under `src/platform/finance` owns generic invoices, receivables, payment, cash/bank, reconciliation, and financial audit truth. These decisions define business behavior and the intended reuse boundary; they do not by themselves unlock the frozen Education contract artifact or authorize Production, Git publication, or deployment changes.

**Additional owner direction (2026-11-03):** F01 may progress independently of completing Fee Program management. Its request boundary will reference one immutable, tenant-scoped `feeProgramVersionId` and the selected `feeItemVersionIds`; it will not accept client-supplied prices, totals, discount results, due dates, actor, or tenant. The atomic command must resolve and verify those IDs against the published Fee Program source for the enrollment and applicable service period. Usage-based meal charges come from confirmed daily usage and are outside Admission confirmation; extracurricular/event fees are also excluded. No item selection precedence, billing-period rule, discount calculation, or accounting treatment is inferred by this direction. If the version/items cannot be uniquely resolved, confirmation remains fail-closed. Fee Program contract design and implementation remain a separate workstream and are not included in this ACR's F01 artifact list.

## Summary

Request review of one additive Education Enrollment contract capability for activating an existing Preschool enrollment in `pending` state, plus one Preschool-owned admission confirmation transaction that commits the required Finance records and the activation together. Preserve the current HTTP request/response contract, caller authorization and tenant boundary. The current endpoint remains fail-closed until the required exact artifacts are approved and their data sources/transaction are verified.

## Affected layers and ownership

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Education Kernel's frozen public Enrollment contract — exact, conditional scope below.
- [x] Other: Bella Preschool Product Admission persistence and orchestration.
- [x] Other: existing Finance OS/Platform public contract for generic invoice, receivable, collection, and audit capabilities; no frozen F1 Kernel change is proposed here.

**Ownership:** Education owns the canonical Enrollment transition. Bella Preschool owns admission confirmation, the effective fee/tuition plan, billing-period selection, and its operation/idempotency record. Finance OS/Platform owns persisted generic invoices, receivables, collected payment, cash/bank facts, reconciliation, and financial audit trail. The Product may invoke public Education and Finance contracts; it may not write Education Kernel or Finance Platform transaction tables directly.

**Product manifest and scope:** Existing Bella Preschool (`bella-education`) only; the requested capability is Admin confirmation for one existing pending enrollment. Reuse the existing Finance OS/Platform (`src/platform/finance`) and existing Education Enrollment contract boundary. Do not create a new OS, product, registry entry, Finance subsystem, or cross-Product migration. Other products are future consumers and are not implementation targets in this ACR.

**Contract dependency map:** Preschool-owned effective fee/tuition plan and billing-period source → Finance Platform public invoice/receivable and payment-confirmation contracts → Education public pending-to-active contract → Preschool-owned admission/idempotency result. Every write to Finance or Education state remains behind its owning public contract.

## Current evidence

- The former `POST /api/education/enrollments/confirm-admission` path could return success after unchecked invoice, line-item and payment writes, then directly update enrollment status. The historical probe was synthetic and is retained in [the F01 audit finding](../../../docs/audits/preschool-operations-20261031/REPORT.md).
- Current `route.ts` is fail-closed and returns `503 ADMISSION_CONFIRMATION_UNAVAILABLE` before persistence. Its targeted route tests pass 4/4 on source HEAD `ed9d60eb8`; this proves the current unavailable/denial behavior, not admission completion.
- The public Enrollment contract exposes create/read operations, including a Preschool create capability, but no transition for an existing `pending` enrollment. The Kernel's internal aggregate has a pending-to-active rule; it is not currently exposed as a Product public contract.
- Finance SQL provides invoice creation/issuance commands and a payment-reconciliation command. In the current TypeScript path these are separate PostgREST operations; no existing command combines them with activation of an existing enrollment.
- The old UI displayed 5,700,000 VND and treated a PAID selection as a payment, but these UI literals do not prove the Preschool-owned canonical fee, billing period, meal charge, payment evidence, or payment method.

## Reason for change

### Business context

The current endpoint safely prevents false success but leaves the Admin admission-confirmation workflow unavailable. The required outcome is a single durable result: success is returned only after every canonical record required for the selected admission mode is committed and can be read back.

### Technical context

Separate PostgREST RPC calls commit separate transactions. Calling the existing invoice, payment and Enrollment operations sequentially would still leave partial records if a later call failed. Directly updating `edu_enrollments` in a Product function would bypass the frozen Education public-contract boundary. A composable Enrollment contract operation is therefore the proposed gap to review.

### Priority

- [x] P1 — admission confirmation and financial persistence must not disagree.

## Proposed change

### Exact proposed artifacts

The owner approved the following exact artifact scope for Local/Test on 2026-11-02. The Education contract files below are unlocked only for the pending-to-active capability described here. Acceptance and owning reseal remain held pending the required evidence.

```text
src/platform/education/contracts/enrollment.contract.ts
src/platform/education/contracts/enrollment.contract.impl.ts
src/platform/education/contracts/__tests__/preschool-enrollment.contract.test.ts
src/app/api/education/enrollments/confirm-admission/route.ts
src/app/api/education/enrollments/confirm-admission/__tests__/route.test.ts
src/app/dashboard/education/components/AdmissionConfirmModal.tsx (add only the evidence fields required by manual paid collection; preserve the existing modal flow)
src/products/bella-education/services/preschool-admission-confirmation.service.ts (new)
src/types/database.types.ts (only signatures for approved new RPCs)
supabase/migrations/20261103110000_education_preschool_pending_activation_contract.sql
supabase/migrations/<new>_preschool_admission_confirmation_atomic.sql
src/platform/finance/contracts/receivable-charge.contract.ts (additive shared payment-confirmation evidence/actor contract only if approved)
src/platform/finance/services/semantic-receivable-charge.service.ts (reuse or extend the existing shared confirmation capability only if approved)
src/platform/finance/gateways/supabase-receivable-charge.gateway.ts (Finance-owned implementation of the approved public contract only)
src/platform/finance/__tests__/ (one focused shared confirmation contract/behavior test only)
supabase/migrations/<new>_finance_payment_confirmation_atomic_audit.sql (additive Finance Platform command/audit capability only if existing SQL contracts cannot compose atomically)
```

The SQL migration for the Preschool Product may add one Product-owned confirmation/idempotency record only if catalog review confirms no existing record can bind a confirmation to `(tenant_id, enrollment_id, immutable request)` without reusing the distinct initial-intake operation. Any such table must have RLS enabled, no direct client DML grants, and access only through the reviewed command. No existing table, RLS policy, table grant, or Education Kernel entity is in scope.

The earlier local unlock for Enrollment artifacts recorded by ACR-2026-021 is closed and does not authorize this capability. This request requires its own exact review and unlock.

### Contract and transaction boundary

1. Add one explicitly Preschool-scoped operation to the Education Enrollment public contract. It may transition only an existing `pending` enrollment to `active`, preserves the existing aggregate lifecycle rule, and rejects missing, cross-tenant, inactive, or non-pending enrollments. It must not create a second enrollment or bypass existing enrollment eligibility/block rules.
2. The operation must be callable as an Education-owned SQL contract from the Preschool confirmation RPC **within the same PostgreSQL transaction**. A separate HTTP/RPC round trip from TypeScript is not sufficient for atomicity. If the existing public-contract form cannot support this composition without direct Product table access or a Kernel redesign, stop and return for a revised architecture decision.
3. Preschool prepares the payable amount and fee-line rationale from its effective Product-owned tuition/fee plan and applicable billing period; Finance Platform owns the generic invoice/receivable records and actual payment facts. One Preschool-owned confirmation command may compose public Education and Finance contracts inside one transaction, deriving the human actor from authenticated server context, verifying Admin/tenant/enrollment scope, and binding retries to a stable immutable request. It must not duplicate Finance rules or let Product write Finance tables. `DEBT` creates and issues the required invoice without creating a payment. `PAID` is accepted only when one of the three supported collection paths supplies its required evidence and Finance reconciliation succeeds in the same transaction. Manual bank transfer records transaction reference, amount, received time, and available matching details; automated reconciliation records the originating bank/intermediary transaction and a trusted service identity; cash records amount, received time, and the authenticated collector. The three paths use the same Finance Platform payment-confirmation capability; method/source are recorded distinctly so automated reconciliation is not misrepresented as an Admin action.
4. The Finance Platform payment-confirmation capability writes payment, cash/receivable allocation facts, receipt, idempotency result, and an append-only audit event in the same transaction. Human `actor_user_id`, `actor_role`, and tenant are derived from the authenticated User and canonical profile; `actor_party_id` is recorded only when an active canonical User-to-Party link exists. Automated reconciliation records a registered `actor_service_id` and source, never a fabricated Admin. Each audit event records `action`, target type/ID, before/after state, reason for adjustment/cancel/refund, `occurred_at`, source (`ADMIN_UI`, `BANK_RECONCILIATION`, or API), and correlation ID. Payment history is not updated or deleted; corrections, reversals, and refunds are new events. No two-person approval is required. All admission, invoice, payment, activation, and idempotency records commit or roll back together. A retry with the same immutable request returns the same canonical IDs; a changed payload conflicts. No success event or UI success callback occurs before commit.
5. Keep the existing request shape compatible: `enrollmentId` plus optional `admissionMode` remains valid, and omission means `DEBT`. Add an optional `paymentConfirmation` request object only for `PAID`, carrying the selected supported method and its required evidence; reject `PAID` when evidence is absent or invalid. Automated bank reconciliation is initiated by the trusted Finance integration, never by an Admin pretending to be the service actor. Preserve the historical success response fields (`success`, `enrollment`, `admissionMode`, `message`). The route derives the human actor from Auth and never accepts client-supplied actor/tenant; the UI calls `onConfirmed` only after committed success. No modal redesign is proposed, only the method/evidence inputs necessary for manual collection.

### Finance composition and existing sources

**Transaction composition assessment:** `PARTIAL / SAME-TRANSACTION RUNTIME NOT PROVEN`.

- The current `preschool_finance_branch_command` and `edu_fin_*` SQL path is legacy Product-local Finance, not the selected Finance Platform boundary. It may explain the current API behavior, but F01 must not treat it as the shared cross-Product payment contract.
- `create-invoice` accepts a precomputed invoice and line-item payload. Its SQL validates tenant, active billing period, branch, and draft fields, then persists the header and lines; it explicitly relies on the existing Product calculation service and does not select fees or calculate discounts.
- Current [TuitionBillingService](../../../src/products/bella-education/finance/services/tuition-billing.service.ts) reads fee structures/discounts and builds the draft, but `compileDraftInvoice` then persists it through [PreschoolFinanceRepository](../../../src/products/bella-education/finance/repositories/preschool-finance.repository.ts), whose branch path calls PostgREST RPC. Current [InvoiceIssuanceService](../../../src/products/bella-education/finance/services/invoice-issuance.service.ts) reads the persisted invoice, computes its canonical checksum in TypeScript, then makes another repository/RPC call to issue it. Calling these methods as-is cannot participate in an outer PostgreSQL transaction.
- The payment path is more composable: [PaymentReconciliationService](../../../src/products/bella-education/finance/services/payment-reconciliation.service.ts) delegates to the Finance atomic reconciliation command with a stable operation key, amount, and payment method. That SQL function is nested by the Finance branch command, but `admissionMode = PAID` alone supplies neither valid payment evidence nor the canonical reconciliation request.
- **Finance Platform SQL composition candidate:** source migrations define `finance_create_draft_invoice`, `finance_add_invoice_line`, and `finance_finalize_invoice`; finalization calls the existing F1 `finance_post_transaction`. The F2 `finance_internal_project_cash_transaction` returns the projected movement IDs, and F3 `finance_allocate_payment` consumes those IDs. PostgreSQL nested function calls run in the caller's transaction, so a Finance-owned SQL capability can potentially compose these existing contracts inside the Admission transaction without copying F1/F2/F3 rules. This is a source-level candidate, not runtime proof: target database function owners, execute privileges, security-definer context, replay behavior with the after-commit outbox worker, and exact tenant scoping still require verification. The F1 Ledger artifacts remain frozen and out of scope.
- Current Education [Enrollment contract](../../../src/platform/education/contracts/enrollment.contract.ts) exposes create/read, not pending-to-active. Its implementation uses authenticated PostgREST for creation. An Education-owned SQL-callable activation contract does not currently exist; it remains the narrow Kernel gap proposed by this ACR.

**Exact Finance composition gap:** Preschool owns the effective fee/tuition plan and payable amount, so a new Finance-specific fee calculator is not required. The existing Finance Platform public receivable contract can create a generic invoice/receivable from a Product-provided amount, but its TypeScript implementation performs Finance calls separately. It does not currently expose one SQL-callable contract that can be composed with Admission activation in the same PostgreSQL transaction, and it lacks the owner-required payment evidence, actor provenance, source, and complete append-only audit event. Do not call its TypeScript steps sequentially and describe them as atomic. A narrow reusable Finance Platform capability is required only if source/privilege review cannot compose existing public SQL contracts inside one outer transaction; no Finance rule may be copied into Preschool.

**Finance Platform reuse assessment:** Bella already has Finance OS/Platform under `src/platform/finance`, with public F1 ledger, F2 cash, and F3 receivable contracts. `ISemanticReceivableChargeContract` exposes `recognizeTuitionServiceReceivable` and `allocateConfirmedPaymentToInvoiceReceivable`; the latter accepts source, amount, currency, method, received time, and idempotency key. The charge contract currently accepts one aggregate amount/description rather than an itemized Product charge list. Its gateway separately calls draft-invoice creation, one invoice-line creation, invoice finalization, F1 posting, F2 cash projection, and F3 allocation. This is a shared capability foundation, but it cannot currently represent the full Preschool fee rationale or participate with invoice creation, payment, and Education transition in one PostgreSQL transaction. F01 must consume public Finance Platform contracts, keep Preschool fee/pricing semantics in the Product, and never write `finance_*` tables directly or create a Preschool-only payment writer. The narrow Finance Platform extension may accept Product-owned line items and add one composable payment-confirmation boundary with complete actor/evidence audit, subject to approval. This does not create a new Finance OS or modify the frozen F1 Ledger artifacts.

**Payment confirmation and audit evidence gap (source review):** the existing Finance Platform confirmed-payment contract does not carry the authenticating actor, payment evidence, confirmation source, or correlation ID. The existing Preschool `preschool_reconcile_finance_atomic` command is not the shared Platform contract: its normalized request contains only invoice ID, amount, and method; it has no transfer evidence/source/correlation or service actor contract. Its `p_actor_id` is validated as an Auth-backed `public.users.id`, then also written into `reconciled_by_party_id`, a Party-identity field. It only accepts `BANK_TRANSFER`, `CASH`, `QR_CODE`, and `CARD`. Neither path alone meets the owner-defined audit requirements. The generic `finance_audit_trail` is not a drop-in substitute: it lacks actor role/source/correlation fields, its current grants permit authenticated DML, and existing ledger SQL can insert a NULL actor. The minimal target is one Finance Platform payment-confirmation capability for `CASH`, `BANK_TRANSFER_MANUAL`, and `BANK_TRANSFER_AUTO`, with method/source and actor type recorded distinctly, idempotency, and append-only audit data written in the same transaction. It must not alter the frozen F1 ledger contract or introduce three payment writers.

**Business-source assessment:** the [Finance Product Definition Gate](../../education/EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md) remains `IN PROGRESS`; the [P1-P4 proposal](../../education/EDUCATION_FINANCE_P1_P4_PRODUCT_DEFINITION_PROPOSAL_V1.md) remains a proposal. The owner has selected the effective Preschool-owned fee/tuition plan and applicable Preschool billing period as the source, with fail-closed behavior when absent or ambiguous; omitted mode is `DEBT`; and `PAID` requires evidence plus reconciliation. The application still needs to prove that the target tenant/student has exactly one applicable tuition plan and period and derive its due date from that period. Current `TuitionBillingService` chooses the first active TUITION fee and accepts caller-supplied period/due date, so it does not yet establish that mapping. The three owner-defined payment methods and audit requirements are recorded above, but existing Finance Platform operations cannot yet persist all required evidence and actor provenance atomically. No amount, discount, period, or due-date value is inferred from seeds or UI literals.

### Business inputs required before implementation

Owner-level policy is supplied. `BUSINESS_SEMANTICS = PARTIAL` until the target tenant's effective source rows and atomic implementation are verified:

1. The exact effective fee/tuition-plan row(s), applicable line items, and active discount rows for the target tenant/student. If there is no unique applicable set, reject confirmation.
2. The exact applicable billing-period row and its due date when the existing API request supplies no period. If there is no unique applicable period, reject confirmation.
3. Manual bank, automated bank, or cash evidence must be checked and persisted by the shared Finance capability. An Admin's mode selection alone is never evidence of payment.
4. Omitted `admissionMode` is `DEBT`. A retry with a changed mode/request conflicts with the immutable completed operation; no silent conversion of a completed result is allowed.

These are not implementation defaults. Until resolved, neither the UI's 5,700,000 VND literal nor historical fallback values may be used as canonical data. If the existing API cannot express the authoritative business input and it cannot be derived from an approved server-side source, return for an API/business decision rather than silently extending the contract.

### API impact

- [x] Additive Education public contract capability; existing generic contract methods remain unchanged.
- [ ] Breaking HTTP API change.
- [x] New Product-owned persistence command and additive local/Test migration candidate, conditional on review.
- [ ] Education Kernel table, entity, engine, RLS, or direct table-grant change.

The route keeps existing Auth, Admin role, tenant derivation and HTTP response semantics. The reviewed command independently enforces the actual final-write boundary.

## Impact analysis

### Blast radius

- **Direct consumers:** Preschool admission-confirmation API and its existing UI.
- **Kernel consumers:** Only the new opt-in Preschool activation capability; no behavior change to existing generic or Preschool enrollment creation methods.
- **Finance consumers:** F01 consumes the existing Finance Platform F1/F2/F3 public contracts. Preschool retains the Product-owned pricing/fee rules; Finance retains generic invoice, receivable, payment, cash/bank, reconciliation, and audit truth. SQL command nesting is a source-level candidate; one-transaction composition is not proven. Any missing reusable Finance Platform command remains limited to this collection/transaction boundary and must preserve the frozen F1 ledger contract.
- **Data:** One transaction may activate one existing enrollment and persist its required invoice/line/payment records plus one idempotency result.
- **Security:** High sensitivity. Caller identity, Admin authorization, tenant and branch scope, Finance authorization, direct-table denial, and authenticated negative tests remain mandatory.

### Risk assessment

**Risk level:** `HIGH` due to cross-domain financial and Enrollment state. It is bounded by one existing-enrollment command, one tenant-scoped operation key, the existing Education contract, existing Finance capabilities, immutable retries and a single database transaction.

## Alternatives considered

### A. Keep the endpoint fail-closed

**Pros:** Prevents false success and partial writes.

**Cons:** Admin cannot complete this confirmation workflow.

**Disposition:** Safe fallback until the contract and business sources are approved.

### B. Call Finance and Enrollment RPCs sequentially with compensating writes

**Pros:** Reuses current endpoint-call patterns.

**Cons:** Separate transactions can leave partial records; compensation can fail and does not satisfy the all-or-nothing acceptance.

**Disposition:** Rejected.

### C. Let the Preschool Product RPC update `edu_enrollments` directly

**Pros:** Could make the SQL transaction appear straightforward.

**Cons:** Bypasses the Education public contract and frozen Kernel boundary.

**Disposition:** Rejected.

### D. Add the narrow composable Education contract and one Preschool-owned transaction

**Pros:** Preserves data ownership and allows one commit boundary while reusing the existing Finance rules.

**Cons:** Requires explicit Education Kernel review/unlock and proof that existing Finance operations can be composed in the transaction without duplicating their semantics.

**Disposition:** Boundary approved in principle; exact frozen Education artifact unlock and the additive Finance Platform transaction/audit capability remain subject to artifact-level review and approval.

## Migration and implementation authority

- Migration applicability: `APPLICABLE` for additive Product admission/idempotency persistence and, only if no reusable contract exists, one Finance Platform transaction/audit capability with its own RLS and no direct client mutation. Do not alter existing Finance/Education RLS, grants, or schemas beyond separately approved artifacts.
- Environment: local/Test DB only after an exact implementation window is approved. No Production migration, Production RLS/grant change, commit, push, merge, or deployment is included.
- No global guard, baseline, Education architecture rule, or unrelated Finance behavior may be changed to enable this feature.
- No Education Kernel implementation is permitted before this ACR is approved, the exact artifact list is unlocked, and an ADR records the decision. The earlier ACR-2026-021 unlock is not inherited.

## Verification plan after approval

1. Contract and architecture checks: only the approved Enrollment artifacts change; Product calls the public contract; no direct Kernel table access or new Finance flow.
2. Local/Test DB positive paths: `DEBT` creates/reads back the invoice without payment; `CASH`, `BANK_TRANSFER_MANUAL`, and `BANK_TRANSFER_AUTO` each use the same Finance Platform contract and record their required evidence, method/source, actor, and immutable audit event.
3. Inject failure after each required write and prove enrollment, Finance records and idempotency result all roll back.
4. Retry and concurrency: same immutable request yields one result and stable IDs; conflicting request is rejected; concurrent confirmations cannot duplicate invoice/payment or activate twice.
5. Auth/tenant/branch negatives: unauthenticated, non-Admin, forged actor/tenant, foreign-tenant enrollment, forged payment actor/source, and unauthorized service actor are denied with no writes; direct Finance/Education table writes remain denied. The audit event must distinguish human `actor_user_id`, optional linked `actor_party_id`, canonical role/tenant, and identified automation service identity.
6. Browser: Admin sees success only after the committed result and reload/readback match. On any failure, the UI retains an error and does not call `onConfirmed`.
7. Run focused tests, scoped TypeScript/lint and `education:architecture:ci`; record actual output. Re-run DB acceptance only for the final candidate SQL. No Browser, DB, or full CI PASS may be inferred from unit tests.
8. Retain applicable Education gate evidence. Academic-rule, temporal, grading and transcript gates are not waived; assess whether the existing admission-block and audit-evidence invariants apply to activation before implementation. If they require a missing capability, return to review instead of adding it implicitly.

## Rollback plan

In local/Test only, stop the caller first, then remove only newly approved Product command/idempotency artifacts, the new Education contract function, and any additive Finance Platform command/audit artifacts after preserving before/after schema fingerprints. Restore only the exact unlocked source files. Existing Finance/Education table ACL/RLS policies and F1 artifacts are not modified by this proposal. Do not remove or rewrite existing Admission, Enrollment or Finance data to force cleanup; use only owned test fixtures and their approved relationships.

## Dependencies and review decision

**Owner inputs recorded:** default `DEBT`; effective Preschool-owned fee/tuition plan and applicable billing period; the three payment methods; evidence requirements; one shared Finance Platform confirmation capability; and actor/audit requirements listed above. **Runtime inputs pending:** unique effective fee/period rows for the target test tenant, a trusted automated reconciliation service identity, and proof of the Finance Platform transaction boundary and audit write.

**Human Architect:** project owner. Explicit current-chat decision: `APPROVED — LOCAL/TEST ARTIFACT SCOPE — ACR-2026-024`; exact listed artifacts and additive Local/Test migrations are authorized. The frozen F1 Ledger remains outside the scope.

**ADR:** required after ACR approval and before implementation of the frozen Education or Finance public-contract artifacts. No F1 Ledger artifact change is proposed.

**Implementation authority:** `APPROVED_LOCAL_TEST_EXACT_SCOPE`; the exact Education artifact window is `OPEN`. Existing global freeze/guard/baseline controls remain in force. The ADR records this bounded unlock; it is not an acceptance or a full Kernel reseal.

**Implementation conditions:** the target local/Test fixture must contain one unambiguous effective fee/tuition-plan and billing period; otherwise invoice preparation fails closed. Finance/Education composition must demonstrate least-privilege SQL execution in one transaction, without direct Product writes to Finance or Education tables or duplicated Finance calculation. Until the implemented boundary is verified, the endpoint remains fail-closed.

## Implementation tracking

Local/Test implementation is authorized. Acceptance, runtime security, DB transaction proof, and reseal remain unproven until actually exercised. No Production change, commit, push, merge or deployment is authorized.

### Local implementation and remaining prerequisites — 2026-11-02

- The Admission route validates manual `PAID` evidence and rejects an Admin request that claims the automated reconciliation method. The modal now defaults to `DEBT`, removes the unverified fixed fee and collects cash/manual-transfer evidence. Valid requests still return unavailable; no confirmation, invoice, payment, audit, or Enrollment write has been enabled. Focused route suite: 9/9 tests; isolated DOM harness: 3/3 tests; scoped ESLint, Education typecheck, and `git diff --check`: PASS. `education:architecture:ci` reported ALLOW against its existing baseline (direct access 256 vs 265; the other two checks zero). DOM tests are not Browser E2E.
- The original `postgres` database of `supabase_db_bella-preschool-532b3b8a` lacks the Finance and Preschool fee tables. With owner direction to create a test target if needed, an empty separate database `bella_f01_test_20261102` was created in that local container. Selected original F1–F3, Preschool fee, Party, Enrollment and F3 privilege migrations were applied there; the Rule Engine migration stopped at a missing `feature_flags` prerequisite after creating earlier objects. This is a partial, isolated fixture database, not a fully migrated Supabase stack, and its minimal tenant helper is a test fixture. The original `postgres` database and Production were not modified.
- A synthetic completed-service probe in the isolated database called Finance invoice creation/finalization, F1 posting, F2 cash projection, and F3 allocation in one outer transaction. Same-key F1/F2 replay returned the original IDs, and explicit outer rollback removed the fixture. Earlier probe attempts exposed a subtransaction/xmin interaction, a missing synthetic memo, and an invalid synthetic rate source; the corrected probe passed without disabling F1 guards. This proves only these Finance primitives in the fixture: it is not Admission acceptance, Auth/PostgREST, tenant isolation, failure injection at every F01 step, or an approved admission-time accounting policy.
- **Initial Finance authorization blocker — isolated subset only:** catalog readback showed `anon` and `authenticated` had `EXECUTE` on the F1 posting and F3 draft/line/finalize/allocation functions in this fixture. Under `SET LOCAL ROLE anon`, `finance_create_draft_invoice` actually created a draft for a synthetic tenant; the transaction rolled back and tenant/invoice readback both returned zero. The F3 function is `SECURITY DEFINER` and its `current_user` check observes its owner. This is not Auth/PostgREST evidence or a statement about Production. The owner subsequently approved the narrow F3-only privilege extension recorded below; F1 remains unchanged.
- Source review found an additional semantic constraint: `finance_finalize_invoice` posts an `ACCRUAL` through F1 and requires revenue accounts, while the existing Preschool tuition recognition service requires configured `PERIOD_COMPLETION` policy and completion evidence before calling `recognizeTuitionServiceReceivable`. Admission invoicing before service completion therefore needs an established Finance-owned advance/invoice treatment; do not call the recognized-service contract at admission or invent an accounting mapping.
- The existing Preschool fee calculation emits negative discount lines, while `finance_invoice_lines.unit_price_minor` is constrained nonnegative. The shared Finance charge contract must preserve the approved discount amount and provenance without bypassing that constraint or changing the frozen F1 Ledger. The partial test database does not establish the required pre-service charge/advance contract, actual Auth/PostgREST enforcement, or full F01 transaction behavior.
- The current `TuitionRecognitionService` reads the legacy Preschool invoice record before service-period recognition. A new Finance Platform admission charge must have a supported recognition/reconciliation continuation; simply replacing the record with a different Platform invoice ID would leave that existing consumer unresolved. This dependency is not yet implemented.

### Follow-up: effective RPC permissions and pre-service continuation — 2026-11-03

**Owner decision:** `APPROVED — F3 EXECUTE PRIVILEGE NARROWING — LOCAL/TEST ONLY — FOUR RPCs — F1 UNCHANGED`. This approval covers only a Local/Test migration and contract/wrapper work required to revoke direct `PUBLIC`, `anon`, and `authenticated` execution on the four named F3 RPCs, preserving the F1 ledger artifacts and all Production state. It does not itself prove that a wrapper is safe or that existing Finance consumers still work; each wrapper must derive or validate a trusted actor and tenant, and compatibility must be verified before the local migration is retained as a candidate.

**Additional exact supporting artifacts for this ACL change:** `src/platform/finance/gateways/supabase-receivable-charge.gateway.ts`; the matching four RPC signatures in `src/types/database.types.ts`; server consumer construction points in `src/services/finance-payment-allocation.ts`, `src/services/haircut-f3-reconciliation-actions.ts`, `src/services/hospitality-hotel-core-chain-actions.ts`, and `src/app/api/cron/accounting-worker/route.ts`; and focused gateway routing coverage in `src/platform/finance/__tests__/supabase-receivable-charge.gateway.test.ts`. Existing real-DB consumer test constructors were updated only to label their `service_role` mode explicitly.

- In the isolated `bella_f01_test_20261102` fixture, catalog inspection found that `finance_create_draft_invoice`, `finance_add_invoice_line`, `finance_finalize_invoice` and `finance_allocate_payment` are owned by `postgres`, run as `SECURITY DEFINER`, and have `PUBLIC` and explicit `authenticated` execute grants. Consequently both `anon` and `authenticated` have effective execute privileges. The same catalog check found effective `anon` and `authenticated` execute on the frozen F1 `finance_post_transaction`; this is an ACL observation, not proof that an anonymous F1 posting succeeded. `finance_internal_project_cash_transaction` was executable by `service_role` but not by either client role in the fixture. These observations do not establish the configuration of any other database.
- In rollback-only tests, `SET LOCAL ROLE anon` previously created one synthetic draft. A separate test with `SET LOCAL ROLE authenticated` and no Auth claims created drafts for two synthetic tenants. Both tests rolled back, and readback showed no surviving fixture tenants or invoices. A simulated database role is not an Auth/PostgREST session and this result alone is not a real-user cross-tenant test.
- A second rollback-only experiment revoked the four F3 functions' execute privileges from `PUBLIC`, `anon` and `authenticated`, then granted `service_role` execute. Actual direct draft calls under `anon` and `authenticated` returned SQLSTATE `42501`, while the synthetic `service_role` call succeeded. F1's effective `anon` execute remained unchanged. That first transaction was rolled back; it was only a candidate experiment and did not prove actor authorization or compatibility of all Finance consumers.
- The owner then approved the exact extension `APPROVED — F3 EXECUTE PRIVILEGE NARROWING — LOCAL/TEST ONLY — FOUR RPCs — F1 UNCHANGED`. Migration `20261103090000_finance_f3_rpc_privilege_narrowing.sql` was applied manually only to the isolated test database (no migration ledger or other database changed). It removes `PUBLIC`, `anon`, and `authenticated` execution from the four raw F3 commands, retains `service_role` execution for existing trusted server callers, and adds four Auth-backed wrappers restricted to `admin`/`accountant`, deriving the actor and checking tenant, invoice, and cash-movement ownership. Catalog readback after application showed `anon=false`, `authenticated=false`, `service_role=true` on all four raw commands; the wrappers showed `anon=false`, `authenticated=true`, `service_role=false`. Rollback-only probes directly called all four raw commands as both `anon` and `authenticated` and each was denied. A service-role draft probe succeeded; rollback left zero probe invoices. The frozen F1 `finance_post_transaction` still showed the same effective client privileges, including `anon=true`.
- The isolated database was created from `template0` and has no `auth` schema, `auth.users`, `public.users`, or `platform_current_actor_profile()`. Therefore the Auth-backed wrapper's real identity, wrong-tenant and wrong-role behavior cannot be executed in this fixture. A complete nested Finance consumer probe after the ACL change also stopped because this partial database does not grant `service_role` direct table `SELECT` on `finance_invoices`; this is a fixture prerequisite gap, and does not prove a migrated production-like consumer pass. Existing F3 consumer compatibility, real Auth/PostgREST, wrapper enforcement, and full rollback/idempotency remain `NOT_PROVEN` pending a properly migrated isolated Local/Test target.
- The existing Finance finalization contract posts an accrual, and the existing Preschool period-completion service reads `edu_fin_invoices` and only recognizes tuition after verified completion. Its implementation also rejects non-tuition lines. A new pre-service management charge cannot simply be substituted for that record without defining and verifying the continuation, discounts and payment allocation; a type-only contract or a separate unconnected charge store would not close F01. Any pre-service capability must distinguish the management charge, actual customer advance and later earned revenue, preserve the existing ownership boundaries, and not invent fee policy or accounting mappings. This continuation and its exact artifact/privilege scope remain to be resolved before enabling the endpoint.

### F01-A — composable Education activation contract — 2026-11-03

- Added `public.edu_preschool_activate_pending_enrollment(uuid, uuid)` in `supabase/migrations/20261103110000_education_preschool_pending_activation_contract.sql` and its generated RPC signature in `src/types/database.types.ts`. The Education-owned SQL contract only transitions one tenant-scoped, existing `pending` enrollment to `active`; it rechecks active course and non-deleted person identity, locks the enrollment row, and rejects cross-tenant/missing/ineligible and non-pending cases. It does not create an enrollment, update course capacity twice, add table grants/policies, or publish an event. It is `SECURITY INVOKER`, has fixed `search_path`, and is executable only by its owner so it can be composed by the trusted outer Admission SQL command; no `PUBLIC`, `anon`, `authenticated`, or `service_role` execution grant is present. The outer command must authenticate and authorize actor/tenant before invoking it in the same transaction.
- Applied only to `bella_f01_test_20261102` in disposable container `supabase_db_bella-preschool-532b3b8a` using direct `psql`; the target had the required Education tables, zero fixture rows, and no `auth` schema. No migration ledger table exists in this partial target, and no other DB or migration was touched. The F1/F2/F3 source and freeze files were not changed by this step.
- DB probe: eligible synthetic pending row transitioned and read back as `active`; wrong tenant, inactive course, deleted Party, and repeat activation were rejected; transaction rollback left `fixture_rows_after_rollback=0`. Catalog readback: owner `postgres`, `SECURITY DEFINER=false`, fixed `search_path`, effective `EXECUTE=false` for `anon`, `authenticated`, and `service_role`; `edu_courses` and `edu_enrollments` still had RLS enabled. Actual Auth/PostgREST behavior is not proven because this target has no Auth schema.
- Eligibility provenance remains `NOT_PROVEN`: the source `EducationEngineService` checks student, credit, course, and prerequisite eligibility before the enrollment transaction, but the checked current workflow initializes enrollments as `active` by default; no current canonical Preschool producer of a persisted `pending` `edu_enrollments` row was established. The synthetic fixture tested only the transition primitive. The future outer Admission command must not treat an arbitrary pending row as proof that Education eligibility was satisfied.
- Source verification: `education:architecture:ci` — ALLOW (direct database accesses 256/265, Kernel imports 0, cross-vertical leakage 0); Admission route tests 9/9 PASS; isolated `database.types.ts` TypeScript check PASS; scoped `git diff --check` PASS. No F2 integration suite, broad typecheck, Browser E2E, Finance consumer regression, or GitHub CI was rerun.
- This seals only the bounded Education activation SQL candidate, not F01. The outer Admission command, fee-version/item resolution, Finance pre-service accounting/recognition continuation, payment evidence/audit composition, true Auth/PostgREST, end-to-end idempotency, and full transaction rollback remain `NOT_PROVEN`; the route remains fail-closed and F01 remains `HELD`.

### Official accounting sources for the advance case

- [Thông tư 99/2025/TT-BTC, Phụ lục II, Tài khoản 131](https://congbao.chinhphu.vn/tai-ve-van-ban-so-99-2025-tt-btc-46529-59634) describes customer advances and, at 3.5, the cash/bank debit and customer-account credit for money actually received under a sales or service contract.
- [Bộ Tài chính on TK 3387](https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/160518) cites the exclusion for money received before goods or services are supplied and explains that an uncollected invoice in the specific case presented is tracked for management rather than posting Dr 131/Cr 3387. [Its service-period answer](https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/158102) distinguishes a service already started in one accounting period from one spanning multiple periods. These examples are not a blanket classification of every Preschool fee.
- The circular applies to financial years beginning on or after 2026-01-01, as [Bộ Tài chính explains](https://portal.mof.gov.vn/hoidapcstc/home/cthoidap/159102). Applicability to the specific Preschool entity, its configured account mapping, tax/invoice obligations, and the treatment of each fee must be established before any real posting. A management charge, a statutory invoice and a recognized accounting receivable are distinct facts. No fixture rate or amount is a business default.

### Protected source before implementation — 2026-11-02

| Artifact | SHA-256 before |
| --- | --- |
| `src/platform/education/contracts/enrollment.contract.ts` | `a3a00d390cec54a8088d66d294e98266780a78b3dd35d0700f70f7d95b10223e` |
| `src/platform/education/contracts/enrollment.contract.impl.ts` | `2f6c2aa6dcbc252dec8a82c96410c27557e5cc067328ef1226be22a3c51063f0` |
| `src/platform/education/contracts/__tests__/preschool-enrollment.contract.test.ts` | `6682ca44847a890745d97d189ca6d2c5597670328b177be27ec9a9bd6d835e6f` |
| `src/platform/finance/contracts/receivable-charge.contract.ts` | `4c29b9aa78ba63ba3668c4c4e54f066f5f8e095a4a97b7c25d6c52ae55b811f7` |
| `src/platform/finance/services/semantic-receivable-charge.service.ts` | `31f2410f4219e8724e38235699e932bcaa5e39cc364a17041140e77a62caebfd` |
| `src/platform/finance/gateways/supabase-receivable-charge.gateway.ts` | `9b2f48b3062431aee2aa99e5423dc684525ffe8d3cf79c30ec6fad4e67c93531` |
