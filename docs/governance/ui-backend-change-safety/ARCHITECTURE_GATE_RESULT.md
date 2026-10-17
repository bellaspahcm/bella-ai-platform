# UI-Driven Backend Change Safety - Governance Gate and Verification

Date: 2026-10-18 (Asia/Saigon)
Scope: governance documentation only. Single-agent execution.
Baseline: `dcdab0f0a8954299ef7183e92c98a468af40f049` (worktree HEAD).
Branch: `codex/ui-backend-change-safety`.
Worktree: `C:/Users/DELL/.codex/worktrees/ui-backend-change-safety/BELLA SPA ERP`.

## 1. Bella OS/Product Development Process Gate

Problem: integrate the requested UI-driven backend safety rule without duplicating existing semantic, authority, or UI reconciliation controls and without requiring a large report for presentation maintenance.

Truth/source: the user's approved rule text and the current constitution's Business Semantic Gate, Mandatory Entry Gate, Change Authority, UI to Contract Reconciliation, and Rules 30-34. Existing rules already prohibit inventing backend semantics from UI. The missing pieces are proportional classification, an explicit Change Map, and a consolidated decision/closure boundary.

Result: `PASS` for this documentation scope. No product/runtime code is authorized or required. This task record does not replace the root `ARCHITECTURE_GATE_RESULT.md` for another product task.

## 2. Manifest and Scope

Capability: one canonical safety rule, referenced by existing AGENTS and CLAUDE entrypoints. Reuse the existing task gate/work record for Change Maps; no agent system, CI gate, framework, or runtime capability is added.

Non-goals: product implementation, schema, migrations, production operations, ProductRegistry, kernel changes, and automatic enforcement across all AI tools.

## 3. Ownership Map

| Artifact | Ownership / purpose |
| --- | --- |
| `docs/governance/BELLA_AI_CODING_CONSTITUTION.md` | Canonical engineering rule; contains the complete new rule. |
| `AGENTS.md` | Existing AI entrypoint; short pointer and alignment of report requirement. |
| `CLAUDE.md` | Existing Claude instruction entrypoint; same pointer and alignment. |
| This task record | Scoped plan, dry-run results, evidence, and limitations. |

No business data ownership or identity changes.

## 4. Contract Dependency Map

Instruction entrypoint -> canonical constitution -> task Change Map / existing architecture gate -> authorized implementation -> scoped verification.

Product -> Public Contract -> Kernel remains unchanged. Healthcare H1-H12 and Logistics E7.1-E7.3 remain outside scope.

## 5. Change Authority

The user authorized a fresh worktree and integration of this governance rule. Modify only the constitution, the two existing entrypoints, and this evidence record. The follow-up user instruction authorizes commit, push, and PR creation for these four documents. Merge and rollout into other agent workflows remain outside scope.

Resolve the existing blanket report requirement in AGENTS/CLAUDE by referencing the constitution's presentation-maintenance exception. Full Product UI redesigns retain the mandatory gate. Compatible backend work must still fit explicitly authorized layers; classification alone grants no authority. Frozen-kernel approvals retain ACR/ADR/unlock requirements.

## 6. UI -> Contract Reconciliation and Change Map

No actual Product UI changes. Classification of this task: governance-only (the UI impact categories describe downstream implementation tasks).

### Executed rule walkthroughs (no product edits)

The same agent read and applied the revised rule to these bounded hypothetical requests. These are instruction-level dry-runs, not runtime tests or independent-agent adoption evidence.

| Input | Applied Change Map / outcome | Verification required for a real implementation |
| --- | --- | --- |
| Change an existing card's spacing/icon without changing labels, values, actions, states, or permissions. | `UI_ONLY`; presentation authority only; preserve existing bindings/handlers. A brief task classification is sufficient, no standalone report. Continue autonomously. | Inspect affected UI/responsive behavior and confirm data/actions remain unchanged. |
| A new refund button requires a backend refund transition whose cancellation/deposit rules have no authoritative decision. | `BACKEND_EXTENSION` + `SENSITIVE_BUSINESS_CHANGE`; business-critical refund state/source/owner unresolved. `BUSINESS_SEMANTICS = NOT_PROVEN`; hold the refund implementation and request the owner's rule/authority decision. No inferred endpoint, status, or migration. Independent authorized presentation work may continue. | After decision: prove canonical financial invariants, permissions/tenant checks, invalid/failure paths, persistence/read-back, affected legacy flows, and rollback/recovery. No backend test is claimed here. |
| Add a filter through an existing public API. | `EXISTING_CAPABILITY_REUSE` only after supported filter semantics are verified. Reuse the established API and test the consumer; unsupported filtering becomes a gap, not permission to expand the backend. | Contract evidence and affected-path test; tenant/permission checks where applicable. |

