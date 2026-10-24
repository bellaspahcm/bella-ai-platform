# Independent review — Batch2n

Three fresh reviewers received no conversation context: blind hunter (provided diff only), edge hunter (diff plus referenced source), and acceptance auditor (diff/SPEC/declared context). All were read-only. They did not run tests, databases or network calls and did not grant change authority. Initial input is preserved in `REVIEW_CODE.diff`; the original full diff and index are `REVIEW_ALL.diff` and `review-evidence-index.json`. Current code hashes and final-build binding are in `CURRENT_SOURCE_MANIFEST.json`.

## Deduplicated actionable findings

All were classified **patch**: implementation/failure-control defects resolvable from the existing explicit intent and approved matrix. No missing business decision was filled by a reviewer. Known Course/proxy gaps remain separately held.

| Finding | Correction | Verification |
|---|---|---|
| Same-scope refresh failure discarded last canonical roster | Preserve rows for transport/503; clear for explicit401/403 and scope changes | Current UI tests cover reload failure and revoked access; acceptance auditor confirmed source |
| Concurrent retry let Courses success erase Care failure | Separate courseError/rosterError; no cross-dependency clearing | Deferred Courses response test; both blind hunter and acceptance auditor confirmed correction |
| A pending save could close a newer/edited draft | Disable modal fieldsets during save; retain draft/error after denial | Pending-draft UI test; edge reviewer source confirmation |
| Individual and quick handlers could write concurrently | Both saving flags guard each handler and editor entry | Pending-save UI test tries competing editor; edge reviewer source confirmation |
| Empty date/class during pending load left loading true | Invalidated request cannot mutate state; empty scope explicitly resets loading | Source review; existing stale-request UI test retained |
| Production dotenv files escaped development-only source guard | Reject all four production-loaded dotenv paths before child build/runtime and after build | Four offline negative controls; actual final build starts with no such file |
| Anonymous HTTP request lacked a deadline after seeding |25-second AbortSignal | Source review; full Browser run remains held |
| Authenticated Care cache receipts were never asserted | Require at least one Care receipt and private/no-store on every receipt | Offline positive and missing-private/no-store/empty-Care negative controls |
| Receipt task could reject before deferred allSettled registration | Attach catch immediately, persist fixed failure code, fail header gate even with otherwise valid receipts | Offline collection-failure negative control; final edge reviewer source confirmation |

## Final reviewer outcomes

- Acceptance auditor: both original findings resolved; pending-save controls have matching regression coverage; no new actionable findings in reviewed corrections. Read-only source review, no rerun of tests.
- Blind hunter: original error-ordering finding addressed based on supplied correction and deferred retry test description. No independent post-fix project inspection or execution.
- Edge hunter: original six paths addressed by source inspection; collector follow-up addressed; final output `[]`. No test execution.

Lead-executed results: **88 focused tests/4 suites PASS**, **9 offline controller cases PASS**, **30 review-only proxy candidate cases PASS**, Education runtime typecheck zero diagnostics, lint zero errors/warnings, and a stable current Product production build native0. Source and native receipts are separate from reviewer opinions. None of these grants proxy/Kernel authority or proves browser persistence, full regression, production or Go-Live.
