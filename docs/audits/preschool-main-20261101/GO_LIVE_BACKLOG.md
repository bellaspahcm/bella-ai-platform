---
title: Preschool Go-Live — gói release GL02–GL04 và GL05 held
type: bugfix
status: in-progress
current_batch: sealed-release-20261102
current_batch_status: MAIN_INTEGRATED_STAGED_READY_HEALTH_HOLD
go_live_status: NOT_READY
baseline_commit: f1299e3138f3700062a1ed84271db315737b0071
---

# Preschool Go-Live — danh sách duy nhất

Mục tiêu: UI/chức năng hiện có vận hành đúng, lưu/đọc lại đúng và đúng quyền.
Scope theo chỉ đạo Go-Live mới: Product UI/API trong contract hiện hữu; không redesign,
đổi nghiệp vụ/quyền/API contract, schema, Kernel hoặc Production. Giữ nguyên mọi WIP.
Danh sách dưới đây tái sử dụng findings và receipt hiện có, không phải audit mới hoặc
chứng nhận toàn bộ control đã được kiểm thử. Mỗi batch cập nhật ngay trong tệp này.

| ID | Ưu tiên | Luồng / control hiện có | Trạng thái và việc cần hoàn tất |
| --- | --- | --- | --- |
| GL01 | P0 | Attendance: lớp, roster, save, reload; Teacher/Admin/English Center | Teacher isolated JWT/DB 23 checks và Browser 11 checks đã PASS; V2 rehearsal 29/29 PASS. Cần application compatibility Admin/English và quyết định DB release riêng. Không xây lại V2 hoặc truy tìm calls lịch sử vô hạn. |
| GL02 | P0 | Care: chọn lớp/ngày/trẻ, lọc từ module khác, meal/nap/hygiene/note, save/reload | Child-context fix LOCAL PASS — SEALED: 3 suites/115 tests, changed-file TypeScript 0 diagnostics. API/POST, whole-class save và authorization giữ nguyên. Full Care → Parent DB/E2E vẫn NOT_PROVEN. |
| GL03 | P0 | Teacher Care → Parent Portal: save, child scope, read-back/reload | Guardian revalidation wiring LOCAL PASS: 3 suites/22 tests. Full Teacher → DB → Parent/reload BLOCKED: Teacher API còn identity containment, writer source admin-only, profile chưa đủ Portal contracts. Parent Daily 503 giữ nguyên; không tạo binding mới. |
| GL04 | P0 | Parent Portal: token, child/care/attendance/handover, bảng tin, reload | PARTIAL LOCAL_CONTRACT_PASS: sửa guardian revalidation attendance/tuition và ngăn attendance query error thành empty success; 6 suites/148 tests, focused TS 0 diagnostics. UI runtime giữ nguyên. Real DB/RLS/Browser/reload persistence NOT_PROVEN; scoped DTO chưa có handover, không tự mở capability. GL03 vẫn partial. |
| GL05 | P0 | Admission/activation + học phí | HELD_CONTRACT_GAP: 4 existing route tests +13 diagnostic characterization cases đã chạy; phơi bày ignored DB error, zero-row activation, retry không sửa payment lỗi và uncoordinated concurrent write attempts. Đây không phải remediation PASS hoặc DB duplication proof. Runtime không sửa; fee/period/transaction authority còn thiếu. |
| GL06 | P0 | Learning/Grades/Awards: lưu đánh giá, tải lại, khen thưởng | F02 HELD: observation persistence, eligibility và governed assessment cần contract hiện hành. Không tự tạo award persistence/rule. |
| GL07 | P0 | Finance: scope, thu phí, invoice/payment, đọc lại | F07 boundary/fallback chưa chứng minh tương đương cho các caller; regression theo scope/identity và canonical Finance. |
| GL08 | P0 | Curriculum/Lesson Plans: đọc/tạo/sửa/duyệt | F05 assignment/approval gap; F10 zero-row LOCAL PASS đã seal. Không tự đổi role/action matrix; kiểm chứng legitimate save/read-back sau khi quyền được xác định. |
| GL09 | P1 | Weekly Menu: tạo/sửa/lưu/phát hành, đọc theo ngày | F09 DESIGN ONLY/HELD, cần atomic adapter/rollback proof và authority DB riêng. Giữ omitted days, status và approved_by hiện hành. F05 quyền vẫn chưa đóng. |
| GL10 | P1 | Student 360 / Enrollment: danh sách, chi tiết, identity, guardian | F12 LOCAL PASS đã seal; giữ nguyên. Enrollment admin-only theo contract v1; không tự thêm create Party/guardian. Cần actual caller/DB/Browser theo phần chưa có proof. |
| GL11 | P1 | Quản lý lớp / giáo viên / branch / assignment | Reuse public Education/Platform contracts; chọn allowed/denied create/read/update và reload để kiểm chứng, không thay assignment lifecycle. |
| GL12 | P0 | My Class: attendance/care/menu/handover/chat | F11: local state/prototype chưa phải persistence. Chưa được tự port WIP hoặc tạo business workflow. Cần map từng control với capability/authority hiện có trước khi nối. |
| GL13 | P0 | Scheduling / seed control | F08 giữ nguyên; không chạy seed. Destructive/demo path cần disposition trước vận hành, không lấy test demo làm proof. |
| GL14 | P0 | Communication / Announcements / Portal bulletin | Private chat unavailable theo owner contract; không bật tính năng mới. Announcement authority/idempotency có contract mục10; final DB boundary chưa chứng minh. |
| GL15 | P1 | Dashboard / Analytics / Reports / Work Queue | Giữ số đo thật và trạng thái thiếu dữ liệu. Kiểm chứng các liên kết, filter, refresh và đồng bộ các luồng P0; không suy missing thành zero/PASS. |
| GL16 | P2 | Facilities / Copilot / UI polish, tiện ích | Không redesign; phân loại lỗi ảnh hưởng vận hành khi tới luồng. Không tự tuyên bố backlog P2 đã được chấp nhận cho Go-Live. |

## Batch GL02 — Care chọn đúng trẻ

<frozen-after-approval>

**Authority:** yêu cầu Go-Live cho phép sửa lỗi UI/data wiring trong contract hiện hữu.
**Problem:** Care đổi `student=HS0001/STU-001` sang tên mẫu, rồi lọc name/note;
Party ID hợp lệ không match, còn trẻ trùng tên mẫu có thể hiện thay trẻ được chọn.
**Preservation:** layout, text, tabs, class/day scope, free-text name/note search,
Care API request/response, save behavior và role/tenant/assignment không đổi.
**Fix:** context match đúng `studentPartyId` hoặc `studentCode` từ roster được API
cấp quyền; tên hiển thị lấy từ roster, không từ bảng tên mẫu. Search thủ công hoặc
“Xem tất cả trẻ” rời context rõ ràng; selector thiếu/không match không chọn trẻ khác.

| Given / When | Then |
| --- | --- |
| Hai trẻ: code HS0001 có tên thật khác mẫu; trẻ khác mang tên mẫu | Deep link HS0001 chỉ hiển thị đúng trẻ có code HS0001. |
| Deep link là Party UUID, hoặc khác hoa/thường/space | Match canonical Party ID/mã đúng; không match prefix hoặc note của trẻ khác. |
| Context không tồn tại trong roster được cấp quyền | Không hiện trẻ thay thế hoặc phát sinh POST. |
| Người dùng tìm tên/ghi chú hoặc bỏ context | Search hiện hành hoạt động trên roster, banner không giả vờ giữ context cũ. |

