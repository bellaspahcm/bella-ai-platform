---
title: 'Sửa dashboard AutoMove bắt nhầm chuyển hướng đăng nhập'
type: 'bugfix'
created: '2026-10-23'
status: 'done'
baseline_commit: '474e3a57582cc0c9406a5e167af76937b45018db'
context: []
---

<frozen-after-approval reason="user authorized continuation of diagnosed local repair">

## Intent

**Problem:** Dashboard AutoMove hiển thị `NEXT_REDIRECT` vì bắt tín hiệu chuyển hướng như lỗi dữ liệu. Phiên dev của shell không tạo Supabase Auth thật mà trang/API AutoMove yêu cầu.

**Approach:** Đưa kiểm tra Auth và chuyển hướng ra ngoài `try/catch` tải dữ liệu. Khôi phục phiên qua đăng nhập Auth chuẩn bằng tài khoản test sẵn có; không thêm mock hoặc service-role vào AutoMove.

## Boundaries & Constraints

**Always:** Giữ tenant lấy từ hồ sơ của Auth user, client theo phiên người dùng và public contract Mobility. Lỗi tải dữ liệu vẫn hiện thông báo. Tách sửa code trong worktree sạch.

**Ask First:** Reset/provision tài khoản, sửa quyền/RLS/schema, public contract, commit/push/merge/deploy.

**Never:** Thay tài khoản/tenant cố định vào runtime, dùng admin để che lỗi Auth, sửa các thay đổi Preschool đang có, nâng dependency hoặc sửa shared auth.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Chưa có Auth | `getUser()` trả user null | Next chuyển `/login`, không đọc users/tenant/inventory | Tín hiệu redirect truyền tới framework |
| Có Auth | User có hồ sơ tenant | Dashboard nhận đúng dữ liệu tenant qua contract cũ | Không đổi dữ liệu hay quyền |
| Tải dữ liệu lỗi | Contract inventory reject | Hiện `Lỗi tải Dashboard` | Giữ lỗi dữ liệu hiện có |
| Thiếu tenant | Hồ sơ không có tenant | Thông báo không tìm thấy tenant | Không gọi inventory |

</frozen-after-approval>

## Code Map