Walkthrough result: `PASS` for proportional rule application and the unresolved-business stop boundary. The examples assert no existing product API or refund semantics.

## 7. Additive Migration / Rollback Plan

No database, schema, or migration changes. Governance rollback is to revert only this task's documentation diff when authorized. No production data operation is needed.

## 8. Eleven Verification Gates Plan

These are the eleven scoped checks for this documentation task, not new automated CI gates or substitutes for product gates.

| Check | Plan / evidence boundary |
| --- | --- |
| 1. Isolation | Confirm clean new worktree baseline and dedicated branch. |
| 2. Scope | Inspect changed files; only four intended Markdown files. |
| 3. Canonical source | Confirm full rule appears once in the constitution. |
| 4. Entrypoints | Confirm AGENTS/CLAUDE pointers resolve to the rule. |
| 5. Proportionality | UI-only walkthrough above; report exception aligned across entrypoints. |
| 6. Backend authority | Refund walkthrough above; semantic stop and no inferred contract. |
| 7. Reuse | Filter walkthrough above; supported semantics required before reuse. |
| 8. Security/freeze | Review independent backend enforcement and preserved ACR/ADR boundary. No runtime security claim. |
| 9. Evidence states | Verify distinction between local evidence, readiness, held work, and main seal. |
| 10. Patch hygiene | Run `git diff --check` and trailing-whitespace scan over changed documents. |
| 11. Final review | Inspect complete diff, confirm no runtime/CI changes, record limitations. |

Runtime tests, typecheck, lint, Real DB/RLS, browser E2E, Healthcare/Logistics regression, migration execution, and Go-Live verification: not run, because no implementation in those scopes changed.

## 9. Entrypoint Audit and Adoption Boundary

- This Codex conversation received the AGENTS instructions in its input and read the repository constitution before editing. Current-session reading is evidenced by the tool transcript.
- Repository AGENTS and CLAUDE both point to the canonical constitution; revised pointers explicitly identify the new rule. This proves file linkage, not automatic loading by every tool/version.
- `.cursorrules` currently points to Healthcare/Education constitutions, without the general Bella constitution pointer. The tracked `.kiro/steering` inventory contains a Git workflow rule; the inspected `.github` inventory has no Copilot instruction file. These are coverage findings, not a reason to create additional instruction systems in this task.
- Cursor, Kiro, Claude runtime auto-loading, other agents, and future-session compliance: `NOT_PROVEN`. No rollout into those workflows is claimed. Expand only after relevant execution evidence, as requested.

## 10. Closure Evidence

See the task tool transcript for full commands and output. Executed in the worktree:

| Command / check | Actual result |
| --- | --- |
| `git diff --check` | Exit 0, no output. |
| `rg -n '[ \t]+$' AGENTS.md CLAUDE.md docs/governance/BELLA_AI_CODING_CONSTITUTION.md docs/governance/ui-backend-change-safety/ARCHITECTURE_GATE_RESULT.md` | Exit 1, no matches (no trailing whitespace). |
| PowerShell assertions over canonical heading, entrypoint pointers/report exception, and changed-file allowlist | Exit 0: `PASS: single canonical rule, two linked entrypoints, proportional report exception, exactly four allowed documents`. |
| `git branch --show-current` / `git rev-parse HEAD` | Dedicated branch and unchanged baseline SHA recorded above. |
| Full tracked diff and new task record review | Governance scope only; no runtime, CI, or frozen-artifact modifications. |

`GOVERNANCE_PATCH = VERIFIED_LOCALLY`. `CROSS_TOOL_ADOPTION = NOT_PROVEN`. `SEALED_ON_MAIN = NOT_PROVEN` (local verification does not establish a main seal; commit/push/PR delivery is authorized by the follow-up instruction). No build/UI preview or scenario walkthrough establishes product readiness.
