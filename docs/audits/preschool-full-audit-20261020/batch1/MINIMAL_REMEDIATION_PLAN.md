# Minimal remediation proposal — for owner approval, not execution

## Decision requested

Approve the **scope and controlled preparation of Batch2A anonymous containment** on exact Supabase project `lvnvkpyxtuilhrabtlwv`, using the32-table allowlist in `reviewed-scope.json`. Production application remains subject to successful isolated rehearsal, scoped recovery verification, fresh preflight and explicit owner GO. Batch2B role/branch policy changes and API implementation require their own bounded authority/semantics reconciliation; they are not implied by approval of this ACL-only draft.

The user's Batch1 request explicitly requires read-only work and a plan for approval before policy/grant changes. This packet provides the concrete proposal; it does not grant itself implementation or production authority.

## Why this delta

Observed production mechanism is direct anon grants combined with permissive PUBLIC policies. All32 selected relations have explicit anon ACL; none has a PUBLIC table grant or column ACL in the captured scope. Role anon is not BYPASSRLS. A table-scoped `REVOKE ALL PRIVILEGES ... FROM anon` therefore targets the direct anonymous access path without inventing a role matrix or changing financial/health business rules.

The allowlist is static: 31 Product-owned `edu_comm_*`, `edu_fac_*`, `edu_fin_*`, `edu_sched_*` tables plus shared `students`. It is **not** `ALL TABLES IN SCHEMA public`. Do not edit global role memberships, schema/default ACL, existing service-role authority, frozen Kernel files or historical migrations.

`PROPOSED_ANON_CONTAINMENT.sql` is a review draft. It is not under `supabase/migrations`, contains no COMMIT, and has not been sent to a DB. `generate-proposal.cjs` generated files locally only. Do not execute this draft during Batch1, even though it ends with ROLLBACK.

## Ownership and expected compatibility

- Platform/Identity owner approves shared `students` ACL boundary. Product/Security owners approve the31 Preschool table delta and degradation of any anonymous-dependent UI.
- Authenticated ACL, policies, functions, service-role permissions, schema and business rows must remain byte-/catalog-equivalent across Batch2A. Remaining authenticated PUBLIC-policy exposure is explicitly **not fixed** by this phase.
- Existing browser-direct Scheduling/Facilities clients that accidentally operate as anon may stop reading. That is a containment effect requiring clear unavailable UI and an authenticated server contract in later work; do not restore anonymous privileges to keep those screens appearing functional.
- Parent portal access must continue through verified token/guardian server paths; signed portal users do not receive direct anonymous DB entitlement.
- Direct privileged API bypasses such as Courses cannot be fixed by revoking anon ACL because those APIs use service-role. Treat them as a distinct Batch2B task with source/negative evidence, not evidence that ACL containment failed.

## Preconditions before any write

1. Owner approval names the32 relations and the exact project. Freeze source/catalog snapshot hashes; re-read current catalog and abort if predicates, grant chains, role memberships, column grants, view dependencies, or target identity drift. Do not widen scope automatically.
2. Isolated target matches required table shapes, grants, policies and relevant auth helpers. Current `bmnb…` lacks31/32 selected tables; provisioning/reconciliation of that target must be explicitly scoped and use canonical schema. No production business-data copy is required for ACL tests.
3. Have valid, non-privileged test sessions for allowed and denied existing roles and tenants. Do not generate JWTs with admin secrets or inject service clients into the behavior under test. Exact allowed role/branch expectations must come from approved contracts, not the current permissive state.
4. Preserve the exact prechange ACL/policy/helper baseline (`reviewed-scope.json`, full catalog snapshots) and verify recovery on the isolated target. This metadata snapshot is a scoped security-change recovery artifact, not proof of full business backup/restore or Go-Live.
5. Production owner GO covers the bounded execution artifact, time, postconditions and monitoring. Create a new reviewed additive migration/execution artifact only after authorized implementation; do not silently change this proposal's ROLLBACK into COMMIT or edit historical migrations.

## Batch2A implementation shape (not performed)

