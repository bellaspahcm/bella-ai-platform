---
name: bella-agent-role-map
description: Map Bella's eight specialist roles to existing BMAD personas, BMAD workflow skills, and Bella wrapper skills without creating duplicate agents. Use before orchestration, delegation, or workflow design.
---

# Bella Agent Role Map

## Purpose

Use this skill to select the minimum role set for a Bella task. The map distinguishes BMAD skills, AI agent roles, and workflow stages.

Do not create a new agent just to satisfy a role count. Use a wrapper role only when existing BMAD skills do not fully cover the Bella responsibility.

## Role Map

| Bella role | Primary existing skill/persona | Supporting skills | Status |
| --- | --- | --- | --- |
| Business Analyst | `bmad-agent-analyst` | `bmad-domain-research`, `bmad-market-research`, `bmad-product-brief` | PROVEN |
| Product Manager | `bmad-agent-pm` | `bmad-prd`, `bmad-check-implementation-readiness` | PROVEN |
| System Architect | `bmad-agent-architect` | `bmad-create-architecture`, `bmad-technical-research` | PROVEN |
| Software Engineer | `bmad-agent-dev` | `bmad-quick-dev`, `bmad-dev-story`, `bmad-create-story` | PROVEN |
| UX/UI Designer | `bmad-agent-ux-designer` | `bmad-ux`, `bmad-checkpoint-preview` | PROVEN |
| QA & Testing | `bella-qa-testing` | `bmad-code-review`, `bmad-qa-generate-e2e-tests`, `bmad-review-edge-case-hunter` | WRAPPER |
| Security & Reliability | `bella-security-reliability` | Bella Constitution gates, architecture guards, runtime verification | WRAPPER |
| Documentation & Knowledge | `bmad-agent-tech-writer` | `bmad-document-project`, `bmad-generate-project-context`, `bmad-index-docs` | PROVEN |

## Selection Rules

- Small local implementation: use `bmad-quick-dev`.
- Story implementation: use `bmad-create-story` -> `bmad-dev-story` -> `bmad-code-review`.
- Product scope or MVP criteria: use Product Manager role.
- Business semantics or workflow truth: use Business Analyst role.
- Architecture, public contract, boundary, or ownership decision: use System Architect role.
- UI redesign or data/action-bound UI: use UX/UI Designer plus architecture gate.
- Test automation or verification expansion: use QA & Testing wrapper.
- Auth, RLS, tenant isolation, reliability, production behavior, or operational integrity: use Security & Reliability wrapper.
- Evidence packaging, knowledge capture, or decision records: use Documentation & Knowledge role.

## Multi-Agent Rule

The role map does not activate Multi-Agent Mode. The Orchestrator may activate multi-agent execution only when the Bella Constitution permits it and the workstreams are independently owned.

## Required Output

For each selected role, report:

```text
ROLE:
SKILL:
WHY REQUIRED:
INPUTS:
OUTPUTS:
OWNERSHIP BOUNDARY:
EVIDENCE REQUIRED:
```
