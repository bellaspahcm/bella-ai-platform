# Bella Preschool — Contract phân quyền thao tác v1

**Trạng thái: APPROVED — owner duyệt matrix ngày21-10-2026 và yêu cầu triển khai từng nhóm. Contract có thẩm quyền cho implementation; chưa chứng nhận runtime hay production đã đáp ứng.**

**Quyết định đã được owner chốt ngày21-10-2026:** khóa API thuốc, đưa nghiệp vụ cho thuốc khỏi hoạt động Preschool. Quyết định này có hiệu lực độc lập với phần đề xuất còn lại.

Tài liệu này là nguồn chuẩn cho bốn nhóm thao tác đã phát hiện trong audit: Care bulk, phát hành link Portal, Announcements và API thuốc đã ngừng hỗ trợ. Owner đã chọn “Duyệt matrix đề xuất, triển khai từng nhóm”. Ngày 22-10-2026 owner bổ sung quyết định Enrollment v1 tại đoạn cuối mục8. Implementation và tests phải tham chiếu contract này; UI, policy cũ, dữ liệu mẫu và tên role không tự tạo quyền. Contract không chứng nhận implementation hiện tại hay production đã đáp ứng.

## 1. Ownership và giới hạn

- Platform sở hữu Auth, user, tenant, Party identity và dữ liệu quyền đơn vị tổ chức.
- Education sở hữu course, enrollment và teacher assignment qua public contract.
- Preschool sở hữu authorization cho workflow Care, parent communication và Portal.
- Healthcare Kernel không tham gia. Không thêm capability Healthcare, role y tế, bảng hay grant mới bằng tài liệu này.
- Contract Copilot đã duyệt ở `docs/audits/preschool-ai-copilot/ARCHITECTURE_GATE_RESULT.md` và `ARCHITECTURE_GATE_RESULT_PHASE_4.md` tiếp tục có phạm vi riêng; không dùng matrix dưới đây để thay quyền Copilot.

## 2. Context bắt buộc cho mọi thao tác đang hoạt động

Backend xác minh session bằng Auth provider, rồi đọc user và tenant hiện tại. User phải active, tenant active, profile ID trùng Auth subject và tenant đúng Product Preschool. Query/body/header/cookie không được chọn actor, role hay tenant thay session. Mọi tenant selector khác context, kể cả query parameter lặp, bị từ chối.

Quyền hiệu lực là giao của role được phép, tenant, branch, classroom, resource relationship và RLS. Thiếu một điều kiện thì từ chối. Không có ngoại lệ xuyên tenant mặc định cho `admin`/`super_admin`, không dùng service-role để vượt lỗi RLS. Background job chỉ được dùng service identity theo contract worker riêng, không tái sử dụng endpoint người dùng để bypass.

User ID, Person ID, Party ID, student ID và student Party ID là các identity khác nhau. Backend phải resolve mapping bằng producer/public contract có thẩm quyền; không coi UUID trùng kiểu hoặc relationship bất kỳ là bằng chứng mapping.

Mọi kiểm tra phải hoàn tất trước tạo care session, ghi record, tạo thread, ký token, gửi thông báo hay gọi side effect. Mapping thiếu/không rõ, catalog không khớp hoặc lookup lỗi thì fail closed; không fallback sang ID mẫu hoặc mở rộng kết quả.

## 3. Role mapping được duyệt

Đây là mapping **Product-local được owner duyệt**, không thay global roles hay `users.role` constraint:

| Role nguồn | Quyền ứng viên trong Preschool |
| --- | --- |
| `admin` | Quản trị Preschool trong đúng tenant và các branch đã được cấp |
| `admin_staff` | Giáo viên vận hành chỉ khi resolve được teacher Party và có phân công lớp còn hiệu lực |
| `parent`, `student`, `accountant`, `hr`, `ktv`, `ktv_lead` | Không được thực hiện staff mutation, mint Portal token hoặc broadcast trong contract này |
| Role khác, thiếu role, alias chưa được duyệt | Từ chối; không map theo tên hiển thị UI |

Authority của mapping là quyết định owner trong lượt này. Mapper tương tự trong Attendance chỉ là bằng chứng hành vi cũ, không phải căn cứ để mở rộng thêm role/alias cho Care/Portal/Announcements.

## 4. Matrix thao tác được duyệt

