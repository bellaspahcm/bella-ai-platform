# ACR-2026-024 — Preschool administrator class catalog read

**Status:** OWNER-APPROVED FOR LOCAL/DISPOSABLE; IMPLEMENTED; RESEAL HELD  
**Decision owner:** Repository owner, direct reply on 2026-10-28: “Duyệt, admin được xem mọi lớp trong tenant”.  
**Scope:** Preschool only; the disposable profile `bella-preschool-95c70855`. No shared database or Production.

## Need

The Preschool administrator class-management screen needs the complete class catalog for its tenant. Direct `SELECT` on `edu_courses` remains denied to `authenticated`; the existing caller-scoped catalog query cannot provide this view. Granting table access would expose rows to every authenticated tenant user under the existing tenant-only policy. The approved behavior is that an active Preschool administrator may read every class in the administrator's own tenant.

## Exact change

- Add `listPreschoolAdminCourses` and `getPreschoolAdminCourse` to the existing Education course-catalog contract implementation, returning only canonical course identity/status fields.
- Add `public.edu_preschool_admin_course_catalog(uuid)`, a read-only RPC. It derives the caller from `auth.uid()`, verifies the live active admin and active Preschool tenant through existing Platform RPCs, accepts no caller-selected tenant or actor, and filters all rows by the derived tenant.
- Keep direct course-table SELECT denied. Grant RPC execution only to `authenticated`; reject anonymous, inactive, non-admin, and non-Preschool callers.
- Apply the migration only to `bella-preschool-95c70855`; do not apply to a shared database or Production.
- Keep class creation/opening branch authorization separate; this read capability does not grant write or branch-management authority.

## Exact implementation paths

```text
src/platform/education/contracts/canonical-course-catalog.contract.ts
src/platform/education/contracts/canonical-course-catalog.contract.impl.ts
src/platform/education/contracts/__tests__/preschool-admin-course-catalog.contract.test.ts
src/app/api/education/courses/catalog/route.ts
src/app/dashboard/education/courses/CanonicalClassroomCatalog.tsx
supabase/migrations/20261028140000_preschool_admin_course_catalog_read.sql
```

The three `src/platform/education` paths are the only Education Kernel artifacts in this scope. No global freeze manifest, guard, baseline, or unrelated Education artifact is changed.

## Evidence and limits

- Synthetic administrator JWT: RPC returned two rows, each matching the actor's tenant; direct table SELECT returned 403; anonymous RPC returned 401; no tenant argument is accepted by the RPC.
- Browser create/open receipt: login and cookie session, catalog/branch reads, create, reload/readback, class detail, and foreign-branch create denial passed.
- Teacher-management receipt on the same base SHA: confirmation and assignment returned 201; assignment readback after reload passed; foreign-branch assignment returned 403 with no persisted denial row. All source hashes in that receipt match the current worktree.
- Current focused tests: 62/62 course/teacher API, contract, and service tests; 87/87 catalog UI/create/API tests; full TypeScript check, ESLint, `git diff --check`, and Education architecture test (4/4) passed.
- A subsequent read-only browser run authenticated the synthetic administrator, verified both returned class cards by their distinct course codes, and verified both again after reload. The earlier ambiguous-title attempt remains a failed test attempt, not a PASS.
- This is bounded local evidence only. Full Education reseal, teacher login as a teacher, Production behavior, and Go-Live are not proven.

