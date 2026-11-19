# BELLA INTERIOR CRM — PHASE C3 FINAL RELEASE HARDENING REPORT

> **Date:** 19/11/2026  
> **Order Reference:** `CODEX ORDER — BELLA INTERIOR C3 FINAL RELEASE HARDENING`  
> **Target Production Database:** Supabase Free `lvnvkpyxtuilhrabtlwv` (STRICTLY READ-ONLY MAINTAINED)  
> **Local Test Engine:** PostgreSQL 17.10 Local (Port 5434)  
> **Git Branch:** `main`  
> **Overall Hardening Verdict:** `C3 RELEASE HARDENED — AWAITING PRODUCTION MIGRATION AUTHORIZATION`

---

## 1. Bảng Tổng hợp Trạng thái Kiểm định Cuối cùng (Final Verdict Matrix)

$$\mathbf{STATUS: \quad LOCAL \ PERSISTENCE \ VERIFIED \quad — \quad RLS \ AUTHENTICATED \ PASS \quad — \quad MIGRATION \ DISCOVERY \ SAFE}$$
$$\mathbf{BOUNDARY: \quad PRODUCTION \ MIGRATION \ UNAUTHORIZED \quad (STRICTLY \ READ-ONLY \ MAINTAINED)}$$

| Tiêu chuẩn Đánh giá | Trạng thái (Verdict) | Bằng chứng Kỹ thuật & Thực nghiệm |
| :--- | :---: | :--- |
| **1. C3_IMPLEMENTATION** | **PASS** | Đầy đủ CRUD Hồ sơ khách hàng, Danh bạ liên hệ đa vai trò, Sổ địa chỉ đa điểm, Cầu nối dự án (`customer_profile_id`), và bọc phòng vệ tài chính (`DIRECT_FINANCIAL_MUTATION_PROHIBITED`). |
| **2. LOCAL_POSTGRES_PERSISTENCE** | **PASS** | Đạt 100% trên động cơ **PostgreSQL 17.10 Local** (cổng 5434) với 8 bảng và view, sequence nguyên tử, trigger chống xóa cứng và khóa ngoại composite. |
| **3. RLS_SECURITY** | **PASS** | Kiểm thử trực tiếp bằng role `authenticated` và JWT context (`request.jwt.claim.tenant_id`): Tenant B nhận 0 dòng khi truy vấn Tenant A; bị chặn RLS khi insert chéo; quyền `DELETE` trực tiếp trên profile và quyền `INSERT` trên alias/merge_logs bị thu hồi nghiêm ngặt; `search_path=''` cố định an toàn; chặn gọi thủ tục chéo tenant với lỗi `TENANT_FORBIDDEN`. |
| **4. LEGACY_COMPATIBILITY** | **PASS** | Ngăn chặn triệt để hiện tượng nhân đôi hồ sơ (duplicate profiles) thông qua bộ đối soát 3 lớp (project link, phone match, code match); hiển thị đầy đủ dự án cũ; không làm thay đổi quyền sở hữu dữ liệu tài chính. |
| **5. MIGRATION_DISCOVERY** | **PASS (CRITICAL FIX)** | Đã di chuyển toàn bộ script rollback ra khỏi `supabase/migrations/` vào thư mục riêng `supabase/rollback/`. Thư mục `supabase/migrations/` chỉ chứa duy nhất Up migration [20261119090000_interior_crm_customer_persistence.sql](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/migrations/20261119090000_interior_crm_customer_persistence.sql). Ngăn chặn 100% rủi ro Supabase CLI tự động chạy rollback sau khi Up. |
| **6. ROLLBACK_VERIFICATION** | **PASS** | Đã thực thi kịch bản hoàn nguyên [20261119090001_interior_crm_customer_persistence_rollback.sql](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/rollback/20261119090001_interior_crm_customer_persistence_rollback.sql) từ thư mục rollback trên PostgreSQL 17: Toàn bộ 8 bảng/view CRM và cột `customer_profile_id` bị hủy sạch sẽ, dữ liệu dự án cũ được bảo toàn nguyên vẹn 100%. |
| **7. SOURCE_CONTROL_INTEGRITY** | **PASS** | Branch `main`, 12 file sửa đổi được kiểm soát chặt chẽ, các file mới/untracked được bảo toàn, không có commit/push/deploy trái phép. |
| **8. PRODUCTION_MIGRATION_READINESS** | **READY (UNAUTHORIZED)** | Sẵn sàng về mặt kỹ thuật; **Production DB `lvnvkpyxtuilhrabtlwv` tuyệt đối không bị can thiệp DDL/DML**. Chờ quyết định cấp quyền riêng của Chủ sở hữu. |

