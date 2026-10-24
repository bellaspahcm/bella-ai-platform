# Review hiện tại

**LATEST: COMPLETED — hai introduced findings đã sửa và re-review xác nhận đóng.** Các lỗi quota ban đầu bên dưới chỉ là lịch sử, không còn là trạng thái review hiện tại.

Ba reviewer độc lập được dispatch đúng workflow (blind hunter, edge case hunter, acceptance auditor), nhưng cả ba trả lỗi quota dịch vụ trước khi review. **INDEPENDENT_REVIEW = BLOCKED_SERVICE_LIMIT**, không có finding hay PASS từ ba lượt đó. Owner sau lỗi yêu cầu `tiếp tục`; Lead tiếp tục phần có thể làm, không coi self-review là independent review.

## Retry sau thời điểm reset dịch vụ

Review độc lập sau đó chạy được. Blind Hunter không tìm introduced defect. Acceptance Auditor không tìm thêm defect và independently so sánh stored pre/expected/post catalogs, xác nhận đúng RPC delta và32 bảng không đổi. Edge Hunter tìm một defect trong durable replay: grant tường minh ngoài fixed client list có thể còn lại mà migration vẫn thành công.

Phân loại **patch**: thêm precondition abort khi gặp direct grantee ngoài reviewed clients/maintenance; sau từng revoke kiểm tra effective privilege (inherited path); cuối transaction chỉ chấp nhận maintenance ACL. Không auto-broaden revoke authority. Actual isolated PostgreSQL tests: replay2 lần không delta; synthetic unknown direct grant gâyP0001 và giữ ACL; inherited service-role vào authenticated gâyP0001; rollback đưa toàn bộ catalog về đúng baseline. Không rerun production artifact vì phần sửa là future migration guard, không đổi delta đã áp dụng.

Edge reviewer đọc lại migration/tests và trả `[]`: finding đã được xử lý. Acceptance re-review được ghi nhận riêng khi trả kết quả. Initial quota errors vẫn là lỗi, không được ghi lại thành PASS.

Self-review trên diff hiện tại: guard kiểm tra Auth trước profile resolver nên mock-email path không cấp quyền cho anonymous; active profile phải cùng Auth subject; tất cả tenant query values (kể cả duplicate) phải khớp; dữ liệu qua session client, không admin factory. Party teacher reads bổ sung tenant filter; cache trả private/no-store. Mapping lớp và Course POST503 giữ nguyên. New role/branch entitlement không được suy ra.

RPC artifact chỉ revoke29 grant tường minh được tạo ở Batch2A để giữ quyền từng hưởng PUBLIC. Giữ ba grant maintenance có trước, giữ inherent superuser. Transaction exact pre/post so sánh cả32 table catalog và RPC/role/membership/body, nên không có unexpected table/policy/helper delta. Rehearsal9/9 qua với denial30 roles và allow4 roles, recovery exact baseline. Không restore anonymous.

Pre-existing/dependent: users self ALL policy cho sửa authority fields; claims-sync lan truyền thay đổi đó. Session/RLS không tự sửa dependency này. Course read-role/branch matrix thiếu canonical proof, real-user E2E và production API deployment chưa có evidence. Những phần này không được gắn nhãn fixed/PASS bởi test mock hay catalog ACL.

Không có blocking regression mới tìm thấy qua self-review; independent review vẫn chưa được chứng minh. Targeted tests và các gate còn lại ghi riêng actual exit và phạm vi.


Acceptance re-review tìm thêm ordering defect: kiểm tra inherited privilege ngay sau từng revoke làm pg_monitor còn hưởng grant từ reviewed roles chưa xử lý. Đã tách thành revoke-all rồi verify-all; thêm replay từ exact original prestate (không chỉ secure poststate). Actual PostgreSQL proof PASS; acceptance reviewer xác nhận finding closed, không thêm defect. Final reviewers: Blind no introduced defect; Edge finding closed; Acceptance ordering finding closed.
