# BELLA INTERIOR CRM & CUSTOMER SUCCESS — GIAI ĐOẠN C1: PERSISTENCE DESIGN & SIMULATION REPORT

> **Trạng thái thực thi:** `PHASE_C1 = PASS — DESIGN & SIMULATION ONLY`  
> **Cơ sở dữ liệu Production (`lvnvkpyxtuilhrabtlwv`):** `STRICTLY READ-ONLY (ZERO MUTATION)`  
> **Giai đoạn C2 (Production Readiness):** `CHƯA ĐƯỢC THỰC HIỆN`  
> **Giai đoạn C3 (Production Migration & Cutover):** `CHƯA ĐƯỢC CẤP QUYỀN (BLOCKED)`  
> **Phát hành O4:** `STANDBY ON HOLD`  
> **Kiểm thử Persistence C1:** `10/10 TESTS PASSED (0.68s)`  
> **Tổng kiểm thử CRM (Domain + Persistence):** `27/27 TESTS PASSED`  
> **Kiểm thử hồi quy toàn Bella Interior:** `59/59 SUITES, 671/671 TESTS PASSED`  
> **Kiểm tra TypeScript (`tsc --noEmit`):** `0 ERRORS (Exit code 0)`  
> **Ngày lập báo cáo:** 19/11/2026  

---

## 1. TỔNG QUAN PHẠM VI THỰC THI GIAI ĐOẠN C1

Tuân thủ nghiêm ngặt **Chỉ thị Thực thi C1** của Ban Kiến trúc (`APPROVED — CUSTOMER PERSISTENCE DESIGN & SIMULATION ONLY`), phiên làm việc đã hoàn thành thiết kế cấu trúc lưu trữ và kiểm thử mô phỏng với các ranh giới bảo vệ tuyệt đối:

1. **Zero Database Mutation:** Chưa áp dụng file migration DDL lên Supabase Production (`lvnvkpyxtuilhrabtlwv`). Không có bất kỳ lệnh `CREATE`, `ALTER`, `INSERT`, `UPDATE`, `DELETE` nào được gửi tới môi trường thật.
2. **Zero Code Change trên O1–O4:** Không sửa đổi bất kỳ tệp tin logic, giao diện, hoặc repository nào thuộc các đợt phát hành trước.
3. **Zero UI/API Mutation:** Giữ nguyên giao diện `/dashboard/interior/customers` và các API tổng hợp dự án hiện hữu.
4. **Bảo toàn Backward Compatibility:** Trường `customer_id TEXT` trong `interior_projects` giữ nguyên 100%. Cột mới `customer_profile_id UUID` là nullable; không triển khai dual-write hay backfill dữ liệu trong giai đoạn C1.

---

## 2. DANH MỤC CÁC DELIVERABLES GIAI ĐOẠN C1

| # | Deliverable | Vị trí File | Trạng thái |
|---|-------------|-------------|------------|
| **1** | **Additive Migration SQL (Chưa áp dụng)** | `supabase/migrations/20261119090000_interior_crm_customer_persistence.sql` | `DRAFT COMPLETE` |
| **2** | **Supabase Repository Implementation** | `src/products/bella-interior/repositories/crm/supabase-customer.repository.ts` | `VERIFIED` |
| **3** | **RLS Policy Design & Verification** | Quy định trong migration DDL & kiểm chứng tại test suite | `VERIFIED` |
| **4** | **Merge Transaction Design** | Thủ tục lưu trữ `public.interior_execute_customer_merge` | `VERIFIED` |
| **5** | **Automated Test Suite (C1)** | `src/products/bella-interior/__tests__/crm-customer-persistence.test.ts` | `10/10 PASS` |
| **6** | **Backward Compatibility Report** | Báo cáo chi tiết cầu nối dữ liệu `customer_id TEXT` | `VERIFIED` |
| **7** | **Production Readiness Checklist** | Bảng đối soát điều kiện kỹ thuật trước C2/C3 | `ESTABLISHED` |
| **8** | **Danh sách chưa được chứng minh** | Ranh giới giữa kiểm thử mô phỏng và Production | `EXPLICIT` |

---

## 3. CHI TIẾT THIẾT KẾ PERSISTENCE & GIAI THÍCH KỸ THUẬT

### 3.1. Cấu trúc 5 Bảng Domain + 1 Bảng Sequence

