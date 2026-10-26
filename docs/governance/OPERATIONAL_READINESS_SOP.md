# Bella Operational Readiness SOP v1

**Status:** ACTIVE
**Owner:** Bella Engineering Governance
**Authority:** `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
**Scope:** Read-only operational readiness audits for Bella products preparing for real customer operation, including product-to-Finance readiness when the selected workflow declares or creates financial facts.

This SOP defines how Bella evaluates whether a product can support real daily business operation. It does not replace the Bella Engineering Constitution, vertical constitutions, freeze policies, ACR/ADR processes, deployment governance, or product-specific evidence packs. Stricter rules still win.

Operational readiness work starts from the user's real business workflow. It does not start from folders, modules, diagnostics, or cleanup opportunities.

## When To Use This SOP

Use this SOP when a Bella product moves from development correctness toward operational readiness, release-candidate evaluation, customer pilot readiness, or real daily operation.

Examples:

```text
Preschool morning operation
Haircut customer booking and checkout
Nail multi-resource appointment execution
English Center enrollment-to-attendance flow
```

Do not use this SOP to justify broad refactors, architecture cleanup, product redesign, schema invention, CI automation, or technical-debt campaigns. Those require their own authority.

## Development SOP vs Operational SOP

Development SOP asks:

```text
Is the implementation correct against the canonical contract?
```

Operational SOP asks:

```text
Can a real user complete the business workflow without false success?
```

Both are required for a product to be trusted, but they are not the same. A module can pass unit tests and still fail operational readiness. A UI can render and still be operationally false if it does not call the canonical backend or persist real state.

Operational audit is read-only until a proven blocker receives explicit implementation authority.

## Status Semantics

Operational audit statuses are limited to:

```text
PASS
BLOCKED
DEFERRED
NOT_PROVEN
```

Definitions:

- `PASS`: Evidence proves the workflow step works through the required user, UI, backend, persistence, identity, tenant, permission, error, and test/DB path.
- `BLOCKED`: Evidence proves the workflow cannot operate, or would create false success, data loss, contract drift, tenant leakage, permission bypass, or unsafe mutation.
- `DEFERRED`: The step is valid but outside the current operational readiness scope, or explicitly not required for the current customer workflow.
- `NOT_PROVEN`: Evidence is missing or insufficient. `NOT_PROVEN` is not `BLOCKED`, and it is never `PASS`.

## Evidence State Separation

Operational readiness may reference lower-level evidence, but it must keep these states separate:

```text
NOT_PROVEN
  -> UNIT_PROVEN
  -> REAL_DB_LOGIC_PROVEN
  -> REAL_DB_PROVEN
  -> ADOPTION_APPROVED
  -> IMPLEMENTATION_AUTHORIZED
  -> GO_LIVE_READY
  -> GO_LIVE
```

Do not jump from one state to a higher state unless evidence for every required intermediate state exists in the current scope. A proof run can prove logic without proving adoption. Adoption approval can authorize a product to consume a capability, but it does not authorize implementation side effects unless the implementation authority is explicit. `GO_LIVE_READY` is readiness evidence for a human go-live decision; it is not the go-live decision itself.

If another governance artifact uses a narrower state machine, map it to these semantics instead of creating a duplicate state machine.

## The 13 Rules

### Rule 1: Operational First

When a product is preparing for operation, audit by real business workflow, not by source folder, module, component, or table.

### Rule 2: Read-Only First

Operational readiness audit must not modify code, schema, data, fixtures, configuration, tests, or documentation. Mutation requires a separate approved implementation task.

### Rule 3: Evidence Only

Every status must be backed by repository, UI, API, DB, test, runtime, or documented governance evidence. If evidence is missing, mark `NOT_PROVEN`.

Separate current proof residuals from historical residuals:

```text
CURRENT_RUN_RESIDUAL
HISTORICAL_RESIDUAL
```

Residuals created by the current proof run must be cleaned up or explicitly explained before the proof is called clean. Historical residuals must be tracked separately and must not be presented as current proof failures. A historical residual blocks the current gate only when evidence proves it directly affects the gate being evaluated. Do not require the entire database to be globally zero-residual unless that is the stated gate.

### Rule 4: Canonical Contract First

Every UI field, action, identity, status, and persisted record must trace to the current canonical contract before it can pass.

The canonical contract must be enforced by the runtime path under audit. A fixture, mock, seed, or manual data arrangement cannot prove an invariant that production/runtime code does not actually enforce.

### Rule 5: Workflow Evidence Chain

For each workflow step, trace the full chain:

```text
User role
  -> UI screen/action
  -> API/backend/use case
  -> canonical contract
  -> database persistence/read-back
  -> tenant isolation
  -> permission enforcement
  -> error behavior
  -> test or Real DB evidence
