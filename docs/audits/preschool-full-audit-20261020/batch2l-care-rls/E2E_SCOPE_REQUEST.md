# Phạm vi thực thi E2E — Care prerequisite và RLS

**Trạng thái: APPROVED — owner đã chọn “Duyệt 6 relation E2E; giữ sửa đổi nếu PASS” ngày21-10-2026. Chưa thực thi tại thời điểm ghi quyết định.** Quyết định cấp đúng scope dưới đây, không phải production hay quyền thay business semantics.

Target duy nhất: Supabase E2E `bmnbqbcdbuklhopfbopv`. Production `lvnvkpyxtuilhrabtlwv` bị executor từ chối. SQL candidate: [E2E_PREPARE.sql](E2E_PREPARE.sql), SHA256 `612277fd1d8aa49bd868e07652b10d89fce79fb5e6d567f1de9f18e70feac37e`. Baseline source `4a7a855e3472dcfd86649b18f27671ccbe7188a1`; runtime Product không đổi so với merge407.

## Sáu relation được đề nghị

| Relation | Trước theo preflight | Thay đổi đề nghị trên E2E |
|---|---|---|
| `edu_courses` | Có RLS; authenticated không có SELECT; policy dùng GUC | SELECT cho authenticated với allow+restrictive guard: active admin Preschool, đúng tenant/course/branch theo projection |
| `edu_enrollments` | Có RLS; authenticated không có SELECT; policy dùng GUC | SELECT cho active enrollment thuộc course/branch được cấp; enrolledAt không sau ngày nghiệp vụ |
| `party_parties` | Có RLS; authenticated không có SELECT | SELECT chỉ student Party có eligible enrollment ở trên |
| `edu_attendance_daily_state` | Chưa tồn tại | Tạo đúng table/index/FK từ migration nguồn; chỉ SELECT cho eligible enrollment cùng ngày hiện tại |
| `edu_daily_care_sessions` | Chưa tồn tại | Tạo đúng schema nguồn; SELECT/INSERT chỉ cùng tenant/course/branch và ngày hiện tại |
| `edu_daily_care_records` | Chưa tồn tại | Tạo schema nguồn với cả legacy FK và canonical Party; SELECT và column INSERT/UPDATE nonhealth cho active student trong đúng session/course |

Không cấp anon, DELETE/TRUNCATE, đổi identity qua UPDATE hay ghi `health_checks`. Không chạy parent-digest/attendance/enrollment RPC, backfill, migration history hoặc thay `students`; unique index legacy `student_id` đã xác minh tồn tại. Không đổi helper, memberships, schema/default ACL, Kernel code hay business semantics.

Đây là candidate **E2E-only**: ba bảng shared trước đó không cấp đọc authenticated. Không áp dụng cùng guard này lên production vì có thể ảnh hưởng consumer khác; cần riêng proposal/provenance/approval production.

## Trình tự và điều kiện

1. Assert target/principal/source/SQL hash; đọc lại baseline ACL/policies/dependencies. Drift thì abort.
2. Rehearsal trong transaction, kiểm tra effective privileges/schema, ROLLBACK, xác minh baseline fingerprint khôi phục.
3. Nếu rehearsal PASS, commit cùng SQL để HTTP/PostgREST thấy schema; reload schema cache. Không tự đánh dấu historical migration đã áp dụng.
4. Fixture tổng hợp hai tenant/branch, real Auth provider, actual Next API và PostgREST bằng public key/session. Maintenance chỉ setup/readback/cleanup.
5. Positive Care roster/write/readback; active+pending hoặc foreign mixed bulk deny với zero delta; role/tenant/branch/inactive/health và identity-column deny. Thuốc410, teacher/health/history/Portal/broadcast giữ các hold đã duyệt.
6. Dọn đúng UUID fixture, xóa Auth/profile/quyền hoạt động; giữ audit history và tenant shell terminated nếu append-only bắt buộc. Không lưu secrets/business-row contents.

## Recovery và giữ bản sửa

- Khi có FAIL/drift/unaccounted grant/data: dừng, thu hồi fixture authority. Recovery chỉ xóa named candidate policies trên ba bảng cũ, reverse đúng ba SELECT mới và khôi phục fingerprint đã capture. Không sửa concurrent changes.
- Ba bảng mới chỉ được DROP theo thứ tự FK, **không CASCADE**, khi fingerprint đúng và không còn row/dependency ngoài dự kiến. Có dữ liệu lạ thì giữ và báo FAIL; không xóa để làm baseline đẹp.
- Owner có thể chọn **giữ bản sửa E2E nếu tất cả functional/denial/cleanup gates PASS**; header literal-private local đã biết vẫn phải báo riêng NOT_PROVEN. Nếu chỉ cấp rehearsal thì luôn khôi phục baseline sau proof. Production không nằm trong cả hai lựa chọn.

## Vì sao cần owning scope riêng

[AUTHORIZATION_CONTRACT.md, mục7](../../../products/bella-preschool/AUTHORIZATION_CONTRACT.md) ghi: “Viết tài liệu không tự tạo những capability đó hoặc mở authority sửa Platform/Kernel/schema.” [Constitution, Protection Changes Require Independent Authority](../../../governance/BELLA_AI_CODING_CONSTITUTION.md#protection-changes-require-independent-authority) yêu cầu quyền độc lập khi thay security policy. Matrix Product trước đây không cấp quyền sửa ACL/policy shared; hai batch trước cũng chủ động giữ chúng nguyên trạng. Vì vậy gói này cần một quyết định target/scope cụ thể, không phải duyệt lại nghiệp vụ hay audit từ đầu.

Hardening sau static review: postconditions kiểm tra cả effective service privileges (kể cả PUBLIC/membership/column/MAINTAIN), không chỉ direct ACL. Không thêm grant hay relation.
