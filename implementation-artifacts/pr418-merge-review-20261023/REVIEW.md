# PR 418 merge review — 2026-10-23

Scope: user-authorized review, related repairs, push and merge of PR 418. No Production operation. Existing packets and untracked diagnostic history are preserved.

Review base: main `3d91a8f95a8b497ab952ef66587ff4596da24811`; reviewed candidate `6a6d52be54960daacbed0dde8a9a3d6c5c6c8080` plus this repair diff. Final CI must bind the resulting commit; prior SHA checks are not final proof.

## Findings and repairs

- Finance rejected intent: allow correction only after a typed, acknowledged transaction rejection and successful authorized same-key recovery returning null. Preserve the operation key; transport, permission, DB and canonical conflict errors remain immutable. Independent narrow re-review: no actionable findings.
- Restore branch debt overview and its debts-tab navigation. Keep tenant-wide completion unavailable in branch Finance.
- Semgrep execution failure on three changed pages: use JSX entities for literal ampersands; rendered wording is unchanged. No scanner, suppression or ruleset changes.
- Affected-test selection: directly changed P71/P72/canonical-identity/event-recovery suites require controlled local DB setup. Keep their target guards and existing related-test exclusions; exclude these exact suites from the non-DB direct selector. This does NOT prove P71/P72/event-recovery execution in CI. The configured real-DB Preschool chain suite remains selected and gains regression cases for this repair.
- Product SQL: expired debt requires positive outstanding and a non-settled status, including the post-lock recheck. Admission/assignment/pickup authority reuses existing Platform Auth deleted/banned conditions. Exact five-function forward migration approved by human reply: "Duyệt đúng migration và kiểm thử E2E này". SHA256 `b87ba9fbac8ac2f00cc57a8915eda730378f15146b0f9a16b19f8d4b055769f4`. No table, ACL, policy, default, Kernel or historical migration changes. Independent SQL source review PASS; DB verification pending final CI.
- Dismissed: tenant/context bearer loss. The existing Supabase server getUser wrapper propagates request Authorization into the shared client.
- Dismissed: English Center legacy RPC execution regression. Its observed caller uses recordAttendance, not setDailyAttendance.

## Executed local verification

- Targeted Jest: 3 suites, 68 tests PASS, no skips.
- Non-DB selector tests: 6 PASS, no skips.
- Full TypeScript `npx tsc --noEmit --incremental false`: exit 0.
- Changed-file ESLint and diff whitespace checks: exit 0.
- Migration safety: rerun on staged forward migration before publication.

## Outstanding evidence

Final-source Real DB, required remote checks, security scan and preview results remain pending. No merge or Go-Live claim is established by this document. Preserve prior FAIL/SKIP results. Remote CI applies the approved forward migration only to the isolated E2E project through the serialized existing workflow; do not run a concurrent manual DB apply.

Rollback: revert UI/API source if necessary. Preserve canonical enrollment, event and payment history. Forward SQL only replaces existing Product functions; do not restore unsafe authority or overdue behavior to make a gate green. Any emergency DB rollback requires explicit owner review. No Production migration/deployment authorized.
