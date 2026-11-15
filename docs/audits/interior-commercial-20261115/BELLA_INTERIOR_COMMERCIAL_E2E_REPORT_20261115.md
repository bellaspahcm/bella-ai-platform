# BELLA Interior Commercial — Application E2E Report
**Date:** 2026-11-15 | **Sealed:** 21:53 +07:00
**Production:** `lvnvkpyxtuilhrabtlwv` (ap-southeast-1)
**Tenant:** Bella Interior Demo (`686884d2-6a4a-4581-ac8f-6ae69666b31d`)
**Test user:** `demo.interior@bellaspa.vn` (ID: `9077b10b-ee20-4058-907b-7a3e918b84c3`)

---

## Trạng thái tổng thể (chính xác theo phạm vi)

| Phạm vi | Trạng thái |
|---|---|
| Production migration | 🔒 SEALED — theo evidence Windows A–D |
| DB integrity / RLS | ✅ VERIFIED |
| Authenticated API | ✅ VERIFIED |
| Lifecycle RPC | ✅ PROVEN |
| Full business-flow E2E | ⚠️ PARTIAL |
| Browser UI E2E | ❌ NOT TESTED |
| Deployment migration | ✅ COMPLETE — trong phạm vi đã triển khai |

> [!NOTE]
> Báo cáo này phân biệt rõ **DB/API VERIFIED** với **Full Business-Flow E2E**. Ba flow (Customer Approval, Addendum, Payment Recording) chưa thực hiện giao dịch thật — được giữ trong danh sách kiểm chứng tiếp theo.

> [!CAUTION]
> **Không reset password, không thay đổi dữ liệu Production, không thực hiện giao dịch tài chính** chỉ để làm đẹp báo cáo.

---

## Baseline Production (tại thời điểm E2E)

| Table | Rows |
|---|---|
| `interior_projects` | 5 |
| `interior_quotations` | 1 (`BG-THD-2026-01`, status=`accepted`) |
| `interior_contracts` | 1 (`HD-NT-2026/08`, status=`active`, value=1,350,000,000 VND) |
| `interior_customer_approvals` | 0 |
| `interior_contract_addenda` | 0 |
| `interior_payment_transactions` | 0 |
| `interior_payment_milestones` | 5 |

---

## Flow 1 — Quotation → Customer Approval → Contract

**Phạm vi đã chứng minh:** RPC tồn tại + GRANT + dữ liệu liên kết đúng.
**Chưa chứng minh:** Toàn bộ approval flow end-to-end (tạo approval request → customer approve → contract được tạo).

| Check | Kết quả | Phạm vi |
|---|---|---|
| Quotation `BG-THD-2026-01` v1 tồn tại | ✅ PASS | DB read |
| Quotation `status=accepted`, `grand_total=1,350,000,000` | ✅ PASS | DB read — từ seeding |
| `interior_create_quotation_snapshot`: SECURITY DEFINER + GRANT authenticated | ✅ PASS | `pg_proc` + `role_routine_grants` |
| `interior_create_customer_approval_request`: SECURITY DEFINER + GRANT authenticated | ✅ PASS | Idem |
| Contract `HD-NT-2026/08` linked đúng project+quotation | ✅ PASS | DB read |
| Approval flow (snapshot → request → approval → contract created) | ⚠️ NOT TESTED | Cần giao dịch thật trên UI |

---

## Flow 2 — Contract Addendum → Customer Approval

**Phạm vi đã chứng minh:** Schema, RLS policy, trigger, RPC tồn tại và đúng cấu hình.
**Chưa chứng minh:** Tạo addendum thực tế, trigger advance khi customer approve.

| Check | Kết quả | Phạm vi |
|---|---|---|
| `interior_contract_addenda` readable bởi service_role | ✅ PASS | DB read |
| Anon direct read bị từ chối | ✅ PASS | RLS: `"permission denied for table interior_contract_addenda"` |
| `interior_create_contract_addendum_request`: SECURITY DEFINER + GRANT authenticated | ✅ PASS | `pg_proc` + grants — Window D verified |
| `trg_advance_interior_addendum_after_customer_approval` trigger tồn tại | ✅ PASS | Window D verified |
| M5 columns: `proposed_payment_schedule`, `base_contract_value`, `customer_approval_id` | ✅ PASS | Window D verified |
| Tạo addendum thực tế và trigger advance | ⚠️ NOT TESTED | Cần giao dịch thật — 0 rows hiện tại |

