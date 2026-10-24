# Production anonymous containment — verified within approved scope

Execution date: **2026-10-21, Asia/Saigon**. Supabase project **`lvnvkpyxtuilhrabtlwv`**. Transaction committed at `2026-10-20T17:18:50.820Z` / `2026-10-21T00:18:50.820+07:00`; production transaction ID `1787735`.

Source: `codex/preschool-full-audit-20261020@339c89250d87964ba8d58860a5ecdbc0bdde4956`. Production deployment remains `dpl_9FQrTej4gajN95v6MwLJ31f3pUTQ`, `main@f973dd7e56542aa7847b98c2a4236da86f1eabc3`.

## Required results

| Field | Result | Scope and evidence |
| --- | --- | --- |
| `PRODUCTION_CHANGE` | **PASS** | One approved explicit-COMMIT ACL transaction, exit 0; exact live postconditions and independent catalog/HTTP verification passed |
| `ANONYMOUS_CONTAINMENT` | **PASS** | **Only the approved 32 relations plus `public.exec_sql(text)`**. 96/96 anonymous table requests denied HTTP 401 / SQLSTATE 42501; anonymous constant-SELECT RPC denied HTTP 401 / 42501 |
| `AUTHENTICATED_ACCESS_REGRESSION` | **NOT_PROVEN** | Production authenticated/service SQL-role ACL checks and service-role HTTP checks pass. Real-user Auth/browser workflow regression was not run |
| `BATCH2B_RBAC_RLS` | **NOT_STARTED** | Existing authenticated permissive policies, privileged authenticated RPC execution and API authorization gaps remain outside this containment change |
| `PRESCHOOL_GO_LIVE` | **NOT_READY** | Product security and independent readiness gates remain open |

**This is not a claim that all anonymous production access is closed.** Courses still returns HTTP 200 / 8 classrooms without a user session through its existing service-role server API. That is the separately identified Batch2B API gap, outside the approved table/RPC ACL delta. The approved Batch1 plan explicitly distinguishes that path from direct table ACL containment.

## Applied delta and authorization

Owner approved the 32-table containment on 2026-10-20 and replied `aprove` on 2026-10-21 to separately authorize the EXECUTE boundary of the blocking RPC. No further scope was added.

One atomic transaction:

1. Removed PUBLIC/anon EXECUTE on **only** `public.exec_sql(text)`.
2. Converted pre-existing effective EXECUTE rights of 29 current non-anonymous roles to explicit grants. All 33 current non-anonymous roles retain their previous effective EXECUTE/grant-option state; the three existing explicit RPC grants remain. This preserves current rights and does not endorse the existing authenticated SQL executor as secure.
3. Revoked direct anonymous privileges on exactly the approved 32 relations, including `students`, `edu_fin_invoices` and `edu_fac_assets`.

No function body, policy, role membership, schema/default ACL, other relation ACL, business row or frozen Kernel code was changed. No commit/push/PR was performed.

Execution artifact: `EXECUTE_APPROVED_32_TABLE_ANON_CONTAINMENT.sql`, **593,360 bytes**, SHA-256 **`20e6b2e817b256b481ecefa5338ff5db0deafad8b4142cf8d818ffa79e32b027`**. Bounded `lock_timeout=5s`, `statement_timeout=30s`; exact catalog assertions precede and follow the delta. The original Batch1 proposal and stopped Batch2A artifact/evidence remain preserved.

## Evidence before execution

- Target was refreshed through the Vercel production environment/deployment and matching Supabase public-key project claim. Source and deployment SHA remained unchanged (`production-identity.json`).
- Fresh selected table fingerprint matched the original baseline exactly: 32 relations, columns/constraints/policies/triggers/helpers, table/column grants, relevant roles/memberships, schema/default ACLs and dependencies (`drift-check.json`, `final-pre-both-cli.json`).
- No anon parent membership, no dependent view and no incoming stored-function reference to exec_sql were found. Refreshed non-system dynamic SECURITY DEFINER inventory contained only this one executor.
- Before HTTP verification: all 32 direct table reads succeeded; anonymous and service-role constant-SELECT RPC both returned 204; service-role table reads succeeded (`http-before.json`). Earlier Courses timeout attempts were retained and not treated as passes; the completed baseline subsequently returned 200 / 8 classrooms.

