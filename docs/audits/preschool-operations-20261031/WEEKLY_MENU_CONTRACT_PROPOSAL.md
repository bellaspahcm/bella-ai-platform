# PR #479 — đề xuất ranh giới Weekly Menu

Ngày: 2026-11-02. Trạng thái: UNDER_REVIEW về boundary; mô hình nghiệp vụ Admin tổng/Admin Staff và version bắt buộc đã được chủ dự án chốt trong chat; chưa triển khai.
Người chốt quyết định: chủ dự án trong chat này.

## Bằng chứng hiện tại

`weekly-menu.service.ts` thêm bốn vị trí truy vấn so với baseline:

| Vị trí ở commit eaada4877 | Thao tác | Mục đích |
| --- | --- | --- |
| 307 | SELECT edu_weekly_menus theo tenant/id | Chụp master cũ khi sửa theo ID |
| 388 | DELETE edu_weekly_menus theo tenant/id | Bù trừ master mới khi upsert ngày thất bại |
| 394 | UPDATE edu_weekly_menus theo tenant/id | Khôi phục master cũ khi upsert ngày thất bại |
| 410 | DELETE edu_weekly_menu_days theo tenant/menu, loại ngày được gửi | Xóa ngày bị bỏ khỏi thực đơn |

Guard đo số vị trí truy vấn theo file, không đếm số lần chạy; UPDATE/DELETE bù trừ chỉ chạy ở nhánh lỗi. Không có INSERT mới trong bốn vị trí này.

Bù trừ hiện tại không phải transaction: reader có thể thấy master mới trước khi days được ghi; tiến trình có thể dừng trước rollback; lỗi DB trả về ở rollback/cleanup chưa được xử lý đầy đủ. Vì vậy F09 chưa được chứng minh hoàn tất.

Đã kiểm tra `src/platform/education/contracts/`: các contract course, enrollment, attendance, assessment, student, preschool operations/registry, extension, policy/workflow registry không có lệnh Weekly Menu. `preschool-operations.contract.ts` chỉ có openAdmission/assignEnrollment. `src/platform/core/repository/base-supabase-repository.primitive.ts` chỉ ánh xạ lỗi và optimistic-lock; không cung cấp transaction cho menu. Contract DTO hiện có trong Product không phải cổng persistence được guard cho phép.

## Quyết định đề xuất (ACR nháp cho phạm vi hẹp)

Weekly Menu là aggregate của Preschool Nutrition, không thuộc năm engine học vụ Education. Quyền sở hữu nghiệp vụ và các DTO hiện có ở Product được giữ nguyên. Đề xuất bổ sung public facade cho riêng khả năng lưu aggregate, không thêm engine hoặc trách nhiệm cho Kernel.

Phạm vi thay đổi cần chủ dự án duyệt: hai file mới `src/platform/education/contracts/preschool-weekly-menu.contract.ts` và `.contract.impl.ts` theo mẫu facade Preschool hiện có; một migration bổ sung hàm `preschool_save_weekly_menu` trên hai bảng hiện có; kiểu RPC; thay đường save trong service/API và các test liên quan. Đây là đề xuất bổ sung trong thư mục frozen; cần ACR/ADR và unlock đúng hai artifact mới trước triển khai, không mở khóa cả thư mục. Không thay guard/baseline, bảng Kernel, RLS hiện có hay cấp quyền Production. Migration chỉ là kế hoạch; chưa có quyền áp dụng lên bất kỳ DB dùng chung/Production nào.

Contract tối thiểu: `saveMenu(tenantId, actorId, input) -> { menuId, updatedAt }`. Input phân biệt create và update; update bắt buộc có `menuId` và `expectedUpdatedAt`, create không được biến thành ghi đè ngầm khi identity đã tồn tại. Các field còn lại giữ SaveWeeklyMenuInput hiện có, được định nghĩa bằng kiểu trung lập tại boundary; facade không import kiểu Product. Server trả DTO hiện hành và version mới cho UI. GET/list cần cung cấp version cho client sửa; đây là phần bổ sung dữ liệu tối thiểu của F09, không phải mở rộng quyền đọc. Debt đọc hiện hành được ghi nhận, không gọi đó là hợp chuẩn hoàn toàn.

