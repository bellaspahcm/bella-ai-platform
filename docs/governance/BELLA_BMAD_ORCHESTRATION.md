# Bella BMAD Orchestration

This document defines the thin Bella orchestration layer over the repo-local BMAD installation.

It does not replace BMAD and does not create a new implementation framework. It connects existing BMAD skills and personas to the Bella Engineering Constitution.

## Operating Model

```text
Codex Orchestrator
  -> Audit task
  -> Decompose and identify ownership
  -> Select required Bella/BMAD role skills
  -> Run architecture and approval gates
  -> Implement only authorized workstreams
  -> Run QA and security verification
  -> Record evidence
  -> Seal only when evidence is sufficient
```

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

Every delegated or staged workstream must carry this packet:

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

Stop and report instead of implementing when the work requires:

- Frozen kernel modification.
- ProductRegistry change outside approved scope.
- Public contract change without approval.
- Database, RLS, auth, or migration change outside approved scope.
- Shared file ownership between active agents without Lead decision.
- New global abstraction or new OS kernel.
- Business semantics that are not proven by an authoritative source.

## Minimal Use Guidance

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
