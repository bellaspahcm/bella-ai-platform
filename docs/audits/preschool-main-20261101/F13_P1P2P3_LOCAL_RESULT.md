# F13 P1/P2/P3 — implemented locally, enforcement remains BLOCK

01-11-2026. Base/main snapshot: `f1299e3138f3700062a1ed84271db315737b0071`. Worktree branch: `codex/preschool-main-technical-20261101`. No commit, push, merge or deployment.

## Authority and scope

Owner explicitly answered **“Duyệt P1/P2/P3, triển khai local”** to the scoped approval question for `F13_POLICY_PROPOSAL.md`. That approves the 265 bounded-debt projection, default BLOCK, and exactly seven control exceptions for local implementation. It grants no DB/user/business permission. Earlier proposal/candidate reports remain preserved at their original status; they do not supersede this later owner decision. No further approval of the same package was requested.

Only the three existing control files and one metadata file implement the change:

- `scripts/ci-run-education-architecture.mjs`
- `scripts/test-ci-education-architecture.mjs`
- `src/products/bella-education/__tests__/bella-education-architecture.test.ts`
- `.github/ci/education-architecture-dispositions.json` (new)

This is the independently authorized F13 control maintenance, using the existing direct workflow and scanner v2. No new analyzer/framework. Applicable Education architecture/control regression is exercised; runtime Auth/RLS/persistence proof is not inferred from it. No DB migration, academic/event/history/export change or frozen Kernel modification occurred. Healthcare/Logistics regression and application build are not applicable to these control-only edits.

## What is now active locally

| Disposition | Executed count | Meaning |
| --- | ---: | --- |
| KNOWN_DEBT_BOUNDED | **265 occurrences / 263 exact identities** | Frozen historical Product debt, not approval of access or new semantic review. |
| APPROVED_CONTRACT_PATH | **7 occurrences / 7 identities** | Exactly M004, M066, M067, M068, M069, M070, M071. Control exception only. |
| BLOCK | **90 occurrences / 85 exact signatures** | 70 other frozen API/UI occurrences plus all 20 unresolved expressions. |

Tuple identity remains exact file, enclosing caller, transport, schema marker, full resource and operation. Quotas count static source occurrences. They do not limit runtime query frequency or bulk records. Same/reduced debt is retained; expansion or substitution is blocked. Five SELECTs and one UPDATE in the approved Work Queue ports stay separate; the Care RPC exception does not approve M005's Attendance SQL in the same file.

Metadata is generated once from the owner-approved, sealed proposal, not from current-source discovery. The baseline file is unchanged at **265**. Its fingerprint is bound into metadata. Both gates now share one classifier:

- Exact comparison recognizes only valid known-debt/approved-path tuples within quota.
- Legacy comparison subtracts only a recognized exception occurrence within its quota. It never removes a whole prefix signature/file, or a debt occurrence.
- Raw observations are preserved: **342 literal legacy matches, 77 added / 33 signatures**, and **362 exact-resource candidates**. Effective legacy comparison is **335 occurrences**, leaving **70 added / 30 signatures** above the unchanged baseline.
- Missing/malformed metadata, wrong baseline fingerprint, wildcard/noncanonical paths, unresolved fields, invalid IDs/quota, overlapping identities and inconsistent exception IDs fail closed. Approved exception quota is exactly one per tuple. A mismatch between exception inventory and the legacy observation also BLOCKs.

Approval metadata records the owner's decision for traceability; a decision string alone is not cryptographic authority or a claim that repository protection is enforced everywhere. Actual configured debt/exception fingerprints are pinned in regression tests. No CODEOWNERS, hook, workflow, selector, required-check setting or permission was modified.

## Executed verification

