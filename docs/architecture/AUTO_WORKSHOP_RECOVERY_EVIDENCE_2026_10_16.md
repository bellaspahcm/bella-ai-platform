# Auto Workshop Recovery Evidence

Date: 2026-10-16
Base: `5483cc55e` (`origin/main` at recovery).
Branch: `codex/recover-auto-workshop-security`.
Source: dirty primary checkout at `f6ed9cec7`; source files were copied, not moved.

## Scope and root cause

Eight workshop queries had object-ID predicates without the caller tenant:
five appointment UI queries, two repair-order service queries and one reminder
update. Main already contains the RLS repair migration from PR #300. This batch
adds missing consumer predicates and preserves that migration unchanged.

Recovered Phase 6 fixtures replace six stale date literals with current dates,
matching number generators that count current-date records. This is fixture
alignment, not proof that those database tests currently pass.

## Executed local verification

| Command / inspection | Result |
| --- | --- |
| `npm test -- --runTestsByPath src/__tests__/bella-auto-workshop-security.test.ts src/__tests__/bella-auto-workshop-tenant-scope.test.ts --runInBand` | PASS, 2 suites / 6 tests |
| Same tests against unmodified main consumer files | Expected FAIL, 5 failed / 1 passed; restored files then reran 6/6 PASS |
| ESLint on all 6 changed/new TypeScript files | PASS, exit 0; repository ESLintIgnoreWarning only |
| `npm run arch:guard` | PASS, frozen artifacts and dependency boundaries |
| `git diff --check` | PASS |
| Strict TypeScript including only the two new test entrypoints | PASS |
| Strict TypeScript including new tests and existing Phase 6 DB test | 8 diagnostics, identical messages to main after normalizing line numbers; zero new diagnostics |

The 8 pre-existing Phase 6 diagnostics concern nullable RPC number results and
an excess `work_description` update property. They are not fixed in this scope.
The root application tsconfig excludes test files; its full result is recorded
in the final verification section below, separately from test-entrypoint checks.

The service tests use a table-aware query double to observe consumer predicates.
They do not prove RLS, authorization, DB persistence or browser behavior.

## Evidence limits

- Real DB Phase 6: NOT_RUN / NOT_PROVEN. The existing teardown deletes by tenant
  across workshop tables; an isolated target has not been established here.
- Current target RLS / grants: NOT_PROVEN. No database probe or deployment ran.
- Browser E2E / production / Go-Live: NOT_PROVEN.
- Existing October 13 NOT_READY closure in the source checkout is historical;
  it must not be presented as current database state.
- No schema, migration, ProductRegistry, Manufacturing, frozen kernel, Core,
  Finance or business lifecycle changes.

## Final verification

Final application typecheck: PASS, exit 0, fresh
`node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false`
after the negative control had finished and final consumer files were restored.
Typecheck output was empty. This does not include the separately checked tests.
Only the recovery files are eligible for the local commit; cache logs, old
untracked documents, build directories, env files and schema dumps are excluded.
