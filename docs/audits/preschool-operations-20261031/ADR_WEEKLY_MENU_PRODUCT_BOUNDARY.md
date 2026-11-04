# ADR — Weekly Menu thuộc Bella Preschool Product

Ngày: 2026-11-02  
Trạng thái: **BOUNDARY DECISION CONFIRMED; IMPLEMENTATION DEFERRED**  
Người quyết định: chủ dự án trong chat này. Phạm vi: F09 / PR #479.

## Bối cảnh

Education Constitution đóng băng `src/platform/education/` và xác định năm bounded contexts học vụ. Weekly Menu là nghiệp vụ dinh dưỡng riêng Preschool. Hai bảng `edu_weekly_menus` và `edu_weekly_menu_days` được khai báo cho Preschool Weekly Nutrition trong migration `20261020110000_p43_preschool_weekly_menu.sql`; tên `edu_` không tự xác lập chúng là một trong năm Kernel contexts. Kết luận ownership này là quyết định cho F09, không phân loại toàn bộ các bảng `edu_*` khác.

Thiết kế cũ đề nghị thêm facade vào Education Kernel đã được chủ dự án thay thế. CI hiện chặn bốn direct-query signature mới trong Product; bù trừ nhiều request không chứng minh transaction F09.

## Quyết định

```text
Preschool UI/API → Product service → Product contract
  → Product persistence adapter → preschool_save_weekly_menu
  → PostgreSQL transaction (edu_weekly_menus + edu_weekly_menu_days)
```

Contract, service và adapter thuộc Bella Preschool Product. RPC là phương án transaction được chọn, chưa tồn tại/chưa được chứng minh. Không tạo Education Engine, không thêm contract vào `src/platform/education/contracts/`, không unlock Education Kernel. Không sửa guard/baseline để lách kiểm soát. Không sửa RLS, tenant isolation hoặc quyền Production theo quyết định này.

`admin` là Admin tổng trong tenant; được quản trị Weekly Menu của trường, kể cả menu do Staff tạo. Admin Staff chỉ ghi khi có grant hợp lệ; không mặc định publish. Không tự nâng quyền hay thiết kế lại RBAC. Khi update, `expectedUpdatedAt` bắt buộc và stale version phải conflict; mọi thay đổi master/days phải commit cùng nhau hoặc rollback toàn bộ. Không cần hai người duyệt.

## Đối chiếu enforcement

Education CI scanner trong `scripts/ci-run-education-architecture.mjs` quét `.ts` dưới `src/products/bella-education`, ngoài tests. Nó chặn signature mới của `.from()` literal với các prefix được liệt kê trong script và `.rpc()` literal bất kỳ; không phân biệt Product-owned với Kernel-owned. Do đó adapter Product-owned gọi RPC literal mới chưa có đường qua rule hiện tại. Bảng baseline là khoản nợ được nhận diện, không phải chấp thuận cho truy cập mới. Rule text có giới hạn nhận diện; né bằng biến, đổi vị trí/format hoặc đổi client không phải giải pháp.

`npm run education:architecture:ci` đã **BLOCK** bốn signature Weekly Menu; `node scripts/test-ci-education-architecture.mjs` đã PASS ba kiểm tra comparator (same/new/reduced). Đây không chứng minh guard có thể xác thực ownership. Workflow Architecture Guard gọi scanner khi scope Education phù hợp; các control khác phải được xác minh theo thay đổi cụ thể.

## Hệ quả và bước tiếp theo

F09 **DEFER IMPLEMENTATION**: chưa có contract/adapter/RPC/migration mới hoặc bằng chứng DB thật. Cần thiết kế riêng và review độc lập một control có thể xác minh boundary Product-owned mà vẫn chặn truy cập Kernel, RPC trái phép, cross-Product, truy cập sai vị trí và tên động không giải quyết được. Không mặc định cho phép toàn prefix, toàn Product hoặc dùng baseline. Cần independently authorized control change nếu đó là đường được chọn; không thực hiện trong ADR này.

Trước implementation, xác định và chứng minh producer grant Staff hoặc fail closed cho Staff; xác minh các quyền caller/RLS hiện có và tính khả thi transaction trong môi trường an toàn được phép. Kiểm chứng real Auth/RLS, tenant A/B, được phép/từ chối, tạo/sửa/đọc lại, bỏ ngày, rollback từng bước, concurrency và stale version. Không có Production mutation, merge, deploy, hay Go-Live authority từ ADR này.

Hồ sơ ACR chi tiết, bằng chứng, và các lựa chọn guard nằm tại [WEEKLY_MENU_CONTRACT_PROPOSAL.md](WEEKLY_MENU_CONTRACT_PROPOSAL.md). Các thất bại CI trước đây vẫn được giữ nguyên trong Actions; quyết định này không chuyển chúng thành PASS.
