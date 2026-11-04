# Attendance V2 cutover review — HOLD

Project: `lvnvkpyxtuilhrabtlwv`. **HOLD — KHÔNG APPLY PRODUCTION**.
Cập nhật quyết định ngày 01/11/2026 theo phê duyệt chấp nhận rủi ro phục hồi của người dùng; không chạy thêm kiểm tra Production.

## 1. Phục hồi sau COMMIT — RỦI RO ĐÃ ĐƯỢC CHẤP NHẬN

Bella chấp nhận rủi ro phục hồi sau COMMIT trong phạm vi sử dụng Supabase Free.
Nguồn quyết định: phê duyệt rõ ràng của người dùng trong chat này ngày 01/11/2026.
Đây chỉ là chấp nhận rủi ro phục hồi, không phải phê duyệt triển khai V2.

| Hạng mục | Trạng thái bằng chứng | Điều kiện cutover hiện tại |
| --- | --- | --- |
| Supabase backup/PITR và recovery point dùng được | CHƯA XÁC MINH; inventory đã lưu không chứng minh backup ngoài không tồn tại | Bỏ khỏi điều kiện cutover theo phê duyệt chấp nhận rủi ro. |
| Restore receipt Production | CHƯA CÓ trong nguồn đã kiểm tra | Bỏ khỏi điều kiện cutover theo cùng phê duyệt. |
| RTO/RPO và recovery capability | NOT_PROVEN — rủi ro đã được chấp nhận | Không coi thiếu bằng chứng phục hồi là điều kiện HOLD độc lập trong quyết định này. |

Không chuyển recovery thành PASS. Người recovery/containment và cơ chế xử lý sự cố
vẫn CHƯA XÁC MINH; phê duyệt này không chứng minh các thông tin đó hoặc cấp quyền thao tác.
Script backup sáu bảng Decision Engine và rollback transaction V2 vẫn không phải
bằng chứng phục hồi attendance sau COMMIT. Không tự khôi phục writer cũ không an toàn
hoặc mở lại quyền đã thu hồi.

## 2. Danh tính và phạm vi nguồn ghi attendance — NOT_PROVEN, VẪN HOLD

Phạm vi code: HEAD `f1299e3138f3700062a1ed84271db315737b0071`, working tree liên quan
và các revision lịch sử được chỉ rõ bên dưới. DB role trong code là cách chọn client;
chỉ dòng telemetry có bằng chứng role chạy thật. Owner là owner vận hành, không suy ra
từ tác giả commit, thư mục Product hoặc actor chạy CI.

