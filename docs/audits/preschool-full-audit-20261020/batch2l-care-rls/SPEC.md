---
title: 'Care: prerequisite và RLS với phiên Auth thật trên E2E'
type: bugfix
created: '2026-10-21'
status: blocked
blocked_reason: 'Care Auth GET503 and cleanup blocked by Timeline FK/rule outside approved six relations; separate owner decision pending'
baseline_commit: 4a7a855e3472dcfd86649b18f27671ccbe7188a1
context: []
---

<frozen-after-approval reason="Owner duyệt đúng6 relation E2E, giữ sửa đổi nếu PASS ngày21-10-2026; matrix Product giữ nguyên.">

## Intent

**Problem:** Care positive/mixed-student chưa chạy được vì E2E thiếu3 relation và ACL/RLS dependency chưa nhận context Auth thật. Không thể dùng service role, claims tự tạo hoặc unit mock để chứng minh chức năng.

**Approach:** Chuẩn bị một gói E2E đúng6 relation, theo schema hiện có và matrix đã duyệt; rehearsal/recovery và real Auth trên fixture riêng sau khi owning scope được cấp. Giữ nguyên toàn bộ bằng chứng batch2k.

## Boundaries & Constraints

**Always:** Chỉ target E2E `bmnbqbcdbuklhopfbopv`. Matrix authority: `docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md`. Auth/user/tenant/Party/org thuộc Platform; Course/Enrollment/attendance thuộc Education; Care thuộc Product. SQL thử nghiệm phải có manifest, preflight, thời hạn lock/statement, postconditions, recovery và readback độc lập. Tạo đúng bảng/index/FK đã có migration nguồn; không dữ liệu production.

**Ask First:** Mở rộng ngoài6 relation E2E hoặc production. Owner đã cấp owning scope6 relation và giữ sửa đổi nếu functional/denial/cleanup gates PASS. Không hỏi lại matrix/business semantics đã duyệt.

**Never:** Production DDL/DML/deploy/merge; toàn migration history; backfill/delete legacy; thay helper/schema/default ACL/role membership; thay Kernel/contract; SECURITY DEFINER reader để vượt RLS; mint JWT/claims; service-role runtime fallback; enable teacher/health/Portal/broadcast/medication.

## I/O & Edge-Case Matrix

| State | Expected result |
|---|---|
| Admin active, tenant Preschool active, branch/course được cấp, active enrollment hiện tại | Care roster đúng resource; nonhealth write và DB readback |
| Forbidden role/tenant, inactive branch/profile/tenant, pending/foreign student | Deny; mixed bulk không tạo session/record |
| Direct PostgREST cùng/khác tenant hoặc health/identity-column write | Positive control hợp lệ; deny đúng scope/column |
| Thiếu dependency/schema/grant hay drift | Abort, không tự nới scope hoặc dùng privileged fallback |
| Teacher/history/health/Portal/broadcast chưa đủ producer; medication | Giữ503/410 đã duyệt |

</frozen-after-approval>

## Code Map / Change Map

- Product manifest không đổi; public Enrollment contract và live `get_auth_tenant_id()` được reuse. Không thêm capability.
- Sáu relation: `edu_courses`, `edu_enrollments`, `party_parties` (existing shared read); `edu_attendance_daily_state` (create + read); `edu_daily_care_sessions`, `edu_daily_care_records` (create + scoped operation).
- `E2E_PREPARE.sql`: candidate E2E-only, read3 dependency và attendance; session SELECT/INSERT; record SELECT và column INSERT/UPDATE trừ health/identity reassignment. ACL không cấp anon, DELETE, TRUNCATE hoặc schema-wide grant. Restrictive authenticated predicates giữ old policy không mở vượt matrix.
- `scripts/verify-preschool-care-rls-e2e.cjs`: target/source guard, rehearsal, committed visibility, Auth thật, fixture/readback, cleanup, recovery riêng; không tự coi tồn tại file là owner approval.
- `preflight.json`: live catalog đã xác nhận `students.student_id` và unique index; giữ legacy FK, không chạy migration DROP/backfill.
- Migration applicability: chỉ E2E prerequisite/policies; chưa phải production migration. Shared execution đúng scope đã được owner cấp riêng.
- Architecture gate: PASS cho preparation và đúng6 relation E2E với rehearsal/recovery/verification bắt buộc. Không code Product/runtime/Kernel trong batch này.

