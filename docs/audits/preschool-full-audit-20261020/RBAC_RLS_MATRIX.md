# Preschool RBAC / RLS evidence matrix

Source `339c89250d87964ba8d58860a5ecdbc0bdde4956`. Read alongside `REPORT.md`. `SOURCE` means inspectable code; `MOCK_TEST` is not real Auth/RLS; `LOCAL_PROBE` is development runtime; `REMOTE_ANON` is direct configured remote public-key access. No mutation-denial test was performed against business rows.

## API surfaces (20 route files)

| Endpoint | Actor/role/tenant rule observed | Evidence and outcome |
| --- | --- | --- |
| `POST ai/copilot` | Role helper exists, but client `x-mock-role` takes precedence; query tenant precedes actor tenant | SOURCE + LOCAL_PROBE: anonymous403 changes to invalid-action400 with client role; privileged AI execution not called |
| `GET analytics` | `getCurrentUser`; denies `parent`/`student`; broad other-role allowance; dev tenant fallback; admin read after resolver | 2 MOCK_TEST tests pass; complete allowed-role/branch real-session matrix NOT_PROVEN |
| `POST announcements` | User optional; tenant/actor defaults; admin operation client; no explicit role gate | SOURCE. Invalid empty body400 observed before auth denial; inserts NOT_RUN |
| `GET/POST attendance` | Resolve actor, map admin/super_admin→PRINCIPAL and admin_staff→TEACHER; modification guard; dev fallback | 3 MOCK_TEST tests pass. Anonymous request without course returns400 validation; this does not prove auth bypass or auth PASS. Full real-session branch denial NOT_PROVEN |
| `POST attendance/handover` | Session actor + attendance role + guardian/handover service | 2 API + 6 handover service MOCK_TEST tests pass. Persisted authorized/denied handover NOT_PROVEN |
| `GET branches` | Auth-backed context → PreschoolChainService listAccessibleBranches | Anonymous401 LOCAL_PROBE; 2 MOCK_TEST tests pass. Product branch traversal differs from canonical access view; real branch scope NOT_PROVEN |
| `GET/POST care/bulk` | Query tenant accepted before actor; dev fallback; admin client; no role allowlist in resolver | SOURCE gap; client-provided health decision fields accepted. Cross-tenant mutation NOT_RUN |
| `GET/POST care/digest` | Parent context explicitly requires role `parent`; guardian assertion before read/publish/acknowledgment | SOURCE guardian control present. No real parent session executed; not collapsed into the unsafe bulk endpoint |
| `POST care/medication` | No session resolver; tenant/actor in request; privileged client | SOURCE missing RBAC/actor binding. Service dose rules do not prove caller permission. Writes NOT_RUN |
| `GET courses` | Query tenant accepted first; operation admin selected in runtime | Anonymous no-session query returns200 and 8 classrooms LOCAL_PROBE. Existing 3 mocked course tests do not prove production authorization |
| `POST courses` | Intentional containment | Handler503; preserved. Legacy classroom E2E expectation200 is stale relative to containment |
| `GET courses/[id]` | Explicit tenant before user; dev mock operation client; fallback tenant branches | SOURCE. Invalid ID404 observed with misleading UI default. Complete denied role/tenant tests NOT_PROVEN |
| `POST/DELETE courses/[id]/teachers` | Uses TeacherAssignmentContractImpl; body/query tenant or fixed default; no explicit session/role gate in handler | SOURCE gap. Contract reuse does not itself authorize user. No assignment mutations run |
| `GET/POST enrollments` | Auth tenant resolver; no explicit role allowlist in handler; privileged operation client after context; branch authorization later | Anonymous GET401; 6 API MOCK_TEST tests pass. Party/student/enrollment persist before optional Chain branch check. Real denied role/atomic rollback NOT_PROVEN |
| `GET/POST finance` | `resolvePreschoolFinanceActor`: only admin/accountant, operation-specific guards, live actor/tenant | Anonymous GET401; 5 actor-authorization MOCK_TEST tests pass. Underlying anonymous invoice SELECT remains FAIL |
| `GET parent-daily` | Deliberate fail-closed containment | 503 `PARENT_ACCESS_NOT_READY` observed; 2 MOCK_TEST tests pass. Parent feature remains unavailable |
| `POST portal/token` | No mandatory current user/role; fallback tenant/guardian; receives student/guardian identifiers | SOURCE issuance authorization gap; token issuance NOT_RUN |
| `GET portal/[token]` | Service verifies HMAC/expiry and guardian relationship; privileged aggregation | Invalid-token API401/UI error PASS. Source signing fallback and possible create-thread-on-GET are separate findings. Valid access NOT_RUN |
| `POST portal/[token]/chat` | Service verifies token/guardian before chat persistence | SOURCE guards present; real valid/invalid guardian write matrix NOT_RUN |
| `POST portal/[token]/copilot` | Token verify path exists | SOURCE only; AI execution not invoked. Full token authorization and PII negative scenarios NOT_PROVEN by audit execution |
| `GET/POST work-queue` | Active live session required; admin-only; active Preschool product gate; validated commands/origin/version; server-derived actor | Anonymous GET401; **52 API MOCK_TEST tests pass**. Existing fixture browser returned403, not promoted into workflow PASS. Real role×branch×RLS mutation matrix NOT_PROVEN |

