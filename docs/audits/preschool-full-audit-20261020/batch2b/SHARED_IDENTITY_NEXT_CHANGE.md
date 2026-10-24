# Thay đổi cụ thể cần mở rộng authority: `public.users`

**Trạng thái: PREPARED / NOT_EXECUTED.** `public.users` nằm ngoài allowlist32 còn hiệu lực. Không dùng yêu cầu `fix chuẩn đi` để tự bỏ giới hạn này.

## Bằng chứng và hậu quả

Live catalog `identity-boundary-cli.json` ghi nhận authenticated có table UPDATE và không có column ACL trên `id`, `tenant_id`, `role`, `status`, `email`. Policy `User tự xem và sửa chính mình` là permissive ALL `id=auth.uid()`; không ràng buộc giá trị authority mới. Ba trigger chỉ updated_at, audit và đồng bộ role/tenant vào Auth metadata; không bảo vệ identity.

`identity-local-proof.json` tái hiện bằng identity tổng hợp trên PostgreSQL cô lập: authenticated tự đổi role/tenant/email/status, helper canonical trả tenant mới, claims-sync chép authority mới sang auth metadata. Các thay đổi được rollback. Không thử ghi vào production; không suy ra các row/constraints khác đã được exploit.

Vì vậy thêm tenant fence theo `get_auth_tenant_id()` trên32 bảng vẫn phụ thuộc identity mutable. JWT app_metadata cũng cùng nguồn, không phải cách sửa độc lập. Role/guardian/branch matrix của Courses còn thiếu canonical proof.

## Phạm vi đề xuất nhỏ nhất

1. Đúng **một bảng bổ sung `public.users`**: khóa direct mutation của anon/authenticated (INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN), giữ quyền SELECT/RLS và grant maintenance đã có. Không cấp role mới hoặc sửa stored profile/business rows. `PROPOSED_USERS_DIRECT_WRITE_CONTAINMENT.sql` là proposal ROLLBACK-only để review, chưa phải migration có thể chạy production.
2. Chỉ các shared user-writer đang có privileged path: `createUser` ở `src/services/user-actions.ts` dùng service-role sau tenant lookup nhưng chưa có role/permission guard tương ứng. Khóa hoặc authorize entrypoint này theo contract quản lý nhân sự/identity đã được owner xác nhận; không coi table ACL là fix được service-role API. Giữ các nguồn shared khác nguyên trạng nếu không cần thiết.
3. Ordinary self-profile edit và tenant-admin management có thể bị giảm khả dụng nếu đang dùng direct authenticated writes. Chọn fail-closed cho authority trước; không tự tạo writable-column allowlist hoặc chuyển hàng loạt sang service-role để giữ UI chạy.
4. Rehearsal exact deployed user schema/constraints/policies/triggers với fixtures tổng hợp; denial INSERT/authority UPDATE/DELETE/TRUNCATE; SELECT và maintenance positive; failure rollback/recovery, role/claims propagation checks. Không copy production business data.
5. Khi identity đã được bảo vệ và read-role/branch rules có canonical owner, triển khai authenticated RLS trên32 bảng theo matrix được chứng minh; không derive từ tên role hoặc permissive true hiện tại.

## Khả năng triển khai hiện tại

Courses list/detail API patch đã có source tests và actual local HTTP401 proof, nhưng **chưa commit/push/deploy**. Production vẫn dùng source cũ và còn Courses bypass cho đến khi deployment code riêng được cho phép. Không sửa Vercel hoặc deploy full dirty checkout chỉ để gọi đây là DONE.

Owner cần quyết định một lần cho phạm vi identity bổ sung cùng các shared writer liên quan và rollout code. Đây là mở rộng ngoài ràng buộc32 bảng đã giao, không phải yêu cầu duyệt lại containment/RPC cũ. Bản sửa hiện tại giữ `BATCH2B_RBAC_RLS=IN_PROGRESS`, `PRESCHOOL_GO_LIVE=NOT_READY`.
