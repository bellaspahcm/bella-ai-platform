---
title: Cập nhật riêng học sinh sau khi điểm danh
type: bugfix
created: 2026-10-19
status: done
baseline_commit: 40d14455e
context:
  - docs/governance/BELLA_AI_CODING_CONSTITUTION.md
  - docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md
---

<frozen-after-approval reason="human-owned intent">

## Intent

**Problem:** Bấm Có Mặt/Vắng/Có Phép thành công đang gọi refreshRoster, xóa state rồi GET cả lớp, kèm danh sách người được ủy quyền và bàn giao. Người dùng phải chờ tải lại dữ liệu đã có cho mỗi học sinh.

**Approach:** Dùng attendance do POST hiện tại trả về để cập nhật riêng dòng có enrollmentId tương ứng. Giữ danh sách trong state của trang; summary và bộ lọc phản ánh state đã xác nhận. Giải thích rõ hiện trạng cache và giới hạn tuổi thọ của state.

## Boundaries & Constraints

**Always:** Backend vẫn là nguồn chuẩn. Chỉ cập nhật sau khi POST thành công và response hợp lệ, khớp enrollmentId/ngày thao tác; không tự suy ra thành công từ status đã gửi. Bảo toàn dữ liệu học sinh khác, guardians và safePickupHandover. Giữ nguyên chống stale response, context lớp/ngày, duplicate command và quyền truy cập.

**Ask First:** Thay đổi nghiệp vụ, API/public contract, auth/RLS, DB, frozen kernel hoặc cache chia sẻ giữa tenant/session.

**Never:** Đổi dữ liệu thật để thử; thêm localStorage chứa thông tin trẻ; sửa Kernel; mở rộng sang bàn giao hoặc cache toàn ứng dụng; commit/push/PR khi chưa được yêu cầu.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Lưu thành công | Danh sách đã tải; POST trả attendance hợp lệ | Cập nhật đúng một dòng, summary/bộ lọc; không GET lại cả lớp | Hiện thành công |
| Lưu thất bại | POST lỗi HTTP hoặc success=false | Giữ nguyên tất cả dữ liệu đã tải | Hiện lỗi, cho thử lại |
| Response không hợp lệ | Thiếu attendance, sai enrollmentId/ngày hoặc status | Không ghi dữ liệu chưa xác nhận vào state | Báo chưa xác nhận kết quả; không hiện thành công giả |
| Lưu lặp lại | Dòng có trạng thái cũ, POST trả trạng thái mới | Bộ đếm tăng/giảm đúng, không tăng trùng | Giữ command guard |
| Context không còn đúng | Unmount hoặc request/context đã thay đổi | Không cập nhật lớp/ngày mới bằng response cũ | Bỏ qua stale response |
| Đổi lớp/ngày | Context hợp lệ khác | Tải dữ liệu đúng context qua GET hiện tại | Không tái sử dụng dữ liệu sai context |

</frozen-after-approval>

## Code Map

