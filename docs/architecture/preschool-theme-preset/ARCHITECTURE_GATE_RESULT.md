# Preschool theme preset — Architecture Gate

Ngày: 2026-10-16. Baseline: `0639dd98f` (remote default branch). Single-agent, worktree riêng.

## 1. Bella OS/Product Development Process Gate

Problem: màu thương hiệu Preschool chưa đồng bộ preset. Source of truth: yêu cầu người dùng; constitution; `src/lib/business-rules/tenant-modules.ts` (preset, normalization, dynamic tokens); `Sidebar.tsx`; dashboard layout; 17 trang Education.

Truth: Education mặc định `slate_minimal` (#334155/#64748B). Dashboard vẫn có tiêu đề rose, link sky, nền #F4F8FC. Sidebar có ánh xạ riêng Rose/Ocean/Jade/Navy/Slate và không tham gia đầy đủ các class shell dùng chung như Spa. Đây là bằng chứng source, chưa phải browser/runtime proof. Không coi mọi màu cố định là lỗi: trạng thái và chart categories có ý nghĩa riêng.

Capability/reuse: dùng resolver và CSS tokens hiện hữu; không thêm theme engine hay phụ thuộc sản phẩm Spa. Chỉ đồng bộ cơ chế presentation.

## 2. Product Manifest

Product: Bella Preschool; route `/dashboard/education` và các trang con. Scope: brand surfaces, heading, link, primary action, focus/hover/selected, shell. Giữ nội dung, bố cục chức năng, route, dữ liệu và hành vi hiện hữu. Không thêm KPI/action.

## 3. Ownership Map

| Dữ liệu | Owner | Quyền thay đổi |
|---|---|---|
| Theme/preset đã cấu hình | Tenant branding | Chỉ tiêu thụ để hiển thị; không ghi DB |
| Màu component Preschool | Presentation | Được sửa class/style |
| Enrollment/attendance/assessment | Education contracts/kernel | Không sửa |
| Finance, auth, RLS | Các owner hiện hữu | Không sửa |

## 4. Contract Dependency Map

Theme: `tenant.brand_theme -> resolveTenantBrandIdentity -> resolveDynamicThemeTokens/applyThemeTokensToRoot -> CSS variables -> UI`.

Nghiệp vụ: `Product -> existing public contracts -> Education Kernel`; không thay đổi đường đi. Không import Spa product code, không truy cập Kernel persistence.

## 5. Change Authority

Cho phép: UI Education; nhánh presentation Education trong Sidebar; CSS có scope nếu cần; verification và tài liệu. Không sửa `src/platform/**`, registry, services, repositories, API/DTO, DB/RLS/auth, migrations, auto-upgrade persistence. Nếu runtime context/theme provider cần sửa ngoài presentation đã chứng minh, dừng và báo dependency riêng.

## 6. UI → Contract Reconciliation

| UI | Kỳ vọng | Contract | Kết luận |
|---|---|---|---|
| Brand heading/link/button/nav | Theo preset và custom tenant colors | Existing branding resolver/tokens | MATCH về khả năng; STALE UI tại màu viết trực tiếp |
| Form/filter/action | Giữ inputs, handler, disabled, validation, route | Existing bindings, không thay đổi | Không có contract delta |
| KPI/table/chart/status | Giữ giá trị, nhãn, điều kiện, category/status semantics | Existing bindings, không thay đổi | Không có contract delta; nghiệp vụ không được tái chứng nhận bởi audit màu |

Không có field, KPI, status, action, filter hoặc workflow mới. Mock/static data hiện hữu không phải canonical business proof và không nằm trong phạm vi sửa.

## 7. Additive Migration Plan

Không migration, không ghi tenant settings, không reset password.

## 8. Eleven Automated Verification Gates Plan

1. Architecture: diff allowlist, không cross-import/Kernel/any mới; Education architecture guard.
2. Contract: kiểm tra diff không đổi API, props data, handlers, contract.
3. Tenant isolation: theme scope + nhiều tenant/preset; không đổi query.
4. RLS/auth: diff không thay quyền, auth, RLS; không tuyên bố live security proof.
5. Migration: xác minh không có SQL thay đổi.
6. Event-after-persistence: không mutation/event delta.
7. Safety/rules: không academic calculation delta.
8. Temporal: không history/state transition delta.
9. Governance: không rule/version delta.
10. Audit: không audit/event delta.
11. Regression: focused theme tests, lint, typecheck, `npm run education:architecture`, `npm run healthcare:verify`; browser light/dark, desktop/mobile, các preset và route sweep. Ghi rõ các gate chỉ được bảo toàn bằng diff và mọi runtime check chưa chạy.

## Minimal Implementation Plan / Closure

Đổi brand styling sang tokens theo từng component; không thay hàng loạt màu status/chart. Soát 17 trang và modal/tab liên quan; verify rồi báo bằng chứng. Không commit/push/PR khi chưa được yêu cầu.

**ARCHITECTURE_GATE_RESULT = PASS** cho phạm vi presentation nêu trên. Đây là entry gate, không phải implementation PASS, runtime PASS hay Go-Live. Checkpoint được người dùng duyệt bằng `A`. Kết quả triển khai và giới hạn được ghi tại `VERIFICATION.md`.
