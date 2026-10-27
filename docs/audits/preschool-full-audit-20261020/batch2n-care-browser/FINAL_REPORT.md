# Batch2n — Care UI remediation and local production/browser evidence

Status: **OWNER DEPENDENCIES HELD — PRODUCT PATCH REVIEWED; NO GO-LIVE CLAIM**. Source branch `codex/preschool-care-rls-prerequisites-20261021`, baseline `6b031511fd37e5ee22288676b833cf855d40b43f`. Current changes are local and uncommitted. Target for fixture verification only: E2E `bmnbqbcdbuklhopfbopv`. Production `lvnvkpyxtuilhrabtlwv` was not accessed or changed by this batch.

## Product changes

Care's individual and bulk saves now send only non-health fields, require full server acknowledgement, and reload the authorized roster before showing success. Denials, partial acknowledgements, network and reload errors preserve the editor and show an error. Held health input is visibly unavailable; the medication tab is removed. No backend authorization or persistence behavior changed.

Course/roster failures are explicit: no fabricated classes and no fallback to the Attendance API's different authorization workflow. Stale roster responses are invalidated when class/date changes. Fabricated recent events and their inactive navigation are removed. The unused frontend fever classifier and obsolete attendance adapter are removed; stored historical health fields remain unchanged. This does not certify the remaining historical health/hygiene presentation mappings as a governed business policy.

## Executed focused verification

- `focused-after-review.json` / `focused-after-review-exit.json`: **88 tests/4 suites PASS, native0** on current Product code. Includes reload denial/failure, retry response ordering, stale class responses and pending-save draft/concurrent-editor controls. Earlier attempts and their failures are retained; no suite was inferred from a path that did not match.
- `typecheck-after-review.log` / `typecheck-after-review-exit.json`: repository `CI_SCOPE_AFFECTED_PRODUCTS=education_preschool npm run typecheck:changed`, actual exit0, **zero Education runtime diagnostics**. The configured Education project excludes test files; this is not a full-repository/test-source typecheck.
- `lint-after-review.json` / `lint-after-review-exit.json`: four changed UI/helper/test files; **zero errors/warnings, native0**. Existing ESLint configuration warning is separate from file diagnostics.
- `proxy-proposal-tests.json`: **30 unit cases PASS**, candidate in memory only. Exact Care path is private/no-store with anonymous/authenticated simulations and session-cookie set/remove; near-match, other API, public and webhook behavior remain unchanged. `src/proxy.ts` was not edited. This does not establish runtime header PASS.

- `browser-controller-guards.json` / `browser-controller-guards-final-exit.json`: **9 offline cases PASS, native0**; rejects production dotenv files and missing/invalid authenticated Care headers or receipt collection failure. Zero network calls/mutations. Actual updated Browser path remains held.

## Actual browser and E2E evidence

`browser-results-2026-10-21T03-24-49-085Z.json`, actual native exit1 (`execution-exit-20261021T032449005Z.json`):

| Gate | Observed outcome |
|---|---|
| Verified prior local production build | Build command native0; receipt/source/product hashes/BUILD_ID verified before reuse |
| Isolated E2E fixtures and owned production-mode Next server | PASS; loopback only, public key only, no privileged runtime key |
| Browser real login form | PASS; actual provider cookie, no mock cookie |
| Care literal private/no-store | FAIL; HTTP401 `no-store, must-revalidate`, environment `production` |
| Canonical Course via same actor's real Auth | HTTP200, fixture Course visible |
| Legacy Course projection | HTTP400 /42703 /SCHEMA_MISSING |
| Teacher assignment dependency | HTTP404 /PGRST205 /SCHEMA_MISSING |
| Browser Care roster | FAIL /REQUEST_TIMEOUT after actual Courses API500 |
| Browser non-health save/reload/denied-save DB proof | NOT_PROVEN; roster dependency blocked execution |
| Cleanup | PASS; owned business/Auth/profile/access rows all0, two immutable audit tenant shells terminated, listener closed |
| Exact retained catalog | Before/after unchanged `9afc1e07426e3c7c27bf697c3e4f1877c5affe876cc96505e471f6a08d31d5d2` |

No browser network success was mocked. Maintenance credentials were used only for synthetic setup/readback/cleanup and catalog checks. No extra relation, policy, ACL, helper, membership or schema was modified. Raw runtime server logs, cookies, credentials and business-row payloads were not saved.

The earlier batch2m165 PASS/31 NOT_PROVEN report remains immutable. Its raw header reason `KNOWN_NEXT_DEV_HEADER_ADAPTER` is historical labeling, not a current causal conclusion: this batch reproduces the missing-private header in production mode and identifies the exact overwrite in `src/proxy.ts`.

