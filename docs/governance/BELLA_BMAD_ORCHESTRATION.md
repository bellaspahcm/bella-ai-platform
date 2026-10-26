# Bella BMAD Orchestration

This document defines the thin Bella orchestration layer over the repo-local BMAD installation.

It does not replace BMAD and does not create a new implementation framework. It connects existing BMAD skills and personas to the Bella Engineering Constitution.

## Operating Model

```text
Requested outcome + acceptance + scope + safety bounds
  -> Codex Lead establishes truth, baseline, owners and dependencies
  -> Selects the minimum roles and tools actually available for this task
  -> Delegates bounded, actionable work with usable deliverables
  -> Routes findings to the owner for an authorized fix or resolution
  -> Integrates results, completes acceptance and applicable verification
  -> Seals the accepted task scope; evaluates Production / Go-Live separately
```

One outcome has one Codex Lead, accountable for end-to-end integration and closure. Preserve the Constitution's `MULTI_AGENT = OFF` default. The Lead selects multi-agent execution when the requested outcome and task context authorize it and dependency/ownership analysis shows independent work; otherwise use the appropriate sequential roles or one agent. Do not ask the user to reapprove each routine handoff.

## Outcome-Based Execution

The Lead remains responsible for the requested acceptance criteria after delegating work; an agent's advice, a completed subtask, or a green aggregate check is not the completed outcome.

1. **Define the outcome.** Translate the request into scoped, observable acceptance criteria and safety bounds. Check the authoritative business source, existing state, contracts, ownership, dependencies, and the relevant execution environment. Resolve routine technical questions from approved evidence. Ask the owner only when a material business decision, permission, or other required authority is genuinely missing.
2. **Choose the minimum viable team.** Use `bella-agent-role-map` to select roles based on the demonstrated dependencies, not a fixed roster. Reuse existing BMAD personas, Bella wrappers, Codex collaboration tools, task records, and worktree tools where they are available and fit the required work. Verify the actual skill, tool, permission, and runtime before assigning execution; a persona, installed skill, document, or architecture diagram alone does not prove a runtime Agent. Single-owner sequential work does not require parallel agents.
3. **Delegate usable work.** Give each agent a bounded handoff packet with its acceptance criterion, existing sources, owner, role/skill, owned and forbidden files, dependencies, authority, verification, stop conditions, expected artifact or fix, and required hand-back evidence. Ask the agent to resolve its assigned issue with an executable result when authorized, not return a recommendation that leaves in-scope work undone. Roles remain within their expertise and cannot grant themselves approval or cross-boundary authority.
4. **Route each obstacle to its owner.** When an assigned approach fails, record the observed failure, root-cause hypothesis, supported alternative, and affected acceptance criterion. Ask the role with the matching capability and permitted tool to resolve it; use another existing role when ownership or permissions point there. Retry only on a new hypothesis or changed input, within existing diagnosis and launcher limits. Hold only dependent work and continue independent, authorized tasks. Do not invent agents or capabilities: the role map contains no separate DevOps persona, so verify an actual environment/tool owner or handle the issue with an existing authorized role. Request user input only for the specific unresolved business, access, or authority decision no available path can resolve.
5. **Integrate and verify.** The Lead reconciles changes and evidence against the same candidate, resolves cross-workstream conflicts, sends actionable failures back to the owning role, and reruns the affected acceptance criteria and mandatory applicable checks. Code-changing parallel work uses the isolated worktrees, ownership boundaries, and public contracts required by the Constitution; dependent changes proceed after their prerequisites. Preserve role independence for required QA/review and retain actual outcomes, including skips and missing evidence.
6. **Close the task scope.** Close only when the requested acceptance criteria and mandatory applicable checks for that scope are satisfied, or report the exact held dependency and unfinished criteria. `Seal` records scoped acceptance; it does not establish product-wide readiness, Production safety, deployment, or Go-Live. Keep `NOT_PROVEN`, `BLOCKED`, `FAIL`, and `NOT_APPLICABLE` distinct and continue any independent authorized work.

If a selected Factory run is held, preserve its terminal result and candidate under the Constitution. Its bounded role pipeline is not a general multi-specialist dispatcher. Use another authorized execution path only when that path is permitted and does not alter, resume, or misreport the held Factory evidence.

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

Role and skill availability do not prove a separately runnable specialist process. In Codex, delegate through collaboration tools when the current task has permission and a suitable execution path; for code changes use isolated, owned worktrees. When an agent runner, skill, or DevOps capability is unavailable, use an existing authorized path or identify the exact evidence/authority boundary rather than claiming a dispatch occurred.

## Handoff Packet

Every delegated or staged workstream must carry this packet:

```text
GOAL:
ACCEPTANCE CRITERION:
EXPECTED DELIVERABLE:
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
HAND-BACK / EVIDENCE:
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

Hold only dependent work and route the decision to its owner when the work requires:

- Frozen kernel modification.
- ProductRegistry change outside approved scope.
- Public contract change without approval.
- Database, RLS, auth, or migration change outside approved scope.
- Shared file ownership between active agents without Lead decision.
- New global abstraction or new OS kernel.
- Business semantics that are not proven by an authoritative source.

These conditions do not stop unrelated authorized work. Use existing roles and evidence to resolve gaps within their authority. Do not ask the user to decide a question answerable from approved sources, authorize a routine in-scope fix again, or accept an unresolved recommendation when the assigned specialist could have produced a usable result. Escalate only the concrete decision or access boundary that no authorized role/tool can resolve.

## Minimal Use Guidance

Factory is optional for project Codex chat coding requests. Use the normal authorized workflow unless the user or a task-specific rule selects Factory. When Factory is selected, follow [Factory Intake from Project Codex Chat](BELLA_AI_CODING_CONSTITUTION.md#factory-intake-from-project-codex-chat) and its admission boundary. A direct workflow is a valid separate execution path, not Factory evidence; never edit or bypass a held Factory candidate, and already-dispatched Factory roles must not recursively dispatch another Factory.

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