The method `EducationSecurityGuardService.assertCanModifyInvoice` currently uses a denylist, while reconciliation/attendance use explicit allowlists. Its TypeScript union is not by itself a runtime validation for arbitrary external role strings. Finance's resolver narrows roles before calling it; other consumers must be traced independently.

## RLS/grants: source versus deployed behavior

| Group | Repository declaration | What actually ran |
| --- | --- | --- |
| Finance `edu_fin_*` | `20260909000059_p73_finance_rls_grant.sql` changes policies to `USING(true)` and grants schema-wide access | REMOTE_ANON invoices returned rows across 61 tenants in sample; SELECT isolation FAIL. No writes tested |
| Facilities `edu_fac_*` | `20260909000062_p9_facilities_asset_schema.sql` enables RLS with `USING(true)`; `...000064_p93_facilities_rls_grant.sql` grants access and recreates permissive policies | REMOTE_ANON assets across 100 tenants in sample; SELECT isolation FAIL. No restoration/inspection mutation tested |
| Scheduling `edu_sched_*` | `20260909000060_p8_staff_scheduling_schema.sql` permits non-null tenant and grants ALL to anon/authenticated | Anonymous empty shift-assignment result observed; empty data is not authorization PASS. No populated-row/role/branch write proof |
| Students | Historical student policies and later identity migrations require deployed catalog reconciliation | REMOTE_ANON selected target tenant's row. FAIL regardless of historical expected policy; exact live root policy NOT_PROVEN |
| Education kernel course/attendance | Auth-tenant helpers/policies in relevant migrations | Anonymous `edu_courses` and daily-state GET401/42501; enrollment/attendance empty result. Scoped anonymous negative result only, not full real Auth role matrix |
| Chain assignment tables | `20261006010000_preschool_chain_assignments.sql` checks tenant through get_auth_tenant_id; no branch/role predicate | Admin REST404/PGRST205: not exposed in schema cache. Physical existence/current policies unavailable because Postgres28P01 |
| All other care/communication/learning tables | Source policies catalogued through source scans; no blanket claim from names | Per-role deployed SELECT/INSERT/UPDATE/DELETE and guardian/branch denied paths NOT_PROVEN |

`RLS enabled`, a policy named `tenant_isolation`, a service-role result, or a passing guard unit test is insufficient. Need actual predicates/grants plus allowed and denied non-privileged sessions in an isolated environment.

## Required follow-up evidence

1. Read-only deployed `pg_class`, `pg_policies`, grants and relevant SECURITY DEFINER functions, with exact environment identity.
2. Real Auth sessions for admin, accountant, teacher, parent, facilities staff and explicitly denied roles, plus tenant B and branch B contexts. Reconcile canonical role names before inventing a mapping.
3. Observe positive and negative read/write paths with user JWT, independent read-back and owned-fixture cleanup. Do not manufacture JWTs with service credentials or use service-role for the behavior under test.
4. Assert no mutation/outbox/notification on context/role/branch denial; keep tuition/clinical semantics independent from current implementation.
5. Recheck direct PostgREST access as well as APIs. Fixing only application guards leaves direct DB exposure unresolved.
