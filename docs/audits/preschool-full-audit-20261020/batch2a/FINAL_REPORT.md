# Production containment execution — stopped before production changes

Date: 2026-10-20, Asia/Saigon. Target Supabase `lvnvkpyxtuilhrabtlwv`. Source `339c89250d87964ba8d58860a5ecdbc0bdde4956`; production deployment `dpl_9FQrTej4gajN95v6MwLJ31f3pUTQ`, `main@f973dd7e56542aa7847b98c2a4236da86f1eabc3`.

**Production ACL change NOT_RUN.** The approved32-table change passed isolated rehearsal, but the final access-path check found an anonymous privileged SQL-execution RPC outside the approved allowlist. The owner's explicit stop condition applies. No production grant/policy/schema/function or business data was changed.

## Required result fields

| Field | Result | Evidence / limit |
| --- | --- | --- |
| `PRODUCTION_CHANGE` | **NOT_RUN** | The COMMIT artifact was never sent to production. Selected live catalog unchanged before/after |
| `ANONYMOUS_CONTAINMENT` | **FAIL** | Production direct reads still open; additional anonymous SECURITY DEFINER RPC execution confirmed |
| `AUTHENTICATED_ACCESS_REGRESSION` | **NOT_PROVEN** | Isolated real PostgreSQL role tests passed, but no production change or real Auth browser regression run occurred |
| `BATCH2B_RBAC_RLS` | **NOT_STARTED** | No API, role matrix, policy/helper or function repair was performed |
| `PRESCHOOL_GO_LIVE` | **NOT_READY** | Independent product gates remain unmet |

## What was completed

1. Read owner instruction, the exact32-table allowlist, remediation plan, snapshot and ROLLBACK-only proposal. New owner authority recorded in `AUTHORITY.md`; original audit and Batch1 files preserved.
2. Re-read production catalog. Tables, policies, grants/column ACL, memberships, roles, schema/default ACL, helpers and views matched Batch1. Source revision and Vercel production project/environment were verified again (`baseline-drift.json`, `execution-preconditions.json`).
3. Read dependencies and schema metadata:32 target tables,365 columns,137 constraints,34 applicable policies,12 relevant functions and4 triggers. No dependent view was found. The two functions with textual table references were invoker functions; this first pass did not establish that every dynamic SQL function was safe.
4. Built a separate explicit-COMMIT artifact `EXECUTE_APPROVED_32_TABLE_ANON_CONTAINMENT.sql`; the original proposal remained ROLLBACK-only. Artifact SHA-256: `eef5f1876c28361dc3265436f43705b38648bf4f739e4db05863108aa88a11bd`. It verifies exact pre/post catalog and effective table/column privileges, with lock timeout5s / statement timeout30s. **Its existence does not authorize execution after the blocker below was discovered.**
5. Provisioned a loopback-only PostgreSQL17.10 rehearsal cluster. Installed client tools lacked server share files; fetched official matching binaries into the ignored task cache, with no global install or production data copy. Reproduced selected production catalog exactly, including columns/constraints/policies/functions/triggers/ACL/roles/membership/default/schema privilege fingerprints. Empty prerequisite identity-reference tables were limited to the fields needed by FKs/helper definitions.
6. Ran the exact artifact locally with synthetic fixtures; **12 tests PASS**, command exit0. This proves the ACL delta and transaction/recovery behavior on actual PostgreSQL, not full Product/Browser E2E.
7. Final dynamic SQL access-path inspection found `public.exec_sql(sql_query text)`, then a harmless constant-SELECT anonymous RPC probe confirmed transport access. Stopped before any production mutation.
8. Read production catalog again: all10 compared groups unchanged (`production-nochange-proof.json`). Stopped the owned local PostgreSQL cluster; its ignored data directory contains only metadata and synthetic rehearsal fixtures.

## Isolated rehearsal evidence

`rehearsal-result.json`, `rehearsal-command.log`, pre/post fingerprints and `rehearsal-bootstrap.json` retain results:

- Exact selected catalog equality with production before the change.
- Baseline anonymous role actually reads the three synthetic fixture rows.
- Intentional failures before mutation, after16-table partial revoke, and after full revoke roll back completely.
- Exclusive-lock conflict produces SQLSTATE55P03 and no partial ACL delta.
- Exact explicit-COMMIT artifact executes locally and matches the expected anon-only poststate.
- **160 anonymous SQL operations denied**: SELECT/INSERT/UPDATE/DELETE/TRUNCATE across all32 tables, SQLSTATE42501.
- Authenticated role:32 read-access checks plus3 positive fixture read-backs and a rolled-back owned-fixture update pass.
- Service-role:32 read-access checks plus3 positive fixture read-backs pass.
- Original scoped ACL backup restores the precise prestate inside an isolated recovery transaction; rollback returns to the contained poststate. No recovery SQL was run against production.
- Non-anon ACL, policies, helpers, schema/default privileges, constraints and triggers stay unchanged.

Setup corrections were limited to the local scaffold: JSON key-order canonical comparison and reproducing original function ACL entry ordering. No assertions were weakened and no production baseline was edited. The actual rehearsal subsequently passed against the unchanged canonical metadata.

## Blocking finding: anonymous privileged SQL executor

Deployed catalog (`blocker-catalog-cli.json`) establishes:

- Function: **`public.exec_sql(sql_query text)`**.
- SECURITY DEFINER; owner `postgres`; owner's BYPASSRLS flag=true.
- `has_function_privilege('anon', ..., 'EXECUTE') = true`.
- Body executes the caller-supplied SQL string without an authentication/authorization check.

The direct RPC probe used only **`SELECT 1`**, with the anon public key, no user JWT/cookie, no business-table references and no mutation statements. Production returned **HTTP204** (`blocker-runtime.json`). No business row contents, tokens or credentials were saved. This confirms an actual anonymous RPC execution path, not only a theoretical function grant.

Revoking table ACL from anon does not constrain SQL executed under this privileged function owner's authority. Therefore the32-table grant delta would leave an unaccounted privileged access path; fixing function EXECUTE privileges/body would be **outside the explicitly approved table-only delta**.

The user explicitly required: “Stop without production changes ... [if] effective anonymous access would remain through an unaccounted grant path.” This is the exact reason execution stopped, not a new approval round for the32 tables or a restart of the full audit.

The artifact builder now refuses regeneration while this unresolved dynamic executor is recorded. The saved, successfully rehearsed artifact remains **NOT_EXECUTED / HELD**. Do not manually run it while the RPC path remains unresolved.

## Current runtime state

Before execution was stopped, anonymous GETs were made independently against all32 relations (`http-before.json`). No denial seal was produced; the previously demonstrated leaks remain. Production Courses still returns200 and8 classrooms without a user session, through its known service-role API path. Table ACL-only containment cannot fix that API path; it remains Batch2B.

Scheduling/Facilities were not degraded by this run because production permissions were not changed. Their known dependency on direct anonymous clients remains a compatibility risk when containment is eventually applied; no grant was restored to keep UI working.

## Narrow decision needed to resume

The32-table owner approval remains valid. The newly discovered dependency needs **separate, explicit authority for the EXECUTE access boundary of `public.exec_sql(text)`** before proceeding. No additional tables or broad Preschool/Kernel changes are needed for that decision.

The next bounded security packet should determine the exact PUBLIC/anon grant path and existing legitimate consumers, deny effective anonymous RPC execution, preserve only the approved non-anon execution contract, rehearse it in isolation and verify the anonymous harmless-SELECT RPC is denied. Do not infer a service/admin allowlist or add new privileges merely to make the endpoint work. Do not change this function in the current32-table-only batch.

After that blocker is resolved under its own authority, refresh the32-table catalog/identity, rerun the unchanged-scope rehearsal/preconditions as required, and execute the approved table delta with full anonymous and non-anonymous postchecks. Keep authenticated RBAC/RLS and Go-Live separate.
