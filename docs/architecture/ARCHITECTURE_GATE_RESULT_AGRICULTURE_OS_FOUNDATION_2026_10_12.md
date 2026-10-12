# Architecture Gate Result - Agriculture OS Foundation

Date: 2026-10-12
Baseline: origin/main@a5fd4c26005a17cfe8926fd7ea27032bef7dd100
Review status: APPROVED_FOR_OS_FOUNDATION_IMPLEMENTATION
Implementation status: AUTHORIZED
Product creation: OUT_OF_SCOPE
Registry change: NOT_REQUIRED

## Objective

Establish the shared agricultural domain architecture required for future Agriculture-related Products.

Agriculture OS is an Industry OS foundation. It owns reusable agricultural business semantics, domain rules, and public contracts. Future Products consume these capabilities without duplicating domain logic or rebuilding Platform, Logistics, or Finance infrastructure.

This gate does not authorize a customer-facing Product, complete UI, ProductRegistry change, or production deployment.

## Approval Record

Approval decision: APPROVED_FOR_OS_FOUNDATION_IMPLEMENTATION.

Approval date: 2026-10-12.

Approval source: explicit user decision in the current Codex task authorizing Agriculture OS Foundation MVP implementation within the scope below.

Approved scope:

- Farm and Plot.
- Crop Cycle lifecycle and valid transitions.
- Crop Activity evidence.
- Material Usage evidence without Logistics stock-out integration.
- Harvest evidence without Logistics stock-in integration.
- Public Agriculture OS service contracts.
- Canonical persistence owned by Agriculture OS for approved domain records.
- Tenant isolation, authorization, audit evidence, idempotency, and read-back behavior.
- Focused automated verification, including Real DB/RLS evidence where executable.

Explicit exclusions:

- No Agriculture Product creation.
- No ProductRegistry change.
- No Logistics stock-out or stock-in integration.
- No Finance/accounting integration.
- No GIS, agronomy rules engine, livestock, or aquaculture.
- No duplicate Platform, Inventory, Audit, or Idempotency framework.
- No unrelated shared-kernel changes or broad refactoring.

No reviewer identity, signature, CI result, or runtime evidence is claimed by this approval record. Those items require separate proof.

## Bella OS/Product Development Process Gate

Result: PASS_FOR_APPROVED_OS_FOUNDATION_SCOPE.

Runtime implementation is authorized only for the approved Agriculture OS Foundation MVP scope recorded above.

The earlier direction of creating a `bella_agriculture` Product identity is superseded. Agriculture is currently an Industry OS foundation, not a Product identity.

## Ownership Map

| Capability | Authoritative Owner | Boundary |
| --- | --- | --- |
| Tenant, Identity, Access | Platform | Reuse existing contracts. |
| Organization Units | Platform | Reuse existing organization and access semantics. |
| Farm / Plot domain semantics | Agriculture OS | Define agricultural meaning and relationships. |
| Crop Cycle | Agriculture OS | Own crop-cycle lifecycle and transition rules. |
| Crop Activities | Agriculture OS | Own activity semantics and history. |
| Material Usage | Agriculture OS + Logistics | Agriculture owns usage meaning; Logistics owns inventory movement. |
| Harvest | Agriculture OS + Logistics | Agriculture owns harvest evidence; Logistics owns stock movement. |
| Inventory and Warehousing | Logistics | No duplicate inventory kernel. |
| Accounting and financial posting | Finance | No accounting treatment without proven semantics and authorization. |
| Audit primitives | Platform | Reuse canonical audit infrastructure. |
| Agricultural audit events | Agriculture OS | Define domain event meaning and evidence. |
| Idempotency primitives | Existing canonical infrastructure, where applicable | No duplicate infrastructure; define operation-specific semantics. |
| Product UI and workflows | Future Products | Outside current OS foundation implementation. |

Ownership must be verified against canonical source contracts before implementation.

## Proposed Public Domain Contracts

The following are approved public contract responsibilities for the foundation MVP. Runtime evidence remains separate and must be verified after implementation.

### Farm And Plot

Responsibilities:

- Represent agricultural operating areas and plots.
- Define stable identifiers, relationships, and lifecycle.
- Enforce tenant and authorized organizational boundaries.

Foundation invariant: Farm records use an authorized Platform organization unit as the access anchor. The Agriculture OS does not create a new organization hierarchy.

### Crop Cycle

Responsibilities:

- Associate a crop cycle with an authorized plot.
- Define lifecycle states and valid transitions.
- Record planting and relevant lifecycle dates.
- Preserve traceable cycle history.

Foundation invariants:

- Crop Cycles belong to one authorized Plot.
- Crop Cycles may overlap on the same Plot.
- Ordinary activity, material usage, and harvest operations require an active Crop Cycle.
- A Crop Cycle may complete without Harvest only when a valid completion disposition and reason are recorded.

### Crop Activities

Responsibilities:

- Record activities associated with a crop cycle.
- Preserve actor, time, activity type, and relevant evidence.
- Validate activity eligibility against cycle state.

Foundation invariant: Activity records preserve shared evidence fields and an activity type string. Product-specific activity taxonomies remain outside this foundation slice.

### Material Usage

Responsibilities:

- Record agricultural material usage and its business reference.
- Validate the target crop cycle, material, quantity, and authorization.
- Invoke Logistics stock-out only through an approved public contract.
- Preserve the relationship between usage evidence and any resulting inventory movement.

No direct inventory mutation or duplicated stock ledger is permitted.

### Harvest

Responsibilities:

- Record harvest events, quantities, units, source plot, and crop-cycle reference.
- Preserve harvest evidence and traceability.
- Support a future approved integration with Logistics stock-in.

