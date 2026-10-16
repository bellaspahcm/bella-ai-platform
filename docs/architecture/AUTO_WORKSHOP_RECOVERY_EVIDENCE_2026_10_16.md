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

Phase 6 fixtures use current dates matching number generators, reject null/error
RPC results, and update the real service-history description field. The RLS test
now uses an authenticated JWT and verifies persisted data stays unchanged after
a valid-column mutation attempt. Fixture IDs are generated per run; teardown is
limited to owned IDs and their tenant. Existing vehicle and tenant are read only.

## Executed local verification

| Command / inspection | Result |
| --- | --- |
| `npm test -- --runTestsByPath src/__tests__/bella-auto-workshop-security.test.ts src/__tests__/bella-auto-workshop-tenant-scope.test.ts --runInBand` | PASS, 2 suites / 6 tests |
| Same tests against unmodified main consumer files | Expected FAIL, 5 failed / 1 passed; restored files then reran 6/6 PASS |
| ESLint on all 6 changed/new TypeScript files | PASS, exit 0; repository ESLintIgnoreWarning only |
| `npm run arch:guard` | PASS, frozen artifacts and dependency boundaries |
| `git diff --check` | PASS |
| Strict TypeScript including only the two new test entrypoints | PASS |
| `node node_modules/typescript/bin/tsc -p tsconfig.auto-workshop-tests.json --pretty false` | PASS, 0 diagnostics including the complete Phase 6 suite |

All 8 previously reported Phase 6 diagnostics are resolved without casts,
suppressions, generated-type edits or schema changes. Number-generation failure
now stops before insert; the history test no longer treats a missing column or
missing row as immutability proof. PostgREST query failures throw at their source.
The root application tsconfig excludes test files; its full result is recorded
in the final verification section below, separately from test-entrypoint checks.

The service tests use a table-aware query double to observe consumer predicates.
They do not prove RLS, authorization, DB persistence or browser behavior.

## Evidence limits

- Real DB Phase 6: BLOCKED_SCHEMA_DRIFT. Canonical E2E run exposed 7 failures / 12
  passes because migration `20260804360000` has not been applied to that database.
  Missing `scheduled_date` is the first appointment error; repair-order denormalized
  fields are also absent. No passing RLS claim is made from this failed run.
- The final suite preflights those columns before fixture writes and rejects any
  target other than canonical E2E. `.env.test` was verified to point to production
  and was not used. The test cannot become green by substituting production.
- Current metadata/policy inspection was read only. No schema deployment ran.
- The existing migration has no matching approval record in the E2E BDGF registry;
  see `AUTO_WORKSHOP_E2E_SCHEMA_REPAIR_PLAN_2026_10_16.md` for the remaining boundary.
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
