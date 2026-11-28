---
title: 'Bella Interior hiển thị đúng revision và bản vẽ theo dự án'
type: 'bugfix'
created: '2026-11-28'
status: 'done'
baseline_commit: 'a2d61d9fcc05db112b1d22ce442e5942d02a02c8'
context: ['{project-root}/docs/governance/BELLA_AI_CODING_CONSTITUTION.md']
---

<frozen-after-approval reason="phạm vi đã được chủ sở hữu yêu cầu: xử lý cả ba mục">

## Intent

**Problem:** Trang Design Studio đang hiển thị các bản vẽ mẫu khi dự án không có asset đã lưu; bảng tổng quan luôn hiển thị revision rỗng. Vì vậy trạng thái “đã duyệt revision” bị lẫn với “đã có tệp bản vẽ”.

**Approach:** Dùng revision và asset đã lưu trong Bella Interior làm nguồn sự thật cho cả chi tiết và tổng quan; giữ nguyên bố cục hiện tại, chỉ sửa dữ liệu và nhãn. Đồng thời đồng bộ con trỏ revision trong luồng phê duyệt chuẩn. Không tự gán con trỏ cho bản ghi Production cũ nếu không xác minh được nguồn phê duyệt.

## Boundaries & Constraints

**Always:** Phân biệt trạng thái duyệt revision với số tệp bản vẽ; không tạo hoặc suy diễn asset. Giữ tenant/project scope qua API và repository hiện có. Luồng duyệt phải ghi trạng thái revision, con trỏ active và audit trong cùng transaction. Giữ nguyên bố cục, kiểu bảng, điều hướng và các hành động hiện có.

**Ask First:** Chỉ thay đổi dữ liệu Production lịch sử khi có bằng chứng phê duyệt đáng tin cậy và con trỏ cần sửa không thể suy ra an toàn từ trạng thái hiện tại. Dừng riêng phần đó nếu thiếu bằng chứng.

**Never:** Ghi vào E2E/test DB; chạy CI `#e2e` riêng; hiển thị dữ liệu mẫu như dữ liệu dự án; bỏ qua kiểm tra tenant/permission; thay đổi UI ngoài nhãn/trạng thái cần thiết; sửa schema hoặc API public không liên quan.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dự án có revision duyệt nhưng không có tệp | Một revision `approved`, 0 asset bản vẽ | Chi tiết hiển thị 0 bản vẽ; tổng quan hiển thị revision đã duyệt và 0 tệp riêng biệt | Không giữ dữ liệu mẫu khi API trả mảng rỗng |
| Dự án có tệp bản vẽ | Asset lưu với loại bản vẽ hợp lệ | Chỉ hiển thị asset gắn đúng revision/project/tenant và đếm đúng số tệp | API lỗi không được đổi lỗi thành dữ liệu mẫu |
| Đổi dự án hoặc chưa có revision | Dự án khác / revision rỗng | Không hiển thị bản vẽ cũ; trạng thái revision thể hiện chưa có dữ liệu | Reset trạng thái theo phản hồi rỗng thành công |
| Duyệt revision hợp lệ | RPC duyệt qua actor có quyền | Revision, active pointer và audit cùng commit | Nếu không cập nhật được project thì rollback toàn bộ transaction |

</frozen-after-approval>

## Code Map

