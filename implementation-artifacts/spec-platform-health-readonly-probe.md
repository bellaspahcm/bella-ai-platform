---
title: 'Platform Health: read-only DB connectivity without tenant-table access'
type: 'bugfix'
created: '2026-10-24'
status: 'in-review'
baseline_commit: '9f7381638115b72a55a5ecf5b52b2fd12dbe7df7'
context:
  - '{project-root}/docs/governance/BELLA_AI_CODING_CONSTITUTION.md'
---

<frozen-after-approval reason="owner explicitly approved the separate Platform Health scope on 2026-10-24">

## Intent

**Problem:** Local production-mode `/api/health` returns503 because its sessionless public client reads restricted `tenants`. Two valid public key kinds receive42501. DB connectivity and tenant data access are different capabilities; the canonical runner correctly refuses readiness.

**Approach:** Replace that entity read with a bounded server-side PostgreSQL connectivity probe: verified matching target/TLS, read-only transaction, constant SELECT1, cleanup. Preserve HTTP response/timing/cache contract and fail closed. Reuse installed pg/connection-string libraries and the existing verified Supabase connection-validation pattern/public vendor CA; no Product dependency from Platform Health.

## Boundaries & Constraints

**Always:** Only Platform health route, a co-located private probe and its tests. No tenant/business rows or caller authority used. Missing/invalid/conflicting target configuration, network/TLS/query/timeout/cleanup failure returns503 with sanitized error. Close connections on all paths. Reuse configured server DB_URL/SUPABASE_DB_URL/DATABASE_URL; no privileged API-key substitution. Preserve real DB failure and anonymous tenant denial.

**Ask First:** Hold a new public response contract, external target, deployment, permission/schema change or frozen integration-hub capability. Production execution remains forbidden. Release actions retain stage conditions already authorized by the owner; no merge/deploy authority.

**Never:** No Auth/RLS/grants/schema/Product/Kernel edits, tenant SELECT grant, business-table probe, service-key fallback, readiness/runner/selector bypass, NODE_TLS_REJECT_UNAUTHORIZED override or raw credential/error disclosure. Do not change old frozen specs or claim whole Product/Go-Live PASS from this repair.

## I/O & Edge-Case Matrix

| State | Expected behavior |
| --- | --- |
| Verified matching Supabase DB; SELECT1 succeeds | healthy200, environment/checks/timing retained; no entity read |
| Anonymous tenants access denied | Denial unchanged; independent connectivity can be healthy |
| Missing/wrong/conflicting config, unsafe URI/TLS override |503; no connection to unverified target |
| Local execution targets Production | Reject before connect; no Production probe |
| Connect/query/timeout/unexpected result/close failure |503, sanitized failure and connection cleanup |

</frozen-after-approval>

## Code Map

- `src/app/api/health/route.ts`: existing HTTP owner and public response.
- `src/app/api/health/database-probe.ts`: private, single-purpose probe; no global abstraction.
- `src/app/api/health/__tests__/database-probe.test.ts` and `route.test.ts`: allowed/denied/failure contracts.
- `src/modules/bella-auto/services/AutoMoveSaleChainConnection.ts`: read-only reference for proven target/TLS validation and public CA; unchanged.
- `src/lib/database/read-replica.ts`: legacy public client remains unchanged for other callers.

## Tasks & Acceptance

**Execution:**
- [x] Add private constant-query probe with verified target/TLS and bounded lifecycle.
- [x] Wire existing route and preserve response/cache/timing/environment fields.
- [ ] Test positive and unsafe/failure/cleanup paths; focused lint/typecheck and independent review.
- [ ] Bind clean candidate, execute actual Non-Production HTTP/DB checks and unchanged RC; then Customer44 on same build.

