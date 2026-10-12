# Architecture Gate Result - Retail Sale POS MVP

Date: 2026-10-12

## Bella OS/Product Development Process Gate

Result: PASS.

Approved scope is the Retail Sale POS MVP only: one confirmed sale flow that persists Retail-owned sale header/items, calls the Logistics public stock-out facade, submits one Finance/Common Runtime financial intent, supports tenant-scoped idempotency, and exposes read-back evidence for verification. This is not Go-Live and does not approve FreshFood, Kid Clothing, ProductRegistry/HQ onboarding, returns, tax, discounts, loyalty, reporting, or broader Retail OS work.

## Product Manifest

- Product/OS: Retail Sale POS MVP, Product vertical runtime slice.
- Capability in scope: confirm one paid sale with header/items, stock-out, Finance intent, read-back, and duplicate retry protection.
- Non-goals: no accounting posting rules, no direct Finance ledger writes, no direct Logistics inventory writes, no ProductRegistry key, no UI redesign, no production readiness claim.

## Ownership Map

| Data / Behavior | Owner | Decision |
| --- | --- | --- |
| Sale header, sale line, sale status, sale idempotency | Retail Sale | implement product-owned MVP contract |
| Stock issue / inventory movement / traceability | Logistics public contract | consume `WarehouseStockOutCanonicalFacade`; no kernel edits |
| Finance intent / outbox / idempotency / audit | Integration Runtime / Finance boundary | consume `submit_financial_intent`; no ledger/internal edits |
| Accounting treatment / GL / COGS policy | Finance OS | not modified |
| Product identity / ProductRegistry | Platform Product Registry | not modified |
| Existing Beauty `product_sales` | Beauty/Product Sales commission path | explicitly not reused as Retail POS owner |

## Contract Dependency Map

```text
Retail Sale POS
  -> Retail-owned sale persistence
  -> Logistics public stock-out facade
  -> Integration Runtime submit_financial_intent RPC
  -> read-back from Retail persistence plus returned Logistics/Finance evidence
```

## Change Authority

Allowed:
- Add Product-owned Retail Sale POS MVP code under `src/products/retail-sale/pos`.
- Add additive Retail-owned tables/indexes/policies for the missing branch/store/idempotency contract.
- Add focused unit/static tests and an E2E target guarded to the canonical E2E DB.

Not allowed:
- Modify frozen Logistics kernel artifacts.
- Write directly to Logistics inventory/warehouse tables from Retail runtime.
- Modify Finance ledger/internal tables or encode debit/credit/accounting policy.
- Use Beauty `product_sales` as the Retail POS owner/replacement.
- Add ProductRegistry/HQ onboarding or unrelated verticals.

## UI -> Contract Reconciliation

No Product UI redesign is in scope. API/service-facing fields are reconciled as follows:

| Field/action | Canonical contract | Conclusion |
| --- | --- | --- |
| Confirm sale | Retail Sale POS MVP service | MATCH after new Retail-owned slice |
| Sale header/items | Existing generated `retail_sales`/`retail_sale_items` are missing branch/store and idempotency provenance, with no migration source found in this worktree | CONTRACT CHANGE REQUIRED |
| Stock-out | Logistics public `WarehouseStockOutCanonicalFacade` supports `sales_order`/`sale` references | MATCH |
| Finance intent | Runtime `submit_financial_intent(TEXT,TEXT,JSONB)` | MATCH |

## Additive Migration Plan

Create new Product-owned tables only:
- `public.retail_pos_sales`
- `public.retail_pos_sale_items`

The migration must add tenant-scoped idempotency uniqueness on `(tenant_id, business_operation, idempotency_key)`, branch/store columns, read-back fields for stock-out and Finance evidence, RLS, and authenticated grants. No historical migration rewrite and no generated type hand edit.

## 11 Automated Verification Gates Plan

1. Architecture Compliance: changed files stay inside Retail Sale POS MVP docs/code/tests/migration, plus existing compatibility batch remains untouched.
2. Contract Boundary: Retail consumes Logistics/Finance public contracts only.
3. Tenant Isolation: sale persistence and idempotency are tenant-scoped; RLS policies filter by JWT tenant.
4. RLS & Authorization: authenticated users only; tenant claim required for runtime access.
5. Database Migration Safety: additive `CREATE TABLE IF NOT EXISTS` and indexes/policies only.
6. Event-After-Persistence: sale is persisted before Logistics/Finance side effects are recorded as completed.
7. Domain Safety Routing: no Healthcare/Education/frozen Logistics kernel modification.
8. Temporal Provenance: no historical migration edits.
9. Rule Governance: no GL, debit/credit, or accounting treatment invented.
10. Audit & Evidence Integrity: duplicate retry evidence must show same sale/stock/finance identities.
11. Regression: run focused Retail Sale tests, migration static test, Logistics focused test, type check, and diff check; run canonical E2E if environment is eligible.

