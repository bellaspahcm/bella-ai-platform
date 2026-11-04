# Batch2p — sửa môi trường regression local và phân loại lỗi còn lại

Đã xử lý được môi trường thực thi; chưa đạt full regression hoặc reseal. Owner đã duyệt riêng sandbox local trong cuộc trò chuyện, lưu nguyên câu trả lời và hash proposal tại `AUTHORITY.json`. Proposal gốc được giữ nguyên như snapshot trước phê duyệt; report này ghi kết quả thực thi sau phê duyệt.

Không sửa thêm Product, Kernel, migration source, test assertion, guard, selector hoặc baseline. `CURRENT_SOURCE_AND_RUNTIME.json` xác nhận 332 file frozen cũ và 10 file Care đã được build/Browser proof vẫn nguyên byte. Code Care chưa commit/push; không thao tác production hoặc ghi DB E2E.

## Môi trường đã sửa

Tạo project local độc lập `bella-preschool-regression-20261021`, xác minh Docker container label, marker, DB PostgreSQL 17, loopback URL và public schema rỗng. CLI thực tế 2.115.0, Docker server 29.7.2; image tag và image ID được lưu trong provenance. Không link remote project. Migration/seed tự động đều tắt.

Cổng 55430–55432 nằm trong Windows HNS excluded range, không có listener ứng dụng; đổi riêng sandbox sang 24430–24432 theo lựa chọn kỹ thuật tương đương, ghi `LOCAL_PORT_DECISION.json`. Không reset/reuse stack local cũ.

Provision đúng statement DDL lấy nguyên byte từ migration có sẵn, pin source/statement/bundle hash: Education 278 statements từ 17 nguồn, 25 tables; Healthcare thêm 419 statements từ 21 nguồn, 66 tables. Đây là reference schema cho regression, không chứng nhận tương đương production. Không chạy toàn bộ migration history, demo seed hoặc backfill dữ liệu; không sao chép DB dump/business data. R3 chỉ lấy prerequisite DDL cho schema rỗng, không giả lập 848 sealed mappings và không tuyên bố đã thực hiện historical cutover.

Manifest Healthcare sắp CREATE TABLE theo FK và thêm prerequisite UNIQUE lấy nguyên từ source trước composite FK. Bỏ các stub dependency tạm trong script recreate clinical orders; giữ provenance schema Phase B/C cho calculation ledger. Policy trùng có cùng token/predicate được giữ một lần; không sửa predicate để xanh. Những lần apply thiếu dependency/duplicate policy đều rollback ACKNOWLEDGED, raw receipt theo tên `schema-execution-*.json`; các bundle cũ được giữ riêng. Lựa chọn calculation schema này bộc lộ conflict bên dưới, không được coi là canonical profile đã chốt cho production.

Prerequisite quyền service-role bị thiếu ban đầu được bổ sung đúng migration `20260523030000_grant_service_role_schema_access.sql` trên sandbox sở hữu, không nới anon/authenticated. Đây là quyền fixture mà suite đã khai báo, không phải chứng nhận RLS/Auth. Fixtures chỉ tổng hợp: lấy UUID khai báo trong bootstrap/immutable tests, dùng tên giả; không copy tên thật hoặc record tương ứng. Bootstrap thêm encounter riêng theo prerequisite của repository suite. Lab được kiểm tra riêng trên sandbox sạch với user fixture có role hợp lệ; không mở global role `practitioner` và không giả nhận user đó có Auth identity.

Process test dùng env whitelist và local keys trong memory. Chặn TCP/fetch ra ngoài đúng API/DB sandbox, chỉ cho thêm named pipe của đúng parent tsx. `egress-guard-tests.json`: 6 controls PASS, gồm remote TCP/fetch, port khác và pipe khác bị từ chối, health request local thực tế 200. Không đưa key/DB URL vào evidence. Legacy tests có console ghi prefix key/row; vì vậy raw local stdout/stderr không lưu, chỉ structural command log, actual exit/counts và diagnostics đã lọc. Đây không phải raw log đầy đủ; giới hạn bằng chứng được giữ rõ.

Field cũ `businessRowsPersisted:false` trong raw runner receipts nói về row contents không được lưu vào evidence, không có nghĩa fixture không ghi DB. Các receipt có `localResidualCounts` và fixture journal riêng; source runner hiện đổi field thành `businessRowContentsPersistedInEvidence` để tránh cách hiểu đó. Raw receipts không bị sửa lại.

## Kết quả thực tế

| Verification | Kết quả |
|---|---|
| Checkout baseline sạch runtime, HEAD `6b031511fd37e5ee22288676b833cf855d40b43f` | Cả hai nguyên lệnh verify native1. Same failed suite/case identity set so với raw current trước đó trong môi trường URL/key giả. Không biến baseline FAIL thành waiver/PASS |
| Education trước sửa môi trường | Conformance 14 PASS /32 FAIL, 8 suites:2 PASS/6 FAIL |
| Education local, đủ prerequisite service fixture | **39 PASS /7 FAIL**, 8 suites:5 PASS/3 FAIL; nguyên `npm run education:verify` native1. Ba architecture components riêng vẫn 4+2+1 tests PASS |
| Ba suite Education FAIL trên sandbox mới | 16 PASS /7 FAIL, 23 tests/3 suites, native1; diagnostics từng assertion được lưu |
| Healthcare trước sửa môi trường | Kernel374 PASS /151 FAIL /5 SKIPPED, 61 suites:39 PASS/18 FAIL/4 SKIPPED |
| Healthcare local có schema và fixture khai báo | **518 PASS /11 FAIL /1 SKIPPED**, 61 suites:56 PASS/4 FAIL/1 SKIPPED; nguyên `npm run healthcare:verify` native1. Architecture9 tests/2 suites và Product conformance7 tests/1 suite PASS trước Kernel |
| Laboratory kiểm tra riêng sau thêm actor fixture hợp lệ, sandbox sạch | **5 PASS /1 FAIL**, 6 tests/1 suite, native1. Không sửa raw kết quả full Healthcare 11 FAIL hoặc suy ra một aggregate mới |

