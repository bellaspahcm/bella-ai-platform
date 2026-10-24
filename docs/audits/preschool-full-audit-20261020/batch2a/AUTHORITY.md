# Production anonymous containment — owner authorized

Owner instruction on 2026-10-20 explicitly authorizes bounded production remediation of exactly the32 tables in `batch1/reviewed-scope.json`, after drift checks, isolated rehearsal and recovery verification. It supersedes the prior approval-pending status for this scope. No additional scope-approval round is required.

Target: Supabase `lvnvkpyxtuilhrabtlwv`. Source branch: `codex/preschool-full-audit-20261020`; starting HEAD `339c89250d87964ba8d58860a5ecdbc0bdde4956`.

Allowed production delta: remove direct anon privileges on the exact allowlist. Preserve authenticated/service_role ACL, memberships, schema/default ACL, policies, helper definitions, business rows and frozen kernels. Isolated schema prerequisites are authorized for rehearsal without copying production data or blindly applying history. Preserve original audit/Batch1 evidence.

Execution gates: exact target/source; current baseline equality; account for relevant grants/column ACL/membership/dependencies; independent isolated PostgreSQL rehearsal with transactional failure/recovery checks; actual before/after anon and non-anon verification. Stop production on failed prerequisites, unknown access paths, drift or unrecoverable scope.

Courses API's known service-role path is separate from direct anon table permissions. Recheck it and report its observed result; no API/code change is authorized by the32-table ACL instruction. Do not label all anonymous application access closed if the API still returns data.

Final status fields: PRODUCTION_CHANGE, ANONYMOUS_CONTAINMENT, AUTHENTICATED_ACCESS_REGRESSION, BATCH2B_RBAC_RLS, PRESCHOOL_GO_LIVE. A SQL exit0 alone is insufficient.
