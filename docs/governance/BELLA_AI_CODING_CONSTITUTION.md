# BELLA AI PLATFORM ARCHITECTURE & CHANGE CONSTITUTION

> Follow Bella Engineering Execution Contract: Evidence -> Truth -> Source of Truth -> Canonical Contract -> Ownership -> Boundary -> Change Authority -> Minimal Implementation -> Verification -> Evidence. Never change a lower-layer contract merely to satisfy a higher-layer consumer, redesigned UI, TypeScript, or CI.

This is the authoritative engineering execution constitution for the Bella AI Platform ecosystem. It applies to AI-assisted and human work across Platform/Core, Bella Factory, Industry OS, Product, Integration, Shared UI, CI, tests, security, migrations, dependency upgrades, technical-debt cleanup, and release readiness.

This document is not a list of optional preferences. It is the default execution contract. If a local vertical constitution, freeze policy, ADR, or human architect decision is stricter, the stricter rule wins.

AI must first determine what is true, which source has authority to prove it, which canonical contract represents it, who owns it, and whether the requested task authorizes changing it.

The Truth, Contract, and Change Authority rules below apply to all Bella OS, Products, features, refactors, UI redesigns, and technical-debt fixes.

## Scope, Responsibilities, and Applicable Authority

The common Constitution applies to every change. The new OS/Product process below is one development workflow within that scope.

