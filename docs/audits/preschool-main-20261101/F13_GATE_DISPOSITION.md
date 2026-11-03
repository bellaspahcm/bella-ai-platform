# F13 — two failing assertions and bounded enforcement disposition

01-11-2026. Base/main `f1299e3138f3700062a1ed84271db315737b0071`; technical branch `codex/preschool-main-technical-20261101`. **BLOCK — NOT MERGE-READY.** This turn is analysis/evidence only: no scanner, test, baseline or Product implementation changed; no exception approved/applied.

## What the two FAILs actually block

| Assertion in the current architecture test | Actual blocker | Exact caller evidence |
| --- | --- | --- |
| Line 99: `resources.status` expected ALLOW, actual BLOCK | **362 occurrences / 355 exact-resource signatures**; exact reviewed entries = 0 | Every source location, enclosing handler/method, schema, resource, operation and disposition is in `f13-gate-disposition.json.rows`. |
| Line 120: `unapprovedViolations` expected empty, actual 77 entries | **77 added occurrences / 33 legacy normalized signatures**, above the preserved 265 debt | `F13_GATE_CALLERS.md` enumerates all 33 groups, exact files, frozen IDs and resources. `f13-gate-disposition.json.groups` is the machine-readable equivalent. |

The exact gate's 362 split into **265 historical Product calls + the same frozen 77 API/UI calls + 20 unresolved expressions**. The 77 are not counted twice as independent vulnerabilities. These numbers describe control coverage/disposition, not 362 proven security or business defects. The pinned main and technical resource identity/count maps are identical, despite shifted source lines in the local F10/F12 diff. Technical has 86 API candidates (15 unresolved), six UI candidates, and 270 Product candidates (five unresolved).

Both assertions use the sealed scanner v2. Their source and evidence hashes were verified instead of rerunning unchanged Jest/16 fixture tests. Recorded results remain **8 PASS / 2 FAIL**, focused TypeScript PASS, actual scanner exit 1, baseline 265 unchanged. No expectation was inverted and no failing gate was suppressed.

## Seven narrow candidates — proposed disposition, not approval

For every row below, the proposed bound is the exact file + enclosing caller + schema/client-default marker + full target + transport + operation + **one static source occurrence**. This count does not limit runtime query frequency, records in a bulk payload or the two uses of a paginated-query helper. It is not a database grant or a permission rule. No prefix/wildcard, sibling handler, read/write promotion or same-file blanket exception is proposed.

| ID | Exact caller in source | Resource / operation | Contract and evidence | Disposition now |
| --- | --- | --- | --- | --- |
| M066 | `work-queue/incident-queue.persistence.ts:10`, `IncidentQueuePersistence/query` | `edu_health_incidents`, from/SELECT | P4 `IncidentQueueRepository`; Work Queue Architecture Gate explicitly places typed Product persistence at HTTP infrastructure boundary. | Boundary-supported storage candidate; KEEP HELD pending control decision. |
| M067 | Same file:26, `IncidentQueuePersistence/get` | `edu_health_incidents`, from/SELECT | Same P4 port; tenant + exact ID and missing/error handling are explicit. | Separate candidate; does not approve other methods in the file. |
| M068 | `work-queue/request-review.persistence.ts:13`, `RequestReviewPersistence/query` | `edu_comm_exceptions`, from/SELECT | P6 `RequestReviewRepository`; bounded pagination/count/filter extension is explicitly described by the Architecture Gate. | Boundary-supported storage candidate; KEEP HELD. |
| M069 | Same file:33, `RequestReviewPersistence/get` | `edu_comm_exceptions`, from/SELECT | P6 port; tenant + exact ID lookup, missing/error handling. | Separate candidate; no tenant-wide read approval inferred. |
| M070 | Same file:40, `RequestReviewPersistence/resolveOpen` | `edu_comm_exceptions`, from/UPDATE | Existing decision-only review contract; tenant/id/status/type/revision CAS, returned-row check, actor/time/receipt. Returning SELECT does not change its UPDATE classification. | Candidate only for this update path; no DELETE/INSERT or approval-rule extension. |
| M071 | Same file:49, `RequestReviewPersistence/financeNoticeIds` | `edu_comm_notices`, from/SELECT | P6 port reads notice provenance to keep Finance exceptions navigational; it does not mutate financial truth. | Separate SELECT candidate; not Finance write authority. |
| M004 | `care/bulk/route.ts:200`, `POST` → `save_care` | `preschool_save_care_records`, rpc/EXECUTE | Approved non-health Care contract; route checks Auth/profile/Product/day/branch/roster/all targets, rejects derived health, validates saved count. | Bounded command candidate; KEEP HELD. Installed executor/ACL, actual caller denial and rollback remain NOT_PROVEN. |

All file paths in that table are beneath `src/app/api/education/`. Exact identities and reasons are retained in `f13-enforcement-review.json` and the new gate inventory.

