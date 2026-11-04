# Preschool — audit luồng vận hành, bảo mật, phân quyền và kiến trúc

Ngày đánh giá: 31-10-2026 (Asia/Saigon). **Audit source/local đã hoàn tất. Kết luận vận hành toàn bộ: `BLOCKED` bởi các lỗi dưới đây; Real Auth/DB/RLS, Browser và Production hiện tại: `NOT_PROVEN`.**

Phát hiện **13 nhóm vấn đề: 9 P1 và 4 P2**. P1 cần giải quyết trước khi dùng luồng bị ảnh hưởng với dữ liệu thật; P2 cần xử lý để bảo đảm tính đúng đắn và khả năng kiểm chứng. Chưa xác nhận sự cố khai thác hoặc rò rỉ trên Production. Không có thay đổi giao diện, chức năng hoặc quyền hệ thống trong đợt audit này.

## Phạm vi và quyền thực hiện

- Yêu cầu: audit toàn bộ luồng vận hành Preschool; không thay đổi giao diện và chức năng.
- Route: direct single-agent, audit chỉ đọc. Vai trò thực hiện: Lead, QA, Security & Reliability; không có Builder hoặc Factory run.
- Source: `feat/education-curriculum-lesson-plans`, commit `a2772b9f4ecfc06e33323ba81fa035c753ddea41`; working tree sạch khi bắt đầu.
- Trong khi audit, checkout được thay đổi bên ngoài sang `main` tại `f1299e3138f3700062a1ed84271db315737b0071`. Hai commit có cùng tree `9fcffb0c22c83d2ed3acbd94939e790e2ede12b4`, `git diff --quiet <initial> <final>` exit 0; source không drift nên tái sử dụng bằng chứng theo nội dung. Audit không chạy checkout/commit/merge. [source-binding.json](source-binding.json) giữ cả hai revision; inventory/hashes kết thúc bind source hiện tại.
- Cho phép: đọc source/contracts/migrations/config, chạy kiểm tra local an toàn, ghi báo cáo và bằng chứng audit trong thư mục này.
- Không thực hiện sửa ứng dụng, schema, Auth/RLS/ACL, dữ liệu thật, commit/push/merge/deploy. Không dùng service-role để thử nghiệp vụ trên remote DB.
- Architecture change gate / migration plan: `NOT_APPLICABLE` cho thay đổi vì chỉ tạo tài liệu/bằng chứng; việc audit kiến trúc và migration hiện có vẫn nằm trong phạm vi.
- Nguồn thẩm quyền: Constitution, Education Constitution, Operational Readiness SOP, Preschool Authorization Contract và các contract nghiệp vụ hiện hành.
- Bằng chứng static/unit, Real Auth/DB/RLS, browser và Production được đánh giá riêng; unit PASS không chứng nhận vận hành hoặc Go-Live.

## Tiêu chí audit

Theo từng bước: role → UI/action → API/use case → canonical contract → persistence/read-back → tenant/branch/resource authorization → failure/retry/audit trail → bằng chứng.

Luồng: truy cập Product và login; cơ sở/lớp/giáo viên; tuyển sinh và hồ sơ Student 360; điểm danh/đón trả; care/dinh dưỡng; học tập/giáo án/đánh giá; Portal/phụ huynh/thông báo; học phí/thu tiền/đối soát; lịch/cơ sở vật chất; work queue/analytics/AI; kiểm soát kiến trúc và phục hồi.

## Kết quả kiểm chứng

| Kiểm tra | Kết quả thực tế | Giới hạn |
| --- | --- | --- |
| Inventory bốn cây source | 406 file; 245 file source TS/TSX ngoài tests; 22 dashboard pages; 42 nhóm route API | Inventory toàn bề mặt; đọc sâu theo luồng và rủi ro, không tuyên bố đã duyệt thủ công từng dòng của mọi file. Portal UI và lớp Auth/Proxy/shared được đọc bổ sung theo dependency. |
| Existing Education local regression | **137 suites / 2.009 tests PASS**, exit 0 | Mock/static/local; cấu hình Supabase tổng hợp. |
| Product conformance bổ sung | **3 suites / 23 tests PASS**, exit 0 | Contract mocks, memory repository/event bus, extension sandbox; không phải kernel Real DB conformance. Tổng hai run Education an toàn: **140 suites / 2.032 tests PASS**. |
| Auth/containment/shared contract bổ sung | **4 suites PASS, 2 suites FAIL; 58 tests PASS, 2 FAIL**, exit 1 | Hai lỗi được phân loại bên dưới; giữ nguyên kết quả FAIL. |
| Chín diagnostic probes | **1 suite / 9 probes tái hiện thành công**, exit 0 | Các assertion xác nhận hành vi lỗi hiện có; không phải chín nghiệp vụ đã PASS hoặc chứng nhận bảo mật. |
| Education typecheck | `node node_modules/typescript/bin/tsc -p tsconfig.education.json --noEmit --incremental false --pretty false`: **PASS**, exit 0 | Có thể đi qua dependency TypeScript; không kiểm chứng dữ liệu, SQL hoặc runtime. |
| AST source scan | Không thấy import Healthcare/cross-industry trong phạm vi; không thấy import Education internals ngoài contracts; **1 explicit `any`** | Scan import/type không chứng nhận public-contract compliance của truy vấn DB ở API/UI. |
| Real Auth/DB/RLS, rollback/race, Browser E2E | **NOT_RUN / NOT_PROVEN** | Các suite integration có thể seed, tạo/xóa Auth và ghi DB. Đợt audit chỉ đọc chưa có target/fixture authority được xác minh để chạy chúng. Không thấy listener tại các cổng local đã kiểm tra: 3000, 3001, 5432, 54321, 15421, 15440. Không khởi tạo hoặc thay cấu hình môi trường. |
| Production, backup/restore, load/soak, CI đang chạy, required-check/branch protection trên remote | **NOT_PROVEN** | Không truy cập hoặc thay đổi Production/remote trong đợt này. |