`course-prerequisite-catalog.json` is a read-only catalog observation: shared `courses` has Training's `id/module_key/title` shape; `teacher_assignments` is absent. No business rows read and no mutation. The first diagnostic had a script-finally variable error and was terminated as an owned process, native exit−1 (`course-catalog-exit.json`); corrected attempt2 completed native0. Neither attempt created fixtures or changed schema.

## Build provenance and preserved failures

Initial build-only `03-07-31` and full-run build `03-13-54` completed build native0. Full runs `03-13-54`, `03-17-56` and `03-24-49` ended native1 at the documented header/catalog/browser gates; each completed fixture cleanup and catalog preservation. Full-run and later build controller snapshots are stored as `harness-executed-<sha256>.cjs.txt` and match their JSON receipts. `snapshot-provenance.json` distinguishes byte copies from hash-verified reconstructions; the first build-only snapshot was not preserved and has hash metadata only.

Build-only `browser-results-2026-10-21T03-38-04-868Z.json` records build native0 but overall exit1 because an additional UI visibility correction changed source during the build. Its source guard correctly rejected that receipt. The next stable build `03-40-28` passed before review patches. Final reviewed Product build `browser-results-2026-10-21T03-48-47-658Z.json` passed **build native0 / overall build-only native0**, source before/after identical, BUILD_ID `6tULBhKO45Ki7kWXwepA1`; outer native receipt `execution-exit-20261021T034847541Z.json`. `CURRENT_SOURCE_MANIFEST.json` independently matches all four current Product files to that receipt. Build-only aggregate remains `BUILD_ONLY_NOT_PROVEN` to avoid claiming Browser E2E. The subsequent collector-catch correction changes only the verification controller; it is syntax/offline-tested and does not change the built Product. A build never establishes typecheck by itself because existing Next configuration ignores build-time type errors.

## Mandatory wider regression

| Command / component | Actual result |
|---|---|
| `npm run education:verify` | native1; architecture4 tests, customization architecture2, extension architecture1 PASS; conformance8 suites:2 PASS/6 FAIL,46 tests:14 PASS/32 FAIL |
| Education later customization/extension conformance | NOT_RUN after command chain failure |
| `npm run healthcare:verify` | native1; guard zero violations; architecture9 tests/2 suites PASS; Product conformance7 tests/1 suite PASS |
| Healthcare Kernel regression component |61 total suites:39 PASS/18 FAIL/4 SKIPPED;530 tests:374 PASS/151 FAIL/5 SKIPPED |

Raw logs and native receipts are `education-verify.*` and `healthcare-verify.*`. Their failed integration/fixture paths include actual `ENOTFOUND mock.supabase.co` and undefined-fixture cascades. No real E2E credentials were supplied to these broad Kernel suites, which would mutate tables beyond the approved6. These are recorded failed/environment-blocked gates, not waived requirements or evidence of current Product regressions. No Healthcare/automove/other-domain repair was attempted. Full regression readiness remains NOT_PROVEN.

## Owner decisions and architecture boundary

`OWNER_DECISION.md` bundles two concrete proposals. The independently scoped proxy patch has only candidate unit evidence. `ACR_COURSE_CATALOG_READ.md` reports **ARCHITECTURAL GAP DETECTED** and proposes a typed canonical read-only public contract plus a Care-only consumer. It requires Human Architect decision, ADR, exact unlock and reseal before frozen code is written. Existing Training table, legacy contract and shared Courses API remain unchanged. No historical migration replay or added DB prerequisites are proposed.

The owner question is pending; elapsed time grants no approval. Continue already-authorized Product verification while holding these dependent changes. Independent review is complete in `REVIEW_RESULTS.md`: three reviewers, nine deduplicated defects patched; review is source inspection, not executed-test or authority evidence. Current build and focused gates are recorded above. Do not commit, push, declare merge-ready or mark SPEC done while required gates/authority remain incomplete.

## Required status labels — scope of this batch

| Label | Result |
|---|---|
| `PRODUCTION_CHANGE` | NOT_RUN |
| `ANONYMOUS_CONTAINMENT` | NOT_PROVEN by this batch; earlier production evidence is not re-executed here |
| `AUTHENTICATED_ACCESS_REGRESSION` | NOT_PROVEN for production/full Preschool |
| `BATCH2B_RBAC_RLS` | IN_PROGRESS |
| `PRESCHOOL_GO_LIVE` | NOT_READY |

Previous retained exact6+Timeline E2E proof is preserved; this report does not revoke that scoped result or promote it to full Product/production acceptance.
