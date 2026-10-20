# Bella Preschool — Contract phân quyền thao tác v1

**Trạng thái: APPROVED — owner duyệt matrix ngày21-10-2026 và yêu cầu triển khai từng nhóm. Contract có thẩm quyền cho implementation; chưa chứng nhận runtime hay production đã đáp ứng.**

**Quyết định đã được owner chốt ngày21-10-2026:** khóa API thuốc, đưa nghiệp vụ cho thuốc khỏi hoạt động Preschool. Quyết định này có hiệu lực độc lập với phần đề xuất còn lại.

Tài liệu này là nguồn chuẩn cho bốn nhóm thao tác đã phát hiện trong audit: Care bulk, phát hành link Portal, Announcements và API thuốc đã ngừng hỗ trợ. Owner đã chọn “Duyệt matrix đề xuất, triển khai từng nhóm”. Implementation và tests phải tham chiếu contract này; UI, policy cũ, dữ liệu mẫu và tên role không tự tạo quyền. Contract không chứng nhận implementation hiện tại hay production đã đáp ứng.

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

Announcements phải resolve tập người nhận trên server từ guardian/student/enrollment hợp lệ trong tenant và scope admin. Dùng communication lifecycle theo từng student/guardian; không global thread ID, không student/guardian UUID giả. Việc phát hành phải idempotent và có trạng thái phản ánh lỗi từng recipient theo contract producer. Nếu chưa có producer đảm bảo việc này, giữ thao tác unavailable; không tự tạo schema hoặc gửi fanout dở dang để đáp ứng UI.

## 6. Error và kiểm chứng bắt buộc

- Không có Auth hợp lệ:401. Role/resource không được phép:403. Selector không được chuyển tenant/actor:403.
- Dependency/policy/identity mapping chưa đủ:503 với code ổn định, không lộ chi tiết DB; không trả success hoặc dùng dữ liệu mẫu.
- API thuốc ngừng hỗ trợ:410 `PRESCHOOL_MEDICATION_DISABLED` cho mọi POST, trước đọc payload/DB/service. Giữ lịch sử dữ liệu.
- Response chứa dữ liệu/quyền riêng tư phải `private, no-store`.

Tests phải có allowed actor; role bị cấm; active/inactive user/tenant; cùng Auth session đổi tenant/branch/course/student/guardian; duplicate selector; bulk có một resource trái quyền; relationship hết hạn; thiếu mapping/policy; lỗi RLS; bảo đảm không side effect trước authorize và không partial write. Cần real Auth + isolated fixtures + independent DB read-back để chứng minh runtime. Unit mock, source gate, preview hay merge không thay thế Real DB/RLS/Browser/production proof.

## 7. Dependency chưa được cấp quyền sửa

Platform `user_org_unit_access` là dữ liệu quyền branch cần reuse; `getUserAccessibleUnits()` hiện trả toàn bộ active unit không đủ làm authorization. Teacher assignment public contract đã có nhưng Auth→teacher Party mapping và effective dates phải được chứng minh trước enable.

Guardian repository hiện có lookup/fallback không đáp ứng predicate ở mục5; không được coi nó là trusted contract chỉ vì test cũ PASS. Communication broadcast fanout/idempotency và token revocation chưa được chứng minh. Viết tài liệu không tự tạo những capability đó hoặc mở authority sửa Platform/Kernel/schema.

**Owner decision đã chốt:** mapping `admin`/`admin_staff`, active-enrollment-only, giữ derived health unavailable, Portal admin-only/TTL24h, broadcast admin-only và giữ class broadcast unavailable. Mỗi nhóm vẫn cần kiểm chứng producer/mapping và thực tế thực thi. Quyết định khóa API thuốc được owner chốt riêng trước matrix; không cần duyệt lại.
