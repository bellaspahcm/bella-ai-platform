# BELLA Interior Commercial — Window B Deployment Seal
**SEALED — 2026-11-15T21:15:52+07:00 (14:15:52 UTC)**

---

## Kết quả triển khai

| Field | Value |
|-------|-------|
| **Migration** | M1 — `20261113165251_interior_commercial_transaction_engine` |
| **Window** | Window B |
| **Execute start** | 2026-11-15T21:15:17+07:00 (14:15:17 UTC) |
| **COMMIT** | 2026-11-15T21:15:24+07:00 (14:15:24 UTC) |
| **psql exit code** | `0` |
| **Wrapper SHA-256** | `6566B02A8E840732BFF31527B288AC0FE93A9733198E13EEEE409C2D0C974EB1` |
| **Log file** | `supabase/scripts/m1_window_b_20261115T211509.log` |

---

## Wrapper Execution Log — Key Events

| Timestamp UTC | Event |
|---------------|-------|
| 14:15:17 | psql connect OK, `BEGIN` |
| 14:15:17 | `SET LOCAL lock_timeout = '5s'` |
| 14:15:17 | `SET LOCAL statement_timeout = '120s'` |
| 14:15:18 | **SECTION 0 PASS** — pre-flight OK (M1 not in ledger, M12 EXISTS, M13 EXISTS) |
| 14:15:18–24 | **M1 body** — ALTER TABLE×3, CREATE FUNCTION×14, CREATE TRIGGER×7, DROP POLICY, CREATE POLICY×2, CREATE INDEX |
| 14:15:24 | **SECTION 2** — M12 `interior_create_quotation_snapshot` restored, REVOKE+GRANT |
| 14:15:24 | **SECTION 3** — M13 `interior_create_customer_approval_request` restored, REVOKE+GRANT |
| 14:15:24 | **SECTION 4 PASS** — 12/12 assertions OK |
| 14:15:24 | **SECTION 5 PASS** — ledger entry verified |
| 14:15:24 | **COMMIT** |

---

## Post-Commit Verification (ngoài transaction)

| Check | Expected | Actual | Kết quả |
|-------|----------|--------|---------|
| M1 trong ledger (`20261113165251`) | 1 | **1** | ✅ |
| 4 cột mới trong `interior_contracts` | 4 | **4** | ✅ |
| RLS policies trên `interior_payment_transactions` | 2 | **2** | ✅ |
| Triggers `interior_*` | ≥ 7 | **22** | ✅ |
| M12 — `interior_create_quotation_snapshot` | EXISTS | **true** | ✅ |
| M13 — `interior_create_customer_approval_request` | EXISTS | **true** | ✅ |

**Ledger entry M1:**

```
version:    20261113165251
name:       interior_commercial_transaction_engine
created_by: production-apply-window-b
```

---

## Migration Ledger Status (sau Window B)

| Version | Name | Created By | Status |
|---------|------|------------|--------|
| `20261115140000` | `interior_commercial_guards` | null | APPLIED |
| `20261115130000` | `interior_internal_approvals` | null | APPLIED |
| `20261115120000` | `interior_external_technical_sources` | null | APPLIED |
| `20261115110000` | `interior_work_items` | null | APPLIED |
| `20261115085708` | `interior_customer_evidenced_handover` | micheal.nguyenquang@gmail.com | APPLIED ⚠️ no source |
| `20261115021131` | `interior_approval_subject_enum_casts` | production-apply-20261115 | APPLIED (M13) |
| `20261115020234` | `interior_quotation_snapshot_stable_component_uuid_fix` | production-apply-20261115 | APPLIED (M12) |
| `20261114233313` | `interior_boq_revision_copy_timestamps_fix` | production-apply-20261115 | APPLIED |
| `20261114230552` | `interior_boq_revision_copy_schema_fix` | production-apply-20261115 | APPLIED |
| `20261114222958` | `interior_allow_rbac_snapshot_seal` | production-apply-20261115 | APPLIED |
| `20261114215525` | `interior_allow_approved_boq_snapshot_seal` | production-apply-20261115 | APPLIED |
| `20261114171657` | `interior_boq_approval_audit_action` | manual-reconciliation-20261115 | APPLIED |
| **`20261113165251`** | **`interior_commercial_transaction_engine`** | **production-apply-window-b** | **✅ WINDOW B** |

---

## Deployment Status Update

| Migration | Trạng thái |
|-----------|------------|
| M8–M11 | `DEPLOYED_SMOKE_VERIFIED` |
| M12–M13 | `DEPLOYED_DB_VERIFIED` (preserved by Window B wrapper) |
| **M1** | **`DEPLOYED_DB_VERIFIED` — Window B SEALED** |
| M14 | `NEXT — Phương án B (bỏ ALTER FUNCTION)` |
| M15 | `HOLD — phụ thuộc M14` |
| M5 | `HOLD — phụ thuộc M1 ✅` |
| M6 | `HOLD — phụ thuộc M5` |

> [!NOTE]
> `APPLICATION_E2E_NOT_PROVEN` vẫn áp dụng cho M1. Các function và trigger đã có trên DB; E2E flow cần verify qua application layer.

---

## Bước tiếp theo — Window C

**M14 — Phương án B (đã phê duyệt):**
- Bỏ dòng `ALTER FUNCTION public.guard_interior_payment_transaction_insert() SECURITY DEFINER;` khỏi M14 source
- Review toàn bộ M14 sau chỉnh sửa
- Review M15 → không có dependency ngược
- Build và execute Window C

*SEALED — không sửa artifact này sau thời điểm trên.*
