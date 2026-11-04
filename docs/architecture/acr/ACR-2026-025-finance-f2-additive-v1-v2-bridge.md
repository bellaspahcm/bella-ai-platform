# ACR-2026-025 — Finance F2 Additive v1-to-v2 Bridge

**Date:** 2026-11-03  
**Status:** APPROVED — LOCAL/TEST IMPLEMENTATION  
**Scope:** Disposable Local/Test only. Owner approval confirmed 2026-11-03.  
**Related ADR:** [ADR-2026-025](../adr/ADR-2026-025-finance-f2-additive-v1-v2-bridge.md).

## Purpose

Enable Preschool Admission to project cash and allocate payment within one PostgreSQL transaction while leaving the frozen F1 ledger unchanged. This ACR covers only the F2 v1-to-v2 bridge, its shared projection command, and the worker route through that command.

This proposal does not complete F01. Fee/discount source, billing period, pre-service accounting treatment, and TuitionRecognitionService continuation remain separate F01 conditions.

## Exact F2 freeze exception proposed

On owner approval for Local/Test, only these artifacts may change:

1. New additive migration: supabase/migrations/<new>_finance_f2_v1_v2_compatibility_bridge.sql
   - Add trigger function public.finance_f2_emit_v2_from_f1_v1() RETURNS trigger.
   - Add finance_f2_v1_outbox_bridge_after_insert, an AFTER INSERT trigger on public.finance_outbox_events.
   - Add command public.finance_f2_project_v2_event(p_tenant_id uuid, p_event_id uuid) RETURNS jsonb.
   - Add partial unique index uq_finance_outbox_f2_v2_semantic_identity for v2 event identity.
2. Route src/platform/finance/engines/cash-engine/cash-projection-worker.ts through the same projection command. Remove its independent mapping/projection path and first-match reversal association.
3. Update src/types/database.types.ts only if required to type the new SQL command.
4. Add one focused Local/Test integration suite for the acceptance conditions below.
5. Update docs/architecture/frozen/F2_FREEZE.md with this exact exception and the final re-seal result. Do not change F2_CONTRACT.md: the SQL command is internal and no public Finance API changes.

This is the complete implementation list. No Admission service/route, F1 RPC, other Finance consumer, Finance manifest, architecture guard, or new service is in scope. ACR-2026-024 continues to own the outer Admission SQL command.

### Freeze control

F2_FREEZE.md is the authoritative F2 freeze record and requires Human Architect review plus an ADR for changes. The generic root manifest named by FREEZE_POLICY.md is absent, and the current architecture guard does not register F2. Do not build a manifest/unlock framework. The approved ACR/ADR plus the exact exception recorded in F2_FREEZE.md is the manual, artifact-scoped F2 change-control for this batch. Owner confirmation for the Local/Test scope was recorded 2026-11-03; implementation is authorized only within the listed artifacts and disposable Local/Test target.

## Required invariants

### 1. Protect F1

- Do not change either F1 RPC definition, signature, owner, SECURITY DEFINER, ACL, effective EXECUTE, or v1 outbox event/payload.
- Before and after the bridge, compare full catalog definitions, owner/security metadata, ACL, and effective EXECUTE. They must match.
- The saved disposable pre-F2 snapshot shows both F1 RPCs owned by postgres, SECURITY DEFINER, with ACL {=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}. Anon currently inherits EXECUTE from PUBLIC. Preserve this existing finding; do not fix it here.

### 2. Keep Admission atomic

The outer Admission SQL function is the only PostgREST request. In one PostgreSQL transaction it must:

1. Validate actor, tenant, pending Enrollment, and Admission idempotency.
2. Execute the existing F1 posting command.
3. Let the F2 trigger create or reuse the v2 event.
4. Call finance_f2_project_v2_event as a nested SQL function.
5. Perform F3 allocation, Education pending-to-active transition, and persist the Admission idempotency result.
6. Commit once; report success only after commit.

Any failure must leave no durable F1 header/lines/audit/v1 event, F2 v2 event/movement/position update, F3 allocation, Education activation, or Admission idempotency result.

### 3. Share event identity and reject ambiguous writes

