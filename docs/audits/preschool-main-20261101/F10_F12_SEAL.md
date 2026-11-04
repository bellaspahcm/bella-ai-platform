# F10 / F12 — separate local seal

Base/main SHA: `f1299e3138f3700062a1ed84271db315737b0071`.
Branch: `codex/preschool-main-technical-20261101`. Status: **LOCAL PASS**, uncommitted; no main integration or release action.

- Exactly ten F10/F12 source/test files are hash-identical to the files covered by the previous **6 suites / 76 tests PASS**. The prior Jest JSON/log hashes also match. No regression rerun was needed for unchanged source.
- Education typecheck **PASS / exit 0** is reused from the previous observed execution and recorded work log; its empty compiler-output file alone is not proof of the exit status. No TypeScript source changed this turn.
- Fresh `git diff --check` passed. The isolated diff is `f10-f12-changes.patch`; source/evidence hashes and explicit applicability limits are in `f10-f12-seal.json`. This seal excludes the guard candidate and the event generic-type cleanup.
- F10 retains existing success messages/bodies and the existing HTTP 400 failure envelope while checking for an affected row. F12 uses existing Registry identity for Care reads without making Communications depend on Attendance history. No UI, business rule, role or persistence model changes.

Real DB mutation/read-back, caller JWT/RLS, actual Care data, Browser E2E and Production remain **NOT_PROVEN**. No commit, push, merge, deploy, DB mutation or port of the old WIP occurred. Local source/contract proof does not certify Preschool or Go-Live.
