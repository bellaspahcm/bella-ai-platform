# AutoMove Business-Chain Verification

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