| Check | Actual result | Evidence |
| --- | --- | --- |
| Scanner and policy regressions | **23 tests PASS** | `f13-approved-fixtures-final.log` |
| Architecture Jest | **1 suite FAIL; 8 PASS / 2 FAIL** | `f13-approved-jest-final.json` / `.log` |
| Focused TypeScript | **PASS; zero diagnostics** for Architecture Jest root and imported dependencies | `f13-approved-typecheck-final.json` / `.log` |
| Actual CI scanner | **exit 1 / BLOCK** | `f13-approved-ci-result.json` / `.log` |
| Metadata/proposal identity and disposition receipt | **PASS**: all seven recognized; all other 70 frozen IDs still blocked; 20 unresolved blocked | `f13-approved-control-receipt.json` |
| Diff/preservation | **PASS**; F10/F12, baseline, old WIP and prior sealed artifacts unchanged | `f13-approved-seal.json` |

Regressions exercise the real scanner and CLI: legitimate exact paths pass; sibling SQL, target/caller/schema/write substitution, extra occurrences, null/invalid fields, missing/corrupt metadata and legacy-ledger mismatch fail. They independently check the configured 263 debt identities and seven approved identities against the approved projection fingerprints. Jest uses the same evaluator rather than copied comparison logic; both failing assertions remain active.

Initial policy regression recorded **22 PASS / 1 FAIL**: malformed object-valued ID caused error-message formatting to throw. The validator now labels invalid IDs safely and reports configuration errors. Final **23/23 PASS** includes that negative case. The first failure remains in `f13-approved-fixtures.log`; no historical failure was replaced by a success claim.

The two Architecture FAILs are expected unresolved enforcement: the legacy gate still finds 70 added occurrences; the exact gate still finds 90, including 20 unresolved. They are not fixture failures and are not converted to PASS because parser/policy regressions pass.

## Separate source scans

All rows use the approved policy/code from the technical worktree; metadata was not installed into main or the old WIP checkout.

| Source evaluated read-only | Historical debt recognized | Exceptions recognized | Exact BLOCK | Effective legacy added | Outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| Clean pinned main snapshot | 265 | 7 | 90 | 70 / 30 signatures | BLOCK |
| Technical worktree | 265 | 7 | 90 | 70 / 30 signatures | BLOCK |
| Old WIP checkout | 260 | 7 | 67 | 47 / 26 signatures | BLOCK |

WIP reductions do not cancel new signatures, alter the 265 quota or replace the frozen 77/33 inventory. `f13-approved-scopes.json` records source/scanner hashes, all 77 main occurrence reconciliations, zero policy errors and identical WIP before/after fingerprints (including 28 untracked files). Reproducer: `node docs/audits/preschool-main-20261101/verify-f13-approved-scopes.mjs`. Its exit 0 means collection succeeded; the source decisions remain BLOCK.

The remaining known calls retain their prior dispositions: 26 direct Education SQL, 28 other Product API SQL, seven other workflow RPC, six Scheduling UI and three profile RPC; 20 unresolved expressions stay BLOCK. Any implementation correction belongs in a separate authorized workstream. Scanner v2's declared syntactic/dataflow/reflection limitations remain; policy metadata does not prove caller authorization, client schema hidden behind aliases, SQL inside RPCs or installed DB parity.

## Seal and stop

P1/P2/P3 is **IMPLEMENTED_LOCAL**. **F13 remains BLOCK — NOT MERGE-READY**, with seven approved control paths and 90 blocked occurrences. No new policy decision or blanket exception is inferred for those remaining calls.

F10/F12 remain **LOCAL PASS — SEALED**; source/evidence hashes checked, their 6 suites/76 tests not rerun. F09 remains **HELD — DESIGN ONLY**; F01/F02 and F03–F07 remain held; F08/F11 unchanged. No WIP port, Product/API/UI change, role/assignment/workflow change, env change, seed, DB probe/mutation, migration, build, commit, push, merge, deploy or Production action.

**Preschool NOT_READY. Real Auth/RLS, Browser E2E and Production NOT_PROVEN.**