| Writer | API/table | DB role | Client/job | Owner | Bằng chứng | Kết luận tương thích V2 |
| --- | --- | --- | --- | --- | --- | --- |
| Teacher hiện tại | POST `/api/education/attendance` → `edu_set_daily_attendance` RPC | Caller JWT, dự kiến `authenticated` | `PreschoolTeacherAttendanceService` → Attendance contract | CHƯA XÁC MINH | E1; rehearsal V2 | PASS trong phạm vi cô lập; Production vẫn BLOCKED. |
| Admin scoped hiện tại | Cùng POST → `preschool_set_scoped_daily_attendance` → scoped worker → shared writer | `service_role` khi có operation client; source fallback caller | `PreschoolAttendanceCommandService` | CHƯA XÁC MINH | E1; rehearsal V2 | DB/RPC rehearsal PASS; client selection và application Production NOT_PROVEN. |
| English Center hiện tại | POST `/api/english-center/learning/attendance` → shared writer RPC | SSR caller; dự kiến `authenticated` | `LearningOperationsService` → Attendance contract | CHƯA XÁC MINH | E1; rehearsal V2 | DB/RPC rehearsal PASS; application E2E NOT_PROVEN. |
| Legacy English Center `bb7007e` | Cùng English Center POST → `recordAttendance` → INSERT `edu_attendance` trực tiếp | SSR caller trong Production; dự kiến `authenticated` | Attendance contract trước PR #429 | CHƯA XÁC MINH | E2, E3, E6, E7 | Domain chính gắn với source RPC `f1299e3` tại thời điểm ảnh. URL deployment legacy và client cũ chưa được chứng minh ngừng dùng; nếu còn dùng `authenticated`, direct INSERT bị V2 chặn. |
| Test/tool có direct DML | INSERT và DELETE `edu_attendance` qua SDK/PostgREST | Fixture Finance ưu tiên `service_role`, fallback anon key; cleanup yêu cầu service key | Finance canonical-identity fixture; Attendance real-DB integration cleanup | CHƯA XÁC MINH | E4, source only | Event DML của `service_role` được giữ; anon direct DML bị chặn. Target/execution Production NOT_PROVEN; không chạy test trong lượt này. |
| Hai direct-DML-shaped calls đã quan sát | `edu_attendance`; statement class `WITH`, PostgREST-shaped | `service_role` — đã quan sát | CHƯA XÁC MINH | CHƯA XÁC MINH | E5: 1 normalized entry / 2 calls | Không bị V2 revoke quyền event DML; tương thích toàn luồng NOT_PROVEN. Chưa có bằng chứng hai lần ghi thành công. |
| Direct REST/external/dynamic client chưa định danh | `/rest/v1/edu_attendance`, INSERT/UPDATE/DELETE | `anon` / `authenticated` nếu client dùng các role này | CHƯA XÁC MINH | CHƯA XÁC MINH | Chưa có inventory hoặc xác nhận đủ phạm vi | V2 chặn direct event DML của hai role. Chưa thể kết luận không có client hợp lệ bị ảnh hưởng. |
| 6 cron / Edge Functions | Các tham chiếu trong snapshot đã lưu; Edge list `[]` | Cron: `postgres`; Edge: N/A | 5 materialized-view references + cache cleanup; không có Edge Function được trả về | Cron owner CHƯA XÁC MINH | E5, inventory snapshot | Chưa thấy attendance writer trong phạm vi kiểm tra; không chứng minh external writer không tồn tại. |

Bằng chứng và giới hạn đối chiếu:

