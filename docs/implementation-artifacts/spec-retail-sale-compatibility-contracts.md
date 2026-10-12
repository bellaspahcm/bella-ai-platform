---
title: 'retail-sale-compatibility-contracts'
type: 'feature'
created: '2026-10-11'
status: 'sealed-local-static'
context:
  - '{project-root}/docs/architecture/ARCHITECTURE_GATE_RESULT_RETAIL_SALE_COMPATIBILITY_2026_10_11.md'
  - '{project-root}/docs/governance/BELLA_AI_CODING_CONSTITUTION.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The sealed Retail Core audit found two concrete compatibility gaps blocking a future canonical Retail Sale runtime: Logistics stock-out cannot carry sale/sales_order evidence end to end, and `submit_financial_intent` is statically incompatible with current runtime table schemas.

**Approach:** Implement only the two owner-local compatibility deltas: extend the Logistics public stock-out contract for Retail Sale references, and replace the Finance/Integration Runtime RPC body so it writes the current `runtime_*` schema. Do not implement Retail Sale runtime.

## Boundaries & Constraints

**Always:** Preserve Logistics ownership of stock issue/movement/traceability/idempotency, preserve Finance ownership of semantic intent/outbox/audit, derive tenant/actor from authenticated context, and keep existing warehouse and production-consumption behavior working.

**Ask First:** Any change requiring frozen Logistics Kernel modification, Finance ledger/accounting treatment, ProductRegistry/HQ onboarding, Retail POS/runtime orchestration, or generated type edits.

**Never:** Do not repurpose `product_sales`, create FreshFood/Kid Clothing runtime, write Retail directly into Logistics or Finance internals, invent GL/debit/credit/COGS policy, or claim Go-Live readiness.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Retail sale stock-out | `issueDocument.type = sales_order`, line `reason = sale`, sale line in `sourceLineId`, idempotency key present | Logistics executes stock-out once, emits `InventoryIssuedEvent.reason = sale`, preserves `reference_type = sales_order`, and records idempotency under a sales-order operation | Duplicate same payload returns stored result; changed payload returns idempotency conflict |
| Missing sale idempotency | `issueDocument.type = sales_order` without idempotency key | Reject before inventory mutation | Return Logistics validation error |
| Existing production consumption | Existing production-consumption command | Existing work-order mapping and duplicate protection stay unchanged | Existing tests continue passing |
| Runtime RPC compatibility | Authenticated call to `submit_financial_intent(TEXT,TEXT,JSONB)` | Inserts current `runtime_outbox`, `runtime_idempotency_registry`, and `runtime_audit_log` columns atomically and returns `runtime_outbox.id` | Duplicate idempotency key raises unique violation; invalid tenant/actor/key/type/payload rejects before inserts |

</frozen-after-approval>

## Code Map

- `src/platform/logistics/warehouse/stock-out-canonical.facade.ts` -- Logistics public stock-out command, validation, event mapping, and idempotency orchestration.
- `src/platform/logistics/warehouse/postgres-stock-out-ports.ts` -- Logistics Postgres movement/idempotency/read-back persistence.
- `src/app/warehouse/stock-out/page.tsx` -- manual canonical stock-out UI path.
- `src/services/warehouse-canonical-actions.ts` -- server action input mapper for canonical warehouse stock-out.
- `src/platform/logistics/warehouse/__tests__/stock-out-canonical.facade.test.ts` -- focused stock-out contract tests.
- `supabase/migrations/*submit_financial_intent*.sql` -- Integration Runtime RPC definition.
- `src/platform/integration-runtime/__tests__/submit-financial-intent-migration.test.ts` -- static RPC migration compatibility test.
- `tests/e2e/runtime/3c-security-gate.e2e.test.ts` -- RPC behavior evidence target, live DB not run unless credentials allow.

## Tasks & Acceptance

