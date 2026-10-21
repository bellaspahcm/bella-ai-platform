# Approved Care catalog/header remediation — Batch2o

Implementation and focused review complete. The main scoped Browser run PASS is retained; the supplemental run has26 functional checks PASS but native FAIL from a cleanup timeout, followed by exact recovery and independent poststate PASS. Global regression/reseal/merge/Go-Live remain independent. Branch `codex/preschool-care-rls-prerequisites-20261021`, HEAD baseline `6b031511fd37e5ee22288676b833cf855d40b43f`; local changes uncommitted/unpushed. Target E2E only `bmnbqbcdbuklhopfbopv`. Production `lvnvkpyxtuilhrabtlwv` not accessed or changed.

## Authority and implementation

Owner directly replied “Duyệt cả hai gói đúng phạm vi đề xuất” to the exact two proposals. `AUTHORITY.json` binds that reply and proposal hashes; `ADR.md` records the owning decision. `SCOPED_UNLOCK.json` is a manual exact-artifact exception for only the two new Education public-contract files; existing Education directory stays FROZEN. No Education machine manifest existed in inspected controls. No guard/protection/baseline change or invented automated unlock.

The new canonical catalog contract reads only `id/tenant_id/course_code/title/status` from `edu_courses` using a required caller-supplied client, explicit tenant and exact result count. Invalid/duplicate/foreign/status/truncated/error results fail closed; a valid empty list stays empty. Product `/api/education/care/classes` reuses actual Care Auth context, intersects active courses with exactly one Course→branch binding, active branch and actor's current Platform access, and preserves the unproven teacher mapping hold. Only Care's selector switches to this API. Shared legacy Courses API/Training tables/teacher assignment are untouched.

Proxy private/no-store applies only to exact `/api/education/care/bulk` and `/api/education/care/classes`, including Supabase cookie set/remove. Neighboring/public/webhook behavior is unchanged. Existing batch2n truthful-save UI, disabled health write, removed medication/fake data and failure/draft controls remain intact.

No DB relation/schema/ACL/policy/helper/role/membership/default privilege or production change. No migration history replay, service-role runtime, forged JWT or mocked browser success. Maintenance authority only creates/changes/cleans exact synthetic fixtures and performs independent readback.

## Focused executed verification

| Check | Actual result/evidence |
|---|---|
| Focused UI/helper/old Care API/canonical service/new catalog API/contract |140 tests/6 suites PASS, native0; `focused-tests.json`, `focused-tests-exit.json` |
| Education scoped runtime typecheck | zero diagnostics, native0; `typecheck.log`, `typecheck-exit.json`. Config excludes tests; not full-repository/test-source typecheck |
| Lint changed runtime/new tests | zero errors/warnings, native0; `lint.json`, `lint-exit.json`. Existing ESLint configuration warning is separate |
| Actual applied proxy versus preimage |42 simulated unit cases PASS, native0; `proxy-applied-tests.json`. No network; runtime proof is separate |
| Verification-controller negative controls |11 offline cases PASS, native0; `browser-controller-guards.json`. Reject production dotenv, missing endpoint/flags, receipt failure and malformed literal header |
| Healthcare architecture guard | zero violations, native0; `healthcare-guard.log`, `healthcare-guard-exit.json` |
| Three independent source reviews | complete; two harness defects patched, no runtime defect found; `REVIEW_RESULTS.md` |

## Real Auth and local production Browser

`browser-results-2026-10-21T04-09-14-018Z.json`: actual production build native0 (`next build --webpack`, BUILD_ID `qAvlysE_xdKbWOIEV6bda`), then native1 from the incorrect inactive-tenant expected code. 17 prior catalog/header/fixture checks passed. Actual auth correctly denied; no runtime repair was required. Cleanup failures0, owned rows/Auth/profile all0, two terminated immutable audit shells, exact catalog unchanged. Failure and executed controller snapshot remain immutable. The first failure's specific actual HTTP receipt was not retained by that controller; later controllers retain receipts on failure.

`browser-results-2026-10-21T04-14-20-695Z.json`: **PASS_SCOPED_BROWSER, native0**,24 checks PASS. Verified reuse of the same source/product hashes and BUILD_ID. Real provider sessions for6 actors in2 tenants; admin-only class scope; anonymous401, accountant403, admin_staff503 hold; foreign/duplicate tenant and branch selectors denied; inactive branch excluded; same-session profile inactive/role changed/tenant suspended rejected. All literal private/no-store checks passed.

