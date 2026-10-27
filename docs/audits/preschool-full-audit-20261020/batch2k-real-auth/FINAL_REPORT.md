# Preschool — Real Auth acceptance và production sau PR407

Branch: `codex/preschool-real-auth-rls-acceptance-20261021`. Runtime baseline: `ecfaf23ab06d043c5f2caec38ea67856705b6c26`; source Product/Platform/Kernel không thay đổi trong batch này. Production và DB E2E được xác minh riêng, không suy hai schema giống nhau.

## Kết quả production

- Production deployment `dpl_BfU1Mv62WBuJ52Xwqcvjc2xFB4r9`, READY, source đúng merge PR407, domain chính đúng target và ổn định trong probe.
- HTTP deny: **22/22 PASS** với anonymous/giả header-cookie/invalid token; response `private, no-store`.
- Chính xác32 bảng: **96/96 anonymous request deny42501**; Courses401, zero classroom returned.
- `exec_sql('SELECT 1')`: anon401/42501, service204. Chỉ constant SELECT, không đọc business rows.
- Catalog READ ONLY xác nhận authenticated thiếu SELECT attendance daily state; enrollment còn dùng GUC, Care còn dùng top-level JWT tenant. Đây là dependency cần xử lý đúng owner, chưa phải bằng chứng workflow người dùng production hợp lệ.

Chi tiết và command native exit0 trong [PRODUCTION_VERIFICATION.md](PRODUCTION_VERIFICATION.md). Agent không thực hiện merge/deploy/DDL/DML production trong batch này.

## Real Auth trên E2E

Project duy nhất được ghi fixture: `bmnbqbcdbuklhopfbopv`, khác production `lvnvkpyxtuilhrabtlwv`. Harness kiểm tra URL, DB username/project binding, key role, runtime tree và không có Next tự nạp env trước tạo Auth/fixture. Maintenance connection chỉ setup/readback/cleanup; Next child chỉ có public key, không có privileged key. Mỗi actor đăng nhập thật qua Supabase Auth, xác minh subject rồi gửi cookie SDK chỉ trong bộ nhớ.

Lượt đầu native exit1: fixture assumption về claims producer sai; live DB không có trigger sync app_metadata. Không thêm trigger/claim giả. Toàn bộ Auth/profile/branch/person/relationship đã xóa,2 tenant shell terminated còn giữ do audit history; zero active authority. Bằng chứng raw giữ nguyên.

Lượt thứ hai native exit1:33 PASS,72 FAIL,13 NOT_PROVEN. Cả72 FAIL tại assertion literal `private` sau khi status và error code đã khớp. Profile, tenant helper, org RLS và own projection positive controls đạt; projection negative của lượt này cần bản sửa review bên dưới. HTTP200 đúng tenant cho6 actor đạt. Source proxy đặt `no-store, must-revalidate` trước Next local response adapter; production probe thấy `private, no-store`. Giữ raw FAIL và [failure-classification.json](failure-classification.json); không đổi response Product hoặc assertion để tuyên bố full PASS.

Lượt sau khi tách header [results-2026-10-20T23-29-58-907Z.json](results-2026-10-20T23-29-58-907Z.json) có native exit0,105 PASS /0 FAIL /85 NOT_PROVEN. Review sau đó phát hiện negative projection bị own-user filter che mất foreign fixture; **không dùng kết quả lượt này để chứng nhận projection khác tenant**. Bản sửa hỏi trực tiếp foreign admin+branch, giữ positive control của chính foreign admin và FAIL nếu thấy row hoặc lookup lỗi. Review cũng yêu cầu Courses response bất ngờ phải FAIL và cấm Auth/REST theo redirect.

Lượt có ba sửa trên [results-2026-10-20T23-36-30-218Z.json](results-2026-10-20T23-36-30-218Z.json) có105 PASS /0 FAIL /85 NOT_PROVEN nhưng native exit1 vì lệnh bulk profile cleanup lỗi; readback cuối vẫn zero Auth/profile/active authority. Raw FAIL được giữ nguyên. Harness đổi cleanup theo lifecycle Auth owner: revoke profile authority, AuthAdmin xóa từng user, rồi chỉ dọn residual profile còn lại theo UUID.

**Lượt Real Auth chốt:** [results-2026-10-20T23-40-02-139Z.json](results-2026-10-20T23-40-02-139Z.json), native exit0, **105 PASS /0 FAIL /85 NOT_PROVEN**, cleanup0 lỗi; aggregate **PARTIAL_NOT_PROVEN**. Harness đã chạy SHA256 `fd72e811a46f4dccdc5701c22f9cc1f5427798684df0b6d917c13e314fe87632`; snapshot nguyên vẹn được giữ cùng folder. Foreign projection sentinel thực sự được query và bị deny, có own positive control. Không gọi đây là full acceptance PASS. Trong85 phần chưa chứng minh có72 literal header `private` local,6 metadata producer,3 ACL Education,2 Courses allowed HTTP,1 Care positive/mixed-student và1 valid Portal/broadcast delivery.