```

If the chain breaks, classify the exact break. Do not infer missing links.

### Rule 6: Workflow Completeness

Do not call a workflow operationally ready when only one layer is proven. Backend PASS does not prove UI PASS. UI render does not prove persistence. Read path does not prove write path.

For Finance-integrated workflows, Finance engine existence does not prove product
finance readiness. The product's own business event must be traced through the
finance handoff chain before the workflow can be called Finance Integrated.

### Rule 7: One Operational Owner

Each operational workflow must identify one accountable product owner for readiness decisions. Shared capabilities can participate, but readiness ownership cannot be ambiguous.

### Rule 8: Decision Boundary

Operational audit may identify blockers, gaps, and deferred work. It does not authorize implementation. Discovery stops at the decision boundary until explicit approval is granted.

### Rule 9: Audit Must Not Mutate

Audits must not repair the system while measuring it. Any mutation during audit invalidates the audit unless it is explicitly authorized as a separate implementation phase.

### Rule 10: False Success Is A Blocker

If the UI, API, or workflow reports success without proven canonical persistence and correct tenant/permission behavior, classify the step as `BLOCKED`.

### Rule 11: No Compatibility For Unproven Legacy Semantics

Do not preserve legacy identity, data, or workflow semantics merely to keep old test data or stale consumers working. Prove the canonical contract, then classify stale consumers separately.

### Rule 12: Minimal Fix After Proven Blocker

When a workflow is `BLOCKED`, the next implementation task must target the proven root cause only. Do not convert operational readiness into broad cleanup, refactor, redesign, or architecture normalization.

### Rule 13: Verify, Seal, Stop

After a minimal fix, rerun the exact workflow evidence chain, record the result, seal the checkpoint, and stop. Do not continue into adjacent workflows without a new decision.

## Finance Integration Evidence

Use this section only when the selected workflow declares Finance Integration as
a go-live requirement or when a vertical business event is expected to create a
financial fact. Do not use it to create product-specific finance gates or to
expand readiness into Finance Kernel redesign.

### Mandatory Gate: Vertical -> Finance Wiring Integrity

A vertical must not be classified as `Finance Integrated` merely because Finance
engines, contracts, workers, migrations, or tables exist.

The readiness gate is generic:

```text
Business Event
  -> Accounting Outbox
  -> Finance Processing
  -> Financial Fact
  -> Control / read-back evidence
```

`PASS` requires Real DB evidence for the vertical's own business event. Static
code existence, mocked workers, old artifacts, or another product's successful
finance flow are insufficient and must be classified as `NOT_PROVEN`.

Required evidence:

| Evidence point | Required proof |
|---|---|
| Business event | The selected vertical emits or persists the canonical business event after the business state transition. |
| Accounting outbox | The event creates the expected accounting outbox row with tenant, aggregate, idempotency, and payload evidence. |
| Finance processing | The accounting worker or canonical processing boundary consumes that outbox row without bypassing Finance contracts. |
| Financial fact | The expected F1/F2/F3 financial fact is created, with tenant-scoped read-back evidence. |
| Duplicate defense | Replaying or retrying the same business event does not create duplicate financial facts. |
| Missing defense | Missing or delayed financial processing is observable as `NOT_PROVEN` or `BLOCKED`, not hidden success. |
| Tenant isolation | Cross-tenant event, outbox, processing, and fact visibility remain isolated. |

Classification rules:

- `PASS`: Real DB evidence proves the complete chain for this vertical and workflow.
- `BLOCKED`: Evidence proves false success, duplicate fact generation, missing required fact, tenant leakage, permission bypass, or contract drift.
- `NOT_PROVEN`: Any chain link lacks fresh evidence.
- `DEFERRED`: Finance integration is valid but explicitly outside the selected workflow or release scope.

### Candidate Rule: Financial Control / F5 Evidence

If a vertical declares financial control as a go-live requirement, its evidence
should cover both financial generation and financial control:

- financial fact created;
- duplicate fact rejected or reconciled;
- missing fact detected;
- mismatch or delay detected;
- severity classified;
- alert or routing follows the control contract;
- tenant isolation preserved.

This is a candidate rule, not a mandatory global gate for every vertical. Promote
it to a mandatory gate only after repeated evidence shows that product readiness
is being overclaimed after F1/F2/F3 generation but before control is proven.

### Candidate Rule: Production Schema Compatibility

A feature should not be called `Production Ready` when the production target has
not verified the canonical schema, constraints, RLS, triggers, and migration
ledger required by that feature.

This rule is especially relevant when the workflow depends on:

- concurrency constraints;
- append-only history;
- RLS;
- foreign-key or unique constraints;
- database triggers;
- production migration ledger evidence.

This is a candidate rule until recurring cross-vertical evidence proves it must
become a mandatory global readiness gate. Until then, classify missing production
schema evidence as `NOT_PROVEN` for the specific workflow instead of creating a
new universal gate.

## Readiness Layers

Use these four layers as a summary frame. They do not replace the workflow
template and they do not authorize extra gates by themselves.

| Layer | Evidence focus |
|---|---|
| Business Contract | Identity, tenant isolation, permission, workflow, state transition. |
| Runtime / DB Integrity | Persistence, constraints, concurrency, idempotency, immutable history, rollback, Real DB proof. |
| Financial Integrity | Accounting outbox, F1/F2/F3 wiring, financial fact, F5/control evidence when in scope, severity, alerting, reconciliation. |
| Production Go-Live Integrity | Migration, production schema, read-back, backup evidence, CI, baseline, security, architecture, production verification. |

## Operational Audit Template

Use this template for each workflow step. Do not add extra categories unless the current business workflow proves they are required.

```text
Workflow:
Step:
Operational owner:
Audit mode: READ ONLY