| Control layer | Responsibility | Existing entrypoint |
| --- | --- | --- |
| Architecture Constitution | Common invariants, ownership, canonical truth, contracts, change authority, and evidence semantics. | This document and applicable approved architecture decisions. |
| Development Workflows | Select analysis, implementation, review, and verification for the task's actual impact. | [Workflow Routing](#workflow-routing) and existing specialized procedures. |
| Repository Enforcement | Apply configured permissions, required checks, protected paths, hooks, and approval controls. | Actual repository configuration and executed evidence; [Enforcement Evidence](#enforcement-evidence). |

### Architectural Responsibilities

| Responsibility | Owns |
| --- | --- |
| Platform/Core | Shared, industry-neutral foundational capabilities and their public contracts. |
| Bella Factory | Software creation, orchestration, verification, and release governance within delegated authority. It does not acquire Industry OS or Product business ownership. |
| Industry OS | Reusable industry capabilities, domain semantics, invariants, and public contracts. |
| Product | Concrete business workflows, Product-specific behavior, identity, and user experience using approved capabilities. |

These are responsibility boundaries, not a mandatory adjacent-layer dependency chain, folder template, or instruction to build another runtime framework. Integration and Shared UI retain their existing ownership boundaries.

### Authority and Applicability Map

| Existing source | Applicability and relationship |
| --- | --- |
| This document | Common engineering execution rules across the ecosystem; retain this canonical file path when referring to the renamed Constitution. |
| [Approved Platform Architecture Constitution](../01-architecture/ARCHITECTURE_CONSTITUTION.md) | Approved architectural foundation. This engineering update does not revoke its constraints or approve deviations. |
| [Healthcare Constitution](../architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md), [Education Constitution](../architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md), and other applicable OS/Product constitutions | Specialized rules for their declared scopes, including mandatory gates and public-contract boundaries. |
| [Freeze Policy](../architecture/FREEZE_POLICY.md) and applicable ACRs/ADRs | Protected-layer changes retain their required approval, unlock, verification, and reseal process. Apply decisions only within their approved scope and effective conditions. |
| [Git Workflow Constitution](../architecture/GIT_WORKFLOW_CONSTITUTION.md), [Operational Readiness SOP](OPERATIONAL_READINESS_SOP.md), [Deployment Governance](BELLA_DEPLOYMENT_GOVERNANCE_FRAMEWORK.md), and Product release criteria | Govern their respective change, operational, deployment, and Go-Live decisions; none is established by a generic gate PASS. |
| [Draft Architecture Constitution](../BELLA_ARCHITECTURE_CONSTITUTION.md) and [conditional Meta-Platform Constitution](../architecture/BELLA_META_PLATFORM_CONSTITUTION.md) | Preserve their recorded status, scope, and effective conditions. A title, date, or file's presence does not establish activation or supersession. |

AGENTS.md, CLAUDE.md, tool instructions, and directory instructions route execution to these sources; they must not create a competing copy of the common rules. Local instructions may add applicable constraints without weakening existing authority.

Apply stricter applicable rules. When approved sources genuinely conflict and precedence cannot be resolved from an applicable decision, stop the dependent change and present the exact conflict to its owner. Continue independent, authorized work. AI must not silently repeal a rule, choose the easiest policy, or treat a document rename as approval of an architectural exception.

### Mandatory Invariants and Conditional Techniques

Ownership, canonical truth, public contracts, change authority, tenant isolation, authorization/RLS, data and audit integrity, and protected/frozen boundaries are mandatory. Preserve event-after-persistence wherever events are required or used.

Use DDD, aggregates, new bounded contexts, repository interfaces, domain events, Clean Architecture layouts, and expand/migrate/contract only when the actual workflow, risk, or an applicable approved rule requires them. Preserve established approved module structure. A CRUD screen using an existing API does not, by itself, justify creating these abstractions.

This proportional rule does not waive an existing mandate. For example, applicable Healthcare/Education 11-gate requirements and approved event/aggregate constraints remain in force until changed through their owning approval process. Protect boundaries; add architecture only with evidence and authority.

## Scoped Autonomy and Approval

Default: execute within delegated scope. Escalate: unresolved material business decisions or changes beyond granted authority. Stop: the dependent portion only.

| Situation | Required action |
| --- | --- |
| Existing contracts and approved rules support the requested change inside authorized layers. | Implement, test, fix related failures, and verify without asking for approval for each routine technical step or file. |
| Information can be verified from source, contracts, AGENTS.md, or applicable ACRs/ADRs. | Investigate before asking. Reuse approved decisions/defaults only while their scope and conditions remain valid. |
| Several technical choices have no material business, ownership, compatibility, or security difference. | Choose the smallest proven, compatible, recoverable option within scope and record the reason in the existing task record. |
| A material business rule is unresolved, or required change authority is missing. | Hold dependent implementation, provide evidence and a concrete proposal, and bundle the necessary owner decision where possible. Continue independent, authorized work. |

Do not request approval again for an explicit decision that still applies. Scope approval can cover source implementation, tests, related repairs, and verification within existing contracts and permissions.

Production operations, schema/migrations, ACL/grants or access-permission changes, public-contract/Kernel changes, and commit/push/merge/deploy actions require explicit authority for that category. If authority is missing, stop the dependent action, present the minimum concrete change and its evidence, and request the owner's decision. Continue independent, authorized work. Frozen-layer changes also retain their required ACR/ADR, approval, unlock, verification, and reseal process; task approval alone cannot bypass it. Follow the authorization already granted and the applicable repository/release process.

Reuse already-read rules and verified evidence while their source revision, scope, and effective conditions remain valid. Refresh affected sources when these change; do not repeatedly restart discovery or produce duplicate reports for an unchanged decision.

AI cannot grant itself authority. Calling an agent Architect or Reviewer does not create approval rights. Missing semantic evidence still triggers the Business Semantic Gate; independent tests must not invent the unresolved business expectation. Do not report a complete feature while a required dependency remains held.

### Protection Changes Require Independent Authority

An agent implementing a feature MUST NOT modify or disable branch protection, required checks, CODEOWNERS, protected paths, security policies, guard implementations, or their baselines/selectors merely to unblock that feature.

If a protection is defective, capture the root evidence and propose a separately scoped change for the authorized owner. Protection changes require approval independent of the feature they protect, plus relevant verification of both legitimate and prohibited cases. A passing self-edited guard or approval text authored by the implementing agent does not establish independent authorization. Keep the protected feature held where the unresolved control is required.

## Workflow Routing

Use existing procedures below; combine applicable rows for a mixed task. Record only the scope, authority, unresolved decisions, and verification needed by that task in its existing work record. The mandatory entry gate still applies where specified; this table adds no new report or approval stage.

| Task | Existing workflow and minimum focus |
| --- | --- |
| New Product / vertical | [Entry gate](#mandatory-entry-gate-for-new-osproduct-work) and [Product process](#additional-product-process): user/workflow scope, OS reuse, ownership, contracts, Product identity, and authorized layers. |
| New feature | [Business Semantic Gate](#business-semantic-gate), [Change Authority](#change-authority), and [continuous verification](#9-verify-continuously): proven behavior, reuse, affected workflow, and failure paths. |
| UI redesign / maintenance | [UI reconciliation](#ui-to-contract-reconciliation) and [UI change safety](#ui-driven-backend-change-safety): data/actions/permissions trace to existing contracts. Redesign requires the entry gate; presentation maintenance may use `UI_ONLY`. |
| OS / shared kernel change | [OS process](#additional-os-process), owning contracts/consumers, and applicable specialized constitution. Protected changes retain the [ACR/ADR/unlock process](../architecture/FREEZE_POLICY.md#modification-process). |
| Bug / security / migration | [Failure process](#failure-process), [tenant isolation](#30-multi-tenant-isolation-is-a-hard-invariant), and [security](#31-security-is-part-of-the-contract): root cause, minimum authorized fix, denial paths, and schema compatibility/recovery where affected. |
| Refactor / integration / dependency upgrade | [Boundary semantics](#5-preserve-boundary-semantics), [contract drift](#contract-drift-classification), and affected consumers: behavioral preservation, compatibility, and relevant regression. Use the [baseline checkpoint](#baseline-checkpoint-before-broad-cleanup) for broad cleanup. |
| Release readiness | [Operational Readiness SOP](OPERATIONAL_READINESS_SOP.md), applicable deployment governance, and Product-specific release criteria: real workflow evidence and a separate authorized merge/release/Go-Live decision. |

For new Products, G0 Request -> G1 Read-only Discovery -> G2 Scope/Authority -> G3 Minimal Implementation -> G4 Verification -> G5 Review/Merge/Release Decision is a summary of the existing 0-10 process, not six additional gates. G5 remains subject to repository and release authority.

## Fast, Correct, Evidence-Based Execution

This is the common execution rule for existing-product bug fixes, feature improvements, and new Products across Bella. Apply it with [Workflow Routing](#workflow-routing) and the applicable specialized rules; it adds no separate governance framework, report, sandbox, or agent requirement.

Optimize in this order: **business correctness -> completion speed -> sufficiently reliable evidence**. Complete the requested business outcome with the smallest safe change and fewest useful iterations. Test counts, report counts, agent counts, and architectural complexity are not delivery goals.

### Default Execution Loop

1. **Define the task.** Identify current behavior, expected behavior, acceptance criteria, and the smallest reproduction. For new work, identify the first core business workflow and how to verify it. Establish the authoritative source, public contract, owning boundary, and affected files/modules. Do not audit the whole system without evidence that the task requires it.
2. **Find the root cause.** Read the relevant code and run the smallest check that can reproduce the issue. Distinguish Product logic, data, configuration, environment, and test/fixture failures. Once evidence is sufficient for a safe fix, stop investigating unrelated branches and implement within authority.
3. **Make the minimum fix.** Change the proven owner and reuse existing services, contracts, and patterns. Do not add a framework, service, abstraction, migration, or agent without a demonstrated need and the required authority. Do not fabricate business data, present synthetic/fallback values as real data, bypass contracts or authorization, suppress a failure as `PASS`, or fix unrelated scope to make the entire suite green. Test fixtures must remain explicit test evidence, not runtime proof.
4. **Verify according to risk.** Run the reproducer and relevant regression checks. For API/UI changes, exercise the corresponding real user flow when the environment permits; record any missing evidence. For authorization, tenant isolation, financial behavior, or mutations, verify permitted and denied/failure paths, including persistence and side effects where affected. Select typecheck, lint, build, and wider suites according to impact and [Verification Selection](#verification-selection); every mandatory applicable gate remains required. Unit-test `PASS` does not prove Browser, Production, or Go-Live behavior.
5. **Review and hand over.** Use the existing review process, with independent review for security, data-integrity, public-contract, or broad changes. A small local bug does not automatically require multiple review layers or additional agents; review needs do not themselves activate Multi-Agent Mode. Report the root cause, main changes, actual verification results, remaining risk, and one concrete next action if acceptance is incomplete.

Apply [Scoped Autonomy and Approval](#scoped-autonomy-and-approval). An unrelated finding is not permission to expand scope: record it briefly, hold only its dependent work, and continue independent authorized delivery. Missing evidence alone is `NOT_PROVEN`, not an automatic `BLOCKED`; neither means `PASS`. Do not claim completion while an acceptance criterion remains unmet.

### Bounded Test and Environment Diagnosis

Use existing failure evidence first. By default, perform at most one additional diagnostic that can add new information. Continue diagnosis only when a clear reason exists, such as a new supported hypothesis or changed input, and state what the next check can resolve.

Separate an environment failure from a Product defect. If diagnosis or verification needs permissions, data, or resources outside scope, stop at that dependency and report the specific obstacle. Do not repeat an unchanged command, create another sandbox, or produce another artifact unless it increases understanding or confidence. Verification after a relevant fix or environment change is a new check, not an unchanged retry.

This diagnostic limit does not waive a required gate or turn `TIMEOUT`, `SKIPPED`, or `NOT_RUN` into `PASS`. Preserve the actual outcome under [Verification Results and Applicability](#verification-results-and-applicability).

### Completion and Stop Rule

| Task | Completion criteria |
| --- | --- |
| Bug fix / feature improvement | The reproduced defect or requested behavior meets acceptance criteria, verification confirms the expected behavior, and relevant regression checks support the affected workflow. |
| New Product | Core business workflows work through real contracts, access and data are controlled, applicable entry/verification gates are satisfied, and unfinished capabilities and evidence limits are disclosed. A missing required acceptance criterion prevents completion. |
| Go-Live | A separate authorized decision based on applicable operational, data, security, and recovery criteria. Code and test `PASS` alone cannot establish it. |

When acceptance and mandatory applicable checks are satisfied, record the scoped evidence and stop. Do not start another audit merely to accumulate proof. A local evidence seal does not authorize commit, push, merge, deploy, or a `SEALED_ON_MAIN` claim.

### Minimum Handoff

Use a short task response or the existing work record; do not create a separate report unless an applicable workflow requires it:

```text
Result: PASS / PARTIAL / HELD, qualified by task scope
Root cause: one or two sentences; for new work, the business need
Changes: principal files/modules
Verification: commands/tests and actual outcomes
Remaining: obstacles, risks, and properties not proven
Next: one concrete action or STOP
```

These are task-summary labels, not replacements for individual gate results. Task `PASS` means the authorized acceptance criteria and applicable checks are satisfied; `PARTIAL` means work or required evidence remains; `HELD` identifies a specific authority/decision or execution obstacle. Missing evidence alone does not justify `HELD`. Preserve `FAIL`, `BLOCKED`, `NOT_PROVEN`, `NOT_APPLICABLE`, and raw execution outcomes for each relevant check, and do not infer merge or release readiness from a task summary.

**Root Cause -> Minimal Fix -> Verify -> Seal -> Stop.**

## Verification Results and Applicability

Use the following vocabulary for individual verification gates, and always identify the scope and environment:

| Result | Meaning |
| --- | --- |
| `PASS` | The declared gate actually ran and met its acceptance criteria. |
| `FAIL` | The declared gate ran and did not meet its acceptance criteria. Classify the cause separately; failure is not automatically a Product regression. |
| `BLOCKED` | A specific identified obstacle prevented running or completing the required verification. Record the obstacle and the affected check. |
| `NOT_PROVEN` | Evidence is missing or insufficient to establish the stated property; this alone proves neither success nor a defect. |
| `NOT_APPLICABLE` | The check is outside this change's applicable scope, with a reason tied to the impact and governing policy. |

Retain actual commands, source revision/working-tree scope, environment, raw exit/conclusion, executed counts, and evidence references. Report `SKIPPED`, `NOT_RUN`, or `TIMEOUT` as observed; explain the verification result rather than rewriting the raw outcome. Missing credentials/schema are an execution obstacle, not proof of `NOT_APPLICABLE`. An infrastructure allowance or green aggregate job does not turn an unexecuted conformance/DB test into `PASS`.

List required and risk-related checks in the existing verification plan. Run every applicable gate mandated by CI, freeze/security policy, or a specialized constitution. Explain exclusions without inventing waivers. A required applicable gate that is `FAIL`, `BLOCKED`, or `NOT_PROVEN` does not establish merge readiness under its governing policy; an allowed narrower CI outcome must be reported as that allowance.

### Verification Selection

| Change impact | Verification to select in addition to mandatory applicable policy |
| --- | --- |
| UI using unchanged contracts | Relevant typecheck/lint and affected UI/behavior regression. |
| Business workflow | Invariants, integration, and affected E2E/failure paths. |
| Tenant authorization / RLS | Allowed access, denied access, and cross-tenant/role boundaries in the appropriate environment. |
| Shared contract / integration / dependency | Affected consumers, compatibility, and runtime regression for changed behavior. |
| Schema / migration | Migration safety, existing data compatibility, and rollback or forward recovery as appropriate. |

These are selection categories, not a requirement to run every test category for every PR. Existing wider mandatory gates remain mandatory. A documentation-only change does not acquire a runtime test requirement from this table alone.

Keep decision contexts separate: the entry gate below still uses `PASS` / `BLOCKED` / `DEFER` to decide implementation permission; the Operational Readiness SOP retains its own workflow statuses. `NOT_STARTED` describes task progress. `PROVEN`, `HELD`, `NOT_READY`, `SEALED_ON_MAIN`, and Go-Live labels retain their scoped meanings. None automatically converts into a gate result, merge authority, or release approval.

### Enforcement Evidence

For each claimed control, distinguish:

| State | Evidence required |
| --- | --- |
| Defined | Applicable rule, owner, protected scope, and expected behavior. |
| Automated | Executable checking logic exists for that scope. |
| Configured / wired | The actual tool/workflow invokes it under identified triggers and conditions. |
| Enforced | Current permissions or required-check policy makes the relevant rejection binding; state bypass/approval conditions. |
| Execution verified | Actual result bound to a source revision, environment, and exercised path. |
| Adversarially validated | Where relevant, prohibited cases are rejected and legitimate cases pass through the actual control. |

These are separate claims. A hook for one AI tool does not prove interception in another; a workflow file or successful check does not establish required merge protection. File existence, fixture tests, and historical suite counts do not prove frozen content integrity, Real DB/RLS behavior, or Go-Live.

Reuse existing controls before proposing additions. Verify the actual path and required-check configuration before claiming enforcement. Validate guard/policy changes in their separately authorized scope. For an authorized pilot, use existing task evidence to assess repeated questions, approval waits, delivery time, detected architecture errors, and gates with valid evidence; no new telemetry framework is required.

## 0. Truth -> Canonical -> Consumer

Before modifying code, distinguish these three concepts.

### Truth

Truth is the authoritative fact about the system for the question being answered.

Examples:

```text
Database structure     -> migration / verified DB schema
Generated DB shape     -> generated database types
Product identity       -> Product Registry
Architecture permission -> Architecture Constitution / ownership rules
Domain behavior        -> verified domain contract / producer
```

Truth is not automatically whatever existing code currently says.

### Source of Truth

Source of Truth is the authoritative source used to prove the Truth for the specific question being answered.

The AI coding agent must identify the correct Source of Truth before treating an existing behavior, field, status, schema, API, UI element, or test fixture as canonical.

### Canonical Contract

Canonical Contract is the official representation or access pattern Bella currently accepts for that Truth.

Canonical means:

```text
New code should follow this contract.
```

Existing or frequently used code is not automatically canonical.

### Consumer

Consumer is the code currently consuming the canonical contract.

Required reasoning:

```text
Truth
  ↓
Source of Truth
  ↓
Canonical Contract
  ↓
Ownership
  ↓
Boundary
  ↓
Consumer
```

If Consumer != Canonical, fix the stale Consumer.

If Truth is unclear, investigate before coding.

If Truth is known but Canonical Contract is unclear, defer and resolve ownership or architecture first.

If Canonical Contract does not exist, never invent one merely to satisfy TypeScript, UI, or CI.

If changing Canonical Contract is genuinely required, treat it as an explicit contract or architecture change, not as a local bug fix.

### Mandatory Pre-Coding Check

Before changing a field, type, schema, relation, query, API, RPC, DTO, domain model, status, action, or workflow:

1. What is the Truth?
2. What is the Source of Truth?
3. What is the Canonical Contract?
4. Who owns that contract?
5. Is this layer allowed to consume it?
6. Is the current Consumer stale?
7. Does a verified implementation already exist?
8. What change authority did the user request grant?
9. What is the minimum sufficient change?

Only then modify code.

### Business Semantic Gate

Before any AI Agent implements or creates tests for business-critical behavior, it must produce a business semantic proof that is independent from the current implementation.

The proof must identify:

```text
Business invariant
Canonical source of truth
Public contract
Domain semantic
Persistence semantic
Expected positive behavior
Expected negative behavior
Tenant / authorization invariant when relevant
Evidence source
```

The AI Agent must not derive business truth solely from:

```text
existing implementation
existing tests
database columns
naming conventions
foreign keys without semantic resolution
inferred relationships
```

Existing code can be evidence of current behavior, but it is not enough to prove intended business semantics.

If authoritative evidence is insufficient:

```text
BUSINESS_SEMANTICS = NOT_PROVEN
```

STOP.

Do not implement.

Do not create a passing test to establish the semantic.

For business-critical tests, the agent must first state a Business Test Contract:

```text
Business rule
Canonical source
Expected invariant
Positive case
Negative case
Tenant / authorization invariant when relevant
Evidence source
```

The expected values in that contract must come from approved business invariants, canonical contracts, canonical data sources, authoritative fixtures, or approved architectural decisions.

The complete Bella reasoning model is:

```text
TRUTH
  ↓
SOURCE OF TRUTH
  ↓
CANONICAL CONTRACT
  ↓
OWNERSHIP
  ↓
BOUNDARY
  ↓
CHANGE AUTHORITY
  ↓
CONSUMER
  ↓
IMPLEMENTATION
  ↓
VERIFICATION
```

Correct Truth plus correct canonical data plus wrong ownership is still wrong implementation.

## Core Incident Lesson

Most recent Bella failures were not caused by lack of code. They were caused by code written before proving ownership, contract, runtime semantics, execution environment, or closure evidence.

The permanent response is:

```text
LỖI
 ↓
Có phải PR gây ra?
 ↓
Truth là gì?
 ↓
Source of Truth là gì?
 ↓
Canonical contract là gì?
 ↓
Owner là ai?
 ↓
Layer này có quyền dùng contract đó?
 ↓
Semantics có thực sự tương đương?
 ↓
Minimal fix là gì?
 ↓
Verify
 ↓
STOP
```

## Accounting Legal-Source Rule

AI MUST NOT invent, infer, or hardcode Vietnamese accounting treatment, account
codes, debit/credit mappings, tax treatment, or accounting regimes from general
software knowledge.

Before implementing a new accounting mapping, there MUST be evidence from
authoritative Vietnamese sources applicable to the relevant entity type and
effective date.

Preferred evidence hierarchy:

1. Vietnamese legal normative documents and official government legal databases.
2. Ministry of Finance regulations and official guidance.
3. Official Ministry of Finance accounting/auditing authority interpretations.

Blogs, accounting websites, forums, StackOverflow, AI-generated explanations,
and vendor documentation MUST NOT be the canonical legal source.

Each implemented posting rule MUST record:

```text
legal_source
document_number
effective_date
applicable_regime
business_semantic
posting_rule
verification_status
```

If authoritative evidence is insufficient or conflicting, the implementation
status is:

```text
ACCOUNTING_POLICY_NOT_PROVEN
```

and AI MUST STOP. AI coding may implement only accounting mappings already
proven by an accounting specification with authoritative source evidence.

## Multi-Agent Coding Protocol

Status: ACTIVE.

Default execution is single-agent unless the user explicitly requests
Multi-Agent Mode or the current task context authorizes it after dependency and
ownership analysis.

```text
MULTI_AGENT = OFF
```

When Multi-Agent Mode is activated:

```text
MULTI_AGENT = ON
```

Parallelism is a means, not a requirement. Do not create extra agents merely to
increase agent count. Use the minimum number of agents required by the proven
task structure.

### Activation Rule

Multi-Agent Mode may be activated only when:

1. The user explicitly requests it; or
2. The Lead/Orchestrator determines that the task contains sufficiently
   independent workstreams and activation is authorized by the current task
   context.

If ownership, dependencies, architecture authority, or runtime semantics are
unclear, execute sequentially or stop at the boundary. Do not parallelize
uncertainty.

### Lead / Orchestrator Authority

One goal has one Lead. The Lead owns:

```text
task decomposition
dependency analysis
agent count
agent assignment
ownership boundaries
worktree allocation
branch strategy
PR strategy
merge order
cross-agent coordination
integration
final verification
seal decision
```

The Lead may delegate implementation or verification. The Lead MUST NOT
delegate architectural authority, frozen-kernel authority, product-boundary
authority, public-contract authority, major database architecture authority, or
Go-Live authority without explicit user or human architect authorization.

### Builder Agent Rules

A Builder Agent:

- Implements only its assigned scope.
- Works only inside its assigned worktree.
- Uses its assigned branch.
- Produces a coherent PR for its owned capability when PR work is requested.
- Runs required scoped verification.
- Reports evidence.
- Stops when the assigned boundary is complete.

A Builder Agent MUST NOT:

- Expand scope independently.
- Modify another agent's ownership.
- Edit another agent's worktree.
- Create speculative abstractions.
- Create a new global kernel.
- Modify frozen kernels without authorization.
- Bypass public contracts.
- Modify ProductRegistry outside assigned scope.
- Merge directly to `main`.

### QA / Verification Agent Rules

QA verifies tests, type safety, architecture guards, RLS/auth boundaries,
migration safety, integration behavior, regression, browser E2E when required,
and evidence completeness.

QA MUST NOT silently modify business implementation to make tests pass.

If implementation is wrong:

```text
FAIL
-> REPORT ROOT CAUSE
-> RETURN TO BUILDER / LEAD
```

### Worktree, Branch, and PR Isolation

Every Builder Agent MUST use an isolated worktree with independent uncommitted
changes and clearly assigned ownership.

Each implementation stream SHOULD have its own branch. Branch names SHOULD
identify product, capability, and purpose. Avoid generic branch names such as
`feature/fix`, `feature/test`, or `feature/new`.

Each independently owned capability SHOULD produce its own PR. A PR MUST
represent one coherent capability. Avoid one PR containing unrelated work from
multiple agents.

Builders MUST NOT merge directly to `main`. The Lead determines merge order
based on dependencies.

### Ownership Manifest

Before implementation, the Lead SHOULD define ownership for each agent by
directory, file, migration namespace, business capability, public contract, test
scope, or other clear boundary.

Example:

```text
Agent A

OWNERS:
  src/products/bella-hospitality/housekeeping/**
  hospitality_housekeeping_*.sql

FORBIDDEN:
  src/products/bella-hospitality/maintenance/**
  global resource kernel
  ProductRegistry outside assigned scope
```

Ownership is a boundary, not a suggestion.

### No Shared File Ownership by Default

Two active agents MUST NOT modify the same file unless the Lead explicitly
authorizes shared ownership.

High-risk shared files include:

```text
ProductRegistry
global route configuration
shared navigation
global contracts
Core OS services
frozen kernels
migration baseline files
shared type definitions
shared configuration
```

If two agents need the same file:

```text
SHARED OWNERSHIP REQUIRED
-> STOP
-> Lead decides
```

### Dependency Analysis Before Parallelization

The Lead MUST inspect dependencies before assigning parallel work. Classify work
as:

```text
INDEPENDENT
DEPENDENT
SHARED
BLOCKED
```

Independent work may run in parallel. Dependent work should wait until its
required contract is sealed.

### Dynamic Agent Count

Agent count is determined by task structure:

```text
1 agent    -> tightly coupled task
2 agents   -> two independent workstreams
3-5 agents -> multiple independent capabilities
>5 agents  -> only when collision risk is demonstrably low
```

Never create agents merely because capacity exists.

### Public Contract Boundary

Agents communicate across domains through public contracts.

Allowed:

```text
Product A -> Public Contract -> Product B
```

Forbidden:

```text
Product A -> Product B internal table
Product A -> Product B private repository
Product A -> direct database bypass -> Product B internals
```

Cross-domain ambiguity requires:

```text
STOP
-> Lead review
```

### Global and Frozen Kernel Protection

No Builder Agent may create or promote a global OS kernel without an explicit
architecture decision. This includes resource, availability, allocation,
transaction, workflow, or cross-industry kernels.

If an agent encounters a potential shared abstraction:

```text
STOP
-> REPORT ARCHITECTURE GAP
-> Lead / Architecture Decision
```

Frozen kernels MUST NOT be modified unless the task explicitly authorizes the
change through the required architecture process. This includes Healthcare,
Education, and Logistics kernels.

If implementation appears to require frozen-kernel modification:

```text
FROZEN KERNEL IMPACT
-> STOP
-> ESCALATE
```

Do not work around the restriction by creating hidden duplicate logic.

### ProductRegistry Protection

Product identity changes are controlled. A Builder MUST NOT independently
register a new product, rename a product key, change canonical product
ownership, or modify product resolver semantics unless Product Identity is
explicitly included in its assigned scope.

If multiple agents require registry changes, the Lead assigns ownership to one
agent or performs the integration centrally.

### Database, RLS, and Authentication Rules

Each agent SHOULD own its migration scope. Agents MUST NOT modify another
agent's migration, rewrite historical migrations, fix unrelated migration drift,
modify production baselines for convenience, bypass RLS, or use privileged
database access to hide authorization problems.

All agents MUST preserve:

```text
tenant isolation
user authorization
organization / branch boundaries
public authentication contracts
RLS semantics
```

No agent may make a test pass by disabling RLS, using service-role bypass
unnecessarily, injecting privileged clients, hardcoding tenant IDs, hardcoding
user IDs, or bypassing public contracts.

If authenticated runtime behavior cannot be proven:

```text
NOT_PROVEN
```

Do not convert it into `PASS` by weakening security.

### Type Safety and Evidence

Multi-Agent Mode does not relax Bella type-safety rules. Agents MUST NOT
introduce `any`, type escapes, suppressions, or casts merely to unblock
compilation. Existing historical violations must be distinguished from new
violations.

Every agent MUST report evidence for its completed scope:

```text
SCOPE
IMPLEMENTATION
TESTS
DATABASE / RLS
ARCHITECTURE
TYPE CHECK
LINT
MIGRATION
REGRESSION
RESULT
```

Gate results follow [Verification Results and Applicability](#verification-results-and-applicability). Other evidence/progress labels include:

```text
PROVEN
NOT_PROVEN
NOT_STARTED
```

Do not report `PASS` when evidence is `TIMEOUT`, `SKIPPED`, `NOT_RUN`, or
`ASSUMED`.

### Builder Execution Rule

Every Builder follows:

```text
Root Cause
-> Minimal Fix
-> Verify
-> Seal
-> Stop
```

Do not expand scope after the assigned capability is proven. Do not refactor
nearby unrelated code.

### Conflict Detection

If an agent discovers another agent owns the file or migration, a shared
contract must change, a frozen kernel must change, a new global abstraction is
required, product ownership is ambiguous, RLS/auth semantics conflict, or
another agent's implementation must be changed:

```text
STOP
-> REPORT
-> LEAD DECISION
```

Do not solve cross-agent conflicts independently.

### Pre-Existing Failures

Agents MUST distinguish:

```text
NEW REGRESSION
```

from:

```text
PRE-EXISTING FAILURE
```

A historical failure MUST NOT be silently fixed if it is outside scope.

Document:

```text
PRE-EXISTING
-> NOT CAUSED BY CURRENT CHANGE
-> NOT MODIFIED
```

Only fix it when explicitly included in scope.

### PR, Merge, and Main Verification

Before a PR is considered merge-ready, the Builder MUST provide branch,
worktree, scope, changed files, tests, database evidence, RLS evidence,
architecture evidence, typecheck, lint, migration verification, regression
status, and known findings.

After parallel implementation:

```text
Builder PRs
-> Lead integration
-> Regression
-> Real DB
-> Browser E2E where required
-> Full business chain
-> Seal
```

Integration is not complete merely because all PRs are individually green.

After merging a group of PRs:

```text
Run regression
-> Verify main
-> Verify affected product
-> Verify architecture
-> Verify DB/RLS
```

Do not assume:

```text
PR PASS = MAIN PASS
```

### Stop Conditions

The affected agent MUST stop when any of these is true:

```text
Architecture ambiguity
Cross-product ownership ambiguity
Shared kernel requirement
Frozen kernel modification
Public contract change outside scope
Shared file collision
Migration ownership conflict
RLS/auth bypass requirement
Unknown production behavior
Unverified dependency
Unexpected semantic change
Need for speculative abstraction
```

Status:

```text
STOPPED_AT_BOUNDARY
```

is preferable to unauthorized implementation.

### When Not to Use Multi-Agent Mode

Use a single agent when the task is small, tightly coupled, primarily
debugging, mostly touches the same files, depends on one end-to-end migration,
requires an architecture decision, has unclear ownership, or has unsettled
runtime semantics.

### Recommended Operating Flow

```text
USER GOAL
-> LEAD AUDIT
-> DECOMPOSE
-> DEPENDENCY ANALYSIS
-> OWNERSHIP ASSIGNMENT
-> CREATE WORKTREES
-> CREATE BRANCHES
-> PARALLEL BUILDERS
-> SCOPED VERIFICATION
-> INDIVIDUAL PRs
-> LEAD INTEGRATION
-> FULL REGRESSION
-> REAL DB / RLS
-> BROWSER E2E
-> FULL BUSINESS CHAIN
-> SEAL
-> STOP
```

Not every task requires every stage. Use only the stages required by the task
boundary.

### User Command and User Authority

The user may activate the protocol with:

```text
Enable Multi-Agent Mode for this task.
```

The user remains the final authority for architecture decisions, new OS
kernels, product boundaries, frozen-kernel changes, major public-contract
changes, major database architecture changes, Go-Live decisions, and
exceptional boundary overrides.

Final principle:

```text
One goal. One Lead. Clear ownership. Isolated worktrees. Isolated branches.
One capability per PR. Public contracts across boundaries. QA before merge.
Evidence before status. Seal before expansion.
```

## Bella OS & Product Development Process v1.0

Use this single process for every new Bella OS and Product. It exists to prevent technical debt before code starts while preserving Bella's rule against unnecessary bureaucracy.

### OS vs Product

```text
BELLA PLATFORM
│
├── PLATFORM CORE
│
├── BELLA FACTORY (software creation / verification / release governance)
│
├── INDUSTRY OS
│     ├── Healthcare OS
│     ├── Education OS
│     ├── Logistics OS
│     ├── Beauty OS
│     └── ...
│
└── PRODUCTS
      ├── Bella Hospital
      ├── Bella Preschool
      ├── Bella Haircut Shop
      ├── Bella Nail Shop
      ├── Bella English Center
      └── ...
```

OS owns reusable industry capability and domain semantics. Product packages capabilities into concrete software for users.

```text
Beauty OS
   │
   ├── Scheduling
   ├── Service
   ├── Staff
   └── Resource
          │
          ▼
Bella Haircut Shop
Bella Nail Shop
Bella Beauty Spa
```

OS must not be designed around one Product's UI. Product must not copy a domain engine that belongs to an OS.

### Standard Process

```text
0. Problem
      ↓
1. Truth
      ↓
2. Ownership
      ↓
3. Capability Map
      ↓
4. Reuse Analysis
      ↓
5. Contract
      ↓
6. Boundary & Data
      ↓
7. Minimal Implementation Plan
      ↓
8. Coding
      ↓
9. Verification
      ↓
10. Closure
```

Do not expand this into extra governance phases unless repeated evidence proves the current process is insufficient.

### Operational Readiness SOP

When a product moves from implementation correctness toward real customer operation, use `docs/governance/OPERATIONAL_READINESS_SOP.md`.

Operational readiness work is read-only first and must audit real business workflows rather than source folders, modules, or cleanup opportunities. The SOP defines operational statuses, workflow evidence chains, the `NOT_PROVEN` vs `BLOCKED` distinction, and the rule that operational audit must stop at the decision boundary before any implementation.

### Evidence and Boundary Leaf Controls

These controls clarify existing Bella principles. They are not a new governance framework and do not create new parent gates by themselves.

Evidence states must not be collapsed into each other:

```text
LOGIC_PROVEN
PROOF_RUN_CLEAN
GATE_PROVEN
ADOPTION_APPROVED
IMPLEMENTATION_AUTHORIZED
GO_LIVE_READY
GO_LIVE
```

A lower state creates evidence for the next decision only. It does not imply the next decision has been made. For example, `REAL_DB_LOGIC_PROVEN` or `GATE_PROVEN` does not imply `ADOPTION_APPROVED`, and `ADOPTION_APPROVED` does not imply `IMPLEMENTATION_AUTHORIZED` or `GO_LIVE`.

For tenant, branch, organization, or product-scoped mutation, the required order is:

```text
Resolve context
  -> authorize
  -> mutate
  -> emit side effects
```

If context resolution or authorization fails, the workflow must not perform a business mutation and must not emit downstream side effects. This applies to booking, session, attendance, inventory, payroll, commission, finance handoff, and equivalent workflows.

When a shared Platform or OS capability is already proven, mapped for the Product, and adoption-approved, the Product must consume the canonical contract instead of creating a duplicate subsystem. Product-local duplication is permitted only when new evidence proves the shared contract is missing or insufficient for the real workflow.

When a gate fails, fix the owning boundary only. Do not modify another subsystem or consumer merely to make the gate pass. A consumer workaround is valid only when the consumer is the proven owner of the root cause.

Proof must match runtime enforcement. Test fixtures, mocks, seeded arrangements, or static code paths can support evidence, but they do not prove a capability unless the runtime path enforces the same invariant and the evidence observes that enforcement.

### Mandatory Entry Gate for New OS/Product Work

Before coding any new OS, new Product, Product vertical, or Product UI redesign, the AI coding agent must produce or update `ARCHITECTURE_GATE_RESULT.md` for the current work scope.

The gate must cover:

```text
Problem / non-goals
Truth and Source of Truth
Ownership
Capability Map
Reuse Analysis
Canonical Contracts
Boundary & Data Flow
Change Intent & Change Authority
UI -> Contract Reconciliation when UI is involved
Minimal Implementation Plan
Verification Plan
```

The gate result must be one of:

```text
PASS
BLOCKED
DEFER
```

`PASS` means the work may proceed with a minimal implementation plan.

`BLOCKED` means ownership, contract, boundary, freeze, tenant/security, or architecture permission is unresolved. Do not write product/runtime code.

`DEFER` means the requested capability or UI element is valid to consider later, but there is not enough evidence to implement it safely in the current scope.

For UI redesign work, the gate must explicitly list every data-bound or action-bound UI element that introduces a field, KPI, status, action, filter, or workflow. Each one must conclude as `MATCH`, `STALE UI`, `MAPPING BUG`, `CAPABILITY GAP`, or `CONTRACT CHANGE REQUIRED`.

The gate must also state which layers the request authorizes changing. Requested scope is the default change boundary.

This is a lightweight entry gate, not a new framework. It should be short, specific, and evidence-backed.

For presentation-only maintenance (color, layout, spacing, typography, or icons with unchanged data, actions, states, and permissions), a brief `UI_ONLY` classification and relevant UI verification are sufficient; no standalone architecture report is required. A Product UI redesign still requires the entry gate above. Reuse its UI reconciliation as the Change Map below rather than creating a second report.

### 0. Define the Problem

Do not code yet. Answer:

```text
Đang xây cái gì?
Cho ai?
Giải quyết vấn đề gì?
Workflow thực tế là gì?
Phạm vi phiên bản đầu tiên?
Cái gì KHÔNG làm?
```

Start from the business workflow, not from tables.

### 1. Find the Truth

Identify the real domain facts before designing:

```text
Nghiệp vụ thực tế vận hành thế nào?
Entity thực sự là gì?
Lifecycle thực sự là gì?
Quan hệ nào thực sự tồn tại?
```

Acceptable sources of Truth include business operation, verified system behavior, database schema, migrations, existing domain engines, Product Registry, Architecture Constitution, and verified documentation. Existing code is not automatically Truth.

### 2. Determine Ownership

Every capability must be classified:

```text
PLATFORM
FACTORY
OS
PRODUCT
INTEGRATION
SHARED UI
```

If ownership is unclear, stop before coding.

### 3. Build Capability Map

Map capabilities before designing data:

```text
Capability          Owner       Existing?

Customer            Platform    YES
Booking             Beauty OS   YES
Service             Beauty OS   YES
Staff               Platform    YES
Commission          ?           investigate
Product presentation Product    NEW
```

This prevents a Product from recreating existing Platform or OS capability.

### 4. Reuse Before Create

For each capability:

```text
Có implementation verified?
        │
    ┌───┴────┐
   YES       NO
    │         │
 REUSE    Có thể EXTEND?
              │
          ┌───┴───┐
         YES      NO
          │        │
       EXTEND    LOCAL
```

The order is:

```text
REUSE -> EXTEND -> LOCAL -> ABSTRACT
```

Evidence of reuse creates abstraction. Abstraction must not be created to predict reuse.

### 5. Define Canonical Contract

For each contract, identify:

```text
Entity
ID
Fields
Enum
Nullable
Relation
Lifecycle
Owner
Consumer
```

Use the Rule 0 model:

```text
TRUTH
  ↓
SOURCE OF TRUTH
  ↓
CANONICAL CONTRACT
  ↓
OWNER
  ↓
CONSUMER
```

Do not let consumers invent fields such as `journey.current_stage` when the canonical relationship is `current_stage_id -> JourneyStage.id -> JourneyStage.code`.

### 6. Define Boundaries & Data Flow

Map the logical flow using the existing approved module structure; separate files or abstractions for every node are not required:

```text
DATABASE
   ↓
Repository / Mapper
   ↓
DOMAIN
   ↓
SERVICE / USE CASE
   ↓
API / DTO
   ↓
UI
```

Product code must consume OS or Platform through the allowed service/contract boundary, not direct internal table access.

Also verify:

```text
Tenant
AuthN
AuthZ
RLS
PII
Audit
```

### Change Authority

The requested change determines which layer the AI coding agent is authorized to modify.

Examples:

```text
UI redesign          -> Presentation layer
Mapping bug          -> Mapping / Repository boundary
Business-rule change -> Domain / Service
API contract change  -> API + affected consumers
Schema change        -> Database contract + affected layers
```

Do not expand the change into other layers because doing so is easier.

Example:

```text
"Redesign Bella Haircut Shop dashboard"
```

does not authorize:

```text
redesign database
change domain model
create new API
create new RPC
invent statuses
change business workflow
```

If implementation appears to require crossing the requested boundary:

```text
Requested Change
       ↓
Lower-layer change required?
       ↓
      YES
       ↓
Evidence proves requirement?
   ┌───────┴───────┐
  NO              YES
   ↓                ↓
 STOP         Report Contract /
              Capability Gap
                    ↓
          Explicit change required
```

Do not silently expand scope.

### 7. Minimum Implementation Plan

Plan only what the first proven workflow needs:

```text
Workflow nào cần chạy?
Capability nào cần cho workflow đó?
Contract nào cần?
File nào cần thay đổi?
Test nào chứng minh nó?
```

Do not include future architecture such as AI recommendation, generic workflow engines, advanced analytics, or dynamic rules frameworks unless the current workflow proves they are required.

### 8. Coding

Before each meaningful change, check:

```text
1. Truth là gì?
2. Source of Truth ở đâu?
3. Canonical Contract là gì?
4. Owner là ai?
5. Layer này có quyền dùng không?
6. Có implementation reuse được không?
7. Requested task có authorize đổi layer này không?
8. Minimal change là gì?
```

During coding, never invent schema, field, RPC, API, enum, or type; never use casts or suppressions to hide contract mismatch; never fake fallbacks, swallow errors, edit generated types for consumers, cross ownership boundaries, or weaken tests.

If evidence is insufficient, defer instead of guessing.

### 9. Verify Continuously

Do not wait until the end of a Product to test:

```text
Small implementation
      ↓
Targeted test
      ↓
Targeted lint/typecheck
      ↓
PASS
      ↓
Next implementation
```

Increase verification scope by checkpoint:

```text
Feature -> Domain -> Phase -> Product
```

### 10. Closure

Before saying `DONE`, `CLOSED`, `VERIFIED`, or `RC READY`, check the Definition of Done in this document.

If code is written but evidence is incomplete, report `IMPLEMENTED` or `UNVERIFIED`, not `VERIFIED`.

### Additional OS Process

New OS work must start with domain modeling:

```text
Business Reality
       ↓
Domain Vocabulary
       ↓
Entities
       ↓
Relationships
       ↓
Lifecycle
       ↓
Invariants
       ↓
Capabilities
       ↓
Contracts
       ↓
Implementation
```

An OS owns reusable domain semantics. It must not include Product-specific presentation, navigation, hero imagery, or terminology such as a single Product's dashboard label when those belong to Product Identity.

### Additional Product Process

New Product work starts with:

```text
Target Customer
      ↓
Business Workflow
      ↓
Required Capabilities
      ↓
Map capabilities -> Platform/OS
      ↓
Product-specific gaps
      ↓
Product Identity
      ↓
UX
```

Products must declare:

```text
productKey
requiredModules
navigationProfile
serviceProfile
themePreset
terminology
```

Module means what Bella can do. Product means what the user sees.

### UI to Contract Reconciliation

When a Product UI is redesigned, verify data-bound and action-bound elements against canonical contracts before coding or before accepting the redesign as correct.

Redesign may change:

```text
layout
spacing
typography
visual hierarchy
component presentation
responsive behavior
theme
UX organization
```

Redesign does not authorize:

```text
changing domain model
inventing fields
inventing KPIs
inventing statuses
inventing APIs
inventing DB columns
changing business workflow
changing action semantics
```

For every new or changed UI element that displays data or triggers behavior, trace:

```text
UI element
     ↓
Field / KPI / Action / State?
     ↓
Canonical capability exists?
   ┌──────┴──────┐
  YES            NO
   ↓              ↓
Map contract     GAP
   ↓              ↓
Implement UI    STOP
               do not invent
```

Use a focused reconciliation table:

```text
UI element | UI expectation | Canonical contract | Backend reality | Conclusion
```

Allowed conclusions:

```text
MATCH
STALE UI
MAPPING BUG
CAPABILITY GAP
CONTRACT CHANGE REQUIRED
```

`MATCH` means the existing canonical capability fully supports the UI.

`STALE UI` means the UI is using an old or incorrect contract; fix the UI consumer.

`MAPPING BUG` means the capability exists, but mapping, DTO, or presentation adaptation is missing; add the minimum correct mapping at the correct boundary.

`CAPABILITY GAP` means the required business capability does not exist; stop and report it separately.

`CONTRACT CHANGE REQUIRED` means the existing canonical contract is proven insufficient or incorrect for a real business requirement; handle it as an explicit contract change with ownership, affected consumers, and regression verification.

Check only data, actions, states, and workflows. Do not expand a contract reconciliation into a visual audit of color, icon, font, or spacing.

### UI-Driven Backend Change Safety

This rule applies across Bella Platform, OS, and Products when a redesigned UI, new field, button, screen, or user workflow may affect backend behavior. It extends the existing Business Semantic Gate, Change Authority, and UI to Contract Reconciliation; it does not create a new agent system or approval workflow.

#### Mandatory Pre-Code Review and Change Map

Before implementation, read the applicable Bella rules, product/public contracts, ADRs, and existing implementation. Identify the current proven baseline with its evidence and preserve working behavior. Existing implementation proves current behavior only; it cannot establish intended business semantics on its own.

Record a minimal Change Map in the task's existing gate or work record:

```text
UI change / intended user action
Classification(s)
Proven baseline / evidence source
Reusable data / API / service / public contract / owner
New or changed field / API / business rule / state transition / permission
Canonical Truth / authoritative source for each business-critical field or state
Authorized layers / unresolved owner decisions
Required tests / security checks / regression / rollback considerations
```

Use these classifications per change; more than one may apply. Classification describes impact and never grants change authority.

| Classification | Meaning |
| --- | --- |
| `UI_ONLY` | Presentation changes with unchanged data, actions, states, contracts, and permissions. |
| `EXISTING_CAPABILITY_REUSE` | UI consumes an existing verified capability through its established public contract. |
| `BACKEND_EXTENSION` | An explicitly authorized addition in the owning backend layer, supported by proven requirements. |
| `CONTRACT_OR_SCHEMA_CHANGE` | A public contract or persisted data structure must change; identify owner, consumers, compatibility, and migration semantics. |
| `SENSITIVE_BUSINESS_CHANGE` | Financial behavior, identity/ownership, permissions, isolation, security, or frozen architecture may change. |

Keep effort proportional to impact:

| Change | Minimum handling |
| --- | --- |
| Color, layout, icon maintenance | Brief `UI_ONLY` classification, confirm behavior is unchanged, inspect affected UI; no large Change Map. |
| Filter using an existing API | Verify supported filter semantics, reuse the contract, test the affected path. |
| Data field | Prove its authoritative source, mapping, validation, and persistence when applicable before choosing a UI or backend change. |
| Business workflow | Change Map with contracts, owner, transitions, permissions, regression, and failure-path evidence. |
| Payment, authorization, OS/kernel, or risky schema change | Full evidence proportional to impact; stop at any unresolved authority boundary. |

A short classification may be recorded in the task response for small changes. Reuse existing task artifacts; do not require a second report or rerun unrelated product gates for presentation maintenance. Stricter applicable freeze, security, and architecture gates remain mandatory.

#### Implementation Boundaries

- UI is not the source of truth for business rules, permissions, or transaction states.
- A new UI field does not imply a new database column. Inspect the existing model and contracts first.
- Never create a second canonical source or bypass public contracts to satisfy the UI. Reuse existing APIs, services, and domain logic where their semantics match.
- Enforce backend authorization and tenant isolation independently of frontend controls.
- Preserve backward compatibility and proven workflows unless an approved change explicitly requires otherwise.
- Respect frozen OS/kernel boundaries and ADRs. Do not introduce unrelated refactoring, abstractions, frameworks, or ProductRegistry entries.

#### Owner Decision Boundary

Apply [Scoped Autonomy and Approval](#scoped-autonomy-and-approval) within the task's established contracts, permissions, and authorized layers. A UI request alone does not authorize a backend extension.

Stop the affected portion and request an explicit owner decision when a business rule is unresolved or an unapproved change materially affects:

- Canonical data ownership or identity.
- Database schema or migration semantics with material compatibility risk.
- Financial transactions, deposits, refunds, cancellations, or reconciliation.
- Authorization, tenant isolation, or security boundaries.
- Frozen OS/kernel contracts or approved architecture decisions.
- Production data operations or irreversible actions.

Frozen-kernel work still requires its existing ACR/ADR and unlock process; task approval alone cannot bypass it. When business semantics are unproven, apply `BUSINESS_SEMANTICS = NOT_PROVEN` and stop that implementation. Apply the common autonomy rule to continue independent, authorized work without repeating an approval already given.

#### Verification and Closure

Run relevant existing tests and add tests where new behavior requires them. Verify affected critical legacy workflows, authorization, tenant isolation, invalid inputs, and failure paths where applicable. If data structures change, verify migrations, compatibility, and the rollback/recovery plan in the appropriate environment. Record actual commands, results, evidence, and any unexecuted checks with reasons.

Use scope-qualified evidence states according to the applicable Bella conventions:

- `PROVEN`: the stated invariant has executed supporting evidence in the stated environment.
- `NOT_PROVEN`: evidence is missing or insufficient; this alone does not prove a defect.
- `NOT_READY`: a required readiness criterion is unmet; identify it.
- `HELD`: work or release is held at a stated decision/authority boundary.
- `SEALED_ON_MAIN`: the scoped change is merged and verified on the actual main commit with required evidence. Local work or PR checks alone cannot establish it.

These are distinct findings, not an automatic promotion sequence or substitutes for stricter product readiness gates. A successful build, UI preview, or isolated test does not prove complete product readiness or Go-Live.

Follow `Evidence First -> Root Cause -> Minimal Fix -> Verify -> Seal -> Stop`. Do not expand beyond authorized scope.

### Missing Capability Process

If Product A needs capability X, do not automatically move X to Platform or OS.

```text
Product A needs X
      ↓
OS already has X?
 ┌────┴────┐
YES        NO
 │          │
REUSE   Product-local?
             │
          YES
             ↓
           LOCAL
```

Only after Product B and Product C also need X, and their semantics are proven equivalent, consider extraction.

### Failure Process

When a failure appears, do not fix immediately:

```text
FAILURE
   ↓
Reproduce
   ↓
Find Truth
   ↓
Find Source of Truth
   ↓
Find Canonical Contract
   ↓
Check Ownership
   ↓
Classify Root Cause
```

Classify as:

```text
CODE BUG
STALE CONSUMER
CONTRACT DRIFT
TYPE_ONLY_CHANGE_WITH_UNATTRIBUTED_RUNTIME_FAILURE
SCHEMA DRIFT
FIXTURE DRIFT
ENVIRONMENT
ARCHITECTURE
PRE-EXISTING
CASCADE
```

Then apply one root cause, one minimal fix, targeted verification, stop.

### Type-Only Failure Triage

A type-local change is not automatically a runtime regression.

If a runtime test fails after a type-only or cleanup change:

```text
1. Reproduce and capture the first/root failure.
2. Classify patch-induced vs pre-existing vs baseline vs fixture drift.
3. Do not update fixtures, expected values, mocks, or runtime code merely to make the test pass.
4. Open a contract/runtime change only when evidence proves the type-local patch exposed or caused that contract issue.
```

Until attribution is proven, the status is:

```text
TYPE_ONLY_CHANGE_WITH_UNATTRIBUTED_RUNTIME_FAILURE
```

### Test Fixture Validity

Fixtures are contracts too. Before treating a failing fixture as a product regression, verify whether the fixture is still valid for the canonical execution environment.

Fixtures that depend on current period, current state, active tenant data, DB clock, generated schema, RLS policy, or runtime business contract must either:

```text
derive from DB/application clock and canonical state
```

or be:

```text
intentionally frozen, documented, and executed only in the environment that satisfies that freeze
```

Do not classify failures such as stale period lookup, stale tenant setup, or stale generated schema as a regression until the fixture has been proven current. A stale fixture is `FIXTURE DRIFT`; fix or defer the fixture according to ownership and change authority.

### Contract Drift Classification

`CONTRACT DRIFT` means a consumer expects a public path, symbol, DTO, interface, export, enum, schema field, RPC, or method shape that does not match the current canonical contract.

Before modifying a consumer or producer, identify:

```text
Consumer expectation
Canonical public path
Canonical symbol/export
DTO/interface/schema/RPC owner
Runtime semantics
Allowed compatibility model, if any
```

Do not create compatibility aliases, fake interfaces, widened DTOs, casts, or fallback fields merely to make TypeScript, tests, or CI pass. Compatibility is a contract decision and must be approved in the owning layer.

### CI Failure Process

When CI is red:

```text
CI FAIL
   ↓
Find first/root failure
   ↓
Separate cascade failures
   ↓
Compare origin/main if necessary
   ↓
Classify
   ↓
Minimal fix
   ↓
Targeted rerun
   ↓
Full required gates
```

Do not fix every red check independently when an aggregate or cascade failure comes from a single root job.

### Eleven Immutable Principles

```text
BELLA ENGINEERING CONSTITUTION

1. TRUTH BEFORE ASSUMPTION.
   Không đoán hệ thống hoạt động thế nào.

2. OWNERSHIP BEFORE CODE.
   Biết capability thuộc đâu trước khi implement.

3. REUSE BEFORE CREATE.
   Không tạo thứ đã tồn tại.

4. CANONICAL CONTRACT BEFORE CONSUMER.
   Consumer phải theo contract, không ngược lại.

5. BOUNDARIES MUST BE RESPECTED.
   Đúng dữ liệu nhưng sai layer vẫn là sai.

6. CHANGE AUTHORITY BEFORE IMPLEMENTATION.
   Requested scope quyết định layer được phép thay đổi.

7. NEVER INVENT A CONTRACT.
   Không invent field/type/schema/RPC/API.

8. NEVER HIDE A FAILURE.
   Không cast/suppress/weaken test để xanh CI.

9. MINIMUM SUFFICIENT IMPLEMENTATION.
   Chỉ xây cái hiện tại có evidence cần.

10. ZERO NEW TECHNICAL DEBT.
   Code mới phải sạch từ đầu.

11. EVIDENCE BEFORE CLOSURE.
    Không evidence -> không VERIFIED/CLOSED.
```

### Standard AI Coding Prompt

Use this prompt at the start of new OS/Product work:

```text
Follow Bella Engineering Constitution and OS/Product Development Process.

Before coding: establish Business Truth -> Source of Truth -> Ownership -> Existing Capabilities -> Canonical Contracts -> Boundaries -> Change Authority -> Minimal Scope.

During coding: reuse before create; never invent schema/type/API/RPC; never bypass ownership; never use suppression/casts to hide contract mismatch; implement only proven requirements.

When uncertain: investigate or DEFER - never guess.

Before closure: verify TypeScript, ESLint, Architecture, relevant tests, tenant/security boundaries and regression evidence. Code written is not equivalent to DONE.
```

The entire process compresses to:

```text
BUSINESS TRUTH
      ↓
OWNERSHIP
      ↓
CAPABILITY
      ↓
REUSE
      ↓
CANONICAL CONTRACT
      ↓
BOUNDARY
      ↓
CHANGE AUTHORITY
      ↓
MINIMAL IMPLEMENTATION
      ↓
VERIFY
      ↓
EVIDENCE
      ↓
CLOSE
```

## 1. Ownership Before Code

Before creating or modifying a capability, identify the owner:

```text
Platform?
Factory?
OS?
Product?
Integration?
Shared UI?
```

If ownership is unclear, do not code yet.

Correct data in the wrong layer is still wrong implementation. For example, a Product layer direct query to an internal OS table can be architecturally invalid even when the table contains the right data.

## 2. Reuse Before Create

The mandatory order is:

```text
REUSE
 ↓
EXTEND
 ↓
LOCAL IMPLEMENTATION
 ↓
ABSTRACT
```

Do not create a Factory, Manager, Provider, Registry, Adapter, Generic Engine, or framework because it may be useful later. Add abstraction only after repeated evidence proves it removes real complexity inside the correct ownership boundary.

## 3. Canonical Contract Before Consumer

Before a consumer uses any field, type, API, or behavior, verify:

```text
Consumer expectation
        ↓
Generated type
        ↓
Schema / Migration
        ↓
Producer
        ↓
Domain semantics
```

Do not infer the canonical contract from stale consumer code. If a consumer expects `customer.referred_by` but the canonical contract is `customer.referrer_id`, fix the stale consumer. Do not add a fake field to make the compiler green.

## 4. Never Invent Schema, Field, RPC, API, or Type

If code references a table, field, RPC, API, or type that canonical evidence does not prove, defer it.

Examples:

```text
auto_sales
auto_quotations
some_missing_rpc()
ContractDefinition
```

A TypeScript error may be architecture debt or schema debt, not type debt. Do not repair it by inventing contracts.

## 5. Preserve Boundary Semantics

The logical flow is represented below; preserve existing approved structure as explained in [Mandatory Invariants and Conditional Techniques](#mandatory-invariants-and-conditional-techniques):

```text
Database
   ↓
Repository / Mapper
   ↓
Domain
   ↓
Service
   ↓
API / DTO
   ↓
UI
```

Each layer has its own contract. Do not assume that because the database is `snake_case`, the Domain must also be `snake_case`. Mapper changes must preserve runtime semantics, not merely reduce diagnostics.

## 6. Foreign Key Is Relationship, Not Business Meaning

A foreign key identifies a relationship. It does not automatically carry the business meaning of the referenced entity.

Example:

```text
current_stage_id
      │ FK
      ▼
auto_journey_stages.id
      ↓
code = "delivered"
```

When business logic needs a referenced entity's attribute, resolve the relation and use the canonical business field. Do not infer business state directly from the FK.

## 7. Read Contract Is Not Write Contract

Proof that a read path maps correctly does not prove write-path equivalence.

Example:

```text
quantity_on_hand -> stock_level
item_code        -> sku
```

This read evidence does not prove the semantics of:

```text
reserve()
release()
deduct()
quantity_reserved
inventory_transactions
```

Write paths must be proven separately, especially for Inventory, Finance, Booking, Reservation, Payment, Capacity, and Workflow transitions.

## 8. Product Identity Owns Presentation

Modules define what the system can do. Products define what users see.

New products must declare:

```text
productKey
navigationProfile
serviceProfile
themePreset
requiredModules
```

Do not use `moduleKey` as Product Identity. Do not let one Product inherit another Product's presentation by fallback. Unknown Product means neutral, not another Product.

## 9. Shared UI Uses Semantic Tokens

Theme resolution order is:

```text
Explicit Tenant Theme
        ↓
Product Default Theme
        ↓
Platform Neutral Default
```

Shared UI must not hardcode a Product-specific color or style as a universal default.

## 10. Nullability Is Business Information

Before changing or masking nullability, determine:

```text
NULL means what?
undefined means what?
No record means what?
Is fallback behavior valid for the business?
```

Do not fix TypeScript with `value!`, `value as string`, or `value ?? ''` unless the semantics are proven.

## 11. Cast Is Not a Contract Fix

Do not hide mismatch with:

```ts
as any
as unknown as X
@ts-ignore
@ts-expect-error
```

The correct flow is:

```text
Type error
   ↓
Read producer
   ↓
Read canonical contract
   ↓
Determine mismatch
   ↓
Map / Narrow / Fix stale consumer
```

For literal unions, use the canonical allowlist or type guard when needed.

## 12. Generated Types Are Evidence, Not a Repair Surface

Generated database types are used to verify:

```text
table
field
nullable
enum
relation
RPC
```

Do not hand-edit generated types to satisfy a consumer. If generated types and migrations disagree, investigate the source of truth.

## 13. Architecture Ownership Beats Diagnostic Count

Correct architecture is more important than a lower TypeScript diagnostic count.

Do not violate Core Freeze, OS boundary, Product Constitution, Platform ownership, or frozen integration contracts to reduce diagnostics.

## 14. Data Correctness Does Not Override Ownership

Before a query, answer both:

```text
1. Is this canonical data?
2. Does this layer have the right to access it?
```

Only `YES + YES` permits implementation.

## 15. Change Intent Defines Change Authority

The requested change determines which layer the AI coding agent is authorized to modify.

Requested scope is the default change boundary. Do not expand the task into other layers because doing so is easier or because a higher-layer consumer expects data, status, behavior, or UI affordances that lower layers have not proven.

Examples:

```text
UI redesign          -> Presentation layer
Mapping bug          -> Mapping / Repository boundary
Business-rule change -> Domain / Service
API contract change  -> API + affected consumers
Schema change        -> Database contract + affected layers
```

For a presentation request such as `Redesign Bella Haircut Shop dashboard`, the default authority is presentation. It does not authorize database redesign, domain model changes, new APIs/RPCs, invented statuses, or workflow changes.

If implementation requires crossing the requested boundary, stop and report the required lower-layer change as a `CAPABILITY GAP`, `CONTRACT_CHANGE_REQUIRED`, or explicit architecture decision. Do not silently expand scope.

## 16. Tests Must Follow Production Contract

When production code is corrected to the canonical contract, fixtures and mocks must follow that contract.

Do not revert production to an obsolete contract merely because old tests fail.

## 16A. Tests Must Be Independent From Implementation

A test must not use the implementation under test as the source of truth for its expected result.

Expected values must come from:

```text
approved business invariant
canonical contract
canonical data source
authoritative fixture
approved architectural decision
```

Do not write expectations such as:

```text
expected = repositoryMappedValue
actual   = repositoryResult
```

when the repository, mapper, service, or consumer is the behavior being tested.

For business-critical mappings, the expected value must be derived from the canonical semantic source. For example, a Laboratory result patient link must be checked against the patient of the canonical clinical order, not against a value reconstructed by the Laboratory repository being tested.

## 17. Test Doubles Must Model the Boundary They Replace

Database mocks that cover multiple tables must be table-aware. Do not let `.from('anything')` return the same fixture for every table.

The standard is minimum faithful mock, not a full fake database.

## 18. Integration Tests Must Declare Execution Requirements

If a test needs real Supabase, PostgreSQL, migrations, network, or credentials, its execution contract must declare that requirement.

Do not run an integration test in a non-DB Jest job and then treat `mock.supabase.co` or `ENOTFOUND` as a product failure. Reuse canonical credential-gating patterns when they exist.

## 19. Never Weaken Tests to Make CI Green

Do not:

```text
delete assertions
skip because the test is failing
increase global timeout
mock away behavior being tested
exclude the test from selector
catch or swallow errors
```

Skip or gate only when the execution environment is proven not to satisfy the test contract, and the test still runs in the correct environment.

## 20. Attribute Failures Before Fixing

A red CI result is not automatically a PR regression. Classify first:

```text
PR_REGRESSION
PRE_EXISTING
ENVIRONMENT
FIXTURE_STATE
CONTRACT_DRIFT
SCHEMA_DRIFT
BASELINE_DRIFT
CASCADE
```

Each class has a different fix path.

## 21. Compare With Main Before Blaming the PR

When a CI failure is unclear, compare PR behavior with `origin/main` under the same selector, environment, command, and fixture.

If main also fails, do not call the failure a PR regression.

## 22. Fix Root Failure, Not Cascade Failure

Do not investigate aggregate failures as independent root causes.

Examples:

```text
Affected Tests failed
       ↓
All Required Gates failed
```

Fix the root failure. The cascade should clear after the root clears.

## 23. Cancel Expensive CI After Proven Blocking Failure

If a blocking failure is already proven while expensive jobs continue, it can be appropriate to cancel heavy jobs such as full typecheck, baseline comparison, or heavy integration runs.

This is an operational optimization only. It must never be used to hide unverified gates before merge.

## 24. Zero New Technical Debt From Day One

New OS/Product work must start with:

```text
TypeScript diagnostics = 0
ESLint errors          = 0
Architecture violation = 0
```

Do not create a temporary baseline to handle later. Historical debt in existing Bella areas is being cleaned up; new work must not create the next generation of historical debt.

## 25. BAD_NEW Is Immediate Authority During Cleanup

During historical cleanup:

```text
BAD_NEW > 0 -> FAIL
BAD_NEW = 0 -> checkpoint may be valid
```

Raw diagnostic count is useful only when no new bad diagnostics are introduced. The final target remains absolute diagnostics = 0.

Residual cleanup is not authorized merely because raw violations remain.

If remaining violations belong to any of these categories:

```text
frozen scope
contract gap or contract drift
generated artifact
DB / RLS / business contract
business semantic not proven
core-adjacent boundary
governance-required decision
```

then the cleanup campaign must stop at that boundary unless the user explicitly authorizes the owning workstream. Create or update a residual-boundary record that includes:

```text
official sealed baseline
raw scanner count
classification by ownership/root cause
required approval or workstream for each residual class
commands/evidence used
```

A non-zero official baseline can be a sealed governance boundary. It must not be reported as unfinished cleanup when all remaining items are classified residuals that require separate authority.

### Baseline Checkpoint Before Broad Cleanup

Before a workstream that can touch many contracts, generated types, baseline findings, or cleanup batches, create a checkpoint:

```text
clean working tree or isolated worktree
fresh full typecheck or explicit TIMEOUT / NOT_VERIFIED status
baseline comparison
relevant architecture/security guards
commit checkpoint when authorized
PR checkpoint when authorized
```

Historical artifacts do not prove current readiness. A baseline checkpoint is valid only when its commands, commit, branch, and scope are recorded.

## 26. Fresh Verification at the Required Scope Is Final Authority

Closure requires current evidence for the acceptance criteria, affected behavior, and every mandatory applicable gate. Use [Verification Selection](#verification-selection) to select the smallest sufficient checks for the change's risk.

Run full typecheck, build, or broader regression when impact, CI, freeze/security policy, a specialized constitution, or the approved verification plan requires it. Do not infer a universal full-suite requirement for every small bug or documentation change, and do not repeat passed checks without a relevant change, failure, or unresolved concern.

Reuse evidence only while its source revision, working-tree scope, environment, and effective conditions remain valid. Refresh affected evidence when these change. Stale cache or old artifacts cannot establish current closure.

## 27. Easy + Proven + Local First

During cleanup, fix only when the issue is:

```text
EASY
+
PROVEN
+
LOCAL
```

Defer when a diagnostic pulls into recursive types, `TS2589`, query-builder redesign, schema invention, RPC creation, generic/conditional type design, unclear business semantics, or architecture ownership decisions.

## 28. One Root Cause, One Minimal Fix, Verify, Stop

Do not opportunistically:

```text
refactor a file
rename code
clean imports across a domain
redesign an interface
add abstraction
fix unrelated warnings
```

A cluster is closed when the cluster's root cause is resolved. The entire file does not need to be zero if residual diagnostics belong to other root causes.

## 29. Deferred Is a Valid Engineering Decision

`DEFER` means there is not enough evidence to safely fix the issue in the current scope.

Examples:

```text
ContractDefinition -> Platform architecture decision
quantity_reserved  -> Inventory behavior decision
journey.status     -> lifecycle semantics unclear
TS2589             -> query/type-system complexity
residual any-types -> sealed baseline with classified residual boundary
```

Deferred debt belongs in an appropriate workstream, not forced through TypeScript cleanup.

## 30. Multi-Tenant Isolation Is a Hard Invariant

Every OS/Product must define:

```text
tenant_id
authorization
RLS
service-role path
cross-tenant prevention
```

No feature is done if tenant isolation is unresolved.

## 31. Security Is Part of the Contract

Every input boundary must consider:

```text
validation
authentication
authorization
tenant scope
PII
injection
audit
```

Security is not a final hardening phase; it is part of the implementation contract.

## 32. UI Is Not the Domain Engine

UI should collect input, present state, and invoke use cases.

UI must not own business invariants, financial calculations, inventory transitions, workflow state machines, or authorization decisions. Those belong to the correct domain/service layer.

## 33. UI Must Not Invent Domain Capabilities

Redesigning presentation does not authorize changing business contracts.

Every field, KPI, status, action, filter, and workflow shown in UI must trace to a verified canonical capability or contract.

If a UI design requires a capability that does not exist, mark it as `CAPABILITY GAP` or `NEW CAPABILITY / GAP`. Do not invent backend schema, fields, APIs, RPCs, DTOs, statuses, or business semantics to make the UI work.

The required reverse trace is:

```text
UX/UI DESIGN
     ↓
UI element
     ↓
Field / KPI / Action / State?
     ↓
API / DTO
     ↓
Service
     ↓
Domain
     ↓
Repository
     ↓
DB
```

Both directions must meet at the canonical contract:

```text
           CANONICAL CONTRACT
                 │
       ┌─────────┴─────────┐
       ↓                   ↓
DB -> Domain -> Service    UI
       ↑                   ↑
       └────── MATCH ──────┘
```

If they do not meet, the UI is promising users something the system has not proven it can do.

## 34. Evidence Before Closure

Do not report:

```text
DONE
VERIFIED
CLOSED
READY
```

merely because code was written.

Closure requires evidence selected by acceptance criteria, risk, and mandatory applicable policy under [Verification Selection](#verification-selection). The following list describes applicable evidence, not a universal command checklist for every task:

```text
contract verified
targeted tests PASS
TypeScript PASS
lint PASS
architecture PASS
security/tenant verification when relevant
regression check PASS
```

If required evidence is missing, keep the acceptance decision incomplete and report its actual verification result and cause. Use `NOT_PROVEN` for insufficient evidence and `BLOCKED` only for an identified execution obstacle; do not convert either into `PASS`. Follow the [minimum handoff](#minimum-handoff) and stop when the scoped completion criteria are met.

## Definition of Done for New OS/Product Work

```text
BELLA OS / PRODUCT - DEFINITION OF DONE

□ Ownership rõ
□ Reuse đã được kiểm tra
□ Canonical contract được xác minh
□ Không invent schema/type/API/RPC
□ DB -> Repository -> Domain -> Service -> API -> UI boundary đúng
□ FK/relation được resolve đúng semantics
□ Read/write contracts được chứng minh riêng khi cần
□ Product Identity rõ
□ UI data/action/state/workflow trace được tới canonical contract
□ Tenant isolation đúng
□ AuthN/AuthZ đúng
□ Null semantics rõ
□ Không any/suppression workaround
□ Không sửa generated type để chiều consumer
□ Không vi phạm Core/Frozen/Architecture boundary
□ Test fixture/mock theo production contract
□ Integration test chạy đúng environment
□ TypeScript = 0 đối với code mới
□ ESLint errors = 0
□ Architecture gates = PASS
□ Relevant tests = PASS
□ Security gates liên quan = PASS
□ Không regression ngoài scope
□ Có evidence trước khi CLOSED
```

## Default Stop Conditions

Stop the dependent implementation and report status when any of these is true. Continue only independent, authorized work under [Scoped Autonomy and Approval](#scoped-autonomy-and-approval):

```text
Owner is unclear
Canonical contract is missing or contradictory
Current layer does not have access rights
Requested change does not authorize modifying the required layer
Read/write semantics are not proven
Fix requires frozen/core/kernel modification
Fix requires inventing schema, RPC, API, field, or type
Fix requires unapproved compatibility alias or public contract expansion
Residual cleanup crosses a classified residual-boundary record
UI requires an unverified status, action, KPI, or workflow
New business semantics would need to be invented
Business semantic proof is insufficient or only derived from implementation/tests
Execution environment cannot satisfy the test contract
Verification evidence is stale or unavailable
```

Report the implementation decision separately from [verification results](#verification-results-and-applicability). Use the applicable decision/finding label, such as `DEFER`, `HELD`, `HOTSPOT`, or `UNVERIFIED`; identify any `BLOCKED` or `NOT_PROVEN` verification and its cause. Do not claim PASS without executed evidence.