## Isolated rehearsal and recovery

PostgreSQL 17.10 ran on loopback `127.0.0.1:56329` in a separate local cluster. Only scoped production metadata and empty necessary reference-table shapes were reproduced; **zero production business rows copied**. Synthetic local rows exercised positive reads.

**18/18 checks passed**, command exits 0: 12 table/transaction/lock/ACL/recovery checks plus six RPC checks. This includes 160 denied anonymous SQL operations across the 32 tables, failure injection before/partway/after mutation, lock timeout rollback, actual RPC denial, actual constant-SELECT executions under all 33 non-anonymous roles, failure after RPC plus 16-table revokes, and restoration of the complete original scoped ACL inside a rolled-back recovery trial.

The first local RPC recovery attempt restored equivalent grants in a different raw ACL order. Recovery was corrected to reconstruct the original order, and the same strict comparison passed. The first scaffold attempt to ALTER reserved built-in roles failed; the scaffold now reuses and verifies their existing definitions. Failed attempts and exit codes are retained. Neither failure changed production or weakened assertions.

`RECOVERY_LOCAL_TRIAL_ONLY.sql` proves scoped recovery and ends in ROLLBACK. Reopening the original anonymous exposure is not an automatic production recovery action. This is not full disaster-recovery/restore proof.

## Independent production postchecks

| Check | Actual result |
| --- | --- |
| Production transaction | CLI exit 0; `ACL_POSTCONDITIONS_PASS`, scope 32, effective anonymous table privileges 0 |
| Exact selected table catalog | Matches expected anon-only ACL delta |
| Exact RPC catalog and effective roles | Matches expected PUBLIC/anon removal plus equivalent current non-anon grants; anon EXECUTE false |
| Anonymous REST, all 32 relations | 96/96 denied: unfiltered, Preschool-tenant filter and unrelated-tenant filter; HTTP 401 / 42501 |
| Three previously demonstrated leaks | `students`, `edu_fin_invoices`, `edu_fac_assets` all denied in every variant |
| Anonymous RPC `SELECT 1` | HTTP 401 / 42501; previously 204 |
| Service-role REST, all 32 relations | 32/32 HTTP 200; three previously nonempty relations still returned one row each, values discarded |
| Service-role RPC `SELECT 1` | HTTP 204 |
| Authenticated SQL role | 32 actual permission/read-plan checks plus constant-SELECT RPC pass in READ ONLY transaction; no user JWT |
| Service SQL role | Same 32 checks and constant-SELECT RPC pass in READ ONLY transaction |
| Outside relation metadata/ACL | Hash unchanged across 2,642 public/auth relations outside the allowlist |
| Policies, other function bodies/ACL, full memberships, schema/default ACL | Before/after hashes unchanged |
| Role flags | Hash unchanged; transient CLI login expiry excluded because Management CLI refreshes it |
| Courses anonymous server API | Still HTTP 200 / 8 classrooms; Batch2B remains open |

Raw/projection evidence: `production-execution.json`, `production-execution-cli.json`, `post-catalog-cli.json`, `catalog-verification.json`, `http-after.json`, `positive-authenticated-cli.json`, `positive-roles-cli.json`, and `outside-{pre-normalized,post}-cli.json`. HTTP evidence stores statuses/counts only, not business row values, keys, tokens or cookies.

## Scheduling / Facilities impact and remaining limits

The existing client pages construct public Supabase clients and Product repositories directly (`src/app/dashboard/education/scheduling/page.tsx`, `src/app/dashboard/education/facilities/page.tsx`). Their anonymous data paths to the approved Scheduling/Facilities relations now return **401 / 42501**, as independently demonstrated for every affected relation. Consequently anonymous-dependent list reads and operations no longer work; no anonymous grants were restored to keep the UI functioning.

A valid logged-in user's browser session was not available for this run, so the exact rendered page behavior and legitimate workflow regression remain **NOT_PROVEN**. Permission/read-plan checks do not establish correct tenant/role RLS, business semantics, or real-user E2E. No production write was attempted to demonstrate a UI action failure.

Authenticated public policies and authenticated privileged RPC execution are preserved, not remediated. Courses' service-role API bypass also remains. These belong in the separately bounded Batch2B RBAC/RLS/API work; no additional table, policy or runtime change was made here.
