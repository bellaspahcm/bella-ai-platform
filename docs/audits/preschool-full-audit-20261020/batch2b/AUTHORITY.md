# Phạm vi sửa Batch2B — 2026-10-21

Owner yêu cầu `fix chuẩn đi` sau báo cáo Batch2A: Courses vẫn trả dữ liệu không cần user session; quyền authenticated của SQL executor và permissive policies còn mở. Yêu cầu được hiểu là sửa các lỗ hổng security đã nêu bằng contract hiện hữu, gồm code API và remediation quyền DB có rehearsal/postcheck; không tự đặt business role matrix.

Giữ nguyên các ràng buộc còn hiệu lực: không mở rộng sang sửa toàn bộ Preschool; không đổi business semantics; không sửa Kernel; không sửa bảng ngoài allowlist 32; không dùng service-role để che authorization failure; không khôi phục anonymous. RPC `public.exec_sql(text)` đã có authority riêng. Nếu identity nguồn ở bảng ngoài allowlist chưa được bảo vệ, giữ riêng dependent work và trình bày thay đổi cụ thể cần owner quyết định; tiếp tục phần độc lập.

Branch hiện tại đúng task; dirty state chỉ gồm bằng chứng audit do task này tạo. Không reset/stash/delete các bằng chứng. Không có runtime diff trước lượt sửa. User đã yêu cầu triển khai sửa trong cùng task; không mở thêm vòng duyệt lại cùng intent. Commit/push/merge/deployment code vẫn theo authority thực tế và quy trình repository.

Workflow: bug/security, bmad-quick-dev + bella-security-reliability. Một Lead; một analyst chỉ đọc contract/source, không sửa file/DB; implementation được giao ownership riêng theo workflow. Không chạy song song các mutation. Role map: Software Engineer (implementation), Business Analyst/Security (canonical authority), QA (verification), không tạo agent cho đủ số lượng.
