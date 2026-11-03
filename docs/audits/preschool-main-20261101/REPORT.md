# Preschool main — F05/F06 source và live catalog

Ngày: 01-11-2026, Asia/Saigon. **Đã lấy bằng chứng catalog trực tiếp; F05/F06 còn gap quyền nghiệp vụ/DB boundary. Real JWT allowed/denied, Browser E2E và nghiệp vụ Production vẫn NOT_PROVEN.**

## Source và target

- Worktree audit riêng, HEAD detached tại `f1299e3138f3700062a1ed84271db315737b0071`; sạch trước khi tạo các artifact audit này.
- `git ls-remote origin refs/heads/main` trong lượt này trả đúng SHA trên. Không fetch, checkout, reset hoặc sửa source.
- Target do owner chỉ định: `lvnvkpyxtuilhrabtlwv`, Dashboard hiển thị `bellaspahcm's Project`, branch `main / PRODUCTION`, Primary Database `Southeast Asia (Singapore) / ap-southeast-1`.
- Thực thi qua Supabase SQL Editor bằng executor `postgres`. Ba kết quả đều xác nhận `transactionReadOnly = on`; catalog chính ghi PostgreSQL 17.6; mỗi script kết thúc bằng `ROLLBACK`.
- Capture chính: `2026-11-01T00:33:01.726914+00:00`; bổ sung: `2026-11-01T00:38:11.553568+00:00`; Announcement: `2026-11-01T00:43:29.967814+00:00`.
- Chỉ đọc catalog, policy, ACL, constraint và định nghĩa hàm. Không SELECT dữ liệu nghiệp vụ; không gọi business RPC; không chạy migration, DDL hoặc business DML.

## Kết quả xác minh

| Hạng mục | Bằng chứng hiện hành | Kết luận có giới hạn |
| --- | --- | --- |
| Auth/Party | Có `party_auth_links`, `party_identity_link_managers`, `party_resolve_current_auth_link()` và helper xác minh Auth/profile/tenant hiện hành; caller resolver được grant cho `authenticated`. | Foundation có thật trong DB. Liên kết identity không tự cấp quyền Product. Không đọc link của người dùng và chưa thử JWT thật. |
| Quyền tổ chức | `user_org_unit_access` là view với `security_invoker=true`, derived từ People/Org, có recursive descendants; có self-scoped Platform RPC và trusted actor RPC. | Đây là projection canonical của Platform, không phải bảng cấp quyền Product độc lập. Chưa chứng minh branch access của một actor cụ thể. |
| Assignment canonical | `teacher_assignments.canonical_course_id` FK validated tới `edu_courses(id)`; confirmation FK tới `preschool_teacher_branch_confirmations`; có ngày hiệu lực, restrictive canonical-private RLS và integrity triggers đang enable. | Có producer assignment course/branch để tái sử dụng qua public contract. Legacy `course_id` vẫn FK tới `courses(course_id)`; không thay thế hai namespace cho nhau. |
| Teacher self-scope Attendance | Cả `public.preschool_teacher_attendance_courses(date,uuid)` và `public.preschool_teacher_can_attend_course(uuid,uuid,date,uuid)` đều không tồn tại theo `to_regprocedure` và danh sách `pg_proc`. | Source/DB dependency mismatch đã CONFIRMED. Source adapter gọi listing RPC; SQL integration phụ thuộc helper thứ hai. Lỗi unavailable khi đi đường teacher là DEDUCED, chưa chạy request thực tế. Không tự áp migration local/E2E lên Production. |
| Vocabulary role | Constraint validated `users_role_check` chỉ chấp nhận `admin`, `ktv_lead`, `ktv`, `admin_staff`, `accountant`, `hr`, `student`, `parent`. | `principal`, `teacher`, `super_admin`, `owner` trong matrix đề xuất không phải literal role được constraint này chấp nhận. Không tự thêm role hoặc map alias. |
| Curriculum/Menu ACL | Bốn bảng `edu_curriculums`, `edu_lesson_plans`, `edu_weekly_menus`, `edu_weekly_menu_days` có RLS nhưng `anon`/`authenticated` không có table SELECT/INSERT/UPDATE/DELETE hoặc quyền cột tương ứng; `service_role` có CRUD. Không có user-defined trigger trên bốn bảng này. | Không kết luận caller có thể bypass trực tiếp qua REST chỉ từ policy tenant rộng. Đường API dùng service-role trong source vẫn thiếu assignment/action boundary của F05; không mở grants để che lỗi. |
| Learning DB boundary | `edu_dev_observations`, `edu_dev_observation_students`, `edu_dev_milestone_progress`: `anon` và `authenticated` có CRUD grants; mỗi bảng có một permissive policy ALL chỉ kiểm tra `tenant_id = auth.jwt()->>'tenant_id'`; không có user-defined trigger. | Catalog xác nhận policy không kiểm tra live profile/role, branch, assignment hoặc resource. Đây là gap F05. Grant cho `anon` không tự chứng minh anonymous access: còn phụ thuộc JWT claim, RLS và đường API; không thử token hoặc đọc dữ liệu trẻ. |
| Resource binding | Curriculum master và weekly menu không có cột branch/course; lesson plan có `course_id` nullable và `subject_domain` là varchar. | Chưa đủ mapping để áp cùng một assignment policy cho cả ba miền. Chưa xác định subject-assignment contract có thẩm quyền; không suy quyền từ tên môn hoặc `branch_id` nullable. |
| Approve/publish | Source `curriculum.service.ts:288` tự gán actor thành `approved_by` khi status APPROVED; `weekly-menu.service.ts:317` làm tương tự cho PUBLISHED. Chưa có action matrix có thẩm quyền trong các contract đã đối chiếu; không đọc tenant permission payload. | Giữ finding tách quyền author/approve/publish. Không dùng matrix đề xuất làm cấu hình Production hoặc tự chọn semantics thay owner. |
| F06 Announcement final boundary | `authenticated` có SELECT/INSERT; policy ALL chỉ xét canonical tenant/service-role. Publish RPC là SECURITY INVOKER, gọi tenant helper rồi validate content và insert; không có admin/Product/all-active-branch predicates. Không có user-defined trigger trên `edu_announcements`. RPC còn effective EXECUTE từ PUBLIC. | F06 được xác nhận bằng catalog đang chạy, không chỉ migration source. `get_auth_tenant_id()` vẫn kiểm tra active user/tenant; EXECUTE cho anon không tự chứng minh anon đọc/ghi được vì table ACL/RLS còn chặn. Chưa thử actual caller hoặc thực hiện publish. |
| F06 Idempotency | Publish RPC trả row cũ với duplicate=true khi request ID tồn tại, không so lại title/body; nhánh select-then-insert không có conflict recovery trong function body; unique constraint tenant/request ID có thật và validated. | Mismatch với contract owner yêu cầu changed-payload conflict và same-payload retry recovery vẫn hiện hữu trong định nghĩa deployed. Không chạy race/write để chứng minh runtime. Candidate local chưa được áp dụng. |

