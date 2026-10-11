# Architecture Gate Result - Manufacturing Lot Genealogy

Date: 2026-10-11
Baseline: origin/main@96789280e9ea585aaa2f996e3e460a4ea143c20f
Status: PASS

## Problem / Non-goals

Bella Manufacturing has a sealed operational chain from material issue through production execution, FGR, quality disposition, routing progress and completion. The remaining gap is traceability:

- Finished-good lot -> Production Order Line -> Production Execution -> consumed material lot.
- Raw-material lot -> affected Production Orders -> related finished-good lots.

This scope does not add UI/API, ProductRegistry, Factory EIP analytics, Planning/Scheduling, Finance posting, WIP/costing, stock mutation or Logistics kernel changes.

## Truth And Source Of Truth

Truth:

- Manufacturing owns Production Order, Production Execution, FGR evidence, Quality Disposition, completion and routing progress state.
- Logistics owns stock mutation, inventory movement, ledger and traceability events.
- Lot genealogy must be derived from verified Manufacturing evidence bound to public Logistics Stock-Out/Stock-In evidence, not from matching lot numbers alone.

Source of truth:

- Manufacturing persistence for order/execution/completion relationships.
- Public Logistics Stock-Out/Stock-In read-back evidence already used by Manufacturing evidence binding.
- Existing Real DB full-chain tests proving invalid, cross-tenant and mismatched Logistics references are rejected before execution/completion.

## Ownership Map

| Data / behavior | Owner |
| --- | --- |
| Production Order, line, execution, completion | Manufacturing |
| Persisted Manufacturing evidence references | Manufacturing |
| Inventory stock mutation, movement, traceability event | Logistics |
| Finance posting, WIP, variance | Finance |
| Factory EIP read model | Not in scope |

## Contract Dependency Map

Manufacturing -> public Logistics Stock-Out contract -> material issue evidence.

Manufacturing -> public Logistics Stock-In contract -> FGR evidence.

Manufacturing must not read or write Logistics tables directly. It may persist the verified evidence needed to reconstruct the genealogy chain inside Manufacturing-owned records.

## Change Authority

Authorized:

- Manufacturing domain/service/repository/types/tests.
- Manufacturing-owned additive migration for persisted evidence required to make genealogy durable.
- Architecture gate evidence for this capability.

Not authorized:

- Logistics kernel or schema changes.
- Finance, ProductRegistry, UI/API, Factory EIP analytics or Go-Live changes.

## Minimal Implementation Plan

1. Persist the already-verified material issue Logistics evidence on Production Execution.
2. Preserve lot/serial details on material issue and finished-good receipt evidence.
3. Add read-only genealogy service methods:
   - trace finished-good lot to material issue lots.
   - trace raw-material lot to affected orders and FGR lots.
4. Use Manufacturing-owned relationships and persisted public Logistics evidence. Do not create a separate genealogy table.
5. Verify with unit and Real DB tests, including invalid/cross-tenant/mismatched evidence already enforced by the sealed chain.

## Additive Migration Plan

Add nullable `material_issue_evidence JSONB` to `public.manufacturing_production_executions`, with object-shape check and supporting indexes for lot/item lookup. Nullable preserves existing rows; new runtime records persist evidence.

No Logistics, Finance, ProductRegistry or UI migration.

## Verification Plan

- Manufacturing service tests for trace finished-good lot and raw-material lot.
- Manufacturing migration tests for the additive evidence column and no out-of-scope tables.
- Real DB full-chain test for bidirectional lot genealogy using actual Logistics Stock-Out/Stock-In evidence.
- Existing full-chain regression.
- TypeScript.
- Architecture guard / Logistics regression if touched by guard scope.
- `git diff --check`.

## Gate Verdict

PASS for minimal Manufacturing-owned Lot Genealogy read model.

Stop boundary: seal only this read model; do not claim Factory EIP, Planning/Scheduling, costing/WIP or Go-Live readiness.
