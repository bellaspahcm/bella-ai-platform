# Architecture Gate Result - Manufacturing Production Plan MVP

Date: 2026-10-11
Baseline: origin/main@840ba3835bae57ee25305701e5ca98f64dd69730
Status: PASS

## Problem / Non-goals

Bella Manufacturing has proven the core execution chain, operational UI/API surface and HTTP authorization for the current scope. The remaining operational gap approved for this batch is a minimal plan-to-order capability:

- record demand-backed or manual production plans;
- calculate material readiness from approved BOM and the public Logistics availability contract;
- schedule the plan by Work Center/day/shift against an approved routing;
- require approval before linking the plan to an existing Production Order flow.

This scope does not change Production Order lifecycle semantics. It does not add Finance posting, costing/WIP, Factory EIP analytics, MES/IoT, optimizer, procurement workflow, Logistics stock mutation, ProductRegistry changes or Go-Live claims.

## Truth And Source Of Truth

Truth:

- Manufacturing owns Production Order, BOM, routing, work center, operation progress, quality evidence, completion and operational planning state.
- Logistics owns stock, availability and stock mutation. Manufacturing may read material availability through the existing public availability contract only.
- Production Order release/completion semantics are already sealed and must not be weakened by planning.
- A plan is not a Production Order. An approved plan may create/link a Production Order through the existing Manufacturing service boundary.

Source of truth:

- `src/platform/manufacturing/domain/types.ts` for current Manufacturing domain contracts.
- `src/platform/manufacturing/manufacturing-slice1.service.ts` for current service lifecycle and idempotency pattern.
- `src/platform/manufacturing/ports.ts` for public repository, authorization and Logistics availability boundary.
- `supabase/migrations/20261010010000_create_manufacturing_slice1_foundation.sql` and `supabase/migrations/20261011010000_create_manufacturing_routing_progress.sql` for current schema/RLS.
- The approved business semantic contract in this conversation for demand source, scheduling, material readiness, approval and plan-to-order boundary.

## Product Manifest

Capability: Manufacturing OS - Production Plan MVP.

Included capabilities:

- `ProductionPlan`
- `ProductionPlanScheduleSlot`
- material readiness calculation for a plan using BOM and Logistics availability;
- plan approval state machine;
- approved plan to Production Order link;
- API authorization and browser/API E2E for the public operational route.

Excluded capabilities:

- ProductRegistry changes;
- direct Logistics writes or reservations;
- Finance/Costing/WIP;
- Factory EIP analytics;
- MES/IoT;
- optimizer or detailed capacity planning;
- automatic procurement.

## Ownership Map

| Data / behavior | Owner |
| --- | --- |
| ProductionPlan and approval state | Manufacturing |
| ProductionPlanScheduleSlot | Manufacturing |
| BOM Revision and components | Manufacturing |
| Work Center and Routing Revision | Manufacturing |
| Material availability read | Logistics public contract |
| Inventory stock mutation and reservation | Logistics |
| Production Order lifecycle semantics | Manufacturing existing sealed contract |
| Finance posting, WIP and variance | Finance / out of scope |
| Product route identity | Existing ProductRegistry / out of scope |

## Contract Dependency Map

Manufacturing Production Plan -> Manufacturing BOM -> Material requirement calculation.

Manufacturing Production Plan -> public Logistics availability contract -> readiness status.

Manufacturing Production Plan -> Manufacturing Routing/Work Center -> schedule slots.

Manufacturing Production Plan -> existing Manufacturing Production Order service -> linked Production Order.

No direct Logistics table access is authorized. No Finance ledger or accounting outbox integration is authorized.

## Change Authority

Authorized:

- Manufacturing domain types, service, repositories and tests.
- Manufacturing-owned additive migration for production plans and schedule slots.
- Existing `/api/manufacturing/operational-readiness` route actions for the approved Manufacturing capability.
- Minimal dashboard/API E2E updates needed to prove the approved workflow.

Not authorized:

- Logistics kernel or stock mutation changes.
- Production Order lifecycle semantic changes.
- Finance, ProductRegistry, Factory EIP, MES/IoT, optimizer, procurement or Go-Live changes.

## UI -> Contract Reconciliation

The existing Manufacturing dashboard already calls `/api/manufacturing/operational-readiness`. Any UI additions must surface only the new Manufacturing plan actions and read the snapshot returned by the service. UI must not calculate readiness, approve plans, create Production Orders directly or infer authorization locally.

## Minimal Implementation Plan

1. Add Manufacturing domain contracts for `ProductionPlan`, `ProductionPlanScheduleSlot` and plan commands.
2. Add repository persistence and RLS for the two Manufacturing-owned tables.
3. Implement service methods:
   - create or update plan with source reference;
   - calculate material readiness through approved BOM and Logistics availability;
   - schedule slots by approved routing/work center/day/shift;
   - submit and approve plan with authorization;
   - release approved plan by creating/linking a Production Order through the existing service boundary.
4. Preserve Production Order release/completion behavior. Plan release links to a Production Order; it does not bypass material release rules.
5. Add API actions and tests for auth, tenant/factory isolation, idempotency, readiness, schedule conflict and approved-plan amendment behavior.

## Additive Migration Plan

Create only Manufacturing-owned tables:

- `public.manufacturing_production_plans`
- `public.manufacturing_production_plan_schedule_slots`

Use existing `public.manufacturing_command_idempotency` for command duplicate defense. Store plan material readiness summary and requirement details on the plan record to avoid a third table unless later evidence proves a separate table is needed.

RLS must reuse `public.manufacturing_factory_access_allowed`.

## 11 Automated Verification Gates Plan

1. Manufacturing service unit tests.
2. Production plan migration tests.
3. Real Database Manufacturing E2E for persistence, RLS, material readiness, approval and plan-to-order link.
4. HTTP API authorization E2E through `/api/manufacturing/operational-readiness`.
5. Browser/API E2E for the operational surface.
6. Full operational chain regression.
7. TypeScript.
8. Architecture guard.
9. Security/no-new-any check.
10. `git diff --check`.
11. CI scope-router regression if test routing changes.

## Gate Verdict

PASS for Manufacturing Production Plan MVP implementation inside the boundaries above.

Stop boundary: seal only the Production Plan MVP. Do not claim Planning/MRP-lite completeness, Factory EIP readiness, Finance readiness, full Manufacturing Go-Live or reusable OS completeness from this scope alone.
