# PR #479 — đề xuất ranh giới Weekly Menu

Ngày: 2026-11-02. Trạng thái: UNDER_REVIEW; chưa được duyệt, chưa triển khai.
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

Contract tối thiểu: `saveMenu(tenantId, actorId, input, expectedUpdatedAt?) -> { menuId, updatedAt }`. Input giữ các field SaveWeeklyMenuInput hiện có, được định nghĩa bằng kiểu trung lập tại boundary; facade không import kiểu Product. Server trả DTO hiện hành cho UI. GET/list hiện có không đổi trong đợt F09 này; debt đọc hiện hành được ghi nhận, không gọi đó là hợp chuẩn hoàn toàn.

## Ngữ nghĩa lưu nguyên tử đề xuất

Một RPC / một transaction: xác minh Auth subject và tenant đang hoạt động; xác minh role admin/admin_staff từ nguồn chuẩn, chỉ admin publish; không tin tenant/actor/role do client gửi. Dùng caller-bound client thay cho service-role fallback ở đường save. Giữ nguyên RLS, không SECURITY DEFINER/bypass mặc định.

Khóa theo tenant + year/week/ageGroup (bao gồm trường hợp chưa có master), rồi khóa master hiện có; khóa unique constraint tiếp tục bảo vệ identity. Với menuId được gửi mà không tồn tại trong tenant thì trả NOT_FOUND, không INSERT thay. Validate ngày hợp lệ, không trùng dayOfWeek, ngày nằm trong khoảng thực đơn, payload JSON và trạng thái trước khi ghi.

Trong cùng transaction: tạo/cập nhật master, upsert toàn bộ days, xóa days không còn trong input, read-back identity/version rồi trả kết quả. Bất kỳ lỗi nào phải rollback toàn bộ; loại bỏ bù trừ ở client. Gửi lại cùng input giữ cùng menu identity và không nhân bản days. Nếu expectedUpdatedAt được gửi và không khớp thì CONFLICT; cần bạn chốt có bắt buộc version khi sửa không. Không thêm domain event mới cho đường này.

## Bằng chứng cần có sau khi được duyệt

Gates 1–2: architecture/public boundary và không có truy vấn mới ở Product. Gates 3–4: real Auth/RLS, tenant A/B, sai actor, role teacher, admin_staff publish và denied writes. Gate 5: kiểm tra migration/ACL, recovery và môi trường được phép trước apply. Gate 11: service/API regression và affected consumers.

F09 bắt buộc real DB: create và update đọc lại đủ master/days; bỏ một ngày phải xóa đúng ngày đó; ép lỗi sau master/upsert/delete phải chứng minh toàn bộ state cũ còn nguyên; concurrent save cùng identity; retry không duplicate; stale-version conflict nếu được chọn. Mocks không chứng minh transaction/RLS. Gates 6–10 không có thay đổi event, grading, temporal hay audit/export trong đề xuất này; nếu phát hiện dependency tương ứng phải đánh giá lại. Không có bằng chứng Production hoặc Go-Live từ các test này.

## Điểm cần chủ dự án chốt

1. Duyệt ranh giới facade riêng Weekly Menu và migration RPC nguyên tử nêu trên, qua ACR/ADR giới hạn artifact; hoặc chỉ định boundary khác.
2. Khi sửa menu, dùng expectedUpdatedAt bắt buộc (đề xuất để phát hiện ghi đè) hay giữ hành vi người ghi sau thắng? Đây là thay đổi hành vi cần chốt trước code.

Kết quả entry gate cho implementation: DEFER tới khi hai quyết định trên được chốt. Không có runtime/Kernel/schema code được viết trong hồ sơ này.
