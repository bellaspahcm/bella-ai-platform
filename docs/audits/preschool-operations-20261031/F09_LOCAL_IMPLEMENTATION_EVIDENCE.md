# F09 — local candidate evidence

Date: 2026-11-02. Scope: disposable Supabase stack `bella-preschool-532b3b8a`, DB container ID `e981480aea7809a19969471f54275f719dc5afa995587aae903764a0a6b9ed45`; no Production action. Final assessment for this batch: **LOCAL CANDIDATE / PASS — NOT A PRODUCTION RELEASE**.

## Schema and RPC

Applied existing migrations `20261020110000_p43_preschool_weekly_menu.sql` and `20261031153000_preschool_weekly_menu_rls_enhancement.sql` by psql to the selected local DB. The second migration's outer BEGIN/COMMIT was removed in-memory to run both in one transaction. No migration ledger was updated. These tables and the test-only function/role remain in the local DB.

Created `F09_LOCAL_RPC_CANDIDATE.sql` in this folder and applied it only to the local DB. It creates `preschool_weekly_menu_executor` with NOLOGIN/NOBYPASSRLS and authenticated role membership; grants it access to the two tables and actor/tenant tables; and creates `preschool_save_weekly_menu` as SECURITY DEFINER owned by that role with fixed search_path. EXECUTE was revoked from PUBLIC/anon and granted to authenticated. No direct DML grant was given to authenticated. It also grants the executor role membership to local postgres for ownership transfer. Review then added explicit null actor/payload checks, `pg_temp` last in search_path, and `FOR SHARE` actor/tenant locks. To allow row locks, the local NOLOGIN executor received `UPDATE(id)` column privilege on `users` and `tenants`; function body only locks those rows. These privileges and role memberships require independent review; they are not authorized for Production. This is a candidate, **not a production migration**.

Catalog after creation: function SECURITY DEFINER true, owner executor, owner rolcanlogin=false and rolbypassrls=false, authenticated EXECUTE=true, anon EXECUTE=false, authenticated direct master INSERT=false. RLS was enabled on both tables. This does not establish the effective policy, grants or ownership in any other database.

## Bounded tests

- Synthetic PostgreSQL role/claims fixture, within a rolled-back transaction: admin create/update PASS; stale version and retry of prior version conflict PASS; invalid calories after master update raised an error; independent DB read-back confirmed prior master title and day row unchanged; Staff without grant denied. This did not use real Auth/PostgREST.
- Barrier test was repeated after the actor/tenant lock change: session A held master row lock; session B was independently observed in `pg_stat_activity` as `active|Lock|transactionid`; A committed an RPC update and B returned `WEEKLY_MENU_VERSION_CONFLICT`; read-back found one winner and one day. Menu/day/user fixtures were removed. The earlier tenant fixture `a0000000-0000-4000-8000-8ac103f865e8` named `Synthetic F09 concurrency` **remains**: deleting it failed due to `timeline_events_no_delete` rule interacting with its FK; the attempted cleanup transaction rolled back, then menu/day/user were deleted separately. No rule or trigger was disabled.
- After the final actor/tenant lock change: real local Auth login and PostgREST RPC succeeded for an admin; Staff without grant, forged tenant ID, forged actor ID and direct authenticated INSERT were denied. Direct authenticated SELECT of master was also denied (`42501`): after removing the GET service-role fallback, the UI read path is held in this local profile until an authorized read boundary is proven. Synthetic Auth users, profiles and menu/day rows were removed. Forged tenant ID was not a second existing tenant, so two-tenant isolation is NOT_PROVEN. A second SQL role/claims transaction passed admin create/update, stale-version rejection and an induced failure after master update; independent read-back confirmed rollback. This last SQL test rolled back fixtures.
- `npm run education:architecture:ci`: ALLOW (baseline 265, current 256); `node scripts/test-ci-weekly-menu-boundary.mjs`: 20/20 PASS. Earlier CI BLOCK evidence remains valid for its earlier revision.
- Three targeted Jest suites: 13/13 PASS. ESLint on affected runtime files PASS. Scanner fixture suite 20/20 PASS and baseline comparator 3/3 PASS. These mock/unit checks do not prove DB authorization or browser behavior. Full TypeScript run was interrupted after source changed and is NOT_PROVEN; GitHub CI for local changes was not run.

## 2026-11-02 — read boundary and Auth/PostgREST

Applied `F09_LOCAL_READ_POLICY_CANDIDATE.sql` to the same local stack only. It grants authenticated SELECT on the two menu tables and adds restrictive SELECT policies based on the existing caller `platform_current_actor_profile()` and tenant equality, allowing active admin/admin_staff. Existing tenant policy remains; authenticated DML grants were not added. GET no longer creates a service-role fallback, and failed reads surface an error instead of an empty menu. These remain local candidates and were not applied or authorized for Production.

Real local Auth and PostgREST probe (`scripts/f09-local-auth-probe.cjs`): two actual active Preschool tenant rows in the same DB; admin for each tenant created, read detail/list, updated and reloaded own menu. Admin A could not read B's menu and could not invoke the write RPC for tenant B. Staff without grant was denied; forged actor/tenant and direct authenticated INSERT were denied. Synthetic Auth users, profiles and menu/day rows were removed. The new tenant B fixture `82e7520b-cf51-4acd-aa33-bd97c441c28e` remains alongside the earlier tenant: history protection was not disabled to force deletion.

