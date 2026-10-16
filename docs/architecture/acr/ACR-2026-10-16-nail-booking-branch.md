# Nail booking branch correction — authorized Core boundary

Status: APPROVED by user in current conversation ("duyệt"), 2026-10-16.
Implementation and draft-PR delivery are authorized, including automatic Vercel Preview. No merge, Production deployment or Go-Live approval.

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-10-16-NAIL-BOOKING-BRANCH",
  "status": "APPROVED",
  "pr": "342",
  "approvedCoreFiles": [
    "src/core/services/order/create-booking-action.ts",
    "src/core/services/order/create-booking-helpers.ts",
    "src/core/services/order/haircut-branch-context.ts"
  ],
  "approver": "Human user in current conversation",
  "approvedDate": "2026-10-16",
  "purpose": "Require explicit authorized Nail booking branch and reject cross-branch or inconsistent draft reuse before mutation, using existing permission action and preserving Haircut behavior.",
  "contractChange": true,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

PR binding: #342. The user explicitly authorized commit/push, opening this draft PR and automatic Vercel Preview in the current conversation. This replaces the local-only binding; merge and Production deployment remain NOT_AUTHORIZED.

Root cause: booking branch resolution applies only to Haircut. Nail falls through with null branch while the modal omits the sidebar selection. The approved invariant requires explicit valid Nail branch input and existing server authorization before mutation. Reuse selector/IAM contracts and canonical schema; retain Haircut behavior. See root `ARCHITECTURE_GATE_RESULT.md`.

Follow-up authority: user's 2026-10-16 P1/P2 correction scope covers the existing draft lookup/upsert boundary and shared UI selection. The original sealed one-Core-file scope is preserved in the previous evidence package; this updated list describes the current correction only. No kernel, schema, auth policy or deployment authority is added.
