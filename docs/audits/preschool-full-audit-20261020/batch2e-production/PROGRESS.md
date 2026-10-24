# Tiếp tục remediation — 21-10-2026

## Production đã được đọc kiểm chứng sau merge

Vercel `dpl_G4DUXNTkNq8sEk2q7p6FRDydhsom`, source `30134055d1ff5b846584e57833816f076034cdea`, READY và có canonical alias. Bốn request Courses list/detail anonymous và forged context đều application401 `COURSE_UNAUTHENTICATED`, không classroom payload; target không đổi giữa các probe. Không khởi tạo deployment hay production SQL mutation trong lượt này.

Fresh direct HTTP đúng allowlist32:96/96 anonymous reads denied; service32/32 LIMIT0 allowed; anonymous exec_sql SELECT1 denied401/42501, retained maintenance RPC204. Identity READ ONLY probes:6 EXPLAIN-only DML checks +4 writer calls denied42501, service users SELECT LIMIT0 allowed; writer bodies không chạy. Không lưu business-row contents hay secrets. Đây là scoped containment proof, không chứng nhận mọi API hoặc authenticated RBAC/RLS.

## Owner decisions mới

- Owner yêu cầu tạo contract vì chưa có ma trận Medication/Care/Portal/Announcements.
- Owner chọn khóa API thuốc, đưa khỏi phạm vi hoạt động Preschool. Không thêm role y tế hay capability Healthcare.
- Owner duyệt toàn bộ matrix trong `docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md` và yêu cầu triển khai từng nhóm: admin theo branch access; admin_staff chỉ lớp được phân công; active enrollment; health-derived unavailable; Portal admin-only/TTL mới tối đa24h; broadcast toàn trường admin-only và class broadcast unavailable.
- Contract là nguồn chuẩn cho implementation mới, không chứng minh mapping/capability đã tồn tại hoặc runtime đã đúng.

## Source work đang tách riêng

- `codex/preschool-api-identity-20261021`: Copilot Auth/profile/session tenant/live-role; exact5 executive roles theo approved Phase4;78/78 tests, lint/TS/secret checks; three independent source reviews không thấy actionable introduced defect. Product AI/domain rules giữ nguyên.
- `codex/preschool-disable-medication-20261021`: API thuốc410 cho mọi caller trước payload/Auth/DB/service;5/5 tests. Historical safety service/contracts/data không đổi.
- `codex/preschool-care-auth-20261021`: nhóm Care đang triển khai từ approved matrix; teacher identity mapping chưa proven phải503, không đồng nhất User/Person/Party.

Copilot và thuốc đã có actual local Next16.3.8 HTTP status/code đúng4/4 mỗi endpoint và mọi response no-store. Raw harness exit1 do so sánh nguyên chuỗi Cache-Control với `private, no-store`; Next development trả `no-store, must-revalidate` hoặc thêm max-age0. `local-http-assessment.json` tách actual denial/no-store proof khỏi exact-literal failure, không rewrite raw results. Các lỗi Turbopack/junction/Next dependency ban đầu được giữ evidence. Các server local đã dừng và listener đóng.

Fresh physical dependencies được `npm ci` exit0 trong Care worktree; Next16.3.8 khớp lockfile. Hai worktree khác dùng junction tới target này; không archive/delete Care dependencies khi còn link. D: shared dependencies cũ được giữ nguyên. Next dev tự append AGENTS block; patch được lưu rồi restore đúng HEAD, không đưa thay đổi engineering controls vào source repair.

Mandatory broader commands đã chạy offline/synthetic, không seed production: Education architecture3 suites/7 tests PASS; conformance2 passed/6 failed suites,14 passed/32 failed tests do DB offline; later customization/extension conformance NOT_RUN. Healthcare guardPASS, architecture2 suites/9 tests PASS, conformance1/7 PASS, kernel39 passed/21 failed/1 skipped suites,375 passed/154 failed/1 skipped tests, exit1. Đây là FAIL/ENVIRONMENT, không full regression PASS.

Chưa commit/push/deploy các nhóm source mới. Production source hiện tại chỉ bao gồm405/406; không tuyên bố Copilot/API thuốc/Care đã được vá production. Portal/Announcements chưa triển khai. Authenticated regression toàn bộ, complete RBAC/RLS và Preschool Go-Live vẫn chưa proven/NOT_READY.

## Hoàn tất implementation local và chặn tại review — 05:35 +07

Source năm nhóm đã có: Copilot78, thuốc5, Care67, Portal104, Announcements32; tổng286 test trong10 suites, không pending. Mọi lint/scoped Education TypeScript/secret guard native exit0. Care HTTP4/4, Portal8/8, Announcements2/2 đúng401/no-store trên Next16.3.8 offline; server được dừng, listener đóng. Generated AGENTS patch được giữ riêng và restore đúng HEAD, không commit engineering control.

Copilot và thuốc có ba review source độc lập hoàn tất, không actionable introduced defect còn mở. Local commit88314bacf (21 files) và4269492fb (15 files); Architecture Guard pre-commit thực chạy PASS. Lần staging Copilot đầu bị diff-check chặn vì blank line EOF ở SPEC mới; chỉ trim EOF của docs, kiểm tra lại cùng allowlist rồi commit. Không bypass guard, không đổi runtime source để làm check xanh. Không push/merge/deploy.

