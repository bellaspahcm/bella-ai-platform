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

## Verification Packet

For every QA pass, produce:

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
