# Approved matrix implementation — 2026-10-21

Owner matrix decisions were implemented locally in five isolated branches. This report describes bounded source containment and current verification; it does not certify full Preschool authorization or release readiness.

| Group | Implemented behavior | Focused tests | Delivery |
| --- | --- | --- | --- |
| Copilot | Verified Auth/current profile tenant and approved action roles; no caller-supplied privilege |78/78,3 suites |Local88314bacf; three source reviews completed |
| Medication |Every POST410 PRESCHOOL_MEDICATION_DISABLED before parsing/Auth/DB/service |5/5,1 suite |Local4269492fb; three source reviews completed |
| Care |Session client, canonical branch grants and active enrollment; full target preflight; health input blocked |67/67,1 suite |Local7012ca82f; three fresh source reviews completed |
| Portal |Configured signing only, new TTL≤24h, legacy expiry preserved, current guardian binding, parent questions only |104/104,4 suites |Localdaf358e7a; three fresh source reviews completed |
| Announcements |Auth/admin/Product gate; unsafe publication removed, dependency unavailable before writes |32/32,1 suite |Local65adcebab; three fresh source reviews completed |

Total286 tests in10 suites, zero pending. Native Jest, lint, scoped Education TypeScript and secret scan exit0 for every group. Source manifests and command/result JSON are retained in each batch2e–2i folder in its attached worktree; raw logs remain local. source-groups-summary.json maps the exact paths, branches and SHA256. Scope guard and no production mutation do not substitute for RLS proof.

Actual local HTTP: Care4/4, Portal8/8, Announcements2/2 denied expected401 with effective no-store, Next16.3.8, loopback offline DB and synthetic keys. Copilot and Medication each have4/4 observed expected denial/status and effective no-store; their earlier harness raw FAIL compared exact Cache-Control spelling against a development runtime rewrite. Raw failures and separate assessments are retained, not rewritten as PASS. All listeners closed. Generated Next AGENTS deltas were inspected, saved and restored; no guard or engineering control was changed.

The initial Copilot staging check rejected an extra EOF blank line in newly generated SPEC; the doc-only EOF fix passed the same check and configured pre-commit Architecture Guard. Guard checked21/15 files for the two local commits. No push, merge, new deployment, schema/grant/policy or business-data mutation in these source groups.

## Explicit dependency holds and residuals

- Care admin_staff stays503 until a trusted Auth User→teacher Party mapping and assignment binding exists. Auth/Person/Party identities are not equated. Noncurrent school days503 because the current public Enrollment DTO has no effective-status history. Health input503 until governed policy exists. Whole-bulk authorization precedes writes; operational transaction failure, concurrent scope revocation and real authenticated RLS remain NOT_PROVEN.
- New Portal issuance stays503 after Auth/admin/Product checks until guardian/student/enrollment/authorized-branch composition is proven. No default guardian or automatic mapping/bootstrap. Existing bearer-token payload/chat server capability is retained behind stronger live binding; it is not authenticated client-RLS evidence. Individual token revocation and valid real-user DB/browser flow remain NOT_PROVEN. Historical aggregator defaults and other canonical-truth findings are separate remaining audit work.
- Broadcast stays503 before writes until recipient scope, branch authorization and idempotent per-recipient lifecycle are proven. Classroom broadcast remains outside v1. No schema or fanout was invented. Historical notices and medication service/data remain unchanged.
- Full authenticated RBAC/RLS across all routes, staff identity delegation, branch isolation in other workflows, canonical-truth/UI defaults and complete Platform reuse are not closed by these five patches.
- Applicable broader Education/Healthcare commands ran earlier with explicit offline DB; actual conformance/DB-dependent regression failures and unrun chained gates are retained in batch2e-ai-auth. Full regression is FAIL/ENVIRONMENT, not waived or converted to PASS. Source review/Real DB/Browser/release gates remain distinct.

## Production evidence and required status

Earlier approved ACL batches were verified on project lvnvkpyxtuilhrabtlwv. Post-merge production source30134055d deployment dpl_G4DUXNTkNq8sEk2q7p6FRDydhsom became READY with canonical alias; Courses anonymous/forged list/detail4/4 application401 and no classroom data. Fresh exact32 direct-table probes96/96 anonymous denied,32/32 service LIMIT0 allowed; anonymous exec_sql denied, maintenance SELECT1 retained. Shared-identity READ ONLY probes6 EXPLAIN-only DML checks plus4 writer calls denied42501 before bodies. These are scoped actual observations, not a whole-product security result.