Actual Chromium form login, class selection and active-only roster passed. Quick save and individual edit both returned actual POST200, independently read matching data from DB and persisted after reload. No health field was sent; health storage unchanged. Revoking the active branch caused actual POST403, editor stayed open and independent DB state was unchanged. Eleven observed browser Care responses (both endpoints, including403) had exactly `private, no-store`. No success request was routed/mocked. Cleanup0, all owned row/Auth/profile residues0 and listener closed; catalog fingerprint unchanged.

Final expanded run `browser-results-2026-10-21T04-17-34-437Z.json` additionally verifies actual profile tenant reassignment in the same provider session: old tenant selector403, exact context restoration200. All26 functional checks passed, including all6 Browser checks again. Raw final aggregate remains **FAIL/native1**, because one synthetic inactive public profile deletion timed out57014 and residual readback found1 profile. Auth and business fixture data were already0. `profile-recovery.json` / `profile-recovery-exit.json` record **PASS/native0** after verifying exact fixture IDs, terminated tenant, inactive profile, absent Auth and unchanged catalog, then deleting exactly that1 profile with the same30s/5s timeouts. No raw failure was overwritten or converted to a clean-run PASS. `poststate.json` / `poststate-exit.json` independently verify all3 runs: every owned business/Auth/profile count0,6 immutable tenant shells terminated, all332 prior frozen source files unchanged, catalog hash unchanged, and12 direct ACL requests PASS (six anon401/42501, six service-role LIMIT0 reads200). No business row contents were exported. Cleanup-timeout root cause remains unproven; successful bounded recovery is established. Native wrappers: `execution-exit-20261021T040913940Z.json`(1), `execution-exit-20261021T041420624Z.json`(0), `execution-exit-20261021T041734380Z.json`(1).

Retained catalog required hash: `9afc1e07426e3c7c27bf697c3e4f1877c5affe876cc96505e471f6a08d31d5d2`. Executed controller bytes are hash-named snapshots; config/credentials/row contents are not saved. Current product files are bound to the successful build receipt. Build does not imply typecheck; that gate ran separately.

## Mandatory broad regression and reseal

Fresh `npm run education:verify` native1 (`education-verify-exit.json`): architecture4, customization architecture2 and extension architecture1 tests PASS; conformance8 suites,2 PASS/6 FAIL and46 tests,14 PASS/32 FAIL. Root fixture paths include actual `ENOTFOUND mock.supabase.co` and undefined-fixture cascades. No E2E credentials supplied to out-of-scope broad DB fixtures. The two later command-chain components did not run there; they were independently executed afterward: `remaining-conformance.json` **16 tests/2 suites PASS, native0**, using in-memory producers, no DB credentials.

Healthcare broad regression evidence is reused from batch2n, not claimed freshly executed: its raw native1, guard0 violations, architecture9 tests/2 suites PASS, Product conformance7/1 PASS; Kernel suites39 PASS/18 FAIL/4 skipped, tests374 PASS/151 FAIL/5 skipped,530 total. Existing Healthcare/Core/Education file hashes are independently checked against `FROZEN_BEFORE.json` (332 unchanged files); only the two newly approved Education files are added. Healthcare code and broad fixture environment are unchanged. Reused failure evidence establishes no current full-regression PASS.

Mandatory full regression therefore remains **BLOCKED/NOT_PROVEN for readiness**, raw command result FAIL. Source hash closure and completed peer review do not constitute successful reseal. `RESEAL_STATUS.json` records exact approved artifact hashes and the held reseal gate; no global freeze/protection policy is relaxed. No merge/release, no Go-Live claim, no local commit/push while those required gates remain incomplete.

## Required labels — production/full Product scope

| Label | Result |
|---|---|
| PRODUCTION_CHANGE | NOT_RUN |
| ANONYMOUS_CONTAINMENT | NOT_PROVEN by this batch; prior production evidence not rerun |
| AUTHENTICATED_ACCESS_REGRESSION | NOT_PROVEN for production/full Preschool |
| BATCH2B_RBAC_RLS | IN_PROGRESS |
| PRESCHOOL_GO_LIVE | NOT_READY |

Catalog/Care Browser PASS is explicitly local production-mode runtime against E2E, with synthetic isolated fixtures. It does not certify production or every Preschool workflow. Teacher identity and governed health remain held under the already-approved matrix.