- `src/app/dashboard/interior/design/page.tsx` -- trạng thái khởi tạo và nạp asset theo dự án.
- `src/app/api/interior/design/route.ts` -- dùng revision mới nhất cho trạng thái duyệt và active revision cho bộ asset đang hiển thị.
- `src/app/api/interior/design/drawings/route.ts` -- đọc revision/assets có tenant scope và phân loại asset.
- `src/app/api/interior/design/revisions/route.ts` -- giữ nguyên trạng thái `superseded` và giá trị chưa nhận diện.
- `src/app/api/interior/design/revisions/[id]/approve/route.ts` -- luồng duyệt chính thức qua RPC giao dịch.
- `src/products/bella-interior/lib/server-context.ts` -- ánh xạ GET drawings API vào quyền đọc thiết kế theo project scope.
- `src/products/bella-interior/domain/portfolio-overview.types.ts` -- DTO tổng quan dự án.
- `src/products/bella-interior/repositories/interior-repository.interface.ts`, `in-memory.repository.ts`, `supabase.repository.ts` -- hợp đồng và nguồn dữ liệu revision tóm tắt theo portfolio.
- `src/products/bella-interior/services/interior-portfolio-analytics.service.ts` -- tạo trạng thái revision và số bản vẽ từ repository.
- `src/app/dashboard/interior/page.tsx` -- trình bày revision và số tệp trong cột hiện có.
- `src/app/dashboard/interior/design/page.tsx` -- hiển thị metadata thật của tệp, khóa thao tác không hợp lệ, và tránh stale response khi đổi dự án/duyệt.
- `src/products/bella-interior/domain/design-overview.types.ts` -- trạng thái revision hiển thị trong Design Studio.
- `supabase/migrations/20261128145534_interior_design_approval_sets_active_revision.sql` -- cập nhật RPC duyệt để đồng bộ con trỏ trong transaction, cung cấp trạng thái revision/assets theo cùng snapshot, và đọc gộp portfolio có kiểm quyền.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/dashboard/interior/design/page.tsx` -- xóa asset bản vẽ mẫu và xóa asset cũ khi đổi dự án hoặc nhận phản hồi rỗng -- tránh nội dung mẫu/dự án trước xuất hiện trong dự án hiện tại.
- [x] `src/app/api/interior/design/route.ts`, `src/app/api/interior/design/drawings/route.ts` -- nhận diện asset theo domain, chỉ map asset có tệp thật, trả mảng rỗng đúng khi không có dữ liệu và bỏ metadata mặc định -- chỉ trả nội dung có trong DB.
- [x] `src/products/bella-interior/lib/server-context.ts` -- yêu cầu đúng `interior:design:read` cho GET drawings và giữ nguyên tenant/project authorization -- API không bị chặn vì thiếu permission mapping.
- [x] `src/products/bella-interior/domain/portfolio-overview.types.ts`, `src/products/bella-interior/services/interior-portfolio-analytics.service.ts`, `src/app/dashboard/interior/page.tsx` -- truyền và hiển thị revision duyệt riêng với số tệp -- dùng repository cùng tenant scope.
- [x] `supabase/migrations/20261128145534_interior_design_approval_sets_active_revision.sql` -- cập nhật RPC duyệt và ghi audit cho project pointer -- giữ kiểm tra actor, tenant và permission hiện tại.
- [x] `src/app/api/interior/design/route.ts`, `src/products/bella-interior/lib/server-context.ts` -- chuyển thao tác khóa cũ sang RPC duyệt có quyền riêng; không cho hạ status `approved` trực tiếp.
- [x] Production row `PRJ-OPVAL-0566` -- không sửa pointer nếu chưa chứng minh nguồn duyệt; trạng thái thiếu chứng cứ phải được báo rõ.

**Acceptance Criteria:**
- Given project không có asset bản vẽ, when mở Design Studio, then danh sách và bộ đếm bản vẽ đều bằng 0 và không còn seed.
- Given project có revision approved nhưng không có tệp, when xem tổng quan, then revision đã duyệt và tình trạng 0 tệp được hiển thị riêng.
- Given asset bản vẽ tồn tại, when truy vấn qua API, then chỉ asset của tenant, project và revision hợp lệ được trả về.
- Given người dùng không có quyền đọc thiết kế trong project, when gọi GET drawings, then API từ chối theo role authorization.
- Given request supplies conflicting `project_id` and `projectId` values, when scoped authorization resolves the request, then it is rejected before any project data is read.
- Given người dùng có quyền duyệt revision, when RPC duyệt thành công, then revision, active pointer và audit cùng commit; lỗi cập nhật pointer rollback thay đổi.
- Given dự án có revision active đã duyệt và revision mới hơn đang chờ duyệt, when mở Design Studio, then trạng thái duyệt trỏ tới revision mới nhất, còn bộ bản vẽ vẫn theo active revision cho tới khi duyệt thành công.
- Given duyệt revision mới thành công, when tải lại dữ liệu hiện tại, then danh sách bản vẽ chuyển sang active revision mới và GET cũ không ghi đè kết quả.
- Given thao tác khóa revision từ Design Studio, when người dùng yêu cầu duyệt, then API dùng cùng RPC duyệt; revision đã duyệt không thể bị mở khóa bằng cách hạ status.
- Given dữ liệu Production lịch sử thiếu audit phê duyệt đáng tin cậy, when xử lý bản ghi, then không tự gán active pointer.
- Given merge vào `main`, when Production CI chạy, then dùng pipeline Production hiện có; không khởi chạy CI `#e2e` riêng.
- Given revision có trạng thái chưa nhận diện hoặc `superseded`, when hiển thị trong chi tiết/list revision, then giữ trạng thái thật và không bật thao tác duyệt.
- Given tệp PDF/DXF hoặc thiếu metadata, when mở modal bản vẽ, then định dạng, trạng thái và thông tin phê duyệt không bị thay bằng mặc định DWG/AutoCAD/người duyệt mẫu.
- Given người dùng đổi dự án khi yêu cầu duyệt đang chờ, when phản hồi đến, then không áp trạng thái duyệt lên dự án đang xem khác.