## Quyết định nghiệp vụ và đối chiếu quyền hiện có

Chủ dự án chốt: không thiết kế lại RBAC, không thêm role, không quy trình hai người duyệt. Admin tổng của trường được quản trị Admin Staff và toàn quyền Weekly Menu trong đúng tenant; Admin Staff thực hiện theo quyền được giao, không tự cấp quyền hoặc sửa quyền Admin tổng. Admin tổng được sửa/thay thế menu do Staff tạo, nhưng vẫn phải đọc version hiện hành; toàn quyền không bỏ kiểm tra ghi đè hoặc tenant isolation. Quyền quản trị này không cho tự nâng thành quản trị Platform/xuyên tenant.

| Hành vi Weekly Menu | Admin tổng đã được resolve từ nguồn chuẩn | Admin Staff |
| --- | --- | --- |
| Xem | Có trong tenant | Có trong tenant, theo phạm vi đọc hiện hành |
| Nhập/sửa | Có | Chỉ khi có quyền được giao và còn hiệu lực |
| Duyệt/xuất bản | Có | Không mặc định; chưa bật khả năng ủy quyền publish trong F09 |
| Tự cấp quyền | Quản lý Staff trong phạm vi quản trị hiện có | Không |

Bằng chứng source tại commit 27184bf3c (không phải kiểm chứng DB/Production):

- `docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md` mục 3 và 8: mapping admin/admin_staff áp dụng theo workflow; admin_staff còn được dùng cho giáo viên có assignment. Không đổi mapping của Care/Attendance từ quyết định Weekly Menu.
- `src/platform/security/current-actor.contract.ts`: profile tự phạm vi, reconcile Auth subject, user/tenant active; có thể tái sử dụng làm nguồn actor. Tên gọi Super Admin của trường chưa tự động đồng nghĩa role global super_admin.
- `src/products/bella-education/finance/services/preschool-finance-authorization.service.ts`: Finance nhận admin/super_admin/owner và chỉ hai role sau có isSuperAdmin; đây là semantics Finance, không phải bằng chứng quyền Weekly Menu hay quản lý tài khoản.
- `src/app/dashboard/settings/PermissionsTab.tsx`, `src/services/tenant-actions.ts`, `src/components/layout/sidebar.tsx`: đã có tenants.role_permissions, cấu hình role/module và điều khiển navigation. Chưa thấy schema quyền thao tác Weekly Menu hoặc grant theo từng user được API Weekly Menu sử dụng. Quyền module/sidebar không tự cấp quyền ghi DB. Không dùng các default UI để cho mọi admin_staff được nhập menu.
- `src/app/api/education/nutrition/weekly-menu/route.ts:149`: POST hiện cho admin/admin_staff qua bằng tên role; chưa kiểm tra delegation. Publish chỉ cho admin. Chưa đáp ứng mô hình vừa chốt.
- `src/services/user-actions.ts`: createUser/deleteUser đang giữ IDENTITY_MANAGEMENT_HOLD; updateUser/updateUserStatus lọc tenant nhưng chưa có kiểm tra actor/target/assignable-role đầy đủ ngay trong các hàm đã đọc. Vì chưa kiểm tra DB/RLS, chưa kết luận khai thác được; cũng không thể chứng nhận Admin Staff management đã đáp ứng. Không mở hold hoặc sửa shared identity trong F09.

Kết luận đối chiếu: tái sử dụng actor/tenant và kho cấu hình hiện có nếu được xác nhận đủ semantics và enforcement; không tạo hệ permission song song. Cần chốt mapping Admin tổng và producer/grant quyền ghi Staff trước implementation. Nếu kho hiện có chỉ cấp theo role, phải nêu rõ giới hạn trước khi bổ sung quyền theo cá nhân; không tự đổi yêu cầu thành cấp cho toàn bộ Staff. Quản trị hồ sơ/tài khoản Staff là dependency cần xử lý riêng theo authority của Platform, không phải dự án RBAC toàn hệ thống.

