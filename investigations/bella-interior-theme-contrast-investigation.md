# Điều tra giao diện Bella Interior: preset và độ tương phản

## Tóm tắt bàn giao

1. Preset được truyền thành token dùng chung, nhưng mã nguồn Interior có nhiều màu cố định và sidebar có quy tắc màu riêng.
2. Đã tìm thấy các cặp màu nguồn có tỷ lệ tương phản thấp; chưa xác nhận toàn bộ bằng trình duyệt.
3. Cần đăng nhập local và đo các trang, trạng thái và preset trong môi trường an toàn để hoàn tất audit.

## Thông tin

| Mục | Giá trị |
| --- | --- |
| Ngày | 2026-11-20 |
| Trạng thái | Active — chờ phiên đăng nhập local |
| Checkout | main, 6e1db189d |
| Phạm vi | 18 trang dashboard Interior, trang customer approval và các thành phần liên quan |
| Phương pháp | Truy vết mã nguồn; đối chiếu màu tĩnh; chưa hoàn tất đo màu thực tế |

## Yêu cầu và giả thuyết

Người dùng yêu cầu audit màu sắc động theo theme preset trong Cài đặt và độ tương phản text trên tất cả trang Bella Interior.

| Giả thuyết | Trạng thái | Bằng chứng hoặc cách kiểm tra |
| --- | --- | --- |
| Mọi phần giao diện Interior đổi màu theo preset | Bác bỏ đối với các khai báo màu cố định trong nguồn; cần xác nhận cascade thực tế | Sidebar áp màu literal tại `src/app/globals.css:7309` và `src/app/globals.css:7386`; CTA dùng amber cố định tại `src/app/dashboard/interior/page.tsx:958`. |
| Tất cả chữ đạt tương phản | Chưa được chứng minh | Một số cặp màu tĩnh dưới ngưỡng; cần kiểm tra browser trên các trạng thái. |

## Bằng chứng đã xác nhận

- Cài đặt đổi preset thông qua `applyBrandPreset`, cập nhật màu và tự lưu `brand_theme`: `src/app/dashboard/settings/components/AppearanceTab.tsx:298`, `:323`. Preview áp token lên root: `:160`–`:167`.
- Dashboard đọc presentation và áp brand: `src/app/dashboard/layout.tsx:24`–`:32`; product presentation lấy `brand_theme` và áp dynamic token: `src/lib/business-rules/product-presentation-routing.ts:46`, `:99`–`:107`.
- Khi module là Interior, sidebar được áp gradient graphite và điểm nhấn amber bằng literal và `!important`: `src/app/globals.css:7309`–`:7315`, `:7386`–`:7395`. Nội dung trang dùng các class màu cố định, ví dụ `src/app/dashboard/interior/page.tsx:958`.
- Biểu đồ Khách hàng có nhãn SVG `#94a3b8`, cỡ 9 trên card trắng ở light mode: `src/app/dashboard/interior/customers/page.tsx:727`, `:758`, `:766`. Tỷ lệ tính từ màu khai báo là khoảng 2,56:1; cần xác nhận cascade và bố cục runtime.
- Một số CTA chữ nhỏ trắng trên amber-600 tại `src/app/dashboard/interior/settings/page.tsx:30`, `src/app/dashboard/interior/roles/page.tsx:851`, `src/app/dashboard/interior/projects/page.tsx:1010`. Màu Tailwind amber-600 khai báo tại `node_modules/tailwindcss/theme.css:40`; tỷ lệ dự kiến khoảng 3,2:1, cần đo computed colors thực tế.
- Local dev chạy tại `http://localhost:3000`; trang `/dashboard/interior` chuyển tới đăng nhập do refresh token cũ không hợp lệ. Chưa có phiên để kiểm tra nội dung thực tế.

## Thiếu bằng chứng và công việc còn lại

| Công việc | Trạng thái | Ý nghĩa |
| --- | --- | --- |
| Đăng nhập Bella Interior local | Chờ người dùng | Có thể xem các trang được bảo vệ. |
| Kiểm tra màu thực tế theo route, light/dark, dữ liệu và modal | Chưa chạy | Không thể kết luận toàn bộ trang đạt tương phản. |
| So sánh ít nhất hai preset trong môi trường an toàn | Chưa chạy | Chọn preset trong Cài đặt tự lưu nên không thay đổi tenant thật trong audit. |
| Xác nhận tương ứng checkout và deployment được đánh giá | Chưa kiểm tra | Kết quả nguồn không tự chứng minh hành vi Production. |

