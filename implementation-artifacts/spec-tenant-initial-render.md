---
title: 'Chặn giao diện Spa trước khi xác định tenant'
type: 'bugfix'
created: '2026-10-19'
status: 'in-review'
baseline_commit: '40d14455e06cb4f7287c766558b5c63baf0dd3a8'
pr_base_commit: '4816e75b1dbcca12c110c98af6da3604d793d962'
context:
  - docs/governance/BELLA_AI_CODING_CONSTITUTION.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tenant khác xuất hiện theme hoặc dashboard Spa trong lúc tải identity. Cache chưa xác nhận và nhiều nơi ghi theme tạo trạng thái trung gian sai.

**Approach:** Giữ giao diện trung tính đến khi có tenant và product hiện hành. Render/điều hướng bằng contract đã tồn tại; không chọn Spa khi identity còn thiếu.

## Boundaries & Constraints

**Always:** Product Identity theo `tenant.product_key → ProductResolver → ProductRegistry`; theme tùy chỉnh giữ ưu tiên. Dùng trạng thái loading/error sẵn có. Xác nhận tenant trước khi dùng cache.

**Ask First:** Thay contract, quyền, fallback xác thực, schema hoặc dữ liệu production.

**Never:** Sửa Auth/RLS, dev authorization, kernel, nghiệp vụ, registry entries hoặc provisioning. Không commit/push khi chưa được yêu cầu.

## I/O & Edge-Case Matrix

| Input/state | Expected | Error handling |
|---|---|---|
| Chưa tải tenant/product | Skeleton trung tính | Không mount dashboard Spa |
| Cache Spa của phiên trước | Không áp dụng trước xác nhận | Không dùng cache làm identity |
| Product xác định | Đúng giao diện/route hiện hành | Giữ custom brand |
| Thiếu/lỗi identity | Loading/error trung tính | Không giả tenant hoặc chọn Spa |

</frozen-after-approval>

## Code Map

- `public/theme-bootstrap.js`: ghi `pending`, sau đó áp cache không xác nhận.
- `src/app/globals.css`: trạng thái `pending` vẫn có nền/token Spa và nằm trong nhóm style Spa tối.
- `src/core/providers/TenantContextProvider.tsx`: mặc định `baby_care`; ghi đè theme từ modules, bỏ sót Education.
- `src/components/layout/DashboardLoadingShell.tsx`: mount sidebar/children khi UserProvider còn loading.
- `src/components/layout/sidebar.tsx`: đọc brand cache trước settings; state đầu chưa có brand thật.
- `src/app/dashboard/page.tsx`: `!tenantModuleKey` chọn Beauty; Education chưa được chặn khi chờ redirect.
- `src/hooks/useTenantModuleKey.ts`: cache chưa đối chiếu tenant; settings rỗng đi qua module fallback.
- `src/lib/business-rules/product-presentation-routing.ts`: helper UI hiện có để dùng chung quyết định root route/brand, tránh layout và sidebar lệch nhau.

## Tasks & Acceptance

**Execution:**
- [x] `public/theme-bootstrap.js` — giữ neutral trước identity, bỏ áp cache chưa xác nhận.
- [x] `src/app/globals.css` — giữ pending trung tính ở light/dark; không đổi palette sản phẩm đã resolve.
- [x] `src/core/providers/TenantContextProvider.tsx` — bỏ việc ghi theme Spa mặc định trên dashboard; giữ nguyên fetch/context/auth semantics, để dashboard brand runtime sở hữu theme.
- [x] `src/components/layout/DashboardLoadingShell.tsx`, `src/components/layout/sidebar.tsx` — chặn shell/menu đến khi context hiện hành sẵn sàng; cache không quyết định identity ban đầu.
- [x] `src/lib/business-rules/product-presentation-routing.ts` — adapter UI thuần dùng lại resolver hiện hành; brand/route dựa trên tenant hiện hành và product đã resolve, neutral cho modules rỗng; không sửa public contract.
- [x] `src/app/dashboard/page.tsx`, `src/hooks/useTenantModuleKey.ts` — không biến missing/loading/error thành Spa; giữ skeleton khi redirect. Dùng `product.defaultRoute` hiện có khi cần route riêng; bảo toàn root operational đã hợp lệ của Haircut/Babycare/Spa/Nail và route đang ở đích.
- [x] Tests UI tập trung cho loading, lỗi, cache khác tenant và render/redirect theo các product đã đăng ký.

