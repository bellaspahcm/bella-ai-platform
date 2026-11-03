# ADR-029 — Read the Preschool tenant's class catalog as its administrator

**Status:** ACCEPTED FOR LOCAL/DISPOSABLE SCOPE; BROADER RESEAL HELD  
**Decision owner:** Repository owner; direct approval recorded on 2026-10-28.  
**Related ACR:** [ACR-2026-024](../acr/ACR-2026-024-preschool-admin-course-read.md)

## Context

The Preschool administrator needs to see all classes belonging to the active tenant. Direct `SELECT` on `edu_courses` is not an acceptable implementation because the existing tenant-level RLS policy does not distinguish administrators from other authenticated users. The feature must not grant that table access or trust a tenant/actor supplied by the browser.

## Decision

Use a narrow Education public-contract method backed by `edu_preschool_admin_course_catalog(p_course_id)`. The RPC derives the current actor from the authenticated JWT, checks active admin status and the active `bella_preschool` tenant using existing Platform caller contracts, and returns only rows whose `tenant_id` equals the actor's derived tenant. An administrator may see all classes in that same tenant, irrespective of branch; this is read access only.

The SQL function is `SECURITY DEFINER` with an empty fixed `search_path`, validates `auth.uid()` and `auth.role()`, takes no tenant or actor input, and exposes no direct table grant. Only `authenticated` receives function execution; `anon`, `PUBLIC`, and `service_role` do not. Class creation and branch assignment continue to use their separate branch authorization checks.

## Consequences

- Administrators can populate the class-management catalog from canonical `edu_courses` without a broad table grant.
- Other roles, anonymous callers, inactive administrators, other products, and foreign tenants receive no catalog data.
- This does not authorize student/teacher data access, mutations, shared-database changes, or Production deployment.
- The behavior is verified only on disposable profile `bella-preschool-95c70855`. The Education Kernel remains under its broader freeze/reseal requirements.


## Kiểm chứng giới hạn local — 2026-10-28

Quyết định được kiểm chứng trên profile disposable `bella-preschool-95c70855` theo phạm vi đã duyệt. 86/86 test tập trung, Education architecture 4/4, ESLint và `git diff --check` đạt. Catalog RPC hoạt động với ACL hẹp; bảng `edu_courses` vẫn không cấp SELECT trực tiếp cho `authenticated` và RLS vẫn bật. Receipt trình duyệt cùng SHA cơ sở cho thấy admin đăng nhập, đọc đúng hai lớp trong tenant và đọc lại được sau tải trang.

Ledger migration không có row `20261028140000`; không tự ghi ledger. Kết luận chỉ là `PASS_BOUNDED_LOCAL`; không mở rộng thành reseal Education, DB dùng chung, Production hoặc Go-Live.

## Quyết định bổ sung: danh mục chi nhánh cho dashboard — 2026-10-28

Chủ sản phẩm duyệt một RPC Education chỉ dùng local/disposable để trả mã và tên các chi nhánh active cho admin Preschool đang hoạt động. RPC tự lấy tenant từ JWT qua contract Platform, yêu cầu phép chiếu `tenant_admin`, không nhận tenant/actor do caller khai báo và không mở SELECT trực tiếp trên `org_units` hay `users`. API Analytics dùng contract này để dựng bộ chọn chi nhánh; quyền điểm danh và ghi dữ liệu vẫn qua các kiểm tra hiện có. Không đổi giao diện, DB dùng chung hoặc Production.

Kiểm chứng trên disposable `bella-preschool-95c70855`: JWT admin tổng hợp được phép đọc; `anon` và `service_role` bị từ chối; không thêm quyền SELECT trực tiếp. Browser receipt `admin-dashboard-analytics-receipt.json` (SHA-256 `8C2DB6C1F8FCEAD0D3D4305929A4D84050C0DA7B49A4A42DC129DBE570F804E9`) xác nhận Auth và Analytics HTTP 200, bộ chọn chi nhánh hiển thị/được chọn và không có lỗi trang. Trạng thái: `PASS_BOUNDED_LOCAL`; Production, full Education reseal và Go-Live chưa được chứng minh.

## Quyết định bổ sung: đọc lịch sử điểm danh của trẻ — 2026-10-28

Admin Preschool đang active được xem các sự kiện điểm danh, kể cả ngày trước, của enrollment mà Registry xác minh thuộc chi nhánh hiện được cấp quyền. Contract chỉ nhận enrollment, tự suy actor/tenant từ JWT và từ chối khi binding thiếu hoặc mơ hồ; không mở quyền đọc bảng `edu_attendance`. Scope được duyệt và kiểm chứng là local/disposable. JWT, từ chối sai quyền và Browser hồ sơ trẻ đã đạt theo receipt trong ACR; không mặc định mở quyền cho giáo viên hoặc triển khai Production.

Event không có branch ID lịch sử: bản local giữ unavailable khi event trước thời điểm tạo binding hoặc binding đã cập nhật. Phép kiểm này dựa vào `updated_at` và chưa chứng minh provenance của dữ liệu cũ hay Production; cần xác minh riêng trước phát hành.
