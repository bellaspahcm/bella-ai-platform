---
status: rc-local-verified-pending-ci
baseline_commit: 3356a04d15b021c5098512739bc5b3676922ce3b
---

# AutoMove Business-Chain Verification

## Signing-Key Verification-Only Authority - 2026-10-16

Process gate: PASS within the existing release-preparation scope. The owner
explicitly approved running the signing-key-only job. This is not approval to
dispatch adoption. Preserve PR #343 at a864f85165246b0f753184ddf18a766fc91cbdf7,
all business-chain seals, runtime guard and the accepted backup exception.

Manifest and ownership: Platform/BDGF owns key resolution; GitHub Environment
Production owns the existing encrypted GATE_SIGNING_KEY secret. Reuse
scripts/bdgf/get-signing-key.mjs unchanged. The verification consumer injects
that secret through the resolver's existing trusted-injection parameter, never
the development .env or rehearsal key. No new policy/key provider is created.

Contract/dependency: verification-only workflow -> canonical key resolver ->
in-memory Node HMAC-SHA256 challenge and independent verifier process. The probe
is explicitly not an authorization token and contains no approval identity.
Only booleans, source/run provenance and the approved adoption hash are logged.

Change authority: isolated verification commit/tag only, updating the existing
manual test-secret-injection workflow and adding its focused verifier/tests.
No main merge, PR #343 changes, application/runtime code, Vercel configuration,
DB credentials, DB connection, approval/token issuance or deployment. Publish a
verification tag, not an application branch or release, then manually run only
this workflow. The owner separately approved one temporary tag rule for
bdgf-key-check-20261016 on Environment Production; preserve its main rule and
remove only the newly created rule after completion/failure. No other protection
change is authorized. UI reconciliation: N/A.
Migration plan: NONE; no database targets or mutation APIs exist in the job.

Verification gates: (1) approved manual event; (2) verification tag/source SHA;
(3) exact adoption hash a5e574c6985924d41436c2b05ff1ea9ffc45530861302b60f9ff8687a2e22f23;
(4) immutable resolver source; (5) only the approved Environment secret;
(6) no development fallback or DB credential; (7) key format; (8) fresh-process
issuer/verifier consistency; (9) modified message/hash/signature rejected;
(10) boolean-only evidence; (11) focused safety tests and actual CI conclusion.

Acceptance: Given the approved runner and secret, fresh processes resolve the
same key and verify a non-authorizing challenge. Modified hash/nonce/signature
and malformed signature must fail verification. Missing key, development
fallback, wrong ref/event/hash or DB credentials fail closed. Never print key,
key fingerprint, challenge signature or raw subprocess output. No local fixture
may be reported as Production signing evidence. GO_LIVE remains NOT_PROVEN.

Local safety verification: 12/12 tests PASS, lint PASS, diff-check PASS; single-
agent review confirms only workflow, verifier/tests and this existing checkpoint
change. This is not key proof. Actual CI on the immutable verification tag is
required; no merge/Production adoption is authorized by a successful key check.

## RC Business-Chain Authority - 2026-10-16

Process gate: PASS for AUTOMOVE_RC_BUSINESS_CHAIN_VERIFICATION, explicitly
approved by the owner after #339/#340 seals. Baseline main is
3356a04d15b021c5098512739bc5b3676922ce3b. Single agent, branch
codex/automove-rc-business-chain. Existing seals are not reopened.

Manifest: verification of the release build, not new product behavior. Build the
exact checked-out candidate with next build; launch next start, real Auth and
canonical E2E DB only. Record candidate SHA, build ID, environment and actual test
counts. Missing credentials, build/start failure, skip or partial chain cannot
be PASS. No reuse of a previously running server or stale build.

Ownership/contract: AutoMove owns its API/UI/financial records, Mobility owns
allocation/handover, Accounting owns the existing public period guard; tests
consume the already-approved public contracts. Supabase Auth -> active
public.users/accountant -> active same tenant remains authoritative. No runtime,
Platform helper, Finance, kernel, registry or business-rule change authorized.

Change authority: existing Browser spec extension, test-only continuation,
production-mode test configuration, supervised build/start runner, scoped CI and
this checkpoint. UI reconciliation is verification-only: actual dashboard/API
commands create booking, receipts, approved snapshot, evidence and recognition;
read back real DB after each milestone. Customer/catalog/vehicle/Auth and OPEN
period are explicit Non-Production setup fixtures, not claimed UI creation.
Migration plan: NONE. Do not alter schemas, migrate Production or remove the
Production rejection in AutoMoveSaleChainConnection.ts.

Business test contract: reuse owner-approved amounts (1.4B recognized sale, 1B
cost, 100M deposit, 1.3B later receipts). After full collection, document price
delta -100M and cost delta +50M, then manually refund 100M against an original
receipt. Documented delivered cancellation does not return the vehicle, refund
more money or reverse revenue. Explicit full reversal remains a separate command
in OPEN source/current periods. Refund remaining original receipts separately;
verify net cash/revenue/outstanding zero without changing original records.
These operations are allowed by the sealed contracts; no invented fee, forfeiture
or period reopening. A forbidden transition is a blocker, not an assertion to
weaken. Test retries use original intent/key; cross-tenant/inactive/suspended
denials remain required. No Finance posting, commission or Warranty scope.