| Thao tác | `admin` | `admin_staff` có assignment | Role khác |
| --- | --- | --- | --- |
| Care GET roster/records | Cho phép trong branch được cấp | Chỉ lớp được phân công | Từ chối |
| Care POST arrival/meal/nap/hygiene | Trong branch được cấp | Chỉ lớp được phân công | Từ chối |
| Care POST `save_care` phần meal/nap/hygiene/note | Trong branch được cấp | Chỉ lớp được phân công | Từ chối |
| Care POST chứa derived health status/isAlert/alertReason từ UI | Chưa cho phép tới khi có governed care policy | Như admin | Từ chối |
| Phát hành Portal token | Cho phép khi đủ binding mục5 | Từ chối | Từ chối |
| Phát hành Announcements toàn trường | Cho phép khi có quyền trên toàn bộ tập branch nhận tin | Từ chối | Từ chối |
| Announcements theo lớp | Chưa hỗ trợ trong v1 | Chưa hỗ trợ trong v1 | Từ chối |
| API thuốc | **Đã bị owner vô hiệu hóa cho mọi caller** | **Vô hiệu hóa** | **Vô hiệu hóa** |

Care: course phải thuộc tenant, branch xác định được và nằm trong Platform access projection của actor. Teacher assignment phải active và có hiệu lực tại ngày nghiệp vụ. Mọi student trong payload phải có **active enrollment** vào đúng lớp/ngày. Chấp nhận enrollment `pending` là thay đổi khác, không tự suy từ service hiện có. Không vì một student hợp lệ mà cho phép cả bulk; một resource trái quyền làm toàn request thất bại trước ghi.

Phần derived health phải được backend tính từ policy được phê duyệt. Khi chưa có policy, payload có phần health phải nhận trạng thái unavailable rõ ràng và không ghi một phần âm thầm. Contract này không định nghĩa ngưỡng sốt, liều thuốc, diễn giải sức khỏe hay quyền tư vấn y tế.

## 5. Portal và Announcements

Portal issuance chỉ dành cho admin trong scope được cấp. Student và guardian phải tồn tại đúng tenant; student có active enrollment trong branch hợp lệ. Relationship phải là `guardian_of`/`parent_of` đúng chiều guardian→student, còn hiệu lực theo ngày bắt đầu/kết thúc. Không chọn guardian mặc định; nếu request không chỉ định và có nhiều guardian hợp lệ thì yêu cầu chọn rõ, không lấy hàng đầu tiên.

Token phải bind tenant + student Party + guardian Party, ký bằng secret cấu hình server; thiếu secret thì unavailable, không fallback hardcoded. **Token phát hành mới có TTL tối đa24 giờ**, không tự refresh; không tự xoay secret hoặc thay expiry của token đã ký. Mỗi lần đọc phải kiểm tra lại relationship và tenant hiện tại; expiry không thay thế quyền. Khả năng thu hồi từng token chưa được chứng minh, nên không tuyên bố có immediate revocation. Parent dùng token được cấp không đồng nghĩa có quyền tự mint token.

Announcements là bảng tin chung theo tenant, không phải tin nhắn riêng. Admin Preschool active chỉ được đăng khi có quyền trên mọi branch active trong tenant. Tạo một bản ghi canonical duy nhất với request ID ổn định để retry không nhân đôi. Mọi Portal link hợp lệ của guardian có quan hệ hiện hành với Student đang active enrollment được đọc cùng feed của tenant đó. Không tạo thread/delivery theo học sinh, không gửi email/push, không hỗ trợ scope theo lớp; chat riêng vẫn unavailable.

## 6. Error và kiểm chứng bắt buộc

- Không có Auth hợp lệ:401. Role/resource không được phép:403. Selector không được chuyển tenant/actor:403.
- Dependency/policy/identity mapping chưa đủ:503 với code ổn định, không lộ chi tiết DB; không trả success hoặc dùng dữ liệu mẫu.
- API thuốc ngừng hỗ trợ:410 `PRESCHOOL_MEDICATION_DISABLED` cho mọi POST, trước đọc payload/DB/service. Giữ lịch sử dữ liệu.
- Response chứa dữ liệu/quyền riêng tư phải `private, no-store`.

Tests phải có allowed actor; role bị cấm; active/inactive user/tenant; cùng Auth session đổi tenant/branch/course/student/guardian; duplicate selector; bulk có một resource trái quyền; relationship hết hạn; thiếu mapping/policy; lỗi RLS; bảo đảm không side effect trước authorize và không partial write. Cần real Auth + isolated fixtures + independent DB read-back để chứng minh runtime. Unit mock, source gate, preview hay merge không thay thế Real DB/RLS/Browser/production proof.

## 7. Dependency chưa được cấp quyền sửa