## Thay đổi tối thiểu có thể thiết kế từ bằng chứng này

1. Tái sử dụng Platform caller profile, Party self-resolve, tổ chức và Education canonical teacher contract hiện có; không tạo IAM/assignment subsystem song song.
2. Giữ nguyên ACL đang chặn direct access vào Curriculum/Menu. Khi action/resource semantics được chốt, enforce trong Product command/API và final DB boundary; kiểm tra riêng approve/publish, không suy ra từ create/update.
3. Chốt action mapping theo vocabulary role thực và phạm vi resource: Curriculum/Menu toàn tenant hiện tại khác lesson plan gắn course. Thêm branch/subject binding khi chưa có quyết định sẽ thay đổi hợp đồng dữ liệu/nghiệp vụ, nên giữ dependent implementation held.
4. Xử lý dependency Attendance thiếu ở một release scope riêng có parity và authority tương ứng; file source ghi local/E2E-only không phải giấy phép apply Production.
5. Sau minimal fix có thẩm quyền: real Auth fixtures trên target an toàn, allowed và same-session cross-tenant/branch/course/resource denial, direct REST/RPC denial, read-back, rollback và race theo luồng. Không ghi dữ liệu Production để hoàn thành audit metadata này.

## Bằng chứng và trạng thái

- [live-catalog.csv](live-catalog.csv): export nguyên bản từ SQL Editor; [live-catalog.json](live-catalog.json): ô JSON được trích từ CSV, không sửa nội dung.
- [live-catalog-supplement.csv](live-catalog-supplement.csv) và [live-catalog-supplement.json](live-catalog-supplement.json): kiểm tra trigger, quyền cột, view options và exact function signatures.
- [live-announcement-catalog.csv](live-announcement-catalog.csv), [live-announcement-catalog.json](live-announcement-catalog.json), [announcement-catalog-readonly.sql](announcement-catalog-readonly.sql): F06 với contract đã duyệt, chỉ đọc metadata.
- [catalog-readonly.sql](catalog-readonly.sql): bản truy vấn chính đã chuẩn bị, tương đương câu thực thi; SQL Editor dùng bản rút gọn whitespace/comments. [catalog-supplement-readonly.sql](catalog-supplement-readonly.sql): câu bổ sung đã thực thi.
- [capture-manifest.json](capture-manifest.json): target, source SHA, thời gian capture và SHA-256 các artifact.
- Source quan trọng: `src/platform/party/auth-link.contract.ts`; `src/platform/education/contracts/teacher-assignment.contract.ts`; `src/platform/education/contracts/preschool-teacher.contract.impl.ts`; `src/products/bella-education/services/preschool-teacher-attendance.service.ts`; `docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md:90–92`.
- Không sửa application/UI/API, schema, RLS, grants hoặc dữ liệu. Không commit/push/deploy. WIP remediation ở checkout `D:/Antigravity/Projects/BELLA SPA ERP` được bảo toàn.
- Không chạy lại tests/build vì lượt này chỉ thu thập metadata và ghi evidence. Kết quả 8 suites/41 tests trước đó thuộc WIP ở checkout cũ, không chứng nhận clean main hoặc DB này.
- Full AX/DOM snapshot đã timeout hai lần khi render ô JSON 151 KB. Sau đó đọc đúng grid cell hiển thị và xuất CSV. Download event waiter timeout, nhưng file thực tế đã tải xong; raw file, JSON parse và đối chiếu CSV được kiểm chứng. Các timeout này không phải SQL PASS hoặc SQL FAIL, và không được dùng làm bằng chứng runtime nghiệp vụ.
- **PASS:** đúng target và thu thập catalog chỉ đọc. **CONFIRMED GAP:** source/DB thiếu teacher self-scope; Learning policy thiếu role/assignment predicates; F05 privileged API boundary còn thiếu; F06 thiếu final role/branch checks và idempotency không đúng contract.
- **NOT_PROVEN:** actor/assignment rows hiện hành, real JWT allow/deny, API/browser runtime, atomicity/retry/race, Go-Live. Catalog read bằng `postgres` không thay thế bằng chứng thực thi quyền của caller.

Đây là bổ sung F05/F06 trên main, không thay kết luận hoặc các lỗi chưa giải quyết của audit 31-10. F09 vẫn phụ thuộc action boundary và quyết định semantics lưu thực đơn; F13 không đổi.
