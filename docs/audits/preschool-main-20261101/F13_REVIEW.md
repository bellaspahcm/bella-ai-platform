# F13 — ownership review, control candidate remains BLOCK

Date: 01-11-2026. Pinned main: `f1299e3138f3700062a1ed84271db315737b0071`. Local branch: `codex/preschool-main-technical-20261101`. No commit or integration.

## Review of the frozen 77 occurrences

The original `f13-scan-final.json`, 77 occurrences and 33 normalized signatures are preserved. Every occurrence has an ID, exact resource, caller location, owner evidence and disposition in `F13_OCCURRENCES.md` / `f13-ownership-review.json`. The audit mapping is not imported by the guard and creates no allowlist.

| Classification | Occurrences | Source conclusion and disposition |
| --- | ---: | --- |
| EDUCATION_DIRECT_SQL | 26 | API SQL targeting Student (6), Course (5), Enrollment (10), Attendance history (1), Attendance projection (3), Assessment (1). These resources have Education owners/public adapters; direct API access bypasses that boundary. No applicable exception established in the reviewed authority. Keep BLOCK; do not rewrite these workflows under F13. |
| PRODUCT_API_SQL | 34 | Product-owned Care, Communication, Development, Safety and Preschool Finance tables. `edu_` alone is not evidence of Kernel ownership. This classification does not approve API layering, caller permission, RLS, persistence or business rules. No baseline exception granted. |
| PRODUCT_UI_REVIEW | 6 | Scheduling browser SQL: leave (2), substitutions (2), shift assignment (1), communication exception (1). Product ownership is established, but hardcoded actor/tenant and destructive-seed context remain F08 HELD. No handler changes or exception. |
| WORKFLOW_RPC | 8 | Announcements list/publish (2), Handover (1), Care save (1), Portal daily read (1), Portal announcement reads (2), Portal issuer context (1). Existing workflow contracts and named command/read adapters explain these calls. A public RPC is not automatically forbidden raw SQL, nor proof of safe implementation. F06 and other runtime gaps remain. |
| PROFILE_RPC_REVIEW | 3 | Student update (1) and Teacher profile read/update (2). Student update has a typed call but no definition found in tracked source outside tests/audit captures. Teacher DDL exists and crosses Party/users boundaries; corresponding independent contract authority was not established by this review. Keep unreviewed/NOT_PROVEN, not auto-approved. |
| Total | 77 | 66 table calls + 11 RPC calls; exactly the frozen inventory. |

Authority: Education Constitution sections II and IV/Law 3; `AUTHORIZATION_CONTRACT.md` ownership and Care/Portal/Enrollment/Announcements decisions; existing owning public contract implementations; Product schema migrations. The ACR-2026-021 roster amendment specifically routes Care through the public Attendance contract; it does not grant a general direct-API SQL exception. The Portal SQL artifact cited in the inventory is a source draft, not proof that its definition is installed on the live DB. This review neither approves new business rights nor asserts Production violations/exploitation.

## Confirmed scanner limitations and minimal change

Legacy signatures truncate table names to a prefix. Four signatures mix Education-owned and Product-owned resources in one file: G12 Development, G19 Confirm Admission, G23 Grades and G25 Portal Care. Approving a whole signature would also mask its Education calls. Replacing `edu_fin_invoices` with `edu_enrollments` at the same location/count produces the same legacy signature. A new executable regression demonstrates that blind spot; no green-enforcement claim is made.

The existing CI scanner now also exports a diagnostic AST inventory: full literal target, method, file, line/column, receiver and nonliteral expression. It sees multiline calls, distinguishes same-line calls, excludes comments/string examples and standard `Array.from`/`Buffer.from` conversion calls. It does not alter `scanViolations` rules, baseline comparison semantics or approvals. Its optional path anchors allow the same scanner to examine an isolated committed snapshot and another checkout without checkout/reset.

This is a syntactic inventory, not type-checked dataflow: aliases/computed access/imported constants and SQL inside RPCs are not resolved. On main/technical it reports 438 candidate calls including 20 nonliteral targets; these are outside the frozen literal-match review and are **not** 20 newly proven violations. All 77 frozen occurrences were reconciled to AST locations. No assertion of complete boundary enforcement follows.

## Executed verification

| Source examined by the same candidate scanner | Files | Raw database matches | Added occurrences / signatures | Explicit any | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Clean main snapshot at pinned SHA (`git archive`, no checkout) | 185 | 342 | 77 / 33 | 1 | BLOCK |
| Current technical worktree | 185 | 342 | 77 / 33 | 0 | BLOCK |
| Preserved old WIP checkout | 185 | 314 | 54 / 29 | 1 | BLOCK |

The WIP increase is 54 although total is baseline+49, because five occurrences decreased elsewhere. Reduced and added signatures do not cancel in policy. Do not replace main's frozen 77 with WIP counts. Internal-Kernel imports and cross-vertical imports are zero in these exercised scans; this does not resolve direct-SQL findings.

`f13-review-scopes.json` records source SHA, scanner hash, full results and identical WIP before/after fingerprints (tracked diff plus all 28 untracked files). Reproducer: `node docs/audits/preschool-main-20261101/verify-f13-scopes.mjs`. Its process exit 0 means evidence collection completed; the guard decisions inside remain BLOCK.

Fixture checks: **5 Node tests PASS**, plus existing same/new/reduced baseline assertions, recorded in `f13-review-fixtures.log`. Previous Jest **8 PASS / 1 FAIL** and previous CI **BLOCK** artifacts remain unchanged; the Jest suite was not rerun because its implementation was not changed this turn. F10/F12 tests and typecheck are reused only after file hash verification in their separate seal.

Fresh CI scanner invocation: **exit 1 / BLOCK**, recorded in `f13-review-ci.log` and `f13-review-ci-result.json`. This failure is retained; five passing fixture tests do not supersede it.

Both remote `origin` (`bellaspahcm/bella-spa-erp`) and `platform` (`bellaspahcm/bella-ai-platform`) returned the pinned SHA for `refs/heads/main` during this review. They are separate remotes; no push target was selected. The source snapshots are pinned evidence, not a continuing claim about live remote/Production state.

## Enforcement proposal — not applied

1. Retain BLOCK for the 26 direct Education SQL calls and the 9 unresolved/profile/UI calls. Correcting those Product workflows is a separate task, with their existing authority requirements.
2. Evaluate the 34 Product-owned API calls and 8 workflow RPC occurrences individually against the owning adapter/contract. Ownership is a prerequisite, not approval of all 42 paths. Record only exact approved caller + full resource/method and bounded count if the control owner approves an exception.
3. Extend the existing baseline/key comparison to distinguish full resources before accepting such exceptions; never approve the current mixed prefix signatures wholesale. The existing 265-occurrence debt remains historical, not newly certified. Any migration of those reviewed keys needs an exact no-expansion comparison, not regeneration from current source.
4. Prove added-count, target-substitution, unknown-target and mixed-ownership denials, as well as valid public adapter paths, in the existing scanner/Jest controls before integration. Do not use this audit JSON as a runtime allowlist.

**F13 remains BLOCK and not merge-ready.** No baseline, selector, hook, CI workflow, required check, role, grant, RLS, runtime flow or UI was changed during this review. The concrete missing decision is the control owner's bounded exception/enforcement disposition, not a request to waive the existing failures.