1. UI/screen exists:
Status:
Evidence:

2. UI calls canonical backend:
Status:
Evidence:

3. Backend persists/checks correct DB state:
Status:
Evidence:

4. Identity/contract is canonical:
Status:
Evidence:

5. Tenant isolation is enforced:
Status:
Evidence:

6. Permission matches the required role:
Status:
Evidence:

7. Error path avoids false success:
Status:
Evidence:

8. Test or Real DB evidence exists:
Status:
Evidence:

Final classification:
PASS / BLOCKED / DEFERRED / NOT_PROVEN

Blocker root cause, if any:

Deferred items, if any:

Next decision:
STOP / request implementation authority / defer
```

## Workflow-Level Output

For a complete operational workflow, summarize every step with the same vocabulary:

```text
Workflow:
Operational owner:

Step                            Status
Teacher login                   PASS / BLOCKED / DEFERRED / NOT_PROVEN
Student check-in                PASS / BLOCKED / DEFERRED / NOT_PROVEN
Attendance close                PASS / BLOCKED / DEFERRED / NOT_PROVEN
Meal / health / nap             PASS / BLOCKED / DEFERRED / NOT_PROVEN
Pickup / checkout               PASS / BLOCKED / DEFERRED / NOT_PROVEN
Parent notification             PASS / BLOCKED / DEFERRED / NOT_PROVEN
Billing                         PASS / BLOCKED / DEFERRED / NOT_PROVEN
Payment                         PASS / BLOCKED / DEFERRED / NOT_PROVEN
End-of-day report               PASS / BLOCKED / DEFERRED / NOT_PROVEN

Overall:
PASS / BLOCKED / DEFERRED / NOT_PROVEN
```

This example is not a product-specific checklist. It is a pattern for constructing a product-specific checklist only after that product's operational workflow is selected.

## Stop Conditions

Stop only the affected audit step or dependent action when:

- a blocker requires code, schema, data, fixture, test, configuration, CI, or documentation mutation;
- the canonical contract is unclear;
- ownership is unclear;
- the workflow requires a missing capability;
- tenant isolation or permission behavior is unproven;
- continuing would broaden scope beyond the selected workflow;
- the audit would need to mutate the system to continue.

Record the exact obstacle and continue independent, authorized read-only steps in the selected workflow under [Autonomous Execution](OPERATIONAL_RULES.md). Request only the missing decision or access; do not ask again for valid implementation authority already granted. An authorized repair remains a separate implementation phase, with fresh audit evidence afterward. Missing evidence remains `NOT_PROVEN` and does not by itself stop the entire audit or prove a product defect.

## Closure Standard

Operational readiness closure requires:

- workflow evidence chain recorded;
- every step classified as `PASS`, `BLOCKED`, `DEFERRED`, or `NOT_PROVEN`;
- no hidden assumptions;
- no audit mutations;
- blockers tied to root cause evidence;
- deferred items explicitly named;
- implementation authority requested only for proven blockers;
- final decision recorded before moving to the next workflow.

Operational readiness is not a claim that the whole product is finished. It is a bounded, evidence-backed statement about a selected real business workflow.
