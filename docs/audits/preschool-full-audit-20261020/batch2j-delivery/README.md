# Preschool authorization matrix — source delivery

Owner approved the Product-local authorization matrix and implementation per group on2026-10-21; medication administration was separately retired. Canonical rule: docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md. This source delivery implements bounded request containment, not a complete Preschool RBAC/RLS or Go-Live certification.

## Resulting behavior

- Staff Copilot requires verified Auth, active matching profile/tenant and the existing approved role/action contract. Caller headers cannot supply privileges; executive actions retain the approved exact five roles.
- Medication POST always410 PRESCHOOL_MEDICATION_DISABLED before Auth/body/DB/service; history and the safety service remain unchanged.
- Care uses the session/RLS client, Platform user_org_unit_access, active course branch and current active Enrollment public contract. Every target is checked before any bulk mutation. UI-derived health writes503; nonhealth saves preserve existing health_checks. Missing teacher User→Party mapping and noncurrent school-day eligibility history return explicit503 rather than infer authority.
- Portal issuance requires verified active Preschool admin, then503 until complete scoped issuer composition is proven. Signing uses configured server secret precedence only; new generation TTL≤24h, correctly signed legacy expiry retained. Every token consumer checks current tenant/Parties/directed guardian relationship and current school-date bounds. Parent Copilot only accepts ask_copilot. Existing bearer-capability server adapter is not client-RLS proof or a retry after RLS denial.
- Announcements requires verified active Preschool admin and then503 before writes because server recipient/branch scope/idempotent lifecycle is not yet proven. Fake identities, demo defaults and global-thread publication are removed. Class broadcast remains unavailable in v1.

## Verification and provenance

Composed from five locally reviewed source commits (git cherry-pick -x) onto origin/main30134055d:88314bacf,4269492fb,7012ca82f,daf358e7a,65adcebab. source-composition.json verifies all21 committed Git blobs exactly equal the reviewed originals and only CRLF working representation differs where applicable. An initial raw-byte-only harness precondition stopped commands before tests; it was replaced only after committed-blob and CRLF-only equality were independently established. Those four precondition exits were not executed test failures.

Combined source at1fdd7edd1:286/286 tests in10 suites, zero skipped/pending; native Jest, lint, scoped Education TypeScript and secret scan exit0. Raw command/result JSON is included. Earlier per-group actual local Next16.3.8 probes: Care4/4, Portal8/8, Announcements2/2 expected401/effective no-store. Copilot and Medication each4/4 correct denial/status with effective no-store assessment; raw exact-header harness FAIL remains preserved because development runtime rewrites header spelling. All local listeners stopped. No real Auth/DB/model operations used for these source checks.

Each group completed three independent source reviewer roles. Initial usage-limit failures for three groups are historical; fresh resumed sessions completed and found no actionable introduced defect. No source runtime changes after review; tests are source/mock proof only. Source manifests, review receipts and group evidence are included. Original full audit, raw logs and prior production evidence remain preserved in the original task workspace.

Actual pre-commit guard ran for original Copilot21, Medication15, Care17 and Announcements15-file local commits. Portal initially lacked the ignored configured Husky shim, so its first commit hook was NOT_RUN; normal prepare installed existing runtime, and unchanged filename-only guard separately checked the exact23-file path set with isolated index, native0, real index/HEAD unchanged. This is not retrospective pre-commit proof. No tracked guard/policy/baseline/config value was changed. No Platform/Kernel/schema/migration/ACL/RLS changes in this delivery.

## Remaining gates

Applicable broad local Education/Healthcare commands were run with explicit offline DB in batch2e: actual DB-dependent conformance/Kernel failures remain FAIL/ENVIRONMENT and later chained gates NOT_RUN. They are not waived by focused tests or source review. CI for the combined branch is a separate gate. Real authenticated allowed/denied workflows, full branch isolation/RLS, transaction/TOCTOU, Browser E2E and production source rollout remain NOT_PROVEN. Existing historical payload defaults and unrelated audit findings remain open.

PRODUCTION_CHANGE=NOT_RUN for this source batch; earlier approved ACL batches separately passed. ANONYMOUS_CONTAINMENT=PASS only for the previously tested32 direct relations/RPC/Courses production scope, not every API. AUTHENTICATED_ACCESS_REGRESSION=NOT_PROVEN. BATCH2B_RBAC_RLS=IN_PROGRESS. PRESCHOOL_GO_LIVE=NOT_READY. No merge, production deployment or DB mutation is performed by source push/draft review.

Delivery remains draft until its independent applicable CI/release gates pass. Intentionally held Care/Portal/Announcements paths must not be reopened with anonymous grants, fabricated identity or service-role fallback to satisfy UI. Preserve the Care physical dependency directory while sibling worktree junctions still refer to it.
