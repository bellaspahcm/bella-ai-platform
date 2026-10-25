# Bản đồ thay đổi: Quản lý chi nhánh Preschool

## Yêu cầu và phân loại

- Thêm mục menu và trang quản lý chi nhánh cho Preschool; cho phép quản trị viên liệt kê và tạo chi nhánh.
- `EXISTING_CAPABILITY_REUSE`: OrgUnit Platform contract là nguồn chuẩn cho `org_units` và `unit_type = branch`.
- `BACKEND_EXTENSION`: thêm API quản lý chi nhánh và wrapper Preschool trên contract hiện có.
- Không đổi giao diện các trang Preschool đang có; trang quản lý chi nhánh là trang mới.

## Bằng chứng chuẩn và quyền sở hữu

- `src/platform/org-unit/index.ts`: Platform sở hữu OrgUnit; contract hỗ trợ tạo `branch`, mã duy nhất theo tenant và parent tùy chọn.
- `docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md`: thao tác Preschool phải dùng actor/tenant hiện hành; role phải là `admin`, không tự ánh xạ `super_admin`.
- `supabase/migrations/20260914_repair_platform_org_people_rls.sql`: `org_units_admin_write` giới hạn ghi theo tenant và role `admin`/`super_admin`.
- `src/platform/org-unit/org-unit.repository.ts`: repository mặc định dùng service-role. API mới sẽ truyền client phiên người dùng vào contract để RLS được thực thi; không dùng service-role cho thao tác này.
- `src/platform/security/current-actor.contract.ts`: nhánh quản lý đọc projection qua RPC current-actor tự giới hạn; không ghi trực tiếp vào `org_relationships` hay projection.
- PR #418, #428, #429 đã có trên main nhưng không bổ sung UI/API tạo chi nhánh.

## Ranh giới thay đổi

- UI: thêm mục menu chỉ hiển thị với role `admin`, trang danh sách và form tên/mã chi nhánh.
- API: xác thực Supabase Auth, đọc `platform_current_actor_profile`, xác minh actor active, tenant active và `product_key = bella_preschool`; chỉ `admin` được quản lý.
- Service: dùng `PreschoolChainService` để liệt kê chi nhánh có nguồn quyền tenant-admin và tạo OrgUnit qua Platform contract.
- Database: dùng bảng Platform `org_units` qua contract với client caller-scoped; không tạo schema, migration, RPC, membership hay assignment mới.
- Không thao tác Production hoặc E2E từ xa; người dùng ủy quyền riêng cho commit, push và tạo PR ngày 25/10/2026. Merge và deploy vẫn ngoài phạm vi.

## Kiểm chứng cần thiết

- Kiểm tra xác thực, tenant/product scope, role bị từ chối, dữ liệu đầu vào sai, mã trùng và lỗi RLS.
- Kiểm tra UI gọi đúng API quản lý và không đưa tenant/actor từ trình duyệt.
- Chạy các kiểm chứng Education/Platform áp dụng trước khi coi tính năng đã hoàn tất. Runtime DB, Browser E2E và Production chỉ được tuyên bố khi có bằng chứng thực thi tương ứng.