- **E1 — source hiện tại:** `src/app/api/education/attendance/route.ts:133,137`, `src/platform/education/contracts/attendance.contract.impl.ts:82,151`, `src/platform/education/contracts/attendance-command.contract.impl.ts:25,37`, `src/products/bella-english-center/services/learning-operations.service.ts:112`. Hai literal event-table access trong application hiện tại là SELECT history và SELECT portal. Không suy rộng sang target dựng động.
- **E2 — source legacy:** `git show bb7007e:src/platform/education/contracts/attendance.contract.impl.ts` có direct INSERT trong `recordAttendance`; English Center POST ở revision đó gọi method này. PR #429 / commit `dc84681ff99626bb7f0385a0e08559aceb663172` chuyển method sang RPC. Source `1d9115b` và Preview `a2772b9` đã dùng RPC; không suy ra chúng đã thay thế mọi client cũ.
- **E3 — deployment metadata GitHub:** [record 7280670989](https://api.github.com/repos/bellaspahcm/bella-ai-platform/deployments/7280670989/statuses) của `bb7007e` có status success lúc 23/10/2026 21:26:50 +07. [Record 7406937794](https://api.github.com/repos/bellaspahcm/bella-ai-platform/deployments/7406937794/statuses) của `1d9115b` có status failure lúc 29/10/2026 14:55:55 +07. Không dùng record thất bại làm bằng chứng bản sửa đã phục vụ. Các record này không xác nhận alias, request, DB target hay client đang hoạt động tại từng thời điểm.
- **E4 — test/tool source:** `tests/products/bella-education/finance/preschool-finance-canonical-identity.test.ts:15,16,135` chọn URL/key từ environment và INSERT event; `src/platform/education/__tests__/attendance-contract-real-db.integration.test.ts:18,19,73` dùng service client và DELETE event khi cleanup. Kiểm tra literal references trên các file tracked TS/TSX/JS/MJS/CJS/Dart/Python/shell, có bao gồm tests/tools; không đọc giá trị secret, không chạy writer, không coi source là execution proof. SQL definitions/fixtures, code chưa tracked, client ngoài repo và target dựng động không được chứng minh đầy đủ bằng scan này.
- **E5 — telemetry/inventory đã lưu:** `attendance-cutover-review-evidence.json`, `legacyWriterBoundary` và `followUpInventory`. Receipt chỉ có số calls và `stats_since`, không có timestamp riêng của từng call. Khoảng đối chiếu: từ stats reset 30/10/2026 10:05:43 +07 đến role receipt 01/11/2026 16:49:08 +07; entry `stats_since` là 30/10/2026 16:25:04 +07. Không coi đó là thời điểm chính xác của cả hai request.
- **E6 — ảnh deployment do người dùng cung cấp trước đó:** [ảnh gốc được lưu nguyên byte](attendance-production-current-user-provided.png), SHA256 `10e216eae25e40689b62c66f7e7d7002fb7503dccac77dfb749a17b0d6fc551d`. Ảnh hiển thị project `bella-spa-erp`, Ready, Production Current, source `main` / `f1299e3`, domain `bella-spa-erp.vercel.app` và UI identifier `DstNQvShs`. Đây là bằng chứng UI tại thời điểm ảnh, không phải kiểm tra Production mới. Ảnh chỉ có thời gian tương đối; không gán timestamp tuyệt đối hoặc trạng thái hiện tại chưa kiểm tra.
- **E7 — báo cáo rollout lịch sử:** `../preschool-full-audit-20261020/release-production-20261024/ROLLOUT_READINESS.md:23` ghi deployment `dpl_3gDwjToSwdUvtBtqeaxppgRNfbMt`, URL `bella-spa-dy03uomq4-bella-spa-s-projects.vercel.app`, source `bb7007e` và alias domain chính tại lần kiểm tra 24/10. Raw receipt `PRODUCTION_ALIAS_READONLY_20261024.json` được báo cáo dẫn chiếu không có ở hai vị trí workspace đã kiểm tra. Vì vậy đây là nguồn báo cáo lịch sử, không phải receipt được xác minh độc lập trong lượt này hoặc bằng chứng URL cũ hiện còn/phải hết phục vụ.

Đã thử đọc historical Vercel logs bằng CLI 54.14.2, project `bella-spa-erp`, scope
`bella-spa-s-projects`, environment Production, không lọc branch, query `attendance`,
since `2026-10-30T03:05:43Z`, until `2026-11-01T09:49:08Z`, limit 100.
CLI trả exit 1 / HTTP 400; không trả JSON log record. Đây là lỗi truy vấn, không phải
bằng chứng không có log hoặc xác nhận nguyên nhân retention/quyền. Chỉ đọc lại thông
báo lỗi đã lọc; không lưu raw logs, payload hay credential. Dashboard Supabase ở lần
kiểm tra trước yêu cầu đăng nhập; không thử vượt đăng nhập hoặc bật logging.

Phạm vi log Production chưa bao phủ Preview, máy local hoặc external client có thể
trỏ cùng DB. Chưa có request correlation hoặc owner attestation để gán hai calls
cho legacy revision hay test/tool. Cần log đã loại bỏ thông tin nhạy cảm và xác nhận
owner về client/version, DB target, việc sử dụng thực tế và các đường `anon/authenticated`.
Không chạy lại catalog/DB audit, preflight hoặc test Production trong lượt truy nguồn này.

### Đối chiếu deployment legacy và các điều kiện còn lại

Chuỗi source ở đúng revision `f1299e3138f3700062a1ed84271db315737b0071` là
English Center POST → `LearningOperationsService.markSessionAttendance` →
`AttendanceContractImpl.recordAttendance` → `edu_set_daily_attendance` RPC.
Blob Attendance contract ở revision này là `f2c7c7e2f29399adc5b4b0e878008e7d6c38ea12`,
không có direct event INSERT; blob legacy `bb7007e` là
`2d3d90b37f167942a974bb82fe2a63bf5fb32709` và có direct INSERT.
Kết hợp E6 với source chỉ chứng minh source được chỉ định cho domain chính trong
ảnh đã chuyển sang RPC; không chứng minh một request English Center đã chạy thành công.

| Điều kiện xem xét bỏ HOLD | Kết quả theo bằng chứng hiện có | Phần chưa đóng |
| --- | --- | --- |
| Legacy direct INSERT đã ngừng hoạt động hoặc có phương án tương thích | PARTIAL: đã xác định deployment legacy từ E3/E7; E6 gắn domain chính với source RPC mới tại lúc chụp | Chưa chứng minh URL deployment cũ, alias phụ, Preview/local/external client không còn được dùng. Không đóng rủi ro cho toàn bộ legacy writers từ ảnh domain chính. |
| Hai calls `service_role` được truy nguồn hoặc phân loại đủ tin cậy | ROLE_CLASSIFIED: normalized PostgREST-shaped DML, `service_role`; V2 giữ event DML cho role này | Attribution, thao tác cụ thể/thành công và toàn luồng vẫn NOT_PROVEN. Không gán cho deployment, fixture hoặc cleanup chỉ vì source có thể tạo query tương tự. |
| Không còn đường `anon/authenticated` chưa được đánh giá ảnh hưởng | PARTIAL về source: backend hiện tại dùng RPC; legacy INSERT và anon-key fallback của fixture đã nhận diện tác động | Việc sử dụng Production thực tế và inventory external/dynamic chưa có xác nhận owner đủ phạm vi. Test/fixture không tự trở thành Production writer. |
| Writer hợp lệ hoạt động qua API/RPC sau V2 | PASS trong đúng phạm vi isolated teacher và DB/RPC rehearsal đã ghi nhận | Admin/English Center application E2E và hành vi sau áp dụng Production NOT_PROVEN; không sử dụng V2 Production để thử. |

Lượt đối chiếu này chỉ tái sử dụng Git, metadata/receipt đã có và ảnh người dùng;
không gọi GitHub/Vercel/Supabase hoặc URL ứng dụng để lấy trạng thái Production mới.
Không đọc lại raw backend logs, không chạy writer hoặc test. Cần nguồn có trách nhiệm
xác nhận trạng thái sử dụng legacy URL/client và cung cấp correlation log/metadata
còn thiếu; chưa có thông tin này thì giữ NOT_PROVEN và HOLD. Recovery risk vẫn ACCEPTED,
không trở lại thành blocker độc lập và không chuyển thành recovery PASS.

## Bằng chứng giữ nguyên và điều kiện xem xét lại

- V2 rehearsal: **PASS 29/29** trong phạm vi DB cô lập đã ghi nhận.
- Production preflight: **PASS lúc 16:46:31 +07, 01/11/2026**; catalog comparison: **MATCH lúc 16:50:31 +07**. Đây là bằng chứng tại thời điểm kiểm tra.
- V2 SHA256: `af506babfb13da00ae072fcc7802e8c43fa4c0ab1770e73b89d03f2070903922`. Giữ nguyên V1, manifest và các rehearsal receipts, kể cả kết quả FAIL của V1.
- Chi tiết lịch sử và timestamp: [attendance-cutover-review-evidence.json](attendance-cutover-review-evidence.json). Giữ nguyên snapshot này trước phê duyệt chấp nhận rủi ro; trạng thái quyết định mới được ghi tại tài liệu này.

Cutover vẫn HOLD do legacy writer inventory chưa được chứng minh.
Chỉ xem xét lại sau khi nhóm nguồn ghi đủ bằng chứng; triển khai cần phê duyệt riêng.
Đối chiếu hash V2 và chạy lại Production preflight ngay trước thay đổi được phép.
Chấp nhận rủi ro phục hồi hoặc cung cấp bằng chứng không cấp quyền COMMIT, migration,
grant/revoke hay deploy.
Lượt cập nhật này chỉ sửa tài liệu; không tạo backup/restore hoặc migration COMMIT.

**Teacher Production: BLOCKED. Preschool Go-Live: NOT_READY.**