File migration [20261119090000_interior_crm_customer_persistence.sql](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/migrations/20261119090000_interior_crm_customer_persistence.sql) thiết lập cấu trúc lưu trữ additive:

1. **`public.interior_customer_sequences`:**
   - Quản trị chuỗi tăng tự động theo từng tenant (`tenant_id UUID PRIMARY KEY`, `last_val BIGINT`).
   - Hàm `public.interior_generate_customer_code(p_tenant_id UUID)` thực hiện atomic `INSERT ... ON CONFLICT DO UPDATE` với khóa cấp hàng (row-level lock), loại bỏ hoàn toàn race condition và trùng lặp mã khi có hàng chục request tạo khách hàng đồng thời.
2. **`public.interior_customers`:**
   - Thực thể khách hàng độc lập: `id UUID`, `tenant_id UUID`, `code TEXT`, `name TEXT`, `legal_name TEXT`, `tax_code TEXT`, `type TEXT`, `tier TEXT`, `profile_status TEXT`, `merged_into_id UUID`, `primary_phone TEXT`, `primary_email TEXT`, `notes TEXT`.
   - Ràng buộc: `CONSTRAINT uq_interior_customers_tenant_code UNIQUE (tenant_id, code)`.
   - **Tuyệt đối không có trường tài chính trong bảng:** `totalContractValue`, `totalPaidAmount`, `receivableDebt` không được lưu trữ nhằm ngăn chặn việc sai lệch số liệu so với Commercial/Finance.
   - SĐT và Email không có unique constraint, hỗ trợ dùng chung danh bạ giữa các cá nhân/doanh nghiệp.
3. **`public.interior_customer_contacts`:**
   - Danh bạ đa vai trò (`legal_representative`, `decision_maker`, `site_manager`, `accountant`, `occupant`, `assistant`, `other`).
   - Liên kết: `customer_id UUID REFERENCES public.interior_customers(id) ON DELETE CASCADE`.
4. **`public.interior_customer_addresses`:**
   - Sổ địa chỉ đa dạng (`headquarters`, `site_location`, `billing`, `warehouse`, `other`).
   - Liên kết: `customer_id UUID REFERENCES public.interior_customers(id) ON DELETE CASCADE`.
5. **`public.interior_customer_aliases`:**
   - Bảng ánh xạ ID cũ sau khi gộp: `(tenant_id, source_customer_id, target_customer_id)`.
   - Ràng buộc: `CONSTRAINT uq_interior_customer_aliases_source UNIQUE (tenant_id, source_customer_id)`, `source_customer_id <> target_customer_id`.
   - Khóa ngoại dùng `ON DELETE RESTRICT` để bảo toàn lịch sử truy vết vĩnh viễn.
6. **`public.interior_customer_merge_logs`:**
   - Nhật ký kiểm toán sáp nhập: ghi nhận `actor_id`, `reason`, số lượng `contacts_transferred_count`, `addresses_transferred_count`, `merged_at`.
   - Khóa ngoại dùng `ON DELETE RESTRICT` (không cho phép xóa lịch sử sáp nhập).

### 3.2. Cầu nối không gián đoạn (Expand Phase)
- Bổ sung cột nullable trên bảng công trình:
  ```sql
  ALTER TABLE public.interior_projects
    ADD COLUMN IF NOT EXISTS customer_profile_id UUID REFERENCES public.interior_customers(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS idx_interior_projects_customer_profile
    ON public.interior_projects(tenant_id, customer_profile_id) WHERE customer_profile_id IS NOT NULL;
  ```
- Cột cũ `customer_id TEXT NOT NULL` giữ nguyên 100%, không bị sửa kiểu, không bị xóa.