Platform `user_org_unit_access` là dữ liệu quyền branch cần reuse; `getUserAccessibleUnits()` hiện trả toàn bộ active unit không đủ làm authorization. Teacher assignment public contract đã có nhưng Auth→teacher Party mapping và effective dates phải được chứng minh trước enable.

Guardian repository hiện có lookup/fallback không đáp ứng predicate ở mục5; không được coi nó là trusted contract chỉ vì test cũ PASS. Bảng tin chung dùng một Product-owned tenant record và Portal token read; không tái sử dụng per-recipient communication lifecycle. Token revocation riêng chưa được chứng minh. Viết tài liệu không tự tạo những capability khác hoặc mở authority sửa Platform/Kernel/schema.

**Owner decision đã chốt:** mapping `admin`/`admin_staff`, active-enrollment-only, giữ derived health unavailable, Portal admin-only/TTL24h, broadcast admin-only và giữ class broadcast unavailable. Mỗi nhóm vẫn cần kiểm chứng producer/mapping và thực tế thực thi. Quyết định khóa API thuốc được owner chốt riêng trước matrix; không cần duyệt lại.

## 8. Attendance — quyết định batch2r ngày21-10-2026

Owner duyệt “Duyệt cả 5 nhóm đúng đề xuất” tại `docs/audits/preschool-full-audit-20261020/batch2r-remaining-remediation/IMPLEMENTATION_AUTHORITY.json`. Phần này áp dụng riêng Attendance; giữ nguyên các quyết định Care/Portal/Announcements và API thuốc ở trên. Phê duyệt không chứng nhận runtime, RLS hoặc production đã đạt.

Attendance xác minh Auth provider, profile ID trùng subject, user và tenant active trước đọc nghiệp vụ. Selector không được đổi actor/tenant/role. Request người dùng dùng client xác thực; không mock hoặc service-role fallback. Tenant của caller phải khớp resource cả tại HTTP, RPC và direct relation access. Với Product khác Preschool, chỉ bổ sung kiểm tra identity/tenant chung, giữ semantics role hiện hữu; không áp matrix Preschool cho Product khác.

Trong Preschool, chỉ `admin` được thao tác lớp active có đúng một binding tới branch active thuộc Platform `user_org_unit_access`. Đây là projection canonical: admin hiện có quyền các đơn vị active trong tenant; không tạo một bảng cấp branch riêng để thu hẹp hoặc mở rộng projection đó. `admin_staff` chỉ có thể được enable sau khi producer Auth→teacher Party và assignment hiệu lực được chứng minh; hiện trả503. Alias như `super_admin` và các role khác không được map ngầm sang admin Preschool.

Delta local/E2E ngày26-10-2026: owner duyệt tích hợp teacher Attendance sau capability Auth↔Party được kiểm chứng local, theo [Party Identity Link Authorization Contract](../../platform/PARTY_IDENTITY_LINK_AUTHORIZATION_CONTRACT.md) và [Change Map tích hợp](../../../implementation-artifacts/preschool-classroom-operations/identity-link/TEACHER_ATTENDANCE_INTEGRATION.md). Chỉ tại sandbox tổng hợp, `admin_staff` có thể vào Attendance qua JWT thật khi self-resolve link hiệu lực khớp Auth subject và tenant; canonical teacher assignment active và đúng ngày; confirmation cùng Party/tenant/branch chưa revoked và đúng ngày; course/branch active; explicit branch relationship; enrollment active với binding course/branch/request khớp. Confirmation/assignment dùng date inclusive; link dùng thời điểm hiệu lực theo public contract. Không suy academic year, Party hoặc branch từ tên hoặc metadata.

Product RPC `preschool_teacher_attendance_courses(date,uuid)` chỉ liệt kê lớp của caller đã xác thực, branch selector chỉ thu hẹp; không nhận actor/tenant/Party làm authority. Teacher đọc roster qua public contract và ghi bằng caller JWT với atomic Attendance writer có kiểm tra lại sau chờ; không dùng service credential thay quyền. Identity không cấp quyền guardian/pickup, Analytics, tuyển sinh hoặc quản lý giáo viên. Shared resolver mặc định vẫn giữ teacher held ngoài các Attendance route opt-in. Không đổi admin semantics hoặc quyền Product khác. Delta này không cho phép Production, dữ liệu thật hoặc Go-Live; kết quả thực thi nằm trong artifact tích hợp và không được suy từ phê duyệt.

Chỉ ngày hiện tại tại Việt Nam và enrollment active được tạo không muộn hơn ngày nghiệp vụ được enable. Historical/future path trả503 khi chưa có producer lịch sử hiệu lực. Timestamp roll-call phải là thời gian hợp lệ và rơi đúng school day tại Việt Nam. GET chỉ trả enrollment hợp lệ; POST kiểm tra enrollment/course/branch trước ghi. Lookup lỗi hoặc mapping thiếu/không rõ fail closed, không lộ DB/PII; mọi response `private, no-store`.

