# Bella BMAD Orchestration

This document defines the thin Bella orchestration layer over the repo-local BMAD installation.

It does not replace BMAD and does not create a new implementation framework. It connects existing BMAD skills and personas to the Bella Engineering Constitution.

## Operating Model

```text
Codex Orchestrator
  -> Goal: acceptance, scope, ownership and existing authority
  -> Execute: minimum safe implementation through a suitable authorized route
  -> Verify: affected behavior and applicable safeguards; reuse valid evidence
  -> Fix: proven root cause within scope, if verification fails
  -> Seal: scoped result, evidence and remaining limits
```

Use the Constitution's [three control levels](BELLA_AI_CODING_CONSTITUTION.md#three-control-levels), [Factory/direct routing](BELLA_AI_CODING_CONSTITUTION.md#factory-intake-from-project-codex-chat) and evidence reuse rules. Roles are responsibilities; they do not require extra agents, reports or approval queues. An already-authorized next flow may proceed when its applicable conditions are met.

Multi-Agent Mode remains off by default. The Orchestrator may activate multi-agent work only when the Bella Constitution allows it and the user or task context authorizes it.

## Existing BMAD Assets

Bella keeps the current BMAD installation:

- `_bmad/config.toml`
- `_bmad/bmm/config.yaml`
- `_bmad/bmm/module-help.csv`
- `.agents/skills/bmad-*`

Do not reinstall BMAD, duplicate BMAD skills, or edit installer-managed BMAD files for orchestration changes.

## Bella Wrapper Skills

The Bella layer adds these repo-local skills:

- `bella-orchestrator-workflow`
- `bella-agent-role-map`
- `bella-qa-testing`
- `bella-security-reliability`

These wrappers route work to existing BMAD skills and Bella verification rules. They do not create new runtime Product capabilities.

## Handoff Packet

For an actual delegated workstream or handoff, keep the relevant fields in the existing task record. Single-agent work does not require a separate packet or duplicate report:

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

## Evidence Rules

Allowed evidence states:

- PASS
- PROVEN
- NOT_PROVEN
- BLOCKED
- NOT_STARTED

Disallowed closure states:

- TIMEOUT as PASS
- SKIP as PASS
- NOT_RUN as PASS
- ASSUMED as PASS
- PR green as Go-Live
- Code written as DONE

## Stop Conditions

Hold only the dependent action when the work requires:

- Frozen kernel modification.
- ProductRegistry change outside approved scope.
- Public contract change without approval.
- Database, RLS, auth, or migration change outside approved scope.
- Shared file ownership between active agents without Lead decision.
- New global abstraction or new OS kernel.
- Business semantics that are not proven by an authoritative source.

Continue independent authorized work. Tool outages, missing optional reports or an unrelated unfinished audit are not global stop conditions. A failed safety check still holds the action it protects; do not relabel it as a tooling issue.

## Minimal Use Guidance

For project Codex chat coding requests, apply [Factory Intake from Project Codex Chat](BELLA_AI_CODING_CONSTITUTION.md#factory-intake-from-project-codex-chat). Use direct single-agent delivery for ordinary authorized Product work outside native admission; no extra approval is needed solely for that route. A tooling-failed native run retains its result and must have no active writers before a route change. Native-specific acceptance, protected boundaries and safety/authority failures remain binding. Already-dispatched roles follow their assigned native task without recursive dispatch or unilateral route changes.

Small local fix:

```text
bmad-quick-dev
```

Architecture or contract change:

```text
bella-orchestrator-workflow
-> bmad-agent-architect / bmad-create-architecture
-> approval gate
```

UI or workflow redesign:

```text
bmad-agent-ux-designer / bmad-ux
-> bella-agent-role-map
-> UI to contract reconciliation
```

QA/test expansion:

```text
bella-qa-testing
-> bmad-code-review
-> bmad-qa-generate-e2e-tests when new E2E/API tests are authorized
```

Security/reliability review:

```text
bella-security-reliability
-> Bella Constitution security gates
-> targeted runtime evidence
```
