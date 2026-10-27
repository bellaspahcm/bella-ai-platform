# Pending-inclusive Preschool registry — bounded local result

`PASS_BOUNDED_LOCAL_REGISTRY`, 2026-10-24. Authority: direct Owner approval of the registry/Non-Production unlock in [ROSTER_CONNECTION.md](ROSTER_CONNECTION.md). No Production or Git publication authority is inferred.

The old Production-backed reader returned `students:[]` because required branch configuration was absent. Further legacy Enrollment-assignment/intake dependencies meant a branch alone was insufficient. The new reader consumes one Education public capability, checks explicit canonical branch authorization and returns minimal active/pending identity, class and authorized totals. Daily Attendance roster semantics and Enrollment POST stay unchanged. No shared Student/Party/Enrollment ACL/RLS expansion or business-row repair was performed.

| Gate | Actual result |
| --- | --- |
| Focused contract/API/UI/active-roster tests | 4 suites, 55 passed, zero failed/skipped; native0 |
| Focused architecture | 3 suites, 7 passed; native0 |
| TypeScript / scoped ESLint | native0 / native0 |
| Rehearsal | Exact ACL/function rollback |
| Final local run | `de69e91d-006a-4c76-b9df-46c51428444b`, 33 runtime checks, native0 |
| Real Auth/RPC/HTTP | 187 synthetic children, 157 active, 30 pending; 187-unique pagination; literal search |
| Denial | Wrong role/tenant/branch, inactive/unbound identity, anonymous RPC, direct mapping update and HTTP tenant override |
| Actual Browser | Pending filter/page/search, active links, reset and reload; same fixture epoch, development mode |
| Independent DB readback | Counts and full synthetic Student/Party/Enrollment row fingerprints unchanged |
| Fixture disposal | Synthetic tenants/Students/Enrollments/Auth residuals all0 |
| DB recovery/retention | Exact original ACL/function snapshot restored; identical reviewed candidate reapplied; shared security fingerprint unchanged |
| Source epoch | Ten current Git blobs match pre-runtime review patch, SQL matches reviewed SHA; unchanged before Browser acknowledgement and after retention |
| Isolated source recovery | Original two files restored, additions absent, pinned archive reapplied: ten raw byte hashes identical |
| Independent review | Blind/edge source review clear; acceptance `PASS_BOUNDED_LOCAL_REGISTRY` |

Evidence is retained under `.audit-local-cache/preschool-release-integration-20261023/registry-20261024/`: `LOCAL_ACCEPTANCE_de69e91d-006a-4c76-b9df-46c51428444b.json`, `BROWSER_RESULT.json`, `registry-browser-all.png`, `UNIT_FINAL_RESULT.json`, `ARCHITECTURE_RESULT.json`, `EPOCH_BINDING.json`, `SOURCE_RECOVERY_RESULT.json`, `SQL_REVIEW_GATE.json`. Only the approved read function and scoped Product mapping caller-write containment remain on local C. Owned port3006 test server stopped. Source remains uncommitted in `D:\Antigravity\Projects\BELLA_PRESCHOOL_RELEASE_20261023`.

## Preserved failures

- `48c726c6-8a22-437b-b010-d6cc87d3d88d`: control stdin ended while awaiting test input; shell returned0 without completed acceptance. No Auth/business fixture was seeded. Recovery `91c1a836-a6a7-4555-accc-4d8476e6ef39` proved exact original ACL/function restoration. Interrupted epoch is not PASS.
- `58939e33-3fed-46c6-a73e-ec1d81186e54` and `8359707d-64bb-4532-b911-b007b11fc2b7`: harness expected missing-mapping HTTP400; actual PostgREST result was HTTP500/SQLSTATE55000. Dependency failed closed. Both retained failure and exact recovery with zero fixture residuals. First outer shell masked driver failure as exit0; its receipt records nativeExit1. Second outer shell returned1. Final probe expects observed exact HTTP500/55000; Product/security code was unchanged.
- Isolated recovery tooling first failed on Windows long paths, then mixed line endings when treating a Git text patch as a byte archive (both native1). Final recovery uses per-command long-path support, independently checks patch content, and restores raw archive bytes. No active source reset or global Git configuration change occurred.

## Deployment boundary

The 187 exercised records are synthetic local fixtures. The real Production aggregate was last verified read-only; no fresh Production login/Browser acceptance or mutation was performed. The user's port3000 page still runs the older checkout/backend reader and is **not restored by this local result**.

Production needs separately authorized protected backup/restore and exact target SQL/source package, including AD-CS01 and eight Course mappings. Do not use the rollback-default local SQL as a Production migration. Earlier E2E acceptance remains its earlier source/schema epoch. New production-mode build and remote regression are NOT_RUN/NOT_PROVEN. Prior Education/Healthcare aggregate and full Kernel reseal remain FAIL/HELD under recorded release applicability. No guard/baseline/freeze manifest changed.

`REGISTRY_NONPRODUCTION=PASS_BOUNDED_LOCAL`; `PRODUCTION_CHANGE=NOT_RUN`; `AUTHENTICATED_PRODUCTION_REGRESSION=NOT_PROVEN`; `PRESCHOOL_GO_LIVE=NOT_READY`; `COMMIT_PUSH_MERGE_DEPLOY=NOT_RUN`.
