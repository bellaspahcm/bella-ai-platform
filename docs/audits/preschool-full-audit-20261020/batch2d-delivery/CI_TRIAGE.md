# Current-head CI triage — 2026-10-21

## Why AutoMove runs on PR405

PR405 changes the shared Platform service `src/services/user-actions.ts`. The existing `.github/workflows/automove-rc-business-chain.yml:13` explicitly includes that path in its pull-request trigger. The current PR diff contains six identity source/test/migration paths and selected evidence; it contains no AutoMove source or workflow changes. This is a configured consumer regression check, not an expansion of the implementation scope.

Current Platform head: `9b4ec3c3f2f044ad2dae5ffc6d9693afdf626179`. Current Education head: `9dd287ce8b9d5128dc638fc554ccfb5d9a9d8e33`.

## Executed results

- PR405 Real Database Business E2E, run39497323470/job118887070422: SUCCESS, 25 suites /70 tests passed, one suite /one test skipped. The router selected the full configured Real DB suite because the migration paths have no narrower suite mapping. The two migrations were already recorded on the isolated E2E target and were skipped by the apply step; do not claim this attempt newly applied them. Migration Gates and the Quality Gates aggregate also succeeded. This does not prove all authenticated workflows or complete Preschool RBAC/RLS.
- PR405 Real Estate build: first attempt failed in the unchanged font loader; one retry succeeded. No layout, dependency or guard change was made.
- PR405 AutoMove RC, run39497323306/job118889330813: FAIL. Real browser authentication and the preceding selection flow succeeded, but booking creation returned HTTP500 where the test requires200. The actual error cause is NOT_PROVEN; the HTTP adapter collapses unclassified errors to a generic500. There is no evidence supporting a permission relaxation.
- PR406: all emitted current-head checks completed without failure. Its exact-head Vercel preview returned application401 for all four anonymous/forged Courses list/detail probes. This is preview evidence, not a production release.

## Bounded comparison and candidate retry

The existing AutoMove RC workflow was dispatched on current main `f973dd7e56542aa7847b98c2a4236da86f1eabc3`: run39499824002/job118894189360. It completed SUCCESS: one expected browser test, zero unexpected/flaky/skipped, reconciliation MATCHED, verified actor/document cleanup with immutable synthetic history retained. See `automove-main-summary.json` and the actual command log. The workflow uses the canonical isolated non-production target `bmnbqbcdbuklhopfbopv` and synthetic fixtures; productionMutation=NOT_PERFORMED.

The E2E database already has the containment migrations. A main-source run is therefore a source comparison on the current E2E catalog, not an untouched pre-migration baseline. A failure on main alone cannot classify the ACL changes as unrelated. Preserve the first failure and the actual comparison outcome; do not suppress the check or restore anonymous/client mutation privileges.

After the full Real DB job finished, one retry of only the failed AutoMove job was requested (native command exit0): run39497323306 attempt2/job118898010291 on the unchanged Platform head. It completed SUCCESS: one expected browser test, zero unexpected/flaky/skipped, reconciliation MATCHED and verified synthetic fixture cleanup. Artifact12302445785 and `automove-candidate-summary.json` identify the exact tested source. No Product, migration, layout, dependency or CI-control patch accompanied the retry. The earlier500 did not reproduce; its cause remains NOT_PROVEN. Do not label it pre-existing or an established timeout cause.

A READ ONLY catalog probe confirms authenticated users SELECT=true and UPDATE=false on the E2E target. `exec_sql(text)` is absent there; the migration intentionally returns if that maintenance helper does not exist. The first catalog diagnostic assumed existence and exited1 with42883; the corrected existence-aware query exited0, with both results preserved. The scoped booking/vehicle triggers mention neither users nor exec_sql, and the catalog scan found no function-text callers of exec_sql. This metadata narrows the investigation but does not prove a cause of the earlier HTTP500.

## Authority and remaining limits

At21:44:02Z and21:44:13Z, GitHub records `bellaspahcm` merging PR405 and PR406 respectively. The agent did not merge or initiate deployment. Merge commits are12a549bf74b16b3018176fb8cec3c3ee845834ae and30134055d1ff5b846584e57833816f076034cdea. Fresh fetched main30134055d retains all11 sealed source blobs; see `merged-main-source.json`. All emitted PR-head checks completed without failure before the owner merges. Post-merge main checks are new runs and remain separately pending.

The automatic production deployment for30134055d is `dpl_G4DUXNTkNq8sEk2q7p6FRDydhsom`, QUEUED and without the canonical production alias at21:46:58Z. The read-only verifier deliberately did not treat that queued deployment or preview401 as production success. Current production Courses closure is NOT_PROVEN; the last actual production observation was the old-source anonymous leak. No production mutation, deployment initiation, protection change or credentials were used by this verification.

The bounded identity/Courses delivery is verified and sealed. AutoMove runtime/schema/business-rule changes and CI selector/guard changes remain outside scope. Complete authenticated regression, RBAC/RLS contracts and Go-Live remain outstanding; no unsafe grant was restored.