**Execution:**
- [x] `src/platform/logistics/warehouse/stock-out-canonical.facade.ts` -- extend public command contract for sales-order stock-out and idempotency.
- [x] `src/platform/logistics/warehouse/postgres-stock-out-ports.ts` -- persist sale movement source evidence and sales-order idempotency operation without breaking existing operations.
- [x] `src/services/warehouse-canonical-actions.ts` and `src/app/warehouse/stock-out/page.tsx` -- expose the new contract fields in the existing canonical stock-out path only.
- [x] `src/platform/logistics/warehouse/__tests__/stock-out-canonical.facade.test.ts` -- add focused tests for sales-order stock-out and regression coverage.
- [x] `supabase/migrations/*` -- add replace-function migration for `submit_financial_intent` matching current runtime schema.
- [x] `src/platform/integration-runtime/__tests__/submit-financial-intent-migration.test.ts` -- add static migration compatibility assertions.
- [x] `tests/e2e/runtime/3c-security-gate.e2e.test.ts` -- align assertions with the current runtime schema while preserving privilege, tenant, duplicate, rollback, and async-boundary checks.

**Acceptance Criteria:**
- Given a sales-order stock-out command, when executed twice with the same idempotency key and same payload, then the second execution returns duplicate evidence without a second stock mutation.
- Given a sales-order stock-out command with a changed payload and same idempotency key, when executed, then it is rejected before mutation.
- Given existing production-consumption stock-out, when existing tests run, then work-order reference and duplicate behavior remain unchanged.
- Given the runtime RPC migration, when inspected statically, then it writes `runtime_outbox.id`, required correlation/idempotency/audit columns, and does not reference non-existent `outbox_id`, `created_by`, `action`, or `actor_id` columns.

## Verification

**Commands:**
- `npm test -- src/platform/logistics/warehouse/__tests__/stock-out-canonical.facade.test.ts --runInBand` -- expected: focused Logistics unit tests pass.
- `npm test -- src/platform/integration-runtime/__tests__/submit-financial-intent-migration.test.ts --runInBand` -- expected: focused static migration compatibility test passes.
- `npm run logistics:verify` -- expected: frozen Logistics guard and E7 domain regression pass.
- `npm run type-check -- --pretty false` -- expected: TypeScript check passes.
- `git diff --check` -- expected: no whitespace errors.

**Current Run Result:**
- `git diff --check` -- PASS.
- `npm ci --ignore-scripts` -- PASS: restored local toolchain from `package-lock.json` without dependency updates.
- `npm test -- src/platform/logistics/warehouse/__tests__/stock-out-canonical.facade.test.ts --runInBand` -- PASS: 1 suite, 13 tests.
- `npm test -- src/platform/integration-runtime/__tests__/submit-financial-intent-migration.test.ts --runInBand` -- PASS: 1 suite, 3 tests.
- `npm run logistics:verify` -- PASS: Architecture Guard passed; Logistics domain tests 15 suites / 547 tests passed.
- `npm run type-check -- --pretty false` -- PASS.
- `npm run db:migration:check` -- BLOCKED_BY_ENV: Supabase project is not linked (`LegacyProjectNotLinkedError`).
- `npx vitest run tests/e2e/runtime/3c-security-gate.e2e.test.ts` -- BLOCKED_BY_ENV: test file loads but `beforeAll` stops before DB writes with `PRECONDITION FAILED: Missing Supabase credentials`; 10 tests skipped.
- Live DB RPC/E2E -- NOT_PROVEN: shell environment has no Supabase URL/anon/service credentials; do not treat static proof as live DB proof.

**Migration Static Review:**
- Prior RPC migration referenced stale columns: `runtime_outbox.outbox_id`, idempotency `created_by/created_at`, and audit `outbox_id/action/actor_id/metadata/created_at`.
- Current runtime schema defines `runtime_outbox.id`, idempotency `correlation_id/intent_type/outbox_id/expires_at`, and audit `entity_id/entity_type/amount/currency/correlation_id/source/status/timestamp`.
- New replacement migration writes the current schemas in one PL/pgSQL function call, derives runtime tenant context from the JWT text tenant claim with `get_auth_tenant_id()` text fallback, and keeps duplicate idempotency under the database unique constraint.