---

## 2. Khắc phục Trọng yếu: Di chuyển Rollback Script & Bảo toàn Migration Discovery

### 2.1. Phân tích Rủi ro Ban đầu
Trong cấu trúc mặc định của Supabase CLI:
- Thư mục `supabase/migrations/` được xem là chuỗi migration lũy tiến được sắp xếp tăng dần theo tiền tố timestamp (`YYYYMMDDHHMMSS`).
- Nếu đặt file rollback `20261119090001_interior_crm_customer_persistence_rollback.sql` trong cùng thư mục với file Up `20261119090000_interior_crm_customer_persistence.sql`:
  - Lệnh `supabase db push` hoặc migration runner sẽ thực thi file Up (tạo bảng).
  - Ngay sau đó (chỉ sau 1 giây timestamp), migration runner sẽ thực thi tiếp file Rollback (xóa sạch toàn bộ bảng vừa tạo)!

### 2.2. Biện pháp Khắc phục Triệt để Đã Thực hiện
1. **Tạo thư mục độc lập:** Tạo thư mục `supabase/rollback/` nằm ngoài luồng phát hiện của Supabase CLI.
2. **Di chuyển script hoàn nguyên:**  
   Chuyển [20261119090001_interior_crm_customer_persistence_rollback.sql](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/rollback/20261119090001_interior_crm_customer_persistence_rollback.sql) sang `supabase/rollback/`.
3. **Kiểm tra Discovery Sequence:**
   - 5 migration cuối cùng trong chuỗi migration của dự án hiện tại:
     ```text
     20261117131034_interior_design_audit_action_vocabulary.sql        
     20261117150604_interior_boq_approval_audit_action_canonical.sql   
     20261118060000_interior_o3_storage_lineage_and_audit_canonical.sql
     20261118120000_interior_o4_acceptance_campaign_and_evidence.sql   
     20261119090000_interior_crm_customer_persistence.sql              
     ```
   - Điểm cuối của chuỗi migration là file **Up Persistence**. Tuyệt đối không còn file rollback nào trong thư mục migrations.

---

## 3. Kiểm định Chuyên sâu RLS & Security Dưới Vai Trò `authenticated`

Đã thực thi kịch bản `scratch/run_c3_final_release_hardening.js` trên máy chủ PostgreSQL 17.10 với ngữ cảnh người dùng thật:

```mermaid
flowchart TD
    subgraph CallerContext["Authenticated Security Context"]
        AuthRole["SET LOCAL ROLE authenticated"]
        JWT_Tenant["request.jwt.claim.tenant_id = TENANT_A"]
        JWT_Sub["request.jwt.claim.sub = USER_A"]
    end

    subgraph SecurityEnforcement["PostgreSQL 17 Kernel & RLS Engine"]
        RLS_Policy["Restrictive Policy: (tenant_id = interior_actor_tenant())"]
        Grants["Privilege Grants Table Matrix"]
        DefinerFunc["SECURITY DEFINER (search_path='')"]
    end

    subgraph VerifiedDefenses["Verified Security Outcomes"]
        D1["Tenant B queries Tenant A -> 0 Rows Returned"]
        D2["Tenant B inserts into Tenant A -> 44000 RLS Violation"]
        D3["Tenant B updates Tenant A -> 0 Rows Affected"]
        D4["Tenant A direct DELETE -> 42501 Permission Denied"]
        D5["Tenant A direct Aliases/Merge INSERT -> 42501 Permission Denied"]
        D6["Cross-Tenant Func Call -> Exception TENANT_FORBIDDEN"]
    end

    CallerContext --> SecurityEnforcement
    SecurityEnforcement --> VerifiedDefenses
```

1. **Kiểm thử Quyền Hạn Hẹp (Privilege Narrowing):**
   - Người dùng `authenticated` có quyền `INSERT`, `SELECT`, `UPDATE` trên `interior_customers`.
   - Quyền `DELETE` trên `interior_customers` đã bị **REVOKE** hoàn toàn khỏi vai trò `authenticated`. Khi thực thi lệnh `DELETE`, PostgreSQL trả về mã lỗi `42501` (Permission Denied).
   - Quyền `INSERT`, `UPDATE`, `DELETE` trên bảng bí danh (`interior_customer_aliases`) và bảng kiểm toán sáp nhập (`interior_customer_merge_logs`) bị **REVOKE** hoàn toàn khỏi vai trò `authenticated`. Các bảng này chỉ có thể được ghi thông qua thủ tục bảo mật `interior_execute_customer_merge`.
   - Quyền truy cập bảng `interior_customer_sequences` bị **REVOKE** hoàn toàn khỏi `authenticated`. Việc sinh mã chỉ được thực hiện qua hàm `interior_generate_customer_code`.
