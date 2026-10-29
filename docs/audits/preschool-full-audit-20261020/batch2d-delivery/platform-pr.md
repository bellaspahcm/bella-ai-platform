## Problem and behavior

Client-writable `public.users` authority fields and PUBLIC-executable onboarding SECURITY DEFINER writers allow identity changes outside a proven management entitlement. This change preserves the owner-approved production ACL containment in ordered fail-closed migrations, holds shared staff create/delete before privileged side effects, and removes onboarding's unprivileged RPC/signUp fallback. Configured server onboarding retains the existing HQ/BabyCare decision.

Direct anon/authenticated profile/status/salary/partner mutations can intentionally become unavailable; staff/Training account creation is temporarily held. No new role matrix or service-role bypass is invented. SELECT, maintenance grants, policies/function bodies, role memberships, schema/default ACLs and business data remain unchanged by the ACL repair.

## Product scope declaration

- Primary: Platform shared identity/security infrastructure.
- Secondary product runtime changes: None. Education Courses remediation is a separate PR.
- Six sealed source/test/migration paths; selected audit evidence under `docs/audits/preschool-full-audit-20261020/delivery-platform-20261021/`.
- No Healthcare/Education/Logistics Kernel changes. Real Estate template provisions are not applicable.
- Base ancestry synchronized with current main using a normal merge; exact branch tree and source blobs remained unchanged. PR diff excludes the already squash-merged Phase3/4 work.

## Testing evidence

- Isolated delivery branch: 3 suites /56 tests PASS, no skips; lint, Education scoped TypeScript and secret/log guard exit0; configured Architecture Guard actually ran.
- Isolated PostgreSQL:20/20 scenarios, synthetic rows only, exact users core schema/policies/helpers/triggers/ACL. Only frozen outside-catalog JSON literal adapted to local schema; full production catalog was not cloned.
- Production ACL transaction already executed and independently verified: client users mutations denied, both writer RPCs denied; all2673 other relation/global fingerprints unchanged. Original32-table anonymous reads96/96 denied; service reads32/32 allowed. No production business DML.
- Exact command results and production/rehearsal/review evidence are included. Three independent reviewers closed findings before production execution.
- Prior broad Education/Healthcare offline DB-dependent failures remain failures. Real Auth/browser business regression, full RBAC/RLS and Go-Live are NOT_PROVEN/NOT_READY. Current-head CI is pending and must be assessed separately.

## Migrations and deployment

Adds `20261021030000_restrict_exec_sql_client_execution.sql` and `20261021050000_contain_shared_identity_client_writes.sql`. These revoke only approved client ACLs; unexpected direct/column/inherited grants or missing identity prerequisites abort. Production ran guarded ACL artifacts, not these migrations through a history push. This PR performs no further production DB operation; do not blindly replay migration history.

Transaction failure/recovery and replay were rehearsed. Local recovery SQL restores unsafe old ACLs for proof only and is not an approved production rollback. Source is undeployed; keep existing ACL containment through any code rollback. Production Courses still exposes classroom data until the separate source fix is released. No release/Go-Live claim.

## Exception justification

None: one shared security boundary, below100 files, no protection/baseline/guard changes.
