# BELLA Interior Commercial — Window C Deployment Seal
**SEALED — 2026-11-15T21:30:57+07:00 (14:30:57 UTC)**

---

## Kết quả triển khai

| Field | Value |
|-------|-------|
| **Migrations** | M14 `20261115023322` + M15 `20261115025227` |
| **Window** | Window C |
| **Execute start** | 2026-11-15T21:30:54+07:00 |
| **COMMIT** | 2026-11-15T21:30:57+07:00 (14:30:56 UTC) |
| **psql exit code** | `0` |
| **Wrapper SHA-256** | `B467F0420F54946CAEB00B68B460B0E7F490E6750E02965696D33BDBDE97CDF8` |
| **M14 source SHA-256** | `C8AD1C8D28FD57033316391F86F90E9191ED773D7301F5B0792761EECC1EFD78` (150 lines, Phương án B) |
| **M15 source SHA-256** | `25B41D9100EB99167AF52C32D84D0B264F1E43FED502876ECAB918C3790E4C78` (65 lines) |

---

## Phương án B — Xác nhận

Dòng bị xóa khỏi M14 source trước khi deploy:
```sql
-- The trigger checks actor, tenant, project permission, signed status, and amount
-- itself. Definer rights let those checks read the contract and milestone tables,
-- whose direct table grants remain closed to authenticated users.
ALTER FUNCTION public.guard_interior_payment_transaction_insert() SECURITY DEFINER;
```
**Lý do:** M15 khai báo `SECURITY DEFINER` trực tiếp trong `CREATE OR REPLACE FUNCTION` → ALTER ở M14 là redundant. Thứ tự ledger M14 → M15 giữ nguyên theo timestamp.

---

## Wrapper Execution Log

| UTC | Event |
|-----|-------|
| 14:30:54 | psql connect OK, `BEGIN` |
| 14:30:54 | `SET LOCAL lock_timeout = '5s'`, `SET LOCAL statement_timeout = '120s'` |
| 14:30:56 | **SECTION 0 PASS** — M1 in ledger ✓, M14/M15 not in ledger ✓, private schema ✓ |
| 14:30:56 | **SECTION 1 (M14)** — `CREATE FUNCTION` ×2 (private), REVOKE+GRANT ×2, DROP POLICY ×2, CREATE POLICY ×2, `CREATE FUNCTION` (lifecycle_ctx) + REVOKE+GRANT |
| 14:30:56 | **SECTION 2 (M15)** — `CREATE OR REPLACE FUNCTION guard_interior_payment_transaction_insert` SECURITY DEFINER + REVOKE |
| 14:30:56 | **SECTION 3 PASS** — 11/11 assertions OK |
| 14:30:56 | **SECTION 4** — `INSERT 0 2` (M14 + M15 ledger) + verify |
| 14:30:56 | **COMMIT** |

---

## Post-Commit Verification

| Check | Expected | Actual | ✓ |
|-------|----------|--------|---|
| M14 trong ledger | 1 | 1 | ✅ |
| M15 trong ledger | 1 | 1 | ✅ |
| `private` functions | 2 | 2 | ✅ |
| RLS policies `interior_payment_transactions` | 2 | 2 | ✅ |
| `guard_interior_payment_transaction_insert` SECURITY DEFINER | true | true | ✅ |
| `interior_read_contract_lifecycle_context` EXISTS | 1 | 1 | ✅ |

---

## Production State Sau Window C

| Object | Trạng thái |
|--------|------------|
| `private.interior_payment_transaction_finance_read_allowed(UUID,UUID)` | EXISTS, SECURITY DEFINER |
| `private.interior_payment_transaction_record_allowed(UUID,UUID)` | EXISTS, SECURITY DEFINER |
| `interior_payment_transactions_finance_read` (SELECT policy) | EXISTS — sử dụng private function |
| `interior_payment_transactions_record` (INSERT policy) | EXISTS — sử dụng private function |
| `public.interior_read_contract_lifecycle_context(UUID,TEXT)` | EXISTS, SECURITY DEFINER |
| `public.guard_interior_payment_transaction_insert()` | EXISTS, **SECURITY DEFINER** (upgraded by M15) |

---

## Deployment Status Update

| Migration | Trạng thái |
|-----------|------------|
| M8–M11 | `DEPLOYED_SMOKE_VERIFIED` |
| M12–M13 | `DEPLOYED_DB_VERIFIED` |
| M1 | `DEPLOYED_DB_VERIFIED` — Window B |
| **M14** | **`DEPLOYED_DB_VERIFIED` — Window C** |
| **M15** | **`DEPLOYED_DB_VERIFIED` — Window C** |
| M5 | `HOLD — dependency M1 ✅ open — pending review` |
| M6 | `HOLD — phụ thuộc M5` |

---

## Bước tiếp theo — Window D

**M5 → M6** (dependency M1 đã mở khóa từ Window B):
- Review M5 source, đối chiếu Production
- Review M6 và xác nhận dependency
- Build và execute Window D

*SEALED — không sửa artifact này sau thời điểm trên.*
