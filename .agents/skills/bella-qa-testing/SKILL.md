---
name: bella-qa-testing
description: Bella QA and testing wrapper that routes verification work to existing BMAD code-review and QA-generation skills while enforcing Bella evidence rules. Use for scoped verification, test strategy, code review routing, and evidence completeness.
---

# Bella QA & Testing Wrapper

## Purpose

Use this wrapper when Bella work requires QA, testing, or verification evidence. This is not a new standalone persona. It coordinates existing BMAD QA-related skills with Bella evidence standards.

## Existing BMAD Skills

Use these before inventing anything new:

- `bmad-code-review`
- `bmad-review-edge-case-hunter`
- `bmad-review-adversarial-general`
- `bmad-qa-generate-e2e-tests`
- `bmad-checkpoint-preview`

## QA Rules

- QA must not silently modify business implementation to make tests pass.
- QA must distinguish `PR_REGRESSION`, `PRE_EXISTING`, `ENVIRONMENT`, `FIXTURE_STATE`, `CONTRACT_DRIFT`, `SCHEMA_DRIFT`, `BASELINE_DRIFT`, and `CASCADE`.
- QA must verify the root failure, not aggregate cascade failures.
- QA must not treat `TIMEOUT`, `SKIP`, `NOT_RUN`, or `ASSUMED` as `PASS`.
- QA must not weaken tests, bypass RLS, disable assertions, or mock away behavior under test.
- Select checks and environment by affected behavior/risk under the Constitution. Use existing suites and valid evidence; do not create a Test DB, rerun unrelated regression, add review layers or repeat an unchanged check merely to fill a process stage.
- A real DB/Auth/RLS claim still needs the actual enforcement boundary and persistence/denial evidence. Isolated fixtures in an existing safe authorized environment can suffice without a disposable database. Keep required CI/freeze/security checks binding.

## Verification Packet

Record the relevant fields in the existing task response/work record; reuse evidence references and do not create a duplicate QA report:

```text
SCOPE:
FILES / ROUTES / COMMANDS:
EXPECTED CONTRACT:
TESTS RUN:
RESULT:
FAILURE CLASSIFICATION:
EVIDENCE:
GAPS:
NEXT ACTION:
```

## Routing

- Code diff or implementation review: use `bmad-code-review`.
- Boundary and branch-condition analysis: use `bmad-review-edge-case-hunter`.
- Broad artifact critique: use `bmad-review-adversarial-general`.
- New API/E2E test generation after implementation is approved: use `bmad-qa-generate-e2e-tests`.
- Human review walkthrough: use `bmad-checkpoint-preview`.

## Seal Rule

Return `PASS` only when the relevant tests and evidence actually ran and support the scoped claim. Otherwise return `NOT_PROVEN`, `BLOCKED`, or `NOT_STARTED`.