- The trigger handles only finance.transaction.posted.v1 and finance.transaction.reversed.v1; all other types, including v2, return immediately. It validates payload tenant and transaction IDs against canonical F1 rows. F1 v1 event IDs are separate outbox columns, not payload fields.
- V2 semantic identity is (tenant_id, event_type, payload.transaction_id). For reversal, transaction_id is the reversal F1 transaction ID and reversal_of_transaction_id is the original. First creation generates one v2 event ID and stores it in both the event_id column and payload. Same identity and same canonical payload reuses that row and ID; different payload raises a conflict. A unique index arbitrates concurrent creation.
- Both synchronous Admission and the post-commit worker call finance_f2_project_v2_event for the persisted event. Posted base idempotency key is event_id; reversal base is REV- plus event_id. The existing projector appends the zero-based persisted leg index and direction. Both callers use the same persisted leg order.
- Before treating an existing movement as a replay no-op, compare its tenant, F1 transaction, bank mapping, leg reference, direction, amounts/currencies, valuation, and source lineage. A same-key/different-payload retry is a conflict, not success.
- Resolve exactly one active bank mapping for the tenant and linked Finance account, with matching currency. Missing, multiple, inactive, cross-tenant, or currency-mismatched mappings fail closed.
- Reversal must map each reversal line to exactly one original line by the canonical accounting tuple after debit/credit swap, then link to exactly one original cash movement. Preserve the original movement ID as reversal source lineage. Missing or ambiguous matches fail closed; do not use first-match behavior.

### Function execution rights

- Trigger function: SECURITY INVOKER, fixed search_path = pg_catalog, public, schema-qualified references, no client EXECUTE. It runs only from the outbox trigger in the F1 definer context. If that context cannot perform required canonical reads and the F2 insert without changing F1 rights, stop.
- Projection command: SECURITY DEFINER, owner postgres, fixed search_path = pg_catalog, public, schema-qualified references. Revoke EXECUTE from PUBLIC, anon, and authenticated; grant only to service_role. The outer Admission function must be owned by postgres to invoke as owner. If catalog evidence does not confirm this, stop rather than broaden grants.
- Verify client roles cannot insert supported v1 events directly into the shared outbox. If they can, stop and return for a separate decision; do not change table grants in this ACR.

## Evidence and current limit

The saved source/catalog snapshot from disposable stack bella-f01-f3-auth-20261103 shows exact F1 body matches to the source migrations: post body SHA-256 32D79CFEE7A21C86F62CA21A0985D7D2B479AF01B28362215659FB28975AB6CD; reversal body SHA-256 230B34FEC37BC45EFE2327710B5013F750FA6964C3EAB2D564716F23D16278BE. That snapshot reports F1 baseline only; F2/F3 were not applied.

A live catalog refresh could not be performed in the last review because Docker API access was denied, the stack ports were closed, and host psql was unavailable. Refresh target identity and the F1 snapshot at the start of the approved Local/Test batch. No trigger or command implementation exists in the current source or saved DB snapshot; their behavior is not yet proven.

Source inspection confirms F1 inserts the POSTED header, lines, and audit before the v1 posted event; reversal updates the original, writes the POSTED reversal header/lines and audit before the v1 reversed event. Verify this ordering against the live disposable catalog before applying the bridge.

## One integrated Local/Test acceptance batch

Run only after explicit owner confirmation and only against the named disposable stack:

- Prove disposable DB identity, F1 source/catalog baseline, and unchanged F1 definitions/owner/ACL/effective privileges after applying the bridge.
- Successful Admission persists F1, F2 cash movement, F3 allocation, Education activation, and idempotency result together; a forced failure at each boundary rolls all of them back.
- Cross-tenant actor/event access is denied.
- Same request and same event replay are idempotent; same key with changed payload conflicts. Synchronous projection followed by worker replay, retry, and concurrent replay create one movement; duplicate paths return no-op.
- Reversal succeeds only with exact unique original movement lineage; missing or ambiguous lineage creates no reversal movement.

Do not run the full Preschool audit or unrelated Finance consumer suites for this batch. Fix only failures in these conditions, rerun the affected part, then seal the exact F2 exception. Local/Test PASS does not imply Production approval or F01 completion.

## Decision state

- ACR-2026-025: APPROVED — LOCAL/TEST IMPLEMENTATION
- ADR-2026-025: ACCEPTED — LOCAL/TEST ONLY
- F2 exception: approved and recorded in F2_FREEZE.md; re-seal pending DB acceptance
- Local/Test implementation: AUTHORIZED within the listed artifacts
- F1: frozen and unchanged
- F01: HELD — FAIL-CLOSED
- Production, commit, push, merge, and deploy: not authorized

**Decision record:** owner confirmed the exact artifact-scoped exception and Local/Test implementation on 2026-11-03. No other review layer is requested unless implementation reveals a new risk.
