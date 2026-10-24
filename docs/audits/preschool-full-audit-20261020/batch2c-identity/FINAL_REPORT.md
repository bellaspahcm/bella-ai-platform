# Batch2C — production identity ACL containment, 2026-10-21

## Required status

| Result | State | Exact applicability |
| --- | --- | --- |
| PRODUCTION_CHANGE | PASS | `public.users` client mutation ACL and two exact onboarding writer EXECUTE ACLs, plus preceding Batch2A/B containment |
| ANONYMOUS_CONTAINMENT | FAIL | End-to-end closure incomplete: production Courses API still returns classroom data anonymously |
| AUTHENTICATED_ACCESS_REGRESSION | NOT_PROVEN | SELECT and maintenance ACL preserved; local profile positive passed. Real user workflows intentionally degraded/unverified |
| BATCH2B_RBAC_RLS | IN_PROGRESS | Mutable direct identity source closed; management entitlement/role/branch contracts and deployed API repair remain incomplete |
| PRESCHOOL_GO_LIVE | NOT_READY | Independent gates, source deployment, authenticated workflows and full RBAC/RLS proof outstanding |

`DIRECT_DB_RPC_CONTAINMENT=PASS` for the exact approved32 relations, users mutation and three RPC boundaries. This narrower result does not override the failed end-to-end anonymous API criterion.

## Actual production delta and independent postchecks

Owner approved exactly `public.users` plus related shared identity writers. Target `lvnvkpyxtuilhrabtlwv`, source branch `codex/preschool-full-audit-20261020`, HEAD `339c89250d87964ba8d58860a5ecdbc0bdde4956`. Production deployment stayed `dpl_9FQrTej4gajN95v6MwLJ31f3pUTQ`, source `f973dd7e56542aa7847b98c2a4236da86f1eabc3`; identity and health were rechecked before mutation.

`EXECUTE_IDENTITY_CONTAINMENT.sql` SHA256 `629ea0f719081a9f8195ccecb8d683d9f0c37b53dc96467168e31270ff3f4f1b` ran once, native CLI exit0, `2026-10-20T20:46:11.953Z`–`20:46:15.273Z` (2026-10-21 03:46 +07). Explicit transaction, 5s lock / 30s statement timeouts, approved core and frozen outside metadata preconditions, exact postconditions. No automatic retry, business DML, Auth account/claims rewrite, policy/body/schema/default/membership change or migration-history push.

- `users`: anon/authenticated retain SELECT; INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN effective privileges false, all client column mutation privileges false.
- `create_onboarding_user(text,text,text)` and `onboard_tenant(text,text,text,text,uuid,text,text)`: PUBLIC/anon/authenticated EXECUTE removed. Only original postgres/service_role/bella_migration_executor direct grants remain; supabase_admin retains inherent superuser execution. Both writers deny all30 other roles by live effective catalog.
- Fresh independent full catalog matches exact expected core. All2673 other public/auth relation ACL/owner/RLS metadata, every policy, all other function definitions/ACL/config, roles/memberships, schema/default ACL hashes unchanged. users16 actual columns,5 constraints,7 indexes,5 policies,3 triggers and10 helper definitions unchanged. Dropped attribute gap preserved in rehearsal.
- Incoming writer references: all non-system function name/dependency scan returned empty. Five dependent materialized views and one regular view have updatable mask0; no writeback rule. No unrelated relation was modified.
- Independent production READ ONLY SQL: six EXPLAIN-only client DML permission checks deny42501; four actual client RPC calls deny42501 before body. Service SELECT LIMIT0 allowed. These use SET ROLE, not a real Auth JWT. Ordinary DML is not executed in these probes; READ ONLY would otherwise reject DML with25006 before demonstrating ACL, so it is not counted as ACL proof.
- HTTP recheck:96/96 anonymous reads on original32 relations denied401/42501,32/32 service reads allowed; exec_sql anonymous401/service204. No business row values saved. Production Courses still200 and8 classrooms: existing undeployed source gap, not a containment success.

## Source repairs prepared, not released

`createUser` and `deleteUser` explicitly return temporary identity-management hold for all callers before Auth/admin creation/deletion, DB, audit or email. A precise assignable-role/delegation contract is absent; an invented admin-only arbitrary-role rule would not satisfy ADR-001/ADR-010. `registerNewTenant` retains configured server onboarding and existing HQ/non-BabyCare versus public BabyCare decision; missing privileged config fails before Auth provisioning and cannot fall back to client RPC/signUp.

Existing session-bound user status/profile/salary/attendance-HR/partner metadata writes may now fail by ACL. Staff create/delete and Training student creation through createUser remain held once source is deployed. Do not re-enable anonymous or convert these writers wholesale to service-role. Configured maintenance/onboarding capability retains ACL; full onboarding business workflow was not rerun on production. Current production source still contains old privileged create/delete behavior until release.

New durable ordered migrations cover previous exec_sql repair and this identity ACL boundary. They are source artifacts only: production ran guarded execution artifacts, not a blind history push or migration-history change. users migration aborts unknown table/function grantees, nonempty column ACLs, inherited writer rights in every nonmaintenance nonsuperuser role, and missing prerequisites; it creates no grants, tables, indexes or role memberships.

## Verification and limitations

Native isolated PostgreSQL17.10:20/20 checks passed. Exact users schema, policies, constraints/indexes, helper/trigger/writer bodies and ACL metadata reproduced; only synthetic tenants/Auth/audit prerequisite tables and identities. Actual prestate self-escalation reproduced and rolled back;16 actual client mutation statements and60 writer calls denied after containment; retained maintenance synthetic write/read/claims/audit/rollback and authenticated own-profile SELECT passed. Failure before/after mutation, exact ACL recovery then rollback, replay from prestate/poststate, unknown column/direct/inherited grants, missing RPC and late writable-view drift all checked.

Full production outside catalog was not cloned. Local artifact differs from production in exactly one frozen outside-fingerprint JSON literal; core pre/post guards, SQL logic and mutation bytes are identical. `seal-rehearsal.cjs` proves that limitation explicitly, with separate production/fixture hashes. No full onboarding/E2E/backup-restoration claim is derived from scoped transaction recovery. Recovery SQL restores unsafe prior ACLs only in isolation and is not approved for production rollback.

Focused Jest4 suites/76 tests and Auth guard1 suite/4 tests pass (80 total), zero skips, exit0; lint four shared files exit0; Education TypeScript zero diagnostics, exit0. Independent Blind/Edge/Acceptance reviews found and closed dependency-drift and inherited-role gaps before production. Earlier broad Education/Healthcare checks failed against deliberate offline DB; those failures and incomplete downstream gates remain in Batch2B, not converted to PASS. Runtime source deployment, CI/main verification, real-user Browser E2E, full role/branch/RLS matrix and Product Go-Live remain unproven.

Evidence: production-execution*.json, execution-preconditions.json, full-pre/final-pre/full-post-cli.json, post-verification.json, role-probes-cli.json, http-after.json, rehearsal-result.json, jest-results.json, *-command.json, review-results.json and final-verification.json. Original Batch1/2A/2B evidence remains historical and preserved.