**Acceptance Criteria:**
- Given health is requested, when DB connectivity is verified, then200 reflects executed read-only SQL, not tenant visibility.
- Given denied entity access or failed configuration/DB/TLS, when checking health, then entity rights remain unchanged and real failures never become healthy.
- Given execution finishes, when evidence is reported, then exact SHA/build/target and unit versus HTTP/DB/browser scope remain separate.

## Business Test Contract

Canonical intent is the owner's explicit separate-scope approval plus Constitution least-privilege, truthful evidence and no-bypass rules. This is infrastructure connectivity, not new financial/tenant/domain semantics. Product identity, effective RLS and transaction correctness remain independent gates. Migration applicability: NOT_APPLICABLE.

## Design Notes

Change Map: existing Platform HTTP implementation repair; public body/status keys retained. Existing generic H1.2 connection helper is frozen/private and is not adopted. Moving the Product connection validator into shared scope would expand the task; a health-local probe reuses the proven validation pattern/public CA without editing that Product guard or introducing a shared framework.

Deployment flags validate configuration intent; they do not attest the physical host or authorize Production execution. The local-execution matrix row is enforced for this task by the unchanged canonical RC environment validator: it pins the Non-Production API, checks every DB alias and strips deployment flags before launching. HTTP and Customer44 verification reuse that same validator. The probe separately rejects a configured Production target without explicit deployment intent; its mocked deployment-intent test proves configuration handling only. No physical-host attestation or Production safety PASS is claimed.

## Verification

Focused Jest for probe/route plus runtime-environment and RC guard regressions; lint and strict scoped typecheck; architecture/diff checks. Real Non-Production: health200, anonymous tenant read remains42501, invalid connection503, exact-candidate canonical build/start/RC then unchanged Customer44. Static/unit results do not establish runtime/DB proof. Production is not exercised.

## Spec Change Log

Source candidate: focused mocked-driver/route/runtime/RC-guard verification ran 4 suites / 98 tests, all PASS; lint exited0. Actual HTTP/DB/browser acceptance remains NOT_PROVEN until a reviewed, committed candidate runs in Non-Production. No Production execution or permission/schema change is authorized by this status.

Review clarification: retain the frozen owner intent and runtime implementation. Separate deployment-configuration validation from the existing RC execution boundary; do not represent environment flags as host attestation. A single read-only probe diagnostic against the canonical Non-Production target succeeded; it is uncommitted-source diagnostic evidence, not candidate-bound HTTP/RC/Customer44 proof.

Runtime follow-up: SHA240e99b91be81ac5779f859417f8e9c484d6db82 passed the unchanged canonical RC (1 test, no failures/skips/flakes). A separate fresh-server healthy HTTP case returned503 and remains FAIL. Cold/warm timing observations measured1,915.6ms/741.2ms for the whole DB probe; the failed request did not retain phase timing, so timeout is a supported hypothesis, not a proven historical root cause. Increase only the total operation budget to3,000ms, retaining connect/idle2,000ms, per-query1,500ms and close500ms; keep fail-closed and add a bounded multi-round-trip regression. The changed candidate requires independent review, fresh exact-SHA RC and HTTP/Customer44 evidence; old RC does not transfer.

## Suggested Review Order

**Entry point**

- Preserve the health response while separating connectivity from tenant visibility.
  [route.ts:29](../src/app/api/health/route.ts#L29)

**Validation and lifecycle**

- Validate target and TLS before opening a bounded read-only connection.
  [database-probe.ts:48](../src/app/api/health/database-probe.ts#L48)

- Always close the owned socket, including timed-out driver operations.
  [database-probe.ts:118](../src/app/api/health/database-probe.ts#L118)

**Supporting checks**

- Cover denied configurations, failure cleanup and concurrent probes without network access.
  [database-probe.test.ts:37](../src/app/api/health/__tests__/database-probe.test.ts#L37)

- Check healthy, sanitized failure and response timing contracts.
  [route.test.ts:22](../src/app/api/health/__tests__/route.test.ts#L22)
