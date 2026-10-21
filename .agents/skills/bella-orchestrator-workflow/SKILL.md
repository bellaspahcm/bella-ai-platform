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
   For project Codex chat coding requests, apply **Factory Intake from Project Codex Chat** in the Constitution before selecting an implementation route. Use its existing CLI and admission boundary; do not create a parallel dispatcher or recursively dispatch an already-running Factory role.
2. Identify Truth, Source of Truth, Canonical Contract, Ownership, Boundary, and Change Authority.
3. Classify the task:
   - `SINGLE_AGENT`
   - `DEPENDENT_SEQUENCE`
   - `INDEPENDENT_WORKSTREAMS`
   - `BLOCKED`
4. Use `bella-agent-role-map` to choose the smallest role set.
5. Create or update an architecture gate when Bella rules require it.
6. For each workstream, produce a handoff packet.
7. Run implementation only inside the authorized boundary.
8. Run QA and security/reliability verification appropriate to the scope.
9. Record evidence using Bella evidence states.
10. Seal only when required evidence is fresh and sufficient.

## Handoff Packet

Every delegated or staged workstream must include:

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

Stop and report `STOPPED_AT_BOUNDARY`, `BLOCKED`, or `NOT_PROVEN` when:

- Ownership is unclear.
- The canonical contract is missing or contradictory.
- The requested scope does not authorize the required layer.
- A frozen kernel would need modification.
- ProductRegistry would need modification outside assigned scope.
- RLS/auth/security would need weakening.
- Business semantics are not proven.
- Two active workstreams need the same shared file without Lead decision.

## Output

Return:

- Selected roles and skills.
- Handoff packets.
- Verification plan.
- Evidence status.
- Seal decision: `PASS`, `BLOCKED`, `DEFER`, or `NOT_PROVEN`.
