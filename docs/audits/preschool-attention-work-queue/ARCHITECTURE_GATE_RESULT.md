# Preschool attention work queue — Architecture Gate

2026-10-19. Baseline: `3ec04c91fd5bf2c67d523e3a65ee559ba978c1e3`. Scope: existing Preschool Overview alerts → actual tenant records → persisted operator outcome.

## Truth, authority and process

The user explicitly requests functioning student leave review and equivalent health/parent alert workspaces, permits DB persistence when necessary, and selected **only save approval/rejection; do not change attendance**. This is the independent authority for the new leave-review outcome. Other workflows retain their existing public semantics: P6 CommunicationExceptionService resolves an exception with operator/time/notes; P4 IIncidentSafetyContract closes incidents and requires existing parent acknowledgement for escalation-required cases. The source audit and read-only DB/API comparison verified persisted 2 absence requests, 2 incidents and 4 parent requests, all matching seed definitions. Seed rows establish existing data shape, not intended approval/medical semantics.

## Manifest, ownership, contracts

- Existing `bella_preschool` Product. No new OS, Kernel capability, registry or entity.
- P6 owns `edu_comm_exceptions` and request resolution. P4 owns `edu_health_incidents` and incident closure. Existing Students/Party read models provide labels. Platform owns authenticated active actor/tenant; unchanged.
- UI → new Product HTTP adapter → Product request-review / incident public service → tenant-scoped Product persistence. No browser DB writes or Healthcare/Logistics/Finance Kernel access.
- Existing P6 repository lacks grouped pagination/count and compare-and-set review operations. A narrow typed Product persistence port is justified by these missing operations; its server adapter belongs at the HTTP delivery/infrastructure boundary, following the existing Finance API adapter pattern. Product business services consume the port and never import the DB client or HTTP adapter. The Education guard has pre-existing direct-query debt; add no new direct Product-layer query sites or dynamic-name bypasses. This is dependency inversion for Product-owned storage, not a Kernel extension.
- `OPEN → RESOLVED` remains the P6 queue status. A versioned review receipt in the existing free-form `resolution_notes` stores user-authorized APPROVED/DECLINED outcome, reviewer note and original request text; authoritative actor/time remain existing DB fields. This is a Product-local notes format, not a new shared entity/state. Preserve arbitrary legacy notes on reads. Use conditional tenant/id/status update so simultaneous reviewers cannot overwrite a completed review.
- Health closure reuses `IIncidentSafetyContract.closeIncident`; do not invent acknowledgements, notification delivery or medical authorization. Escalation-required rows without persisted acknowledgement remain blocked. Closing is a queue action, not medical treatment.
- Queue callers may pass an additive optional expected-status precondition to the Product incident command to reject concurrent closure without changing existing callers' default closure semantics. Preserve closure of supported legacy states and all acknowledgement rules; no shared/Kernel contract change.
- Independent review adds a required displayed-row revision in decision commands, checked before the current server snapshot/CAS. An ambiguous POST/readback/enrichment failure retains the draft and requires reload without asserting that no commit occurred. Non-test storage requires the already-established server admin environment after canonical actor/tenant/product authorization; missing configuration is unavailable (503), never a successful empty session/RLS fallback. No RLS bypass or authorization fallback is introduced.
- Parent resolution only records operator outcome; it does not administer medication, grant pickup rights, enroll a club, send a message, or alter financial truth. Financial exceptions retain navigation to Finance.

## UI reconciliation and authority

| Element | Result | Reconciliation |
|---|---|---|
| Leave alert to Care | STALE UI | Link to absence queue; approve/decline receipt with original content retained |
| Health alert to daily-care roster | MAPPING BUG | Link to actual incidents; inspect and close through existing safety contract |
| Parent alert to sample chat | MAPPING BUG | Link to actual exception queue; record resolution notes |
| Overdue tuition | MATCH after pending repair | Keep supported Finance `tab=debts` deep link |
| Fixed fallback attention counts/realtime caption | STALE UI | Unknown/loading is explicit; no static attention counts or realtime claim |

Authorized: new Product adapters/services/UI and scoped tests; minimal analytics read-error handling and attention links/copy. No automatic approval, background mutation, source-row cleanup, production seed execution, auth/RLS widening, Platform/Core change, medical workflow, attendance or finance side effect. New adapter initially restricts to existing active admin → PRINCIPAL mapping and existing Staff Work Queue guard; no new role grants. Product identity must be `bella_preschool`. Never accept tenant/actor identity from request payload. Existing primary checkout edits are preserved; delivery is isolated in the managed worktree.

## Migration and verification

No migration: existing Product-owned notes/status/resolver/time columns suffice. No source fixtures will be approved/closed for testing. Negative tests must cover missing/foreign identity, wrong role/product, wrong kind, invalid input, already processed/stale update and failed DB read/write. UI tests cover deep-link group, actual names/details, saved readback, declined/approved outcomes, failure/draft retention and empty/loading states. Verify focused typecheck/lint, source scope, Architecture Guard, existing Finance regression and required Healthcare verification; distinguish mocked execution, live read proof and unexecuted live writes/browser proof. Eleven gates: ownership, contracts, actor, tenant, product, payload, status concurrency, persistence/readback, incident invariant, UI semantics, diagnostics/scope. No Go-Live/RLS/security PASS inferred from mock tests.

**PASS** to implement within this boundary. User-owned business choice is resolved; no Kernel gap identified. Runtime DB mutation proof and browser proof remain separate verification obligations.
