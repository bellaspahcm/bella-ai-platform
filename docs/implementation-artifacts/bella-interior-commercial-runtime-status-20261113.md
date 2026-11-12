# Bella Interior Commercial — Production status

Recorded: 2026-11-13 (Asia/Ho_Chi_Minh). This is a point-in-time work record; refresh Production state before making changes.

## Completed and observed

- PR #535 merged as `b4d1c31301a9fcbd3d319a623d2cf9891d97875d`. The Production migration ledger contains BOQ revision authorization hardening version `20261112132839`.
- PR #536 merged as `30bd6c6e247c2fd299627c20f86bbbb7861f3ffe`. Its sealed-BOQ intake validation is on main.
- A Production catalog read on 2026-11-13 found all four Commercial migrations (`20261110190000`, `20261110200000`, `20261110210000`, `20261110220000`) and the BOQ revision hardening migration in the ledger.
- A local custom-format Production database archive was created on 2026-11-13: `D:\Bella-Production-Backups\commercial-2026-11-12T23-37-35-040Z\production-postgres.dump`, 47,480,242 bytes, SHA-256 `2c71b8fb7f14832a117d4ca48c9d87c4028bc5917dff0200c16d5fdfee27cdcb`. `pg_restore --list` and a full archive-to-SQL read succeeded. These checks do not prove an actual restore; PostgreSQL cluster-wide roles are not included. TLS was encrypted but server certificate chain validation did not pass on this machine.
- PR #537 proposes migration `20261112230707` to restrict execution of trigger-only functions and pin their search paths. The migration is not present in the Production ledger and has not been applied there.
- On source commit `2273ebd684ab692481cd93e15de038f171b0c051`, the zero-downtime migration check, Type Check, Architecture Gate, PR Scope, Quality and Security, Static Analysis Security Suite, Identity-Aware Baseline, Decision Engine Deploy and Real Estate CI completed successfully.
- `CI - Quality Gates` failed in run `43328726662`: its automatically triggered isolated database job could not find `public.trg_record_interior_boq_item_history()` while applying the PR migration. A Production read-only catalog query independently confirmed that this function exists on Production. The isolated database transaction rollback was not independently checked. No additional Non-Production execution was performed for this work record.

## Not yet proven or completed

- **Production backup and recovery:** the local database archive is readable. A complete restore and recovery of cluster-wide roles have not been demonstrated.
- **PR #537:** open, not merged; its required CI result is not green. Do not represent the migration as deployed until the Production ledger and function privileges have been checked after an authorized deployment.
- **BOQ revision authorization:** anonymous access to the hardened fork wrapper and internal atomic helper was denied by privilege inspection. Real authenticated allow/deny cases for correct tenant and actor, wrong tenant or actor, and missing project permissions, plus an actual valid fork, remain to be demonstrated.
- **Commercial Production E2E:** customer approval, signed contract lineage, immutable baseline, duplicate approval and payment, tenant isolation, finance outbox and financial reconciliation have not been demonstrated end to end using authorized real business records. Prior read-only inspection found missing approval and payment evidence and inconsistent existing contract/milestone data; do not fabricate approvals, receipts or customer signatures to fill those gaps.
- **Application gaps:** contract writes and production-order endpoints currently return persistence-unavailable responses. The customer approval transition, quotation and contract state changes, payment aggregation and outbox publication require an atomic authorized production path. The existing legacy services can mark quotations accepted and contracts signed before customer evidence exists; those paths need correction and verification before use.
- **Manufacturing intake:** the validation contract exists, but the Platform Manufacturing adapter currently fails closed without canonical Manufacturing actor, factory scope and persisted BOM. Actual ProductionOrder creation, immutable lineage and concurrent idempotency remain unproven. Do not substitute the legacy Interior tracking table for the Platform Manufacturing order contract.
- **Operational journey and Go-Live:** Sales through Warranty and Finance, real user authorization, persisted read-back and owner acceptance are incomplete. Go-Live is not established.

## Next actions

1. Establish and verify a recovery procedure for the local archive, including cluster-wide roles, before relying on it for Production DDL or data repair.
2. Resolve PR #537's required check using a route consistent with the Production-only testing instruction. Validate the migration against the actual Production schema and, after authorized deployment, audit its ledger entry and role privileges.
3. Implement the missing Commercial persistence and authorization paths without changing the approved UI. Tie state transitions to real customer evidence and commit related changes atomically with their outbox events.
4. Use authorized real records and actors to verify the Commercial chain and denial cases on Production. Reconcile existing inconsistencies only with their authoritative evidence.
5. Resolve canonical Manufacturing actor, factory and BOM inputs, then verify a single idempotent ProductionOrder with the exact signed lineage. Complete the downstream journey and evaluate Go-Live against recorded evidence.