## Ngữ nghĩa lưu nguyên tử đề xuất

Một RPC / một transaction: xác minh Auth subject và user/tenant đang hoạt động; resolve Admin tổng hoặc Staff có quyền thao tác còn hiệu lực từ producer chuẩn trong cùng tenant; chỉ Admin tổng publish trong F09. Kiểm tra lại tại final persistence boundary, không tin role/grant/tenant/actor do client gửi. Dùng caller-bound client thay cho service-role fallback ở đường save. Giữ nguyên RLS, không SECURITY DEFINER/bypass mặc định.

Khóa theo tenant + year/week/ageGroup (bao gồm trường hợp chưa có master), rồi khóa master hiện có; khóa unique constraint tiếp tục bảo vệ identity. Với menuId được gửi mà không tồn tại trong tenant thì trả NOT_FOUND, không INSERT thay. Validate ngày hợp lệ, không trùng dayOfWeek, ngày nằm trong khoảng thực đơn, payload JSON và trạng thái trước khi ghi.

Trong cùng transaction: tạo/cập nhật master, upsert toàn bộ days, xóa days không còn trong input, read-back identity/version rồi trả kết quả. Bất kỳ lỗi nào phải rollback toàn bộ; loại bỏ bù trừ ở client. Khi update, thiếu expectedUpdatedAt bị từ chối trước ghi; version không khớp trả CONFLICT kể cả Admin tổng. Retry với version cũ không được ghi lại; client reload khi conflict. Create trùng identity phải trả conflict, không upsert master âm thầm. Days giữ unique identity để không nhân bản. Không thêm domain event mới cho đường này.

## Bằng chứng cần có sau khi được duyệt

Gates 1–2: architecture/public boundary và không có truy vấn mới ở Product. Gates 3–4: real Auth/RLS, tenant A/B, sai actor, role teacher, admin_staff publish và denied writes. Gate 5: kiểm tra migration/ACL, recovery và môi trường được phép trước apply. Gate 11: service/API regression và affected consumers.

F09 bắt buộc real DB: create và update đọc lại đủ master/days; bỏ một ngày phải xóa đúng ngày đó; ép lỗi sau master/upsert/delete phải chứng minh toàn bộ state cũ còn nguyên; concurrent save cùng identity; retry không duplicate; missing/stale version bị từ chối, hai update cùng version chỉ một thành công. Cần Admin tổng sửa menu của Staff, Staff không grant bị từ chối, grant hợp lệ trong tenant được ghi, thu hồi grant có hiệu lực tại final write, không tự cấp quyền, không publish mặc định và không thay actor/tenant từ client. Mocks không chứng minh transaction/RLS. Gates 6–10 không có thay đổi event, grading, temporal hay audit/export trong đề xuất này; nếu phát hiện dependency tương ứng phải đánh giá lại. Không có bằng chứng Production hoặc Go-Live từ các test này.

## Điểm cần chủ dự án chốt

1. Duyệt ranh giới facade riêng Weekly Menu và migration RPC nguyên tử nêu trên, qua ACR/ADR giới hạn artifact; hoặc chỉ định boundary khác.
2. Đã chốt expectedUpdatedAt bắt buộc khi sửa, không cần hỏi lại. Còn cần chứng minh/chốt mapping Admin tổng và nguồn quyền thao tác Staff hiện có; không suy từ tên role hoặc sidebar. Nếu thiếu producer được phép thì giữ implementation phụ thuộc ở DEFER, trình phần bổ sung tối thiểu riêng.

Kết quả entry gate cho implementation: DEFER tới khi boundary và producer quyền được chốt. Không có runtime/Kernel/schema code được viết trong hồ sơ này. Mô hình nghiệp vụ vừa chốt không tự mở khóa Kernel, shared identity, RLS hay quyền Production.
