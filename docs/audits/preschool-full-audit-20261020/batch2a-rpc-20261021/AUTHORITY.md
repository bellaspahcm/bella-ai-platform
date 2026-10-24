# Owner authority and bounded execution

On 2026-10-21 (Asia/Saigon), the owner replied `aprove` to the preceding request for separate authority over the EXECUTE boundary of `public.exec_sql(text)`. This supplements, and does not replace, the original production authorization for the exact 32 relations in `../batch1/reviewed-scope.json`.

Target: Supabase `lvnvkpyxtuilhrabtlwv`. Source: `339c89250d87964ba8d58860a5ecdbc0bdde4956`, branch `codex/preschool-full-audit-20261020`.

Authorized result: remove effective anonymous execution of that one RPC, then remove direct anonymous table privileges on the approved 32 relations after successful isolated rehearsal and current target/drift checks. Preserve non-anonymous table ACLs, policies, function bodies, role memberships, schema/default ACLs, business data and frozen Kernel code. Existing non-anonymous effective RPC privileges must be checked when replacing its PUBLIC grant. Any new unaccounted anonymous privileged path remains a stop condition.

This is ACL containment, not authenticated RBAC/RLS remediation or Product Go-Live. No commit, push or PR is authorized by this execution instruction.

Recovery evidence is the complete scoped ACL/catalog snapshot plus actual isolated restore/recovery verification. No production business data export is required or authorized for this ACL-only change. Full disaster recovery remains a separate unproven gate.