## Hướng kiểm tra tiếp

Đo computed foreground/background, opacity và gradient trong browser theo WCAG AA: 4,5:1 cho chữ thường, 3:1 cho chữ lớn. Đánh dấu trường hợp không đo được và kiểm tra thủ công, không xem là pass. Bao gồm route động và các trạng thái có dữ liệu, rỗng, lỗi, dialog và tương tác nếu truy cập được.

## Theo dõi 2026-11-20: sửa và kiểm tra local

- Phạm vi `UI_ONLY`: sidebar dùng token presentation hiện có; hero và nút action amber/orange theo primary; giữ màu trạng thái có ý nghĩa và làm đậm chữ semantic trong light mode; sửa text hero, promo, nhãn biểu đồ khách hàng/sản xuất.
- Đã xem trực tiếp trang tổng quan và khách hàng ở light/dark. Kiểm tra độc lập sáu preset với mẫu HTML cục bộ dùng stylesheet thật, cả light/dark; nút mẫu có tương phản trên 4,5:1 ở phiên bản kiểm tra. Đây là thử nghiệm mẫu, không chứng minh đầy đủ giao diện từng trang khi đổi preset.
- Đo màu nền phẳng tự động tại tổng quan, dự án, khách hàng, lịch, thiết kế, BOQ. Sau sửa, các cặp đo được trên năm trang sau không còn lỗi; tổng quan có hai cảnh báo do công cụ không nhận biết lớp gradient phủ ảnh. Bộ đo bỏ qua nền gradient, trong suốt và một số trạng thái; không được coi là chứng nhận WCAG toàn trang.
- API Interior local trả 401 `INTERIOR_UNAUTHENTICATED` tại một số trang. Log cho thấy đăng nhập đã đi qua `validateDevelopmentLoginBypassEmail`; `src/app/(auth)/login/page.tsx:45`–`:68` cho thấy đường fallback này tạo mock cookie sau khi xác thực Supabase thất bại, trong khi API yêu cầu `supabase.auth.getUser()` tại `src/products/bella-interior/lib/server-context.ts:382`–`:392`. Đây là bằng chứng phiên hiện tại không chứng minh rằng sửa CSS gây lỗi xác thực. Cần phiên Supabase hợp lệ để đo các trang bị chặn và trạng thái có dữ liệu.
- Chưa kiểm tra toàn bộ dialog, mobile, mọi nền gradient và toàn bộ route với dữ liệu thật. Không có thay đổi DB, quyền, auth hoặc tenant preset.

## Theo dõi: phiên xác thực thật và kiểm tra bổ sung

- `.env.local` trỏ tới dự án Supabase Production. Auth log cho lần local cho thấy `invalid_credentials`; hồ sơ admin, tenant và tài khoản Auth tương ứng đều đang hoạt động. Sau đó xác thực bằng thông tin E2E có sẵn trong môi trường đã thành công và tạo phiên browser thật, không sửa mật khẩu, quyền hay bản ghi nghiệp vụ. API `/api/interior/rbac`, `/api/interior/users` và `/api/interior/rbac/audit` trả 200; trang Phân quyền hiển thị các vai trò ADMIN/OWNER.
- Đã mở và đo thêm các trang Hợp đồng, Tài chính, Sản xuất, Thi công, QC, Báo cáo và Phân quyền; sửa các cặp chữ/nền phẳng dưới 4,5:1 được quan sát. Trang Bảo hành chỉ tải dashboard khi có `projectId`; đã mở qua chi tiết dự án để kiểm tra, và ghi nhận đường dẫn sidebar thiếu ngữ cảnh dự án. Trạng thái đó không phải lỗi đăng nhập.
- Đã sửa nền sáng cố định và nền bảng ở dark mode, xem trang Bảo hành và QC, bao gồm hộp thoại QC, sau đó khôi phục light mode. Phép đo tự động bỏ qua nhiều nền gradient, màu trong suốt và các trạng thái chưa mở; không coi kết quả là chứng nhận toàn bộ WCAG hay tính thật của tất cả dữ liệu trên trang.
- Đăng nhập fallback development cũ vẫn có thể hiển thị giao diện mà không tạo được phiên API nếu xác thực Supabase thất bại; chưa thay đổi logic đăng nhập dùng chung. Phiên local hiện được khôi phục bằng xác thực thật.
- Đã rà bổ sung trang Vật liệu, hai trang chuyển tiếp Cài đặt/Nhân sự, và nội dung Bảo hành theo dự án. Nhãn ảnh Vật liệu đã được đặt trên nền tối để không phụ thuộc độ sáng ảnh. Một số màn hình analytics hiển thị dữ liệu trình diễn; việc audit màu không xác minh dữ liệu nghiệp vụ.
- Trong light mode, các cặp màu phẳng đo được ở các trang đã kiểm tra sau sửa không có lỗi được công cụ phát hiện; công cụ không đo nền trong suốt, gradient, ảnh và nhiều trạng thái chưa mở. Dark mode được rà các trang menu, với nhiều cặp nền gradient chưa đo tự động; đã xem trực tiếp QC, dialog QC và Bảo hành. Không xem các phần chưa đo là PASS.