Eleven gates: (1) exact SHA/clean build inputs; (2) next build/start provenance;
(3) Non-Production target and TLS; (4) real authenticated UI chain; (5) tenant/RLS
and active authority; (6) snapshot/evidence/policy read-back; (7) receipt totals
and idempotency; (8) documented independent compensation and OPEN periods;
(9) immutable originals/dashboard reconciliation; (10) cleanup and evidence
integrity; (11) focused regression/typecheck/lint/Architecture Guard and actual
Browser CI on exact PR SHA. Existing unaffected Real DB proof is reused.

Acceptance: Given canonical E2E and the exact candidate, a fresh production-mode
build must execute the whole applicable chain on the same booking, preserve
original receipts/snapshot/recognition, deny unauthorized requests and read back
the expected final balances after reload. Given wrong target/SHA/dirty build or
any failed/skipped test, the runner fails closed and terminates its own server.
Only fixture-owned periods may be closed during cleanup; immutable history and
archived tenant shells remain PARTIAL cleanup, never deleted through a bypass.

Commit/push/PR/CI are allowed for this batch; merge and Production deployment
are not authorized. Production runtime activation, DB/schema adoption and
restore/rollback evidence remain separate. Full readiness stays NOT_READY.

### RC Executed Evidence - 2026-10-16

Candidate 95e0ac6204b94acca6dd523a159d1c3bd842db81: fresh next build --webpack
and next start PASS; build ID GBWL-U2d5ZhgyPH3IgiNN. Main runtime source remains
unchanged from 3356a04d1; only verification/CI/checkpoint files changed.
Runner records SHA, build manifest hash, canonical E2E project and test counts.
Health verifies production-mode process against Non-Production DB, not a
Production deployment. No pre-existing server or stale build accepted.

Actual Browser: 1/1 PASS, zero skipped/flaky/unexpected, 3.6 minutes. Same
UI-created booking/recognition across allocation, deposit, approved snapshot,
persisted handover, explicit recognition, full collection, receipt read-back,
dashboard, stale-Auth cross-tenant/inactive/suspended denials, then documented
price -100M/cost +50M deltas, 100M receipt-linked refund, independent delivered
cancellation, explicit full reversal and remaining receipt-linked refunds.
Final sale/cash/outstanding are zero, reconciliation MATCHED; original financial
snapshot/recognition/deposit/payment rows unchanged and vehicle still delivered.
Lost acknowledgement, concurrent receipt requests and same-intent replay passed.
No financial records were inserted to shortcut the chain; customer/catalog/vehicle,
Auth profiles and the isolated OPEN period are explicit setup fixtures. The
negative completed-without-recognition booking is a denial fixture, not revenue.

Initial candidate 289c90747 reached reversal but failed its retry HTTP request at
the Browser default 15-second timeout: NOT_PROVEN, not a PASS. The RC-only test
timeout was aligned to 60 seconds (existing transactional API bounds retained),
then a fresh committed candidate was built and the entire test rerun. No runtime
change or automatic test retries were introduced.

13 runner safety regressions PASS; strict TypeScript for 6 roots/dependencies has
zero diagnostics; changed-file ESLint, Architecture Guard, workflow YAML parse and
diff-check PASS. Desktop/mobile screenshot evidence retained locally; 390px dialog
horizontal bounds asserted. Sanitized artifacts live under .cache/automove-rc and
are not committed. CI is configured to build/test the exact PR head or main SHA,
publish sanitized evidence, fail on absent credentials/build/test/skip, and never
deploy or run migrations. Remote execution remains pending, not Browser CI PASS.

Cleanup PARTIAL: Auth removed, active actor zero, Storage documents zero, two
tenant shells terminated with read-back; original append-only history retained.
Fixture period closed in cleanup; no period, FK, RLS or append-only bypass.

`RC_BUSINESS_CHAIN = PROVEN_LOCAL_NON_PRODUCTION_PENDING_CI`
`RC_BROWSER_ON_MAIN = NOT_PROVEN`
`PRODUCTION_RUNTIME_ACTIVATION = NOT_AUTHORIZED`
`PRODUCTION_SCHEMA_CONFIG_ADOPTION = NOT_PROVEN`
`RECOVERY_READINESS = NOT_PROVEN`
`AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`
`GO_LIVE = NOT_PROVEN`

## Recognition Adjustment Authority - 2026-10-16

Process gate: PASS for the owner's approval following scoped seal #339, main
`5f939791eddaac5eff45d0b089c0ec74042f6dba`. This is a separate Non-Production
batch; #339 is not reopened. Single agent, branch
`codex/automove-recognition-adjustments`. Generated AGENTS/cache changes remain
outside the commit. No merge, application deployment or Production DB authority.

Manifest: accountant-confirmed, documented price/cost deltas and explicit full
reversal against canonical, not-Finance-posted recognition. Use the existing
append-only adjustment ledger, stable request key and immutable original policy
version. No automatic cancellation, refund, vehicle return, fee or forfeiture.
The owner's prior three financial decisions plus latest approval authorize this
batch; approval does not make execution or Go-Live PROVEN.

Ownership/contract: AutoMove owns recognition and its adjustments; Accounting
owns accounting_periods and its public period guard. Product -> Accounting public
transactional read-guard -> tenant period rows; Product -> existing AutoMove
recognition ledger. No direct Product period query, Finance ledger engine/table,
Mobility/Logistics/Healthcare kernel or ProductRegistry change.

Change authority is limited to one additive public transactional read-guard in
the existing Accounting period-guards module, AutoMove command/API/UI and the
affected reporting/reconciliation consumers. The existing Supabase RPC guard is
not changed: it cannot share the caller's PostgreSQL transaction and may create
periods, so it is unsuitable here. Metadata-only E2E READ ONLY verified period
schema, accountant RLS and lock privileges. Migration plan: NONE; reuse existing
tables/grants and fail closed if runtime schema or rights are unavailable.

