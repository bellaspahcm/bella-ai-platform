# Architecture Gate Result - Retail Sale Compatibility Contracts

Date: 2026-10-11

## Bella OS/Product Development Process Gate

Result: PASS_FOR_MINIMAL_COMPATIBILITY_CONTRACT_DELTA_ONLY.

Approved scope is the two sealed Retail Core audit gaps only: Logistics-owned stock-out compatibility for Retail Sale references, and Finance/Integration Runtime-owned `submit_financial_intent` schema compatibility. This does not approve Retail Sale runtime, POS, ProductRegistry/HQ onboarding, FreshFood, Kid Clothing, Go-Live, or accounting posting rules.

## Product Manifest

- Product/OS: Retail OS future consumer; implementation owner changes are in Logistics and Integration Runtime.
- Capability in scope: make the existing public stock-out contract capable of carrying sale/sales_order evidence; align `submit_financial_intent` RPC with existing runtime tables.
- Non-goals: no Retail Sale runtime orchestration, no sale table creation, no ProductRegistry/HQ product key, no vertical product work, no COGS/revenue accounting policy.

## Ownership Map

| Data / Behavior | Owner | Decision |
| --- | --- | --- |
| Stock issue, inventory movement, traceability, stock-out idempotency | Logistics | may extend public stock-out contract narrowly |
| Retail sale identity and sale-line identity | Retail | consumed as source references only; no Retail runtime in this batch |
| Financial intent submission, runtime outbox, idempotency registry, audit log | Integration Runtime / Finance boundary | may repair RPC compatibility with existing schema |
| Finance accounting treatment, GL, debit/credit, COGS policy | Finance OS | not modified |
| Product identity / ProductRegistry | Platform Product Registry | not modified |
| Frozen Logistics Kernel E7.1/E7.2/E7.3 | Logistics Kernel | not modified |

## Contract Dependency Map

```text
Future Retail Sale
  -> Logistics public stock-out contract
  -> Logistics inventory movement / traceability / idempotency evidence

Future Retail Sale
  -> Finance/Integration Runtime public financial-intent submission
  -> runtime_outbox / runtime_idempotency_registry / runtime_audit_log evidence
```

## Change Authority

Allowed:
- Extend `WarehouseStockOutCanonicalFacade` public command types for `sales_order` and `sale`.
- Preserve existing warehouse issue, disposal/damage/loss, and production-consumption behavior.
- Add or adjust focused tests for the new public contract behavior.
- Add a new compatibility migration that replaces `submit_financial_intent(TEXT, TEXT, JSONB)` with a body matching current runtime schemas.

Not allowed:
- Modify frozen Logistics Kernel artifacts.
- Implement Retail Sale runtime or POS UI.
- Modify Finance ledger/accounting internals or add posting rules.
- Add ProductRegistry/HQ onboarding keys.
- Edit generated DB types by hand.

## UI -> Contract Reconciliation

- Existing warehouse canonical stock-out UI may expose `sales_order` / `sale` as a manual public-contract exercise path.
- No Retail POS or Retail Store UI is implemented in this batch.

## Additive Migration Plan

- No new table or index.
- Add one new migration with `CREATE OR REPLACE FUNCTION public.submit_financial_intent(TEXT, TEXT, JSONB)` only.
- Do not rewrite historical migrations and do not hand-edit generated database types.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: ensure changed files stay within Logistics public stock-out, Integration Runtime RPC migration, tests, and this gate.
2. Contract Boundary: Retail references pass through public Logistics/Finance contracts only.
3. Tenant Isolation: preserve `get_auth_tenant_id()` and tenant-scoped idempotency.
4. RLS & Authorization: preserve authenticated-only RPC grants and Logistics RLS/table paths.
5. Database Migration Safety: add replace-function migration only; no table rewrite.
6. Event-After-Persistence: Logistics event remains after movement/traceability persistence in facade flow.
7. Domain Safety Routing: no Healthcare/Education/frozen Logistics Kernel modification.
8. Temporal Provenance: no historical migration edits.
9. Rule Governance: no accounting treatment or GL policy invented.
10. Audit & Evidence Integrity: report static/unit verification separately from live DB proof.
11. Regression: run focused Logistics stock-out tests, static migration/type checks where possible, and `git diff --check`.

