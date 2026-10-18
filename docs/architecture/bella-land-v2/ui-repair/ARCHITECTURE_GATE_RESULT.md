# Architecture Gate — Bella Land UI repair

2026-10-18 (Asia/Saigon). **PASS for autonomous non-sensitive UI repairs.**

## 1. Process gate and authority

Evidence → existing Bella Land contracts → consumer defects → minimal UI repair → behavioral verification → review. Owner now directs the IDE agent to fix all Bella Land UI defects without asking at each ordinary technical failure. This authorizes presentation, navigation, local view state and offline test changes. Earlier managed tasks remain terminal HELD; their budgets and evidence are not rewritten. Direct IDE work does not prove the Controller's native end-to-end lifecycle.

## 2. Product manifest

Existing Bella Land, 17 dashboard routes. Repair layout switching, links, search/filter/tab behavior, selection, pagination, modal controls, loading/error/empty states and misleading unsupported actions. Preserve existing design and use existing shared UI primitives. No new product, runtime, task store or domain engine.

## 3. Ownership

The real-estate presentation layer owns view mode, filters, query text, modal state and selection. Existing Product/OS services retain project/unit/customer/reservation identity, persistence, authorization and commercial semantics. The product-local HRDirectoryPage, PeopleDirectoryPage, OrgChartPage and CEODashboardCharts components are Bella Land presentation consumers; only their local view state, error handling and preview controls may change. Existing People/HR/Org public contracts and data ownership remain unchanged. Shared runtime/tooling and sealed packages remain unchanged in this UI batch.

## 4. Contract dependencies

Project/unit UI → existing public read actions → existing services. Other pages currently use local sample arrays; those arrays cannot prove persisted customer, contract, money, schedule, document or campaign operations. Keep sample views visibly identified, and do not advertise successful persistence for local-only actions. No DB/API calls are executed by UI verification; public read/action boundaries are mocked in the test harness.

## 5. Change boundary

Allowed: `src/app/dashboard/real-estate/**`, the presentation components named above in `src/modules/real_estate/components/`, product-local UI helpers and tests, isolated offline UI test configuration and this unsealed scope record. No underlying capability or action contract changes. No migration, DB writes, auth/RLS/grants, reservation commands, Finance, external ads/signing/messages, ProductRegistry, frozen/shared kernel, Runtime T, production or release operation. Hold only the affected dependency and continue independent UI fixes.

## 6. UI → contract reconciliation

| UI surface | Existing contract / evidence | Repair disposition |
|---|---|---|
| Apartment matrix/list, filters, detail | Returned project/unit rows and existing read actions | MAPPING BUG: same filtered rows in both layouts; read-only detail; actual zero/null values |
| Project selection and summary | Existing project/product reads | MAPPING BUG: catch rejected reads, exclude inaccessible rows, do not report failed inventory reads as zero |
| Navigation/global search | Existing dashboard routes | STALE UI: canonical URLs, search query and asynchronous state; no fabricated cross-product IDs |
| Local CRM/documents/calendar/support views | Sample arrays, no demonstrated persistence | STALE UI: identify preview data; functional local view controls; no fake save/sync/send/payment claims |
| Contract/deposit/receipt/ads/auth settings writes | Sensitive or absent verified owner contract | CAPABILITY GAP: explicit unavailable operation; no financial or security implementation |
| People/HR/org links | Existing destination routes | MATCH where destination exists; preserve their owners |

## 7. Migration plan

None. No schema, seed, backfill, business fixture, DB write or migration.

## 8. Eleven verification gates

1. Preserve checkout baseline and history; inspect tracked and untracked diff.
2. Keep modifications within the presentation/test scope; no frozen/runtime changes.
3. Verify navigation destinations and query parameter semantics.
4. Verify filters, view switching, selection and pagination against the same displayed rows.
5. Verify loading/error/empty/retry and stale-response handling using mocked reads.
6. Verify unsupported operations do not claim persisted success or trigger mocked writes.
7. Identify sample data; do not claim tenant/DB/runtime proof from local arrays.
8. Run focused React behavior tests and meaningful cross-route regressions.
9. Run scoped syntax/type/lint/diff checks; distinguish existing failures.
10. Review the final diff and retain exact results, including unresolved sensitive dependencies.
11. Keep Controller lifecycle, Real DB/RLS, browser E2E, main seal and Go-Live separate; unexecuted proof remains NOT_PROVEN.

## Decision

**PASS — proceed autonomously with non-sensitive Bella Land UI fixes.** Sensitive dependencies remain held. This gate grants no deployment, database or external-action authority.