## Tasks & Acceptance

- [x] `preflight.json` — exact E2E identity + affected relation/index/policy catalog; no business rows.
- [x] `E2E_PREPARE.sql` — bounded candidate; actual rehearsal, compensating recovery and baseline restoration proven.
- [x] `E2E_SCOPE_REQUEST.md` — owner approved exact6; no retention because acceptance failed.
- [x] `scripts/verify-preschool-care-rls-e2e.cjs` — real SDK Auth/cookie/HTTP harness implemented and exercised; successful Care acceptance remains unproven.
- [x] `FINAL_REPORT.md` — actual exit/counters, source and target, schema versus Product proof, remaining gates.
- [ ] Clear actual Care GET503 and achieve functional/denial/cleanup PASS before retaining E2E preparation.

Given wrong target/source or unapproved shared scope, when execution starts, then abort before mutation.
Given rehearsal fails, when postconditions run, then rollback and no committed preparation.
Given mixed active + unauthorized student, when POST executes, then403 and zero session/record delta.
Given real positive write, when maintenance reads back, then exact fixture values match and historical health is preserved.
Given cleanup/recovery error, when run finishes, then preserve error, revoke fixture authority and report FAIL, not full PASS.

## Verification

Syntax + scope review first. Rehearsal must prove transaction rollback and unchanged shared helpers/ACL/policies outside6. Committed execution must prove actual Auth, positive/negative controls and exact readback. Giữ bản sửa khi các functional/denial/cleanup gates PASS; known local-private header NOT_PROVEN vẫn tách riêng. Nếu FAIL, restore preexisting ACL/policies và chỉ drop newly-created empty relations theo recovery đã chốt. Full11 gates remain separate: static boundary/migration, runtime tenant/RLS and cleanup exercised; event/academic/governance gates not changed; full Platform regression NOT_PROVEN until applicable run succeeds.

## Spec Change Log

- Owner đã cấp chính scope6 E2E qua lựa chọn “Duyệt 6 relation E2E; giữ sửa đổi nếu PASS”; frozen intent cập nhật theo quyết định mới này. Production tiếp tục ngoài scope; không thêm relation/grant/helper tự động.
- Rehearsal + compensating recovery PASS; real Auth6 PASS, Care GET503 và cleanup4 Party FAIL. Exact6 schema/ACL/policy baseline đã khôi phục. Timeline FK/rule conflict requires separate owning scope; no expansion executed. Preserve all raw FAIL and exact executed harness snapshots. Added metadata-only LIMIT0 diagnostic, always recovery/no retention; it is not Auth proof.

## Suggested Review Order

- Đọc trạng thái thực tế và ranh giới proof trước.
  [FINAL_REPORT.md:1](FINAL_REPORT.md#L1)

- Quyết định phạm vi FK riêng; chưa có execution authority.
  [TIMELINE_E2E_SCOPE_REQUEST.md:1](TIMELINE_E2E_SCOPE_REQUEST.md#L1)

- Kiểm tra đúng sáu relation và postconditions ACL.
  [E2E_PREPARE.sql:1](E2E_PREPARE.sql#L1)

- Hash SQL và target được kiểm tra trước kết nối.
  [verify-preschool-care-rls-e2e.cjs:86](../../../../scripts/verify-preschool-care-rls-e2e.cjs#L86)

- Recovery dùng fingerprint và không DROP dữ liệu lạ.
  [verify-preschool-care-rls-e2e.cjs:544](../../../../scripts/verify-preschool-care-rls-e2e.cjs#L544)

- Đối chiếu review và các sửa đã xác minh.
  [REVIEW.md:1](REVIEW.md#L1)

