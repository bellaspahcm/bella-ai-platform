# Quyết định phạm vi mới: môi trường regression local độc lập

Trạng thái: PROPOSED, NOT_EXECUTED. Đây không phải yêu cầu duyệt lại matrix, Care catalog/header, sáu relation E2E hoặc FK Timeline đã được duyệt.

## Vấn đề đã xác minh

`npm run education:verify` và `npm run healthcare:verify` đều chọn cả các suite ghi/xóa DB. `jest.setup.ts` dùng URL/key giả khi không có cấu hình; raw log có `ENOTFOUND mock.supabase.co`. Chạy trực tiếp hai lệnh trên checkout gốc sạch runtime tại `6b031511fd37e5ee22288676b833cf855d40b43f` tái hiện các suite FAIL và cùng tổng test FAIL. Raw baseline/current và phân tích ở `baseline-analysis.json`; không dùng kết quả này làm waiver hoặc PASS.

Các suite Education có `upsert/delete` bằng tenant ID cố định, đụng cả legacy Courses, Student/Person, rule governance và Timeline ngoài phạm vi sáu relation. Suite Healthcare cũng có ghi fixture vào `hc_*`. Không được trỏ các suite này vào DB E2E hiện tại để thay lỗi DNS bằng một batch ghi dữ liệu ngoài phạm vi.

## Phạm vi đề xuất duy nhất

Cho phép chuẩn bị và chạy regression trong **một Supabase local dùng một lần**, project ID `bella-preschool-regression-20261021`, thư mục mới `%TEMP%\bella-preschool-regression-20261021`, API/DB/shadow ports `55431/55432/55430`. Cho phép khởi động Docker Desktop hiện đã cài nhưng daemon đang dừng và tải image cần cho stack local. Dùng CLI đã kiểm tra tại máy `2.115.0`, không tự nâng cấp.

`proposed-local.config.toml` là cấu hình dự kiến: migration và seed tự động đều tắt. Chỉ cho phép lưu lượng runtime test tới loopback của sandbox; trước ghi phải xác minh project/container/port/DB identity và local schema rỗng. Abort nếu port/container/thư mục đã thuộc tác vụ khác; không reset hoặc stop chúng.

Sau khi tạo sandbox rỗng, tạo manifest dependency closure từ DDL/RPC/policy canonical có sẵn tại đúng revision của repository. Chỉ provision prerequisite cần cho các suite được khai báo; pin từng artifact và lưu manifest trước thực thi. Không áp toàn bộ migration history hoặc demo seed mù quáng. Không copy business data hay schema dump từ production/E2E. Thiếu prerequisite hoặc có conflict canonical thì dừng phần phụ thuộc với bằng chứng, không tự bịa schema/RPC hay thay business semantics.

Trong sandbox đã xác minh, cho phép setup/teardown synthetic fixtures và chạy nguyên lệnh Education/Healthcare bắt buộc. Credentials local chỉ tồn tại trong process, không ghi vào evidence hoặc repository. Giữ raw exit, counts, skip/failure, before/after catalog, cleanup và source hashes. Test fixture không chứng minh RLS nếu dùng service-role hoặc assertion không kiểm tra quyền; không gộp một lệnh xanh thành production/Go-Live PASS.

Không cấp quyền sửa bất kỳ Kernel runtime/test file nào, sửa guard/selector/baseline, nới assertion, thay contract/matrix, đổi `.env` hiện có, thay DB E2E/production hoặc migration source. Nếu một suite cần sửa frozen fixture/code thay vì chỉ môi trường, báo đúng artifact và căn cứ canonical để owner xử lý riêng. Không commit/push/merge/release bằng quyết định này.

Recovery: chỉ stop/remove stack, volumes và thư mục có marker đúng project của sandbox này, sau khi lưu evidence không chứa secrets; không thao tác stack/worktree khác. Không cần recovery DB E2E/production vì chúng không tham gia.

## Vì sao cần quyết định này

Authority hiện tại ghi rõ `databaseChangesAuthorized: false` tại `../batch2o-care-catalog/AUTHORITY.json`, và proposal trước được duyệt với điều kiện “Không đổi DB, Training Courses, Healthcare hay production”. Quyền fixture sáu relation không phải quyền provision môi trường full Platform regression.

Constitution `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`, **Scoped Autonomy and Approval**, yêu cầu: “A material business rule is unresolved, or required change authority is missing” thì “Hold dependent implementation, provide evidence and a concrete proposal”. Đây là mở thêm môi trường DB test riêng, không phải một vòng duyệt lại phạm vi cũ. Không thay protection để unseal feature.

## Quyết định owner cần chốt

Khuyến nghị: duyệt đúng sandbox local và quy trình prerequisite/verification ở trên. Khi chưa có quyết định, không khởi động/provision DB mới; phần Care đã PASS và các raw failure giữ nguyên, reseal HELD.