**Acceptance Criteria:**
- Given đăng nhập tenant ngoài Spa, when tải chậm hoặc cache chứa Spa, then không render brand/menu/dashboard Spa trước tenant chuẩn.
- Given product hợp lệ và custom brand, when tải xong, then giữ đúng route và brand hiện hành.
- Given lỗi tải identity, when hoàn tất request, then không render một product mặc định khác.

## Spec Change Log

Review 1: xử lý như patch trong intent đã duyệt: neutral defaults phải chịu được custom field rỗng/invalid; logo dùng kết quả normalize; product presentation không được chọn module entitlement của product khác; error không chạy fetch/realtime Spa hoặc giữ redirect skeleton vô hạn. Giữ operational roots, theme hợp lệ, guard identity và 1.025 rule CSS ready đã kiểm chứng.

## Design Notes

Change Map: sửa consumer UI, `EXISTING_CAPABILITY_REUSE`. Source of truth: Constitution §8–9 và ProductRegistry; owner: Platform identity, consumer: shared dashboard. Không thêm contract/backend. Đây là bảo trì luồng render hiện có, không tạo Product hoặc redesign. API/DB/auth giữ nguyên. Rollback bằng hoàn nguyên các file UI trong diff.

User approved kế hoạch ngày 2026-10-19. Lead giữ contract, review và integration tại checkout gốc. Builder duy nhất sở hữu implementation trong worktree `tenant-initial-render`, branch `codex/tenant-initial-render`; không sửa đồng thời checkout gốc. Story không thuộc epic nên không sync sprint status.

Role map: Software Engineer dùng `bmad-quick-dev`, input là spec đã duyệt, output là UI patch và focused tests trong worktree riêng. Lead giữ QA/contract/integration và yêu cầu evidence thực thi. Không ủy quyền thay đổi identity/kernel/contract.

Kiểm tra thêm cho thấy route Spa/Nail chuyên biệt đang có journey/demo UI, trong khi root hiện hành chứa operational dashboard. Sửa first render không được chuyển workflow đúng sang demo. Vì vậy giữ root hợp lệ của bốn product nêu trong task; những product cần dashboard riêng tiếp tục dùng defaultRoute đã đăng ký. Product đã phân loại nhưng không có module presentation được chứng minh (ví dụ Hospitality/Manufacturing với modules rỗng) giữ neutral/custom brand, không gán Babycare hoặc Cleaning.

Reconciliation UI theo navigationProfile đã đăng ký: haircut/spa/nail → beauty_spa; babycare → babycare; education/english-center → bella_education; hospital → bella_healthcare (nhận capability alias healthcare hiện hành). Chỉ dùng presentation tương ứng đã được enable; không ghi lại enabled_modules. Unknown/missing/mismatched → neutral/error. UserProvider snapshot là nguồn UI đã đối chiếu tenant; không refetch riêng để suy ra identity khác ở sidebar.

Legacy auto-upgrade có ghi theme đã tồn tại trước patch và guard mới thu hẹp đối tượng. Đây là debt có sẵn, không mở rộng sửa producer/action trong task này.

## Verification

- `npx jest --runInBand src/platform/registry/__tests__/product-resolver.test.ts src/platform/registry/__tests__/product-registry.test.ts src/__tests__/tenant-isolation-source-guards.test.ts` — giữ invariant và contract.
- Chạy tests UI mới cùng ESLint trên file sửa; `git diff --check`.
- Kiểm tra cold load/cache sai/response chậm cho product đã đăng ký; trace cả trước và sau render. Mock UI chỉ chứng minh presentation; browser thật chưa khả dụng thì ghi `NOT_PROVEN`.

### Baseline trước implementation

`jest --runInBand --runTestsByPath` với ba file nêu trên: 3 suites, 98 tests; 97 passed, 1 failed. Failure sẵn có: `keeps Beauty Spa visual theme scoped behind the tenant module marker`, kỳ vọng CSS `--beauty-night: #0B1F3A`. Không sửa palette ngoài phạm vi. Evidence cục bộ: `.cache/tenant-initial-render/baseline-jest.json`.

### Healthcare / Real DB environment

Đã chạy `npm run healthcare:verify` trong worktree: Architecture Guard PASS, architecture 2 suites/9 tests PASS, conformance 1 suite/7 tests PASS. Full integration bị dừng vì worktree không có env và Jest dùng mock.supabase.co (ENOTFOUND); không có tổng counter cuối cho lượt abort. Kiểm tra cấu hình gốc: .env.test cùng project với production; .env.e2e là project riêng, đọc tenants/party/journey HTTP 200 nhưng thiếu hc_encounters/hc_cds_rules (PGRST205) và tenant fixture Healthcare. Không sao chép khóa, không chạy destructive test lên production, không tạo schema/migration. User không biết DB Healthcare test chuẩn; REAL_DB_HEALTHCARE = BLOCKED theo môi trường, không phải regression UI đã chứng minh.