Receipts are retained outside the repository under `%LOCALAPPDATA%\Bella\Preschool\DisposableProfiles\bella-preschool-95c70855\`.

## Authority and recovery

The owner approved the local/disposable behavior and the exact frozen-path unlock in the current conversation. The candidate had already been prepared in the dirty worktree before this unlock record was written; this record does not claim that the pre-coding ACR sequence occurred. The exact unlock is recorded in the companion `batch2p-admin-course-catalog/SCOPED_UNLOCK.json`; the implementation window is closed and the broader Education reseal remains held. Production, shared-database access, commit, push, merge, and deployment are not authorized by this ACR.


## Bổ sung: mở khóa cục bộ và chốt kiểm chứng — 2026-10-28

- Chủ sản phẩm đã duyệt phạm vi: quản trị viên Preschool đang active được đọc toàn bộ danh mục lớp trong tenant đang active của chính mình. Sau đó đã duyệt mở khóa cục bộ cho đúng hai tệp contract Education và migration được liệt kê trong `SCOPED_UNLOCK_REOPEN_20261028.json`.
- Cửa sổ thực thi cục bộ đã đóng sau khi kiểm chứng. Hash cuối của ba tệp khớp hash trong unlock record. Unlock này không mở khóa chung Education Kernel, không sửa manifest/guard/baseline và không cho phép DB dùng chung, Production hay Git publication.
- Kiểm thử tập trung chạy trong lượt chốt: 86/86 test, 3 suite đạt; `education:architecture` 4/4 đạt; ESLint đạt; `git diff --check` đạt (chỉ có cảnh báo Git về chuẩn hóa LF/CRLF ở một tệp test không thuộc contract).
- Disposable `bella-preschool-95c70855`: DB container healthy, Auth health HTTP 200. Catalog RPC tồn tại; owner `postgres`, `SECURITY DEFINER`, `search_path` cố định rỗng; `authenticated` có EXECUTE, `anon` và `service_role` không có; `authenticated` không có SELECT trực tiếp trên `edu_courses`; RLS của bảng đang bật.
- Receipt trình duyệt hiện có: `multiclass-readonly-receipt.json`, SHA-256 `B2DDD11F819C7038351463D5E7425900DDFE4926016FDC8F129B44682F217200`, base SHA `bf1ac7030eb740c7c8b59e8e4c4321f53acded04`. Đăng nhập, catalog, tenant scope, hiển thị 2 lớp và hiển thị lại sau tải trang đều PASS; không có lỗi. Các hash nguồn contract implementation, route, UI và migration trong receipt khớp worktree.
- Không có row `20261028140000` trong `supabase_migrations.schema_migrations` của profile; không ghi bổ sung ledger để giả lập provenance. Trạng thái schema/runtime và receipt được ghi riêng.

**Kết luận:** `PASS_BOUNDED_LOCAL` cho khả năng quản trị viên Preschool đọc danh mục lớp trong tenant của mình trên profile disposable. `FULL_EDUCATION_RESEAL`, Production và Go-Live vẫn `HELD / NOT_PROVEN`.

## Bổ sung — danh mục chi nhánh cho Dashboard — 2026-10-28

**Trạng thái:** Chủ sản phẩm duyệt triển khai local/disposable; chưa nghiệm thu.

Kiểm tra JWT thật cho thấy truy vấn trực tiếp `users` và `org_units` bị từ chối với SQLSTATE `42501`. RPC Platform tự giới hạn theo người gọi hiện chỉ trả mã đơn vị, không có tên hiển thị. RPC `get_org_unit_hierarchy(p_root_id, p_tenant_id)` nhận tenant do caller chọn trong khi chạy `SECURITY DEFINER`, nên không dùng làm lối tắt.

Phạm vi được duyệt:

- Thêm `edu_preschool_admin_branch_catalog()` không nhận actor hoặc tenant đầu vào; xác minh admin đang active và tenant Preschool active bằng các contract Platform hiện có; trả tối thiểu `id`, `name` cho các chi nhánh active thuộc tenant của actor và phép chiếu `tenant_admin` hiện hành.
- Chỉ cấp `EXECUTE` cho `authenticated`; giữ nguyên SELECT trực tiếp trên `users` và `org_units`.
- Nối API Analytics qua contract Education hẹp. Không đổi UI, DB dùng chung hoặc Production; không commit/push.

Tệp trong phạm vi addendum:

```text
src/platform/education/contracts/preschool-admin-branch-catalog.contract.ts
src/platform/education/contracts/preschool-admin-branch-catalog.contract.impl.ts
src/platform/education/contracts/__tests__/preschool-admin-branch-catalog.contract.test.ts
src/app/api/education/analytics/route.ts
src/app/api/education/analytics/__tests__/route.test.ts
supabase/migrations/20261028150000_preschool_admin_branch_catalog_read.sql
```

Chỉ áp dụng migration lên disposable `bella-preschool-95c70855`. Quyền đọc danh mục chi nhánh không cấp quyền ghi hoặc quyền điểm danh.

### Bằng chứng chốt RPC danh mục chi nhánh — 2026-10-28

- Migration `20261028150000_preschool_admin_branch_catalog_read.sql` chỉ áp dụng trên disposable `bella-preschool-95c70855`; không thêm migration ledger giả.
- JWT tổng hợp: admin active cùng tenant nhận danh mục đúng một chi nhánh; `anon` và `service_role` bị từ chối. Đọc trực tiếp bảng bị từ chối; quyền SELECT không được mở thêm.
- Browser receipt: `admin-dashboard-analytics-receipt.json`, SHA-256 `8C2DB6C1F8FCEAD0D3D4305929A4D84050C0DA7B49A4A42DC129DBE570F804E9`; Auth HTTP 200, Analytics HTTP 200, bộ chọn chi nhánh hiển thị/được chọn, không có lỗi trang.
- Nguồn trong unlock đã đóng có SHA-256: contract `7B23496B2970BFF5F15AB31505A80C71497AD368BE2D038EFF567FD46302E2CA`; implementation `EAB91BAF5DEB76068F1F006019C07EB2F0B73F528D998921ABA1E618CD37B96C`; test `965244EB5A3086D63B7028CD6D4F11F6C517B8CBE2814304B2551CB91D0215EC`; migration `1F825C1F02F47D7909B428D77150DC1F5FEFFFF209CA0B90DCD9FB0AA445B2FA`.
- Kiểm tra tập trung: 10/10 test, Education architecture 4/4, ESLint, type-check và `git diff --check` đạt. Kết quả chỉ áp dụng cho profile local/disposable; không chứng minh Production, full reseal hoặc Go-Live.

## Bổ sung: lịch sử điểm danh trong hồ sơ trẻ — 2026-10-28

- Chủ sản phẩm chốt admin được xem lịch sử điểm danh tại chi nhánh hiện được cấp quyền, kể cả ngày trước; duyệt contract Education và migration mới chỉ cho local/disposable.
- API hồ sơ trước sửa trả 503 vì `authenticated` bị từ chối SELECT trên `edu_attendance`. Contract mới nhận đúng mã enrollment, tự xác minh actor/tenant, kiểm tra binding lớp–chi nhánh và dùng helper Registry để xác minh quyền hiện tại; không cấp SELECT bảng trực tiếp. Lịch sử từ 1.000 sự kiện trở lên vẫn trả unavailable thay vì dữ liệu thiếu.
- Migration `20261028160000` chỉ áp dụng trên disposable `bella-preschool-95c70855`; không ghi giả ledger. 8/8 kiểm tra JWT đạt: admin đọc sự kiện quá khứ; actor tenant khác, staff, anon, service role và enrollment không có quyền bị từ chối; đọc trực tiếp bảng bị từ chối; admin theo projection chi nhánh được phép. Admin bị vô hiệu hóa bị từ chối ngay ở lần gọi sau. Fixture tổng hợp đã được dọn.
- Browser đăng nhập, tìm đúng trẻ/lớp và mở hồ sơ với API 200; receipt `student-profile-history-final-receipt.json`, SHA-256 `1C4379507A76354A8184EB4AF434BABDEC39333660783A078B74950BB9DDC2E9`. 84/84 test tập trung, type-check, ESLint, Education architecture 4/4 và phân tích migration đạt.
- Unlock chính xác đã đóng trong `SCOPED_UNLOCK_STUDENT_HISTORY_20261028.json`. Kết quả là `PASS_BOUNDED_LOCAL`; chưa chứng minh reseal Education, Production hoặc Go-Live.

### Bổ sung giới hạn nguồn gốc chi nhánh

Sự kiện điểm danh không lưu chi nhánh tại thời điểm ghi. Bản local sau rà soát từ chối toàn bộ lịch sử nếu sự kiện xảy ra trước khi binding lớp hoặc enrollment được tạo, hoặc binding có `updated_at` khác `created_at`; không trả danh sách thiếu như thể đầy đủ. Fixture tổng hợp kiểm chứng 3/3: sự kiện ngày trước có binding trước đó được phép; sự kiện trước binding và binding đã đổi bị từ chối. Cách kiểm tra này phụ thuộc tính chính xác của `updated_at`; nó chưa chứng minh lịch sử thay đổi chi nhánh của dữ liệu cũ hoặc an toàn Production. Hash migration cuối và receipt mới được ghi trong unlock. API người giám hộ vẫn trả 503 trong Browser; không coi toàn bộ hồ sơ 360 đã đạt.