| Required label | Actual state |
| --- | --- |
| PRODUCTION_CHANGE |PASS for earlier bounded approved ACL batches; NOT_RUN for these five new source groups |
| ANONYMOUS_CONTAINMENT |PASS for tested32 relations/RPC/Courses scope; other API rollout not completed |
| AUTHENTICATED_ACCESS_REGRESSION |NOT_PROVEN |
| BATCH2B_RBAC_RLS |IN_PROGRESS |
| PRESCHOOL_GO_LIVE |NOT_READY |

Initial Care reviewers and the Portal builder returned usage-limit errors. Their failed/partial review output was never PASS. After the user resumed, nine fresh independent reviewer sessions completed Care/Portal/Announcements (Blind/Edge/Acceptance each), with no actionable introduced defects. Historical blocker records are preserved separately. No runtime code changed during review. Same-context self-review is not represented as independent; owner matrix approval was not requested again.

Five local source commits were composed with provenance into codex/preschool-authorization-matrix-20261021 from unchanged origin/main30134055d. The combined source retained all21 exact committed Git blobs. Git checkout converted some working CRLF representations: an initial raw-working-byte precondition blocked all four commands before tests ran, then independent committed-blob plus CRLF-only equality proved composition. All four actual combined commands subsequently ran:286/286 tests,10 suites, lint, scoped Education TypeScript and secret scan exit0. Raw precondition failures are not test failures or a rewritten PASS. Delivery evidence is under batch2j-delivery in the attached integration worktree; source remains unmerged and not deployed to production.

Portal's first local commit did not execute a configured-but-missing ignored Husky shim. Normal npm prepare installed the existing runtime; unchanged filename-only guard then checked the exact23-file sealed path set through an isolated baseline index, native0, real index/HEAD unchanged. This is separate manual guard evidence, not historical pre-commit. Other groups' pre-commit executions are recorded in local-commit logs. No protection implementation, policy, baseline or configuration value was changed.

Care physical node_modules is shared by sibling junctions; do not archive/remove that target while links exist. Original D: audit worktree and all historical evidence are preserved.

## Exact-head delivery and preview verified — 2026-10-21

Pushed source b85722f6eab1aedc3d9bd977bd3deee19e5684e5, independently matched remote branch and attached draft PR407 https://github.com/bellaspahcm/bella-ai-platform/pull/407.98 paths:21 source/tests and77 contract/evidence paths. CI on this exact head completed28 successful emitted checks,5 skipped, no pending/failure. Actual unit10 suites/286 tests and Logistics15 suites/547 tests passed. Skipped Real Database Business E2E/Migration Gates remain unexecuted; no full authenticated RLS or complete Platform regression claim follows. See pr407-ci-latest.json and timestamped snapshots.

Exact-head Vercel preview dpl_CxwkgfbVR889YBdj26dfqvmmsb79 READY.22/22 actual requests across11 route/method paths (anonymous and forged context) received their approved401/410 denial shapes and private/no-store. Existing automation protection access used in memory; no protection change, real Supabase user session, valid token, business-row content or production mutation. Source and production target remained stable during probes; production stilldpl_G4DUXNTkNq8sEk2q7p6FRDydhsom/source30134055d. See preview407-latest.json and timestamped reports.

Initial preview raw result FAIL (20/22): the harness required success:false on Copilot despite its existing error-only DTO. Source and tests confirmed that preserved contract; no runtime/config change was made. A bounded rerun validates Copilot's exact error-only keys and the approved envelope elsewhere,22/22 PASS. The original raw failure remains evidence, not rewritten.

PR remains draft, no merge/production source rollout performed. Required status for this new source batch remains PRODUCTION_CHANGE=NOT_RUN; scoped earlier production ANONYMOUS_CONTAINMENT=PASS for32/RPC/Courses only; AUTHENTICATED_ACCESS_REGRESSION=NOT_PROVEN; BATCH2B_RBAC_RLS=IN_PROGRESS; PRESCHOOL_GO_LIVE=NOT_READY.
