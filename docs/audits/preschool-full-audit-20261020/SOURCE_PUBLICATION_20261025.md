# Preschool accepted-source publication — 2026-10-25

Owner explicitly directed publication of Preschool repairs already implemented and effective. This batch preserves the existing Non-Production candidate on `codex/preschool-release-20261023`, base `80e13ea92ee70742d26cd890a45aaa94d8fc7494`. It does not merge, deploy, execute SQL or change any running server.

## Exact retained scope

`SOURCE_PUBLICATION_PINS_20261025.json` binds 127 existing source/control/Registry SQL paths. All current raw byte hashes match their owning accepted epoch: 117 of the 119 original MVP paths remain unchanged; the two Enrollment-list paths were superseded by the independently accepted ten-path Registry delta. The Registry epoch contains one SQL artifact. Five original MVP paths are already unchanged in the base commit. No runtime source was edited for publication.

Original production-mode E2E MVP acceptance: 114 named checks, independent verification of 3,324 source/control paths, scoped security/recovery and fixture disposal. Registry overlay: 55 focused tests, 33 local Auth/Browser/readback checks and exact source recovery. These are separate historical epochs; this publication does not invent one combined Browser/E2E acceptance run. The original receipts and failed/held states remain authoritative within their recorded scope.

Current publication checks: 7 focused suites / 62 tests PASS, native exit 0; strict full TypeScript native exit 0. Original SQL/evidence bytes are preserved. No remote DB, fixture, Auth-account or Browser operation was performed in this publication batch.

## Scope and size justification

This exceeds 100 files because it preserves the approved dependency-coupled Preschool MVP across UI, API, Product services, Education public contracts and their existing tests, together with the reviewed Non-Production SQL/recovery artifacts, authority decisions and receipts. It is one Preschool source-retention scope. No new abstraction, guard, manifest baseline, role or permission is introduced. Historical ACR/ADR documents record prior authority; they do not reopen a Kernel window.

Excluded: T2 runtime/draft SQL and unaccepted T2 gate document; Healthcare/Laboratory work; loose universal announcement migration without its own publication binding; caches, environment files, credentials and unrelated worktrees. The three main-checkout mock-email/service-role Auth bypass changes are expressly excluded. The existing staged changes in the main checkout were not modified or reset.

## Integration and release boundary

This is the preserved older release branch, not an integration onto current main. Later canonical registry, report-truth, Student 360 read-only and G1 Guardian fixes remain on their published branches. They must be preserved in any separately reviewed integration; do not replace those newer paths with this older snapshot. No merge/deploy authority is inferred from a push.

Education/Healthcare aggregate and full Kernel reseal retain their recorded FAIL/HELD status; no aggregate rerun or status relabelling was performed. Production regression, full restore readiness and Go-Live are not established. `PRESCHOOL_GO_LIVE=NOT_READY`.

Publication-time guard, staged-diff and remote results are recorded separately below after execution.

## Publication pre-commit results

- Architecture pre-commit guard invoked explicitly against 186 staged files: native exit 0, no protected frozen-kernel file modified.
- Full staged `git diff --cached --check`: native exit 2. It reports existing trailing whitespace/mixed line endings in the exact Registry snapshot and trailing blank lines in retained authority documents. The raw accepted source and SQL bytes were deliberately retained. This check is not recorded as PASS; it is a formatting limitation of the preserved snapshot.
- Focused Jest: 7 suites / 62 tests PASS, native exit 0. Strict full TypeScript: native exit 0, no diagnostics.
- The index is restricted to the publication allowlist. All 127 accepted raw source pins and their indexed Git blobs are checked again before commit. This is source publication only; current Production and the running port3000/3016 servers are untouched.

The retained Authorization Contract update is included with the source: it records the Owner-approved Attendance, Enrollment v1 and common bulletin decisions already implemented. Its dated initial candidate-read hold is superseded only within the later explicit ACR-2026-021 amendments. No new permission or business decision was authored here. The AGENTS.md workflow delta remains outside this Product publication scope and is untouched.

Final index recheck: 187 staged files; all 127 source raw hashes and indexed blobs match; explicit Architecture Guard native exit 0. The checkout has no generated Husky wrapper, so automatic Git-hook execution is not claimed. No guard configuration was changed.