</frozen-after-approval>

**Change Map:** Product UI maintenance, không phải contract/Kernel change.
Owner dữ liệu: Education roster identity; Preschool Care API/authorization; UI chỉ lọc
DTO đã được cấp quyền. Path: Care UI → Care classes/bulk API → existing public contracts
và persistence; không có DB call mới. Schema/migration: NOT_APPLICABLE.
Healthcare, academic rules, events, temporal/export không bị tác động.
Gates1/2/11: diff/source + focused UI/save regression + typecheck; Gates3/4 giữ nguyên
boundary API và dùng existing denied/error regressions; không claim RLS từ mock.
Gates5–10 không có thay đổi thuộc phạm vi của các gate đó. Không chạy full audit/F13.

**Code Map / tasks:**
- [x] `src/app/dashboard/education/care/__tests__/page.test.tsx`: regression tái hiện trước sửa, kiểm tra đúng identity và thao tác save.
- [x] `src/app/dashboard/education/care/page.tsx`: bỏ tên mẫu khỏi context, giữ giao diện và Care write path.
- [x] Chạy focused UI/save + API access regression và TypeScript; review diff/edge cases, ghi kết quả tại đây.

**Acceptance:** Given roster hợp lệ, when mở context rồi chọn hàng trẻ và ghi care,
then UI gửi chính Party ID đã chọn; when chỉ mở context không hợp lệ, then không có
trẻ giả hoặc POST tự động. Whole-class quick-save khi không chọn hàng giữ nguyên
semantics hiện hành, không suy scope ghi từ search. Đổi context bỏ selection/draft cũ.
DB/Browser end-to-end chỉ được gọi PASS khi có thực thi phù hợp; local
UI/contract PASS không đóng toàn bộ GL02 hoặc Go-Live.

## Evidence / quyết định còn hiệu lực

- F10/F12: giữ local seal và 76 regression tests; không chạy lại nếu source không đổi.
- Attendance V2: giữ nguyên artifacts và 29/29 receipt; recovery risk ACCEPTED, không phải PASS.
- Lần metadata đã bắt đầu trước khi chuyển mục tiêu hoàn tất ngày01/11/2026: legacy `dpl_3gDwjToSwdUvtBtqeaxppgRNfbMt` READY lúc19:54:49+07; domain chính resolve deployment mới `dpl_DstNQvShsVvhXgWrsM283n6pJQVN` READY lúc19:54:54+07. Không suy READY thành traffic/owner, không claim alias list rỗng vì inspector chưa xác nhận field alias. Đây là dependency compatibility của GL01, không dừng các batch độc lập.
- Parent Daily containment, F01/F02/F05/F09 và My Class/Scheduling không tự được mở khóa bởi mục tiêu Go-Live.
- Không commit/push/merge/deploy hoặc ghi Production. **Go-Live: NOT_READY** cho tới khi các luồng bắt buộc có đủ bằng chứng/acceptance riêng.

## Seal batch GL02 — local UI/contract

Đã sửa đúng một phần của GL02; không đánh dấu toàn bộ Care hoặc Parent sync hoàn tất.
Party ID được ưu tiên, mã học sinh chỉ resolve khi duy nhất trong roster đã authorize;
không resolve qua tên mẫu/prefix/note hoặc đoán khi ambiguous. Manual search và nút
“Xem tất cả trẻ” giữ hành vi search hiện hữu, banner phản ánh context đang có.
Đổi query bỏ selection và toàn bộ quick draft cũ. Save đã gửi vẫn được đọc lại qua API;
callback cũ không reset selection/modal hoặc báo kết quả cho context mới.

| Kiểm chứng thực thi | Kết quả / evidence |
| --- | --- |
| Reproduce trước sửa | 7 FAIL / 14 SKIP (chỉ chạy các case mới bằng name filter), `go-live-care-context-before.json`. SKIP không phải PASS. |
| Lượt sau sửa đầu tiên | 109 PASS / 2 FAIL, `go-live-care-context-after.json`: tests đã giả định sai no-selection bulk chỉ gửi trẻ đang lọc. Đã giữ whole-class semantics, chọn hàng rõ ràng trong test; không đổi handler bulk để làm xanh. |
| Regression cuối sau review | **3 suites / 115 tests PASS, 0 FAIL, 0 SKIP**: Care UI 26; Care save 8; API Care access 81. `go-live-care-context-sealed.json` và `.log`. |
| Focused TypeScript | **PASS, 0 diagnostics** trên UI/test thay đổi; `go-live-care-context-typecheck-sealed.json`. Không phải full repository build/typecheck. Lượt đầu thiếu generated `next-env.d.ts` được giữ trong receipt cũ; không tạo shim hoặc đổi config. |
| Scoped review | Blind/edge/acceptance đọc diff, không ghi file/DB. Đã sửa unique-code ambiguity, quick options còn sót, late callback xóa selection và guard bỏ mất read-back. Final review không còn evidenced finding trong scope. Các diff vòng trước giữ lại. |
| UI/API/authority preservation | Không đổi className/layout/component, API request/response, whole-class fallback, role, schema hoặc public contract. Không chạy lại F10/F12 hay audit toàn Preschool. |
| Giới hạn | Jest mock/DOM + source review; **Real DB/Auth/RLS, Browser và Production cho delta GL02: NOT_PROVEN**. Không coi mocked API refresh là DB persistence proof. |

Receipt cuối SHA256: `3313bee42019ece06ed483b4f199d182314c4dd938d366facbf49c081fa08ebc`.
UI SHA256: trước `970790a3aeedfc63c821efe079922f724e1c9bb86624b56c5e469816f4e2eb65`,
sau `c3b49a2c92894123d1171d14b81d3f687ae885d9281b1be5749a9ca6edf59fc3`.
Test SHA256: trước `fd8c97e4818b54a75f8fc3ebb369d6df146f57fb6988bee2285677d80fc87633`,
sau `c5a570cfa4ad0ab3f3a90f1b16940b7436a963f4f2fb2185152f8a3f73b3d8ed`.

### Review order cho delta đã sửa

