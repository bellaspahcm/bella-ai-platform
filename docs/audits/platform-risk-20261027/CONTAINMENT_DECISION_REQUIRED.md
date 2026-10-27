# Primary P0 containment decision and result

**Decision:** owner selected scoped tenant-contract repair followed by containment, with authority limited to the five named history tables, six named RPCs, and three attached Auto triggers.

**Current status: `P0 = CONFIRMED / CONTAINED` on primary `lvnvkpyxtuilhrabtlwv`.** The original read-only evidence below remains the pre-change baseline; the implementation and post-change proof follow.

## Refreshed read-only evidence

Three queries were run against primary `lvnvkpyxtuilhrabtlwv` on 2026-10-27 from 04:22 through 04:25 UTC. Each opened a `REPEATABLE READ READ ONLY` transaction and rolled it back:

- [Table preflight](containment-table-preflight.json) and [execution record](containment-table-preflight.execution.json): the pre-change state had RLS off and `anon`/`authenticated` SELECT, INSERT, UPDATE, DELETE, and TRUNCATE on all five targets.
- [Function preflight](containment-function-preflight.json) and [execution record](containment-function-preflight.execution.json): before change, five Auto history RPCs were `SECURITY DEFINER` and H9 `reconstruct_temporal_state_at` was `SECURITY INVOKER`; all six were publicly and anonymously executable.
- [Trigger preflight](containment-trigger-preflight.json) and [execution record](containment-trigger-preflight.execution.json): three enabled triggers attached to `auto_bookings`, `auto_customer_journeys`, and `auto_vehicles` called invoker functions that wrote to the corresponding history tables.

The earlier failed function catalog attempt is retained as `containment-function-preflight-attempt1.*`; it was a read-only SQL error (`pg_get_functiondef` was evaluated against an aggregate). The corrected function query and the separate table/trigger queries all exited 0. No query returned business rows.

## Consumer trace

- `src/components/bella-auto/TemporalQueryBuilder.tsx` calls `get_temporal_vehicle_inventory` with the browser `createClient()`. A source search found no import/use of this component elsewhere, so a reachable route is `NOT_PROVEN`. The repository also has two test/diagnostic scripts that call Auto history RPCs.
- AutoMove routes for booking/vehicle operations explicitly set role `authenticated`; primary `pg_stat_statements` also recorded authenticated activity on those parent tables, though no UPDATE was classified in the captured window. Trigger tests after repair ran under this same role.
- `CustomerJourneyService` receives an injected Supabase client, and its only source caller is `AutoSalesProvider`; no production caller of that provider was found. A separate source route, `POST /api/bella-auto/transactions/[id]/rollback`, updates journeys through `BusinessRollbackEngine` using `getPrimaryClient()`. In production the factory selects the public publishable/anon key and forwards no request session, so that route's expected PostgREST role is `anon` by source inspection. Current parent catalog shows RLS enabled, no policies, and UPDATE ACL for anon/authenticated; RLS therefore denies those client updates, and the containment trigger rejects anon if reached. This is not runtime evidence that production executed the route. The latest primary `pg_stat_statements` query has zero journey UPDATE rows, and the behavioral journey probe used `service_role`. Therefore a successful production UPDATE role remains `NOT_PROVEN`. No parent ACL/RLS was widened.
- H9 engine/event handler source accepts injected clients and no non-test constructor was found. Pre-change primary statistics recorded `service_role` for 27 H9 table calls and 17 reconstruction RPC calls. The H9 engine constructor remains unlocated, but the observed server-role path was preserved and tested.

## Decision received and implementation

The owner selected the tenant-contract repair path. The earlier table-only candidate remains superseded and was not run. [Migration `20261027120000_temporal_history_tenant_containment.sql`](../../../supabase/migrations/20261027120000_temporal_history_tenant_containment.sql) passed a primary dry-run in a transaction ending `ROLLBACK` (exit 0), then was applied directly to primary with `supabase db query --linked --project-ref lvnvkpyxtuilhrabtlwv --file ...` (exit 0). No `db push`, migration repair/sync, reset, or broad product deployment was run. The remote migration ledger was not modified, consistent with the no-sync boundary.

The migration is limited to the authorized surface:

- Enables RLS on the five history tables. Authenticated users retain `SELECT` only through `platform_current_actor_profile()` for their active tenant; direct authenticated writes and anonymous table access are revoked.
- Preserves the existing full table privileges for `service_role`.
- Converts the three Auto history trigger functions to `SECURITY DEFINER SET search_path = ''`, qualifies table references, and checks that the authenticated actor tenant matches both `OLD.tenant_id` and `NEW.tenant_id`. `service_role` and trusted direct `postgres` sessions remain supported.
- Adds the canonical tenant check to all five Auto history RPCs. Removes `PUBLIC`/`anon` EXECUTE and retains authenticated plus `service_role` EXECUTE.
- Keeps H9 reconstruction `SECURITY INVOKER`, adds its actor tenant check, and uses RLS on both event/snapshot tables. H9 service-role calls remain authorized.
- Adds no tables or columns, does not widen parent-table policies, and does not change H9 engine files or responsibilities, other RPCs, or history rows.

## Verification evidence

| Requirement | Evidence | Result |
| --- | --- | --- |
| Anonymous table reads blocked | [Post-change HTTP probe](containment-anonymous-rest-post-change.json), HEAD on all five tables | 5/5 HTTP 401 |
| Anonymous RPC calls blocked | Same probe, POST on all six named RPCs | 6/6 HTTP 401 |
| Tenant A cannot read tenant B | [Rollback behavioral run](containment-behavioral-e2e-rollback.stdout.log), using active Auth-backed identities and synthetic fixtures | PASS across all five tables |
| Tenant checks on RPCs | Same run, cross-tenant calls to five Auto RPCs and H9 | 6/6 denied |
| Authenticated own-tenant Auto RPC reads | Same run invokes vehicle, booking, journey, inventory, and vehicle-status history queries | 5/5 PASS |
| Auto trigger writes continue | Same run: authenticated updates for vehicle/booking; service-role journey update | 3/3 PASS |
| H9 server flow works | Same run: `service_role` event insert plus reconstruction; authenticated same-tenant read also passes | PASS |
| Test fixtures persist | The test transaction ends in `ROLLBACK` | 0 persistent fixture rows |
| ACL/RLS/functions/triggers rechecked | [Table ACL](containment-post-change-table-acl-readonly.stdout.log), [function ACL](containment-post-change-function-acl-readonly.stdout.log), [policies](containment-post-change-policies-readonly.stdout.log), [trigger catalog](containment-trigger-preflight-readonly.stdout.log) | PASS: anon false, RLS on, authenticated read-only policies, service-role grants retained, three triggers enabled/security definer |

Actor and fixture IDs were selected and used only inside the rollback transaction; they were not returned or saved. HTTP evidence contains endpoint labels and status only; no response body or business row was retained.

## Privileged database identities

The post-change role catalog found `bella_developer` and `verification_executor` have table `SELECT` ACLs but lack `BYPASSRLS` and membership in `authenticated`/`service_role`; neither role has a history-table policy. `bella_migration_executor` is a login role with `BYPASSRLS` and existing `SELECT` ACL, so it can access the five tables as a privileged migration identity. Its role attributes and grants were not changed because this authority covers application tenant containment while preserving trusted operational roles. This privileged database role is outside the anonymous and authenticated-tenant acceptance tests.

## Mandatory Healthcare verification

`npm run healthcare:verify` exited 1. Architecture guard passed with zero violations; architecture tests passed 2/2 suites and 9/9 tests; conformance passed 1/1 suite and 7/7 tests. The configured `healthcare:test` phase ran 61 suites: 39 passed, 18 failed, and 4 skipped; 530 tests: 374 passed, 151 failed, and 5 skipped. The observed root was DNS `ENOTFOUND mock.supabase.co` while integration fixtures reached their configured test host; cleanup/read errors were cascades from setup failure. This gate is `BLOCKED_BY_TEST_ENVIRONMENT`, not Healthcare `PASS`. The production rollback probes above directly exercised the authorized H9 read/write path.

## Remaining boundaries

- Journey production UPDATE role remains `NOT_PROVEN`; the live parent has no authenticated policy. The service-role path passed without changing parent ACL/RLS.
- Global Healthcare readiness, the broader 11-gate status, migration replay equivalence/history repair, and Go-Live remain `NOT_PROVEN` or outside the authorized scope.
- At the time of this containment decision, no commit, push, PR, merge, reset, dependency repair, migration sync, or product deployment had occurred. A later dependency-only commit/push for GitHub CI is recorded in `REPORT.md` §9; the containment changes remain outside that commit.
- The primary migration ledger was intentionally not synchronized. Do not run `supabase db push` on this project to apply this migration: the earlier reconciliation showed 143 Git-only migration IDs. Any ledger reconciliation must be a separate scoped task.
