# BELLA Interior Commercial — Window D Deployment Seal
**SEALED — 2026-11-15T21:37:22+07:00 (14:37:22 UTC)**

---

## Kết quả triển khai

| Field | Value |
|-------|-------|
| **Migrations** | M5 `20261114120200` + M6 `20261114120300` |
| **Window** | Window D |
| **Execute start** | 2026-11-15T21:36:53+07:00 |
| **COMMIT** | 2026-11-15T21:37:22+07:00 (14:36:55 UTC) |
| **psql exit code** | `0` |
| **Wrapper SHA-256** | `94EC0E025B4F97A282EA561884F5BD214BC48F5A60D992336E516199F3D0F931` |

---

## Wrapper Execution Log

| UTC | Event |
|-----|-------|
| 14:36:53 | psql connect OK, `BEGIN` |
| 14:36:55 | **SECTION 0 PASS** — M1 in ledger ✓, M5/M6 not in ledger ✓, tables exist ✓ |
| 14:36:55 | **SECTION 1 (M5)** — ALTER TABLE (3 cols + DROP DEFAULT/NOT NULL), DO $$ constraints, `CREATE FUNCTION` ×6, REVOKE/GRANT, DROP+CREATE TRIGGER |
| 14:36:55 | **SECTION 2 (M6)** — REVOKE table, DROP POLICY ×2, CREATE POLICY (DENY-ALL), `CREATE OR REPLACE interior_read_contract_project` + REVOKE/GRANT |
| 14:36:55 | **SECTION 3 PASS** — 11/11 assertions OK |
| 14:36:55 | **SECTION 4** — `INSERT 0 2` (M5 + M6 ledger) + verify |
| 14:36:55 | **COMMIT** |

---

## Post-Commit Verification

| Check | Expected | Actual | ✓ |
|-------|----------|--------|---|
| M5 trong ledger | 1 | 1 | ✅ |
| M6 trong ledger | 1 | 1 | ✅ |
| 3 cột mới (`interior_contract_addenda`) | 3 | 3 | ✅ |
| 5 M5 functions | 5 | 5 | ✅ |
| `trg_advance_interior_addendum_after_customer_approval` | 1 | 1 | ✅ |
| DENY-ALL policy `interior_contract_addenda` | 1 | 1 | ✅ |
| `interior_read_contract_project` SECURITY DEFINER | true | true | ✅ |

---

## Production State Sau Window D

| Object | Trạng thái |
|--------|------------|
| `interior_contract_addenda.proposed_payment_schedule` | EXISTS (JSONB) |
| `interior_contract_addenda.base_contract_value` | EXISTS (NUMERIC 15,2) |
| `interior_contract_addenda.customer_approval_id` | EXISTS (UUID) |
| `ck_interior_contract_addenda_status` | EXISTS (NOT VALID) |
| `fk_interior_contract_addenda_customer_approval` | EXISTS |
| `interior_create_contract_addendum_request(JSONB)` | EXISTS, SECURITY DEFINER |
| `interior_read_contract_addendum_for_approval(UUID)` | EXISTS, SECURITY DEFINER |
| `interior_create_customer_addendum_approval_request(JSONB)` | EXISTS, SECURITY DEFINER |
| `interior_read_public_customer_addendum_approval(UUID,UUID)` | EXISTS, GRANT TO anon |
| `guard_interior_customer_approval_insert()` | UPGRADED — handles `contract_addendum` subject |
| `advance_interior_addendum_after_customer_approval()` | EXISTS, SECURITY DEFINER |
| `trg_advance_interior_addendum_after_customer_approval` | EXISTS on `interior_customer_approvals` |
| `interior_contract_addenda_no_direct_client_access` (DENY-ALL) | EXISTS |
| `tenant_isolation_interior_contract_addenda` | DROPPED |
| `interior_read_contract_project(UUID)` | UPGRADED — includes addenda join |

---

## Deployment Status — FINAL

| Migration | Version | Trạng thái |
|-----------|---------|------------|
| M8–M11 | `20261114215525`–`20261114233313` | `DEPLOYED_SMOKE_VERIFIED` |
| M12 | `20261115020234` | `DEPLOYED_DB_VERIFIED` |
| M13 | `20261115021131` | `DEPLOYED_DB_VERIFIED` |
| M1 | `20261113165251` | `DEPLOYED_DB_VERIFIED` — Window B |
| M14 | `20261115023322` | `DEPLOYED_DB_VERIFIED` — Window C |
| M15 | `20261115025227` | `DEPLOYED_DB_VERIFIED` — Window C |
| **M5** | **`20261114120200`** | **`DEPLOYED_DB_VERIFIED` — Window D** |
| **M6** | **`20261114120300`** | **`DEPLOYED_DB_VERIFIED` — Window D** |

> [!NOTE]
> `APPLICATION_E2E_NOT_PROVEN` vẫn áp dụng cho tất cả migrations. E2E flow cần verify qua application layer.

---

## Toàn bộ Deployment Windows — 2026-11-15

| Window | Migrations | COMMIT UTC | Kết quả |
|--------|-----------|-----------|---------|
| **A** | M12, M13 | 14:15 ish | SEALED |
| **B** | M1 | 14:15:24 | SEALED |
| **C** | M14, M15 | 14:30:56 | SEALED |
| **D** | M5, M6 | 14:36:55 | SEALED |

*SEALED — không sửa artifact này sau thời điểm trên.*
