# ACR — Canonical tenant provider integration, PR418

Status: APPROVED for the exact one-file integration below by the human task owner in this conversation on 2026-10-23. This records that explicit decision; it does not claim an AI reviewer has human architecture authority or approve delivery beyond the separately granted draft PR/CI/Non-Production preview scope.

Human decision: “Duyệt tích hợp đúng provider và kiểm thử Non-Production”. Approved original worktree file SHA256: `05843ca3efe02dc8ce7faf72f9103d927c2b2729b76202448dfbae2870d542bf`.

Problem: the integration candidate included canonical tenant presentation helpers/tests but omitted the corresponding provider implementation from the preserved source worktree. The old provider fabricates `dev-tenant` after failures and derives presentation from routes/module flags. Actual CI exposed the mismatch. It also allowed a local browser to proceed through fallback context, which cannot prove a verified tenant UI chain.

Decision: integrate exactly `src/core/providers/TenantContextProvider.tsx` from the preserved worktree. It consumes the existing `/api/tenant/context` response and canonical Product presentation helpers; stays neutral while loading; rejects malformed/null settings; fails closed on loading errors; aborts obsolete requests; does not fabricate tenant identity. No API/RPC/domain contract, ownership, authentication, permissions, grants/RLS, schema, Kernel, default privileges or workflow changes are approved by this record.

Verification: unchanged canonical tenant-theme assertions, related shell tests adjusted to the approved fail-closed contract, strict TypeScript, ESLint and actual verified-context browser recovery on the designated E2E. Tests are separate from permission/Production evidence. Core gate approval is exact-file-bound; no wildcard or entire-directory unlock.

Rollback: revert this provider integration through a reviewed follow-up if necessary; preserve source/evidence/history. The old fallback must not be represented as proof of trusted identity. No DB rollback applies because no DB change is included.

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-PRESCHOOL-418-CANONICAL-TENANT-PROVIDER-20261023",
  "status": "APPROVED",
  "approver": "Human task owner, explicit approval recorded in the Codex conversation",
  "approvedDate": "2026-10-23",
  "pr": 418,
  "purpose": "Integrate the exact previously implemented canonical tenant UI provider; remove fabricated development tenant fallback without changing server authority",
  "approvedCoreFiles": ["src/core/providers/TenantContextProvider.tsx"],
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->
