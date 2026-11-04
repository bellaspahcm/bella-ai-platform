# ADR — Preschool Admission Atomic Confirmation (ACR-2026-024)

**Status:** Accepted for the exact Local/Test implementation window; acceptance and reseal held.  
**Date:** 2026-11-02  
**Decision owner:** Project owner, acting as Human Architect.  
**Related ACR:** [ACR-2026-024](../acr/ACR-2026-024-preschool-admission-atomic-confirmation.md)

## Context

The admission endpoint is fail-closed because separate Finance and Education writes cannot prove a single successful admission. The existing Finance Platform has invoice, ledger, cash projection and receivable SQL commands, but the current TypeScript orchestration makes separate calls and its payment contract lacks the required evidence and actor audit.

## Decision

Open only the artifact scope recorded in ACR-2026-024 for Local/Test. Preschool supplies its effective fee and billing-period semantics and owns admission/idempotency. Finance Platform owns generic invoice, collection, reconciliation and financial audit facts. Education owns the pending-to-active transition. A single PostgreSQL transaction composes their public boundaries and commits the required records and audit together. Default omitted mode to `DEBT`; `PAID` requires verified evidence and reconciliation through one shared Finance capability for cash, manual bank transfer and automated bank reconciliation. Human identity comes from Auth; automation uses an identified service actor. A changed retry payload conflicts.

The Education Enrollment interface, implementation and focused test named in the ACR are unlocked only for this pending-to-active capability. Existing global freeze controls remain intact. Finance F1 Ledger artifacts are not unlocked. Existing Production tables, grants and RLS are outside this decision. No commit, push, merge or deployment is authorized.

## Rationale and alternatives

Nested Finance-owned SQL commands can potentially share the Admission transaction while preserving domain ownership. Sequential PostgREST calls and compensating writes cannot prove atomicity. Direct Product writes to Education or Finance tables bypass the ownership contracts. A second Finance OS or three independent payment writers would duplicate existing shared capability.

## Consequences and verification

The implementation must validate effective tenant fee and period data, authorize the actor and tenant at the write boundary, preserve append-only payment/audit history, and reject missing evidence. Verify actual DB function ownership and privileges, rollback at each write, idempotent replay/conflict, tenant and role denial, the three collection methods, audit actor/source and outbox replay in the approved Local/Test target. Failure to establish a prerequisite leaves the endpoint fail-closed. Local acceptance does not prove Production readiness or a full Education/Finance reseal.
