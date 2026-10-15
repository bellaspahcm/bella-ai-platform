# Approved Core Change - AutoMove Period Read-Guard

Status: APPROVED, limited to the owner's conversation approval for the
adjustment/reversal batch following #339. This records existing authority for the
machine guard; it does not grant new authority, approve merge or certify Go-Live.

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-019",
  "status": "APPROVED",
  "pr": 340,
  "approvedCoreFiles": ["src/core/services/accounting/period-guards.ts"],
  "approver": "Repository owner via explicit conversation approval",
  "approvedDate": "2026-10-16",
  "purpose": "Add exactly one public Accounting transactional OPEN-period read-guard for owner-approved AutoMove adjustments of recognition not Finance-posted; retain SHARE locks through caller commit. Existing RPC guard remains unchanged.",
  "contractChange": true,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": true,
  "ownershipChange": false
}
-->

## Authority And Boundary

The owner approved continuing the previously HELD adjustment/reversal scope,
including accounting_periods as its source for recognition not Finance-posted
and one public Accounting read-guard locking periods in the write transaction.
Accounting retains period ownership; AutoMove consumes the public guard.

Only lockOpenAccountingPeriods and its supporting error/SQL types are additive.
It verifies current Auth identity, active accountant and active matching tenant;
requires exactly one OPEN period for each source/current UTC date; holds ordered
row SHARE locks. It does not begin/commit transactions, create/reopen periods,
change grants, alter the existing assertOpenAccountingPeriod RPC guard or access
Finance internals. No frozen Healthcare/Logistics kernel change.

## Verification And Rollback

The existing business-chain checkpoint contains executed evidence: 33 Real DB
assertions including concurrent period-close blocking, 72 focused tests, actual
Next.js Browser E2E, strict typecheck and Architecture Guard. Core Freeze must
match this exact single-file set and PR #340. No wildcard or guard weakening.

If rejected, revert the scoped PR/code; no migration or production data rollback
is needed. Production DB/config, deploy and merge remain unauthorized here.