23 suite trong inventory đầu tiên được loại khỏi run 137 theo selector DB/integration/conformance. Sau khi kiểm tra dependency, ba Product conformance suite an toàn được chạy riêng và PASS như bảng trên; **20 suite còn lại chưa chạy**, không tính là PASS hoặc SKIPPED của lần chạy. Ngoài ra còn có các security/finance integration suites và Playwright trong `tests/products/bella-education/` và `e2e/` chưa chạy. Đây là giới hạn bằng chứng, không phải miễn trừ các gate trước triển khai.

Hai lỗi của đợt bổ sung:

1. `preschool-containment.test.ts`: HTTP loopback gặp `connect EACCES 127.0.0.1:<ephemeral-port>` — **ENVIRONMENT** tại sandbox, không phải bằng chứng endpoint sai. Các kiểm tra gọi handler không thay thế HTTP proof còn thiếu.
2. `current-actor-contract.test.ts:79`: so sánh nguyên chuỗi LF với SQL có CRLF — **TEST_PORTABILITY / FIXTURE_FORMAT**, không phải bằng chứng ACL sai. Kiểm tra byte riêng xác nhận file SQL có 55 CRLF; chuỗi REVOKE tìm thấy sau chuẩn hóa CRLF→LF. Không sửa SQL/test, không đổi FAIL thành PASS.

Bằng chứng: [inventory.json](inventory.json), [local-summary.json](local-summary.json), [conformance-summary.json](conformance-summary.json), [security-summary.json](security-summary.json), [probe-summary.json](probe-summary.json), [static-surface.json](static-surface.json), [diagnostics.json](diagnostics.json), [source-hashes.json](source-hashes.json). Raw Jest JSON/log, typecheck log và mã probe nằm cùng thư mục.

## Phát hiện ưu tiên

### F01 — P1 — Xác nhận nhập học có thể báo đã thu học phí dù chứng từ không ghi được