### Kết quả sau integration vào localhost

- Tích hợp đúng 14 file đã review vào checkout gốc, SHA-256 khớp từng file với worktree. Baseline và target đã được kiểm tra trước copy; không đụng file có thay đổi khác. Worktree được giữ để review, không commit/push.
- Chạy 10 suite chính xác với `--runTestsByPath --roots src`: 197 tests, 196 PASS / 1 failure palette có sẵn; 83/83 test hành vi mới PASS. Có thêm hồi quy product routing, vocabulary và BookingModal/branch.
- ESLint 13 file JS/TS/test sửa: exit 0, chỉ cảnh báo .eslintignore có sẵn. `git diff --check`: exit 0.
- So sánh PostCSS sau integration: 1.025 rule ngoài pending giữ nguyên selector order và giá trị/importance của declarations.
- Review độc lập: Blind Hunter, Edge Case Hunter, Acceptance Auditor. Tất cả finding có thể tái hiện trong scope đã được patch. Lượt cuối xác nhận guard nullable product (TS18047) và custom accent trong embedded; thêm guard tường minh và test first-ready-frame cho accent đã cấu hình.
- HTTP localhost: `/theme-bootstrap.js` và `/login` trả 200; script phục vụ trạng thái pending, không đọc brand cache. Route Education không có cookie trả 307 về login đúng contract.
- Lượt xin phiên Preschool mới sau integration bị Supabase Auth timeout. Không lấy được phiên để khẳng định authenticated HTTP mới; các lần thành công trước đó không thay thế bằng chứng sau patch.
- Điều khiển browser đang tắt trong Work settings: BROWSER_E2E = NOT_PROVEN. Full typecheck không chạy; diagnostic nullable được reviewer kiểm tra riêng, không được gọi là full type PASS.
- UI_IMPLEMENTATION = APPLIED_AND_LOCALLY_VERIFIED. FULL_GATE / REAL_DB / BROWSER_SEAL = NOT_PROVEN; giữ spec in-review, không tuyên bố SEALED_ON_MAIN hoặc Go-Live.

Evidence cục bộ không chứa credentials: `.cache/tenant-initial-render/integrated-jest.json`, `integrated-eslint.log`, `integrated-css.json`, `integrated-file-hashes.json`, `localhost-public-http.json`.

### PR delivery authorization

User yêu cầu `push PR` sau khi nhận báo cáo verification. Phạm vi commit/push được mở cho đúng patch tenant render và hai work record của task; không bao gồm investigations đăng nhập, tài liệu Bella Land, .cache hoặc .env.

PR branch `codex/tenant-initial-render-pr` bắt đầu từ origin/main `4816e75b1dbcca12c110c98af6da3604d793d962`. Mười file tracked sửa có nội dung baseline giống hệt giữa commit implementation cũ và PR base; áp nguyên patch đã review mà không kéo các commit Preschool khác vào PR. Bốn test mới giữ nguyên nội dung.

Rerun tại PR branch: 10 suites / 197 tests; 196 PASS, 1 baseline palette failure; 83/83 test mới PASS. ESLint, secret/log scan trên runtime files sửa, configured-credential scan trên 16 file giao PR, Architecture Guard và diff-check đều PASS. Không copy .env; tests UI có mocked contracts, không gọi Real DB. PR để draft do browser/Real DB/full gate chưa được chứng minh.

## Suggested Review Order

- Product quyết định presentation; lỗi identity không trở thành Spa.
  [product-presentation-routing.ts:31](../src/lib/business-rules/product-presentation-routing.ts#L31)
- Reset/applied brand trước paint, giữ accent tùy chỉnh.
  [product-presentation-routing.ts:87](../src/lib/business-rules/product-presentation-routing.ts#L87)
- Shell đợi user, tenant và product khớp nhau.
  [DashboardLoadingShell.tsx:88](../src/components/layout/DashboardLoadingShell.tsx#L88)
- Chặn outgoing root khi chuyển dashboard sản phẩm.
  [page.tsx:1098](../src/app/dashboard/page.tsx#L1098)
- Bootstrap và CSS pending giữ trung tính.
  [theme-bootstrap.js:29](../public/theme-bootstrap.js#L29)
  [globals.css:1548](../src/app/globals.css#L1548)
- Test trạng thái loading, lỗi, stale cache và custom brand thực thi trên component.
  [tenant-initial-render-shell.test.tsx:1](../src/__tests__/tenant-initial-render-shell.test.tsx#L1)