Full `npx tsc --noEmit --pretty false` completed exit 0 on the current TypeScript changes. Three targeted Jest suites passed 13/13; ESLint passed; Education architecture gate ALLOW; scanner fixture tests 20/20 and old comparator 3/3 passed. GitHub CI for these local changes was not run because no commit/push was authorized.

## Final continuation — 2026-11-02

The first attempt to verify the tightened RPC candidate hit an unavailable Docker Desktop engine. That was resolved in the bounded acceptance run below; its DB catalog, Auth/PostgREST and transaction results supersede the interim status here.

Final local static runs on this checkout: `npm run education:architecture:ci` ALLOW (baseline 265, current 256); scanner fixture suite 20/20 PASS; baseline comparator 3/3 PASS; `npx tsc --noEmit --pretty false` exit 0. These do not replace DB or Browser evidence. Browser E2E remains **NOT_PROVEN**; no successful run result was captured. GitHub CI remains **NOT_RUN** because changes are uncommitted and commit/push are out of scope.

## Status before Browser follow-up

No Staff grant producer exists in the inspected path; Staff without grant is denied (tested), and Staff write remains unsupported/fail-closed. Browser E2E is not proven. F09 remains HELD pending the Browser Admin create/edit/reload result. This local evidence grants no Production authority. No commit, push, merge or deploy performed.

## Bounded F09 acceptance run — 2026-11-02

Reconfirmed Docker container ID `e981480aea7809a19969471f54275f719dc5afa995587aae903764a0a6b9ed45` and applied the final candidate only to `bella-preschool-532b3b8a`. The executor is NOLOGIN/NOSUPERUSER/NOBYPASSRLS, has no membership in `authenticated` or any other role, no `CREATE` on `public`, and owns the fixed-search-path SECURITY DEFINER RPC. Authenticated has RPC EXECUTE and SELECT only; direct INSERT/UPDATE/DELETE remain denied. The executor uses the existing `platform_current_actor_profile()` contract. Local `public.users` policies let this executor read and lock only the authenticated actor row; its column grant is `UPDATE(id)` solely for `FOR SHARE`, with an identity-preserving UPDATE policy. No Production ACL/RLS or migration ledger changed.

`node scripts/f09-local-auth-probe.cjs`: PASS. Real Auth/PostgREST: Admin A and Admin B each created, listed, detailed-read, updated and reloaded their own menu; Admin A could not read or write Admin B's menu; forged actor/tenant and direct authenticated INSERT were denied; Staff without a grant was denied. User/menu fixtures were cleaned. Existing synthetic tenant B `a8f9c54a-919f-4052-b04e-e9c50f5e39c3` was reused and retained; no new tenant row was created in this run.

`node scripts/f09-local-atomicity-probe.cjs`: PASS. Injected invalid calories produced SQLSTATE `22P02`; read-back found zero master and day residue. With two DB sessions and one expected version, the barrier observed session B waiting on a lock; session A committed and session B returned `WEEKLY_MENU_VERSION_CONFLICT` (`40001`). Read-back showed only A's value. All menu and user fixtures were cleaned.

Browser E2E remains **BLOCKED / NOT_PROVEN**. The local Next dev page and its `_next` assets returned successfully, with no CSP or page errors, but React hydration markers stayed absent. Chromium reported repeated `/_next/hmr` WebSocket handshake failures (`net::ERR_INVALID_HTTP_RESPONSE`); login produced no Auth token request and did not reach the dashboard. Browser fixtures were cleaned. A temporary local matcher edit did not change this outcome and was reverted; `src/proxy.ts` has no retained change from that attempt.

## Browser E2E completion — 2026-11-02

Root cause of hydration/HMR was the Browser probe using `127.0.0.1` while Next dev rejected that Host/Origin for the HMR websocket; the raw response was `Unauthorized`. The probe now uses `localhost` consistently. HMR upgrades, React hydrates, assets return successfully, and Chromium reports no CSP, page, or console errors.

The first authenticated UI create found a schedule mismatch: the editor included Saturday while `endDate` was Friday, so the RPC correctly rejected that date with SQLSTATE `22023`. The business rule was clarified: Monday–Friday is the normal week and Saturday is optional. The editor now defaults to five weekdays, offers an add/remove Saturday control, extends `endDate` only when Saturday is included, and retains Saturday when loading a menu that already has it. No RPC validation or permissions were loosened.

Final `node scripts/f09-local-browser-probe.cjs`: PASS — real Auth login (token endpoint 200), Admin created the default Monday–Friday menu, added optional Saturday while editing, saved, reloaded, and independently read back six menu days. User/menu fixtures were cleaned. DB/Auth tenant isolation and rollback/concurrency results above were not rerun, as their source did not change. Scanner and TypeScript were not rerun.

Final status: **F09 local candidate PASS**. Staff without grant remains denied and the grant lifecycle remains unsupported/fail-closed. No Production change, commit, push, or deployment occurred.
