# Architecture Change Request — Preschool classroom writer and assignment identity

**ID:** Draft local Preschool classroom request, chưa cấp số registry.
**Date:** 2026-10-25. **Status:** APPROVED_SCOPE — human response `approve` in this chat, 2026-10-25.
**Scope:** Education public-contract boundary + Preschool Product; không Healthcare/Logistics Kernel.

## Summary / reason

User cần tạo lớp → catalog → detail → phân công → Attendance thật. Catalog/admission/attendance dùng `edu_courses`, còn generic `IEducationCourseContract.createCourse` và teacher assignment FK dùng `courses`. Public writer canonical và teacher persistence compatible chưa được chứng minh. Direct Product insert/dual-write không phải hướng được chấp thuận.

## Proposed decision 1 — canonical writer

Phê duyệt thiết kế và thay đổi additive public contract trong Education cho tạo canonical course, dùng lại `Course` aggregate + `SupabaseEducationRepository` hiện có; không tạo engine/entity/table Course thứ hai. Contract mới phải validate caller tenant, actor/action, resource/branch và idempotency trước write; publication chỉ sau commit. Input tối thiểu mã/tên và branch được cấp quyền; các field sức chứa/năm học/khối/phòng không có nghĩa nghiệp vụ được chốt thì không mặc định từ legacy.

Affected proposed artifacts: `src/platform/education/contracts/canonical-course-catalog.contract.ts`, owning contract implementation/tests, `src/app/api/education/courses/route.ts`, Product catalog create form/tests. Có thể cần một public command artifact riêng nếu owner chọn tách read/write; không được tự chọn thêm abstraction trước owner review.

Cần owner xác nhận chính xác actor matrix và branch-create lifecycle. Hiện code catalog chỉ chứng minh admin **read**, không tự cấp admin **write**. Atomic create+branch assignment/retry/failure behavior phải chốt trước implementation. Không unlock toàn bộ `src/platform/education/`.

## Proposed decision 2 — teacher relation / existing schema prerequisite

Xác nhận teacher assignment phải bind với canonical Preschool `edu_courses` qua owning Education contract; giữ tương thích legacy consumers. Migration `20260813000050_create_teacher_assignments.sql` hiện FK sang `courses(course_id)`; target E2E còn không có table (404/PGRST205). **Không apply nguyên migration cũ, retarget FK hay dual-write mặc định.**

Owner cần duyệt phương án tương thích và migration cụ thể sau khi đối chiếu FK/consumer catalog; chưa có schema diff được duyệt trong request này. Teacher lựa chọn phải từ nguồn staff/Party hợp lệ theo tenant/branch; caller tự gửi một Party UUID chưa đủ. Không suy ra năm học từ thời điểm chạy hoặc fixed 2025–2026.

Affected proposed artifacts: `teacher-assignment.contract.ts`, owning implementation and integrity tests; teacher route and actual teacher selector; additive migration/recovery plan chỉ sau owner chốt model. Không mở quyền DB để chữa HTTP permission error.

## Alternatives / impacts

- Product ghi trực tiếp `edu_courses`: loại vì bypass public contract.
- Ghi legacy `courses` rồi dual-write: loại vì chưa có identity/lifecycle contract, có thể tạo hai truth.
- Bật UI gọi legacy detail/teacher: loại vì fixture, FK/identity và authorization debt đã chứng minh.
- Giữ read/context patch hiện tại: an toàn trong scope nhưng không hoàn thành create/teacher.

Risk: **HIGH** ở identity/security/schema compatibility; không phải phê duyệt implementation từ một catalog read PASS. Direct consumers: Preschool create/detail/assignment/admission/attendance; indirect: mọi legacy `courses`/teacher consumer cần inventory đúng scope.

## Verification / rollback

Yêu cầu actual E2E Auth: permitted/denied role, cross-tenant, cross-branch, revoked actor, mismatched assignment/course/Party; create→catalog/detail reload, atomic branch mapping và idempotent retry, teacher effective dates/conflicts và read-back. No grant expansion; actual migration/ACL fingerprint before/after nếu được phê duyệt. Giữ đủ 11 Education gates và full regressions, failure không thành PASS.

Rollback: giữ read-only UI path; chỉ dừng dependent writer nếu proof thất bại; bảo toàn lịch sử và dữ liệu đã tạo; migration recovery phải được duyệt cùng migration trước apply. Không drop/backfill/retarget/cascade tùy ý. E2E synthetic fixtures phải cleanup/read-back.

## Approval / tracking

Human owner explicitly approved this ACR direction in this chat (`approve`, 2026-10-25). This authorizes the scoped additive writer/public-contract implementation and compatible teacher-model proposal. Unresolved business values are not invented. At the time this ACR was drafted, precise SQL migration/apply, grant expansion, production operations and Go-Live had not been approved. Existing read/context patch remains preserved. Scoped ADR/unlock are recorded beside this ACR; no global freeze is disabled.

## Superseding owner decision — 2026-10-25

The owner later approved the exact course migration, Platform helper, Teacher profiles, Production course-map SELECT and Production Attendance structural prerequisite recorded in `PENDING-DECISIONS.md`; those exact SQL changes were applied and verified. The owner separately approved no-op migration checkpoint `20261025104453`, now recorded on both targets. This approval does not authorize inferred enrollment mappings or browser/Go-Live claims; executable migrations for clean provisioning remain unresolved as described in `RESULT.md`.