The canonical relationship between harvest records and inventory receipts remains unproven. Do not introduce a new Logistics source type or modify the Logistics kernel without a separate contract decision.

### Domain Audit And Idempotency

Responsibilities:

- Preserve agricultural business history using canonical Platform audit primitives.
- Define operation-specific idempotency scope and conflict behavior.
- Support read-back verification for state-changing operations.

Do not introduce another general-purpose audit or idempotency framework.

## Data Boundaries

Agriculture OS may own agricultural domain records, subject to approved architecture:

- Farm and Plot domain records.
- Crop Cycle records.
- Crop Activity records.
- Material Usage evidence.
- Harvest evidence.
- Required command idempotency records, if no suitable canonical facility exists.

The exact schema must remain additive and limited to Agriculture OS domain records approved in this gate.

All records must respect tenant isolation and applicable organizational access rules. Cross-tenant access must be denied. Authorization must be enforced through canonical Platform boundaries rather than inferred from UI visibility.

Agriculture OS must not create duplicate tenant, user, organization-access, inventory, accounting, or general audit tables.

## Minimal OS Foundation Scope

Proposed capability sequence:

1. Establish domain ownership and canonical identifiers.
2. Define Farm / Plot semantics and authorization relationships.
3. Define Crop Cycle lifecycle and transition rules.
4. Define Crop Activity semantics and validation.
5. Define Material Usage evidence and the Logistics boundary.
6. Define Harvest evidence and the Logistics boundary.
7. Define public service contracts, audit events, idempotency, and read-back behavior.
8. Verify persistence and security using Real DB tests.
9. Seal only the capabilities supported by evidence.

UI, Product Registry changes, customer onboarding, and Product-specific workflows are excluded unless a separate decision authorizes them.

## Verification Gates

Required before sealing the relevant OS foundation scope:

- Architecture ownership and dependency-boundary tests.
- Domain invariant and lifecycle-transition tests.
- Migration safety and additive-schema review, if persistence changes are required.
- Real DB tenant-isolation and authorization tests.
- Organizational access tests where applicable.
- Idempotency duplicate and conflicting-request tests.
- Audit and state read-back evidence tests.
- Logistics public-contract tests before enabling stock movement.
- Finance contract and semantic validation only if Finance integration is separately authorized.
- Regression checks for existing Platform, Logistics, Finance, and Product contracts.

A passing unit test alone does not establish Real DB or production readiness.

## Explicit Decision States

| Item | Current Status | Required Action |
| --- | --- | --- |
| Existing Agriculture runtime | NOT_PROVEN | Implement only the approved foundation scope. |
| Agriculture domain ownership map | APPROVED_FOR_FOUNDATION_SCOPE | Preserve Platform, Logistics, Finance, and Product boundaries. |
| Farm / Plot semantics | APPROVED_FOR_FOUNDATION_SCOPE | Use Farm and Plot domain records with Platform org access anchor. |
| Crop Cycle rules | APPROVED_FOR_FOUNDATION_SCOPE | Enforce lifecycle, active-only operations, overlap allowed, and completion-without-harvest disposition. |
| Activity model | APPROVED_FOR_FOUNDATION_SCOPE | Preserve shared evidence fields and extensible activity type. |
| Material Usage to Logistics | NOT_PROVEN | Verify public contract and item/location mapping. |
| Harvest to Logistics | NOT_PROVEN | Decide canonical receipt semantics. |
| Finance treatment | DEFER | Exclude until semantics are proven. |
| Platform authorization reuse | APPROVED_FOR_FOUNDATION_SCOPE | Reuse Platform tenant and organization access boundaries. |
| Agriculture schema and runtime | AUTHORIZED_FOR_FOUNDATION_SCOPE | Keep schema additive and limited to approved Agriculture OS records. |
| Agriculture Product creation | OUT_OF_SCOPE | No Product identity work. |
| Product Registry modification | NOT_REQUIRED | Preserve current registry. |

`BLOCKED` should be used only when a specific required action cannot proceed because of an identified blocker. `NOT_PROVEN` means evidence is insufficient. `DEFER` means the decision or implementation is intentionally postponed.

## Approval Criteria

Architecture Gate may move to `APPROVED_FOR_OS_FOUNDATION_IMPLEMENTATION` only after:

1. Domain ownership and Platform/Logistics/Finance boundaries are reviewed.
2. Farm / Plot and Crop Cycle invariants are sufficiently defined for the minimal foundation.
3. Public contract responsibilities and failure behavior are explicit.
4. Security, tenant isolation, and idempotency requirements are defined.
5. Unresolved Logistics and Finance questions are either resolved or explicitly excluded from the initial implementation scope.
6. No unnecessary kernel changes or Product implementation are included.

Approval authorizes only the agreed OS foundation scope. It does not imply Product readiness or Go-Live.

## Final Gate

```ini
AGRICULTURE_OS_ARCHITECTURE = APPROVED_FOR_OS_FOUNDATION_IMPLEMENTATION
AGRICULTURE_OS_IMPLEMENTATION = AUTHORIZED
AGRICULTURE_PRODUCT_CREATION = OUT_OF_SCOPE
PRODUCT_REGISTRY_CHANGE = NOT_REQUIRED

NEXT_ACTION = IMPLEMENT_APPROVED_OS_FOUNDATION_SCOPE
STOP_CONDITION = SEAL_APPROVED_SCOPE_ONLY
```

Operating principle: Root Cause -> Minimal Fix -> Verify -> Seal -> Stop.

## Review Recommendation

Review this gate before implementation, but do not require the entire agriculture domain to be defined up front. Approve only the minimum semantics needed for the foundation. Keep unclear Logistics and Finance integrations outside the first implementation slice until their public contracts and business semantics are proven.
