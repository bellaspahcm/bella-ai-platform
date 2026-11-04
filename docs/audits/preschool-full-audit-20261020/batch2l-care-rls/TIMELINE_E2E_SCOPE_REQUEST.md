# Quyết định owning scope — một FK Timeline trên E2E

**PENDING OWNER DECISION. Không có quyền thực thi từ tài liệu này.**

Target duy nhất: `bmnbqbcdbuklhopfbopv`. Gói Care 6 relation đã khôi phục baseline sau full-run FAIL; không giữ policy/schema mới. Production ngoài phạm vi.

## Lỗi thực tế và nguyên nhân

`timeline-cleanup-blocker.json` xác nhận FK `timeline_events_primary_party_id_fkey` dùng `ON DELETE CASCADE`, trong khi `timeline_events_no_delete` là `DO INSTEAD NOTHING`. Xóa Party không có event vẫn gặp PostgreSQL `XX000` tại `ri_PerformCheck`. Đây là cấu hình đã có trong `20260806000000_blueprint_core_schema.sql:138,165-166`.

Full run còn 4 Party tổng hợp thuộc 2 tenant terminated, không còn Auth/profile hay quyền hoạt động; số event tham chiếu 4 Party là 0. Không tắt trigger/rule, không dùng replication bypass để xóa chúng.

## Thay đổi cụ thể đề nghị

Chỉ thay **một FK trên `public.timeline_events`**: `ON DELETE CASCADE` → `ON DELETE RESTRICT`. Giữ tên, cột, bảng tham chiếu, validation; giữ nguyên mọi ACL, RLS, rule bất biến và event data. Party có event bị chặn xóa; Party không có event được xóa bình thường. Candidate review-only: `PROPOSED_TIMELINE_FK_E2E.sql` mặc định ROLLBACK.

Đây là lựa chọn lifecycle ở Platform Event Store, nằm ngoài allowlist 6 relation đã duyệt. Không tự suy ra quyền từ matrix Preschool. Chưa đề nghị production hay thay Healthcare/Kernel.

## Thực thi nếu được duyệt

1. Đọc lại exact target/source/FK/rules và dependencies; drift thì dừng.
2. Rehearsal trong transaction: đổi đúng FK, dùng fixture tổng hợp chưa commit để chứng minh unused Party xóa được, Party có event trả23503; rollback toàn bộ fixture/event/thay đổi. Không xóa event đã commit.
3. So sánh đầy đủ before/after controls và rehearsal recovery; chỉ commit FK khi proof PASS. Recovery về FK cũ khi không có drift.
4. Xóa đúng 4 Party còn lại, kiểm tra Auth/profile/quyền hoạt động vẫn0; chạy lại gói Care 6 relation sau khi xử lý lỗi attendance metadata.
5. Giữ sửa đổi E2E chỉ khi các gate chức năng, denial, cleanup và ngoài-scope fingerprints PASS. Lưu riêng mọi raw FAIL; production NOT_RUN.

## Lựa chọn

- Duyệt thêm đúng FK trên E2E, giữ bất biến Timeline và giữ sửa đổi nếu PASS.
- Giữ scope6, dừng ở blocker này; không thay Timeline và không báo cleanup PASS.
