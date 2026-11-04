# F13 — resource correctness and individual enforcement review

01-11-2026. Base/main: `f1299e3138f3700062a1ed84271db315737b0071`. Local branch `codex/preschool-main-technical-20261101`. This continues the existing F13 task under the owner's explicit scanner/enforcement scope. **F13: BLOCK — NOT MERGE-READY.** Earlier reports, failures, the 77/33 inventory, catalog captures and seals remain historical evidence; this file records the later scanner revision.

## Minimal control change

The existing CI scanner now checks exact resource identity in addition to retaining the legacy count gate. Its identity contains source file, enclosing handler/method, transport method (`from`/`rpc`), explicit schema or client-default marker, complete literal target, SQL operation/RPC execute, and a bounded count. Line movement does not change identity. It never infers `public` from an unspecified client schema.

This catches target substitution within `edu_*`, movement from GET to POST in the same file, explicit schema changes, repeated calls and read-to-write changes. Returning `.select('id')` after UPDATE/INSERT/UPSERT/DELETE is identified as the mutation. Multiline literals and literal bracket-member calls are parsed through TypeScript AST, excluding comments/string examples. Nonliteral targets/schema, unknown SQL operations, malformed source and invalid reviewed counts cannot receive an exact-resource ALLOW. Shadowing `Array`/`Buffer` does not hide an unresolved client call behind the conversion-helper exclusion.

The existing `.github/ci/education-architecture-baselines.json` is **byte-identical**, still 265 historical occurrences. No report is imported as an allowlist; no exact exception was added. Prefix entries remain usable only for their historical count comparison and cannot prove the full target/operation. Consequently the new resource check remains BLOCK even for the historical literal debt until an authorized exact enforcement disposition exists. This is a deliberately stricter local candidate, not silent certification or migration of the 265 entries. Both the legacy count gate and resource gate must permit a run; there is no new exception path around the former. Future narrow exceptions require an explicit compatible decision for both checks, not just inserting a key.

Jest exercises the same exported resource scanner/comparator via a Node subprocess. It does not contain a copied implementation. Existing checks, CI workflows, selectors, hooks and required-check settings are unchanged. No Product/API/UI runtime file changed in this turn. Migration applicability: NOT_APPLICABLE. Existing F13 gate applicability remains architecture/boundary/control regression; this task does not exercise caller JWT, persistence, academic rules or the frozen Kernels.

## Executed checks

| Source scanned separately | Files | Legacy matches / added occurrences | Resource candidates | Unresolved | Outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| Clean main snapshot at pinned SHA | 185 | 342 / 77 | 362 | 20 | BLOCK |
| Technical worktree | 185 | 342 / 77 | 362 | 20 | BLOCK |
| Old WIP checkout | 185 | 314 / 54 (with 5 decreases elsewhere) | 334 | 20 | BLOCK |

The 362 candidates are **not 362 new violations**: 342 are literal calls in the old scan scope, and 20 are nonliteral expressions (including imported public-contract constants) the scanner cannot resolve. They do not replace the frozen **77 occurrences / 33 signatures**. Every frozen occurrence reconciles to an AST target/location. Main retains one explicit-any finding; technical has zero; WIP retains one.

- Node scanner regression: **14 tests PASS**, including actual CLI contract-only ALLOW and matching-prefix-debt BLOCK; `f13-resource-fixtures-final.log`.
- Architecture Jest: **1 suite FAIL, 8 tests PASS / 2 FAIL**. The failures are the retained legacy match gate and exact-resource enforcement, not hidden or skipped failures; `f13-resource-jest-final.json` / `.log`.
- Actual CI scanner: **exit 1 / BLOCK**, recorded separately in `f13-resource-ci-result.json` / `.log`.
- Scope scans and before/after WIP fingerprints: `f13-resource-scopes.json`. The collector's exit 0 means collection completed, not architecture PASS. Reproducer: `node docs/audits/preschool-main-20261101/verify-f13-resource-scopes.mjs`.
- Fresh `git diff --check` PASS; F10/F12 source and reused evidence verified against their existing seal. No F10/F12 regression or broad 2,032-test rerun. No new runtime TS code; the Education typecheck evidence for the unchanged F10/F12 remains reused, not a new run for this control revision.

## Enforcement review, no exceptions

`F13_CALLERS.md` / `f13-enforcement-review.json` record individual source callers, full resources, operations, contract references and reasons. All **34 Product API SQL + 8 workflow RPC** occurrences were reviewed; the full 77 retain an explicit disposition.

- **M066–M071:** Six Work Queue SQL occurrences have a concrete existing Architecture Gate that permits narrowly typed P6/P4 persistence ports at the HTTP infrastructure boundary. Their operations are five SELECTs and one conditional UPDATE, on exactly the resources named in the caller table. They are bounded storage candidates, not approved exceptions. `getCurrentUser` includes a development-only mock fallback, so the API comment alone is not a universal real-Auth guarantee. No auth behavior was changed.
- **M004:** Care POST's named non-health atomic command has matching source guards for authenticated admin, Product, branch, current day, active roster and all targets, rejects derived health, and validates the saved count. This is one bounded command candidate; installed function/ACL and real caller/rollback proof remain separate. No exception was added.
- **Other 28 Product API SQL:** Remain held or contract-mismatched individually. This includes private chat's explicit unavailable contract, unresolved Finance/Learning/Admission boundaries, and Portal paths where signed claims alone do not prove current guardian/resource authorization. No Product-wide exemption.
- **Other 7 workflow RPC:** Keep their own dispositions. Announcement publish retains F06's final-authorization/content-bound retry mismatch. Handover has a service-role-only proposal versus a caller-client fallback to reconcile. Daily and legacy Portal feed calls are different callsites; one does not authorize the other. Portal issuer source guards are not installed-command or direct-RPC denial evidence.
- **26 direct Education SQL:** Continue BLOCK; no general API SQL exception was found in the applicable public-contract authority. **6 Scheduling UI** remain HELD/F08; **3 profile RPC** remain HELD for producer/authority. No rewrite of these workflows.

All source-candidate labels are advisory audit findings. They are not permission changes, accepted debt or runtime approvals. The precise remaining decision is how the control owner will handle exact bounded paths while preserving historical debt and the legacy gate. The locked baseline and current proof gaps mean **zero exceptions applied** in this task.

## Remaining scanner limits

The scanner is syntactic, not a TypeScript dataflow/type-checking engine. Extracted/bound methods and arbitrary computed member names can evade its known-member call inventory. The retained legacy regex can still flag a code example embedded in a string/block comment. `f13-resource-edge-findings.json` records these unhandled paths; they are control limitations, not evidence of Production exploitation. No claim of exhaustive boundary enforcement is made. This task does not build a general analyzer or erase the existing failures to declare merge readiness.

F10/F12 remain **LOCAL PASS — SEALED**. F09 remains **HELD — DESIGN ONLY**; no adapter/function or rollback rehearsal. F01/F02 remain HELD; F03–F07 have no runtime remediation; F08/F11 stay unchanged. No schema/ACL/RLS/role/business/UI change, DB probe/mutation, seed, commit, push, merge, deploy or Production operation occurred. **Preschool NOT_READY; Real Auth/RLS, Browser and Production NOT_PROVEN.**
