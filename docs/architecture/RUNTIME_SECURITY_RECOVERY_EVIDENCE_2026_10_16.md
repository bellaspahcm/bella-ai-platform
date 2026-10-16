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

## Executed local verification

| Command / inspection | Result |
| --- | --- |
| `npm test -- --runTestsByPath src/__tests__/vitest-env-selection.test.ts src/platform/integration-runtime/__tests__/submit-financial-intent-migration.test.ts --runInBand` | PASS, 2 suites / 8 tests |
| Env selection subprocess cases using synthetic values only | PASS: default, explicit path, Bella alias, primary precedence, preserve process env |
| ESLint on Vitest config, Security E2E and new env test | PASS, exit 0; repository ESLintIgnoreWarning only |
| Strict TypeScript for Vitest config and new env test | PASS |
| Strict TypeScript for Security E2E + config | Existing TS2307 in `tests/utils/e2e-fixtures.ts:9`; identical failure with main Security E2E restored |
| `npm run arch:guard` | PASS |
| `git diff --check` | PASS |

The shared E2E helper imports nonexistent `runtime-domain.types`. Redirecting it
to the existing FinancialIntent type would also require resolving Date/source
fixture semantics across other tests. This pre-existing boundary is deferred;
no compatibility alias, schema invention or type suppression is introduced.

## Evidence limits

Runtime Security Real DB E2E: NOT_RUN / NOT_PROVEN. `.env.test` and `.env.e2e`
do not supply the required JWT secret. The `.env.local` environment is not used
as an unverified substitute. No credentials are copied to this worktree.

The 3 migration tests are static contract evidence; the 5 env tests execute the
real configuration loader. Neither proves the new E2E case against a database.
No Production, deployment, schema, migration, RLS, runtime implementation,
ProductRegistry, Manufacturing, frozen kernel or Core modification.

Result: local harness recovery is verified; full Security E2E remains NOT_PROVEN.
