---
title: 'Thử giao diện đánh giá với phản hồi trung thực'
type: bugfix
created: '2026-10-17'
status: done
baseline_commit: 91468e5cb98030636f339e160d6baad70c4348ff
context:
  - docs/audits/preschool-grades-trial/ARCHITECTURE_GATE_RESULT.md
---

<frozen-after-approval reason="Owner approved PRODUCT_FIRST_PRE_GO_LIVE safe independent UI fixes; tiếp tục confirms this evidence-backed batch">

## Intent

Màn Đánh giá phát triển báo đã lưu dù chỉ đóng modal, và báo đang xuất dù không có file. Sửa phản hồi để người thử giao diện biết giới hạn và không mất nội dung nhập. Đánh dấu roster, KPI, lịch sử và gợi ý là minh họa; không triển khai persistence.

## Boundaries & Constraints

Always: chỉ sửa một UI page và focused tests/proof. Giữ draft trong component, không giả lưu bằng localStorage. Hiển thị status rõ ràng khi chưa lưu/xuất, không dùng thông báo thành công. Giữ các tab/filter/layout đang có trừ accessibility tối thiểu. Chỉ synthetic/browser loopback; giữ hai HTTP503 và các PR cũ.

Ask first: field/business semantics mới, API/DB/contract/RLS/authorization/migration, mở endpoint, merge hoặc release.

Never: tạo permission engine/provider/writer; nạp baseline/C10, Auth fixture, đọc dữ liệu thật, chạy broad integration, sửa frozen Kernel hoặc khẳng định UI→DB/Pre-Go-Live PASS.

## I/O & Edge-Case Matrix

| Scenario | State/input | Expected behavior |
|---|---|---|
| Save unavailable | Student/domain/skill/progression/note/media count filled | Modal stays open, every field unchanged, persistent accessible non-success feedback |
| Repeated save/time | Click again, wait > old toast timeout | Still no success, reset or fake record |
| Explicit close/reopen | Close modal then reopen in same mount | Draft retained; UI does not promise reload persistence |
| Export unavailable | Existing export action | Clear unavailable message, no fake progress/success or download |
| Sample display | Roster/KPI/history/AI/detail drawer | Clear sample label, no claim actual analysis or saved assessment |
| Light/dark/mobile | Desktop and narrow viewport | Changed labels/status usable, no overflow and readable contrast |

</frozen-after-approval>

## Code Map

- `src/app/dashboard/education/grades/page.tsx`: existing sample workspace, local form and fake success/export handlers.
- `src/app/dashboard/education/grades/__tests__/page.test.tsx`: focused interaction regressions; tenant resolver mocked, downstream network prohibited.
- This directory: bounded reproducible offline test/browser proof; reuse existing UI proof pattern.

## Tasks & Acceptance

- [x] Reproduce false save/export behavior from current source or failing focused tests.
- [x] Change UI feedback and sample labelling; connect labels/dialog/status accessibility, retain draft and navigation.
- [x] Run focused tests/lint/typecheck plus synthetic browser light/dark/mobile and changed-text contrast checks.
- [x] Independent read-only review; commit and draft PR under existing Owner authority; update current mission index and stop.

Given an entered draft, when save is requested, then show not-saved status and retain every field/modal without downstream calls.

Given explicit close/reopen or elapsed old timer, when modal is viewed, then entered content remains in this mount with no persisted success claim.

Given export/sample AI actions, when used, then response makes unavailable/sample behavior explicit and no evidence of real output is fabricated.

Given final report, when verification is summarized, then distinguish UI/component/browser proof from DB/Auth/full Product readiness; keep Parent RLS FAIL, Course authorization BLOCKED and Pre-Go-Live BLOCKED.

## Verification

Only new scoped tests with no environment/DB side effects; changed-file ESLint; Education/UI test typecheck; exact diff scope; loopback synthetic component browser. Do not rerun accepted old UI suites or C10 containment tests absent relevant change. No full Next build or integration inference from a component harness.

Kết quả: 8/8 focused tests, 4/4 synthetic browser cases, 32/32 targeted contrast checks; typecheck/lint PASS. Ba reviewer độc lập; hai finding feedback mobile đã sửa và được reviewer xác nhận. Không DB/Auth/full Next E2E; Parent RLS FAIL, Course authorization BLOCKED, Pre-Go-Live BLOCKED.

## Suggested Review Order

**Phản hồi trung thực**

- Nêu rõ dữ liệu mẫu và giới hạn trước khi dùng màn hình.
  [page.tsx:699](../../../src/app/dashboard/education/grades/page.tsx#L699)

- Đặt thông báo xuất chưa khả dụng cạnh nút thao tác.
  [page.tsx:1111](../../../src/app/dashboard/education/grades/page.tsx#L1111)

**Bản nháp và mobile**

- Giữ sáu trường và hiện trạng thái chưa lưu cạnh nút.
  [page.tsx:1753](../../../src/app/dashboard/education/grades/page.tsx#L1753)

**Kiểm chứng**

- Regression giữ bản nháp, xử lý thời gian chờ và nhãn minh họa.
  [page.test.tsx:35](../../../src/app/dashboard/education/grades/__tests__/page.test.tsx#L35)

- Kiểm tra feedback ngay sau thao tác, trước đo tương phản hoặc cuộn.
  [browser-component.cjs:114](browser-component.cjs#L114)