- `src/app/dashboard/education/attendance/page.tsx`: refreshRoster xóa roster; markAttendance gọi refreshRoster sau POST; attendanceSummary và filters đọc currentRoster.
- `src/app/dashboard/education/attendance/__tests__/page.test.tsx`: component tests hiện có cho lớp/ngày và request races.
- `src/app/api/education/attendance/route.ts`: chỉ đọc; POST trả `{ success: true, attendance }`; GET enrich cả roster bằng guardians và handovers.
- `src/products/bella-education/services/attendance.service.ts`: chỉ đọc; setDailyAttendance chuyển tiếp public contract.
- `src/platform/education/contracts/attendance.contract.ts`: chỉ đọc; EducationDailyAttendanceStateDTO có id, tenantId, enrollmentId, schoolDay, status và timestamps.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/dashboard/education/attendance/page.tsx` — thay refresh toàn lớp sau điểm danh bằng merge response đã xác nhận vào đúng dòng; giữ context guard và failure path.
- [x] `src/app/dashboard/education/attendance/__tests__/page.test.tsx` — kiểm tra request count, hai học sinh, summary/filter, lỗi, response sai và chống stale context; cập nhật kỳ vọng refetch cũ nếu có.
- [x] Spec này — ghi bằng chứng checks, cache hiện tại và giới hạn xác minh.

**Acceptance Criteria:**
- Given danh sách đã tải, when điểm danh một học sinh thành công, then chỉ có POST cho thao tác đó, không có GET roster/courses/guardians phát sinh từ thao tác.
- Given học sinh khác đang hiển thị, when lưu một dòng, then danh sách không biến mất hoặc chuyển sang loading toàn bảng; thông tin học sinh khác giữ nguyên.
- Given POST thất bại, when request hoàn tất, then dữ liệu cũ vẫn hiển thị và không báo thành công.
- Given component đã đổi context hoặc unmount, when response cũ đến, then dữ liệu hiện hành không bị ghi đè.

## Spec Change Log

## Design Notes

Change Map: EXISTING_CAPABILITY_REUSE; stale consumer làm thừa readback. Owner dữ liệu là Education Attendance qua Product service/public contract; UI chỉ sở hữu state hiển thị. Thẩm quyền sửa giới hạn ở page và tests. Không cần migration hoặc contract extension. Đây là tối ưu tính năng hiện có, không phải Product UI redesign.

Business Test Contract: attendance đã được server xác nhận mới được hiển thị là đã lưu; canonical source là public DTO và invariant tenant/context trong constitutions. Test transport chứng minh hành vi UI, không chứng minh DB/RLS. Kết quả API là nguồn dùng để merge, không phải body request.

Cache baseline: courses và roster fetch dùng no-store. React state giữ dữ liệu trong lần mount, nhưng refreshRoster chủ động xóa nó; chưa có cache tái sử dụng giữa lớp/ngày hoặc sau reload. Phạm vi sửa giữ state sau mutation; đổi lớp/ngày tiếp tục đọc server để tránh stale dữ liệu và mở rộng phạm vi cache.

## Verification

- Chạy focused component suite bằng Jest config hiện có, gồm regression races trước đó.
- Chạy ESLint cho hai file thay đổi và typecheck phù hợp cấu hình repo.
- Chạy `npm run education:architecture:ci` và `npm run healthcare:verify` theo Education constitution; báo kết quả thực tế và mọi gate chưa chứng minh.
- `git diff --check`; kiểm tra diff chỉ gồm page, tests và spec.
- Nếu có browser authenticated sẵn, xác minh Network sau click chỉ POST, danh sách không bị xóa. Thiếu môi trường thì ghi browser/Real DB/RLS là NOT_PROVEN.

## Executed Evidence

- Focused component Jest: 21/21 tests PASS, 1/1 suite; log và JSON tại `.cache/attendance-row-update/`.
- ESLint cho page và test: exit 0; chỉ có cảnh báo cấu hình `.eslintignore` hiện hữu.
- TypeScript với `docs/audits/preschool-attendance-context/tsconfig.ui-tests.json`: exit 0, không diagnostics.
- `npm run education:architecture:ci`: exit 0, ALLOW; baseline DB-access 222/222, internal imports 0, cross-vertical 0.
- Browser Chromium với component thật và HTTP synthetic, viewport 1440/390: mỗi lần điểm danh 1 POST, 0 GET phát sinh; dòng học sinh khác giữ nguyên DOM, không page errors. Kết quả tại `.cache/attendance-row-update/browser-results.json`.
- `npm run healthcare:verify`: guard, architecture, conformance PASS; regression tổng FAIL với 18 suites failed, 39 passed, 4 skipped; 151 tests failed, 374 passed, 5 skipped. Integration báo `fetch failed` khi tạo fixtures DB và lỗi cleanup tiếp theo. Không thay đổi Healthcare/DB/Auth để chữa môi trường. Full regression gate chưa PASS.
- Browser synthetic không chứng minh đăng nhập thật, DB persistence, RLS hoặc Go-Live: NOT_PROVEN. Không có thao tác production.

## Review Closure

Ba review độc lập (blind hunter, edge-case hunter, acceptance auditor) hoàn tất, không có finding cần sửa trong phạm vi patch. Healthcare failure chưa được đối chiếu bằng chạy lại baseline; không gán toàn bộ failure cho môi trường như một kết luận đã chứng minh. Không có diff backend, contracts, Product service hoặc Kernel. `git diff --check`: PASS.

Kết quả: triển khai UI và xác minh cục bộ hoàn tất; full regression chưa PASS, authenticated DB/RLS/Go-Live NOT_PROVEN. Sau khi nhận báo cáo xác minh, người dùng đã yêu cầu "commit push", mở rộng quyền giao hàng thành commit/push branch hiện tại; chưa yêu cầu tạo PR. Sprint sync bỏ qua vì không có story_key.

## Suggested Review Order

**Kết quả server và cập nhật dòng**

- Xác thực identity, ngày và trạng thái trước khi dùng response.
  [page.tsx:54](../src/app/dashboard/education/attendance/page.tsx#L54)
- Giữ context guard, merge riêng attendance và bỏ GET toàn lớp.
  [page.tsx:339](../src/app/dashboard/education/attendance/page.tsx#L339)

**Bằng chứng hồi quy UI**

- Hai học sinh, bộ đếm, bộ lọc và dữ liệu bàn giao giữ nguyên.
  [page.test.tsx:233](../src/app/dashboard/education/attendance/__tests__/page.test.tsx#L233)
- Response sai và lỗi mạng không làm mất dữ liệu đang hiển thị.
  [page.test.tsx:274](../src/app/dashboard/education/attendance/__tests__/page.test.tsx#L274)