Business test contract: actor must be currently active accountant in the active
matching tenant. Each change references original recognition, verified tenant
Storage document, actor/time, reason, source period and original policy version.
Sale/cost totals may not become negative or exceed safe integer VND limits.
Reversal negates remaining adjusted sale/cost totals once, not the cash received;
any excess cash remains visible for separate manual refund, not auto-refunded.
Only the sealed explicit snapshot-based recognition producer is in scope; legacy
or unknown posting metadata fails closed rather than inspecting Finance internals.

Both original recognition date and server command date must resolve unambiguously
to OPEN tenant accounting_periods. Hold ordered row SHARE locks until outer
transaction commit/rollback so closing cannot race the write. No period creation,
reopening or status update in runtime; isolated test-fixture periods only for
rollback/concurrency proof. Missing, overlapping, closed, foreign-tenant or
unknown-state periods deny new changes. Persisted same-intent retry rechecks
current identity but is not rejected because a period later closed, policy
changed or evidence was removed. New requests require current reviewed revision.

UI -> contract reconciliation: separate price/cost/reversal commands, explicit
confirmation/document upload, server totals/revision and persisted history;
retain pending exact key/intent across lost acknowledgement. Dashboard reads
canonical adjusted totals, not client price or current vehicle cost. Cancelled
booking history remains readable; reversal does not mutate booking/vehicle.

Eleven verification gates: (1) scoped ownership; (2) public period boundary;
(3) current Auth/active accountant; (4) cross-tenant/inactive/suspended denials;
(5) original/current OPEN period and concurrent close; (6) append-only originals;
(7) safe positive/negative deltas and explicit reversal; (8) idempotency/concurrent
retry/read-back rollback; (9) adjusted reporting/cash reconciliation regression;
(10) Real DB plus actual Next.js Browser E2E; (11) strict typecheck, lint,
Architecture Guard, diff safety and exact-PR-SHA CI.

Acceptance: Given matching valid actor/evidence/open periods, append exactly one
documented adjustment with read-back. Given closed/missing/ambiguous periods,
wrong authority/tenant or invalid evidence, write nothing. Given concurrent close,
either adjustment commits before close or rejects/retries without a stale write.
Given retry after success, return the original fact once, never a second delta.

### Executed Evidence - 2026-10-16

Final scoped review: PASS for the new command, public Accounting guard and
affected reporting/payment consumers. This is single-agent review, not an
independent multi-agent security certification. Unknown recognition producer or
posting metadata fails closed; this does not establish arbitrary Finance posting
state outside the sealed AutoMove producer. No schema/migration, period mutation
in runtime, kernel, commission, Warranty or Finance posting changes.

- Real DB verifier: PASS, 33 assertions, financial fixtures rolled back and zero
  recognition/adjustment fixture rows read back. Independent connection attempting
  to close a SHARE-locked period was blocked with SQLSTATE 55P03. Both source and
  current closed periods, overlap, invalid evidence, inactive/suspended actors,
  wrong role/tenant, stale review, failed read-back, immutable originals and
  same-key replay after period close/evidence removal were exercised.
- Actual Next.js Browser E2E: 1/1 PASS on E2E Non-Production. Real Auth, Storage
  upload, dashboard dialog -> API -> DB -> reload; lost acknowledgement and
  same-key retry, concurrent cost requests, closed period rejection, authority
  denials, explicit reversal, reporting zero active recognized sales and retained
  cash/excess balance were verified. Setup seeded original financial fixtures;
  this is not new proof of booking/deposit/recognition creation UI. Desktop and
  390px screenshots inspected; dialog horizontal bounds asserted.
- Jest: 7 suites, 72 tests PASS (command, HTTP, UI, reporting and payment
  regression). Failed commit/asynchronous connection failure never acknowledged.
- Strict changed-source/dependency TypeScript: 17 root TS/TSX files, zero
  diagnostics. Changed-file ESLint, Architecture Guard, API documentation and
  git diff --check: PASS. Scoped CI selector lists the new verifier once.

Cleanup: PARTIAL by design. Verifier-owned periods removed; Auth zero and actors
inactive, tenant shells terminated, with read-back. Browser Auth/Storage zero;
its fixture period closed, actor inactive and tenant shells terminated. Browser
immutable history/snapshot and audit references retained; no append-only/FK
bypass. Local screenshots/logs and unrelated AGENTS.md changes are not committed.

PR/CI on remote and main seal remain pending; local Browser proof must not be
reported as Browser CI on main. No merge or automatic application deployment is
authorized in this batch. #339 remains sealed without rewriting prior evidence.
Initial PR #340 Core Freeze failed because its machine-readable approval binding
was missing. ACR-2026-019 records the existing owner approval for exactly
src/core/services/accounting/period-guards.ts and PR #340; no guard was weakened
and no additional Core/runtime scope was introduced.

`ADJUSTMENT_REVERSAL = PROVEN_ON_E2E_PENDING_PR_CI`
`MAIN_SEAL = NOT_PERFORMED`
`PRODUCTION_MUTATION = NOT_AUTHORIZED`
`AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`

## Settlement Batch Authority - 2026-10-15

