# BELLA Interior Commercial — M1 Idempotency Analysis
**Migration:** `20261113165251_interior_commercial_transaction_engine.sql`
**Ngày phân tích:** 2026-11-15 | **Trạng thái:** REV-2 — OWNER REVIEWED — CHỜ DEPLOYMENT APPROVAL
**Analyst:** AI Agent | **Production:** `lvnvkpyxtuilhrabtlwv` (ap-southeast-1)
**Deployment Strategy:** Option D — Wrapper Transaction ✅ SELECTED BY OWNER

---

> [!IMPORTANT]
> Không có thay đổi nào được apply lên Production cho đến khi Owner ký Deployment Approval cho Maintenance Window B. Artifact này ghi nhận phân tích và kết quả verification. **Production state: NO CHANGE.**

> [!NOTE]
> **REV-2 (2026-11-15T20:49 +07:00):** Owner review REV-1 → chọn Option D. 5 verification points tồn đọng đã được xác nhận. Conflict table, Transaction Compatibility Check, Deployment Wrapper Design, Post-deployment SQL đã được cập nhật đầy đủ.

---

## 1. Tóm tắt Executive

M1 (`20261113165251`) là migration nền của toàn bộ luồng commercial Interior: customer evidence guards, customer approval flow, payment transaction engine, và một loạt read RPCs. Migration này **chưa có trong ledger Production**.

| Mức độ | Số lượng | Trạng thái REV-2 |
|--------|----------|-----------------|
| 🔴 CRITICAL | 2 | C01/C02 — Xử lý bằng re-apply M12/M13 trong cùng Wrapper Transaction |
| 🟡 MEDIUM | 3 | C03 (ADD COLUMN, 1 live row), C04 (RLS atomic), C05 (signature verified) |
| 🟢 SAFE | 10+ | Tất cả còn lại — idempotent, no-op, hoặc mới hoàn toàn |

**Kết luận REV-2:** M1 có thể apply an toàn với **Option D — Wrapper Transaction**: BEGIN → M1 → re-apply M12 → re-apply M13 → verify → COMMIT. Mọi lỗi → ROLLBACK, Production giữ nguyên.

**Transaction Compatibility:**
- ✅ M1 không chứa `CREATE INDEX CONCURRENTLY` (xác nhận: grep = no match)
- ✅ M1 không có `BEGIN/COMMIT/ROLLBACK` tường minh
- ✅ Storage bucket dùng `ON CONFLICT (id) DO UPDATE` — idempotent trong transaction

---

## 2. Phương pháp Đối chiếu

**Dữ liệu Production thu thập:**

| Session | Timestamp | Queries |
|---------|-----------|---------|
| REV-1 | 2026-11-15T20:44 +07:00 | columns, pg_policies, pg_class.relacl, triggers, pg_proc, storage.buckets |
| REV-2 | 2026-11-15T20:49 +07:00 | row counts, FK column types, prosrc (M12/M13), function signature, grep CONCURRENTLY |

**M1 source:** Đọc đầy đủ 1996 dòng trong 3 session liên tiếp.

---

## 3. Trạng thái Production tại Thời điểm Phân tích

### 3.1 `interior_contracts` — 4 cột cần ADD

```
Query result: [] (4 cột KHÔNG EXISTS)
Columns: design_revision_id, design_version_number,
         quotation_customer_approval_id, customer_approval_id
```

**Row count:** `interior_contracts` = **1 row** (data live).

FK targets:
- `interior_design_revisions.id` — UUID, NOT NULL ✅
- `interior_customer_approvals.id` — UUID, NOT NULL ✅

### 3.2 `interior_payment_transactions` — RLS

```
Hiện tại: tenant_isolation_interior_payment_transactions (ALL, roles={public})
M1 sẽ DROP → tạo:
  interior_payment_transactions_finance_read (SELECT)
  interior_payment_transactions_record (INSERT)
Row count: 0
```

### 3.3 ACL — `interior_customer_approvals` và `interior_contract_addenda`

```
Cả hai bảng: authenticated không có grant (chỉ có postgres, service_role,
bella_developer, bella_migration_executor, verification_executor)
```

### 3.4 Triggers hiện tại (các bảng liên quan M1)