---

## Flow 3 — Payment Recording → Trigger + RLS

**Phạm vi đã chứng minh:** Trigger và RLS guards ngăn chặn truy cập không phép.
**Chưa chứng minh:** Thực hiện giao dịch thanh toán thành công từ đầu đến cuối.

| Check | Kết quả | Phạm vi |
|---|---|---|
| `guard_interior_payment_transaction_insert`: SECURITY DEFINER | ✅ PASS | `pg_proc.prosecdef=true` |
| RLS SELECT: `interior_payment_transactions_finance_read` | ✅ PASS | `pg_policies` |
| RLS INSERT: `interior_payment_transactions_record` | ✅ PASS | `pg_policies`, `with_check=private.interior_payment_transaction_record_allowed()` |
| Anon INSERT bị từ chối | ✅ PASS | `"permission denied for table interior_payment_transactions"` |
| Anon SELECT trả về 0 rows | ✅ PASS | Không leak dữ liệu |
| Baseline: 0 rows, không test pollution | ✅ PASS | Admin read confirmed |
| Giao dịch thanh toán thành công (happy path) | ⚠️ NOT TESTED | Cần authorized user thực hiện payment thật |

> [!WARNING]
> **Milestone 1 và 2 — bất nhất nghiệp vụ cần reconciliation riêng:**
> - `status = paid`, `paidAt` có giá trị (2026-11-06T15:11:15Z)
> - `collected_amount = 0.00`
> - Không phải lỗi migration. Là pre-existing inconsistency từ seeding.
> - **Không tự động bỏ qua khi đối soát tài chính.** Cần reconciliation riêng để xác định liệu payment transactions có tồn tại ở nơi khác hay không.

---

## Flow 4 — Lifecycle Context

**Phạm vi đã chứng minh:** Cả DB-layer và authenticated API-layer. Đây là flow duy nhất được PROVEN đầy đủ.

| Check | Kết quả | Phạm vi |
|---|---|---|
| Unauthenticated call bị từ chối | ✅ PASS | `"permission denied for function"` |
| Authenticated session (`demo.interior@bellaspa.vn`) | ✅ PASS | JWT obtained, sign-in thành công |
| `interior_read_contract_project(project_id)` trả về đúng data | ✅ PASS | Authenticated API call |
| `interior_read_contract_lifecycle_context(contract_id, 'payment')` | ✅ PASS | Authenticated API call |
| Payload `payment` context: `{id, milestoneOrder}` per milestone | ✅ PASS (by design) | Source code confirmed — intentional minimal payload |
| `amendment` context returns full milestone data | ✅ VERIFIED | Source code confirmed |

**Response mẫu — `interior_read_contract_project`:**
```json
{
  "hasContract": true,
  "financeAccess": true,
  "contract": {
    "contractNumber": "HD-NT-2026/08",
    "status": "active",
    "baselineContractValue": 1350000000,
    "currentContractValue": 1350000000,
    "addenda": [],
    "milestones": [ /* 5 items — full detail */ ]
  }
}
```

**Response mẫu — `interior_read_contract_lifecycle_context` (payment):**
```json
{
  "id": "b2c11111-...",
  "status": "active",
  "tenantId": "686884d2-...",
  "projectId": "77a11111-...",
  "milestones": [{"id": "...", "milestoneOrder": 1}, /* × 5 */]
}
```

---

## Tổng kết checks