Process gate: PASS for the owner-authorized Non-Production refund/cancellation
batch, based on main ef059443dbe328a1a8eef4e9faab31c80d6272df (#338 sealed).
Single-agent execution; no reopening of sealed identity/HQ or management work.

Manifest: manually confirmed cash refunds, independent cancellation, immutable
receipt-linked history, stable retry and post-refund internal reconciliation.
Only active accountants in an active matching tenant may execute these commands;
Supabase Auth -> current public.users/tenants is authoritative, not client roles.
Refunds cannot exceed the unrefunded amount of their original confirmed receipt.
Cancellation before handover releases only this booking's allocation through the
existing Mobility transition contract. After handover, documented cancellation
does not return the vehicle, refund money or reverse revenue automatically.

The owner explicitly HELD adjustment/reversal after discovery that the existing
accounting-period public read cannot lock the period in the command transaction.
No Accounting/Finance change, period creation, adjustment writer, fee, forfeiture,
Warranty, commission, ProductRegistry, kernel or Production access is authorized.

Ownership: AutoMove owns refund/cancellation facts, bookings and receipt
reconciliation; Mobility owns vehicle allocation/status; Platform owns identity
and Storage access; Finance owns journal postings and accounting-period controls.
Dependencies: authenticated UI -> AutoMove settlement command -> existing
Mobility public contract. Existing recognition and receipts remain immutable.

Migration plan: one forward migration creates only the minimum AutoMove
settlement-action table, indexes, validation/append-only triggers and least-
privilege RLS. Refunds before recognition cannot use the adjustment table because
its recognition_id is mandatory. The new table records cash/cancellation facts,
not a parallel revenue ledger. It also forward-aligns existing collection guards
with net cash after recorded refunds; historical migrations are not rewritten.

UI reconciliation: separate refund/cancel requests, verified tenant Storage
document and explicit confirmation; read persisted history/balances, preserve
pending intent/key after lost acknowledgement, and show failures as failures.

Business test contract: per-receipt refund cap, receipt/recognition immutability,
no automatic revenue reversal or physical vehicle return, safe sequential and
concurrent retries, and current accountant/tenant authority come from the user's
three explicit decisions and subsequent adjustment/reversal HOLD in this chat.

Eleven verification gates: (1) architecture/frozen boundaries; (2) public Mobility
contract; (3) real authenticated HTTP; (4) active accountant authority; (5) tenant,
inactive and suspended denial; (6) safe forward migration; (7) atomic persistence
and rollback; (8) unchanged original financial history; (9) idempotency/concurrency;
(10) Non-Production Real DB and actual Next.js Browser E2E/read-back; (11) focused
regression, strict typecheck, lint, required CI and honest readiness classification.
No Production deployment or merge is authorized for this batch. Commit/push/PR
are allowed after verification. Full readiness and Go-Live remain NOT_READY /
NOT_PROVEN; local/PR/main evidence must remain separate.

Current settlement result: see "Settlement Batch Executed Results" below. The
older management checkpoint remains historical evidence for sealed PR #338.

Baseline: main `2652d3b645b89715e4ca970d76b057a94775f7d2` (PR #337).
Single agent. Identity/HQ is sealed and is not reopened.

Current checkpoint: see "Management Batch Executed Results" at the end. The
initial verification/failures below are retained as chronological evidence,
not the final management result or a main/release seal.

## Process Gate and Manifest

PASS for owner-authorized Non-Production business-chain verification and repairs
of proven blockers within existing contracts. This is not Go-Live approval.
Verify real Auth, vehicle/customer UI, booking/allocation, deposit, approved
snapshot, persisted handover, explicit recognition, collection and reconciliation.
Prior proofs are reused, not reimplemented. Missing business policies, new public
contracts or schema changes stop at the approval boundary.

## Ownership Map and Contract Dependencies

| Data / capability | Owner | Runtime boundary |
| --- | --- | --- |
| Actor / current authority | Platform | Supabase Auth -> active users / tenants; unchanged |
| Vehicle identity, allocation, handover | Mobility OS | existing public Mobility contracts |
| Customer, booking, deposit | AutoMove / existing customer contract | existing authenticated UI/API |
| Approved snapshots, recognition, receipts | AutoMove | sale-chain and payment commands, canonical persisted records |
| Journal posting | Finance | excluded; operational reconciliation is not Finance posting |

Product -> public Mobility contract -> existing adapters. Verification may inspect
DB independently, but must not manufacture business success using privileged
fixture writes. Initial catalog/customer/vehicle setup is explicitly fixture data.

## Change Authority

In scope: existing E2E harness, focused assertions, one evidence report and minimal
boundary-local repairs supported by runtime evidence. No Production access,
Vercel changes, Identity/HQ/helper changes, kernel, registry, Warranty, commission
or Finance posting. No commit, PR, merge or deployment in this verification batch.

## UI to Contract Reconciliation

Reuse dashboard browser spec 42 for actual UI -> API -> DB read-back. Add negative
checks against that same transaction and expose unimplemented management paths.
A success toast/state update is not persistence. A fixture-created customer or
vehicle does not prove customer creation or vehicle intake through the UI.
Payment, handover and recognized revenue remain separate facts; handover never
implicitly recognizes revenue. Cancellation/refund/adjustment execution requires
approved policy and runtime; guard rejection alone does not prove those workflows.

## Additive Migration Plan

NONE. Use durably applied Non-Production schema. No migration replay, bootstrap,
new tables, grants or RLS changes. New schema needs separate authorization.

## Business Test Contract

Owner-approved inputs: separate deposit/payment/revenue; accountant-only snapshot
approval; immutable snapshots/history; explicit recognition; stable retry keys;
current active identity and tenant, without default HQ bypass. Test these through
the actual Next.js dashboard and persisted DB facts. Exact retry cannot increase
receipt count, collected amount or recognized revenue. Cross-tenant, inactive and
suspended contexts cannot read/write the transaction. Failure is not zero revenue
or success. Retain immutable audit/history and report cleanup limitations.

## Eleven Verification Gates

1. Architecture: no kernel, helper, registry or cross-product change.
2. Contract: reuse current UI/API/Mobility boundaries; no invented sales source.
3. Identity: real Auth login; no development/mock identity.
4. Authorization: active accountant, inactive actor and suspended tenant.
5. Tenant: own transaction visible; second controlled tenant cannot access it.
6. Persistence: independent DB read-back for every executed business operation.
7. Finance semantics: snapshots, recognized period and internal reconciliation;
   no journal/commission/bank reconciliation claim.
8. History: approved snapshot/recognition unchanged after retries/collections.
9. Idempotency: booking, recognition and receipts including concurrent retries.
10. Real DB/browser: matching E2E project, verified TLS, actual Next.js/Chromium;
    document fixture bootstrap and retained append-only records.
11. Regression/readiness: run only changed tests and relevant checks; report
    missing operations and release/recovery evidence without claiming Go-Live.

## Execution

Baseline browser run persisted the sale and receipts, then timed out while
reopening the payment panel before its response arrived. The test now awaits
and validates that real response instead of assuming completion within 10s.

The expanded run proved cross-tenant DB/API rejection, but inactive sale-chain
state returned HTTP 500. A separate READ ONLY diagnostic confirmed SQLSTATE
42501 on the trusted profile lookup. Scope-local repair: map PostgreSQL permission
denial to HTTP 403 in the existing sale-chain/payment HTTP boundaries, rollback
and return no business result; keep genuine DB/configuration errors as errors.
No helper, RLS, grants, financial semantics or transaction boundary changes.
Focused HTTP regression tests and the same business-chain negative assertions
must pass after the repair. Management persistence probes remain real failing
readiness assertions, not approved new write capabilities or tests to weaken.

The management browser also recorded the inventory read failing with UUID input
`dev-tenant`. The consumer used the generic development tenant context instead
of canonical current user authority. Scope-local repair: resolve tenant using
the sealed `getCurrentUser()` server action before calling the unchanged public
Mobility inventory contract. Missing identity rejects the read. No Platform
provider/helper change and no new vehicle write capability. Verify exact tenant
binding and missing/error identity with focused component tests and browser.

## Executed Results

| Flow | Evidence / result |
| --- | --- |
| Real login -> catalog/customer selection -> booking/allocation | PROVEN_ON_NON_PRODUCTION; actual Auth, Next.js and Chromium; one persisted booking/allocation after retry |
| Deposit -> approved financial snapshot | PROVEN_ON_NON_PRODUCTION; 100M VND receipt, separate accountant approval and source documents |
| Handover -> explicit recognition | PROVEN_ON_NON_PRODUCTION; no revenue after deposit/handover alone; one 1.4B VND recognition after explicit command and retry |
| Post-sale collection -> internal reconciliation | PROVEN_ON_NON_PRODUCTION; five receipts sum to 1.3B VND, 100M deposit, outstanding zero, MATCHED; lost-response/concurrent retries, overcollection and mismatch rejection |
| Dashboard canonical revenue | PROVEN_ON_NON_PRODUCTION; correct recognized month/model, 1.4B VND after reload, immutable 1B cost basis |
| Sales transaction DB/RLS and HTTP | PROVEN_ON_NON_PRODUCTION; own access, cross-tenant 404, inactive/suspended 403, denied mutations leave ledger/receipts unchanged; valid authority restored |
| Vehicle inventory read | PROVEN_ON_NON_PRODUCTION after consumer repair; seeded VIN displayed through unchanged Mobility contract with canonical tenant |
| Customer management / preference save | FAIL_PROVEN_ON_NON_PRODUCTION; real DB customer absent, displayed mock preference save lost after reload |
| Vehicle intake | FAIL_PROVEN_ON_NON_PRODUCTION; success toast observed, independent DB query finds zero vehicle rows |
| Refund / cancellation / adjustment execution | NOT_PROVEN; existing collection guards do not prove a refund or reversal workflow |
| Release candidate deployment / approved recovery | NOT_PROVEN in this batch; no Production adoption or deployment authorized |

### Evidence and Checks

- `e2e/tests/42-automove-dashboard-sales-chain.spec.ts`: final run 1/1 PASS,
  4.6 minutes, no skipped tests or automatic retries. Full chain plus current
  authority negative assertions ran together on actual Next.js/Chromium.
- `e2e/tests/44-automove-management-persistence.spec.ts`: real failing readiness
  assertions remain. Do not merge or describe the overall browser batch as PASS.
  The management probe verifies inventory read separately from intake writes.
  Final confirmation: actual tenant customer matches zero UI rows, preference
  reverts to `BMW, Porsche` after reload rather than the submitted value, and
  successful intake yields zero DB rows. Retrying assertions waits for UI updates;
  these failures are not an immediate hydration read or a skipped operation.
- Final sales booking: `2ab96bd1-3a6f-4b44-aea9-57231ca3f701`. An independent
  post-run READ ONLY DB query confirms one recognition, approved snapshot, one
  confirmed 100M deposit, five 1.3B receipts, no remaining Auth actor/active
  profile/Storage document and terminated fixture tenant. Monetary units: VND.
- Local artifacts: `.cache/automove-business-chain/final-chain.log`,
  `persisted-chain-readback.json`, browser screenshots under `final-chain/`,
  management logs/screenshots under the same scoped evidence directory.
- Focused HTTP tests 21/21 PASS; inventory component tests 3/3 PASS. Initial
  component attempt used Node instead of jsdom; corrected test environment,
  not runtime behavior. Scoped strict TypeScript: zero diagnostics. Focused
  ESLint, Architecture Guard and whitespace check PASS.
- The earlier timeout and HTTP 500 run are FAIL, not ignored PASS. The mapping
  repair preserves rollback and hides DB details; non-permission failures still
  return server errors. No new permission or RLS bypass was introduced.

### Proven Blockers and Minimal Next Scope

1. Customer UI reads module-level mock arrays and saves only React state after
   a timer. Actual customer/profile persistence exists behind a provider, but
   the page is not wired to it. Confirm the existing write authority and tenant
   contract before wiring that UI; do not infer authority from the mock screen.
2. Vehicle intake and status controls currently use timer + toast, not a persisted
   Mobility write. An intake workflow needs the approved required catalog/vehicle
   fields and write authority at the existing Mobility ownership boundary; do not
   create a parallel Product direct-table write or invent lifecycle semantics.
3. Refund/cancellation/adjustment policy and execution are still unproven beyond
   collection-denial safeguards. No forfeiture, fees or journal posting inferred.
4. Legacy inventory/trend/delivery analytics RPCs return PGRST202 on E2E. They are
   not canonical revenue and are not repaired here. Do not label all dashboard
   metrics proven because the recognized-sales path passed.

Next implementation should address real management persistence through existing
public contracts, with explicit authority for any missing Mobility intake write.
This is a concrete Product capability boundary, not a new architecture audit.
No new financial/identity framework is requested or created.

### Cleanup and Delivery Boundary

Cleanup is PARTIAL by design: test Auth identities and Storage documents removed,
profiles deactivated, fixture tenants archived. Immutable receipts, financial
snapshots, recognition and audit history remain in Non-Production; this is not
zero-residual rollback. Historical #337 shells/audit records are untouched.
No FK, append-only rule or financial trigger was disabled.
Independent READ ONLY cleanup read-back covers all eight tenants created across
this batch's diagnostic/final runs: all terminated, zero active actors and zero
remaining Auth actors. Three recognition rows and fifteen post-sale receipts
remain intentionally. Exact evidence: `.cache/automove-business-chain/cleanup-readback.json`.

Only Product consumers/HTTP boundaries, focused tests and this checkpoint changed.
No migration/schema/grants/RLS/helper/kernel/registry change; no Production DB,
Vercel configuration, commit, PR, merge or deployment. These are local results
on the approved baseline plus the scoped patch, not main/CI/release seals.

`BUSINESS_SALES_CHAIN = PROVEN_ON_NON_PRODUCTION`
`MANAGEMENT_PERSISTENCE = FAIL_PROVEN_ON_NON_PRODUCTION`
`AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`
`GO_LIVE = NOT_PROVEN`

### PR 338 CI Follow-Up

PR 338 is OPEN, not merged or sealed. Initial CI on `7e9ea47ea` exposed:

- Gitleaks generic-api-key matched a synthetic UUID fixture named `key`, not a
  credential. Rename it to `intentId`; no secret-scanner ignore or rule change.
- Catalog, allocation, deposit, handover and receipt verifiers still expected
  legacy empty rows/service errors for inactive/missing actors, or null HQ tenant
  identity. The sealed #337 helper instead denies with PostgreSQL 42501 and
  returns the real active HQ tenant. Align only these fixture/assertion consumers:
  HQ uses product_key bella_hq, denied reads/commands assert exact 42501, active
  reads and cross-tenant isolation remain mandatory. No shared helper/RLS change.
- The actual authenticated dashboard reporting read classified canonical 42501
  during actor/tenant verification as 503. Minimal Product read-boundary repair
  maps only missing/denied authority to 403, retaining 503 for schema/configuration
  failures. No recognition query, amount, period, adjustment or ledger write changed.

Executed Non-Production regressions: catalog, booking allocation, deposit,
handover/approved-snapshot recognition, recognized-sales reporting, actual
authenticated dashboard, post-sale receipts and management verifier all PASS.
Failed diagnostic attempts remain FAIL in local logs; they are not the final
proof. The existing rollback/archive/Auth/Storage cleanup paths remain enabled.
Related reporting/management unit regression: 3 suites / 37 tests PASS, including
four cases distinguishing 42501 denial from schema error 42703. Focused lint and
diff checks PASS. CI on the follow-up commit must run before READY_FOR_MERGE;
initial Vercel/other checks do not carry over as proof for a new SHA.

## Batch tiep noi: Browser Management Persistence

Owner da duyet sua ba blocker trong mot batch Non-Production. Architecture:
PASS cho pham vi nay; khong mo lai Identity/HQ, sales-chain, kernel hoac Finance.

- Truth: customer UI dang doc mock va luu React state; intake chi timer/toast.
- Contract: AutoCustomerProvider.getProfile/upsertProfile va public
  MobilityFoundationService.registerVehicle da ton tai; tai su dung nguyen ven.
- Ownership: customers/core identity qua authenticated client; preferences thuoc
  AutoMove; vehicle/catalog binding va registration qua Mobility public contract.
- Authority: Auth -> getCurrentUser hien huu -> active users/tenant; RLS con lai
  kiem tra hien hanh. Khong tao role moi, HQ bypass hoac service-role business write.
- UI/API: list/profile/preferences co API rieng; intake them chon variant that,
  stable retry key, transaction va read-back; chi bao thanh cong sau persistence.
- Migration can thiet: READ ONLY E2E metadata chung minh auto_customer_profiles
  ton tai nhung authenticated khong co SELECT/INSERT/UPDATE. Forward migration
  20261015050000 chi cap ba quyen nay va scope policy dung tenant/customer. Khong
  sua lich su, helper hoac bang khac. Apply qua co che E2E migration hien huu.
- Business tests: tenant customer that hien thi; preferences reload dung; intake
  tao dung 1 vehicle in_transit voi variant cung tenant, 1 command/event/log;
  retry khong nhan doi, changed payload/foreign variant/customer bi tu choi;
  auth/inactive/suspended/wrong tenant fail closed, loi API khong thanh cong gia.
- Eleven gates: architecture boundary; public contract; real Auth; active
  authority; tenant negative tests; forward-migration safety; atomic persistence;
  audit/history; retry; Real DB + actual browser; focused regression/type/lint/diff.
- Pham vi tiep theo: cap nhat checkpoint nay, Final Review/PR neu dat. Chua co
  quyen merge/deploy Production; refund/cancellation/adjustment van ngoai batch.

### Management Batch Executed Results

`ARCHITECTURE_GATE = PASS_FOR_APPROVED_MANAGEMENT_SCOPE`
`MANAGEMENT_PERSISTENCE = PROVEN_ON_NON_PRODUCTION`
`DELIVERY = PR_338_OPEN_PENDING_CI`
`MAIN_SEAL = NOT_PERFORMED`

Root causes and repairs:

1. Customer page used mock rows/state. It now uses authenticated tenant-bound
   list/profile/preference APIs and the existing AutoCustomerProvider. Search
   and pagination are bounded. Save success requires a persisted read-back;
   errors remain visible. Loading/changing customer cannot submit a stale form.
2. Preference persistence existed, but E2E authenticated access was absent and
   the legacy policy allowed null-tenant fallback. Forward migrations
   `20261015050000` and `20261015050100` bind rows to the canonical tenant and
   an existing same-tenant customer. SELECT is granted; INSERT/UPDATE are limited
   to preferences and the unchanged upsert keys/timestamp. No aggregate, metadata
   or DELETE write grant. Existing metadata is preserved, not overwritten by an
   omitted preference field. Both migrations are durably applied and recorded
   through the existing E2E migration applier; no historical migration changed.
3. Intake used timer/toast without a write. It now selects a real tenant catalog
   variant and calls the existing public Mobility registration contract under
   authenticated SQL context. One transaction contains vehicle/status/event/
   idempotency persistence, with verified TLS, tenant/catalog binding, stable
   retry key, serialization and read-back before commit/success. No direct
   Product vehicle-table write or new Mobility contract was introduced.

Executed checks on the final scoped runtime patch:

| Check | Actual evidence |
| --- | --- |
| Real Next.js + Chromium management | 1/1 PASS, 2.7 minutes, no retry/skip; real Auth, customer list, preference save/reload and intake/reload |
| Failure/retry | Injected preference 503 does not save or report success; lost intake acknowledgement, sequential/concurrent same-key retries produce one vehicle; changed payload and duplicate VIN rejected |
| Authority | Cross-tenant customer/catalog blocked; injected tenant field rejected; inactive actor and suspended tenant return 403; restored valid actor can read persisted results |
| Real DB rollback verifier | PASS against durable migrations, including execution with CI's SUPABASE_DB_URL and no DB_URL; profile/vehicle reads, column restrictions, tenant denials, one command/event, zero rollback fixtures |
| Focused regression | 6 suites / 45 tests PASS: HTTP, customer loading race, vehicle authority, scoped CI selector, existing Mobility read contracts |
| Earlier permission mapping regression | 21 HTTP tests PASS for the retained sale-chain/payment 42501 -> 403 repair |
| Full strict application typecheck | `npx tsc --noEmit --strict --incremental false`: exit 0 |
| Lint / architecture / migration safety / whitespace | Focused ESLint, Architecture Guard, both migration SQL analyses and diff-check PASS |

The new Real DB suite is selected by exact management paths, not a fallback full
product run. It uses the CI-provided DB variable as well as local DB_URL and
keeps the existing effective-connection/Non-Production/TLS guard. CI and Vercel
must verify the PR head separately; see PR 338 CI Follow-Up above. Browser proof is
local Non-Production, not Browser CI on main or an approved release candidate.

Earlier browser attempts are not reclassified as PASS: one customer assertion
timed out during a cold request; another test raced fixture cleanup against an
unfinished lost-ack interception. The final spec awaits the actual list response
and intercepted registration completion before assertions/cleanup. No RLS, Auth,
TLS or business assertion was weakened. Final review also fixed stale-customer
form submission with two focused component regressions.

Independent post-run READ ONLY read-back confirms the final fixture has exactly
one preference profile with original metadata, one in_transit vehicle, one status
log, one domain event and one idempotency record. Both new migration versions
are present in history; preference UPDATE is allowed while metadata/aggregate
UPDATE is denied. Evidence: `.cache/automove-management-fix/reviewed-browser.log`
and `persistence-cleanup-readback.json`, plus scoped screenshots. The intake
screenshot captures the refresh/loading moment; the later reload/VIN assertion,
not that screenshot alone, proves the persisted vehicle appears in inventory.

Cleanup is PARTIAL: across the five management browser attempts, all ten fixture
tenant shells are terminated, Auth actors are removed and active actors are zero.
Customer/vehicle/audit history remains intentionally. The rollback-only verifier
leaves no fixture rows. Earlier business-chain fixtures and #337 immutable
records remain as previously documented; no rule, trigger or FK was disabled.

Final review found no remaining blocker in these three approved operations.
Owner authority permits commit/push/PR after verification, but not merge or
Production deployment. No Production DB access/mutation, Vercel/config change,
Platform helper/kernel, registry, Warranty, commission or Finance posting change.
Vehicle status controls/import and legacy analytics are not certified by intake
proof. Refund/cancellation/adjustment and release/recovery evidence remain outside
this management scope and unproven; no cancellation fee or forfeiture inferred.

`AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`
`GO_LIVE = NOT_PROVEN`

## Settlement Batch Executed Results

Implemented one scoped refund/cancellation batch on
`codex/automove-settlement-workflow`, based on sealed main `ef059443d` (#338).
Adjustment/reversal remains HELD by the owner's explicit decision; no accounting
period guard, recognition adjustment writer or Finance posting was introduced.

The additive migration `20261015060000` creates one append-only, receipt-linked
settlement-action table with active-accountant tenant RLS and server-owned
writes. It preserves existing receipt guards while accounting for recorded cash
refunds in the collection cap. Applied and recorded durably only on the approved
E2E project through the existing migration applier; no history rewrite or
Production DB access. No original receipt, snapshot or recognition is rewritten.

The API verifies real Auth, current active accountant/tenant authority, tenant
Storage content/checksum, original receipt and remaining refundable balance.
The booking lock and transaction cover the persisted fact, Mobility allocation
release, booking cancellation and reconciliation read-back. An aborted write
retains its original retry SQLSTATE; no role-reset query masks it. Network loss
fails closed, with bounded DB queries and no implicit command replay. A valid
retry retains its original key and returns the persisted action; changed intent
under that key is rejected. Current actor/tenant authority is still checked.

Cancellation before handover releases only the matching allocation through the
existing Mobility contract. Documented cancellation after handover leaves the
vehicle delivered and does not auto-refund or reverse revenue. The UI exposes
separate confirmed requests, retained retry intent and cancelled-booking history.
Cash reconciliation uses gross receipts minus recorded refunds, not revenue
reversal. Recognition after a pre-sale cash refund uses the verified net deposit
without changing the approved sale-price/cost snapshot.

| Check | Actual executed evidence |
| --- | --- |
| Settlement Real DB/RLS | 53 assertions PASS; allowed and denied actor/tenant operations, receipt caps, immutable originals, rollback injection, zero rollback fixture rows |
| Existing handover/recognition verifier | PASS with real Auth/Storage; 100M receipt less 20M refund recognizes 80M cash and 1,320M receivable against unchanged 1,400M revenue; savepoint rolled back |
| Existing post-sale payment verifier | PASS against the durable schema, including collection/retry/reconciliation regression |
| Actual Next.js + Chromium | 2/2 PASS, no automatic retry/skip: manual refund/lost acknowledgement/concurrent same and independent keys, wrong actor/tenant/document, delivered cancellation, reload/read-back; pre-recognition refund/cancellation releases allocation without revenue |
| Mobile follow-up | Recognized-sale browser test rerun PASS after a width-only fix; asserts dialog/control bounds at 390px and captures desktop/mobile screenshots |
| Focused regression | 9 suites / 71 tests PASS, including original SQLSTATE preservation, idle disconnect and malformed-success handling |
| Strict typecheck | 23 changed TypeScript root files plus dependencies, strict/noEmit, zero diagnostics |
| Other gates | Focused ESLint, Architecture Guard, one-migration zero-downtime analysis, API-doc coverage and whitespace checks PASS |
| Scoped CI selection | The new browser spec selects the settlement Real DB verifier; existing required selectors remain intact |

Browser fixture creation of customers/catalog/bookings/receipts/recognition is
privileged test setup, NOT evidence of those UI creation paths. The proven
browser operations use the real login, dashboard, API, Storage and database.
Evidence is local Non-Production, not Browser CI on main, release readiness or
a main seal. Screenshots/logs are local `.cache/automove-settlement/` artifacts,
not committed credentials or fixtures.

Earlier cold-compile, intercepted-response timeout, Auth/DNS/network failures
are not counted as PASS. The actual concurrency failure exposed a masked
SQLSTATE and was fixed with focused regression and subsequent runtime proof.
No Auth/RLS/TLS or financial assertion was weakened. Generic linked-project
migration check was not executable in this unlinked worktree; it is not reported
as PASS. Existing E2E apply/history verification and migration safety are the
executed local evidence; remote CI still has to verify this exact PR SHA.

Cleanup is PARTIAL: successful browser runs verify zero temporary Auth users,
zero active fixture actors, zero Storage objects and terminated own tenant
shells. Failed-network fixtures were recovered and their temporary identities
removed. Immutable financial/audit records and archived fixture shells remain
intentionally; no FK, append-only rule or trigger was disabled. The rollback
verifier leaves zero fixture rows. Unrelated generated `AGENTS.md` and cache
artifacts are excluded from the commit.

Single-agent final security/contract diff review found no remaining blocker in
this approved scope. Commit/push/open PR are authorized; merge, Production DB
mutation, deployment and configuration changes are not. Required remote checks
must PASS independently before any later merge decision.

`REFUND_CANCELLATION_RECONCILIATION = IMPLEMENTED_LOCAL_VERIFIED`
`ADJUSTMENT_REVERSAL = HELD`
`MAIN_SEAL = NOT_PERFORMED`
`PRODUCTION_MUTATION = NOT_PERFORMED`
`AUTOMOVE_FULL_PRODUCT_READINESS = NOT_READY`
`GO_LIVE = NOT_PROVEN`
