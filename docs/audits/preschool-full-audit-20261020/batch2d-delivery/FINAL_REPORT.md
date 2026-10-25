# Existing security delivery continuation — 2026-10-21

Status: scoped delivery verification completed. The owner merged both PRs; production rollout and new-main CI are separate pending gates. The agent performed no merge or production release.

## Delivery repaired

Ordinary main ancestry merges removed14 already squash-merged paths from each PR diff while preserving each exact source tree and every sealed source blob. The configured Architecture Guard hook executed; both branches were pushed normally and checked against the remote head. No force push, source patch, CI-control edit or ACL relaxation was used.

- Shared identity: [PR405](https://github.com/bellaspahcm/bella-ai-platform/pull/405), head `9b4ec3c3f2f044ad2dae5ffc6d9693afdf626179`,32 scoped files including six source/test/migration files.
- Courses: [PR406](https://github.com/bellaspahcm/bella-ai-platform/pull/406), head `9dd287ce8b9d5128dc638fc554ccfb5d9a9d8e33`,22 scoped files including five API/test files.

The owner-created ready PRs were reused and attached to the chat; no duplicate PR or draft-state change was made. Original dirty audit work and clean managed delivery worktrees are preserved.

## Actual verification

- PR406 current-head checks completed without failure. Real DB/Migration skips for its source-only scope are not database proof. Its exact-head Vercel preview returned application401 for all four plain-anonymous/forged tenant or mock-context Courses list/detail requests, without classroom data. Preview protection used the existing automation access in memory; protection configuration did not change.
- PR405 Quality/Migration gates succeeded. Real DB ran25 suites /70 tests successfully, with one suite /one test skipped; the two migrations were already recorded on the isolated E2E database. Actual passing suites include Preschool chain and AutoMove phase5. Complete authenticated RBAC/RLS is still NOT_PROVEN.
- PR405's unchanged font-loader build failed once, then succeeded on one retry. No common layout or dependency change was made.
- PR405 AutoMove Browser E2E first attempt failed at booking HTTP500. Its existing trigger explicitly includes the changed shared `user-actions.ts`; the PR has no AutoMove source delta. One unchanged-head retry PASSED: one expected browser test, zero unexpected/flaky/skipped, reconciliation MATCHED and verified synthetic fixture cleanup. No source or ACL patch accompanied the retry. The earlier500 did not reproduce; its cause remains NOT_PROVEN.
- Main-source comparison on the current E2E catalog succeeded: one expected browser test, no unexpected/flaky/skipped tests, real Auth/booking/allocation/deposit/handover/recognition/payment/reconciliation and tenant/state denials, with verified synthetic fixture cleanup and immutable history retained. This proves the chain can run on the current E2E catalog; it is not an untouched pre-migration baseline or an explanation of the failed PR attempt.

Native logs, attempt failures, exact heads, preview probes and comparison summaries are retained in this folder. No production business-row contents or secrets were added to evidence.

## Owner merge and observed rollout

GitHub records `bellaspahcm` merging405 at21:44:02Z and406 at21:44:13Z. Merge commits are `12a549bf74b16b3018176fb8cec3c3ee845834ae` and `30134055d1ff5b846584e57833816f076034cdea`. Fresh fetched main30134055d preserves all11 sealed source blobs; both delivery worktrees remain clean. All emitted PR-head checks had completed without failure. The new-main checks are separate runs and remain pending, not proven green by the PR results.

At21:46:58Z, Vercel production deployment `dpl_G4DUXNTkNq8sEk2q7p6FRDydhsom` for exact main30134055d is QUEUED with no canonical alias assigned. The read-only verifier did not issue production closure probes against an unproven deployment. No deployment was initiated or configuration changed by the agent. A queued deployment is not production verification.

## Required status separation

| Status | Result and applicability |
| --- | --- |
| PRODUCTION_CHANGE | NOT_RUN in this continuation. Prior bounded production ACL changes retain their independently verified PASS in Batch2A/2B/2C. |
| ANONYMOUS_CONTAINMENT | NOT_PROVEN after the owner merge while production deployment is QUEUED. Last actual production Courses observation was FAIL on old source. Direct approved DB/RPC containment PASS; repaired source/preview and merge are not production HTTP proof. |
| AUTHENTICATED_ACCESS_REGRESSION | NOT_PROVEN for all affected shared-identity/Preschool workflows. The scoped Real DB and main-source AutoMove evidence above do not complete this gate. |
| BATCH2B_RBAC_RLS | IN_PROGRESS. Management delegation/role/branch contracts and complete authenticated matrix remain outstanding. |
| PRESCHOOL_GO_LIVE | NOT_READY. |

The new source is not proven active on the canonical production alias. Shared create/delete holds and intentionally degraded direct identity writers remain documented; no anonymous access was restored to compensate. Additional Product/control changes and complete authenticated RBAC/RLS retain their separate authority and gates.