**Confirmed source + diagnostic probe.** [`confirm-admission/route.ts:72`](../../../src/app/api/education/enrollments/confirm-admission/route.ts#L72) dùng service-role; dòng 122 dùng billing period UUID mẫu khi không có kỳ; dòng 147/183 dùng số tiền fallback/cố định 5.700.000. Các insert/update invoice, line item và payment được await nhưng không kiểm tra `error`. Sau đó dòng 265 cập nhật trực tiếp `edu_enrollments` sang active và trả success.

- Trigger: một trong các ghi tài chính bị lỗi; hoặc kỳ thu/catalog chưa đủ; hoặc xác nhận một enrollment chưa active.
- Probe `F01`: giả lập cả ba ghi invoice/line/payment trả lỗi 42501; endpoint vẫn trả HTTP 200/success và thực hiện update enrollment.
- Impact: nhập học/đã thanh toán có thể được xác nhận khi không có khoản thu hợp lệ; có thể ghi một phần hoặc thu lặp khi retry/concurrent request. Trạng thái enrollment/course được ghi trực tiếp, bỏ qua canonical Enrollment contract và recovery/event workflow. Không có bằng chứng trong nhánh này cho fee catalog, payment allocation hay atomic transaction.
- Owner/layer cần xử lý: Product Admission + Finance, qua contract hiện có; nếu cần thay public contract/schema thì giữ boundary riêng. Đề xuất: một command có validation trạng thái, phí/kỳ canonical, operation key, transaction/recovery và read-back; kiểm tra lỗi từng dependency. **Chưa thực hiện.**
- Chứng minh sau sửa: lỗi invoice/line/payment/activation không để trạng thái nửa vời; retry/race không nhân khoản thu; số tiền khớp catalog và kỳ; caller/branch/tenant được authorize tại final write.

### F02 — P1 — Đánh giá/khen thưởng trả thành công thiếu persistence; kết quả thiếu có thể hiện thành “đạt”

**Confirmed source + hai probes.** [`grades/route.ts:416`](../../../src/app/api/education/grades/route.ts#L416) khởi tạo ID `obs-${Date.now()}` rồi bỏ qua lỗi insert; nhánh `issue_award` tại dòng 467 chỉ tạo object `award-*`, không ghi DB. Probe chứng minh lỗi INSERT vẫn nhận HTTP 200 và award success không gọi persistence.

GET cũng mặc định các domain thiếu thành `dat` (dòng 322–326); unknown progress status thành `dat` (182); month được trả lại nhưng không dùng để lọc truy vấn. Registry chỉ lấy trang đầu limit 50, chưa có full pagination ở màn này. Thiếu dữ liệu, lỗi read hoặc lựa chọn tháng không bảo đảm phản ánh đúng kết quả trẻ.

- Impact: giáo viên mất quan sát/khen thưởng sau refresh nhưng đã thấy success; phụ huynh/quản lý có thể hiểu dữ liệu thiếu là kết quả đạt. Metadata `PARENT_SHARED` được gán trong response không chứng minh consent/publication.
- Owner: Product Learning/Assessment. Đề xuất: chỉ success sau canonical persistence/read-back; xử lý trạng thái unknown/missing và ngày/tháng theo contract đã duyệt; không tự phát minh quy tắc chấm điểm. Chứng minh lỗi DB, denied actor, trẻ ngoài lớp, refresh/read-back và hơn 50 trẻ.

### F03 — P1 — API danh sách hội thoại mở metadata toàn tenant cho mọi user đã đăng nhập

**Confirmed source + probe.** [`communication/threads/route.ts:25`](../../../src/app/api/education/communication/threads/route.ts#L25) chỉ kiểm tra Auth subject/profile/tenant rồi tạo service-role client. Query chỉ lọc tenant và ACTIVE, không kiểm tra role, guardian, student relationship hoặc teacher assignment.

Probe dùng profile role `parent`, không có guardian binding, vẫn nhận HTTP 200 và metadata thread của gia đình khác trong tenant. Đây là proof của route với dependency tổng hợp; không phải proof dữ liệu khách hàng đã lộ.

- Impact: tiêu đề hội thoại, student/guardian IDs, thời điểm hoạt động và các aggregate có thể vượt quyền gia đình/lớp trong cùng trường.
- Owner: Product Parent Communication. Đề xuất: read contract theo caller, quyền gia đình/lớp/branch và fail closed trước privileged read; test allowed/denied trên cùng session.

### F04 — P1 — Gửi tin nhắn không xác minh thread thuộc caller/resource; dùng Auth ID làm Party ID

**Confirmed source + probe; cross-tenant DB effect là Deduced, chưa chạy DB.** [`communication/messages/route.ts:68`](../../../src/app/api/education/communication/messages/route.ts#L68) nhận `threadId` UUID hợp lệ rồi ghi response trực tiếp, không load/authorize thread. Khi tạo thread mới, dòng 84 dùng `guardian_party_id: user.id` với comment placeholder; dòng 101 cũng dùng Auth ID làm sender Party.

Probe với `admin_staff` và thread UUID tùy ý trả 200, xác nhận không có SELECT thread ownership trước ghi. FK ở `20260909000056_p61_parent_communication.sql:114` chỉ trỏ `thread_id → id`, không bao gồm tenant. Vì writer dùng service-role, nguồn hiện có không bảo đảm ngăn row tenant A tham chiếu thread tenant B nếu UUID đó tồn tại; chưa tuyên bố khai thác DB thành công.

- Impact: tin nhắn sai luồng/tenant relationship, sai danh tính người gửi/người giám hộ; API chat mới không tuân theo giới hạn chat unavailable của Authorization Contract v1. Owner cần xác nhận contract mở chat nếu có phê duyệt bổ sung; việc endpoint tồn tại không tự cấp quyền.
- Đề xuất: resolve Auth→Party bằng public contract, kiểm tra thread/student/guardian/assignment đúng tenant và action trước mọi write; không dùng placeholder. Kiểm chứng direct REST/RPC/HTTP và cross-tenant FK rejection trong môi trường được phép.

### F05 — P1 — Giáo án/dinh dưỡng cho staff thao tác toàn tenant bằng service-role, thiếu assignment scope

**Confirmed source + probe giáo án.** [`curriculum/route.ts:131`](../../../src/app/api/education/curriculum/route.ts#L131) và [`nutrition/weekly-menu/route.ts:148`](../../../src/app/api/education/nutrition/weekly-menu/route.ts#L148) cho `admin_staff`/`teacher` mutation và chuyển sang privileged client. Không resolve teacher Party/assignment/branch/course hoặc quyền duyệt/phát hành; các read cũng thiếu role/resource predicate tương ứng.

Probe giáo viên `admin_staff` không có assignment vẫn ghi giáo án cho course tùy ý, `status: APPROVED`; service tự gán `approved_by = actorId` ở `curriculum.service.ts:288`. Route Grades dùng cơ chế role/service-role tương tự cho ghi quan sát.

- Impact: role tên “giáo viên” trở thành quyền sửa/xóa/duyệt nội dung ngoài lớp được giao; RLS của caller không còn bảo vệ đường ghi này. Thêm `teacher` alias không thay thế mapping Product đã được duyệt.
- Owner: Product Curriculum/Nutrition/Learning. Đề xuất: quyết định quyền tác giả/duyệt/phát hành có thẩm quyền, enforce resource scope và final command; thử giáo viên có/không assignment, assignment hết hạn, course/branch khác và approval riêng.

### F06 — P1 — DB/RPC thông báo chưa thực thi quyền admin/toàn bộ branch; idempotency khác contract

**Confirmed source contract mismatch; live ACL/RLS NOT_PROVEN.** `20261030220000_preschool_school_announcements.sql:83` publish RPC chỉ lấy tenant, validate payload rồi insert; không có role admin, Product và quyền trên mọi branch active. Migration này grant INSERT table + EXECUTE RPC cho `authenticated` (136–138). Policy mới tại [`20261031090000_fix_edu_announcements_rls_and_portal_read.sql:18`](../../../supabase/migrations/20261031090000_fix_edu_announcements_rls_and_portal_read.sql#L18) chỉ so tenant/service-role.

- Theo chuỗi SQL trong repo, active non-admin cùng tenant có thể đi thẳng REST/RPC, vượt role guard ở Next route. Cần catalog + JWT thật để xác định effective grant/policy trên từng target; không suy trạng thái Production từ migration file.
- Publish cùng request ID nhưng nội dung khác trả row cũ + `duplicate=true` (migration 20261030220000 dòng 116), trái yêu cầu conflict tại Authorization Contract mục 5/10. Race cùng ID có unique constraint nhưng không có recovery cho cùng payload ngay trong command.
- Các policy `FOR ALL` mới cho enrollment/care/menu/curriculum cũng cần kiểm chứng role/resource boundary và effective table grants; tenant isolation đơn thuần không chứng nhận authorization.
- Owner: Product Announcement + DB/security owner. Đề xuất: thực thi action/branch scope tại DB surface và direct-access policy; bảo toàn retry semantics. Mọi sửa RLS/ACL cần authority riêng; audit này không đổi chúng.

### F07 — P1 — Finance fallback khi thiếu RPC có thể mở dữ liệu ngoài branch

**Confirmed source + probe.** [`preschool-finance.repository.ts:158`](../../../src/products/bella-education/finance/repositories/preschool-finance.repository.ts#L158) rơi về đọc table khi nhận `PGRST202`/function-not-found. Ở dòng 338–342, mặc định trả toàn bộ students/invoices/payments; chỉ thu hẹp nếu branch có course assignment. Nhánh `ALL` cũng đọc table trực tiếp.

Probe thiếu RPC + branch tùy ý không có assignment nhận student toàn tenant. Route Finance còn chỉ deny branch khi `accessRows.length > 0` (`finance/route.ts:118,173`); rỗng hoặc lookup lỗi không fail closed tại guard này. SQL branch RPC hiện có có final actor/branch checks; fallback chính là đường không còn invariant đó. `NODE_ENV=test` bỏ privileged client, vì vậy unit test thông thường không phản ánh toàn bộ production path.

- Trigger cụ thể: schema/RPC thiếu hoặc PostgREST schema cache không thấy function; quyền branch không resolve; branch chưa có assignment.
- Impact: schema drift có thể trở thành mở rộng quyền đọc thay vì unavailable. Không xác nhận target hiện tại đang thiếu RPC.
- Owner: Product Finance. Đề xuất: fail closed cho missing contract và access lookup, bỏ suy luận empty→all; chỉ giữ fallback nếu có approved contract và kiểm chứng cùng boundary. Test missing RPC, empty/failed access, branch không mapping và payer không có student binding.

### F08 — P1 — Trang Scheduling dùng actor/tenant mẫu và chứa thao tác xóa theo toàn tenant

**Confirmed source, không bấm nút/ghi DB.** [`scheduling/page.tsx:52`](../../../src/app/dashboard/education/scheduling/page.tsx#L52) dùng tenant/manager/teacher/classroom UUID cố định, ngày mẫu; tạo browser Supabase client và gọi repository trực tiếp. `handleSeedShift` dòng 162 xóa shift assignments, leave requests, substitutions và communication exceptions theo DEFAULT_TENANT_ID trước seed; nút nối handler tại dòng 516.

- Impact: màn không đại diện scope của user hiện tại; nếu DB cho phép, nút demo có thể xóa dữ liệu của tenant mẫu; nếu RLS từ chối thì luồng vẫn không vận hành đúng. Chưa kiểm chứng effective DB permission hoặc primary-menu reachability. Route vẫn tồn tại trong source.
- `SUPABASE_SERVICE_ROLE_KEY` được nhắc trong client source không chứng minh secret đã được bundle/lộ; audit không đưa ra kết luận đó.
- Owner: Product Scheduling. Đề xuất: xác định đây là prototype hay luồng vận hành, loại đường seed/destructive khỏi hành vi vận hành theo quyết định owner; dùng caller identity và contract hiện có. Không thực hiện thay đổi UI/chức năng trong audit.

### F09 — P2 — Lưu thực đơn tuần không atomic như mô tả

**Confirmed source + probe.** [`weekly-menu.service.ts:320`](../../../src/products/bella-education/care-wellbeing/nutrition/weekly-menu.service.ts#L320) update/insert master trước, rồi upsert days ở dòng 362. Lỗi days trả failure nhưng master đã đổi, kể cả `status=PUBLISHED`; không transaction hoặc compensating write. Các ngày bị bỏ khỏi input không được xóa/archive nên có thể giữ chi tiết cũ.

Probe chứng minh thứ tự master PUBLISHED → days failure và không có rollback call. Không phải rollback test trên PostgreSQL.

- Impact: header/kỳ/trạng thái phát hành và nội dung bữa ăn không cùng phiên bản; UI báo lỗi nhưng dữ liệu đã đổi một phần.
- Owner: Product Nutrition. Đề xuất command atomic và read-back toàn bộ tuần, quy tắc thay thế ngày rõ ràng, kiểm chứng rollback/retry/race trong DB an toàn.

### F10 — P2 — Update/delete không trúng bản ghi vẫn báo thành công

**Confirmed source + probe.** `curriculum.service.ts:172–180,292–300` và delete chỉ kiểm tra `error`, không row count/returning/read-back. Weekly menu master update cũng có kiểu kiểm tra này.

Probe curriculum với `data: [], count: 0, error: null` vẫn trả success. ID không tồn tại, đã bị xóa hoặc ngoài tenant có thể hiện đã lưu; tenant filter vẫn chặn ghi sai tenant, vì vậy đây không phải proof cross-tenant write.

- Đề xuất: xác nhận đúng một canonical row/version sau command; phân biệt not found/conflict/unavailable và không báo success cho zero rows.

### F11 — P1 — Workspace My Class hiển thị điểm danh/đón trả/chat chỉ trong state trình duyệt

**Confirmed source, Browser NOT_RUN.** [`my-class/page.tsx:591`](../../../src/app/dashboard/education/my-class/page.tsx#L591) khởi tạo roster từ `INITIAL_STUDENTS_ROSTER`. `handleToggleAttendance`/bulk chỉ `setStudents` (679/707); `handleExecuteHandover` tự đánh dấu handed-over và cho fallback “Phụ huynh chính” (718); chat chỉ append local array (739). Các call API ở trang chủ yếu là Copilot, không ghi nghiệp vụ vừa nêu.

- Impact: thao tác trông như đã điểm danh/bàn giao/gửi tin nhưng không tạo canonical event/record; refresh mất thay đổi, không có authorization/read-back của việc đón trẻ. Không suy từ API Attendance ở màn khác rằng màn này đã tích hợp.
- Đây là route ngoài primary menu manifest hiện tại; rủi ro áp dụng khi route được truy cập/mở cho vận hành. Chưa kiểm chứng browser reachability.
- Owner: Product Classroom. Đề xuất xác định trạng thái prototype và dùng đúng API/contract của luồng vận hành trước enable; audit không đổi màn hoặc nối chức năng.

### F12 — P2 — Student 360 Communications đọc Daily Care bằng identity legacy

**Confirmed source/canonical mismatch.** [`enrollments/[id]/communications/route.ts:85`](../../../src/app/api/education/enrollments/[id]/communications/route.ts#L85) lọc care theo `student_id`. Trong khi migration `20260927040000_preschool_daily_care_canonical_student_party.sql` đã cho `student_id` null và xác định `student_party_id` là identity canonical; DailyCareService và RPC save mới ghi bằng Party ID.

- Trigger: record care canonical có `student_party_id` nhưng `student_id=null`.
- Impact: tab sổ liên lạc trả 200/danh sách trống dù care đã ghi; không thể kết luận “chưa có dữ liệu” từ query này. Source trace chứng minh mismatch; chưa có DB read-back trong đợt audit.
- Owner: Product Student 360 read model. Đề xuất resolve Student→Party qua canonical contract và query đúng identity; không backfill identity bằng UUID phỏng đoán. Test legacy/canonical record cùng student và child khác.

### F13 — P2 — Guard kiến trúc PASS có phạm vi hẹp và chưa bắt explicit `any`

**Confirmed source + executed architecture suites + AST.** [`bella-education-architecture.test.ts:16`](../../../src/products/bella-education/__tests__/bella-education-architecture.test.ts#L16) chỉ scan Product root và chỉ `.ts` (29), không API route/UI `.tsx`. Baseline filter dòng 88 chỉ kiểm tra signature tồn tại, không tiêu thụ/so count hiện có. Scan AST phát hiện `PreschoolDomainEvent<T = any>` tại `analytics/events/preschool-analytics-events.ts:26` dù bộ architecture tests vẫn PASS.

- Impact: không thể dùng architecture green để khẳng định mọi UI/API đi qua public contracts hoặc toàn scope tuân strict typing. F01/F08 là ví dụ đường truy cập nằm ngoài scan của guard này.
- Các Architecture Guard/CI/freeze surfaces khác vẫn được giữ; phát hiện này không có nghĩa toàn hệ thống không có guard.
- Owner: Architecture/Engineering Controls. Đề xuất đưa bằng chứng gap cho owner, xử lý theo scope kiểm soát riêng; không nới baseline hay tự sửa guard để làm xanh.

## Bản đồ vận hành và ownership

Product Preschool chịu trách nhiệm readiness từng luồng; Platform sở hữu Auth/tenant/Party/org-unit access; Education sở hữu Course/Enrollment/Student/Attendance public contracts; Product Finance sở hữu chứng từ/học phí; UI chỉ tiêu thụ dữ liệu/hành động. Không có lớp Healthcare tham gia.

| Principal | Boundary theo nguồn đã đọc | Chênh lệch/giới hạn cần giữ |
| --- | --- | --- |
| `admin` Preschool active | Auth subject/profile/tenant khớp; quyền branch/resource và RLS vẫn áp dụng. Portal mint và school-wide bulletin có predicate riêng. | Admin role đơn lẻ không chứng minh mọi thao tác; F01/F06/F07. |
| `admin_staff` | Teacher Attendance chỉ trong lớp/ngày/assignment/confirmation/identity được chứng minh; không tự có quyền tuyển sinh, Portal mint, broadcast hoặc pickup từ Attendance identity. | Care hiện held 503; Curriculum/Grades/Communication mới cấp quyền rộng hơn scope assignment ở F04/F05. |
| `parent` | Portal token hợp lệ cho đúng guardian/student; không staff mutation/mint/broadcast. Parent login daily route đang held. | Threads GET thiếu role/guardian predicate ở F03. |
| `accountant` | Finance code cho phép role này; canonical Finance branch command đòi quyền branch theo relationship và action. | Không suy thành quyền Care/Portal/Enrollment; Finance fallback F07 cần fail closed. |
| `super_admin`, `owner`, alias khác | Không có blanket Preschool authority từ tên role; mapping phải theo từng approved contract. | Một số legacy Admission/Handover/Finance code map rộng; authority tương ứng cần đối chiếu trước runtime acceptance, không tự coi là admin v1. |
| `student`, `hr`, `ktv`, `ktv_lead`, role thiếu | Không có staff action trong Authorization Contract được đọc. | Threads GET chỉ đòi authenticated profile nên thiếu denial tương ứng. |
| Anonymous hoặc service identity | Anonymous không là staff; bearer Portal có scope riêng; service worker/server command có trust contract riêng. | Service credential không thay phép kiểm tra caller/action/resource; mocks không chứng minh RLS. |

| Luồng / vai trò | UI → backend / canonical owner | Quan sát hiện tại | Readiness toàn luồng |
| --- | --- | --- | --- |
| Login, active user/tenant | Proxy/dashboard → `supabase-server` → current-actor RPC | Auth validation, subject reconciliation và active state có source/unit proof; dev mock path riêng tồn tại, một số endpoint dựa duy nhất getCurrentUser | `NOT_PROVEN` với Auth thật; không dùng development bypass làm security proof |
| Cơ sở / admin | branches workspace → `/branches/manage` → caller OrgUnit contract | Role/Product/identity guard; body bounded, caller scoped; tests local PASS | `NOT_PROVEN` DB/RLS/browser |
| Course catalog/create / admin | courses workspace → `/courses?view=catalog`, `/courses/catalog`, POST courses → canonical course contract | Luồng catalog và canonical creation riêng, có request context/deny tests; default legacy course read còn tồn tại | `NOT_PROVEN` runtime; không coi mọi projection là tương đương |
| Giáo viên / admin | teachers + Teacher 360 → teachers APIs → Product confirmation/public teacher contracts | Role/Product guard và scopes có source/unit proof | `NOT_PROVEN` DB/browser; assignment route cũ POST/DELETE chủ động trả 503 |
| Tuyển sinh / admin | enrollments → EnrollmentContract hoặc AdmissionService tùy payload | Hai nhánh existing-student enrollment và admission orchestration; có operation key/recovery tests; confirm-admission tạo nhánh ghi mới F01 | `BLOCKED` phần xác nhận/thu phí; các nhánh còn lại `NOT_PROVEN` E2E |
| Student registry/360 / admin | student-registry + profile → caller Registry/Attendance contracts; tabs bổ sung dùng server clients | Base profile kiểm tra pagination/truncation; guardian read đi approved caller RPC; các tab mới có privileged reads; F12 identity mismatch | `BLOCKED` tính đầy đủ Communications; phần khác `NOT_PROVEN` runtime |
| Điểm danh / admin hoặc assigned admin_staff | attendance → request-context/teacher identity → scoped attendance command + roster RPC | Kiểm tra ngày VN, tenant/course/branch, teacher identity/assignment; event/projection command có source và tests | `NOT_PROVEN` real JWT/transaction/RLS; không suy từ màn My Class |
| Đón trả / authorized staff | attendance/handover → Product atomic handover command | Resource preflight và final SQL command có source; cần current-actor/teacher/pickup relationship denial trong DB | `NOT_PROVEN` real handover; My Class riêng bị F11 |
| Care / admin | care → care/bulk/classes → roster contract + caller save-care RPC | Admin scoped, teacher held 503, ngày hiện tại, target validation trước ghi, health policy unavailable; bulk legacy actions còn nhiều bước ghi | `NOT_PROVEN` DB atomicity/concurrency/denial; không mở teacher hoặc health từ audit |
| Dinh dưỡng / staff | care/nutrition editor → weekly-menu → NutritionService/tables | Persistence implementation có thật nhưng scope F05, partial-write F09, false-success risk F10 | `BLOCKED` các điều kiện nêu trên |
| Giáo án / staff | curriculum/editor → curriculum API → Product tables | Scope/approval F05, zero-row success F10 | `BLOCKED` |
| Học tập / staff | grades → grades API | F02 false persistence/default assessment; resource scope F05 | `BLOCKED` |
| Learning workspace | learning page | Có banner minh họa và thông báo chưa lưu/xuất bản rõ; chưa nối dữ liệu thật | `BLOCKED` nếu yêu cầu vận hành capability này; không phải false persistence mới |
| My Class / giáo viên | my-class → local state + Copilot | F11; không phải integration của các API điểm danh/care/handover đã tồn tại | `BLOCKED` cho nghiệp vụ thật |
| Thông báo / admin → Portal | announcements → DB RPC → Portal feed | HTTP role checks, stable request ID; DB role/resource/idempotency F06 | `BLOCKED` boundary được nêu; delivery trên Portal `NOT_PROVEN` |
| Chat staff / parent | communication threads/messages; legacy portal chat | F03/F04; UI conversation state có dữ liệu/sample mapping; Portal daily-read token chặn chat | `BLOCKED`; không dùng chat mới để tuyên bố đã mở quyền chat v1 |
| Parent login / token portal | parent-inbox → parent-daily; token issuance → signed daily-read → Portal RPC | Parent daily login route trả 503; token admin-only/course+guardian selection, HMAC/expiry/24h, current relationship checks có source/unit proof; new token read-only | Login daily `BLOCKED` theo hold chủ động; token Portal `NOT_PROVEN` DB/browser, per-token revocation chưa chứng minh |
| Học phí/thu tiền / admin, accountant | finance → branch RPC/atomic services; Student360 finance read | Final DB branch command có checks; fallback F07; confirmation F01 bỏ qua allocation/reconciliation | `BLOCKED` các đường ảnh hưởng; full Finance-to-ledger/notice read-back `NOT_PROVEN` |
| Work queue / admin | work-queue → review/incident persistence | Strict role/Product, expectedUpdatedAt/concurrency fields, request validation, optimistic conflict path có tests; production adapter khác test | `NOT_PROVEN` DB/RLS/final state |
| Scheduling | scheduling browser → tables/services | F08 fixed identity + destructive seed | `BLOCKED` |
| Facilities | facilities page → unavailable/disabled controls | Chưa có UI→API write chain được enable; hiển thị unavailable, không ghi thật | `BLOCKED` nếu đòi vận hành đầy đủ Facilities; không phải PASS vì service tồn tại |
| Dashboard/reports/AI | analytics → caller roster/branch projection; Copilot role/action checks | Analytics tách unavailable metrics và không tự điền số; Copilot không tự chứng minh canonical persistence/medical decision; report export một số action unavailable | `NOT_PROVEN` runtime, provider/privacy evidence và export integrity |
| Backup/restore/recovery | deployment governance/previous readiness pack | Không có restore thực hiện trong audit; admission/event/finance recovery tests local không chứng minh DR | `NOT_PROVEN` |

42 route files được liệt kê với methods/tables/RPC/imports tại [ROUTE_MATRIX.md](ROUTE_MATRIX.md). Table/RPC literal scan là chỉ dẫn truy vết, không phải danh sách đầy đủ dynamic contracts hoặc catalog DB hiện hành.

## 11 gate Education — áp dụng cho đánh giá hiện tại

Đây là audit existing capability; không phát sinh Product/Kernel/migration change gate mới. Mỗi gate dưới đây mô tả mức bằng chứng, không phải chạy đủ một bộ test mới để điền biểu mẫu.

| Gate | Bằng chứng / kết luận |
| --- | --- |
| 1 Architecture | Existing architecture/customization/extension suites PASS ở phạm vi local; AST không thấy cross-industry/internal imports; strict typing/control gap F13. Không kết luận architecture toàn bộ PASS. |
| 2 Public contract | Contract tests local PASS; direct mutation F01 và browser DB F08 phá chain ở các đường cụ thể. `FAIL` scoped source. |
| 3 Tenant isolation | Có selector/tenant negative unit tests; F04 cross-tenant relationship chưa được bảo đảm; actual DB tenant denial `NOT_PROVEN`. |
| 4 RLS/authorization | F03/F05/F06/F07 là source/probe findings. Effective live ACL/policy composition, direct REST/RPC denied paths `NOT_PROVEN`. |
| 5 Migration safety | Không áp migration và không có migration change trong audit. Review các SQL mới phát hiện F06 và thiếu resource-level predicates; replay/compatibility/backout `NOT_PROVEN`. |
| 6 Event-after-persistence | Canonical attendance/enrollment command/recovery tests local; F01 bypass workflow. Real transaction/event read-back `NOT_PROVEN`. Không thêm events cho menu/giáo án chỉ để đạt gate. |
| 7 Academic safety | F02 mặc định unknown→đạt không phải governed interpretation proof. Rule-governed academic behavior `NOT_PROVEN`; không tự thiết kế rule mới. |
| 8 Temporal provenance | Student360 đọc canonical attendance history, có truncation guard; lịch sử/corrections/failure recovery trong DB thật `NOT_PROVEN`. |
| 9 Rule governance | Có rule integration surfaces trong source; checksum/version của rules đang chạy và các interpretation mới `NOT_PROVEN`. |
| 10 Audit evidence integrity | Không có transcript/export/SHA read-back của lần này; export UI còn unavailable. `NOT_PROVEN`. |
| 11 Regression | 2.032 tests/140 suites Education local + Product conformance PASS; bổ sung security 58 PASS/2 FAIL, diagnostic probes 9; typecheck PASS. Không chạy full Healthcare/Logistics vì audit không đổi shared/kernel/consumer, không có ảnh hưởng mutation xuyên ngành. Full `npm run education:verify` bao gồm kernel Real DB chưa chạy. |

## Trạng thái các control surfaces

- **Defined:** Constitution/Education rules, Authorization Contract, freeze và public-contract boundaries đã đọc; giữ nguyên.
- **Automated / execution verified:** ba static Education architecture suites nằm trong run 137 suites; chỉ chứng nhận phạm vi thực sự scan. AST audit không sửa guard.
- **Configured:** `.github/workflows/architecture-guard.yml:115` wire Education CI qua scope router; các workflow test có disposable fixture logic. Việc có YAML không chứng minh chúng đã chạy/required trên revision này.
- **Git hook:** `core.hooksPath=.husky/_`; `.husky/pre-commit` gọi `scripts/architecture/git-pre-commit-guard.js`, comment nêu frozen Logistics scope. Không commit để thử hook và không suy hook này ngăn mọi lỗi Preschool.
- **Pre-tool hook:** cấu hình `.claude/settings.json` tồn tại; không có bằng chứng trong audit rằng hook đó intercept thao tác Codex. Không coi rule text hoặc file existence là enforcement.
- **Remote enforced / adversarially validated:** branch protection, CI required status, effective DB ACL/RLS và Production runtime chưa kiểm tra ở lần này.

## Bằng chứng lịch sử và các giả thuyết đã loại

- `docs/audits/preschool-full-audit-20261020/release-production-20261024/ROLLOUT_READINESS.md` ghi nhận các hold Production trước đây: Student RLS permissive, security/source reconciliation, backup/restore chưa chứng minh và Go-Live NOT_READY. Đây là quan sát lịch sử theo artifact; **không xác nhận còn tồn tại hoặc đã sửa trên Production ngày 31-10**. Không thay kết quả cũ bằng unit PASS mới.
- Không kết luận helper `edu_attendance_can_read_course` mới làm hỏng teacher Attendance: trace hiện tại đi `edu_preschool_roster_identity`/teacher scope riêng. Helper mới xuất hiện được gọi ở care save; chưa chứng minh teacher regression từ tên helper.
- Không gọi mọi service-role use là lỗi: Finance/handover/Portal có các trusted server command riêng. Findings chỉ nêu nơi source cho thấy thiếu final action/resource boundary, sai mapping hoặc bypass canonical path. Cần kiểm chứng DB thật cho các command đã có guard.
- Không kết luận lộ secret từ browser source chỉ vì nhắc tên env var; không mở/copy secret, token hay dữ liệu khách hàng vào evidence.

## Ưu tiên xử lý đề xuất — chưa triển khai

1. **P1 dữ liệu và trẻ:** F01/F02/F11 false success; F03/F04 privacy và identity; F08 destructive seed. Owner Product xác nhận chính xác các đường đang mở cho vận hành.
2. **P1 quyền và DB boundary:** F05/F06/F07. Chuẩn bị sửa nhỏ tại owner contract; RLS/ACL/public contract/shared controls cần đúng authority, không sửa theo kiểu fallback nâng quyền. Giữ UI/layout và business intent khi thiết kế remediation.
3. **P2 tính đúng đắn:** F09/F10/F12; ghi atomic/read-back đúng identity và trạng thái lỗi.
4. **P2 kiểm chứng:** F13 và test portability được owner controls xử lý ở scope riêng; tái chạy targeted checks sau thay đổi có thẩm quyền.
5. **Hoàn tất proof vận hành:** môi trường Non-Production đã xác minh target và fixture authority; real JWT các role, đổi tenant/branch/class/student/guardian trong cùng session, direct REST/RPC denial, failure/race rollback, UI refresh/read-back và cleanup receipts. Sau đó mới đánh giá Production bằng catalog/runtime/recovery hiện tại và quyết định release riêng.

**Seal của đợt audit:** hoàn tất đánh giá source/local trong phạm vi đã nêu và lưu bằng chứng; ứng dụng/schema/Auth/RLS/ACL/giao diện/chức năng không đổi. Không commit/push/merge/deploy; không chứng nhận Full Preschool hoặc Go-Live PASS.