## Theo dõi: Production ngày 2026-11-20

- Đã kiểm tra trực tiếp `https://bella-spa-erp.vercel.app/dashboard/interior` bằng phiên hiện có, ở light mode. Preset đang áp là `luxury_navy`, màu primary `#1E3A8A`; logo và mục menu active vẫn có gradient amber cố định. Chưa thử đổi preset vì thao tác đó tự lưu cấu hình tenant.
- Trang Tổng quan: heading dùng chữ gần đen trên nền gradient xanh đậm, quan sát trực tiếp thấy khó đọc. Đo các cặp màu phẳng cho thấy các nhãn emerald khoảng 3,74:1 và amber khoảng 3,11:1; nút lọc màu xám khoảng 4,34:1.
- Trên Production có ví dụ không đạt trong Khách hàng và Lịch (nút cam chữ trắng khoảng 3,47:1), Hợp đồng (nút amber khoảng 2,09:1), Thi công/QC (nút amber `#f59e0b` khoảng 2,15:1, nút emerald `#10b981` khoảng 2,54:1) và Phân quyền (nút amber khoảng 3,11:1).
- Đã quan sát các route menu ở trạng thái truy cập được. Trang Bảo hành qua menu không có `projectId` hiển thị lỗi tải; không xác nhận toàn bộ trạng thái có dữ liệu, mobile, dark mode, popup, nền gradient/ảnh hoặc tất cả preset. Scanner chỉ tính các cặp nền phẳng mà nó phân tích được, nên số lượng không phải tổng số lỗi WCAG.
- Những sửa đổi ở checkout local chưa được triển khai; quan sát Production ở đây không chứng minh thay đổi local đang chạy trên Production. Không đổi preset hay dữ liệu.

## Sửa sau kiểm tra Production

- Change Map: màu sắc/sidebar/biểu đồ là `UI_ONLY`; màn hình Bảo hành khi thiếu `projectId` chuyển từ báo lỗi sang hướng dẫn mở danh sách dự án (`EXISTING_CAPABILITY_REUSE`). Không thay đổi API, database, quyền hoặc quy tắc chọn dự án.
- `InteriorWarrantyAnalyticsService.getWarrantyOverview` hiện trả chỉ số và danh sách mẫu bất kể dự án được truyền vào. Giao diện có dự án hiện có thông báo dữ liệu mẫu; không xem đây là sửa kết nối dữ liệu thật, và không tạo dữ liệu để che lấp khoảng trống.
- Đã kiểm tra local bằng phiên admin thật: đường vào không có projectId hiển thị hướng dẫn, đường có projectId hiển thị thông báo dữ liệu mẫu. Kiểm thử tập trung: 3 suite, 14 test đạt; lint các tệp sửa đạt; `git diff --check` đạt. Build đầu bị EPERM khi tạo thư mục `.next`; build ngoài sandbox chạy lại thành công (exit 0), tạo 387 trang. Next.js phát cảnh báo bảo mật phiên bản; cấu hình build bỏ qua kiểm tra TypeScript.
- Không thay đổi Production. Việc đưa thay đổi lên Production và xác nhận hiệu lực vẫn cần thẩm quyền triển khai và kiểm tra release theo Constitution.