2. **Cách ly Dữ liệu Tuyệt đối (Tenant Isolation under RLS):**
   - Người dùng `authenticated` của Tenant B thực hiện `SELECT * FROM interior_customers`: Nhận về **0 dòng** (không thể đọc dữ liệu Tenant A).
   - Người dùng `authenticated` của Tenant B cố tình `INSERT` với `tenant_id = Tenant A`: PostgreSQL chặn đứng ngay lập tức với lỗi vi phạm chính sách RLS (`44000`).
   - Người dùng `authenticated` của Tenant B cố tình `UPDATE` khách hàng của Tenant A: PostgreSQL thông báo **0 dòng bị ảnh hưởng** (0 rows affected).
3. **Phòng vệ Hàm `SECURITY DEFINER`:**
   - Cả 2 hàm `interior_generate_customer_code` và `interior_execute_customer_merge` đều được thiết lập `SET search_path=''`, loại bỏ hoàn toàn nguy cơ tấn công search_path hijacking.
   - Khi người dùng Tenant A gọi hàm sinh mã hoặc sáp nhập nhưng truyền tham số của Tenant B: Hàm kích hoạt kiểm tra an ninh và ném ngoại lệ `TENANT_FORBIDDEN: Cannot generate customer code for foreign tenant` / `TENANT_FORBIDDEN: Cannot merge customers of foreign tenant`.
   - Tham số người thực hiện (`actor_id`) trong thủ tục sáp nhập được ghi đè cưỡng bức bằng `auth.uid()` từ JWT, ngăn chặn hoàn toàn việc giả mạo danh tính kiểm toán.

---

## 4. Bảo Toàn Dữ Liệu Khách Hàng Legacy & Ngăn Chặn Duplicate Profiles

Đã bổ sung cơ chế đối soát 3 lớp trong `Customer360AggregatorService` (`src/products/bella-interior/services/crm/customer-360-aggregator.service.ts`):

1. **Lớp 1 — Ánh xạ Liên kết Dự án (Project Lineage Mapping):**
   - Khi một dự án cũ có `customerId` dạng text (ví dụ `cust-001`) được cập nhật trường `customerProfileId` trỏ tới hồ sơ CRM mới (ví dụ `uuid-c1`), aggregator lập tức đưa `cust-001` vào tập hợp đã ánh xạ (`legacyIdsMappedToProfile`).
   - Khi duyệt danh sách dự án, hệ thống **bỏ qua việc tạo hồ sơ legacy duplicate** cho `cust-001`, gom toàn bộ lịch sử dự án, hợp đồng và thanh toán vào hồ sơ CRM chính thức.
2. **Lớp 2 — Khớp nối Thông tin Định danh (Phone & Code Deduplication):**
   - Nếu dự án cũ chưa được gán `customerProfileId` nhưng có số điện thoại hoặc mã khách hàng trùng khớp với một hồ sơ CRM đã tồn tại trong tenant, aggregator tự động liên kết các dự án đó vào hồ sơ CRM tương ứng thay vì sinh ra một khách hàng thứ hai.
3. **Lớp 3 — Bảo vệ Bất biến Tài chính (Financial Invariants):**
   - Toàn bộ chỉ số tài chính (Tổng giá trị hợp đồng, Tổng đã thanh toán, Dư nợ phải thu, Dư nợ có) tiếp tục được tổng hợp động từ Hợp đồng (`interior_contracts`) và Đợt thanh toán (`interior_payment_milestones`). CRM Profile API tuyệt đối không sở hữu và không thể tự ý ghi đè các giá trị này.

---

## 5. Kết quả Kiểm định Thực tế trên PostgreSQL 17.10 Local

Thực thi kịch bản độc lập `scratch/run_c3_final_release_hardening.js` trên cổng 5434:

