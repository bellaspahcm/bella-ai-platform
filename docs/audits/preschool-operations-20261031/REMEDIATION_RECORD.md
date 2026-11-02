# Preschool Operations Audit — Remediation Record

**Status:** `PARTIAL` — source-local mitigations and scoped checks only.

This record supplements [REPORT.md](REPORT.md). It does not alter the original audit evidence or claim that findings occurred in Production. UI layout was preserved. Behavior changed only for the explicitly scoped false-success, privacy, permission, seed-safety, integrity, and identity findings.

## Applied in the local working tree

| Finding | Local change | Current boundary |
| --- | --- | --- |
| F01 | Admission confirmation now returns `503 ADMISSION_CONFIRMATION_UNAVAILABLE`; it no longer fabricates tuition outcomes or performs a partial enrollment write. | The workflow remains unavailable until an approved atomic enrollment/fee contract exists. |
| F02 | Missing/unknown assessment values remain unknown; progress reads use the requested month. Observation and award POSTs return unavailable instead of synthetic success. | No canonical observation/award write or governed grading rule was added. |
| F03–F04 | Private communication thread/message routes fail closed under the existing “private chat unavailable” owner decision; My Class no longer appends fake local messages. | No private chat capability was enabled. |
| F06 | Added an additive local migration candidate that checks active Auth-backed Preschool admin authority and all-active-branch access at both the INSERT RLS policy and publication RPC. Same-payload request retries return the existing row; changed content for a reused request ID conflicts. | Candidate is uncommitted and unapplied. It has only source-level checks; effective grants, RLS composition, race behavior, and SQL execution are unproven. |
| F07 | Removed table-read fallback when the Finance branch RPC is missing. `ALL` reads compose individually authorized branch RPC responses; missing command data no longer returns synthetic success. | Does not prove the deployed RPC/catalog or live branch authorization. |
| F08 | The Scheduling sample-seed button now reports that it is held and performs no writes or deletes. | The wider page still contains sample tenant/staff identity and is not established as an operational scheduling flow. |
| F10 | Curriculum/menu updates and curriculum deletion require a returned row; zero-row mutations report not found. | No browser or live persistence proof. |
| F11 | My Class attendance, bulk attendance, handover, and message handlers no longer mutate local state as if saved/sent; they show an error toast that names the unavailable canonical flow. | UI still displays sample roster/conversation data; these actions remain unavailable. Browser E2E was not run. |
| F12 | Student 360 communication reads resolve the canonical Student 360 identity and include canonical Party-ID care rows while retaining the legacy Student-ID filter. | No real DB read-back was run. |

## Held for owner decision or stronger evidence

- **F05 — Curriculum/Nutrition/Learning permissions:** implementation remains held. The source shows privileged writes outside teacher assignment scope, but the approved author/read/approve/publish role matrix and the exact assignment relationship are not established. In particular, Attendance approval rules do not define curriculum or nutrition authority. A deny-all or admin-only policy would itself choose material Product semantics.
- **F09 — weekly-menu atomicity:** implementation remains held with F05. A transaction/RPC needs the approved author/approver boundary, omitted-day replacement rule, and published-menu recovery behavior. Sequential writes or compensating writes would not prove atomicity.
- **F13 — Architecture Guard:** no guard code was changed. This is a protection change requiring independent authority for its own scope and the owner-selected enforcement boundary.
- **F06 runtime enforcement:** the migration candidate does not update any database. Use an authorized, verified Non-Production target and real Auth identities to prove both allowed and denied paths, conflict/retry, and migration recovery before treating the DB boundary as effective.

## Verification evidence

- Targeted Jest: **8 suites / 41 tests PASS**, covering admission, grades, communication denial, canonical Student 360 identity, Finance branch behavior, announcement SQL source constraints, curriculum zero-row handling, and weekly-menu zero-row handling.
- Education TypeScript check: `node node_modules/typescript/bin/tsc -p tsconfig.education.json --noEmit --incremental false --pretty false` — **PASS**.
- `git diff --check` — **PASS**; Git emitted line-ending normalization warnings for two edited files.
- The first TypeScript check caught a removed `UntypedSupabaseClient` alias still used by unrelated Finance mapper helpers. The alias was restored and the final check passed.
- No full audit rerun, DB migration apply, real Auth/DB/RLS test, Browser E2E, Production access, or Go-Live check was performed.

### Verification refresh — 2026-11-01

- Rechecked on local branch `codex/preschool-main-hardening-20261101` at base SHA `f1299e3138f3700062a1ed84271db315737b0071`, the `main` revision bound by the source audit. All Preschool remediation changes remain uncommitted; no push or deployment was performed.
- Re-ran the eight scoped Jest suites listed above: **8 passed / 41 tests passed**. Re-ran the Education TypeScript check: **PASS**. Re-ran `git diff --check`: **PASS**.
- Source diff review found no JSX/layout edits in the affected Grades, My Class, or Scheduling pages. This is source-level evidence only; Browser visual/E2E behavior remains `NOT_PROVEN`.
- The unrelated pre-existing `.vercelignore` change was preserved and excluded from Preschool verification.
- No migration was applied and no database, Auth, RLS, Production, or user data was accessed or changed.

**Operational conclusion:** source behavior improved in the listed paths, but Preschool remains `BLOCKED` for unresolved P1 permission/atomicity paths and `NOT_PROVEN` for real Auth/DB/RLS, Browser E2E, and Production. The prior 2,032-test audit result and these targeted tests are not whole-Product operational certification.
