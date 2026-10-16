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
now uses an authenticated JWT for an existing active Auth/public user in an active
tenant and verifies persisted data stays unchanged after
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
| Canonical E2E Phase 6 suite after approved migration | PASS, 19/19, including authenticated history immutability |
| BDGF approval entrypoint regressions | PASS, 19/19 |
| Main BDGF URI/TLS, identity, execution-path and owner rehearsal regressions | PASS, 65/65 |

All 8 previously reported Phase 6 diagnostics are resolved without casts,
suppressions, generated-type edits or schema changes. Number-generation failure
now stops before insert; the history test no longer treats a missing column or
missing row as immutability proof. PostgREST query failures throw at their source.
The root application tsconfig excludes test files; its full result is recorded
in the final verification section below, separately from test-entrypoint checks.

The service tests use a table-aware query double to observe consumer predicates.
They do not prove RLS, authorization, DB persistence or browser behavior.

## Approved E2E execution and evidence limits

- Real DB Phase 6: PASS, 19/19 on canonical E2E `bmnbqbcdbuklhopfbopv`. Initial
  schema drift was resolved after explicit human approval by executing existing
  migration `20260804360000` through BDGF, not direct executor SQL.
- The final suite preflights those columns before fixture writes and rejects any
  target other than canonical E2E. `.env.test` was verified to point to production
  and was not used. The test cannot become green by substituting production.
- BDGF URI investigation confirmed reserved password parsing as the first
  execution blocker. Main PR #343 independently supplies the canonical URI/TLS
  implementation; the conflict resolution adopts it unchanged, including verified
  TLS and executor identity checks. The temporary duplicate parser is not retained.
- Applied migration SHA-256: `23bcf0f6fb4b7221d12d4fc24d13c02d3a53feb7fa807a5f3cab053c1ec75514`.
  Approval: `055497f6-9a39-4a40-aabf-2018d6362b5f`.
- Normal migration-ledger/lifecycle finalization also used BDGF. Approval:
  `0120a02e-b2e2-40c7-9f34-1dd308f6869e`. Both approval records and tokens are used.
  Ledger contains version `20260804360000`, and the four prerequisite columns exist.
- The first post-migration test exposed invalid random identity; the repaired
  fixture resolves an existing active Auth/public user in the same active tenant.
  No user/tenant provisioning, auth changes or RLS-policy relaxation was performed.
- After the successful run, no Phase 6 test customer remains; fixture teardown
  completed without errors and only targets run-owned IDs plus tenant scope.
- Browser E2E / production / Go-Live: NOT_PROVEN.
- Existing October 13 NOT_READY closure in the source checkout is historical;
  it must not be presented as current database state.
- No new/edited migration file, ProductRegistry, Manufacturing, frozen kernel,
  Core, Finance or business lifecycle change. Only the approved existing migration
  was deployed to E2E. Production was not mutated.

## Final verification

Conflict with main `0639dd98f` (PRs #343 and #345) was limited to the shared root
architecture-gate header. Both sets of gate records were retained. BDGF scripts
match main exactly, preserving its verified TLS and executor-identity checks;
the intermediate local URI parser was discarded before integration.

Final application typecheck: PASS, exit 0, fresh
`node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false`
after the negative control had finished and final consumer files were restored.
Typecheck output was empty. This does not include the separately checked tests.
Only the recovery files are eligible for the local commit; cache logs, old
untracked documents, build directories, env files and schema dumps are excluded.