1. Context resolve từ canonical roster: [page.tsx:579](../../../src/app/dashboard/education/care/page.tsx#L579).
2. Read-back và callback đúng context: [page.tsx:679](../../../src/app/dashboard/education/care/page.tsx#L679).
3. Regression identity/draft/save: [page.test.tsx:163](../../../src/app/dashboard/education/care/__tests__/page.test.tsx#L163).

Batch local đã seal; Product backlog tiếp tục IN_PROGRESS, Go-Live NOT_READY.
Luồng kế tiếp cần dùng public contract và profile cô lập hiện có để kiểm chứng
Teacher Care → Parent Portal; Parent Daily 503 và những capability/permission gap ở
các dòng trên tiếp tục được giữ rõ, không tự tháo containment để hoàn thành checklist.

## Batch GL03 — Teacher Care → Parent Portal

**Scope owner:** Teacher chọn trẻ/ghi Care qua API hiện có; Parent đọc đúng trẻ,
deny trẻ khác và reload. Không sửa GL02; không tạo guardian binding, grant/role,
schema, public contract hoặc tháo containment. Không Production/commit/deploy.

**Change Map trước sửa:** Product API wiring / security bugfix, không đổi permission
matrix. Contract AUTHORIZATION_CONTRACT mục2/5 yêu cầu revalidate tenant và guardian
relationship ở mỗi lần đọc. Route Portal Care chỉ gọi verifyPortalToken rồi dùng
operation client đọc Care; thiếu gọi service `authorizePortalToken` đã tồn tại.
Fix nhỏ nhất: giữ signature-first gate, gọi đúng authorization service trước các query
Enrollment/Care; dùng claims đã authorize. Giữ response success/error envelope và
private/no-store headers. Không thêm predicate, producer hoặc nguồn guardian truth.

**I/O / acceptance cho delta wiring:**

| Given / When | Then |
| --- | --- |
| Token được xác minh và guardian service cho phép | Cùng dữ liệu Care/response hiện hành, không đổi field hoặc UI. |
| Binding không hợp lệ/đã thu hồi, hoặc dependency lỗi | Existing authorization error; chưa đọc Enrollment/Care và không ghi gì. |
| Signature sai hoặc token thiếu | Fail trước khi tạo adapter/đọc dữ liệu. |
| Guardian authorization đang pending | Không query dữ liệu trẻ trước khi có kết quả. |

**Code map:** route `src/app/api/education/portal/[token]/care/route.ts`, regression
`__tests__/route.test.ts` và một case trong `src/products/bella-education/__tests__/preschool-parent-portal.service.test.ts`;
reuse `PreschoolParentPortalService.authorizePortalToken` và repository hiện có,
không sửa implementation của chúng. Không thêm import Kernel/direct DB surface.
Gates1/2/3/4/11: delegation/order, tenant-child binding, denied/error/no-read regression,
affected service tests, focused TS/diff review; mock không chứng minh RLS/DB/Browser.
Gates5–10 không có schema/event/academic/history/export change. Không chạy lại GL02.

**Profile đã đối chiếu chỉ đọc:**

| Profile | Source / ownership | Metadata quan sát | Phạm vi có thể kết luận |
| --- | --- | --- | --- |
| `bella-preschool-532b3b8a` | Onboarding checkout, source `bf1ac7030eb740c7c8b59e8e4c4321f53acded04`; owner/container ID match, loopback | Không có Care sessions/records; 0 guardian bindings; Portal issuer/daily-read RPC absent | Không đủ profile cho GL03. |
| `bella-preschool-95c70855` | Cùng source cũ, admission profile; owner/container ID match, loopback | Có Care tables, 3 guardian bindings tổng hợp; Portal issuer/daily-read RPC absent | Có binding không tự chứng minh binding hợp lệ, fixture được duyệt cho source hiện tại hoặc full Portal flow. Không sửa/seed profile này. |

Các kiểm tra dùng READ ONLY, chỉ metadata/count. Lượt đầu query bảng Care chưa tồn tại
trong teacher profile bị lỗi và transaction đóng/rollback; lượt bổ sung dùng to_regclass
trước khi đếm binding. Không coi query lỗi là PASS. Không đọc PII, ghi DB, tạo binding,
apply migration hoặc cleanup resource của checkout khác. Cần profile/receipt phù hợp
để chạy positive DB/Browser; đã hỏi owner nguồn có sẵn, không xin quyền tự tạo binding.

**Chặn đang giữ:** Teacher Care có nhánh `CARE_TEACHER_IDENTITY_UNAVAILABLE` cho
`admin_staff`; không dùng admin để chứng minh teacher flow. Parent Daily 503 giữ nguyên.
Phần scope token Portal cần đối chiếu theo contract; không tự suy từ tên scope rằng
Care bị cấm hoặc được mở rộng. Full GL03 không được gọi PASS từ source hoặc mock.

### GL03 — kết quả thực thi và điểm dừng

Đã sửa duy nhất wiring: `verifyPortalToken` vẫn chạy trước adapter; sau đó route gọi
service `authorizePortalToken` hiện có và dùng claims được authorize trước Enrollment/Care
query. Guardian/tenant lookup không được thay bằng signature, role hoặc dữ liệu mẫu.
Không sửa helper policy/repository, response shape, UI, role, grant hoặc binding.

| Checkpoint GL03 | Bằng chứng hiện tại | Trạng thái |
| --- | --- | --- |
| Teacher chọn trẻ và cập nhật Care | GL02 giữ seal. Care API source vẫn giữ teacher identity unavailable; source writer `20261031143000_preschool_care_rpc_and_rls.sql:85` yêu cầu `u.role='admin'` | BLOCKED; chưa gọi teacher JWT trên profile phù hợp, không suy source thành runtime Production. |
| Care API ghi DB đúng dữ liệu | Không có positive write trong batch này; không dùng admin hoặc direct DML để thay teacher | NOT_PROVEN. |
| Parent đọc Care đúng trẻ qua authorization | API đã gọi lại existing guardian/tenant authorization trước dữ liệu riêng; happy response compatibility + deny/pending order regressions PASS | LOCAL_CONTRACT_PASS; actual DB/API/Browser chưa chứng minh. |
| Parent không đọc trẻ khác | Route test chứng minh delegated denial trước data reads; actual service/repository với signed token và in-memory DB cho linked child PASS, child khác cùng tenant không có binding bị từ chối | LOCAL_CONTRACT_PASS; không phải actual cross-child JWT/RLS hoặc Browser proof. |
| Reload còn dữ liệu vừa ghi | Không chạy write/read/reload browser trên profile không phù hợp hoặc tự tạo binding | NOT_RUN / BLOCKED. |

**Kiểm chứng:**
- Trước sửa: `gl03-portal-care-auth-before.json` và `.log`: **5 FAIL / 1 PASS**, tái hiện thiếu authorization call.
- Sau sửa lần đầu: `gl03-portal-care-auth-after.json` và `.log`: **3 suites / 21 tests PASS, 0 FAIL, 0 SKIP**; giữ receipt này nguyên vẹn.
- Lượt cuối: `gl03-portal-care-auth-sealed.json` và `.log`: **3 suites / 22 tests PASS, 0 FAIL, 0 SKIP**. Portal Care route 6; ParentPortal service 14; Parent Daily containment 2. Case bổ sung dùng crypto/service/repository hiện hữu và dữ liệu giả lập trong bộ nhớ; không tạo guardian binding trên DB. Không chạy lại 115 GL02 tests.
- `gl03-portal-care-auth-typecheck-sealed.json`: **0 diagnostics** trên ba file thay đổi, không phải full repo build/typecheck. Receipt hai file trước đó được giữ nguyên.
- Blind/edge/acceptance scoped source review: không có evidenced regression trong delta; acceptance review bổ sung xác nhận case service cross-child chỉ chứng minh hành vi với fake client. Reviewers không chạy DB/Browser, tái chạy tests hoặc sửa file.
- `gl03-profile-inspection.json`: READ ONLY catalog/count trên các profile cũ; không claim full guardian/profile parity hoặc E2E từ 3 binding rows.

**Source/runtime boundary:** RPC admin-only là kết quả đọc migration/prerequisites,
không phải một kiểm tra function Production mới. Available teacher public self-course
scope hiện là Attendance; contract mục8 vẫn giữ teacher held ngoài opt-in Attendance.
Không tự áp quyền Attendance cho Care, đổi actor role hoặc mở DB predicate. Full GL03
không thể được đóng chỉ bằng wiring mà vẫn giữ nguyên các chặn này.

**Preservation:** GL02 UI/test SHA256 vẫn `c3b49a2c92894123d1171d14b81d3f687ae885d9281b1be5749a9ca6edf59fc3` /
`c5a570cfa4ad0ab3f3a90f1b16940b7436a963f4f2fb2185152f8a3f73b3d8ed`.
Parent Daily source SHA256 vẫn `cd11601735cf1698945e46f6693f21783c92bec3231cf781c59e6aa725ce6976`.
Portal Care route trước/sau: `da672ab586214c701f22ea058236848bb1605c90fefb8dfd300ff7b90c6ba1b9` /
`93c9ba59ea4d11b694a3eb8d4e44c71c5b533e8d9333b75923f28b0471540dcd`.
Receipt cuối 22 tests SHA256: `8fc19fd1af5177d375cf35c49c49365b87ab8d7374ca15f2df3b2bcfc123c00c`.
Typecheck cuối SHA256: `7367972cb9a5ef90a17d40c87b67a3aede0d2078e4156ab892ca5f3c1af97b16`.
Route test SHA256: `fc3892c2f8f5d0b8f2555d7f2e79f941fb3fe4eaf0c1042478329176ea1ef358`.
Service test SHA256: `7239210f2cc53be0783d9e8251573dde878b1aaac39ae6f36b7203edcd9f6cd7`.
22 source hashes trong Attendance seal không đổi; không tái chạy batch Attendance/F10/F12.

**Điểm dừng:** giữ các sửa wiring ở local; cần profile/receipt có sẵn đủ điều kiện và
disposition riêng cho Teacher Care identity/DB boundary trước khi có thể chạy đủ luồng.
Không tự tạo binding, thêm quyền, apply migration, sửa V2 hoặc Production. Recovery
risk vẫn ACCEPTED, không dùng làm blocker độc lập. **GL03: PARTIAL / E2E BLOCKED;
Preschool: NOT_READY.**

## Batch GL04 — Parent Portal read/reload

**Authority / Change Map trước sửa:** kiểm tra token → child → attendance/handover/
bulletin → reload bằng contract hiện có. Product API/UI wiring trong scope đã duyệt;
không đổi UI, permission matrix, guardian binding, schema, public contract hoặc Production.
Direct single-agent implementation; scoped review dùng quy trình review hiện có.
Giữ GL02/GL03 và receipt đã seal; không chạy lại các suite đó khi source không đổi.

**Root cause đã đọc:** main Portal legacy payload dùng service authorization; scoped
daily payload dùng `preschool_portal_daily_read`, kiểm tra claims/output trước trả dữ liệu.
Attendance và tuition là request phụ mà daily UI hiện gọi nhưng hai route chỉ verify
signature, thiếu `authorizePortalToken` hiện hữu. Attendance còn coi query error như
không có dữ liệu và trả success. Không suy permission từ tên token scope hoặc quan hệ
guardian thành quyền payment; không sửa Finance filter, công thức hoặc trạng thái.

**Minimal fix / preservation:** giữ signature-first, gọi existing service trước các
query private attendance/tuition, sử dụng claims đã authorize. DB read error attendance
phải unavailable; enrollment thực sự không tồn tại vẫn giữ empty result. Giữ request/
success response, RLS, operation-client selection, attendance/Finance semantics.
Không thay API/UI hoặc thêm nguồn truth để tạo handover trong scoped DTO chưa có field đó.

**Verification:** authorization allowed/deny/pending/signature-before-client; DB error
không thành success; token/claims/bulletin validation hiện có; UI reload và token change.
Gate1/2: public authorization reuse, local diff/boundary; Gates3/4: denied/tenant/child
regression (local proof, không claim Real DB/RLS); Gate11: affected tests/TypeScript.
Gates5–10 không có mutation, academic rule, event, history hoặc export change.
Real DB/Browser dùng lại giới hạn profile GL03; chưa có profile/receipt phù hợp, không
query lại profile cũ, seed hoặc tạo binding để làm xanh. Phần thực tế giữ NOT_PROVEN.

### GL04 — kết quả và giới hạn

| Luồng | Bằng chứng trong batch | Trạng thái |
| --- | --- | --- |
| Token issuance / signature / TTL / selectors | Existing caller-scoped issuer route và signing/security regressions; source RPC kiểm tra current tenant, Course/branch, enrollment và directed guardian binding. Không đổi signing/role/contract. | LOCAL_CONTRACT_PASS; actual issuer/DB/JWT chưa chạy. |
| Child scope / tenant / bulletin | Main daily route dùng exact claims, validate DTO/tenant/day và announcement feed; legacy payload dùng service authorization. Existing mismatched claims, invalid feed và denied RPC tests PASS. | LOCAL_CONTRACT_PASS; không suy mock RPC thành RLS proof. |
| Attendance private read | Signature-first; await existing `authorizePortalToken` trước Enrollment/Attendance query. Denied/pending không đọc private data; query error trả503, no-enrollment thật giữ empty summary. | LOCAL_CONTRACT_PASS. |
| Tuition request phụ của daily UI | Cùng guardian revalidation trước invoice/bank metadata. Không đổi Finance query, identity fallback, calculation, settlement status hoặc quyền payment. | LOCAL_CONTRACT_PASS cho delta wiring; Finance semantics/boundary chưa được batch này chứng minh. |
| Care read | Tái sử dụng GL03 đã seal; không sửa hoặc chạy lại22 tests. | Giữ LOCAL_CONTRACT_PASS trước đó; full Teacher→DB→Parent vẫn BLOCKED. |
| Handover | Legacy payload đi qua guardian authorization và filter tenant/Student; UI test render dữ liệu handover được cung cấp. `daily_read_v1` loại pickup/handover khỏi DTO. | LOCAL_UI_COMPOSITION_PASS cho legacy; scoped capability chưa có, DB/read-back NOT_PROVEN. |
| Reload / đổi token | DOM tests lấy lại attendance/bulletin bằng no-store, xóa child view khi reload bị từ chối, late response của token cũ không thay child/bulletin hiện tại. | LOCAL_UI_CONTRACT_PASS; không phải Browser hoặc DB persistence proof. |

**Runtime delta:** chỉ hai API route attendance/tuition; ba test files được mở rộng.
Không sửa Portal UI runtime, token issuer, main payload route, helper/repository,
permission, pickup authority, GL02/GL03, schema hoặc Production.

**Checks thực thi:**
- Existing baseline: `gl04-existing-before.json` — **5 suites / 86 PASS**, không fail/skip.
- Một lượt UI không dùng cache để đối chiếu baseline: `gl04-ui-fresh-baseline.json` — **4 PASS**; không phải Browser proof.
- Reproducer mới trước sửa runtime: `gl04-read-authorization-before.json` — **11 FAIL / 3 PASS**, tái hiện thiếu authorization và DB error bị trả success.
- Sau sửa: `gl04-read-after.json` — **6 suites / 148 PASS, 0 FAIL, 0 SKIP**: Portal access38, token issuer42, signing/security47, UI7, attendance9, tuition5. Không chạy lại full Preschool/F13, GL02 hoặc22 tests GL03.
- `gl04-read-typecheck.json` — **5 changed files / 0 diagnostics**; không phải full repository build/typecheck. `git diff --check` PASS.
- Review: blind đọc runtime subset; edge và acceptance đọc five-file diff. Không có finding introduced được xác nhận; reviewers không chạy DB/Browser, test hoặc ghi file. Đây là source review, không phải runtime proof.

**Residual / stop:** profile GL03 chưa phù hợp vẫn là giới hạn được tái sử dụng;
không kiểm kê DB lại hoặc tự tạo guardian binding. Handover legacy đang query UTC day
trong khi service chọn today theo Việt Nam; chưa có DB/day-boundary parity proof,
không coi UI composition test là bằng chứng ngày nghiệp vụ đúng. Attendance history
vẫn có fallback unknown status/time và Finance identity fallback hiện hữu; không đổi
những semantics đó trong wiring delta hoặc gọi chúng PASS từ regression happy path.
UI có thông tin nhân sự/lớp mẫu cần nguồn canonical riêng; không phơi thêm dữ liệu.

**Seal:** giữ local WIP; source/hash/receipt tại `gl04-read-seal.json`. GL02 và GL03
giữ nguyên hash, Parent Daily vẫn503, V2 không đổi. Không commit/push/deploy/DB mutation.
**GL04: PARTIAL_LOCAL_CONTRACT_PASS; Real DB/RLS/Browser: NOT_PROVEN; Preschool: NOT_READY.**

## Batch GL05 — Admission / học phí

**Change Map / authority trước code:** scope UI→confirm-admission→Finance→activation/
read-back. Không đổi phí, kỳ thu, PAID/DEBT, enrollment lifecycle, API/UI, permission,
schema, public contract, Kernel hoặc Production. Tái sử dụng F01 precheck hiện hữu;
không audit lại Preschool và không chạy lại GL02–GL04 đã seal.

**Canonical check:** `TuitionBillingService` dùng configured fee structures, active
enrollment và tạo DRAFT; `recordAndReconcilePayment` có operation key/Finance atomic
command nhưng không activate enrollment/headcount. Enrollment public contract có
enroll/get và read-only request recovery, không có confirm-existing-enrollment cùng
Finance. Đây không phải các phương án thay thế tương đương cho route hiện tại.
Không dùng tài liệu Finance IN_PROGRESS năm18/08 làm quyết định pricing/activation.
Các số5.700.000,4.500.000,1.200.000 và kỳ thu fallback trong route là implementation
observations, không phải business rule được duyệt. F01 runtime tiếp tục HELD.

**Diagnostic delta được thực hiện:** chỉ thêm black-box characterization tests cho
route đang có bằng fake Supabase driver/auth. Inject returned errors/zero-row và
điều khiển interleaving hai request; ghi nhận response và write attempts. Không tạo
DB fixture/binding, không khẳng định fake client mô phỏng đầy đủ FK/unique/locking.
Test assertion mô tả lỗi hiện tại, không phải acceptance/business rule cho implementation
mới. Không thay route bằng503 hoặc ghép thêm service/compensation để gọi là atomic.

**Verification applicability:** Gates1/2/11 cho test-only diff/typecheck và preservation.
Actual transaction, rollback, retry/concurrency, DB read-back, tenant/Auth/RLS và Browser
vẫn chưa có bằng chứng trong batch này; không chuyển các gate đó thành NOT_APPLICABLE
cho toàn luồng Admission. Giữ nguyên GL01–GL04, F13 và toàn bộ local WIP.

**Kết quả GL05 trước khi đổi ưu tiên release:** `gl05-admission-diagnostic.json`:
2 suites/17 tests thỏa assertion (4 route regression +13 diagnostic),0 fail/skip.
Diagnostic assertion xác nhận hành vi lỗi hiện tại; **không phải17 acceptance PASS**.
`gl05-admission-typecheck.json`: changed test file0 diagnostics. Không sửa runtime,
fee, period, state, public contract hoặc DB. GL05 tiếp tục HELD.

## Ưu tiên release đã seal — 02/11/2026

Chỉ đạo mới cho phép chuẩn bị tích hợp/phát hành phần đủ điều kiện; giữ phần HELD
và toàn bộ WIP gốc. Không tự cấp quyền DB mutation, thay deployment/security gates
hoặc ghi đè thay đổi Production ngoài scope. GL01/V2, GL05, F10/F12/F13 và WIP khác
không được đưa vào gói GL02–GL04 này.

- Đích đã xác minh live: repository `bellaspahcm/bella-ai-platform`, ID1235614110;
  tên remote legacy `bella-spa-erp` redirect cùng ID. `main` vẫn `f1299e3138f3700062a1ed84271db315737b0071`.
- Ruleset effective yêu cầu PR và bốn checks: Frozen File Check, Architecture Guard
  Verification, Dependency Boundary Check, Logistics Kernel Regression. Không bypass.
- Worktree sạch riêng `D:/CodexWorktrees/preschool-sealed-release-20261102/BELLA SPA ERP`,
  branch `codex/preschool-sealed-release-20261102`; copy đúng10 file đã hash-seal
  (4 runtime,6 tests), giữ nguyên source/WIP cũ.
- Integration regression trên chính gói không có WIP khác: **12 suites/273 tests PASS**,
 0 fail/skip, `sealed-release-20261102-jest.json`. Main Care access suite có69 tests,
  không port12 characterization tests từ WIP; không gán lại count này cho seal GL02 cũ.
- Focused TS10 files0 diagnostics: `sealed-release-20261102-typecheck.json`.
- Production domain hiện resolve `dpl_DstNQvShsVvhXgWrsM283n6pJQVN`, URL
  `bella-spa-ahbgh7ns1-bella-spa-s-projects.vercel.app`, READY, sourceCLI, metaSHA main,
  `gitDirty=1`; project `prj_Rgncynqz8ptznREGggMxPfjwoikW` liên kết đúng repo/main.
- Source parity theo file UID và main bytes(LF/CRLF):2635 match,36 mismatch runtime
  ngoài/phần liên quan Preschool.17 missing paths và7 extra directory-like entries
  chưa được suy thành function mất/được thêm. Receipt
  `sealed-release-20261102-production-source-parity.json`; đây không phải compiled
  runtime proof. Follow-up đọc đủ36 file trong bộ nhớ đã xác nhận **36/36 chỉ khác
  BOM/line endings**, normalized text bằng main. Không có source text delta nào trong
  nhóm36 này; bỏ giả thuyết ghi đè business/UI change từ nhóm này. Receipt
  `sealed-release-20261102-production-source-classification.json`, không lưu raw source.
- Workflow Production hiện có mandatory health-migration job; runner có thể apply
  `20261029090000`, không có code-only flag. Run gần nhất40838052474 validatePASS nhưng
  migrationFAIL; chưa dispatch workflow mới, chưa bỏ/sửa gate.

**Gói đã kiểm chứng:** commit `489cfb5b0593e0e6cb839b5e7b021da9fb3202af`,
PR https://github.com/bellaspahcm/bella-ai-platform/pull/474. `npm run build:prod` PASS;
receipt `sealed-release-20261102-build.json` giữ rõ lệnh production hiện hành skip
build typecheck, focused10-file TS được kiểm chứng riêng. Independent integration
review:10 file khớp seal,13 unchanged dependencies khớp main, không cần WIP bị loại.
Bốn required checks đã PASS; các CI/Preview còn lại tiếp tục được theo dõi.

**Production HOLD** còn ở đường release: workflow hiện không có code-only input,
mandatory health-migration job có thể thay DB. Không dispatch/migrate hoặc né gate.
Đường code-only đề xuất, chưa thực hiện: sau khi CI và main integration hợp lệ, giữ
validation/security/migration-applicability checks; build đúng main commit với existing
Production config, tạo deployment chưa gắn domain, health/auth/denied-read smoke rồi
mới Promote và kiểm tra domain/source SHA. Không đụng DB, env, region hoặc Settings.
Đây là quyết định route riêng, không phải phê duyệt migration hoặc Go-Live.

### Release checkpoint — main integrated, chưa Production

- PR474 đã squash merge lúc2026-11-01T22:28:55Z (02/11 tại Việt Nam), main
  `eb5b0a5facfed67ba955fd975f7a498778776e5c`; tree
  `002868197facca255c2befb53a148bf8e65156d5` bằng tested head489cfb5b0.
- Preview474 READY: `https://bella-spa-j0frb4z7q-bella-spa-s-projects.vercel.app`.
  Invalid-token/health GET bị platform protection401; không coi JSON401 đó là app
  authorization PASS. Không đăng nhập hoặc đọc dữ liệu trẻ. Receipt preview-smoke
  giữ APPLICATION_SMOKE_NOT_PROVEN.
- Full Validate Main Release checks chỉ đọc bổ sung: lint0 errors/67 warnings;
  critical17 suites/199 tests PASS; API versioning và zero-downtime static policyPASS.
  Dependency audit phát hiện follow-redirects1.16.1 High GHSA-mrwp-f3q8-3g9p; không waive.
- Owner đã duyệt PR dependency riêng và code-only release, sau đó duyệt thêm đúng
  manifest override pin1.16.2. PR475 current head `7ff825c11d8d7a63f636867eb6c86303ee496897`:
  chỉ package.json override và3 fields của một entry package-lock.
- Initial PR475 head544a8a9 bị npm ci từ chối do pin cũ1.16.1; giữ evidenceFAIL,
  không coi là transient. Sau đồng bộ: plain/legacy-peer npm ci dry-runPASS trong
  temp copied manifests; root production auditPASS, allowlist giữ nguyên.
- Real package loopback6/6 checks PASS trên official tarball1.16.2 đã kiểm integrity.
  Baseline installed local thực tế1.16.0; không gọi là tái hiện runtime1.16.1 hoặc
  Production exploit. Không install/đổi shared node_modules. CI/remote build phải
  install patched lockfile để chứng minh final artifact.
- PR475 đang bị Trivy chặn ở **apps/mobile/package-lock.json**, package
  decode-uri-component0.2.2/CVE-2026-118664 qua @react-navigation/core7.21.2 →
  query-string7.1.3. Package này không có trong root lockfile. Fixed0.5.1 là ESM,
  nên không tự ép override vào chain CJS; không thêm allowlist hoặc đổi gate.
- Đã hỏi owner duyệt scope riêng chain Mobile hoặc giữHOLD; chưa sửa Mobile khi
  chưa có quyết định. PR475 chưa merge, chưa tạo staged Production deployment,
  chưa Promote, chưa dispatch release workflow, chưa chạy DB migration/DML.
- Domain Production vẫn phục vụ dpl_DstNQvShsVvhXgWrsM283n6pJQVN / source metaf1299e3.
  31 audit-WIP source hashes từ durableGL04 seal không đổi; không claim snapshot
  trong RAM còn tồn tại. `sealed-release-20261102-preservation.json` PASS.

**Không nâng GL03/GL04, Real DB/RLS/Browser hoặc Go-Live từ main merge/Preview READY.**

### Mobile dependency prerequisite — scope đã duyệt

Owner duyệt xử lý đúng chain Mobile để tiếp tục release, giữ nguyên gates/allowlist.
Proportional Change Map: dependency-maintenance trong apps/mobile/package-lock.json;
không đổi UI, routing config, Auth/Tenant context, API, schema, roles hoặc Kernel.
Producer/contract là React Navigation public linking helpers mà Expo Router hiện dùng;
không tự viết decoder hoặc compatibility subsystem.

Candidate upstream được kiểm tra: Core7.23.0 (native7.3.4 đang yêu cầu^7.21.2), đã bỏ
query-string; Routers7.6.4 là minimum dependency của Core này, trong range7 hiện hữu.
Không ép decode-uri-component0.5.1 ESM vào consumer CJS. Chỉ xem xét hai lock entries
Core/Routers và prune query-string cùng các dependency thực sự orphaned sau đó; giữ
package.json Mobile và mọi dependency ngoài chain. Mobile CI không deploy/OTA, chỉ
typecheck/build/security. Migration NOT_APPLICABLE cho delta dependency.

Verification trước sửa: so sánh real upstream helper getStateFromPath/getPathFromState
với các route hiện có login/home/schedule/profile, query encoding và negative inputs;
isolated npm installability. Không gán helper proof thành Expo/device E2E. Sau sửa cần
Trivy/required CI trên đúng head, root audit/build và staged Production verification.

### Mobile candidate correction — preserve existing Navigation Core

The real helper comparison rejected Core7.23.0: 2/17 URL output cases differ (empty
flag/repeated query). All14 direct serializer cases match. Receipt mobile-chain-
20261102-parity.json retains failures; no source change was made for that candidate.
Expo Router4.0.22 also imports query-string without declaring it (three built callers),
so pruning query-string would break the existing application.

Revised minimal Change Map (authorized chain compatibility): retain Core7.21.2 and
Routers7.6.0; test query-string9.5.1 with fixed decode0.5.1 using the existing public
parse/stringify API. If parity holds, update only the Mobile dependency chain and a
Metro-scoped CommonJS/ESM export-shape bridge for Expo Router's existing namespace
imports. The bridge delegates to the public library; no parser, URL rule, UI, auth,
role, API, DB, Kernel, workflow, security allowlist or routing configuration change.
Keep Metro's existing resolver fallback. Test exact public helpers, Expo namespace
shape, resolution scope/cycle avoidance, installability and Mobile typecheck/bundle.
Migration NOT_APPLICABLE. Device/application E2E remains a separate evidence level.


### Mobile final candidate verification — same Core / public API bridge

Implemented local: exact query-string override9.5.1; decoder0.5.1, filter-obj5.1.0,
split-on-first3.0.0; removed only orphan strict-uri-encode2.0.0. Kept all unrelated
lock entries and existing Core7.21.2/Routers7.6.0. Metro bridge exports existing
public parse/stringify only for the Core/Expo package origins, with default/custom
resolver delegation and no recursive interception. No UI/routing rules changed.

- Official full Mobile `npm ci --ignore-scripts --no-audit --no-fund` PASS in owned
  temp copy. Source/shared node_modules junction never installed into or modified.
- Same-Core public helpers + exact Expo serializer parity31/31 PASS. Node fixture
  rewires module import only to mirror bridge; not a device E2E claim.
- New committed resolver/export-shape regression5/5 PASS.
- Real Metro iOS bundle including Core plus three existing Expo callers PASS.
- CI compiler TypeScript5.9.3, `-p <isolated mobile>/tsconfig.json --noEmit`: PASS0.
  Standalone Mobile compiler5.3.3 FAIL TS6046 on existing Expo `module: preserve`;
  PRE_EXISTING toolchain mismatch, unchanged. CI uses root compiler, not that binary.
- Root production audit PASS; `git diff --check` PASS. Required CI/Trivy on final
  PR head still pending; no merge, staged Production, promote or DB mutation yet.

Receipts: mobile-chain-20261102-existing-core-parity.json; -install.log; -tests.log;
-metro.log; -typecheck.log; -ci-typecheck.log; -root-audit.log. The -lock.json records
initial NPM output which pruned unrelated peer-only entries; those unrelated changes
were rejected and not copied. Final patch modifies exactly4 chain entries, removes
one orphan, and preserves every other entry. Keep rejected Core7.23 comparison and
fixture correction receipts unchanged. Independent scoped review in progress.

### Account creation authorized / CI resource blocker

Owner requested creation of a smoke account and provided their controlled email.
Created one Auth identity plus its public.users profile in existing Bella Preschool
Tenant A (admin, active); exact read-back receipt sealed-release-20261102-account.json.
No existing account was reset/reassigned. Random credential remains process-only;
no password/session file or business-data write. Owner can recover via their email.
This is the explicit account exception to otherwise code-only/no-business-DML scope.

Final head535b5ed passes Trivy filesystem; Mobile CI install/shared typecheck/Mobile
typecheck succeeded, but its unchanged root Web build on Node20 hit V8 heap OOM
around2GB, exit134 (run41365181072/job125023720198). This is ENVIRONMENT, not a decoder
or TypeScript regression. Other root build/gates pass. No failed check was waived.
Concrete proposed change awaiting owner: add only NODE_OPTIONS=--max-old-space-size=6144
to the existing mobile-ci.yml Web build step, preserving every command/gate/allowlist.
No workflow edit, merge or Production deployment before that decision.

### Bounded retry supported by independent identical-head PASS

Mobile CI pull_request run41365185350 completed SUCCESS on exact535b5ed; push
run41365181072 alone OOM. One retry of that failed push job has been requested on a
fresh runner, without any workflow edit. This new independent same-SHA PASS evidence
supports one bounded ENVIRONMENT retry; it is not an unlimited rerun or waived gate.
Heap-setting approval remains unused and unnecessary if the retry succeeds.

New-account real browser login PASS on existing Production f1299e3. Baseline health
returns503/database failed; Dashboard/Finance/Accounting/Care render but emit console
errors. No new release has been applied. Raw receipt retains exact failures:
sealed-release-20261102-baseline-smoke.json. Three denied-token assertions expected
TOKEN_INVALID incorrectly; canonical source verifies that a token without the two
segments returns401 TOKEN_MALFORMED. Classify those three as FIXTURE_STATE, with
observed denial intact, not authorization failure. Do not erase original receipt.

### PR475 main integration — security prerequisite sealed

Final tested head535b5ed20cc814d4b3b322011a5c371f826a8181. All check rollups completed
without failed/pending checks before merge; skips remain skips, not DB proof.
Mobile push retry attempt2 SUCCESS; independent PR run also SUCCESS. No workflow,
heap setting, gate or allowlist was changed; the pending heap proposal was not used.
PR475 squash-merged2026-11-02T00:22:47Z to main7346840706ee71b14f9bcf956d1e0d53c6bbf782.
Full check metadata: sealed-release-20261102-pr475-checks.json.

Health blocker confirmed by one constant public-key RPC call:404/PGRST202, function
not available to the current PostgREST call (absence/cache/exposure distinction not
claimed as proven catalog truth). Existing reviewed migration20261029090000 Git blob
SHA25646A11CFF0F380C957C55C118436FD1E3D23D9277BCBE2FEBDB15017E38AF5282 is unchanged.
Its guarded script permits only protected Linux/main release runner and exactly that
one pending version. Historical run40838052474 refused many pending ledger versions.
Do not bypass the guard, repair ledger, apply historical migrations, or manually
apply DDL. Health remediation requires a separate scoped decision; code-only release
authority does not cover it. No Attendance V2 or other DB package is authorized.


### Release sealed — candidate READY, HOLD / no Promote

Main7346840706ee71b14f9bcf956d1e0d53c6bbf782 tree04df4164288f0123eafd9478fe8c67e1afe8de8b
matches tested head535b5ed exactly. Code-only Git-source deployment:
dpl_FvHBz3BBp7wcdNtXEyFAgdYLGZyP / bella-spa-k4m8qgeiy-bella-spa-s-projects.vercel.app.
Vercel READY, buildCommand npm run build:prod, installCommand npm ci --legacy-peer-deps.
No build error reported. Requested and returned autoAssignCustomDomains=false.

IMPORTANT SIDE EFFECT / CORRECTION: the assumption that this flag preserves every
Vercel-generated alias was incorrect. At READY the primary domain remained on old
Production, but secondary bella-spa-erp-bella-spa-s-projects.vercel.app automatically
moved to the candidate. Restored ONLY that secondary alias using the documented
assign-alias API to dpl_DstNQvShsVvhXgWrsM283n6pJQVN; receipt records oldDeploymentId
as the candidate and subsequent GET verifies restoration. No Promote API was called.
Project targets.production and primary bella-spa-erp.vercel.app are verified still
old deployment/source f1299e3138f3700062a1ed84271db315737b0071. Do not claim no alias
mutation or no transient impact: requests/impact during the interval are NOT_PROVEN.
The git-main branch alias belongs to the new Git-source candidate; its prior mapping
was not captured. Do not repeat this creation route assuming a full alias freeze.

Read-only candidate smoke: Care/Attendance/Tuition malformed-token denial3/3 PASS
(401 TOKEN_MALFORMED); application health503/unhealthy/database failed. No valid child
or guardian record was read. Candidate browser authentication NOT_RUN after health
blocked. Baseline existing Production account login PASS, but full read-only route
smoke was not PASS (four pages emitted console errors). Do not promote or call
Preschool Go-Live. No migration, grant/revoke, schema/ledger repair, Attendance V2,
Production environment/settings change, deployment deletion or business DML.
The only account mutation was the separately owner-authorized Auth/public.users row.

Receipts: sealed-release-20261102-staged.json; -candidate-smoke.json;
-restore-alias-request.json; -restore-alias.json; -baseline-assessment.json;
-health-diagnostic.json; -account.json. Account test credential was process-only;
no password/JWT/storageState/screenshots/HTML were persisted. All owned Mobile install
fixtures removed after bundle hash/verification seal; shared node_modules untouched.
Root release worktree clean; all old Preschool WIP/seals preserved.

Next scope boundary: existing health RPC and guarded release/ledger readiness require
separate owner direction. Do not bypass the protected runner or apply the historical
pending migration list to make health pass. Recovery acceptance for Attendance is
not reintroduced as a blocker. GL01/V2, GL03/04 E2E gaps and GL05 remain unchanged.

### Health release preflight — scoped read-only continuation
Fresh main remains7346840 and Production Current remainsf1299e3. Use authenticated Supabase CLI --project-ref for one BEGIN READ ONLY metadata query: exact health function signatures/owner/ACL/config plus migration versions only. No business tables, DDL/DML, schema-cache reload, ledger repair, workflow dispatch or Promote. Reuse the unchanged guarded script's pure decision function to classify readiness. Do not interpret missing ledger entries as proof that historical DDL was not applied.


### Fresh health catalog decision — 02/11/2026

Read-only Supabase CLI preflight via --linked --project-ref lvnvkpyxtuilhrabtlwv
returned transaction_read_only=on at2026-11-02T01:47:22Z. Exact public health function
count0; anon public-schema USAGE true. Health version20261029090000 absent from
ledger. Source598 normalized versions, remote448, pending155, remote-only5:
20261029135227,20261029135317,20261029135346,20261029135430,20261030153442.
The unchanged runner's pure decideMigrationAction returns BLOCKED on those five
remote-only versions before any apply. No claim that155 historical SQL files were
never applied: only ledger mismatch is proven. No business rows were read.

CLI first rejected a missing --linked flag locally before SQL execution; corrected
flags then executed the same read-only transaction. Receipt envelope uses rows.
Two local result-parsing errors were corrected without re-querying Production.
Files: health-release-preflight-readonly.sql, health-release-preflight-live.json,
health-release-readiness.json. No DDL/DML, schema reload, ledger repair, new workflow
run, grant change or Promote was performed in this follow-up. Main7346840 and project
Production target f1299e3 reverified live; release worktree still clean.

Narrow Change Map / owner decision, NOT implementation authority:
- Resource: public.platform_health_database_probe(), ownerPlatform, consumer the
  existing /api/health route; no Product/Kernel or UI contract change.
- Existing reviewed artifact: supabase/migrations/20261029090000_platform_health_rest_database_probe.sql;
  Git-blob SHA25646A11CFF0F380C957C55C118436FD1E3D23D9277BCBE2FEBDB15017E38AF5282.
  It creates one SQL STABLE SECURITY INVOKER function returning true, reads no tables,
  uses empty search_path, revokes default EXECUTE and grants EXECUTE only to anon.
- Root cause: missing health function; current full-release runner correctly refuses
  inconsistent migration history. This is NOT a CI false-positive or transient.
- Minimum proposed next batch: independent Platform/DB authority for that exact
  artifact and narrowly controlled executor work if necessary. Retain protected
  main/Linux runner, target/hash checks, transactional verification and explicit
  failure paths. Do not silently waive current guard policy; any control-policy
  change requires the owner's independent approval before implementation.
- Exclusions: no batch migration-up, no155-version apply, no fake ledger repair,
  no automatic import/port of5 missing migrations, no UI/business/role/RLS/Attendance
  V2 changes. The five versions remain a documented unresolved release condition.
- Verification before any authorized cutover: exact artifact parse/atomicity/ACL,
  correct-target/hash/main positive and denial checks, fresh metadata, app health,
  existing read-only auth/denial smoke. Unrelated failing baseline pages remain
  findings; health success alone is not full smoke or Preschool Go-Live PASS.

Decision remains HOLD. Existing code-only authority does not authorize DB mutation
or changing a migration control to permit this feature. Await explicit scoped owner
approval for the Platform/DB batch; no further Production mutation while held.

### Health-only executor — owner-approved batch, PR476

Owner approved the separate health/Platform batch and reiterated: health503 → safe
executor → real health/smoke → only then consider Promote. No wider ledger cleanup.

PR https://github.com/bellaspahcm/bella-ai-platform/pull/476, head d19fcb828 (exact
SHA checked live before merge). Adds three files: a manual Production-environment
health-only workflow, scoped executor and focused tests. Original deploy-production
workflow, full-ledger guard and approved migration blob remain unchanged. The new
executor explicitly does not claim the full ledger guard passed. Its only permitted
ledger mutation is the real, atomically executed health version; the five remote-only
and remaining pending versions are untouched.

Controls: existing main/Linux/target checks, remote main SHA and exact artifact hash;
TLS certificate verification; DB current_user=session_user=database owner with
required schema/ledger privileges; ledger table lock; fail closed if target exists;
verify definition/owner/ACL and unexpected inherited anon privileges; insert only the
health version; transaction commit followed by independent catalog/ledger read-back.
Unknown COMMIT outcome stops with an inspection requirement. Anonymous role's
existing NOINHERIT SET ROLE members authenticator, cli_login_postgres and
supabase_storage_admin were observed; their memberships are not changed and access
through assuming anon is not claimed absent.

Validation: native PostgreSQL17 isolated synthetic cluster PASS, 10 scoped checks
including exact blob, ACL, anonymous call, fault rollback, two concurrent requests,
ledger scope, default-grant rejection, wrong executor and inherited-role rejection;
7 Jest tests PASS, ESLint PASS, YAML parse + bash -n PASS. Independent review layers
found issues in identity, inherited ACL, health response and failure tests; resolved
and re-reviewed. An initial native fixture failed because the deliberately wrong role
could not resolve the ledger schema, then fixture schema-USAGE was corrected; the
subsequent run passed. Earlier missing local postgres.bki and Windows pipe failures
were fixture/environment findings, with temporary processes and files cleaned up.
See health-probe-isolated-rehearsal.json. GitHub CI pending; Production DB has not
been changed by this batch. Candidate authenticated browser/complete smoke and
Production health remain NOT_PROVEN/FAIL respectively; no Promote.

TLS follow-up: pg8.23 URL sslmode overrides an explicit SSL object (empty object currently defaults to certificate validation). Executor now validates URL first, removes only permitted sslmode parameter and passes rejectUnauthorized=true explicitly. Tests instantiate real pg.Client for default/require/verify-full and confirm effective config; 7/7 Jest and ESLint PASS, scoped review no findings. New PR head c5d1477139a217ccd7bafc9cc7d661679963bf86; CI restarted. Native PG transaction proof remains applicable because only connection configuration changed; Production TLS handshake remains NOT_PROVEN until the protected workflow runs.


Final PR476 head0280c687343728b70b149559c982f319c31af509 adds an eighth focused regression: a successful COMMIT followed by failed read-back is explicitly reported as committed-but-unverified and never called a rollback. 8/8 Jest PASS. Runtime executor unchanged from the native PG17 rehearsal; CI restarted for test-only delta.


### Health run failure and bounded diagnostics

Health-only PR476 merged as2bc242c5894aee57a30ec9932b21d1217ea10d22. Protected
run41378298249 failed in the executor with a generic sanitized error. Immediate
read-only catalog verification found zero matching health functions and zero health
ledger rows, so the attempted migration was not committed. No retry was issued.

PR477 adds a fixed-stage / sanitized-code diagnostic and a workflow choice with
preflight defaulting to BEGIN READ ONLY and explicit apply mode. It preserves target,
main, hash, TLS and environment protections. The preflight reports only booleans for
principal/schema/ledger/ACL state and rolls back. Local PGlite read-only and stale
state tests PASS, focused Jest12/12 and ESLint PASS, YAML/shell PASS, independent
review completed. Transaction/ACL executor block remained byte-identical to the
native PG17-tested source (SHA256 693a8a32893d195eac3a09f2bd56c3bbf90b4b8edd40e44590956a32b795cf58).

PR477 merged as295bcf70152838521c4d2750b81572d06087fb29 after the four actual required
checks, affected unit tests, security/build/baseline and Vercel Preview PASS. The
automatic Real Database Business E2E was queued behind an unrelated main AutoMove
run at merge; it is PENDING, not PASS. Repo search found no business consumer of
this health-only executor. No required check or running workflow was disabled.
Protected run41379422227 is mode=preflight; it performs no DDL or ledger write. Do not
retry apply until the failure cause is established and safety conditions rechecked.
Production Promote remains HOLD.

### Health-only production receipt — 2026-11-02
- Supabase public root CA supplied by user; SHA-256 fingerprint `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`. Scoped runner trust change merged PR #478, `b3ccd5903b9ef03395e91be88e30c2a424878992`; TLS verification remains enabled.
- Focused executor tests: 12/12 PASS. Protected read-only preflight run 41384943287 PASS; health function and version absent before apply.
- Health-only run 41385082928 PASS: migration `20261029090000` applied, recorded, and executor read-back verified; no other migrations applied by this runner.
- Production `/api/health`: HTTP 200, `healthy`, `production`, database `ok`, observed at 2026-11-02T03:50:29Z.
- No Promote. Candidate authenticated smoke NOT_PROVEN; Preschool Go-Live NOT_READY. Existing full-ledger release guard is unchanged; this receipt does not certify it or other DB permissions.
