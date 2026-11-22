# Bella Interior Production remediation drafts — 2026-11-21

**Status: REVIEW CANDIDATES, NOT DEPLOYED. No SQL in this directory has been applied to Production or Bella Test.**

These files are intentionally outside `supabase/migrations/` and are not migration ledger entries. The older `.sql.draft` files are fail-fast, commented drafts. The newer `*.candidate.sql` files contain executable SQL for review and must not be run under the current Production write HOLD. P2/P3/P5 source integration and focused local tests are in place; the candidates and schema rollback proposals passed PostgreSQL 17 SQL and PL/pgSQL parsing. Database behavior, live runtime identity and data recovery remain unproven. See `REVIEW-AND-VERIFICATION.md` for the exact bounds.

## P0 — Production runtime identity

- Production DB candidate directly inspected through Supabase MCP: ref `lvnvkpyxtuilhrabtlwv`; Production ledger reported 491 migrations, latest `20261120130000_interior_crm_security_invoker_and_actor_grants`.
- `src/app/api/health/route.ts` returns only health, a runtime environment label, and whether its configured DB probe succeeds. It does not return the Supabase project ref, so a green health response alone cannot prove DB identity.
- `.github/workflows/deploy-production.yml` now requires explicit `PRODUCTION_BASE_URL`, Production-only Supabase credentials, and checks the API/DB URL against this ref before deployment. E2E and generic Supabase fallbacks were removed. The actual GitHub/Vercel values remain unavailable in this checkout; the guard has not run with real secrets.
- Local `.env.production` contains host `bella-erp-prod.supabase.co`, which was not mapped to the observed Production ref in the connected Supabase project list; local env files do not prove deployed Vercel configuration.
- A direct GET to `https://bella-spa-erp.vercel.app/api/health` failed before HTTP with `No such host is known`. No runtime response was obtained.
- **P0 result: Vercel runtime → Production DB ref NOT PROVEN.** The source guard is fail-closed, but no live GitHub/Vercel configuration was read and no health response was obtained.

Before any Production write, the operator must verify the active Vercel Production deployment's server/client Supabase URL resolves to `lvnvkpyxtuilhrabtlwv`, and that the Production health base URL cannot fall back to the E2E URL. Record sanitized project refs/hostnames only; never print keys or tokens. Then query the exact Production ref again.

## Batch inventory

| Batch | Draft | Production scope | Activation conditions |
|---|---|---|---|
| P2 | `P2-review.candidate.sql` | Customer/contact/address action RLS and least-privilege grants; actor-derived atomic merge RPC returning its audit log | CRM merge API/service/repository use one RPC with OWNER/ADMIN permission. SQL and rollback parse passed; relevant external service-role callers, database checks and live verification remain open. |
| P3 | `P3-review.candidate.sql` | O4 action policies, approval RPC/audit, tenant-qualified parent links, service-only evidence metadata RPC | Existing approval, inspection, note and evidence callers are reconciled in source. A schema rollback proposal is generated; actual evidence upload remains blocked on the separate P4 bucket decision/provisioning. |
| P4 | `P4-evidence-storage-design-gate.md`, `P4-storage-policy.review.sql`, `P4-evidence-deletion.request.sql.draft` | Private Storage, O3/O4 evidence retrieval and authorized deletion | Owner chose bucket settings, retention and shared-file behavior. Determine the Storage policy executor, provision via Storage controls, reconcile the deletion/rollback drafts and verify authorization, retry and upload on Production after separate authorization. P3 does not provision Storage. |
| P5 | `P5-review.candidate.sql` | Database timestamp ownership, partial unique primary/default indexes and atomic switch/clear RPCs | Repository/routes use the RPCs and return HTTP 409 on unique conflicts; schema rollback removes all five timestamp triggers. DB concurrency and SQL behavior remain unverified. |

## Production evidence shaping these drafts

- Direct `pg_policies` reads on Production confirmed the exact baseline: each CRM table has one restrictive tenant guard plus four permissive CRUD policies whose action predicates are `true`; the four O4 tables (campaigns, sessions, notes, evidence metadata) each have only one permissive tenant-only `ALL` policy. P2/P3 now fingerprint these policy sets and abort if policies are missing, changed, or extra.
- A new read-only Production catalog snapshot (2026-11-21 11:40 UTC) confirmed 491 ledger migrations/latest `20261120130000`, exact function owners/ACLs and 16 validated O4 legacy FKs. It also found operational table grants (`bella_developer`, `verification_executor`, `bella_migration_executor`) which P2/P3 now fingerprint and preserve. P2 keeps the live no-authenticated-DELETE boundary on `interior_customers`; normal archive is an update, and hard delete is not newly enabled.
- The current actor/role matrix has customer read for ADMIN, EXECUTIVE, OWNER and SALES; handover approval for OWNER and PM; delivery and QC actions for their existing mapped roles. CRM merge is separately limited to OWNER/ADMIN in P2; SALES retains its existing CRM CRUD permissions.
- CRM contacts/addresses and O4 campaign/session/note/evidence have authenticated table-level write grants in Production. Campaign/contact/address include timestamp INSERT access; sessions include direct UPDATE of approval fields; notes and evidence also have broad table-level grants.
- Current CRM and O4 row counts are zero, but there are six existing Interior projects and associated commercial records. The drafts do not reset, truncate, or recreate tables.
- The existing repository uses `.select('*')`; drafts retain table-level SELECT and only narrow INSERT/UPDATE/DELETE privileges.
- Existing simple cascading O4 foreign keys are preserved by tenant-qualified replacements/additions. Any future change to cascade behavior needs separate review.
- Read-only Production metadata confirms `updated_at` columns on CRM contacts/addresses and O4 campaign/session/note tables; this shaped P5 triggers. No customer PII was read.
- Read-only Production ACL/RLS check found alias and merge-log tables are authenticated SELECT only under restrictive tenant policies; direct merge writes remain inside the atomic RPC. The Production trigger catalog returned no triggers on contacts, addresses, campaigns, sessions or notes, so P5 now fails closed on pre-existing helper/index/trigger name collisions.
- Production recovery remains `NOT PROVEN`; local snapshots are not proof of current-state restoration. `WRITE STATUS = HOLD` remains in force.

## Current local evidence

- CRM merge source has one route caller and no direct relationship-transfer/log-write repository path; this checkout search cannot rule out an external service-role caller.
- P3 approval, inspection, note and evidence route callers use the intended actor-scoped update/approval/metadata paths. The Production metadata RPC is currently absent; P3 proposes the exact service-role RPC used by the repository. Upload still cannot succeed until P4 provisions and verifies the bucket.
- P2/P3/P5 rollback files are review-only schema reversals, not data recovery plans. They require fresh pre-execution catalog comparison and matching app rollback; P3 preserves any non-empty approval audit table.
- The latest focused local verification is recorded in `REVIEW-AND-VERIFICATION.md`. No Production write or migration was performed.

## Out of scope / explicit holds

- Do not apply `20261121000050` or `20261121062202` as-is to Production.
- Do not create/configure `interior-site-evidence` merely to satisfy a migration preflight.
- Do not change expired public approval-link read behavior.
- Do not blanket-revoke SECURITY DEFINER functions from advisor counts. Review RPC ACLs individually against callers and purpose.
- No Production HTTP/E2E probe has run. A local result cannot be reported as Production evidence.
- Local verification: CRM/Customer 360/route/RBAC 6 suites / 75 tests passed; O4/security 6 suites / 57 tests passed. These prove mocked/in-memory behavior only.
- No Production DDL, data writes, Storage calls, or migration applications were run during this continuation.
