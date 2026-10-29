---
name: bella-orchestrator-workflow
description: Coordinate Bella work by mapping a user goal to existing BMAD skills, Bella ownership gates, handoff packets, verification evidence, and seal rules. Use when the task needs orchestration, multi-role coordination, or controlled handoff across Bella workstreams.
---

# Bella Orchestrator Workflow

## Purpose

Use this skill as the Lead / Orchestrator layer for Bella work. It connects existing BMAD skills to the Bella Engineering Constitution without reinstalling BMAD, duplicating skills, or enabling Multi-Agent Mode by default.

## Mandatory Sources

Before orchestration decisions, read:

- `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
- `docs/governance/BELLA_BMAD_ORCHESTRATION.md`
- `.agents/skills/bella-agent-role-map/SKILL.md`

When Healthcare or Education code may be touched, also read the relevant vertical constitution before any implementation.

## Operating Rules

- One goal has one Lead.
- Multi-Agent Mode is OFF by default.
- Do not create agents merely to fill a role count.
- Use only the roles required by the proven task structure.
- Do not modify frozen kernels, ProductRegistry, public contracts, migrations, RLS, or auth unless the user explicitly grants that scope and the architecture gate passes.
- Do not treat code written, green PR checks, skipped tests, or timeouts as closure evidence.

## Workflow

1. Establish the user goal.
   Apply **Goal -> Execute -> Verify -> Fix -> Seal**, the Constitution's **Three Control Levels** and **Factory Intake from Project Codex Chat**. Ordinary authorized Product work may use its direct single-agent route without a second approval solely for route selection. Preserve the admission boundary and failed-run evidence; do not create a dispatcher, recursively dispatch, or route around a safety/authority failure. Confirm native writers have exited before a tooling-related route change.
2. Identify Truth, Source of Truth, Canonical Contract, Ownership, Boundary, and Change Authority.
3. Classify the task:
   - `SINGLE_AGENT`
   - `DEPENDENT_SEQUENCE`
   - `INDEPENDENT_WORKSTREAMS`
   - `BLOCKED`
4. Use `bella-agent-role-map` to choose the smallest role set.
5. Create or update an architecture gate when Bella rules require it.
6. For actual delegation/handoff, keep the relevant packet fields in the existing work record. Single-agent delivery needs no additional packet/report.
7. Run implementation only inside the authorized boundary.
8. Select QA/security verification and a safe authorized environment by impact; reuse evidence under **Evidence Reuse and Invalidation**. A Test DB, additional audit or repeated review is not a default prerequisite.
9. Record evidence using Bella evidence states.
10. Seal when scoped acceptance and applicable safeguards have sufficient valid evidence. Continue the next flow already authorized in the goal; do not add optional proof or request the same approval again.

## Handoff Packet

Actual delegated workstreams/handoffs include these fields in the existing record; omit inapplicable fields and do not create a separate report for single-agent work:

```text
GOAL:
SCOPE:
OWNER:
ROLE / SKILL:
OWNED FILES:
FORBIDDEN FILES:
DEPENDENCIES:
CHANGE AUTHORITY:
VERIFICATION COMMANDS:
EVIDENCE REQUIRED:
STOP CONDITIONS:
RESULT:
```

## Stop Conditions

Hold the dependent action at a real authority, business or safety boundary; report its actual scoped finding (`STOPPED_AT_BOUNDARY`, `BLOCKED`, or `NOT_PROVEN`) and continue independent authorized work when:

- Ownership is unclear.
- The canonical contract is missing or contradictory.
- The requested scope does not authorize the required layer.
- A frozen kernel would need modification.
- ProductRegistry would need modification outside assigned scope.
- RLS/auth/security would need weakening.
- Business semantics are not proven.
- Two active workstreams need the same shared file without Lead decision.

Missing proof alone is `NOT_PROVEN`, not a global execution stop. Use another permitted tool/environment when only the execution method fails; refresh the affected evidence. Production administration still needs its exact authority, preconditions, impact and recovery checks under Deployment Governance.

## Output

Return:

- Selected roles and skills.
- Handoff packets.
- Verification plan.
- Evidence status.
- Seal decision: `PASS`, `BLOCKED`, `DEFER`, or `NOT_PROVEN`.
