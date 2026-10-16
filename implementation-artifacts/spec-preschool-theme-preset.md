---
title: 'Đồng bộ màu Preschool theo tenant theme preset'
type: 'bugfix'
created: '2026-10-16'
status: 'in-review'
baseline_commit: '0639dd98f'
context:
  - 'docs/architecture/preschool-theme-preset/ARCHITECTURE_GATE_RESULT.md'
---

<frozen-after-approval reason="human-owned intent">

## Intent

**Problem:** Preschool dùng màu thương hiệu viết trực tiếp và nhánh sidebar ánh xạ bảng màu riêng nên chưa đồng bộ theme preset như Spa.

**Approach:** Dùng CSS tokens và branding resolver hiện hữu cho màu thương hiệu. Rà soát toàn bộ route Education, giữ nguyên chức năng và nghiệp vụ.

## Boundaries & Constraints

**Always:** Giữ handler, validation, phân quyền, trạng thái, dữ liệu, số liệu, route và ý nghĩa màu cảnh báo. Theme theo tenant, kiểm tra sáng/tối và mobile.

**Ask First:** Nếu cần sửa contract, provider ngoài presentation, persistence hoặc logic nghiệp vụ.

**Never:** Đổi DB/RLS/auth, Kernel, registry, service, migration; import Spa product; ghi tenant settings; sửa mock/static data; commit/push/PR khi chưa yêu cầu.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Preset | Một trong sáu preset hiện hữu | Brand colors theo tokens của preset | Giữ fallback hiện hữu |
| Custom | Tenant có custom colors | Tôn trọng màu resolver đã chuẩn hóa | Không tự ghi lại cấu hình |
| Appearance | Light/dark, desktop/mobile | Text, selected, hover, focus đủ tương phản | Ghi lỗi nếu browser chưa chứng minh |
| Status | Có mặt/vắng/cảnh báo | Giữ ý nghĩa màu và trạng thái | Không thay điều kiện nghiệp vụ |

</frozen-after-approval>

## Code Map

- `src/lib/business-rules/tenant-modules.ts` — nguồn chuẩn preset/tokens, chỉ đọc; Education default `slate_minimal`.
- `src/components/layout/Sidebar.tsx` — nhánh Education ánh xạ màu riêng; thay presentation có scope.
- `src/app/dashboard/education/**/*.tsx` — 17 trang, rà soát brand class/style và các modal/tab nội bộ.
- `src/app/globals.css` — preset CSS hiện hữu, chỉ bổ sung scope nếu component tokens chưa đủ.
- `src/app/dashboard/layout.tsx` — runtime branding hiện hữu, đọc để kiểm tra cascade.
- `src/__tests__/beauty-spa-theme-preset-isolation.test.ts` — regression tham chiếu cho tenant isolation.

## Tasks & Acceptance

**Execution:**
- [x] `Sidebar.tsx` — dùng token hiện hữu cho Education shell/nav, giữ navigation và branding text.
- [x] `src/app/dashboard/education/**/*.tsx` — phân loại brand/status/category trước khi thay; chỉ sửa brand styling.
- [x] `src/app/globals.css` — kiểm tra cascade/scope; không override toàn cục các utility màu.
- [x] Lưu bằng chứng route/preset sweep và diff không đổi business logic.

**Acceptance Criteria:**
- Given tenant dùng preset, when mở trang Education, then brand surfaces dùng tokens tương ứng thay vì palette cố định.
- Given custom colors, when hover/select/focus, then UI tôn trọng resolved tokens.
- Given form/filter/action, when thao tác, then inputs, handlers và outcomes giữ nguyên.
- Given Spa hoặc tenant khác, when kiểm tra regression, then không có thay đổi style ngoài scope.

## Spec Change Log

## Design Notes

Audit source không chứng minh production đang dùng preset nào. Sidebar đã hỗ trợ một số preset bằng các palette riêng; không được mô tả là hoàn toàn thiếu preset. Màu chart category và status không tự động chuyển sang primary. Không sao chép nghiệp vụ Spa.

## Verification

**Commands:**
- `git diff --check` — không lỗi whitespace.
- Focused ESLint và `npm run typecheck:changed` — không lỗi mới trong scope.
- Focused theme tests và `npm run education:architecture` — PASS.
- `npm run healthcare:verify` — PASS theo Education constitution; thiếu môi trường phải ghi UNVERIFIED.

Browser: sáu preset, custom colors, light/dark, desktop/mobile; sweep 17 route và tab/modal có thay đổi. Không claim runtime PASS khi chỉ có source/mocks. Business logic preservation dùng diff review; không chạy mutation production để chứng minh màu.

## Verification Result

Xem [bằng chứng và giới hạn](../docs/architecture/preschool-theme-preset/VERIFICATION.md). 17 route render; 64 theme cases; 28 tab/modal interactions; AST 18/18; lint, full strict typecheck, 16 theme tests và Education no-new-debt PASS. Education architecture có 217 findings baseline; Healthcare full regression thiếu DB environment. Arbitrary custom-color contrast có giới hạn resolver dùng chung, DEFER. Giữ `in-review`; không claim full platform/production PASS.

## Suggested Review Order

- Tokens scoped cho Preschool, không override utility màu toàn cục.
  [globals.css](../src/app/globals.css#L7443)

- Sidebar dùng resolved colors, giữ nguyên navigation.
  [sidebar.tsx](../src/components/layout/sidebar.tsx#L1067)

- Điểm nhấn dashboard theo preset, giữ nguyên status/chart data.
  [page.tsx](../src/app/dashboard/education/page.tsx#L480)

- Nền và chữ Learning theo light/dark; handlers giữ nguyên.
  [learning/page.tsx](../src/app/dashboard/education/learning/page.tsx#L117)

- Kết quả QA, evidence và các boundary chưa chứng minh.
  [VERIFICATION.md](../docs/architecture/preschool-theme-preset/VERIFICATION.md)
