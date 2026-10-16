# Runtime Security Test Recovery Evidence

Date: 2026-10-16
Base: `5483cc55e` (`origin/main` at recovery).
Branch: `codex/recover-runtime-security-tests`.

## Scope and contract reconciliation

Recover explicit env-file selection in Vitest. Precedence is `VITEST_ENV_FILE`,
then `BELLA_VITEST_ENV_FILE`, then `.env.local`. Existing process env wins because
dotenv uses `override: false`.

Add one explicit metadata E2E case for correlation, entity, source, amount and
currency across outbox/idempotency/audit records. Canonical authority is Runtime
architecture v1.1 and migration
`20261011193000_fix_runtime_submit_financial_intent_schema.sql`.

All main Security E2E tests and assertions are preserved, including server
metadata defaults, blank intent-type rejection, anon privilege boundary,
duplicate rejection and atomicity checks. No runtime contract or DB change.

Both stale Runtime QA helper imports now consume the existing public FinancialIntent
type. Valid fixtures use a Date and top-level source. The malformed-date fixture
remains deliberately invalid raw input; the runtime type/schema are unchanged.

## Executed local verification

| Command / inspection | Result |
| --- | --- |
| `npm test -- --runTestsByPath src/__tests__/vitest-env-selection.test.ts src/platform/integration-runtime/__tests__/submit-financial-intent-migration.test.ts --runInBand` | PASS, 2 suites / 8 tests |
| Env selection subprocess cases using synthetic values only | PASS: default, explicit path, Bella alias, primary precedence, preserve process env |
| ESLint on Vitest config, Security E2E and new env test | PASS, exit 0; repository ESLintIgnoreWarning only |
| Strict TypeScript for Vitest config and new env test | PASS |
| `node node_modules/typescript/bin/tsc -p tsconfig.runtime-security-tests.json --pretty false` | PASS, 0 diagnostics including Security E2E, helper fixtures/mock, config and fixture regressions |
| `vitest run tests/unit/runtime/e2e-fixtures.test.ts --reporter=verbose` | PASS, 12/12; valid fixtures/overrides/batch accepted and malformed inputs still rejected |
| `vitest run tests/e2e/runtime/3c-security-gate.e2e.test.ts --reporter=verbose` on canonical E2E | PASS, 11/11, including explicit metadata |
| `npm run arch:guard` | PASS |
| `git diff --check` | PASS |

The pre-existing missing import and Date/source mismatches are resolved in the
QA consumer layer. No compatibility alias, runtime contract widening, schema
invention or type suppression is introduced.

## Evidence limits

Runtime Security Real DB E2E: PASS, 11/11, on verified canonical project
`bmnbqbcdbuklhopfbopv`. The E2E-scoped `JWT_E2E` alias was verified and mapped to
`SUPABASE_JWT_SECRET` in the child process only, while explicitly loading
`.env.e2e`. No secret values or env files are copied to this worktree.

The 3 migration tests are static contract evidence; the 5 env tests execute the
real configuration loader. The separate 11-test Security run supplies Real DB
evidence; fixture unit tests alone do not establish database behavior.
No Production, deployment, schema, migration, RLS, runtime implementation,
ProductRegistry, Manufacturing, frozen kernel or Core modification.

Result: scoped harness/fixture checks and Security Real DB E2E PASS. Production,
full Product operation and Go-Live remain NOT_PROVEN.
