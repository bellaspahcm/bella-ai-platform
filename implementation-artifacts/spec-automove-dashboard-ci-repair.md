---
title: Khôi phục AutoMove dashboard và xác minh blocker CI
type: bugfix
created: 2026-10-19
status: in-review
baseline_commit: f556e8dd31e850bd66607da1a5a18ca3b05e7dee
context:
  - docs/governance/BELLA_AI_CODING_CONSTITUTION.md
  - docs/architecture/acr/ACR-2026-020-tenant-dashboard-presentation.md
---

<frozen-after-approval reason="Người dùng approve phương án sửa tương thích AutoMove và xác minh 403 trong chat">
## Intent
**Problem:** CI AutoMove trên main build/login thành công nhưng dashboard guard mới chặn tenant chỉ có enabled_modules.bella_auto; run trước đó còn lỗi bàn giao 403 chưa rõ nguyên nhân.
**Approach:** Khôi phục consumer hiển thị theo AutoMove Vertical Manifest đã tồn tại; giữ ProductIdentity riêng biệt. Chạy E2E Non-Production để thu thập mã lỗi bàn giao và sửa đúng owner chỉ khi bằng chứng đủ.

## Boundaries & Constraints
**Always:** Chờ context xác thực; user.tenant_id khớp tenant.id. Product hợp lệ ưu tiên. Chỉ tenant thiếu/null product_key và bật bella_auto được chọn manifest AutoMove; giữ product=null. Unknown explicit key phải fail closed. Giữ neutral startup và mọi kiểm tra tenant/auth/RLS, idempotency, event-after-persistence.
**Ask First:** Capability/identity/nghiệp vụ mới, sửa public contract, Core/frozen Kernel, schema/RLS/grants, Production, hoặc mở rộng quyền.
**Never:** Tạo Product key/definition giả, suy ProductIdentity từ module, fallback Spa, nâng role để test qua, sửa dữ liệu Production hoặc che giấu gate chưa PASS.

## I/O & Edge-Case Matrix
| Scenario | Input | Expected | Error handling |
|---|---|---|---|
| AutoMove legacy | Auth/tenant khớp, thiếu/null key, bella_auto bật | Brand/menu/route manifest; không Spa queries | Giữ guard backend |
| Product đăng ký | Product hợp lệ dù bật thêm AutoMove | Giữ route/brand Product | Không chọn AutoMove thay thế |
| Key sai | Key không đăng ký dù AutoMove bật | Neutral error, không render children | Fail closed |
| Context chưa đủ | Loading, mismatch tenant, module tắt | Không lộ dữ liệu/brand cũ | Loading hoặc error |
| Bàn giao lỗi | Response 403 | Giữ assertion 200; thu code/error đã lọc | Không tự nới quyền |
</frozen-after-approval>

## Code Map
- `src/lib/business-rules/product-presentation-routing.ts`: helper tương thích hiển thị; reuse manifest, không đổi ProductResolver.
- `src/components/layout/DashboardLoadingShell.tsx`, `src/components/layout/sidebar.tsx`: shell, brand, menu sau xác thực.
- `src/app/dashboard/page.tsx`: root redirect, giữ neutral đến đúng route.
- `src/hooks/useTenantModuleKey.ts`, `src/app/dashboard/layout.tsx`: consumer dùng cùng kết quả hiển thị để tránh lệch theme/context.
- `src/__tests__/tenant-initial-render-{brand,shell,dashboard,hook}.test.*`: regression hiện có.
- `e2e/tests/42-automove-dashboard-sales-chain.spec.ts`: assertion diagnostic; không sửa expected status hoặc fixture quyền.
- `src/modules/bella-auto/services/AutoMoveSaleChain{Service,Http}.ts`: chỉ đọc cho đến khi xác định nguyên nhân 403.

## Tasks & Acceptance
**Execution:**
- [x] Sửa consumer UI và thêm regression AutoMove, giữ ProductRegistry/Core nguyên trạng.
- [x] Thêm diagnostic bàn giao chỉ gồm status/code/error, giữ expected 200.
- [ ] Chạy focused tests, lint, typecheck, guard, review độc lập và built RC Non-Production.
- [ ] Nếu 403 tái hiện, xác minh owner/canonical invariant trước mọi repair; ghi thiếu bằng chứng nếu chưa đủ.

**Acceptance Criteria:**
- Given AutoMove tenant hợp lệ chưa khai Product, when login, then tới /dashboard/bella-auto, menu đúng manifest và không mount Spa actions.
- Given explicit unknown key hoặc tenant mismatch, when context ready, then neutral error và không render children.
- Given Product đã đăng ký, when AutoMove cũng enabled, then Product vẫn ưu tiên.
- Given handover response lỗi, when E2E fail, then có mã lỗi dùng chẩn đoán, không bỏ assertion.

## Spec Change Log

## Design Notes
Change Map: EXISTING_CAPABILITY_REUSE tại shared UI consumers. Nguồn chuẩn presentation: bellaAutoManifest key/themeKey/defaultRoute, đăng ký VerticalRegistry. ProductIdentity vẫn tenant.product_key → ProductResolver → ProductRegistry. Owner nghiệp vụ là AutoMove/Mobility contracts. Không migration, không chỉnh ACR020 Core guard. Gate consumer compatibility PASS; HANDOVER_403_ROOT_CAUSE=NOT_PROVEN, repair auth/DB chưa được phép suy diễn. Người dùng đã approve phương án trong chat; không hỏi lại quyết định đó.

Business Test Contract: identity đúng tenant mới được render; registered identity không bị entitlement thay thế; chưa có nghiệp vụ bàn giao mới. Bằng chứng CI39223358502 và39222582755 timeout dashboard; CI39218431094 allocation/deposit/snapshot/approval qua, handover403. Không quy mọi failure về cùng nguyên nhân.

## Verification
- Focused Jest cho các first-render suites và AutoMove runner; ESLint file thay đổi; TypeScript scope liên quan.
- Architecture guard và diff-check; xác nhận không sửa backend/Kernel trước chứng cứ.
- Built RC runner với cấu hình `.env.e2e` Non-Production, target được runner kiểm tra fail-closed; cần commit candidate inputs để ràng buộc SHA. Local commit phục vụ provenance, chưa push khi chưa được yêu cầu.
- Không đưa secrets, env files hoặc raw DB diagnostics vào commit. Synthetic tests không thay Real DB/E2E proof; full PASS chỉ khi evidence thật xác nhận.

## Local Verification
- UI first-render regression: 4 suites, 111/111 tests PASS.
- AutoMove RC runner/HTTP/connection/Mobility regression: 4 suites, 54/54 tests PASS.
- Changed-file ESLint: exit 0; chỉ cảnh báo cấu hình eslintignore hiện hữu.
- `npm run typecheck:full`: exit 0, zero diagnostics.
- Healthcare Architecture Guard và `npm run arch:guard`: exit 0, zero violations.
- Ba review độc lập blind/edge/acceptance: không actionable findings. Diff không chạm Core/Kernel/ProductRegistry/AutoMove service.
- Built RC Non-Production: đang chờ candidate commit ràng buộc SHA; chưa có claim DB/browser PASS.