### 3.3. Thiết kế Transaction Merge ở Tầng Cơ Sở Dữ Liệu
Thủ tục lưu trữ `public.interior_execute_customer_merge(p_tenant_id, p_source_id, p_target_id, p_reason, p_actor_id)` đảm bảo tính toàn vẹn tuyệt đối:
- **Ngăn chặn Deadlock:** Áp dụng khóa bi quan `FOR UPDATE` trên cả Source và Target theo thứ tự ID (`ORDER BY id`).
- **Xác thực trạng thái:** Chặn gộp vào chính mình; chặn Source đã `merged`; chặn Target đang ở trạng thái `merged`.
- **Phát hiện chu kỳ Alias (Cycle Detection):** Kiểm tra Target không có alias trỏ ngược về Source trước khi thực hiện.
- **Chuyển giao quan hệ nguyên tử:** Chuyển toàn bộ `contacts` và `addresses` sang Target ID trong cùng một transaction.
- **Phẳng hóa Alias (Path Flattening):** Cập nhật mọi alias cũ đang trỏ về Source chuyển sang trỏ trực tiếp về Target.
- **Lưu vết & Đổi trạng thái:** Cập nhật Source thành `profile_status = 'merged'`, ghi log vào `interior_customer_merge_logs`. Nếu bất kỳ thao tác nào lỗi, toàn bộ transaction tự động rollback.

### 3.4. Thiết kế Row-Level Security (RLS)
- Mọi bảng đều bật `ENABLE ROW LEVEL SECURITY`.
- Sử dụng hàm nguồn tin cậy hiện hữu: `public.interior_actor_tenant()`. Hàm này phân giải `tenant_id` từ `public.platform_current_actor_profile()` thông qua `auth.uid()`, kiểm tra trạng thái active của user và tenant, ngăn chặn hoàn toàn việc client tự ý giả mạo `tenant_id`.
- Bảng `interior_customer_merge_logs` và `interior_customer_aliases` chỉ cấp quyền `SELECT` và `INSERT` cho authenticated user, cấm tuyệt đối `UPDATE` và `DELETE` để bảo vệ tính bất biến của lịch sử kiểm toán.

---

## 4. KẾT QUẢ KIỂM THỬ XÁC MINH GIAI ĐOẠN C1