```
interior_contracts:         trg_guard_interior_contracts_immutability (BEFORE UPDATE)
interior_customer_approvals: trg_guard_ica_immutability (BEFORE UPDATE)
                              trg_ica_updated_at (BEFORE UPDATE)
interior_quotation_items:   trg_guard_interior_quotation_items_immutability (BEFORE INSERT/UPDATE/DELETE)
interior_quotations:        trg_guard_interior_quotations_immutability (BEFORE UPDATE/DELETE)
```

7 triggers M1 sẽ tạo: **KHÔNG EXISTS**.

### 3.5 Functions

| Function | Production State |
|----------|-----------------|
| `interior_create_quotation_snapshot` | ✅ EXISTS — prosecdef=true (version M12 xác nhận) |
| `interior_create_customer_approval_request` | ✅ EXISTS — prosecdef=true (version M13 xác nhận) |
| `interior_read_contract_project(p_project_id uuid)` | ✅ EXISTS — RETURNS jsonb, STABLE, prosecdef=true |
| 11 functions còn lại (guards, RPCs, reconcile...) | ❌ NOT EXISTS |

### 3.6 Storage bucket

```
interior-customer-signatures: EXISTS
  public=false | 5MB | [application/pdf, image/jpeg, image/png]
M1 syntax: ON CONFLICT (id) DO UPDATE SET ... → SAFE (idempotent)
```

### 3.7 M12/M13 Source xác nhận từ Production (prosrc)

**`interior_create_quotation_snapshot` (M12 — CONFIRMED LIVE):**
Key line xác nhận version M12 (không phải M1):
```sql
COALESCE(item.value ->> 'stable_component_id', '') IS DISTINCT FROM COALESCE(source.stable_component_id::TEXT, '')
```
Và tại INSERT `interior_quotation_items`:
```sql
NULLIF(item.value ->> 'stable_component_id', '')  -- đúng UUID-to-TEXT handling
```

**`interior_create_customer_approval_request` (M13 — CONFIRMED LIVE):**
Key enum cast pattern xác nhận version M13:
```sql
a.subject_type = v_subject_type::public.interior_approval_subject_type   -- enum cast tại UPDATE
...
v_subject_type::public.interior_approval_subject_type,                   -- enum cast tại INSERT
```

> [!IMPORTANT]
> Đây là prosrc thực tế đang chạy trên Production. Wrapper Transaction phải re-apply chính xác nội dung này sau khi M1 overwrite, không được dùng version khác.

---

## 4. Phân tích Chi tiết Conflicts

### C01 🔴 CRITICAL — `interior_create_quotation_snapshot` bị REPLACE

| Thuộc tính | Giá trị |
|-----------|---------|
| Vị trí M1 | Lines 1251–1430 |
| Statement | `CREATE OR REPLACE FUNCTION` — không có guard |
| Production hiện tại | EXISTS (version M12) |
| Điểm khác biệt chính | M1: `source.stable_component_id` (không cast); M12: `source.stable_component_id::TEXT` |
| Hậu quả nếu không xử lý | UUID ≠ TEXT comparison → lineage check fail runtime |
| **Giải pháp** | Re-apply M12 source trong cùng Wrapper Transaction, ngay sau M1 |

**Source để re-apply:** Lấy từ file `supabase/migrations/20261115020234_*.sql` (đã có trong repo).

---

### C02 🔴 CRITICAL — `interior_create_customer_approval_request` bị REPLACE

| Thuộc tính | Giá trị |
|-----------|---------|
| Vị trí M1 | Lines 613–780 |
| Statement | `CREATE OR REPLACE FUNCTION` — không có guard |
| Production hiện tại | EXISTS (version M13) |
| Điểm khác biệt chính | M1: thiếu `::public.interior_approval_subject_type` cast tại enum operations |
| Hậu quả nếu không xử lý | Type mismatch runtime khi so sánh hoặc insert enum |
| **Giải pháp** | Re-apply M13 source trong cùng Wrapper Transaction, ngay sau M1 |

**Source để re-apply:** Lấy từ file `supabase/migrations/20261115021131_*.sql`.

---

### C03 🟡 MEDIUM — ADD COLUMN với 1 live row

