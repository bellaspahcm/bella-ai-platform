# Bella Interior — Window A Deployment Report
**Date:** 2026-11-15T20:33 +07:00  
**Production:** `lvnvkpyxtuilhrabtlwv` (ap-southeast-1)  
**Window:** A — M12 + M13 (Quotation Snapshot & Customer Approval Request)  
**Status:** 🔒 SEALED — DEPLOYED

---

## Deployment Summary

| Migration | Version | Function | DDL | Ledger | ACL |
|---|---|---|---|---|---|
| **M12** | `20261115020234` | `interior_create_quotation_snapshot` | ✅ APPLIED | ✅ `production-apply-20261115` | `authenticated=X` |
| **M13** | `20261115021131` | `interior_create_customer_approval_request` | ✅ APPLIED | ✅ `production-apply-20261115` | `authenticated=X` |

---

## Verification Evidence

### M12 — `interior_create_quotation_snapshot`

```
proname:    interior_create_quotation_snapshot
prosecdef:  true
acl:        postgres=X/postgres, authenticated=X/postgres
```

**Các điểm đã xác nhận:**
- `SECURITY DEFINER` ✅
- `SET search_path TO ''` ✅
- `REVOKE ALL FROM PUBLIC, anon, service_role` ✅
- `GRANT EXECUTE TO authenticated` ✅
- Dùng `COALESCE(source.stable_component_id::TEXT, '')` cho UUID→TEXT lineage comparison ✅
- Dùng `specifications_json` (column schema Production) — không dùng `specifications` cũ ✅
- Strict full-match Invariant I5: `v_source_count = 0 OR v_input_count <> v_source_count → RAISE` ✅
- Advisory lock `pg_advisory_xact_lock(hashtextextended(...))` cho idempotency ✅
- Supersede pending approval khi fork revision ✅

### M13 — `interior_create_customer_approval_request`

```
proname:    interior_create_customer_approval_request
prosecdef:  true
acl:        postgres=X/postgres, authenticated=X/postgres
```

**Các điểm đã xác nhận:**
- `SECURITY DEFINER` ✅
- `SET search_path TO ''` ✅
- `REVOKE ALL FROM PUBLIC, anon, service_role` ✅
- `GRANT EXECUTE TO authenticated` ✅
- `v_subject_type` giữ nguyên là TEXT trong validation, chỉ cast `::public.interior_approval_subject_type` tại ranh giới DML ✅
- `contract_addendum` không trong `IN ('quotation', 'contract')` → intentional, có flow riêng ✅
- `platform_current_actor_profile()` được gọi để verify canonical actor name ✅
- Supersede pending approvals cùng subject trước khi INSERT mới ✅

### Ledger Verification

```sql
SELECT version, name, created_by FROM supabase_migrations.schema_migrations
WHERE version IN ('20261115020234','20261115021131')
ORDER BY version;
```

| version | name | created_by |
|---|---|---|
| `20261115020234` | `interior_quotation_snapshot_stable_component_uuid_fix` | `production-apply-20261115` |
| `20261115021131` | `interior_approval_subject_enum_casts` | `production-apply-20261115` |

---

## Full Migration Ledger State (M8–M13)

| Version | Name | Applied |
|---|---|---|
| `20261114215525` | `interior_allow_approved_boq_snapshot_seal` | `production-apply-20261115` |
| `20261114222958` | `interior_allow_rbac_snapshot_seal` | `production-apply-20261115` |
| `20261114230552` | `interior_boq_revision_copy_schema_fix` | `production-apply-20261115` |
| `20261114233313` | `interior_boq_revision_copy_timestamps_fix` | `production-apply-20261115` |
| `20261115020234` | `interior_quotation_snapshot_stable_component_uuid_fix` | `production-apply-20261115` |
| `20261115021131` | `interior_approval_subject_enum_casts` | `production-apply-20261115` |

---

## Giới hạn vẫn còn hiệu lực

> [!IMPORTANT]
> Window A xác nhận DDL và ledger trên Production DB. **Chưa chứng minh E2E qua ứng dụng** với Supabase Auth thực. Status: `DEPLOYED_DB_VERIFIED / APPLICATION_E2E_NOT_PROVEN`

> [!NOTE]
> `contract_addendum` không được xử lý bởi M13. Flow `contract_addendum` đi qua Invariant I10 riêng — không phải thiếu sót của M13.

---

## Hold Items

| Migration | Version | Trạng thái | Lý do |
|---|---|---|---|
| **M14** | `20261115023322` | ⏸ HOLD | Phụ thuộc M1 cho RLS; `ALTER FUNCTION` cần bỏ (Phương án B đã duyệt) |
| **M15** | `20261115025227` | ⏸ HOLD | Trigger path trong M1 (`SECURITY INVOKER` vs M15 `SECURITY DEFINER`); phụ thuộc M1 |
| **M1** | `20261113165251` | ⏸ HOLD | Idempotency issue: policy `interior_customer_signatures_no_client_access` đã tồn tại trên Production; cần `DO $$` guard |
| **M5** | `20261114120200` | ⏸ HOLD | Phụ thuộc M1 |
| **M6** | `20261114120300` | ⏸ HOLD | Phụ thuộc M5 |

---

## Quyết định tiếp theo cần Owner

1. **M1 idempotency fix** — Review toàn bộ 1996-line file, xác định tất cả policy đã tồn tại trên Production, propose `DO $$` guard cho từng trường hợp
2. **M14 Phương án B** — Bỏ dòng `ALTER FUNCTION public.guard_interior_payment_transaction_insert() SECURITY DEFINER;` khỏi M14 source, commit mới
3. **Thứ tự deploy M14/M15** — Sau khi M1 được giải quyết: M1 → M14 (đã sửa) → M15, hoặc M1 → M15 → M14

---

*Sealed by agent at 2026-11-15T20:33 +07:00*
