# Post-push revision report — 2026-10-27

## Snapshot and method

This report reconciles the audit packet against the pushed source snapshot e39ef131b0613b7fd7b25106ae498a2c5a2b111f on branch codex/audit-risk-20261027. At report generation, the remote topic branch matched that SHA and origin/main was b9eecac44155e7867b9732247ffe409c89bc8175.

This is a revision and evidence-provenance reconciliation. It does not rerun database probes, CI, build, or Healthcare tests. Results below retain the status and source revision recorded in each evidence artifact.

## Evidence provenance and status

| Evidence group | Recorded result | Source revision | Qualification |
| --- | --- | --- | --- |
| API and tenant containment | CONFIRMED / CONTAINED for tested anonymous and tenant-scoped API paths | a69bab6c3244d34723b5600b646f48d0e48400ee in catalog and containment execution records | Five history tables and six RPCs were in scope. Saved post-containment review records eight read-only catalog queries passing and the applied migration hash matching the packet. This is not a system-wide database certification. |
| Auto production UPDATE path | NOT_PROVEN | Route source: bb7007e7632c3bf7d88f760fc8239a0720d2d327; runtime/catalog observations: a69bab6c3244d34723b5600b646f48d0e48400ee | No successful production UPDATE role was observed. No parent ACL/RLS widening is recorded. |
| H9 consumer | SERVICE_ROLE_OBSERVED; constructor NOT_PROVEN | Runtime/catalog observations: a69bab6c3244d34723b5600b646f48d0e48400ee | The packet records role activity but does not prove the repository construction path. |
| Healthcare verification | BLOCKED_BY_TEST_ENVIRONMENT | Verification execution source: a69bab6c3244d34723b5600b646f48d0e48400ee | Architecture 9/9 and conformance 7/7 passed. Overall Healthcare run recorded 18 failed suites and 151 failed tests after ENOTFOUND mock.supabase.co; this is not Healthcare PASS. |
| PostgreSQL credential and exec_sql | Rotation recorded as successful; executor EXECUTE revoked; BYPASSRLS retained | Credential source finding: 39d70165aec43927228a639fbdcc461c470b356d; follow-up evidence stored in this packet | Packet records Management API reset HTTP 200 and a read-only TLS/hostname-verified connection PASS. Three workflow consumers are listed. No runs of those workflows after the recorded secret update were found. The public GitHub secret identifier is metadata, not a secret value; the misleading evidence field was renamed and the credential field redacted. Historical source attribution for the exact exposed credential remains NOT_PROVEN; history was not rewritten. |
| Executor migration rehearsal | BLOCKED / NOT_PROVEN; Production BYPASSRLS retained | Bella source replay: a69bab6c3244d34723b5600b646f48d0e48400ee | Clean replay stopped at migration 20260515010000_the_great_purge.sql, SQLSTATE 42703, missing bookings.package_name. This does not prove a safe NOBYPASSRLS alternative. |
| Dependency candidate | Selected CI gates PASS; scoped local regression 20 suites / 256 tests passed | Candidate and GitHub CI head: dd0aa0fd000937ac2762fecc53ed17fedf3f118f | Quality Gates and Type Check succeeded at that SHA. Unit/Integration, Real DB E2E, and Migration Gates were skipped; release remained NOT_DEPLOYED. PR #445/#446 changes are already represented by main and are not in this branch's diff against main. |
| Original aggregate audit claim | NOT_PROVEN | Run revision/selector/environment binding absent in packet | The reported aggregate percentage is retained as an unverified source claim, not promoted to a current pass. |

## Git and package checks

The pushed source snapshot contained 209 paths relative to main: 204 audit/evidence files, four BDGF helper/document updates, and the authorized containment migration. Dependency lockfiles have no diff against origin/main.

The topic branch includes the merge-sync commit 5af67370b and audit/security commit e39ef131b. Remote and local topic refs matched after push; origin/main is an ancestor; the worktree was clean.

The staged package scan covered 209 files: all 79 JSON files parsed, targeted credential-pattern checks found no findings, and scripts/check-secret-leaks.mjs scripts/bdgf .github/workflows passed. The pre-commit Architecture Guard checked 209 files and found no frozen-kernel changes. git diff --check reported whitespace only in captured raw command-output logs; those logs were preserved as evidence.

## Current conclusion

- P0 API/tenant containment: CONFIRMED / CONTAINED within tested surfaces.
- Auto production UPDATE role: NOT_PROVEN.
- Healthcare: BLOCKED_BY_TEST_ENVIRONMENT.
- Executor redesign and NOBYPASSRLS rehearsal: NOT_PROVEN; current Production privilege retained.
- Production deployment: NOT_DEPLOYED.
- Enterprise / Go-Live: NOT_PROVEN.

No Production mutation or deployment was performed during this Git packaging and reporting task.