| Cột | FK Target | Nullable | Risk |
|-----|-----------|---------|------|
| `design_revision_id UUID` | `interior_design_revisions(id)` ✅ | YES (không rõ) | FK NOT VALID nếu nullable |
| `design_version_number INTEGER` | — | YES | Low |
| `quotation_customer_approval_id UUID` | `interior_customer_approvals(id)` ✅ | YES | FK NOT VALID nếu nullable |
| `customer_approval_id UUID` | `interior_customer_approvals(id)` ✅ | YES | FK NOT VALID nếu nullable |

**Tại sao MEDIUM (không còn HIGH):**
- FK targets đã xác nhận UUID/NOT NULL ✅
- 1 row trong `interior_contracts` → FK nullable → không vi phạm constraint khi ADD
- `interior_customer_approvals` = 0 rows → không có orphan risk
- ADD COLUMN có DDL lock tạm thời → chạy trong maintenance window (không có traffic)

**Điều cần xác nhận thêm (trước khi apply):**
- M12/M13 functions có tham chiếu đến 4 cột này không? → Đọc prosrc (đã có): **KHÔNG tham chiếu** ✅
- Các function M110000–M140000 có SELECT/UPDATE 4 cột này không? → Chưa xác nhận đầy đủ, nhưng low risk vì cột nullable

> [!NOTE]
> `ADD COLUMN IF NOT EXISTS` là idempotent về lệnh SQL, nhưng không loại trừ được lock contention và constraint risk. Vì Production có 1 live row, bắt buộc chạy trong maintenance window với `lock_timeout`.

---

### C04 🟡 MEDIUM → ✅ RESOLVED bởi Option D

| Thuộc tính | Giá trị |
|-----------|---------|
| Vị trí M1 | Lines 1034–1072 |
| Vấn đề | DROP policy → CREATE 2 policies mới: có window không có policy |
| Production | 0 rows trong `interior_payment_transactions` |
| **Giải pháp** | Wrapper Transaction đảm bảo DROP + CREATE trong cùng atomic block → không có window |

Với Option D, 3 statements này nằm trong cùng transaction → không có RLS gap. ✅

---

### C05 🟡 MEDIUM → ✅ RESOLVED

| Thuộc tính | Giá trị |
|-----------|---------|
| M1 signature | `interior_read_contract_project(p_project_id UUID)` — Line 1886 |
| Production signature | `(p_project_id uuid)` — RETURNS jsonb, STABLE, prosecdef=true |
| Kết quả | **KHỚP hoàn toàn** — `CREATE OR REPLACE` sẽ replace đúng function |
| Risk | None — SAFE ✅ |

---

### C06 🟢 SAFE — `interior_customer_signatures_no_client_access` policy

DO $$ guard tại Lines 264–277 → policy EXISTS → guard skip → **SAFE** ✅

---

### C07 🟢 SAFE — Storage bucket (CONFIRMED)

```sql
-- Lines 252–262 M1:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('interior-customer-signatures', 'interior-customer-signatures',
  FALSE, 5242880, ARRAY['application/pdf', 'image/jpeg', 'image/png']::TEXT[])
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
```

ON CONFLICT DO UPDATE → bucket đã tồn tại → update không thay đổi giá trị → **SAFE** ✅

---

### C08–C15 🟢 SAFE (unchanged từ REV-1)

| # | Object | Lý do SAFE |
|---|--------|-----------|
| C08 | `uq_interior_payment_tx_reference_normalized` | `IF NOT EXISTS` — tạo mới |
| C09 | 7 triggers M1 | NOT EXISTS — tạo mới; DROP IF EXISTS no-op |
| C10 | REVOKE/GRANT `interior_customer_approvals` | `authenticated` chưa có grant → REVOKE no-op |
| C11 | REVOKE `interior_contract_addenda` | `authenticated` chưa có grant → REVOKE no-op |
| C12 | Backfill `interior_payment_milestones` | 0 rows in payment_transactions → no-op |
| C13 | 5 functions guard/reconcile/create | NOT EXISTS → tạo mới |
| C14 | 6 read RPCs (trừ C05) | NOT EXISTS → tạo mới |
| C15 | `guard_interior_payment_transaction_insert` INVOKER | NOT EXISTS → tạo mới; M15 upgrade sau |