- `src/app/dashboard/bella-auto/page.tsx` — consumer cần sửa.
- `src/app/dashboard/bella-auto/__tests__/page.test.tsx` — hồi quy route-control và tải dữ liệu.
- `docs/BELLA_AUTO_API_DOCUMENTATION.md:36-44` — Auth bằng session thật; tenant isolation.
- `docs/governance/BELLA_AI_CODING_CONSTITUTION.md` — failure process, quyền thay đổi, kiểm chứng.
- `https://nextjs.org/docs/app/api-reference/functions/redirect` — redirect ném tín hiệu, không đặt trong catch ứng dụng.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/dashboard/bella-auto/page.tsx` — tách Auth/redirect khỏi catch dữ liệu; giữ dashboard render và query nguyên trạng.
- [x] `src/app/dashboard/bella-auto/__tests__/page.test.tsx` — dùng redirect thật của Next; kiểm tra các nhánh trong matrix bằng boundary mocks rõ ràng.
- [x] Hồi quy Jest RED/GREEN và kiểm tra whitespace cho page/test.
- [x] Lint page/test và ghi kết quả thực thi.
- [x] Lead kiểm tra HTTP local trên runtime có sửa đổi; browser trực quan ghi `NOT_PROVEN` vì bị tắt.

**Acceptance Criteria:**
- Given thiếu Auth user, when render trang, then promise reject với redirect `/login`, không xuất lỗi dashboard hoặc query dữ liệu.
- Given có Auth user và tenant, when render trang, then header/inventory nhận đúng tenant và summary của contract.
- Given contract dữ liệu thất bại, when render trang, then lỗi dữ liệu vẫn hiển thị.

## Change Map / Authority

`EXISTING_CAPABILITY_REUSE`: sửa control flow ở Product page; Auth thuộc shared layer không đổi. Dữ liệu xe thuộc Mobility qua contract hiện có. Nguồn kỳ vọng redirect là contract chính thức Next; kỳ vọng tenant/Auth từ tài liệu AutoMove và Constitution. Không thay business semantics. Migration/Healthcare/Education/Logistics gates: `NOT_APPLICABLE` vì không sửa các miền này. Rollback: hoàn nguyên đúng page diff. Scope được tiếp tục qua hai yêu cầu `tiếp tục`; không cần quyết định nghiệp vụ mới.

## Spec Change Log

- 2026-10-23: Builder triển khai trong worktree `automove-dashboard-auth-redirect`, branch `codex/automove-dashboard-auth-redirect`, baseline `474e3a57582cc0c9406a5e167af76937b45018db`. Không đổi nội dung đã phê duyệt; tách task xác minh để phân biệt bằng chứng unit và HTTP/browser.

## Verification

- Jest scoped: missing Auth, authorized render, missing tenant, inventory failure.
- ESLint page/test; `git diff --check`.
- HTTP anonymous phải 307; Auth thật phải trả nội dung dashboard, không `Lỗi tải Dashboard`/`NEXT_REDIRECT`.
- Browser rendering chỉ `PASS` khi có quan sát trực tiếp; HTTP không chứng minh client analytics hoặc full E2E.

### Kết quả Builder (2026-10-23)

- `EXISTING_CAPABILITY_REUSE`: chuyển khởi tạo client, `auth.getUser()` và `redirect('/login')` trước `try/catch` dữ liệu. Giữ stable `redirect` từ `next/navigation`; giữ nguyên query users/tenants, contract Mobility và render.
- Hồi quy dùng `next/navigation` và `getMobilityVehicleInventorySummary` thật; chỉ mock Supabase I/O theo từng bảng và ba component view. Không truy cập DB hoặc sao chép môi trường.
- RED: `.\node_modules\.bin\jest.cmd --runInBand --runTestsByPath src/app/dashboard/bella-auto/__tests__/page.test.tsx` — exit 1; 1 suite failed, 1 test failed / 3 passed. Nhánh thiếu Auth trả JSX `Lỗi tải Dashboard` chứa `NEXT_REDIRECT` thay vì reject.
- GREEN: cùng lệnh sau sửa — exit 0; 1 suite passed / 4 tests passed, 0 snapshots; Jest báo 1.17 s. Kiểm tra redirect thật `/login` (307), không query/log fatal khi thiếu Auth; tenant/summary props đúng; thiếu tenant không đọc inventory; inventory failure giữ error UI.
- Lint: `.\node_modules\.bin\eslint.cmd src/app/dashboard/bella-auto/page.tsx src/app/dashboard/bella-auto/__tests__/page.test.tsx` — exit 0; không có lint error. Có cảnh báo cấu hình `.eslintignore` cũ từ ESLint, không sửa ngoài phạm vi.
- Whitespace: `git diff --check` — exit 0. Hai file mới được kiểm tra bằng `git diff --no-index --check -- /dev/null <file>` — mỗi lệnh exit 1 do có nội dung mới, không báo lỗi whitespace; chỉ cảnh báo LF sẽ đổi thành CRLF theo cấu hình checkout.
- Runtime dependency kiểm thử là Next `16.2.11` đang cài qua junction `node_modules`; không nâng cấp dependency. Full repository typecheck/build không chạy trong scope Builder.
- HTTP sau sửa: `NOT_RUN` trong phạm vi Builder; Lead tiếp tục xác minh runtime. Browser trực quan sau sửa: `NOT_PROVEN` do browser bị tắt trong Work settings. Unit PASS không chứng minh Real DB/RLS, Browser E2E hoặc Go-Live.
- Migration, Healthcare/Education/Logistics regression: `NOT_APPLICABLE` cho diff này vì chỉ đổi control flow page AutoMove và thêm unit test; không đổi schema, quyền, shared auth, public contract hoặc Kernel.
- Không commit, stage, push, merge hoặc deploy.

### Xác minh cuối của Lead

- Review độc lập: blind review và edge review nêu cùng một thay đổi là lỗi khởi tạo Auth được chuyển cho framework. Lead phân loại là hành vi đã chủ định trong spec, không phải lỗi dữ liệu bị nuốt; acceptance auditor xác nhận không vi phạm scope/acceptance. Không có finding cần sửa. Các reviewer chỉ đọc, không tự chạy test.
- `npm run arch:guard` — exit 0; guard hiện tại kiểm tra frozen files hiện diện và không có forbidden imports. Không suy rộng thành kiểm chứng hash hoặc toàn bộ regression Kernel.
- Trước khi áp dụng local, xác nhận page trong checkout chính không có thay đổi riêng. Chỉ copy page đã kiểm thử vào checkout chính; SHA-256 hai bản bằng nhau: `84BEC6AF1F821BF93FDF857059CB5A9B600B2A0AFF7F0D0F5655C8F44EB3BD70`. Không copy test/spec vào checkout Preschool, không đổi file khác.
- Runtime cuối: cổng 3000, PID 13128, Next `start-server.js` trong `D:\Antigravity\Projects\BELLA SPA ERP`; PID khác thời điểm điều tra ban đầu. Không restart server trong task này.
- Đăng nhập bằng tài khoản fixture có sẵn qua public Supabase client: `PASS`; không dùng admin, không reset/provision, không ghi token/cookie ra file.
- HTTP sau sửa: command exit 0. GET dashboard với cookie thật và `RSC: 1` trả 200 / `text/x-component`; Flight chứa đủ Header, Analytics, Inventory, đúng tenant của hồ sơ đăng nhập và summary props. Không chứa `Lỗi tải Dashboard` hoặc `NEXT_REDIRECT`.
- API dashboard `/api/bella-auto/analytics/recognized-sales` qua cùng phiên: HTTP 200, response shape đúng (summary, 6 tháng, topModels). Không in dữ liệu tài chính.
- Anonymous GET dashboard: HTTP 307, Location `/login?next=%2Fdashboard%2Fbella-auto`.
- Log Browser sau đăng nhập thật ghi `Analytics loaded successfully` và `Loaded vehicles`; đây là bằng chứng client data flow trước bản sửa page, không thay thế screenshot/E2E sau sửa.
- Browser trực quan sau sửa: `NOT_PROVEN`, công cụ báo local browser bị tắt trong Work settings. Không thay đổi cài đặt hoặc dùng đường vòng. Full build/typecheck, full Real DB/RLS isolation suite, production và Go-Live không được chứng minh bởi các kiểm tra này.
- Kết quả phạm vi local control-flow/HTTP: `PASS`. Chưa stage/commit/push/merge/deploy; giữ nguyên các thay đổi có sẵn.

## Suggested Review Order

- Kiểm tra Auth và redirect thoát khỏi catch tải dữ liệu.
  [page.tsx:26](../src/app/dashboard/bella-auto/page.tsx#L26)
- Đối chiếu nhánh tải dữ liệu và tenant giữ nguyên.
  [page.tsx:40](../src/app/dashboard/bella-auto/page.tsx#L40)
- Kiểm tra hồi quy redirect thật và các nhánh dữ liệu.
  [page.test.tsx:89](../src/app/dashboard/bella-auto/__tests__/page.test.tsx#L89)