```text
================================================================
BELLA INTERIOR CRM — PHASE C3 FINAL RELEASE HARDENING DRILL
Database Engine: PostgreSQL 17.10 Local (Port 5434)
================================================================

Step 1: Auditing Supabase Migration Discovery paths...
[PASS] MIGRATION_DISCOVERY_CLEAN: Zero C3 rollback scripts inside supabase/migrations/ (Found: 0)
[PASS] ROLLBACK_RELOCATION_VERIFIED: Rollback script safely stored in dedicated folder: supabase/rollback/20261119090001_interior_crm_customer_persistence_rollback.sql
[PASS] LAST_MIGRATION_IS_UP_PERSISTENCE: Tail of migration pipeline is C3 Up migration: 20261119090000_interior_crm_customer_persistence.sql

Step 2: Starting local PostgreSQL 17 server...
PostgreSQL 17 is online.
Database 'bella_crm_c3_hardening_drill' initialized.

Step 3: Bootstrapping Supabase environment (roles, schemas, baseline)...
[PASS] BASELINE_BOOTSTRAP: Tenants, auth.users, and baseline interior_projects ready

Step 4: Executing C3 Up migration SQL...
[PASS] C3_UP_MIGRATION_APPLIED: Applied 20261119090000_interior_crm_customer_persistence.sql cleanly

Step 5: Testing RLS & Tenant Isolation as AUTHENTICATED role...
[PASS] RLS_TENANT_A_INSERT: Tenant A successfully created Customer, Contact, and Address under authenticated role
[PASS] RLS_AUTHENTICATED_DELETE_REVOKED: Direct DELETE on interior_customers is strictly revoked from authenticated role (42501)
[PASS] RLS_AUTHENTICATED_ALIAS_INSERT_REVOKED: Direct INSERT into interior_customer_aliases is revoked from authenticated role (42501)
[PASS] RLS_TENANT_B_SELECT_ZERO_ROWS: Tenant B queries interior_customers and receives 0 rows of Tenant A data
[PASS] RLS_CROSS_TENANT_INSERT_BLOCKED: Tenant B blocked from inserting record into Tenant A by Restrictive RLS policy
[PASS] RLS_CROSS_TENANT_UPDATE_ZERO_ROWS: Tenant B UPDATE on Tenant A record affects 0 rows

Step 6: Auditing SECURITY DEFINER function tenant boundaries...
[PASS] SECURITY_DEFINER_CODE_GEN_FOREIGN_BLOCKED: interior_generate_customer_code rejects foreign tenant code request with TENANT_FORBIDDEN
[PASS] SECURITY_DEFINER_CODE_GEN_OWN_TENANT: Generated code for own tenant: KH-000001
[PASS] SECURITY_DEFINER_MERGE_FOREIGN_BLOCKED: interior_execute_customer_merge rejects foreign tenant execution with TENANT_FORBIDDEN

Step 7: Verifying Legacy Project Linking & Multi-Project Lineage...
[PASS] MULTI_PROJECT_LINEAGE: 1 CRM Customer successfully linked to 2 distinct projects (2 projects found)

Step 8: Testing clean Rollback DDL execution from dedicated folder...
[PASS] ROLLBACK_EXECUTION_CLEAN: All CRM tables/views cleanly dropped, customer_profile_id removed from interior_projects, 3 legacy projects fully intact

PostgreSQL 17 local server stopped cleanly.

================================================================
HARDENING DRILL SUMMARY
================================================================
Total Checks: 16 | Passed: 16 | Failed: 0
Verdict: ALL PASS — C3 FINAL HARDENING VERIFIED
================================================================
```

---

## 6. Trạng thái Toàn Vẹn Mã Nguồn & Bộ Kiểm Thử Hệ Thống

1. **Bộ Kiểm thử Jest:**
   - **63/63 test suites passed** (100%).
   - **712/712 tests passed** (100%).
   - Thời gian thực thi: 13,5 giây.
2. **Trình biên dịch TypeScript:**
   - Lệnh `npx tsc --noEmit` hoàn tất với **0 lỗi**.
3. **Trạng thái Git:**
   - Nhánh: `main`.
   - Toàn bộ thay đổi được lưu trữ nguyên vẹn trên working tree, sẵn sàng cho việc đóng gói phát hành khi có chỉ thị commit.

---

## 7. Ranh giới Vận hành & Định hướng Tiếp theo

1. **Cơ sở dữ liệu Production `lvnvkpyxtuilhrabtlwv`:** Tiếp tục duy trì nghiêm ngặt chế độ **CHỈ ĐỌC (STRICTLY READ-ONLY)**. Tuyệt đối không chạy DDL/DML trên Production.
2. **Phase C3 Production Migration:** Tiếp tục duy trì trạng thái **CHƯA CẤP QUYỀN (UNAUTHORIZED)** cho đến khi có chỉ thị phê duyệt riêng.
3. **Định hướng Nghiệm thu Toàn hệ thống (Real-job E2E):**
   - Đã đóng gói và củng cố vững chắc nền tảng CRM.
   - Sẵn sàng chuyển trọng tâm sang kiểm chứng toàn diện luồng nghiệp vụ trên job thật: **Khách hàng → Báo giá → Hợp đồng → Thiết kế → Sản xuất → Thi công → Bàn giao → Bảo hành**, phục vụ mục tiêu Go-live thực tế của Bella Interior.
