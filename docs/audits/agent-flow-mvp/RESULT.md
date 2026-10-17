# Bounded Agent Flow MVP — HELD

Entry point: [agent-flow-mvp-evidence.json](agent-flow-mvp-evidence.json).

## Actual implementation

The new sequential driver uses existing AppServer, repository authority, lifecycle contract, DevelopmentStore and native history. Intake pins repository/HEAD/scope/acceptance/budget. Each role gets a fresh thread. Builder owns task files; Verify runs one exact Node test command; Reviewer reads actual diff, current files and Verify output. One REVISE is allowed; uncertainty, source drift, another rejection or expiry is terminal HELD. A durable task-ID claim prevents implicit re-dispatch. There is no resume command.

The first new task repaired a reproduced evidence defect: `verifyRedGreen([RED, GREEN, RED])` accepted stale GREEN. The native Builder changed only `task-workflow.mjs` and its tests. Final GREEN must now be the last complete passing entry, following RED. This change is in the draft diff; it is not an accepted pipeline handoff.

## Executed proof

| Role | Native outcome | Commands | Live facts | History matches |
| --- | --- | ---: | ---: | ---: |
| Lead | ACCEPT | 1 | 9 | 4 |
| Builder | DONE, one native fileChange covering two task files | 3 | 17 | 8 |
| Verify | PASS, 6/6 actual tests, no skips | 1 | 9 | 4 |
| Reviewer | HELD | 5 | 17 | 8 |

Task `fbafbb1d-2a9d-4d0b-9bad-64a467dfae2f` ended HELD. No retry, resume, replacement task or revision was dispatched. The independent Reviewer stated the source/tests met acceptance, but stopped when its extra `Get-FileHash` command was denied. Separately, the adapter's strict read matcher rejected the native display's doubled Windows backslashes. No permissions were widened.

Fresh-process diagnostics queried all four native histories and stores: 52 live facts / 24 matches. The immutable intake manifest plus unchanged task-file bytes reconstruct the original candidate fingerprint exactly. This diagnostic is **not** a four-role PASS handoff. The current driver includes post-HELD fixes, so current-checkout freshness is not claimed for the old candidate.

## Fixes and verification after HELD

Portable forward-slash literal paths preserve exact read matching; collector/readback owns artifact hashing; Reviewer must not run `Get-FileHash`; nonzero Reviewer commands stop the flow. The terminal writer now stores direct records, while the reader also accepts the immutable first-run envelope without upgrading HELD. The original reader error `CANDIDATE_CHANGED` was caused by decoding that envelope incorrectly.

- Scoped Jest wrapper: 1/1 suite and 1/1 wrapper test PASS; actual Node suites **73/73 PASS**, zero skips/cancelled/todo/failures.
- New role-driver tests: **18/18 PASS**, including one-revision sequencing, second rejection, uncertain dispatch, stale identity/candidate, budget and Windows path/envelope regressions. These are fixture tests; the real revision loop remains NOT_PROVEN.
- Node syntax checks, wrapper ESLint and diff whitespace checks PASS. Existing ESLint ignore-format warning remains.
- Independent tooling review found exact-read, deadline and repository-identity gaps; focused recheck found no unresolved blocker. Post-HELD fixes are source-reviewed and unit-tested, **not runtime-proven**.

## Stop / authority

`BELLA_AGENT_FLOW_MVP = NOT_PROVEN`; task state = `HELD`. Owner's instruction explicitly prohibits automatic resume/retry after a stopped/uncertain runtime. The next decision is authorization for one **new** bounded task to validate the corrected adapter; the old task ID remains consumed. No broader sandbox/network permission is required or requested.

This adapter currently admits at most four existing development-tooling files under `scripts/agent-flow/`, protecting the running collector/driver/store/authority. It is not yet a general Product-task runner or host command firewall. Fingerprints observe tracked/non-ignored source; sandbox and scope observations are separate evidence.

No Product, UI, DB/Auth/RLS, migration, endpoint, frozen kernel, CI workflow, merge or deployment changed. Parent RLS remains FAIL, Course authorization BLOCKED, UI→DB NOT_PROVEN and Preschool Pre-Go-Live BLOCKED. All existing Product PRs remain untouched.