**Security E2E Contract Review:**
- `tests/e2e/runtime/3c-security-gate.e2e.test.ts` no longer asserts removed columns such as `runtime_outbox.outbox_id`, idempotency `created_by`, or audit `action/actor_id/outbox_id`.
- The gate still checks authenticated tenant derivation, anon rejection, duplicate idempotency, rollback on invalid structure, all-three-table persistence, pending outbox state, and business-validation deferral.
- Live DB execution remains blocked until a permitted Supabase environment and linked project are provided.

## Seal Decision

Decision date: 2026-10-11.

Seal level: `LOCAL_STATIC_COMPATIBILITY_VERIFIED`.

The batch is sealed for local/static compatibility only. Logistics stock-out compatibility has local test coverage, Finance migration compatibility has static test coverage, Logistics frozen guard and TypeScript verification passed, and diff hygiene passed.

Live DB compatibility remains `NOT_PROVEN` because the Supabase project is not linked in this worktree and no permitted live DB environment was verified. Runtime security E2E remains `NOT_PROVEN` because `tests/e2e/runtime/3c-security-gate.e2e.test.ts` still asserts the older RPC schema and must be updated before it can serve as evidence for the new schema.

No additional implementation scope is approved in this batch: no Retail Sale runtime, no ProductRegistry/HQ key, no Retail POS/runtime, no FreshFood, and no Kid Clothing.

## Live DB Verification Attempt

Attempt date: 2026-10-11.

Scope: preflight and live DB readiness only; no production data change and no Retail Sale runtime implementation.

Result: `LIVE_DB_NOT_PROVEN`.

Evidence:
- Shell environment has no `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, or `DATABASE_URL`.
- `supabase/.temp` is missing in this worktree, so no linked Supabase project ref is present.
- `npx supabase --version` works (`2.115.0`), so the blocker is project/env configuration rather than missing CLI.
- `npm run db:migration:check` is `BLOCKED_BY_ENV` with `LegacyProjectNotLinkedError: Cannot find project ref. Have you run supabase link?`.
- `npx vitest run tests/e2e/runtime/3c-security-gate.e2e.test.ts` is `BLOCKED_BY_ENV`: the file loads, then `beforeAll` stops with `PRECONDITION FAILED: Missing Supabase credentials`; 10 tests skipped before DB writes.
- `git diff --check` remains `PASS`.

Conclusion: live migration/RPC behavior is not proven and not failed. A permitted Supabase project link plus test credentials are required before DB-writing E2E can be run.

## Live DB Verification Attempt 2

Attempt date: 2026-10-11.

Scope: read-only remote migration state check using the original checkout's `.env.test` values loaded into the command process only. Secrets were not copied into this worktree and were not printed.

Result: `LIVE_DB_BLOCKED_BY_REMOTE_MIGRATION_DRIFT`.

Evidence:
- Required read-only migration check environment values were present in `.env.test`: `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- `npm run db:migration:check` reached the remote database through `SUPABASE_DB_URL`.
- Local latest migration: `20261011193000`.
- Remote latest migration: `20261008060000`.
- The remote database is missing many local migrations, including `20261011193000_fix_runtime_submit_financial_intent_schema.sql`.

Decision: do not run DB-writing Security E2E against this remote database in its current migration state. Live Finance RPC and tenant-isolation behavior remain `NOT_PROVEN` until the permitted test database is brought to the required migration baseline.

## Remote DB Baseline Verification - Read Only

Attempt date: 2026-10-11.

Task: Verify Retail Sale test database baseline - READ ONLY.

Scope honored:
- Read-only metadata and migration-history inspection only.
- No URL, token, password, or secret printed.
- No migration apply, no schema change, no DB-writing E2E, and no runtime code change.

Result: `LIVE_DB_BLOCKED_BY_REMOTE_MIGRATION_DRIFT`.