---

## 5. Transaction Compatibility Check ✅

```
grep CONCURRENTLY → NO MATCH
grep BEGIN;        → NO MATCH
grep COMMIT;       → NO MATCH
grep ROLLBACK;     → NO MATCH
```

**Kết luận:** M1 không chứa bất kỳ statement nào không tương thích với transactional DDL execution. Option D (Wrapper Transaction) khả thi về mặt kỹ thuật.

> [!WARNING]
> Mỗi lần gọi `execute_sql` qua MCP tool là một transaction riêng lẻ. **Không thể dùng nhiều lần gọi execute_sql để tạo thành một transaction chung.** Wrapper Transaction phải được thực thi trong một script SQL duy nhất hoặc qua psql session với `\set ON_ERROR_STOP on`.

---

## 6. Deployment Strategy — Option D: Wrapper Transaction

### 6.1 Lựa chọn của Owner

Owner đã chọn **Option D** với lý do:
- Không sửa M1 source (không rewrite history)
- Không làm mất implementation M12/M13
- Rollback nguyên tử nếu bất kỳ bước nào fail
- Audit trail rõ ràng

### 6.2 Cấu trúc Wrapper Transaction

```sql
BEGIN;

-- ══════════════════════════════════════════════════════
-- STEP 1: Apply M1 — toàn bộ 1996 dòng
-- ══════════════════════════════════════════════════════
-- [nội dung 20261113165251_interior_commercial_transaction_engine.sql]
-- Sau bước này, 2 functions sẽ về version M1 (cũ).

-- ══════════════════════════════════════════════════════
-- STEP 2: Restore M12 — interior_create_quotation_snapshot
-- ══════════════════════════════════════════════════════
-- [toàn bộ CREATE OR REPLACE FUNCTION từ 20261115020234_*.sql]
-- Khôi phục version M12 với stable_component_id::TEXT cast đúng.

-- ══════════════════════════════════════════════════════
-- STEP 3: Restore M13 — interior_create_customer_approval_request
-- ══════════════════════════════════════════════════════
-- [toàn bộ CREATE OR REPLACE FUNCTION từ 20261115021131_*.sql]
-- Khôi phục version M13 với enum cast đúng.

-- ══════════════════════════════════════════════════════
-- STEP 4: Verification assertions (nếu fail → ROLLBACK tự động)
-- ══════════════════════════════════════════════════════
-- DO $$ verify $$ block: kiểm tra functions, triggers, schema, ACL

-- ══════════════════════════════════════════════════════
-- STEP 5: Ghi ledger trong cùng transaction
-- ══════════════════════════════════════════════════════
-- INSERT INTO bella_migration_ledger (version, name, created_by) VALUES
--   ('20261113165251', 'interior_commercial_transaction_engine', 'production-apply-window-b');

COMMIT;
-- Nếu bất kỳ statement nào fail → toàn bộ ROLLBACK tự động
```

### 6.3 Điều kiện ROLLBACK

Wrapper Transaction ROLLBACK tự động (do PostgreSQL) khi bất kỳ statement nào fail, bao gồm:

| Điều kiện | Hành vi |
|-----------|---------|
| M1 DDL fail (FK violation, duplicate object...) | ROLLBACK toàn bộ |
| M12 restore fail | ROLLBACK toàn bộ |
| M13 restore fail | ROLLBACK toàn bộ |
| Verification assertion fail | ROLLBACK nếu assertion dùng RAISE EXCEPTION |
| Ledger INSERT fail | ROLLBACK toàn bộ |

> [!CAUTION]
> ROLLBACK sẽ undo DDL (ADD COLUMN, CREATE FUNCTION, CREATE TRIGGER, DROP POLICY, CREATE POLICY, CREATE INDEX) vì PostgreSQL hỗ trợ transactional DDL. Production sẽ trở về trạng thái trước Wrapper Transaction. Chỉ COMMIT khi toàn bộ verification PASS.

### 6.4 Ledger Entry

Ghi **1 entry** cho M1 trong cùng transaction:

```sql
INSERT INTO bella_migration_ledger (version, name, created_by, created_at)
VALUES (
  '20261113165251',
  'interior_commercial_transaction_engine',
  'production-apply-window-b',
  clock_timestamp()
);
```