Các ca chạy thật gồm6 Auth login/subject,6 own profile+tenant helper,6 org RLS và6 access projection controls,6 HTTP tenant context đúng session, cùng72 authorization status/error-shape cases. Scoped readback kiểm tra được `chat_messages` không đổi;6 relation side-effect khác thiếu, nên **không** tuyên bố zero-write Care/broadcast toàn workflow. Profile/tenant inactive được kiểm tra bằng chính session đã đăng nhập trước thay trạng thái. Raw105 là tổng assertion/check, không phải105 user workflow hay105 test suites.

Cleanup lượt chốt: zero Auth/public users, zero active tenant, zero branch/person/relationship; giữ2 tenant shell terminated có immutable audit. Readback độc lập [cleanup-cross-run-final.json](cleanup-cross-run-final.json) cho cả5 lượt:10 shell **đều terminated**, zero Auth/profile; không giữ quyền hoạt động. Listener Next đã đóng, catalog policy/helper/ACL snapshot và runtime source digest ổn định. Không có schema/grant/helper sửa để kiểm thử xanh.

Sau lượt Real Auth, một dòng recovery được sửa để lỗi xóa residual profile đầu tiên không ngăn các UUID sau được thử dọn. Harness cuối SHA256 `af7108743be5adcd35e6ac92ae9171193ec4d1673778610f567a7e775eb249fe`. Targeted fault-injection unit thực thi đúng hàm cleanup: trước sửa FAIL, sau sửa PASS; lỗi23503 vẫn được giữ và residual vẫn làm cleanup FAIL. Unit dùng fake DB/Auth, zero network; **không phải Real Auth/RLS proof**, không tuyên bố full remote harness đã rerun ở hash cuối. Ba reviewer xác nhận patch; Product runtime vẫn đúng baseline ecfaf23a trong cả hai hash harness.

Service-role SELECT LIMIT0 trên đúng32 bảng:32/32 PASS, zero business rows fetched; chỉ chứng minh service access, không thay authenticated regression. Transport guard unit4/4 PASS là fake-fetch proof cho target/redirect, không phải Auth/RLS. Production target đọc lại cuối batch vẫn READY đúng merge407.

## Phần chưa chứng minh / blocker cụ thể

| Gate | Trạng thái | Căn cứ / việc cần làm |
|---|---|---|
| Care admin allowed roster/write + mixed-student zero write | NOT_PROVEN | E2E thiếu session/record/attendance; course/enrollment/Party thiếu authenticated SELECT. Không cấp grant/provision tạm. |
| Full authenticated RBAC/RLS Preschool | NOT_PROVEN | Org projection không thay thế policy của các bảng nghiệp vụ; tenant-only policy không chứng minh branch/resource role matrix. |
| Portal phát hành, guardian binding thật, broadcast delivery | NOT_PROVEN | Canonical composition vẫn held503; valid-token/fanout không chạy. Thuốc vẫn410. |
| Header literal private trong Next local | NOT_PROVEN | Tách khỏi status/code authorization; không sửa proxy chung trong scope này. |
| Browser UI E2E và mutation chính thức | NOT_RUN | Đây là real HTTP/API/PostgREST acceptance, chưa có Browser proof. |
| Full Education/Healthcare DB regression | NOT_RUN trong batch này | Prerequisite E2E thiếu; không chạy hàng loạt suite ghi dữ liệu hoặc toàn migration history để ép xanh. Kết quả fail offline trước đó vẫn giữ, không được đổi thành PASS. |

## Applicability của11 gates

Đây là test harness/evidence, không thêm Product feature. Gate1/2: runtime/Kernel/Public Contract unchanged, review diff và source digest; Gate3/4: chỉ phạm vi identity/org projection + authorization guards thực sự chạy; Gate5: NOT_APPLICABLE vì không có migration; Gate6–10: NOT_APPLICABLE cho harness không tạo academic/event/governance capability, không chứng nhận các gate nghiệp vụ đó; Gate11: full Platform regression NOT_RUN ở batch này, không dùng source unchanged làm regression PASS.

## Trạng thái bắt buộc

| Chỉ tiêu | Kết quả |
|---|---|
| PRODUCTION_CHANGE | NOT_RUN trong batch này; rollout của owner đã xác minh đúng source407 |
| ANONYMOUS_CONTAINMENT | PASS trong scope32 bảng, exec_sql và các đường Courses/API đã probe |
| AUTHENTICATED_ACCESS_REGRESSION | NOT_PROVEN toàn workflow; kết quả scoped nằm trong report Auth thật |
| BATCH2B_RBAC_RLS | IN_PROGRESS |
| PRESCHOOL_GO_LIVE | NOT_READY |

Không mở lại anonymous, không sửa Healthcare/Education Kernel, không thêm mapping/semantics, không lưu password/key/JWT/cookie hay business-row contents. Báo cáo này không thay thế các gate độc lập còn thiếu.