Baseline parser ban đầu bỏ timing suffix và đếm lặp summary; raw native exit/log không thay. `baseline-analysis.json` sửa riêng phân tích, giữ các warning post-run tách khỏi assertion. Healthcare có 152 failure headings nhưng native counter là151 failed tests; không đồng nhất heading với số test. Kết quả matching trên môi trường mock không chứng minh hành vi trên schema thật.

Các local attempts đầu còn thiếu service grant/tsx IPC configuration được giữ là FAIL, không báo như suite đã chạy. Lượt local cuối không còn mock DNS hoặc egress denial. Tests dùng service-role, một suite còn SKIPPED và nhiều check không kiểm tra real Auth: không chứng nhận RBAC/RLS production từ các aggregate này.

## Lỗi còn lại đã xác định

1. **Course lifecycle/schema:** public create contract đi qua aggregate tạo `draft`, nhưng canonical legacy migration của `courses` chỉ nhận `active/inactive/archived`. Gate2/3 thất bại. Đây là dependency legacy ngoài hai file read-only vừa được duyệt; không đổi Training table hoặc mở constraint theo implementation suy đoán.
2. **R3 fixture identity:** `kernel-invariants.integration.test.ts` tạo Party nhưng seed Student chỉ có `person_id`; producer score lookup hiện dùng `party_id`. Hai prerequisite checks báo thiếu course. `verification-gates.test.ts` còn đưa Person ID làm Party ID, gây `Person Party ... does not exist`. Cần sửa fixture theo canonical identity với owning unlock riêng cho đúng test artifacts; không nới validation runtime.
3. **Attendance RPC:** hai tests thực tế báo `column reference "tenant_id" is ambiguous`. Function `edu_set_daily_attendance` có output variable cùng tên conflict target. Candidate `PROPOSED_ATTENDANCE_RPC.sql` chỉ thay `ON CONFLICT (tenant_id, enrollment_id, school_day)` thành `ON CONFLICT ON CONSTRAINT edu_attendance_daily_state_unique`, giữ signature/predicate. **Chưa thực thi hoặc tạo migration source**; cần owning authority cho additive repair migration, không sửa lịch sử migration để che lỗi.
4. **Healthcare calculation schema conflict:** writer H8 và persistence test dùng `input_data/output_data`, trong khi schema provenance Phase B/C có `input_snapshot/output` và các trường bắt buộc/immutability. Script recreate sau đó lại ghi rõ stub dependencies. Bốn CDS checks, persistence check và một Temporal check còn FAIL. Không tự chọn stub, thêm alias hoặc bỏ constraint/trigger để làm full suite xanh; canonical profile/compatibility cần được chốt ở owning scope. Chưa chứng minh mọi failure cùng root; source và suite boundary cho thấy conflict cụ thể, không phải production exploit proof.
5. **Lab concurrency:** test riêng trên sandbox sạch với actor fixture hợp lệ tái hiện **expected1, received2** cho hai verification đồng thời. Các gate khác đạt5/6 PASS. Đây là vấn đề trong frozen dependency cần được sửa theo contract và quyền riêng, không phải lý do mở lại anonymous Preschool hoặc đổi role toàn cục. Không tuyên bố đã sửa race.

## Cleanup và giới hạn

Recovery dùng stop/remove đúng disposable stack và volume của project này, không disable trigger hoặc delete audit ledger để reset fixture. Các reset receipts xác minh 4 container của stack local cũ vẫn được giữ nguyên. Xem `LOCAL_RECOVERY_FINAL.json` cho kiểm tra độc lập cuối: container/volume/network/listener của sandbox phải bằng0 trước khi kết luận recovery PASS. Không có fixture local được giữ làm dữ liệu production.

Riêng timeout cleanup của Browser batch2o: read-only metadata lần này có62 FK tham chiếu users,51 không có leading-index candidate và không có session đang blocked tại thời điểm chụp. Đây **không** phải historical lock/query proof; root cause timeout vẫn NOT_PROVEN. Không thêm index hoặc sửa FK nào. Metadata catalog E2E trước/sau giữ nguyên hash đã pin.

Care140 focused tests, typecheck/lint và main Browser24 checks PASS là bằng chứng batch2o được reuse theo10 source hashes không đổi, không phải rerun trong batch này. Raw supplementary Browser FAIL và recovery riêng vẫn được giữ nguyên.

## Trạng thái đóng việc

Môi trường đã có thể thực thi regression thật local. Các dependency còn đỏ không nằm trong authority sửa Kernel/migration của sandbox; dừng đúng phần phụ thuộc. **RESEAL=HELD**, không mark spec done, không commit/push/merge/release. Không thay guard, selector hoặc assertion để bỏ các tests này. Gói sửa tiếp theo phải giải quyết canonical Course/Calculation profile và đúng fixture/RPC/concurrency owning scope; không mở thành sửa toàn bộ Preschool hoặc Healthcare.

| Required label | Kết quả |
|---|---|
| PRODUCTION_CHANGE | NOT_RUN |
| ANONYMOUS_CONTAINMENT | NOT_PROVEN bởi batch2p; không rerun production |
| AUTHENTICATED_ACCESS_REGRESSION | NOT_PROVEN cho production/toàn Preschool |
| BATCH2B_RBAC_RLS | IN_PROGRESS |
| PRESCHOOL_GO_LIVE | NOT_READY |
