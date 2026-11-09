# BELLA INTERIOR OS — PR #522 DEPLOYMENT GOVERNANCE & BACKUP EXCEPTION
## Record of Owner Exception: `BACKUP_WAIVED_BY_OWNER` & Pre/Post Flight Verification Protocol

> **Document Status:** CANONICAL DEPLOYMENT RECORD  
> **PR Number:** #522 (`codex/bella-interior-rbac-phase6`)  
> **Commit Hash:** `fef75ea36`  
> **Target Release Environment:** Production (`lvnvkpyxtuilhrabtlwv.supabase.co`)  
> **Governance Classification:** Scoped RBAC Phase 6 Migration with Explicit Waiver  
> **Waiver Key:** `BACKUP_WAIVED_BY_OWNER`  
> **Date:** 2026-11-09

---

## 1. Executive Decision & Waiver Record

Theo chỉ đạo và quyết định chính thức từ Chủ sở hữu nền tảng (Platform Owner / Business Sponsor):
- **Quyết định:** Chấp thuận miễn trừ bước kiểm tra sao lưu cơ sở dữ liệu trước khi apply migration (`BACKUP_WAIVED_BY_OWNER`).
- **Nguyên tắc minh bạch bằng chứng:** Hệ thống **KHÔNG** giả lập trạng thái backup đã thành công trong nhật ký kiểm toán CI/CD; thay vào đó ghi nhận tường minh mã ngoại lệ `BACKUP_WAIVED_BY_OWNER` đi kèm phân tích rủi ro và các biện pháp bù đắp an toàn (Compensating Controls).

---

## 2. Phạm Vi Migration & Đánh Giá Rủi Ro

### 2.1. File Migration Mục Tiêu
- `supabase/migrations/20261109130000_bella_interior_rbac_scopes.sql` (2,471 dòng SQL).

### 2.2. Chi Tiết Các Thay Đổi (Blast Radius)
1. **Additive Schema (Không phá hủy / Non-destructive):**
   - Bổ sung cấu trúc lưu trữ phân quyền nâng cao: `interior_branches`, `interior_admin_delegations`, `interior_direct_grants`, `interior_project_assignments`, `interior_rbac_audit_logs`.
   - Bổ sung cột `branch_id` cho các bảng thực thể nghiệp vụ (`interior_projects`, `interior_contracts`, v.v.).
2. **Hardening RLS Policies (Thắt chặt an ninh, không mở rộng trái phép):**
   - Áp dụng các chính sách RLS 4 cấp độ: `TENANT`, `BRANCH`, `PROJECT`, `SELF` trên 21 bảng dữ liệu Interior.
   - Revoke toàn bộ quyền `INSERT`, `UPDATE`, `DELETE` trực tiếp từ các vai trò `anon` và `authenticated`; bắt buộc mọi thao tác ghi dữ liệu phải đi qua RPCs đã kiểm tra quyền.
3. **Refined Stored Procedures (Atomic RPCs):**
   - Khóa chặt `save_interior_boq_atomic`: Bắt buộc thiết kế đã duyệt (`APPROVED_DESIGN_REVISION_REQUIRED`) và người thực hiện có quyền `interior:boq:create` / `interior:boq:update`.
   - Khóa chặt `enqueue_interior_finance_event`: Ngăn chặn giả mạo vai trò `service_role` để ghi nhận sự kiện tài chính; chỉ cho phép authenticated actor có quyền `interior:payment:record`.

### 2.3. Rủi Ro Mất Dữ Liệu & Khả Năng Khôi Phục (Recovery Feasibility)
- **Rủi ro mất mát dữ liệu:** Cực thấp (`NEGLIGIBLE`). Không có lệnh `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` hay `DELETE` bất kỳ dữ liệu thương mại nào hiện có.
- **Khả năng khôi phục nếu thất bại:** Toàn bộ block migration được bao bọc trong Transaction; Postgres sẽ tự động ROLLBACK hoàn toàn nếu có bất kỳ câu lệnh nào thất bại (như đã được chứng minh và kiểm nghiệm thực tế trên môi trường E2E).

---

## 3. Biện Pháp Kiểm Soát An Toàn Bù Đắp (Compensating Controls)

1. **Pre-Flight Verification:**
   - Kiểm tra kết nối và trạng thái sức khỏe của Production Database: Trạng thái `ACTIVE_HEALTHY` trên Supabase cluster `ap-southeast-1`.
   - Xác nhận catalog các bảng và hàm trước migration không bị xung đột khóa ngoại.
2. **Atomic Rollback Protocol:**
   - Migration sử dụng các khối `DO $block$ BEGIN ... END` với kiểm tra điều kiện preflight (`pg_get_functiondef`, `position()`); nếu định nghĩa hàm gốc không khớp với kỳ vọng, migration chủ động `RAISE EXCEPTION` và hủy bỏ ngay lập tức, không thay đổi trạng thái dở dang.
3. **Post-Flight Verification & Health Checks:**
   - Xác minh catalog 21 bảng Interior có RLS enabled 100%.
   - Xác minh 36 RPC grants chỉ mở cho `authenticated`, thu hồi hoàn toàn khỏi `anon` và `public`.
   - Gọi hàm kiểm tra sức khỏe `platform_health_rest_database_probe` để xác nhận latency và tính khả dụng của database.
4. **Bootstrap OWNER Kiểm Soát Chặt:**
   - Bootstrap vai trò OWNER cho tài khoản Supabase Auth thật (`demo.interior@bellaspa.vn`).
   - Kiểm tra xác thực và xác minh OWNER không thể bị gán thêm quyền trái phép (Privilege Escalation Prevention).