## Result

PASS for the approved Retail Sale POS MVP implementation. Go-Live remains NOT_CLAIMED.

## Verification Evidence

Worktree: `C:\Users\DELL\.codex\worktrees\retail-sale-compat\BELLA SPA ERP`

| Gate | Result | Evidence |
| --- | --- | --- |
| Retail Sale unit + migration/config static tests | PASS | `npm test -- src/products/retail-sale/pos/__tests__/retail-sale-pos.service.test.ts src/products/retail-sale/pos/__tests__/retail-sale-pos-migration.test.ts --runInBand`: 2 suites, 9 tests passed. Latest focused static/config rerun: `npm test -- src/products/retail-sale/pos/__tests__/retail-sale-pos-migration.test.ts --runInBand`, 1 suite / 5 tests passed. |
| Logistics stock-out public contract test | PASS | `npm test -- src/platform/logistics/warehouse/__tests__/stock-out-canonical.facade.test.ts --runInBand`: 1 suite, 13 tests passed. |
| TypeScript strict check | PASS | `npm run type-check` completed successfully after config isolation, migration fix, and Real DB E2E fixture alignment. |
| Logistics frozen guard/regression | PASS | `npm run logistics:verify`: Architecture Guard passed; Logistics domain tests 15 suites / 547 tests passed. |
| Diff hygiene | PASS | `git diff --check` completed successfully. |
| Retail E2E DB config isolation | PASS | Retail E2E reads `DATABASE_EXECUTOR_URL_TEST` only; no fallback to shared `DATABASE_EXECUTOR_URL`, `DB_URL`, `DATABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_DATABASE_URL`, or `E2E_SUPABASE_DB_URL`. Static regression locks this behavior. |
| Canonical E2E DB auth/target preflight | PASS | Read-only preflight used `DATABASE_EXECUTOR_URL_TEST`, `fallbackUsed=false`, target project `bmnbqbcdbuklhopfbopv`, `transaction_read_only=on`, connection PASS. No secret printed. |
| Retail POS migration apply | PASS | Applied `20261012010000_create_retail_sale_pos_mvp.sql` on canonical E2E DB. Post-apply evidence: `retail_pos_sales` and `retail_pos_sale_items` exist, RLS enabled, 5 policies present. |
| Retail Sale Real DB E2E | PASS | `npm test -- src/products/retail-sale/pos/__tests__/retail-sale-pos-real-db.e2e.test.ts --runInBand`: 1 suite / 1 test passed on canonical E2E DB `bmnbqbcdbuklhopfbopv`. |
| Post-E2E fixture cleanup check | PASS | Read-only post-E2E evidence found Retail test fixture sales/items, Retail Runtime outbox rows, and Retail stock movements remaining at 0. This proves the test fixture cleanup for the queried markers only; it is not a full side-effect rollback audit. |

## Seal Classification

IMPLEMENTED_WITH_CANONICAL_E2E_PROOF.

Retail Sale POS MVP code, migration, idempotency, stock-out contract consumption, Finance intent port, tenant-scoped unit proof, and one canonical Real DB E2E run are proven within the assertions of the scoped test. Go-Live remains `NOT_CLAIMED`.

## Boundary Seal - Canonical E2E PASS

Decision date: 2026-10-12.

```ini
RETAIL_E2E_CONFIG_ISOLATION       = PASS
CANONICAL_E2E_DB_AUTH             = PASS
DB_TARGET                         = CANONICAL_E2E
RETAIL_POS_MIGRATION              = APPLIED
RETAIL_SALE_REAL_DB_E2E           = PASS
FIXTURE_CLEANUP_CHECK             = PASS
STATIC_REGRESSION_TESTS           = PASS
TYPE_CHECK                        = PASS
DIFF_CHECK                        = PASS
GO_LIVE                           = NOT_CLAIMED
```

Evidence boundary:

- The Real DB E2E result proves the assertions in `retail-sale-pos-real-db.e2e.test.ts`: first sale succeeds, duplicate retry returns the same sale/stock/Finance identities, inventory is deducted through the Logistics facade path, Finance intent read-back succeeds, cross-tenant sale attempt rejects, and cross-tenant read returns empty.
- The fixture cleanup check proves no rows remained for the queried Retail E2E fixture markers; it does not claim every possible side effect in the database was rolled back.
- This seal does not approve production credentials, production migration, production rollout, ProductRegistry/HQ onboarding, returns, tax expansion, discounts, loyalty, reporting, or broader Retail OS work.

Next step, if requested later, must be a separate Production readiness / rollout task. Test E2E PASS does not imply Production Go-Live.
