# Kết quả kiểm tra — luồng xử lý cảnh báo Preschool

Ngày 19/10/2026. Nhánh `codex/preschool-attention-work-queue`, nền `3ec04c91fd5bf2c67d523e3a65ee559ba978c1e3`. Người dùng đã yêu cầu commit/push sau khi kiểm tra local hoàn tất; các giới hạn bằng chứng dưới đây vẫn giữ nguyên.

## Đã xác minh

- 5 bộ kiểm tra API/UI/Finance/Analytics: **80/80 PASS**. Transport PostgREST giả lập chạy qua client Supabase thật và Product services; không gọi DB thật để duyệt/đóng hồ sơ.
- ESLint các file thay đổi: PASS; chỉ cảnh báo cấu hình `.eslintignore` đã có.
- TypeScript 18 roots: không có diagnostic ở file thay đổi hoặc dependency. JSX parse và không thêm kiểu `any`: PASS.
- Ba lớp review độc lập đã hoàn tất. Các lỗi phát hiện về phiên bản hồ sơ đã xem, kết quả lưu không chắc chắn và cấu hình máy chủ thiếu đều được sửa. Review acceptance và edge cuối: không còn finding.
- Các thao tác P4 ghi thông báo/đóng sự cố cập nhật phiên bản; bản xem cũ bị từ chối. Hành vi mặc định của consumer cũ và yêu cầu xác nhận phụ huynh vẫn được giữ.
- Luồng đọc thật qua Product service và adapter mới: **2 đơn nghỉ, 2 sự cố, 4 yêu cầu**, khớp Tổng quan. Đối chiếu được cả 8 tên trẻ, 6 tên phụ huynh của các yêu cầu. Chỉ GET/HEAD; không duyệt/từ chối/đóng bản ghi hiện có.
- HTTP localhost không đăng nhập: workspace307 về login, API hàng đợi401. Analytics200 và trả số liệu thật.
- 18 file runtime/test được đồng bộ sang checkout đang chạy localhost sau khi kiểm tra hash trước tác vụ, giữ các thay đổi khác.

## Giới hạn và kiểm tra rộng

- Chưa chứng minh phiên browser đã đăng nhập, RLS hay ghi/đóng trên DB thật. Browser automation đang bị tắt. Không dùng dữ liệu của người dùng làm fixture để chứng minh thao tác.
- `education:verify` dừng tại kiểm tra kiến trúc: 3 test PASS, 1 FAIL do 222 vị trí truy vấn trực tiếp đã tồn tại. So sánh mã nguồn với nền: vẫn đúng 222; Product mới không thêm vị trí truy vấn trực tiếp.
- `healthcare:verify`: guard PASS, kiến trúc9/9, medical conformance7/7; Kernel regression374 PASS,151 FAIL,5 skipped. Các fixture tích hợp không kết nối được DB thử nghiệm ở worktree cô lập (`fetch failed`); không đưa khóa production vào bộ kiểm tra và không sửa Healthcare/Kernel để xử lý việc này.
- Không suy ra toàn hệ thống PASS hoặc Go-Live từ các kiểm tra cục bộ trên.

## Bằng chứng cục bộ

Worktree `.cache/preschool-attention/`: `jest.json`, `typecheck.json`, `live-read.json`. Primary checkout `.cache/preschool-attention-work-queue/`: `source-sync.json`, `scope.json`, `runtime-http.json`, `healthcare-verification.json`, `candidate.diff`. Các file cache không thuộc nội dung cần commit.

## Sửa lỗi Vercel Preview sau push

Deployment `dpl_Ep4ZAEmrERNMt6rW5kfrUJ6V1UtW`, commit `87aad7345`, thất bại khi webpack resolve `@/components/ui/Button`. Git lưu file thật là `src/components/ui/button.tsx`; Windows không phát hiện lệch chữ hoa/thường trong kiểm tra local, Linux của Vercel thì có. Đây là lỗi của thay đổi mới, không phải lỗi DB hay cấu hình deployment. Commit nền `3ec04c91f` có Vercel success.

Sửa tối thiểu: đổi import sang `@/components/ui/button`, không thay component hay nghiệp vụ. Rà 51 import nội bộ thuộc 18 file source/test: trước sửa có đúng một lỗi casing nêu trên; sau sửa không còn lỗi. Phân loại `UI_ONLY`/tương thích đường dẫn build, giữ nguyên gate và các giới hạn kiểm tra rộng. Bản sửa được đẩy lên cùng nhánh theo yêu cầu xử lý check fail.