Ghi người dùng đi qua RPC đã authorize, giữ transaction append event + cập nhật đúng một daily projection. Authenticated direct INSERT/UPDATE/DELETE vào history/projection bị từ chối để không tạo mutation thiếu cặp hoặc sửa lịch sử. SELECT hợp lệ phải được chứng minh riêng dưới RLS. Worker service identity chỉ được nhận diện bằng PostgreSQL role thực đã được kiểm soát; request claim/GUC tùy ý không tạo worker authority.

Kiểm chứng bắt buộc: provider Auth thật, allowed path và cùng session đổi tenant/branch/course/enrollment; role bị cấm; inactive profile/tenant/branch/enrollment; mapping thiếu/ambiguous; historical/future day; direct RPC/REST bypass; rollback khi bước projection thất bại; DB read-back và fingerprint độc lập. API có thể tiếp tục HELD nếu RLS đọc Course/Enrollment canonical chưa cho caller hợp lệ đi qua; không sửa dependency hoặc dùng admin client để che lỗi. SQL chỉ rehearsal trong sandbox local đã duyệt. Source candidate chưa được coi là deployable migration trước proof. Không có quyền E2E/production hoặc publish từ quyết định này.


## 9. Enrollment v1 — quyết định owner ngày22-10-2026

Owner duyệt: Admin-only; chỉ ghi danh một Student Party đã tồn tại, có liên kết guardian canonical; enrollment mới phải `active`. Đây là quyền nghiệp vụ Product, không mở quyền tạo Party/Student/guardian, không cho sửa enrollment đã có, không cấp quyền bulk, và không thay đổi Education Kernel contract hoặc schema.

Trước mọi ghi, request phải xác minh Auth session/profile/tenant hiện hành; Product là `bella_preschool`; role đúng `admin`; course đang `active` và được bind duy nhất vào branch active có trong `user_org_unit_access`; Student Party đã được Education Student public contract xác nhận trong cùng tenant với academic status active; guardian phải là Party cùng tenant có relationship canonical `guardian_of` theo chiều guardian→student còn hiệu lực ngày hiện tại tại Việt Nam. Caller phải chỉ rõ guardian nếu có nhiều relationship; không chọn mặc định.

Enrollment được tạo qua Education public `EnrollmentContract` bằng request id ổn định để idempotency; không ghi trực tiếp bảng. Chỉ cho phép trạng thái khởi tạo `active`. Nếu canonical workflow xác định trạng thái khác `active`, API từ chối trước side effect. Không gửi override prerequisite, không tạo hồ sơ student/guardian, không thay thế relationship, không cho chuyển trạng thái hoặc enrollment lịch sử/ngày tương lai. RLS và caller-scoped client tiếp tục có thẩm quyền; mọi lỗi dependency/RLS trả unavailable mà không nâng quyền.

Candidate Student/guardian enumeration chưa có public read contract được duyệt; đến khi có contract đó, API chỉ nhận exact Student Party ID và guardian Party ID do Admin chọn từ nguồn canonical đã được cấp quyền. Không đưa danh sách toàn tenant ra màn hình.

## 10. School-wide Portal bulletin — quyết định Owner ngày23-10-2026

Owner xác nhận Announcement là một thông báo chung theo tenant: phụ huynh có con và Portal link hợp lệ đều đọc được trong Parent Portal. Đây không phải gửi tin riêng. Chat riêng chưa được triển khai.

- Chỉ Preschool `admin` được đăng thông báo cho toàn tenant, khi actor có quyền trên mọi branch active theo `user_org_unit_access`.
- Mỗi lần đăng tạo một bản ghi duy nhất gắn tenant và request ID ổn định. Retry cùng request ID và nội dung trả lại bản ghi đã tạo; dùng lại ID với nội dung khác bị từ chối.
- Portal chỉ đọc feed của tenant trong token đã ký sau khi server xác minh lại tenant, active enrollment, Course/branch và quan hệ guardian hiện hành. Không nhận tenant, Course, Student hoặc guardian selector từ query/body.
- Feed không tạo thread/delivery, không gửi email/push, không hỗ trợ scope theo lớp, và không bật chat.
- Authority ngày23-10 cho phép schema/capability local Non-Production và kiểm tra isolation/recovery. Không cho phép remote migration, Production, commit, push, merge hoặc deploy.