## Result

PASS_FOR_MINIMAL_COMPATIBILITY_CONTRACT_DELTA_ONLY.

## Verification Evidence

Runtime/local verification completed on the implementation worktree
`C:\Users\DELL\.codex\worktrees\retail-sale-compat\BELLA SPA ERP`.

| Gate | Result | Evidence |
| --- | --- | --- |
| Dependency restore | PASS | `npm ci --ignore-scripts` completed from `package-lock.json`; no `package.json` or `package-lock.json` diff. |
| Logistics focused test | PASS | `npm test -- src/platform/logistics/warehouse/__tests__/stock-out-canonical.facade.test.ts --runInBand`: 1 suite, 13 tests passed. |
| Finance migration static test | PASS | `npm test -- src/platform/integration-runtime/__tests__/submit-financial-intent-migration.test.ts --runInBand`: 1 suite, 3 tests passed. |
| Logistics frozen guard | PASS | `npm run logistics:verify`: Architecture Guard passed; Logistics domain tests 15 suites / 547 tests passed. |
| TypeScript | PASS | `npm run type-check -- --pretty false` completed successfully. |
| Diff hygiene | PASS | `git diff --check` completed successfully. |
| Remote migration check | BLOCKED_BY_ENV | `npm run db:migration:check` failed with `LegacyProjectNotLinkedError`; Supabase project is not linked in this worktree. |
| Live DB RPC/E2E | NOT_PROVEN | `tests/e2e/runtime/3c-security-gate.e2e.test.ts` is aligned to the current schema, but live execution is blocked because the shell has no Supabase URL/anon/service credentials. |

## Seal Classification

LOCAL_STATIC_COMPATIBILITY_VERIFIED.

This is not Go-Live proof and not live DB proof. Retail Sale runtime remains out of scope and unimplemented.

Decision accepted on 2026-10-11. No additional implementation scope is approved in this batch. The next eligible batch, if opened, should address live DB migration/RPC verification in an explicitly permitted environment.

## Security E2E Contract Update

Decision date: 2026-10-11.

The stale runtime security E2E contract has been updated to the current runtime schema:

- `runtime_outbox.id` is the outbox primary key evidence, replacing old `outbox_id` assertions.
- `runtime_idempotency_registry.outbox_id` remains the outbox reference evidence and now also asserts `intent_type` and `correlation_id`.
- `runtime_audit_log` evidence is located by `correlation_id` and `entity_id`, replacing removed `action`, `actor_id`, and audit `outbox_id` assertions.
- The RPC migration now derives runtime tenant context from `auth.jwt() ->> 'tenant_id'` as text, with `public.get_auth_tenant_id()::TEXT` fallback, matching runtime RLS and table schemas.

Updated verification:

| Gate | Result | Evidence |
| --- | --- | --- |
| Finance migration static test | PASS | `npm test -- src/platform/integration-runtime/__tests__/submit-financial-intent-migration.test.ts --runInBand`: 1 suite, 3 tests passed. |
| TypeScript | PASS | `npm run type-check -- --pretty false` completed successfully after the E2E contract update. |
| Security E2E live run | BLOCKED_BY_ENV | `npx vitest run tests/e2e/runtime/3c-security-gate.e2e.test.ts` loaded the file but stopped in `beforeAll` with `PRECONDITION FAILED: Missing Supabase credentials`; 10 tests skipped before DB writes. |
| Diff hygiene | PASS | `git diff --check` completed successfully after the E2E contract update. |

Live DB compatibility remains `NOT_PROVEN` until a permitted Supabase project is linked and credentials are provided.

## Live DB Verification Attempt

Attempt date: 2026-10-11.

Result: `LIVE_DB_NOT_PROVEN`.

Preflight evidence:

- No Supabase environment variables are present in the shell: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and `DATABASE_URL` are all unset.
- `supabase/.temp` is missing, so this worktree has no local Supabase project link metadata.
- Supabase CLI is available (`npx supabase --version` returned `2.115.0`).

Command evidence:

| Gate | Result | Evidence |
| --- | --- | --- |
| Remote migration check | BLOCKED_BY_ENV | `npm run db:migration:check` failed with `LegacyProjectNotLinkedError: Cannot find project ref. Have you run supabase link?`. |
| Security E2E live run | BLOCKED_BY_ENV | `npx vitest run tests/e2e/runtime/3c-security-gate.e2e.test.ts` loaded the suite, then stopped in `beforeAll` with `PRECONDITION FAILED: Missing Supabase credentials`; 10 tests skipped before DB writes. |
| Diff hygiene | PASS | `git diff --check` completed successfully after the live DB preflight attempt. |

Interpretation: the live DB path is blocked by missing permitted environment/project configuration. This is not evidence of runtime failure and not evidence of runtime success.

## Live DB Verification Attempt 2

Attempt date: 2026-10-11.

Result: `LIVE_DB_BLOCKED_BY_REMOTE_MIGRATION_DRIFT`.

The original checkout contains `.env.test` and Supabase link metadata. A read-only remote migration check was run by loading `.env.test` into the command process only; no secrets were copied into this worktree or printed.

Command evidence:

| Gate | Result | Evidence |
| --- | --- | --- |
| Remote migration check with `.env.test` | BLOCKED_BY_REMOTE_MIGRATION_DRIFT | `npm run db:migration:check` reached the remote DB; local latest migration is `20261011193000`, remote latest migration is `20261008060000`, and the remote DB is missing many local migrations including this batch's `20261011193000` RPC compatibility migration. |
| Security E2E live run | NOT_RUN | Deliberately not run because the remote DB is behind the local migration baseline; running DB-writing E2E would not verify the intended schema. |

Interpretation: this remote database is not a valid proof target for the current compatibility batch until migrations are applied by an authorized process. Live Finance RPC, tenant isolation, idempotency, and audit behavior remain `NOT_PROVEN`.

## Remote DB Baseline Verification - Read Only

Attempt date: 2026-10-11.

Task: Verify Retail Sale test database baseline - READ ONLY.

Result: `LIVE_DB_BLOCKED_BY_REMOTE_MIGRATION_DRIFT`.

Read-only identity and baseline evidence:

| Check | Result |
| --- | --- |
| Environment purpose | `UNKNOWN_READ_ONLY`; local `.env.test` and E2E fixtures suggest test usage, but read-only metadata does not prove the DB is safe to mutate. |
| Remote DB connectivity | PASS |
| Local migration count | `530` |
| Remote migration count | `437` |
| Local latest migration | `20261011193000` |
| Remote latest migration | `20261008060000` |
| Remote-only migrations | `0` |
| Missing local migrations on remote | `93` |
| Runtime tables | Present: tenant registry, outbox, idempotency registry, audit log |
| E2E tenant fixtures | Present and active: `3/3` |
| `submit_financial_intent(text,text,jsonb)` | Present, returns `uuid` |
| DB-writing E2E ready | NO |

The full missing migration version list is recorded in `docs/implementation-artifacts/spec-retail-sale-compatibility-contracts.md`.

Decision: do not apply migrations and do not run DB-writing E2E on this remote database until an environment owner confirms purpose and authorizes a migration-baseline plan, or provides a separate test DB already at the required baseline.

## E2E Database Preflight

Attempt date: 2026-10-11.

Result: `E2E_DB_NOT_READY_FOR_WRITES`.

Read-only / dry-run evidence:

| Check | Result |
| --- | --- |
| `.env.test` required key names | Present: DB URL, public URL, anon/publishable key, service-role key |
| JWT secret for Security E2E | `.env.test` lacks JWT secret; `.env.local` has one and points to the same Supabase URL as `.env.test` |
| Canonical E2E project-ref guard | `.env.test` does not match the canonical E2E project ref used by existing repo guard scripts |
| Migration drift | BLOCKED: remote latest `20261008060000`, local latest `20261011193000`, 93 local migrations missing |
| Batch migration dry-run | PASS: `scripts/apply-e2e-pr-migrations.cjs --files supabase/migrations/20261011193000_fix_runtime_submit_financial_intent_schema.sql --dry-run` listed the intended migration and performed no DB mutation |

Decision: do not run DB-writing Security E2E and do not apply migrations to this E2E DB from this task. It first needs explicit confirmation as the intended isolated E2E target plus an authorized migration-baseline plan.