Không ghi entry riêng cho M12/M13 (đã có trong ledger với version `20261115020234` và `20261115021131`).

---

## 7. Post-Deployment Verification SQL

Chạy sau khi transaction COMMIT, trước khi tuyên bố Window B hoàn thành:

```sql
-- 7.1 Verify 4 cột mới tồn tại
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'interior_contracts'
AND column_name IN ('design_revision_id','design_version_number',
                    'quotation_customer_approval_id','customer_approval_id')
ORDER BY column_name;
-- Expect: 4 rows

-- 7.2 Verify RLS policies mới
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'interior_payment_transactions'
ORDER BY policyname;
-- Expect: interior_payment_transactions_finance_read (SELECT),
--         interior_payment_transactions_record (INSERT)
-- NOT expect: tenant_isolation_interior_payment_transactions (ALL)

-- 7.3 Verify functions tồn tại với đúng thuộc tính
SELECT p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
  'interior_create_quotation_snapshot',
  'interior_create_customer_approval_request',
  'guard_interior_commercial_customer_evidence',
  'guard_interior_customer_approval_insert',
  'interior_transition_public_customer_approval',
  'reconcile_interior_payment_milestone_after_receipt',
  'interior_create_contract_with_milestones',
  'guard_interior_payment_transaction_insert',
  'interior_read_boq_for_commercial',
  'interior_read_project_for_contract',
  'interior_read_design_revision_commercial',
  'interior_read_quotation',
  'interior_read_quotations_by_project',
  'interior_read_contract_project',
  'interior_read_contract_for_customer_approval'
)
ORDER BY p.proname;
-- Expect: 15 rows, prosecdef=true cho security-sensitive functions

-- 7.4 Verify M12/M13 chưa bị regression (stable_component_id::TEXT cast)
SELECT prosrc LIKE '%stable_component_id::TEXT%' AS m12_cast_ok
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'interior_create_quotation_snapshot';
-- Expect: true

-- 7.5 Verify M13 enum cast
SELECT prosrc LIKE '%::public.interior_approval_subject_type%' AS m13_enum_ok
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'interior_create_customer_approval_request';
-- Expect: true

-- 7.6 Verify 7 triggers tồn tại
SELECT t.tgname, c.relname AS table_name
FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND t.tgname IN (
  'trg_guard_interior_customer_approval_insert',
  'trg_guard_interior_quotation_customer_evidence',
  'trg_guard_interior_contract_customer_evidence',
  'trg_guard_interior_quotation_items_after_dispatch',
  'trg_advance_interior_commercial_after_customer_approval',
  'trg_guard_interior_payment_transaction_insert',
  'trg_reconcile_interior_payment_milestone_after_receipt'
)
ORDER BY c.relname, t.tgname;
-- Expect: 7 rows

-- 7.7 Verify index
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'interior_payment_transactions'
AND indexname = 'uq_interior_payment_tx_reference_normalized';
-- Expect: 1 row

-- 7.8 Verify ledger entry
SELECT version, name, created_by FROM bella_migration_ledger
WHERE version = '20261113165251';
-- Expect: 1 row

-- 7.9 Verify existing data không bị ảnh hưởng
SELECT id, tenant_id FROM interior_contracts LIMIT 5;
-- Expect: 1 row vẫn tồn tại, không có data corruption
```

---

## 8. Verification Bổ sung (REV-2 — HOÀN TẤT)

### 8.1 Functions M110000–M140000 không tham chiếu 4 cột mới

```
Query result: [] (empty)
-- Không có function nào trong nhóm M110000–M140000 reference
-- design_revision_id, design_version_number, quotation_customer_approval_id,
-- customer_approval_id
```
**Kết quả:** ✅ SAFE — ADD COLUMN không ảnh hưởng các function đã apply.

### 8.2 M1 Lines 1–9 — ADD COLUMN và ALTER COLUMN chi tiết