The Work Queue authority is `docs/audits/preschool-attention-work-queue/ARCHITECTURE_GATE_RESULT.md`, not just a table-name ownership inference. Its Product ports are `parent-engagement/repositories/request-review.repository.ts` and `care-wellbeing/incidents/incident-queue.repository.ts`. The current delivery adapter uses existing active-admin/Product checks and server configuration. `getCurrentUser` also has a development-only mock path: the API comment is not proof of real Auth in every environment. This task does not change that dependency or declare it safe.

Existing Work Queue tests contain synthetic PostgREST tenant isolation, role denial, revision/CAS, read-back and false-success cases. Care access tests contain payload/target denials, command delegation, malformed acknowledgements and mocked rejection. Their source was inspected; they were **not executed in this turn** and are not Real DB/RLS proof. In particular, a mocked exception named “transaction rollback” does not prove a PostgreSQL rollback.

## Executed, non-operative narrowness check

`node docs/audits/preschool-main-20261101/analyze-f13-disposition.mjs` used the unchanged real comparator and sealed real call identities. It created seven hypothetical exact entries **only in memory**; it did not invoke the architecture CLI with a replacement baseline, import this report into a guard or save any approved-entry configuration.

- **7 positive probes PASS:** only each candidate's exact tuple once is recognized by the resource comparator.
- **114 negative probes PASS:** changed file/caller/resource/schema/operation/transport, unknown target/schema/operation, extra occurrence, all 26 direct Education SQL and all 20 unresolved expressions remain BLOCK.
- Specifically, hypothetical M004 permission does not approve M005, the Care GET direct Attendance SQL in the same file. Each SQL read/write tuple substitution remains BLOCK; M070's UPDATE is recognized separately as one of the seven positive tuples.
- With those seven hypothetical resource entries, **355 occurrences / 348 resource signatures** remain unreviewed; all 20 unresolved remain BLOCK. The unchanged legacy gate still blocks **77 / 33**. Whole-source result remains BLOCK.

This proves narrow comparator behavior for the executed inputs, not exception approval, semantic correctness, tenant enforcement, Auth, DB or Production. Actual exception count is still **zero**. The script verifies that tracked diff and baseline hashes are unchanged after the probes.

## Disposition of the other callers

| Set | Disposition / separate work boundary |
| --- | --- |
| 26 direct Education SQL | KEEP BLOCK. If existing public contracts cannot satisfy the caller, open a separately authorized owning-contract task; no Product workaround or Kernel change under F13. |
| Other 28 Product API SQL | Keep each existing disposition in `f13-enforcement-review.json`: private chat conflicts with the unavailable contract; Admission/Finance/Learning need their existing contracts reconciled; Student/health/Portal reads require proven identity/resource paths. Ownership alone grants no exception. Any implementation correction is a separate F01–F07/identity/Portal task. |
| Other seven workflow RPC | Keep individual holds: Announcement final authorization/content-bound retry (F06), Handover executor/proposal parity, and Portal daily/legacy/issuer bindings. Do not approve the entire handler/RPC family. |
| Six Scheduling UI | KEEP HELD/F08. No seed, browser persistence refactor or UI change. |
| Three profile RPC | KEEP HELD for canonical producer/independent authority. No identity model or new grants. |
| Historical 265 Product calls | Retain the reviewed legacy debt exactly. They are not newly reviewed as exact-resource exceptions. The control owner must decide how historical debt is represented in the exact gate; no automatic baseline generation, reclassification or full re-audit occurs here. |
| 20 unresolved expressions | KEEP BLOCK under current unknown-target policy. Source identifies 19 exported constants and one typed two-name dispatch, but the scanner does not resolve them into literals. Do not convert valid consumers to literal calls merely to make CI green. |

For the last row, source evidence is specific: 15 calls use `CURRENT_ACTOR_PROFILE_RPC = platform_current_actor_profile`, one uses `CURRENT_ACTOR_ORG_UNIT_ACCESS_RPC = platform_current_actor_org_unit_access` (`src/platform/security/current-actor.contract.ts:6,8`); three Finance calls use the two constants in `preschool-finance-branch.contract.ts:2,3`; one `atomicReconciliationRpc` dispatch uses a typed union of `preschool_reconcile_finance_atomic` / `preschool_recover_finance_reconciliation`. This identifies producers; it does not prove permission, active executor or runtime values, and does not authorize unknown-key exceptions or more scanner development in this task.

## Remaining control decision

The two gates are combined with OR-for-BLOCK. Adding seven resource keys alone could not clear legacy's 77; removing seven legacy counts alone would not clear exact's remaining 355. A consistent disposition is required for **both** controls, including historical 265 and unresolved 20, before a future merge-ready claim. This is an enforcement-policy decision, not a license to suppress an assertion or redesign Product workflows. No such policy/baseline change is made here.

F10/F12 remain LOCAL PASS — SEALED; F09 DESIGN ONLY; F01/F02 HELD; F03–F07 runtime and F08/F11 main unchanged. Only an audit analysis script and evidence were added. No build, scanner/test/Product source edit, commit, push, merge, deploy, seed, DB probe/mutation, permission or UI change. **Preschool NOT_READY; Real Auth/RLS, Browser and Production NOT_PROVEN.**