1. BEGIN, local lock timeout5s and statement timeout30s.
2. Revoke all direct anon privileges on the exact32-table static allowlist. This removes read and latent write/maintenance rights; grants to authenticated and service_role remain unchanged.
3. Assert absence of effective anon SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on every selected relation. If grants inherited via PUBLIC/membership or column ACL differ from baseline, abort for owner analysis; do not repair by granting or broadening roles.
4. Compare policies/functions/non-anon ACL and schema fingerprints against prechange snapshot; compare owned fixture/business counts in the appropriate isolated verification scope.
5. In isolated rehearsal ROLLBACK. For production, use only the subsequently approved migration/execution artifact with explicit COMMIT after preconditions. This draft is not that artifact.

## Required tests and acceptance evidence

| Test | Expected invariant | Environment |
| --- | --- | --- |
| Anonymous direct table GET for all32 relations | No business row or count returned; direct privilege denial expected | Isolated target first; production GET-only after authorized apply |
| Anonymous filter target tenant / other tenant / no filter | All denied; query tenant cannot establish identity | Both as above |
| Anonymous direct INSERT/UPDATE/DELETE and TRUNCATE privilege | Denied; no changes or side effects | Owned isolated fixtures only; no production mutation probes |
| Existing permitted authenticated SELECT and required operations | Same approved allowed behavior before/after ACL-only delta | Real user sessions, isolated fixtures, independent read-back |
| Denied authenticated role, inactive user/tenant, tenant B/branch B | Denied according to approved RBAC/RLS contract | Batch2B role/branch scope; not declared fixed by2A |
| Same auth session direct API versus PostgREST | Both enforce their intended trust boundary | Real user session; server privileged reads cannot substitute for RLS |
| Parent signed portal / guardian relation | Valid authorized path retained, invalid/foreign guardian rejected | Existing token policy, isolated fixtures; no Batch1 issuance |
| Service worker read/write | Existing approved worker capability unchanged | Approved worker identity, isolated target |
| Atomic failure and lock conflict | No partial ACL delta; no lost business rows | Isolated rehearsal |
| Non-anon ACL/policy/helper/schema fingerprint | No unintended delta from2A | Catalog pre/post |

Record actual commands, counts, raw exits, identity/revision and fixture cleanup. A missing table, skipped role session, mocked guard, HTTP200 or timeout is not a pass. Batch2B completion still requires positive/negative tenant×role×branch proofs; phase2A success alone does not close Batch2 or full E2E.

## Recovery / rollback

- Before commit: transaction failure/lock timeout rolls back the entire ACL delta. Verify the scoped catalog is unchanged; do not retry blindly against production.
- After authorized commit: prefer roll-forward to a corrected authenticated server path. Keep anon closed while diagnosing functional degradation. The proposed delta does not modify authenticated grants, so an access path that was actually authenticated should not require re-granting anon.
- Prechange broad anonymous ACL and true policies are preserved for forensics, **not an automatic rollback script**. Reopening the confirmed anonymous leak is not an acceptable routine rollback. Any exceptional security reversal requires a new explicit owner/security decision.
- For later policy changes, prepare a separate reviewed recovery artifact that restores the last *scoped, secure* authenticated state while preserving anon denial; do not restore PUBLIC true as a convenience.

## Batch2B / later boundaries

1. Fail-closed session/actor/tenant/role resolution before privileged access: Medication, Courses/Care, AI role override, announcement and token issuance. Do not change dose/fever/ratio semantics or bypass Course POST/Parent Daily503.
2. Replace/remove unsafe applicable PUBLIC policies using the approved Product/Platform read/write contract. Adding a permissive restrictive-looking predicate beside an existing permissive true policy does not fix OR semantics. A RESTRICTIVE tenant fence may be a design option, but role/guardian/branch exceptions require owner evidence before choosing it.
3. Reconcile shared `students` with current Platform identity rules; E2E's different role policies are evidence, not blanket approval to deploy them to production.
4. Preserve custom branch and academic boundaries; `getUserAccessibleUnits` currently returning all tenant units is not proof of permission.
5. Remaining43 anon-TRUNCATE-granted relations within the inspected scope and any SECURITY DEFINER/public RPC access need separately bounded risk review. No schema-wide revoke or RPC execution is authorized here.

## Status

Proposal **READY_FOR_OWNER_REVIEW**. Execution approval **PENDING**. Isolated rehearsal **NOT_RUN / current target schema insufficient**. Production migration **NOT_APPLIED**. Anonymous production DB access **FAIL**. Authenticated write/read-back **BLOCKED**. Business semantics/full E2E/Go-Live **NOT_PROVEN**.
