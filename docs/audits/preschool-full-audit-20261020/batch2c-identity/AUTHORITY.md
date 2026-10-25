# Identity scope expansion — owner approved 2026-10-21

Owner replied `approve` to the concrete request to extend scope to exactly `public.users` and its related shared user writers, as prepared in `../batch2b/SHARED_IDENTITY_NEXT_CHANGE.md`. This supplements the approved32-table and one-RPC boundaries; it does not authorize a wider Preschool/Platform refactor.

Authorized: fresh metadata/consumer checks; fail-closed direct users mutation ACL containment with isolated rehearsal/recovery and production postchecks; repair the related privileged writer entrypoints with validated Auth and the proven identity-management contract. Existing maintenance ACLs, SELECT/RLS and approved ordinary business semantics stay unchanged. No row repair, account reset, user provisioning, Auth claims rewrite, business-data export, Kernel change or new role matrix.

Prior Courses working diff, migrations and evidence belong to this task and are preserved. Source HEAD339c89250d87964ba8d58860a5ecdbc0bdde4956, branchcodex/preschool-full-audit-20261020. No repeated scope approval required. Commit/push/deploy authority is assessed separately from code/ACL authority; no full dirty-checkout deployment is inferred.

Workflow remains bmad-quick-dev bug/security plus bella-security-reliability; reuse unchanged governing sources and activation context. Lead owns SQL/prod/evidence; any delegated builder receives exclusive writer-code paths, reviewer read-only. New scope is one coherent identity-authority boundary, not a new Product or Kernel capability.
