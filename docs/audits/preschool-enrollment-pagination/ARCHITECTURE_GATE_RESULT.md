# Preschool enrollment pagination — Architecture Gate

Date: 2026-10-18. Lead: current IDE agent. Mode: PRODUCT_FIRST_PRE_GO_LIVE.

## 1. Development process / semantic proof

Owner authorizes actual bounded UI repairs through Agent Flow, browser verification and independent review; no merge/deployment. Follow Bella constitution and Education/Healthcare constitutions. This task changes presentation pagination only, not enrollment semantics. A page selector must stay within the number of pages of the current filtered list. The source of truth for this presentation invariant is the Owner's usable Full UI requirement and the current list/filter contract; fixed page 28 is not an authoritative data count. Business/domain state is unchanged.

## 2. Product manifest

Existing Preschool Product: student registry presentation at `/dashboard/education/enrollments`. Capability: browse/filter a supplied registry. No new capability, manifest, entity or engine.

## 3. Ownership

Product UI owns selected page, page size, filtered display and navigation labels. Existing enrollment API owns registry persistence. Platform owns identity/tenant/authorization. Education owns Course/Enrollment. This task cannot modify those owners.

## 4. Contract dependency

UI → existing enrollment GET response → existing Product/public Education boundary. Keep all requests, DTOs, admission submission, sample records, authorization and persistence code identical. Browser harness substitutes only synthetic GET responses, with no DB connection or write requests.

## 5. Change authority / exact allowlist

Runtime: only `src/app/dashboard/education/enrollments/page.tsx`, limited to pagination derivation, controls, page bounds/reset and list count. All task-local inputs/tests/evidence live under `docs/audits/preschool-enrollment-pagination/`. Reuse existing Agent Flow AppServer/store/authority/history and browser-runner patterns without modifying `scripts/agent-flow/`, sandbox, network or core. Builder codes; managed worker runs actual verification commands; independent Reviewer reads final diff/evidence. Lead coordinates. Do not describe this scoped sequence as proof of a general autonomous four-role controller.

## 6. UI → contract reconciliation

Observed defect: totalPages is derived, but visible numbered buttons are 1–5 plus 28 and Next clamps to 28. Footer uses fixed totalCount rather than filtered rows. Repair renders reachable pages, keeps a valid current page, reports filtered count, and resets/clamps after filtering, page-size changes and loaded-list changes. Test real rendered component in light/dark desktop/mobile, including 0/1/many pages and late GET response. No changes to selection identity, record links, admission flow, API merge/fallback or other known legacy behavior.

## 7. Migration

None. No schema, seed, Auth fixture, E01, remote probe, RLS or migration. Parent Daily GET and Course POST containment remain unchanged.

## 8. Eleven verification gates

1. Semantic scope: pagination invariant only.
2. Architecture: Product leaf diff; frozen kernels unchanged.
3. Contracts: API/DTO/admission preservation readback.
4. Implementation: native fileChange proves Builder changed source.
5. Regression: browser reproduces original failure, unchanged harness verifies final source.
6. Browser: four viewport/theme contexts; navigation, keyboard, filter, size, empty and late-load cases.
7. Contrast: changed footer/current-page text measured with real CSS, ratio >=4.5 for enabled text.
8. Static: focused ESLint, Education typecheck, harness syntax, git diff --check.
9. Evidence: final source/test fingerprints and fresh native-history readback.
10. Independent review: exact final diff and executed evidence; at most one bounded repair/reverify if requested.
11. Delivery: scoped branch/draft PR only, no merge/deploy; UI→DB NOT_PROVEN, Parent RLS FAIL, Course authorization BLOCKED, Pre-Go-Live BLOCKED.

Gate: PASS for this presentation-only batch. Global Architecture/Safety gates remain BLOCKED.