| ID | Check | Status | Phạm vi |
|---|---|---|---|
| B1 | 1 active contract HD-NT-2026/08 | ✅ PASS | DB |
| B2 | 5 payment milestones | ✅ PASS | DB |
| B2a | Milestone 1,2: status=paid, collected_amount=0 | ⚠️ INCONSISTENCY | Cần reconciliation riêng |
| B3 | 0 payment_transactions baseline | ✅ PASS | DB |
| F1-1 | Quotation tồn tại + status=accepted | ✅ PASS | DB |
| F1-2 | RPC quotation_snapshot: SECDEF + GRANT | ✅ PASS | DB |
| F1-3 | RPC customer_approval_request: SECDEF + GRANT | ✅ PASS | DB |
| F1-4 | Contract→project+quotation link | ✅ PASS | DB |
| F1-5 | Approval flow end-to-end | ⚠️ NOT TESTED | Cần UI + giao dịch thật |
| F2-1 | interior_contract_addenda readable by admin | ✅ PASS | DB |
| F2-2 | DENY-ALL RLS policy active | ✅ PASS | API (anon rejected) |
| F2-3 | RPC addendum_request: SECDEF + GRANT | ✅ PASS | DB |
| F2-4 | Addendum advance trigger | ✅ PASS | DB |
| F2-5 | M5 columns present | ✅ PASS | DB |
| F2-6 | Tạo addendum thực tế | ⚠️ NOT TESTED | Cần UI + giao dịch thật |
| F3-1 | guard trigger SECURITY DEFINER | ✅ PASS | DB |
| F3-2 | 2 RLS policies on payment_transactions | ✅ PASS | DB |
| F3-3 | Anon INSERT rejected (RLS) | ✅ PASS | API (anon rejected) |
| F3-4 | Anon SELECT returns empty (RLS) | ✅ PASS | API |
| F3-5 | No test pollution | ✅ PASS | DB |
| F3-6 | Payment recording happy path | ⚠️ NOT TESTED | Cần authorized user + giao dịch thật |
| F4-1 | lifecycle RPCs: SECDEF + GRANT | ✅ PASS | DB |
| F4-2 | Unauthenticated call rejected | ✅ PASS | API |
| F4-3 | Authenticated RPC returns correct data | ✅ PASS | Authenticated API |

**Tổng: 20 PASS, 0 FAIL, 4 NOT TESTED (không phải lỗi — chưa thực hiện giao dịch thật)**

---

## Danh sách kiểm chứng tiếp theo

Ba luồng chưa thực hiện giao dịch thật — giữ lại để kiểm chứng khi có điều kiện:

| # | Luồng | Điều kiện thực hiện |
|---|---|---|
| 1 | Quotation Snapshot → Customer Approval Request → Contract creation | Cần UI + user có `interior:contract:create` |
| 2 | Contract Addendum Request → Customer Approval → trigger advance | Cần contract `active` + user có `interior:contract:amend` |
| 3 | Payment Recording (happy path) | Cần milestone `pending` + user có `interior:payment:record` |

> [!NOTE]
> Các điều kiện đã sẵn sàng: contract `HD-NT-2026/08` active, milestones 3–5 `pending`. Chỉ cần UI session với user có đủ quyền.

---

## Vấn đề tồn đọng cần theo dõi riêng

| Item | Mô tả | Priority |
|---|---|---|
| Milestone 1,2 `collected_amount=0` | `status=paid`, `paidAt` có nhưng `collected_amount=0`. Cần xác định nguồn gốc payment và reconcile. | Nghiệp vụ — không block |
| Null-name migrations (`20261114110000`, `20261114120000`, `20261114120100`) | Có trong ledger, `name=null`, `created_by=null`. Chưa map được source file. | Tracking |

---

## Kết luận

**BELLA Interior Commercial — Production DB/API Verified.**

- 20 checks PASS, 0 FAIL.
- DB integrity, RLS, triggers, security definer: VERIFIED.
- Authenticated API (Lifecycle Context): PROVEN.
- Full business-flow E2E (Customer Approval, Addendum, Payment): PARTIAL — chưa có giao dịch thật.
- Browser UI: NOT TESTED.
- Migration Windows A–D: SEALED — không cần mở lại.

Trạng thái này không được đánh đồng với việc toàn bộ hành trình nghiệp vụ trên giao diện đã được chứng minh.