```sql
-- Line 5: ALTER COLUMN signed_date DROP NOT NULL
--   Production hiện: signed_date = NOT NULL → DROP NOT NULL sẽ chạy thực sự
--   Rủi ro: low (cột có thể nullable với 1 existing row)
--
-- Lines 6–9: ADD COLUMN IF NOT EXISTS (4 cột) — tất cả nullable
--   design_revision_id UUID           (nullable, không có DEFAULT)
--   design_version_number INTEGER      (nullable, không có DEFAULT)
--   quotation_customer_approval_id UUID (nullable, không có DEFAULT)
--   customer_approval_id UUID          (nullable, không có DEFAULT)
```

**FK analysis (Lines 11–42):**
- FK1: `fk_interior_contracts_quotation_approval` → `interior_customer_approvals(tenant_id, id)` — `NOT VALID` ✅
- FK2: `fk_interior_contracts_customer_approval` → `interior_customer_approvals(tenant_id, id)` — `NOT VALID` ✅
- `interior_customer_approvals` có `uq_ica_tenant_id (tenant_id, id)` → FK composite hợp lệ ✅
- `design_revision_id` **không có FK** trong M1 — chỉ ADD COLUMN ✅
- `VALIDATE CONSTRAINT` ở lines 39, 42 — chạy NGAY SAU DO $$ block → FK NOT VALID → VALIDATE sẽ pass (0 rows vi phạm vì cột nullable và existing row có NULL) ✅

### 8.3 Migration `085708`

UNKNOWN — không block M1. Track riêng.

---

## 9. Quyết định Owner (REV-2)

| Hạng mục | Quyết định |
|---------|-----------|
| M1 source | Giữ nguyên — không sửa |
| C01 | Bảo toàn M12 bằng re-apply trong transaction |
| C02 | Bảo toàn M13 bằng re-apply trong transaction |
| C03 | ADD COLUMN chạy thực sự; chạy trong maintenance window |
| C04 | Atomic trong Wrapper Transaction |
| C05 | Signature match confirmed ✅ |
| Deployment strategy | **Option D — Wrapper Transaction** |
| Production | **CHƯA THAY ĐỔI** |
| Maintenance Window B | Chưa lên lịch |
| Deployment Approval | **CHƯA CẤP** |

---

## 10. Thứ tự Deployment Toàn phần (sau khi Approval)

```
Window B: M1 Wrapper Transaction
  → BEGIN
  → M1 (1996 dòng)
  → Re-apply M12 function
  → Re-apply M13 function
  → Verification assertions
  → Ledger INSERT
  → COMMIT / ROLLBACK

Window C: M15 → M14 (Phương án B — bỏ ALTER FUNCTION)
  → guard_interior_payment_transaction_insert (SECURITY DEFINER)
  → Payment RLS redesign

Window D: M5 → M6
  → Phụ thuộc M1 đã apply
```

---

## 11. Lịch sử

| Ngày | Action | Người |
|------|--------|-------|
| 2026-11-15T20:44 | Đọc M1 1996 dòng; Thu thập Production state REV-1 | AI Agent |
| 2026-11-15T20:47 | Viết REV-1 (DRAFT) | AI Agent |
| 2026-11-15T~20:48 | Owner review REV-1; Chọn Option D; Chỉ thị verification | Owner |
| 2026-11-15T20:49 | Chạy 4 queries verification; Grep M1 CONCURRENTLY | AI Agent |
| 2026-11-15T20:50 | Viết REV-2 | AI Agent |
| 2026-11-15T20:55 | Verification 8.1–8.2: functions M11x không ref 4 cột; FK analysis Lines 1–42; signed_date NOT NULL; uq_ica_tenant_id composite ✅ | AI Agent |
| 2026-11-15T20:58 | Tạo wrapper file `supabase/scripts/m1_wrapper_window_b.sql` | AI Agent |
| — | Owner ký Deployment Approval Window B | PENDING |
| — | Paste M1 source vào Section 1 của wrapper | PENDING |
| — | Execute Wrapper Transaction | PENDING |

---

**STATUS: REV-2 COMPLETE — TẤT CẢ VERIFICATION POINTS ĐÃ ĐÓNG. SẴN SÀNG CHỜ OWNER APPROVAL ĐỂ EXECUTE WRAPPER.**

Hai bước còn lại trước khi execute:
1. Owner ký Deployment Approval cho Maintenance Window B
2. Paste toàn bộ M1 source (1903 dòng) vào Section 1 của `supabase/scripts/m1_wrapper_window_b.sql`
