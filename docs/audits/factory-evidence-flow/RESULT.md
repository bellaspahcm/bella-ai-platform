# Kết quả triển khai Factory trong phạm vi được duyệt

Ngày 2026-10-20. **Đã triển khai cục bộ; nghiệm thu end-to-end vẫn NOT_PROVEN.** Dừng phần nghiệm thu dương tại ranh giới sandbox đã chốt. Không push, PR, merge hoặc triển khai production.

| Nội dung | Kết quả có bằng chứng |
|---|---|
| A — companion evidence contract | Đã triển khai v1: task → Factory run → native binding → artifact → candidate/commit có kiểm chứng; không thay native facts. |
| B — persistence | Diagnostic mới 15 live / 7 matches không tái hiện lỗi lịch sử. Store giữ nguyên; nguyên nhân lịch sử NOT_PROVEN. Người dùng cho phép tiếp tục C/D. |
| C — Monitor | Viewer hiện có được đưa vào branch cục bộ, chỉ đọc filesystem/pure validators. Mở đúng run HELD, native IDs và artifact của các stage được chấp nhận; không gọi store.read/readNative/cleanup. Chưa có trên GitHub main. |
| D — nghiệm thu dương | HELD. Có coding thật, nhưng Verify không đạt; Reviewer chưa dispatch, chưa có candidate/commit link được chấp nhận. |
| Kiểm thử operator | 122/122 Node tests qua Jest wrapper; zero fail/skip/todo/cancelled. ESLint exit 0; diff check sạch. Đây không phải native QA PASS. |
| Kiểm thử âm | Vượt scope, thiếu/corrupt/expired evidence, lỗi lưu trữ thật có kiểm soát, gắn commit vào run HELD và readback với source đã thay đổi đều bị chặn đúng. |

## Revision và authority

- GitHub main đã audit: `5ad15661f2dc2603881d50abdef17bcd7bc5fb20`; truy vấn lại sau triển khai vẫn trả đúng SHA này.
- Constitution candidate riêng: `36a57668f5aba61da10d7c555dde2e6d01518a5b`. Không mô tả candidate này là đã có hiệu lực trên main.
- Worktree: `C:/Users/DELL/.codex/worktrees/factory-evidence-flow/BELLA SPA ERP`, branch `codex/factory-evidence-flow`.
- Commit tooling: `d86828efff0fd036a1651e27d75467487ceae945`; điều chỉnh consumer: `4d2a831c3804d94ce03e88414fd72bee42be4176`.
- Commit giữ hai file do Builder sửa: `2abc0ecada95169a50c821d8ea54465f93ffbb19`. Được operator tests/static review, chưa được native Factory handoff.
- Commit giữ giới hạn Verify và browser proof: `e090ba5efb388c6f56a8320f92a306b4c27b1a5d`. Thay prompt chỉ loại bỏ chỉ dẫn pre-read mâu thuẫn cho Verify tương lai; chưa có run dương sau sửa.

Giữ entrypoint `role-pipeline.mjs run`. Không launcher/controller framework mới; native Lead/Builder/Verify/Reviewer tuần tự. Multi-Agent mặc định không được bật. Các review triển khai là read-only theo skill QA. Không sửa Product, Core/kernel, registry, DB/migration, RLS/auth của Platform, sandbox, CI workflow hay deployment. Không chỉnh checkout chính đang có công việc khác. `store.mjs` và `contract.mjs` khớp baseline.

## Hai run nghiệm thu được giữ nguyên

1. Task `bb41c924-c1eb-4197-baa3-6ce800676420`, Factory `1b5bf105-8d69-4345-a625-3bfc763271e4`, package `bella-agent-flow-QeG0TU`: HELD tại Lead vì native `usageLimitExceeded`, zero source changes. Sau đó người dùng cho phép một task mới, không resume.
2. Task `8d76e706-2c35-4273-b1f8-2275ffa91c39`, Factory `a29ce101-c9be-4d98-ac6a-59b7fd4674e4`, package `bella-agent-flow-OxwBsf`, source `4d2a831c...`:

| Stage | Kết quả |
|---|---|
| Lead | ACCEPT, 19 live / 9 history matches, zero changes. |
| Builder | DONE, 43 live / 21 matches / one fileChange item; chỉ sửa `filechange-reader.mjs` và `filechange.test.mjs`. |
| Verify | HELD / EXACT_TEST_REQUIRED: có một pre-read command ngoài lệnh test. Test thật exit 1: 11 tests / 6 pass / 5 fail / zero skip/todo/cancelled. |
| Reviewer | NOT_DISPATCHED. |

Năm lỗi test là `EPERM` khi `mkdtemp` tạo fixture dưới TEMP trong native read-only sandbox. Giữ nguyên sandbox theo phạm vi được duyệt; không mock/skip/đổi test để tạo PASS. Candidate nguồn tại Builder: `c965d20e9196482149011be0bb0c39a47f537c03e8c66494733c5cf29d5634d6`. Không xuất candidate.json/commit-link cho run HELD. Gọi canonical commit linkage bị từ chối `FACTORY_VERIFIED_CANDIDATE_REQUIRED`; readback sau khi operator đã tiến source bị từ chối `CANDIDATE_CHANGED`.

