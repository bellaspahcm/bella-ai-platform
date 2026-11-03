# ADR-2026-025 — Finance F2 Additive v1-to-v2 Bridge

**Date:** 2026-11-03  
**Status:** ACCEPTED — LOCAL/TEST ONLY  
**Decision owner:** Project owner / Human Architect.  
**Related ACR:** [ACR-2026-025](../acr/ACR-2026-025-finance-f2-additive-v1-v2-bridge.md).

## Context

The frozen F1 baseline emits posted.v1 and reversed.v1 events. F2's frozen contract consumes v2 events. Replacing F1 functions to emit v2 would violate the F1 freeze. Admission needs F1, F2 cash projection, F3 allocation, Education activation, and Admission idempotency to commit in one PostgreSQL transaction.

Source migrations show both F1 functions insert their v1 outbox event after the relevant F1 headers, lines, and audit statements. The saved pre-F2 disposable catalog snapshot matches both source function bodies and records the F1 owner/security/ACL. The latest live refresh was unavailable, so repeat the catalog snapshot at the start of any approved Local/Test implementation.

## Decision proposed

Add one F2 compatibility trigger for the two v1 event types and one F2-owned projection command over the persisted v2 event. The outer Admission SQL function calls the command inside its transaction. The post-commit worker calls the same command for replay. No sequential PostgREST projection calls are allowed.

The command’s shared signature is:

    public.finance_f2_project_v2_event(p_tenant_id uuid, p_event_id uuid) RETURNS jsonb

The trigger is:

    public.finance_f2_emit_v2_from_f1_v1() RETURNS trigger

It runs AFTER INSERT on public.finance_outbox_events and handles only posted.v1 and reversed.v1. All other event types, including v2, return immediately.

## Required behavior

- Preserve both F1 function definitions, owner, SECURITY DEFINER state, ACL, effective EXECUTE, and v1 event/payload exactly.
- Use canonical F1 headers/lines to derive and validate tenant, transaction identity, and candidate legs; never accept caller-supplied legs or bank mapping.
- Enforce unique v2 semantic identity by tenant, event type, and v2 transaction_id. Same identity and same canonical payload reuses the event ID; changed payload conflicts.
- Use the persisted v2 event ID as the posted projection base; use REV- plus event ID for reversals. Both worker and synchronous path consume the same stored candidate array and deterministic order. Existing movement is a no-op only when its financial fields and lineage match.
- Require exactly one active tenant-linked bank mapping with matching currency.
- Reversal must have exactly one original F1 line and movement match; preserve original movement ID as source lineage. Missing or ambiguous lineage fails closed.
- Any failure in the Admission outer transaction rolls back F1/v1 event, F2/v2 event and cash position, F3 allocation, Education activation, and Admission idempotency together.

## Security and freeze exception

- Trigger function is SECURITY INVOKER with fixed search_path pg_catalog, public and schema-qualified references. It receives no client EXECUTE grant.
- Projection command is SECURITY DEFINER, owned by postgres, with fixed search_path pg_catalog, public and schema-qualified references. Revoke from PUBLIC, anon, and authenticated; grant only to service_role. The outer Admission function may invoke as postgres owner. If the live catalog does not confirm that context, stop rather than add another grant.
- F2_FREEZE.md is the authoritative F2 freeze record. No new manifest or guard is proposed. After this ACR/ADR receives owner approval for Local/Test, record the exact artifact exception and final seal in F2_FREEZE.md. Do not modify F2_CONTRACT.md or any F1 artifact.
- Exact implementation artifacts are listed in ACR-2026-025. No Admission service/route, other Finance consumer, production object, or unrelated control surface is included.

## One Local/Test verification batch

After explicit owner confirmation, use only the disposable stack. Refresh its identity and F1 catalog snapshot, then verify:

1. F1 definitions, owners, security mode, ACL, effective privileges, and v1 events remain unchanged.
2. Admission succeeds atomically; forced failure at each persistence boundary leaves no partial F1/F2/F3/Education/Admission state.
3. Cross-tenant access is denied.
4. Retry, payload conflict, synchronous projection, worker replay, and concurrent replay obey the same idempotency result and create one movement.
5. Reversal preserves exact movement lineage; missing/ambiguous lineage creates no reversal movement.

This is not Production authorization and does not resolve F01 fee, discount, billing-period, pre-service accounting, or recognition-continuation questions.

## Decision record

**Owner direction:** simplify F2 to an exact, additive Local/Test exception; no separate manifest framework.  
**Final owner confirmation:** approved 2026-11-03 for the exact ACR-2026-025 artifact list.  
**F2 freeze exception:** approved; implementation candidate recorded in F2_FREEZE.md.  
**Implementation window:** authorized for disposable Local/Test only; DB apply and re-seal remain pending acceptance evidence.  
**F01:** HELD — FAIL-CLOSED.  
**Production, commit, push, merge, and deploy:** not authorized.
