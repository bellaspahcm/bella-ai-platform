# Platform Identity/Party — Party Identity Link Authorization Contract

**Status:** `APPROVED — LOCAL/E2E ONLY`
**Scope:** Local/E2E only. No UI or Production changes.

## 1. Quyền sở hữu và nguồn cấp quyền

- `party_identity_link_managers` là nguồn quyền duy nhất cho thao tác quản lý liên kết danh tính trong phạm vi contract này.
- Chỉ trusted DB owner được cấp hoặc thu hồi grant.
- Không cung cấp RPC/API cho caller tự cấp quyền; caller không được INSERT, UPDATE hoặc DELETE trực tiếp bảng grant.
- Không sử dụng `tenants.role_permissions` làm nguồn quyền cho các thao tác này.

## 2. Điều kiện ủy quyền

Mọi thao tác `confirm` hoặc `revoke` phải xác minh đồng thời:

1. Caller được xác thực bằng JWT hợp lệ.
2. Caller là admin đang active theo nguồn dữ liệu và contract Platform có thẩm quyền.
3. Caller và đối tượng thao tác thuộc đúng cùng tenant; không chấp nhận tenant do caller tự khai báo làm bằng chứng ủy quyền.
4. Caller có grant quản lý liên kết danh tính đang còn hiệu lực trong `party_identity_link_managers`.
5. Các điều kiện về trạng thái Auth, Party và quy tắc liên kết danh tính đã được duyệt vẫn được đáp ứng.

Thiếu dữ liệu, không xác định được nguồn sự thật hoặc không đáp ứng bất kỳ điều kiện nào đều phải từ chối theo nguyên tắc fail-closed.

## 3. Ba thao tác public

- `confirm`: xác nhận liên kết Auth subject ↔ Party sau khi kiểm tra đầy đủ quyền và tính hợp lệ.
- `revoke`: thu hồi liên kết sau khi kiểm tra đầy đủ quyền; lưu lại provenance cần thiết.
- `resolve_current_caller`: xác định liên kết của caller hiện tại từ danh tính đã xác thực; không nhận tùy ý Auth subject hoặc tenant khác để tra cứu.

Các thao tác phải đi qua public contract thuộc owning boundary. Không cho phép ghi trực tiếp vào bảng liên kết để bỏ qua kiểm tra.

## 4. Thu hồi quyền và tính nguyên tử

- Grant đã bị thu hồi hoặc hết hiệu lực phải chặn các lần gọi tiếp theo.
- Thao tác kiểm tra quyền và ghi dữ liệu phải được thực hiện nguyên tử trong transaction phù hợp; nếu bất kỳ bước bắt buộc nào thất bại, thay đổi phải rollback.
- Không được coi service-role credential tự thân là bằng chứng caller có quyền nghiệp vụ.
- Việc cấp grant chỉ thực hiện bằng trusted DB owner trong môi trường local/E2E với fixture tổng hợp.

## 5. Kiểm chứng bắt buộc trước khi đóng contract

- JWT thật trong môi trường kiểm thử cô lập.
- Cho phép đúng caller có admin active và grant hợp lệ.
- Từ chối caller không có grant, grant bị thu hồi, admin không active, sai tenant và JWT không hợp lệ.
- Kiểm chứng truy cập REST/RPC trực tiếp không thể bỏ qua public contract.
- Kiểm chứng rollback khi thao tác thất bại.
- Review độc lập phần schema, ACL, public contract và migration.

## 6. Ranh giới thay đổi

- Không thay đổi UI hoặc tenant/giáo viên thật.
- Không triển khai Production.
- Không mở rộng thành IAM mới.
- Quy tắc liên kết một-một đang hoạt động và lưu lịch sử vẫn giữ nguyên theo quyết định đã duyệt.
- Chỉ chuyển sang triển khai local/E2E sau khi owning boundary xác nhận contract này và các dependency bắt buộc đã được xác định.

**Acceptance:** Platform Identity/Party owner xác nhận phiên bản contract cụ thể này hoặc trả lại các điểm cần sửa. Khi chưa có xác nhận, trạng thái vẫn là `PERMISSION_CONTRACT = PENDING`.