Care/Portal/Announcements đã implement và kiểm tra local nhưng chưa seal: hai reviewer Care và builder Portal bị usage-limit; kết quả review dở không tính PASS. Lead hoàn tất Portal và Announcements trong đúng spec/Code Map. Đã chuẩn bị diff, source SHA256, verification.json, FINAL_REPORT.md và3 prompt độc lập mỗi nhóm. Bước tiếp theo là hoàn tất review độc lập khi có khả năng chạy, không duyệt lại matrix và không giả làm review độc lập bằng tự review cùng context.

Care: same-session Auth/tenant/Product/admin → course branch → active Platform grant → current active enrollment → toàn bộ target trước ghi. admin_staff cần mapping User→teacher Party; ngày khác hôm nay cần producer lịch sử enrollment; cả hai503. Health input503, không ghi health_checks từ UI. Actual transactional failure/TOCTOU/authenticated RLS chưa proven.

Portal: bỏ hardcoded signing fallback, giữ precedence secret cấu hình; new TTL≤24h; legacy signed expiry giữ nguyên. Live tenant/Parties/directional guardian relation được kiểm tra theo ngày hiện tại Việt Nam với DATE end inclusive. Payload/chat giữ bearer-capability server adapter hiện có; không phải chứng cứ session RLS. Parent Copilot chỉ ask_copilot và phải qua live binding. Issuer có Auth/admin/Product gate nhưng503 trước ký khi thiếu full resource composition.

Announcements: Auth/admin/Product gate; loại bỏ global thread, demo actor/tenant và student/guardian UUID giả.503 trước payload/ghi/gửi cho tới khi đủ recipient/branch/idempotency producer. Không đổi schema/grant hay tự làm fanout.

Production containment proof trước đó vẫn tách scope32/RPC/Courses; chưa đưa năm source group mới lên production. Broad mandatory offline FAIL/ENVIRONMENT không được chuyển PASS. Main AutoMove run39502767036/head30134055d đã completed success theo read-only GitHub query, tách khỏi source mới. Current aggregate: BATCH2B_RBAC_RLS=IN_PROGRESS, AUTHENTICATED_ACCESS_REGRESSION=NOT_PROVEN, PRESCHOOL_GO_LIVE=NOT_READY.

## Review chạy lại thành công — 05:44 +07

Sau lệnh tiếp tục,9 phiên reviewer mới cho Care/Portal/Announcements đã hoàn tất (mỗi nhóm Blind/Edge/Acceptance), không actionable introduced defect. Block quota cũ giữ historical; không tự review cùng context. Source runtime không đổi sau test. Care7012ca82f, Portaldaf358e7a, Announcements65adcebab đã commit local với metadata/checks. Source-seals xác minh cả5 commit,286 tests/10 suites, contract SHA giống bản được duyệt, không protected-surface diff hay staged files ngoài scope.

Portal worktree mới thiếu Husky shim ignored nên commit đầu không chạy hook; đã ghi NOT_RUN thật. Standard npm prepare cài runtime có sẵn, rồi guard filename-only thực kiểm tra đúng23 path bằng isolated baseline index, exit0, real index/HEAD không đổi. Không gọi đó là pre-commit đã chạy trong quá khứ. Một prepare song song gặp config lock với exit0; retry tuần tự thành công. Announcements prepare xong trước commit nên pre-commit thực kiểm tra15 files. Không sửa guard/policy/baseline để làm xanh.

Đang gom5 commit đã review vào branch giao hàng mới, push theo quyền đã cấp trước đó và mở draft PR để CI kiểm chứng source kết hợp; không tự merge/deploy production. Các hold dependency, full Auth/RLS, Platform regression offline FAIL và Go-Live NOT_READY giữ nguyên.

## Đã push và xác minh preview — 05:55 +07

Draft PR407, sourceb85722f6e, remote SHA đã đối chiếu độc lập. Source kết hợp giữ nguyên21 Git blob đã review;286/286 tests/10 suites cùng lint/TS/secret scan PASS. CI emitted28 success,5 skipped,0 pending/fail; unit286 tests và Logistics547 tests có counter thật. Real DB E2E/Migration Gates skip theo router hiện có, không sửa router và không chuyển thành PASS.

Preview đúngsource đã READY;22/22 actual anonymous/forged probes deny401/410 đúng DTO và private/no-store. Raw harness đầu20/22 FAIL do áp envelope success:false không tồn tại trong DTO Copilot; kiểm chứng source/error-only contract rồi rerun có bounded exact-shape checks22/22, không đổi runtime hay config. Giữ toàn bộ rawreport. Production target/source vẫn30134055d trước/sau; khôngmerge/deploy/DBmutation, không dùng userJWT/tokenhợp lệ hay lưu business rows.

Nguồn chuẩn finalstatus: FINAL_REPORT.md; metadata delivery407.json, pr407-ci-latest.json, preview407-latest.json và các timestamped snapshots. Authenticated regressionNOT_PROVEN, RBAC/RLSIN_PROGRESS, Go-LiveNOT_READY. PRbody cập nhật bằng chứng actual; không yêu cầu owner duyệt lại matrix.