## Verification

**Commands:**
- Production CI trên commit PR/main -- các gate bắt buộc của repository phải đạt; kết quả ghi theo đúng SHA và workflow.
- `npm run db:migration:zero-downtime -- --base HEAD^` -- phân tích migration theo gate hiện có.

**Manual checks (if no CLI):**
- Sau deploy, kiểm tra project Production mục tiêu: 0 bản vẽ, revision được phản ánh riêng, không còn các tệp mẫu trong chi tiết.
- Sau áp dụng migration Production, đọc lại định nghĩa RPC và ledger; không tạo hoặc cập nhật dữ liệu test.

## Suggested Review Order

**Nguồn revision và tài sản**

- Revision mới nhất quyết định trạng thái duyệt; asset vẫn theo revision active.
  [`route.ts:180`](../../src/app/api/interior/design/route.ts#L180)

- Bản vẽ chỉ lấy từ revision active hoặc revision đã duyệt phù hợp.
  [`route.ts:301`](../../src/app/api/interior/design/route.ts#L301)

- RPC trả pointer và asset cùng snapshot có tenant/project permission.
  [`20261128145534_interior_design_approval_sets_active_revision.sql:83`](../../supabase/migrations/20261128145534_interior_design_approval_sets_active_revision.sql#L83)

**Quyền duyệt và tính nguyên tử**

- Thao tác duyệt cũ được ánh xạ sang quyền phê duyệt riêng.
  [`server-context.ts:219`](../../src/products/bella-interior/lib/server-context.ts#L219)

- API dùng cùng RPC cho revision lock và approval.
  [`route.ts:572`](../../src/app/api/interior/design/route.ts#L572)

- Revision, pointer và đầy đủ audit delta commit trong một transaction.
  [`20261128145534_interior_design_approval_sets_active_revision.sql:4`](../../supabase/migrations/20261128145534_interior_design_approval_sets_active_revision.sql#L4)

**Tổng quan theo quyền và số file**

- Một RPC gộp nhiều project và chỉ trả revision khi được phép đọc.
  [`20261128145534_interior_design_approval_sets_active_revision.sql:125`](../../supabase/migrations/20261128145534_interior_design_approval_sets_active_revision.sql#L125)

- Repository xác thực tenant/project trước khi chuyển summary lên service.
  [`supabase.repository.ts:1516`](../../src/products/bella-interior/repositories/supabase.repository.ts#L1516)

- Analytics phân biệt không có revision, không có file và không đọc được.
  [`interior-portfolio-analytics.service.ts:446`](../../src/products/bella-interior/services/interior-portfolio-analytics.service.ts#L446)

- Bảng tổng quan hiển thị revision và số file riêng biệt.
  [`page.tsx:854`](../../src/app/dashboard/interior/page.tsx#L854)

**Vòng đời giao diện và trạng thái thật**

- GET cũ bị bỏ qua sau đổi dự án hoặc sau khi duyệt thành công.
  [`page.tsx:414`](../../src/app/dashboard/interior/design/page.tsx#L414)

- Sau duyệt, trang tải lại snapshot active và không khóa nhầm revision.
  [`page.tsx:528`](../../src/app/dashboard/interior/design/page.tsx#L528)

- Modal dùng định dạng file và trạng thái approval đã lưu.
  [`page.tsx:2878`](../../src/app/dashboard/interior/design/page.tsx#L2878)

**Hợp đồng dữ liệu**

- DTO chỉ mang metadata revision, file và approver thực tế.
  [`design-overview.types.ts:60`](../../src/products/bella-interior/domain/design-overview.types.ts#L60)