Fix coding thật: reader đối chiếu digest mọi canonical row với `contract.signature(fact)`, kể cả command/message/turn; regression kiểm tra mixed facts hợp lệ, từng digest sai và tính bất biến khi đọc. Baseline đã tái hiện lỗi trước khi Builder sửa. Test operator và static review xác nhận fix trong môi trường operator; không nâng trạng thái native Verify.

## Evidence và phép thử âm

Operator evidence nằm tại `C:/Users/DELL/.codex/delivery-evidence/factory-evidence-flow-20261020/`. Manifest SHA-256 của từng file nằm trong `evidence-manifest.json` tại thư mục audit này. Runtime packages gốc nằm trong `C:/Users/DELL/.codex/agent-flow-evidence/`; deadline của từng package được giữ nguyên.

- `baseline-repro.json`: fixture trước sửa chấp nhận command digest sai; chỉ là protocol reproduction.
- `acceptance-2-held-diagnostic.json`, `native-verify-output.tap`: native binding, hai lệnh và test output thật của Verify bị từ chối. Không viết lại thành accepted receipt.
- `held-2/factory-browser-result.json`, `factory-desktop.png`, `factory-mobile.png`: đúng task/Factory IDs, hai stage được chấp nhận, 11 artifact, refresh/reload; anonymous 401, write method 405, zero page errors/overflow. Monitor không query native hoặc thực thi test.
- `historical-reader-result.json`: hai pipeline HELD vẫn PARTIAL, controller HANDOFF vẫn PARTIAL / LEGACY_WITHOUT_FACTORY_LINK; controller VERIFY được hiển thị READBACK_ONLY, không phải test execution.
- `negative-scope-result.json`: Product path bị `INVALID_TASK_SCOPE` trước intake/native dispatch; không tự tạo Factory run ID cho task bị từ chối.
- `negative-reader-result.json`: thiếu/corrupt/expired trên bản sao có kiểm soát của run HELD; original hashes không đổi. Không mô tả đây là phép thử trên positive handoff.
- `negative-storage-result.json`: fresh task `75b71d76-6a77-4137-ac2a-d4e914051fdc`, package `bella-agent-flow-tzrasy`; giữ exclusive handle tối đa 40 giây trên facts của chính run mới. Collector quan sát `facts.ingest / STORE_READ_FAILED`; run HELD / STORE_WRITE_FAILED, no Builder, zero source changes. Không suy ra nguyên nhân lỗi lịch sử.
- `negative-held-commit-result.json`, `negative-stale-source-result.json`: fail-closed ở commit linkage/readback, không tạo commit index hoặc positive readback.

Full tests dùng runtime dependencies đã có của checkout chính, không cài package và không đổi config. Command thực tế: main-checkout Jest binary/config + worktree rootDir, chạy duy nhất `src/__tests__/agent-flow-tooling.test.ts --runInBand --no-coverage`; wrapper chạy 122 Node tests thật. Lint chạy các tooling paths đã thay đổi bằng main-checkout ESLint config; chỉ có warning môi trường .eslintignore/React detect.

## Trạng thái đóng batch

`IMPLEMENTATION = LOCAL_PARTIAL`, `D = HELD_AT_SCOPE_BOUNDARY`, `FACTORY_END_TO_END = NOT_PROVEN`, `FACTORY_DEFAULT_EXECUTION = NOT_PROVEN`, `CANDIDATE_COMMIT_ACCEPTANCE = NOT_PROVEN`, `SEALED_ON_MAIN = NOT_PROVEN`, `GO_LIVE = NOT_PROVEN`.

Muốn tiếp tục nghiệm thu dương cần quyết định riêng về fixture-write trong Verify hoặc một task mới có suite tương thích sandbox hiện hành. Chưa chạy task dương tiếp theo; không resume các task cũ. Không có quyền push/PR/merge trong batch này.

## Quyết định đóng batch của chủ nhiệm — 2026-10-20

Chủ nhiệm đã duyệt cách phân loại bằng chứng và đóng batch ở `CLOSED / LOCAL_PARTIAL`. Đây không phải nghiệm thu contract, native Factory, candidate–commit hay main/Go-Live. A còn cần review contract trên source thực tế; C vẫn chỉ ở branch cục bộ. D giữ `HELD_AT_SCOPE_BOUNDARY`; các trạng thái NOT_PROVEN phía trên không đổi.

Bước tiếp theo được khuyến nghị là một task coding mới có ý nghĩa và suite tương thích sandbox hiện hành, dùng task/factory IDs mới; chưa chạy task đó trong batch đã đóng. Giữ đúng lệnh Verify, chỉ dispatch Reviewer sau Verify đạt, đối chiếu candidate với commit tree theo path/content/mode/add/delete, và mở cùng run trên Monitor. Không resume run cũ, không đổi test để ép PASS, không sửa store khi chưa chứng minh nguyên nhân lịch sử. Nếu cần giữ suite hiện tại, quyền ghi fixture phải được đánh giá và phê duyệt riêng. Chưa push, tạo PR, merge hoặc triển khai production.