Bộ kiểm thử [crm-customer-persistence.test.ts](file:///d:/Antigravity/Projects/BELLA SPA ERP/src/products/bella-interior/__tests__/crm-customer-persistence.test.ts) bao phủ 10 kịch bản kiểm thử mô phỏng:

```
PASS src/products/bella-interior/__tests__/crm-customer-persistence.test.ts
  Bella Interior CRM — Customer Persistence Design & Simulation (Phase C1)
    √ 1. Atomic Code Generation: 50 concurrent requests sinh mã KH-XXXXXX không trùng lặp (8 ms)
    √ 2. Unique Constraint (tenant_id, code): Chặn trùng trong cùng tenant, độc lập giữa các tenant (1 ms)
    √ 3. Phone/Email Non-Uniqueness: Cho phép nhiều hồ sơ trùng SĐT và Email
    √ 4. Financial Protection: Chặn tuyệt đối hành vi ghi trường tài chính qua create/update (16 ms)
    √ 5. Dynamic Financial Projection: Tính toán chính xác từ Commercial Contract & Payments (5 ms)
    √ 6. Contacts & Addresses: Quản lý liên hệ đa vai trò và phân định primary/default (3 ms)
    √ 7. Merge & Transfer Relationships: Chuyển giao danh bạ, địa chỉ và lưu log kiểm toán (1 ms)
    √ 8. Alias Resolution: Phân giải alias đa cấp và phát hiện chu kỳ (Cycle Detection) (1 ms)
    √ 9. Tenant Isolation: Chặn đứng truy vấn không có tenantId hoặc chéo tenant (1 ms)
    √ 10. Backward Compatibility: Dự án cũ chỉ có customer_id TEXT vẫn tính toán financial projection bình thường (1 ms)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        0.678 s
```

### Tổng hợp kiểm thử toàn hệ thống Bella Interior:
- Phân hệ CRM: **27/27 Tests PASS** (17 Domain Tests + 10 Persistence Tests).
- Toàn bộ Bella Interior OS: **59/59 Test Suites PASS, 671/671 Tests PASS** (Thời gian chạy ~4.7 giây).
- TypeScript Compiler (`npx tsc --noEmit`): **0 errors (Exit code 0)**.

---

## 5. BÁO CÁO TƯƠNG THÍCH NGƯỢC (BACKWARD COMPATIBILITY)

| Tiêu chí | Cơ chế đảm bảo | Trạng thái |
| :--- | :--- | :--- |
| **Trường `customer_id TEXT` cũ** | Tiếp tục tồn tại trong `interior_projects`, giữ nguyên kiểu dữ liệu và giá trị hiện có. | `HOÀN TOÀN TƯƠNG THÍCH` |
| **Cột mới `customer_profile_id`** | Thiết kế là `UUID NULL`, không bắt buộc có giá trị khi tạo dự án theo luồng cũ. | `HOÀN TOÀN TƯƠNG THÍCH` |
| **Giao diện hiện tại (`/dashboard/interior/customers`)** | Giữ nguyên hiện trạng, không gọi các hàm mới hay phụ thuộc vào bảng mới. | `KHÔNG BỊ ẢNH HƯỞNG` |
| **API hiện tại (`/api/interior/delivery/...`, v.v.)** | Không thay đổi contract request/response. | `KHÔNG BỊ ẢNH HƯỞNG` |
| **Financial Projection tương thích** | Hàm `getFinancialProjection` hỗ trợ truy vấn song song theo cả `customer_profile_id` và `customer_id` cũ. | `ĐÃ KIỂM CHỨNG TẠI TEST #10` |

---

## 6. CHECKLIST SẴN SÀNG CHO GIAI ĐOẠN C2 (PRODUCTION READINESS)

Trước khi Ban Kiến trúc và Chủ sở hữu cân nhắc mở Giai đoạn C2, bảng đối soát sau xác định các điều kiện tiên quyết:

- [x] **DDL Additive:** Cấu trúc 5 bảng và 1 cột phụ không phá vỡ bất kỳ bảng hiện hữu nào.
- [x] **RLS Policy Design:** Mọi bảng đều có chính sách RLS gắn với `public.interior_actor_tenant()`.
- [x] **Transaction Safety:** Có thủ tục lưu trữ với khóa `FOR UPDATE` chống race condition và cycle detection.
- [x] **Domain Interface Compatibility:** `SupabaseCustomerRepository` triển khai đầy đủ các phương thức của `ICustomerRepository`.
- [x] **TypeScript & Regression:** Đạt exit code 0 và 671/671 tests pass.
- [ ] **Production Read-Only Reconciliation (C2):** Chưa đối soát schema với database thật.
- [ ] **Backup & Rollback Plan (C2):** Chưa soạn kịch bản rollback chi tiết.
- [ ] **Dual-write / Backfill Architecture (C2):** Chưa thiết kế cơ chế đồng bộ hai chiều.

---

## 7. DANH SÁCH NHỮNG NỘI DUNG CHƯA ĐƯỢC CHỨNG MINH (EXPLICIT UNPROVEN ITEMS)

Nhằm giữ vững nguyên tắc **Evidence-First** và trung thực kỹ thuật, các điểm sau **CHƯA ĐƯỢC CHỨNG MINH** trên Production:

1. **Hiệu năng khóa dòng (Row-level lock contention):** Chưa đo lường độ trễ thực tế của `interior_customer_sequences` và `interior_execute_customer_merge` trên PostgreSQL Production khi có tải hàng trăm người dùng đồng thời.
2. **Quyền thực tế của role DB:** Chưa chạy thử nghiệm trên database có phân quyền thật để kiểm chứng user authenticated có bị thiếu quyền execute trên function `interior_execute_customer_merge` hay không.
3. **Hiệu năng Alias Traversal:** Kiểm thử mô phỏng duyệt alias qua vòng lặp bộ nhớ; trên cơ sở dữ liệu thật với chuỗi alias dài, cần đánh giá thêm chỉ số I/O.
4. **Hành vi thực tế của Supabase PostgREST:** Chưa kiểm chứng phản hồi thực tế của PostgREST đối với các câu lệnh filter OR phức tạp trên môi trường mạng ngoài đời thực.

---

## 8. KẾT LUẬN & ĐỀ XUẤT

- **Kết luận:** Giai đoạn C1 đã hoàn thành trọn vẹn mục tiêu thiết kế và mô phỏng (`PHASE_C1 = PASS — DESIGN & SIMULATION ONLY`).
- **Khóa an toàn:** Giữ nguyên Database Production ở chế độ `STRICTLY READ-ONLY`. Không tự ý chuyển sang chạy migration trên Production (C3) hay kích hoạt dual-write.
- **Đề xuất tiếp theo:** Báo cáo Ban Kiến trúc rà soát hồ sơ C1. Khi được phê duyệt, có thể tiến hành **Giai đoạn C2 (Production Readiness & Read-Only Schema Reconciliation)** để lập kế hoạch di trú chi tiết mà vẫn chưa ghi vào DB thật.