Environment identity:
- `.env.test` exists in the original checkout and contains the required key names for remote inspection.
- Supabase project-ref metadata exists in the original checkout.
- Confirmed purpose remains `UNKNOWN_READ_ONLY`: local file naming suggests a test env, and the DB has E2E tenant fixtures, but read-only metadata alone does not prove this DB is safe to mutate.

Read-only remote evidence:
- Local migration count: `530`.
- Remote migration count: `437`.
- Local latest migration: `20261011193000`.
- Remote latest migration: `20261008060000`.
- Remote-only migrations: `0`.
- Missing local migrations on remote: `93`.
- Runtime tables present: `runtime_tenant_registry`, `runtime_outbox`, `runtime_idempotency_registry`, `runtime_audit_log`.
- Runtime E2E tenant fixtures present and active: `3/3`.
- `submit_financial_intent(text,text,jsonb)` exists and returns `uuid`.
- DB-writing E2E readiness: `false`.

Missing migration versions:

```text
20260511500000
20260514900000
20260622000000
20260909000051
20260909000052
20260909000053
20260909000054
20260909000055
20260909000056
20260909000057
20260909000058
20260909000059
20260909000060
20260909000061
20260909000062
20260909000063
20260909000064
20260913010000
20260913010100
20260913010200
20260913010300
20260913010400
20260913010500
20260913010600
20260913010700
20260913010800
20260913010900
20260913011000
20260913011100
20260913011200
20260913020000
20260913020100
20260913020200
20260913020300
20260913020400
20260913020500
20260913030000
20260913030100
20260913030200
20260913030300
20260913030400
20260913030500
20260913030600
20260914000000
20260914200000
20260919030000
20260926000000
20260926001000
20260926002000
20260926003000
20260927000000
20260927010000
20260927020000
20260927030000
20260927040000
20260927050000
20260927060000
20260927070000
20260927080000
20260927081000
20260928000000
20260928183000
20260929010000
20260930093000
20261001000000
20261001000001
20261001970000
20261001980000
20261001990000
20261002000000
20261002020000
20261002030000
20261004010000
20261004020000
20261004030000
20261006010000
20261007090000
20261008010000
20261008011000
20261008012000
20261009010000
20261009020000
20261009030000
20261009120000
20261010010000
20261010020000
20261010030000
20261010040000
20261010050000
20261011010000
20261011020000
20261011030000
20261011193000
```

Conclusion: the remote database is reachable and contains runtime/E2E fixtures, but it is not an eligible DB-writing proof target for this batch because it is 93 migrations behind local. The next minimum step is human/environment-owner confirmation of the DB purpose and an authorized migration-baseline plan, or provision of a separate test DB already at the required baseline.

## E2E Database Preflight

Attempt date: 2026-10-11.

Scope: use E2E database credentials if safe; no migration apply and no DB-writing E2E.

Result: `E2E_DB_NOT_READY_FOR_WRITES`.

Evidence:
- `.env.test` is present and contains DB URL, public URL, anon/publishable key, and service-role key names.
- `.env.test` does not contain `SUPABASE_JWT_SECRET`; `.env.local` has a JWT secret and points to the same Supabase URL as `.env.test`, so Security E2E JWT precondition could be satisfied without printing secrets.
- `.env.test` does not match the repository's canonical E2E project-ref guard used by existing E2E scripts.
- `npm run db:migration:check` with `.env.test` still reports remote latest `20261008060000` while local latest is `20261011193000`; 93 local migrations are missing remotely.
- `node scripts/apply-e2e-pr-migrations.cjs --files supabase/migrations/20261011193000_fix_runtime_submit_financial_intent_schema.sql --dry-run` succeeds and lists only the batch migration; no DB mutation was performed.

Decision: do not run DB-writing Security E2E and do not apply migrations to this E2E DB in this task. The database must first be confirmed as the intended isolated E2E target and brought to the required migration baseline by an authorized process.
