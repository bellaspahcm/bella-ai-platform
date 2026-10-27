# Xác minh production sau PR407

Ngày địa phương: 21-10-2026. Không có DDL/DML nghiệp vụ production trong lần xác minh này. Agent không thực hiện merge, deploy hay đổi protection.

## Source và HTTP

Owner đã merge PR407 lúc `2026-10-20T23:01:43Z`. Merge commit `ecfaf23ab06d043c5f2caec38ea67856705b6c26`; tree giống head đã review `b85722f6eab1aedc3d9bd977bd3deee19e5684e5`.

Vercel project `prj_Rgncynqz8ptznREGggMxPfjwoikW`, deployment `dpl_BfU1Mv62WBuJ52Xwqcvjc2xFB4r9`, READY, production, domain `bella-spa-erp.vercel.app`, đúng source merge. Metadata source và production target ổn định trước/sau probe.

`production407-readonly.cjs`: native exit0, **22/22 PASS**: anonymous và giả header/cookie trên Copilot, Care GET/POST, Portal issuer/invalid consumer, Announcements, Courses list/detail và medication. Copilot giữ DTO error-only; những route khác dùng DTO đã có. Deny kiểm tra status/code, shape và `no-store`.

`production-anon32-readonly.cjs`: native exit0, đúng hash allowlist `071c9dea409ff70660842b34b63f12f02b3fc755c7eb5e9ceee6a92d7442be9c`; **96/96 request trên đúng 32 bảng bị deny 42501**. Có `students`, `edu_fin_invoices`, `edu_fac_assets`. Courses anonymous 401, không classroom. Không tự mở rộng allowlist.

`production-rpc-readonly.cjs`: native exit0. Anonymous `exec_sql('SELECT 1')` nhận401/42501; service-role cùng constant SELECT nhận204. Không truy vấn business rows qua RPC. Điều này chỉ chứng minh quyền RPC tương ứng, không chứng minh authenticated RBAC/RLS.

## Catalog READ ONLY

`catalog-production-readonly.sql`: chạy qua Supabase CLI với `--linked --project-ref lvnvkpyxtuilhrabtlwv`, native exit0; evidence `read_only=on`. Chỉ đọc catalog14 relation phụ thuộc của các route đang acceptance, không đọc business rows. Lần gọi thiếu `--linked` bị CLI reject exit1 trước query; lần sửa flag được lưu đúng, không coi lần lỗi là PASS.

Phát hiện cần giải quyết riêng với đúng owner:

| Dependency | Production catalog thực tế | Giới hạn chứng minh |
|---|---|---|
| `edu_attendance_daily_state` | authenticated SELECT/INSERT=false, RLS theo `app.current_tenant_id` | Care GET có lookup attendance bằng session; ACL hiện tại chặn lookup hợp lệ khi đi tới bước này. Chưa phải request production bằng user hợp lệ. |
| `edu_enrollments` | authenticated ACL có; policy theo `app.current_tenant_id` | Chưa chứng minh cơ chế cung cấp context GUC qua phiên Auth thật; không tự SET ROLE/GUC thay session. |
| `edu_daily_care_sessions`, `edu_daily_care_records` | authenticated ACL có; policy đọc top-level JWT `tenant_id` | Cần chứng minh claim producer thực tế; app_metadata không tương đương top-level claim. |
| `edu_courses` | authenticated ACL có; policy dùng `get_auth_tenant_id()` | Khác baseline E2E đang thiếu grant và còn policy GUC; không suy E2E giống production. |

Anonymous SELECT grant còn trên một số relation ngoài32 không tự chứng minh lộ dữ liệu qua RLS. Lần này không revoke/grant/policy ngoài scope đã duyệt.

## Kết luận có giới hạn

Source production và các đường deny đã chứng minh. Containment anonymous chỉ PASS trong scope32 bảng/RPC/Courses đã kiểm tra. Chưa có authenticated user workflow production positive, chưa chứng minh RLS toàn Preschool, chưa đạt Go-Live. Dữ liệu output chỉ chứa metadata/status/counts/code; không lưu key, JWT, cookie hay business-row contents.
