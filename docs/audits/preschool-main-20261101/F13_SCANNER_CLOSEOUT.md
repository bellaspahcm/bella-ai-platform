# F13 — scanner correctness follow-up

01-11-2026. Pinned main/base `f1299e3138f3700062a1ed84271db315737b0071`; local branch `codex/preschool-main-technical-20261101`. Continues the owner's F13-only instruction and subsequent “tiếp tục”. **F13 remains BLOCK — NOT MERGE-READY.** This is the latest scanner record; `F13_RESOURCE_REVIEW.md` and its 14-test/edge-finding artifacts remain earlier evidence.

## Changes limited to the three existing control files

- Exact resource enforcement identifies file, enclosing handler/method, transport, schema/default-client marker, full target and read/write/RPC operation. Prefix signatures cannot authorize a different table, handler or operation. Unknown target/schema/operation cannot receive an exception.
- Extracted, bound, call/apply and destructured `rpc`/`from` members now produce unresolved references rather than disappearing from the inventory. Nonliteral computed member calls are conservatively unresolved; no arbitrary expression is evaluated to grant authority. These entries can include non-DB dispatch, so they are candidates requiring review, not automatically security defects.
- The legacy database count uses the same AST collector as exact enforcement. Only real calls retain the old signature spelling. String examples and inline/block comments no longer create database-call matches. Both gates remain active; neither uses the ownership report as an allowlist.
- Jest reuses the actual scanner/comparator and its legacy result through one cached subprocess. There is no second regex-based database scanner in the test.

No baseline, workflow, hook, selector, required check, Product/API/UI runtime, schema, permission or business rule changed. The baseline remains **265 occurrences**, with Git-normalized blob `1c451ddcad23ece97ff4117cece4b872635ac0b7`; no exact exceptions were added. Local CRLF bytes are compared using Git normalization rather than incorrectly treating `git show` LF bytes as worktree bytes.

## Verification actually executed

| Check | Result | Evidence |
| --- | --- | --- |
| Scanner regressions | **16 tests PASS**, plus existing same/new/reduced assertions | `f13-resource-v2-fixtures.log` |
| Actual CLI fixtures | Contract-only and string/comment examples ALLOW; unreviewed literal call and bound RPC BLOCK | Same regression log/test implementation |
| Architecture Jest on technical source | **1 suite FAIL; 8 PASS / 2 FAIL** | `f13-resource-v2-jest.json` / `.log` |
| Focused TypeScript | **PASS, zero diagnostics** for Architecture Jest root and its imported dependencies | `f13-resource-v2-typecheck.json` / `.log` |
| Actual CI scanner | **exit 1 / BLOCK** | `f13-resource-v2-ci-result.json` / `.log` |
| Diff whitespace | **PASS** | `f13-resource-v2-preservation.json` |

The two Jest failures retain the legacy direct-DB gate and exact-resource gate. No failing assertion was disabled or expectation inverted. Node fixtures prove scanner behavior; they do not supersede these source-enforcement failures. Focused typecheck is not a full Education or application build.

| Separate source scan | Files | Legacy matches | Added occurrences / signatures | Exact-resource candidates / unresolved | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| Clean main snapshot at pinned SHA | 185 | 342 | 77 / 33 | 362 / 20 | BLOCK |
| Technical worktree | 185 | 342 | 77 / 33 | 362 / 20 | BLOCK |
| Old WIP | 185 | 314 | 54 / 29, with 5 reductions elsewhere | 334 / 20 | BLOCK |

Both resource and legacy counts on real source stayed unchanged after the AST correction. The 362 are the original literal scope plus nonliteral candidates, not 362 new vulnerabilities. All frozen **77 occurrences / 33 signatures** reconcile to AST locations; the inventory is not replaced by WIP counts. Source main/WIP retain one explicit-any finding; technical retains zero.

`f13-resource-v2-scopes.json` retains the scanner hash and identical WIP fingerprints before/after: HEAD/branch, tracked diff and all 28 untracked files. Reproducer: `node docs/audits/preschool-main-20261101/verify-f13-resource-v2-scopes.mjs`. Collector exit 0 means collection completed; decisions remain BLOCK.

## Enforcement and limits

The individual review in `F13_CALLERS.md` / `f13-enforcement-review.json` remains applicable: **34 Product API SQL + 8 workflow RPC** reviewed separately. Six Work Queue storage occurrences have explicit Product persistence-port authority; one Care command has a matching bounded source path. These are held candidates, not exceptions or runtime certificates. Other calls retain their specific contract/identity/executor gaps. The 26 direct Education SQL, six Scheduling UI and three profile RPC cases remain BLOCK/HELD. No group exemption and no baseline amendment.

The three earlier recorded paths—computed member calls, method extraction/binding, and string/comment false positives—are addressed and covered by regression. The scanner still does not prove arbitrary JavaScript dataflow/reflection, imported constant values, client construction/schema hidden behind aliases, SQL inside RPCs, caller authorization or installed DB parity. Anonymous callback identity is bounded syntactic scope, not a complete callgraph. No general analyzer or runtime authorization system was built. These limits and the unresolved enforcement decisions prevent a broad or merge-readiness PASS.

F10/F12 remain **LOCAL PASS — SEALED**; their ten files and evidence hashes were rechecked without rerunning their 6 suites/76 tests. F09 remains **HELD — DESIGN ONLY**; F01/F02 remain HELD. F03–F07 runtime and F08/F11 main are untouched. No build, commit, push, merge, deploy, DB probe/mutation, seed, migration or Production action. **Preschool NOT_READY; Real Auth/RLS, Browser and Production NOT_PROVEN.**
