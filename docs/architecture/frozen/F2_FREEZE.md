# F2 CASH & TREASURY ENGINE — FREEZE RECORD

> **STATUS: 🔒 FINAL FREEZE**
> This document is the authoritative freeze declaration for the F2 Cash & Treasury Engine.
> Once signed, no modification to F2 schema, RPCs, triggers, or invariants is permitted
> except through the Change Control process defined below.

---

## Freeze Metadata

| Field | Value |
|---|---|
| **Phase** | F2 Cash & Treasury Engine |
| **Freeze Date** | 2026-08-15T22:24:46+07:00 |
| **Commit SHA** | `7d0b2b3aab3a9c7cf97f2b8ec5893b73998015b2` |
| **Migration Range** | `20260816000000` → `20260816040000` |
| **Test Gate** | 79/79 PASS |
| **Architect Approval** | APPROVED — Final Freeze |
| **Prerequisites** | F0 FROZEN ✅, F1 FROZEN ✅ |

---

## Migration Inventory (F2 Exclusive)

| Migration | Description | Status |
|---|---|---|
| `20260816000000_finance_cash_engine_v1.sql` | Core tables: bank_accounts, cash_positions, cash_movements, quarantine | FROZEN |
| `20260816005000_finance_cash_projection_rpc.sql` | `finance_internal_record_cash_movement` initial version | FROZEN |
| `20260816010000_finance_cash_engine_grants.sql` | GRANT/REVOKE for F2 RPCs | FROZEN |
| `20260816020000_finance_ledger_emit_v2_events.sql` | F1 event contract extension: `posted.v2` with `cash_leg_id` | FROZEN |
| `20260816021000_finance_quarantine_rpc.sql` | `finance_internal_quarantine_cash_event` RPC | FROZEN |
| `20260816022000_finance_project_transaction_rpc.sql` | `finance_internal_project_cash_transaction` multi-leg atomic RPC | FROZEN |
| `20260816030000_finance_cash_reconstruction_rpc.sql` | `finance_reconstruct_cash_positions` RPC | FROZEN |
| `20260816040000_finance_cash_concurrency_locks.sql` | Bank Account Lock Protocol, deterministic ordering, immutability hardening | FROZEN |

---

## Architecture Boundary

```
                    FINANCE OS
                        │
              ┌─────────┴─────────┐
              │                   │
             F1                  F2
          LEDGER              CASH/TREASURY
             │                   │
       Financial Truth       Derived Cash Truth
             │                   │
       transactions         cash_movements (immutable)
       journal entries            │
             │                    ▼
             │             cash_positions (derived)
             │                    │
             └────── EVENT ───────┘
              finance.transaction.posted.v2
              finance.transaction.reversed.v2
```

### Invariant: F2 is downstream of F1

- F2 **reads** F1 events. F2 **never writes** to F1.
- `cash_movements` is an immutable ledger of cash facts derived from F1 postings.
- `cash_positions` is a materialised derived state of `cash_movements`. It can be destroyed and rebuilt — `cash_movements` is the source of truth for reconstruction.
- F1 `finance_transactions` remain the **single source of accounting truth**.

---

## Frozen Components

### Tables (FROZEN — no schema changes permitted)

| Table | Purpose |
|---|---|
| `finance_bank_accounts` | Registry of external bank/cash accounts |
| `finance_cash_positions` | Materialised cash balance per bank account |
| `finance_cash_movements` | Immutable cash movement history |
| `finance_cash_quarantine` | Failed projection events awaiting resolution |
| `finance_cash_staged_lines` | Bank statement staging for reconciliation |

### RPCs (FROZEN — no signature or logic changes permitted)

| RPC | Purpose |
|---|---|
| `finance_internal_record_cash_movement` | Single-leg trusted cash recorder |
| `finance_internal_project_cash_transaction` | Multi-leg atomic projection entry point |
| `finance_internal_quarantine_cash_event` | Terminal failure quarantine recorder |
| `finance_reconstruct_cash_positions` | Privileged position rebuilder |

### Triggers (FROZEN)

| Trigger | Table | Protection |
|---|---|---|
| `trg_finance_cash_mutation_guard` | `finance_cash_movements`, `finance_cash_positions` | Blocks direct UPDATE/DELETE on movements; blocks INSERT without trusted RPC context |

---

## Change Control Policy

### PROHIBITED post-freeze (without Human Architect review + ADR)

- Any `ALTER TABLE` on F2 tables that changes column types, adds/removes constraints, or drops columns
- Any change to RPC signatures (`finance_internal_*`, `finance_reconstruct_*`)
- Any change to trigger logic that weakens the mutation guard
- Any new write path into `finance_cash_movements` that bypasses `finance_internal_record_cash_movement`
- Any relaxation of RLS policies on F2 tables

### PERMITTED without Human Architect review

- New **read-only** views or indexes on F2 tables
- New **additive** columns that are nullable with no enforcement logic
- Performance tuning (VACUUM settings, index creation/drop) that does not change behaviour
- Bug fixes for security defects — must be documented in an ADR within 48 hours

---

## Approved Local/Test Exception — ACR-2026-025 / ADR-2026-025

**Owner decision:** `APPROVED — LOCAL/TEST IMPLEMENTATION — ACR-2026-025` (2026-11-03).
**Environment:** the disposable Supabase Local/Test stack only. This approval does not unlock or alter any existing shared, staging, or Production database.

The exception is limited to these artifacts:

1. `supabase/migrations/20261103100000_finance_f2_v1_v2_compatibility_bridge.sql`
   - Adds the F2 bridge trigger for the two F1 v1 event types.
   - Adds the F2 shared command `finance_f2_project_v2_event(uuid, uuid)`.
   - Adds the v2 semantic identity index.
2. `src/platform/finance/engines/cash-engine/cash-projection-worker.ts`
   - Routes worker replay through the shared command; removes independent leg/mapping projection and reversal first-match behavior.
3. `src/types/database.types.ts`, only for the new command signature.
4. `src/platform/finance/__tests__/finance-f2-v1-v2-bridge.integration.test.ts`.
5. This freeze record.

F1 function definitions, owner, `SECURITY DEFINER`, ACL, effective `EXECUTE`, and v1 event/payload remain frozen. No grant is widened on F1 or on the frozen F2 projection internals. `F2_CONTRACT.md` is unchanged.

### Implementation and re-seal evidence

| Check | Result |
|---|---|
| Source candidate artifacts | Implemented locally within ACR-2026-025 scope |
| Disposable target identity refresh | `PASS` — container `supabase_db_bella-f01-f3-auth-20261103`, `current_database=postgres`, PostgreSQL 17.6 |
| Minimal F2 dependency closure | `PASS` — existing migrations `20260816000000`, `20260816005000`, `20260816010000`, `20260816021000`, `20260816022000`, and `20260816040000` applied atomically on this disposable DB; legacy `20260816020000_finance_ledger_emit_v2_events.sql` intentionally excluded because it changes the F1 v1 event path |
| F1 catalog before/after | `PASS` — full definition/body fingerprints, owner, `SECURITY DEFINER`, `proconfig`, ACL, and effective `EXECUTE` match before/after; the two frozen RPCs remain byte-identical at the catalog fingerprint level |
| F2 bridge migration | `PASS` — `20261103100000_finance_f2_v1_v2_compatibility_bridge.sql` applied atomically to the verified disposable DB |
| PR #479 online-index split | `PENDING` — the existing outbox index is now a separate `CREATE UNIQUE INDEX CONCURRENTLY` migration; re-seal only after the revised migration path passes Real DB E2E |
| Worker shared-command test | `PASS` |
| DB integration checks | `PASS` — 5/5 tests: worker routing, canonical v1→v2 projection, tenant mismatch, idempotent replay/concurrency, reversal lineage/fail-closed, rollback, and restricted command execution |
| Bridge command boundary | `PASS` — owner `postgres`, `SECURITY DEFINER`, fixed `search_path=pg_catalog, public`; `EXECUTE` only for `service_role`; `anon` and `authenticated` denied |
| F2 scoped Local/Test re-seal | `PASS` — ACR-2026-025 additive bridge candidate only; no Production or F01 completion implied |

Pre-apply and post-apply catalog values are identical: `finance_post_transaction` definition MD5 `a7f25cfe9ab83f1069bd40041271e7e5`, body MD5 `b7d86bc278786b4945dd8c1e2a871044`; `finance_reverse_transaction` definition MD5 `e88991dd642c2a7abf49d1019675990e`, body MD5 `335700b841b58910f7814de70aa577d3`. Both remain owned by `postgres`, `SECURITY DEFINER=true`, empty `proconfig`, ACL `=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres`, with the same effective `EXECUTE` results as the pre-apply snapshot. The existing F1 `anon`/`authenticated` execute finding remains unchanged and is outside this ACR. The live outbox schema has `event_id uuid` and `payload text`; the bridge supports `text` and `jsonb` without changing that column.

The disposable DB received the dependency SQL and bridge candidate through direct `psql` execution; its Supabase migration ledger was not modified. Because the legacy F1-changing migration was intentionally excluded, do not use this disposable DB for an unreviewed `supabase migration up`. Four synthetic tenant fixtures from the failed-cleanup run and final run remain in this disposable DB: `cfb1aa80-9784-4a87-9826-d29ab001a3b2`, `1a8755f6-6189-4f6e-b940-56b98fb084df`, `6d621b96-2a10-41b7-a5b4-b20125fc493a`, and `07dd453b-edae-488a-9a5e-fef5594fff61`. They are retained because the F1 immutability trigger correctly rejects deleting tenants with posted history; no trigger was disabled and no real customer data was used.

The dependency migration `20260816000000` also adds the existing composite tenant-key constraints on `finance_transactions` and `finance_accounts` required by F2 foreign keys. No F1 posting/reversal function, ACL, effective privilege, or v1 event/payload was changed.

The approved exception authorizes this scoped Local/Test implementation and re-seal only. F1 RPC definitions/privileges and v1 event payloads, Production, commit, push, merge, deploy, and F01 remain unchanged and outside this seal.

---

## Downstream Consumption Rules (for F3+)

```
F3 AR/Invoicing → MUST:
  ✓ Consume finance_bank_accounts, finance_cash_positions, finance_cash_movements
    via CashEngineService read APIs (contract)
  ✓ Trigger payment flow via F1 POST → finance.transaction.posted.v2 → F2
  ✗ NEVER write to finance_cash_movements directly
  ✗ NEVER write to finance_cash_positions directly
  ✗ NEVER call finance_internal_record_cash_movement from F3 code
```

The correct F3 payment flow:

```
Invoice (F3)
    ↓
Payment recorded (F3)
    ↓
finance_post_transaction (F1 RPC)
    ↓
finance.transaction.posted.v2 (event)
    ↓
CashProjectionWorker (F2)
    ↓
finance_cash_movements + finance_cash_positions
```
