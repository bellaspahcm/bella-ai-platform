---
title: Hiển thị dữ liệu hóa đơn Preschool trung thực khi tải rỗng hoặc lỗi
type: bugfix
created: 2026-10-17
status: done
baseline_commit: 0bc9bba1b888ca121dd4ae56eb9ff7ebb1c9831f
context:
  - docs/governance/BELLA_AI_CODING_CONSTITUTION.md
  - docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md
---

<frozen-after-approval reason="User Product-first mission authorizes safe UI and validation fixes; existing broader spec accepted">
## Intent
**Problem:** Finance GET rỗng/lỗi đang biến thành học sinh/hóa đơn mẫu và có thể gửi ID fallback khi lập nháp. Preview còn hiển thị tiền/kỳ thu giả. Đây là lỗi consumer đã được audit, không phải thay đổi quy tắc thu phí.
**Approach:** Chỉ hiển thị danh sách GET thực trả về. Tách loading/empty/error, cho retry, khóa thao tác dựa trên dữ liệu chưa tải hoặc không được chọn hợp lệ. Giữ API/contract hiện hữu và dùng kết quả command làm nguồn thành công.

## Boundaries & Constraints
**Always:** source of truth cho danh sách/ID/trạng thái/số tiền là FinanceStateResponse và Invoice/BillingPeriod public Product types. Không tự suy diễn số liệu hoặc quyền. Giá trị request lấy đúng lựa chọn hợp lệ, không fallback sang trẻ khác. Bản preview không có endpoint tính tiền thì chỉ là xác nhận học sinh/kỳ thu, không dựng phí.
**Ask First:** Parent RLS, authorization/delegation, Course, schema, migration, baseline load, E01 mutation ngoài preflight.
**Never:** Sửa backend/Finance rules/Kernel/registry; service-role bypass; remote DB/Auth/ENV; mở dữ liệu thật; tự merge/deploy. Dữ liệu minh họa ngoài invoice workspace còn giữ phải được đánh dấu rõ, không tính vào Product/Data PASS.

## I/O & Edge-Case Matrix
| State | Expected |
|---|---|
| GET pending | Không demo rows; thao tác mutation phụ thuộc dữ liệu bị khóa |
| GET success empty | Danh sách rỗng/count đúng; không lập nháp hoặc phát hành ID mẫu |
| GET fail then retry success | Lỗi rõ và retry; không stale selection/false rows; dùng dữ liệu mới |
| Loaded invoices | ID, amount, invoice/settlement status từ DTO; VOID/OVERPAID không bị đổi sang DRAFT/UNPAID |
| Selected student/period missing | Không POST; giữ lựa chọn/giải thích lỗi; không đổi sang trẻ khác |
| Preview | Tên/kỳ thu từ lựa chọn; không phí mẫu; command response mới xác nhận tiền |
</frozen-after-approval>

## Code Map
- src/app/dashboard/education/finance/page.tsx: UI consumer và handlers.
- src/app/dashboard/education/finance/__tests__/page.test.tsx: scoped component regression; new permitted QA source.
- src/products/bella-education/finance/domain/finance.types.ts: read-only type semantics.
- src/app/api/education/finance/route.ts: read-only existing transport boundary.

## Tasks & Acceptance
- [x] Finance page: remove fallback students/invoices; honest data states and retry.
- [x] Finance page: exact selections, preview identity/period, no fabricated amounts; respect canonical statuses.
- [x] Invoice counts/footer reflect loaded/filtered data; remove fake pagination in this table.
- [x] Component tests cover empty/error/retry/selection/real DTO statuses and command request IDs; classify mock evidence.
- [x] Focused tests (8/8), Education typecheck, test-source typecheck, targeted lint and four standalone browser component cases PASS in scope; no DB proof claim.

**Acceptance Criteria:**
- Given API empty/failure, when render, then no fictitious rows or synthetic-target POST.
- Given API invoice DTO, when filter/render, then record identity/status/amount match DTO.
- Given changed/revoked list selection, when preview/create, then no silent target substitution.
- Given command success with invoice, when show success, then invoice amount/number come from returned DTO.

## Spec Change Log
- User explicitly authorized Product-first safe fixes and branch/commit/PR, preserving dirty audit worktree. No additional spec approval requested; bounded child gate below.
- Builder completed UI-only fix and scoped verification. Reference analytics remain visibly labeled as illustrative, not authoritative financial totals.
- Reviewer P2 fixed: invoice-period filter now resets if its ID is absent from refreshed invoices, while keeping valid IDs even when period metadata is unavailable. Regression covers A to B refresh and retained B filter.
- Verification entry: `docs/audits/preschool-finance-truth/verification.json`. No backend, authorization, DB, migration, commit, merge or deployment performed by Builder. Parent review/PR remains pending.


## Suggested Review Order

- Loading/error/empty use only returned records.
  [page.tsx:245](../src/app/dashboard/education/finance/page.tsx#L245)
- Exact selections and returned-invoice success replace fallback and sample pricing.
  [page.tsx:302](../src/app/dashboard/education/finance/page.tsx#L302)
- Canonical status/period/amount display and filters.
  [page.tsx:423](../src/app/dashboard/education/finance/page.tsx#L423)
- Regression cases, including stale period after refresh.
  [page.test.tsx:1](../src/app/dashboard/education/finance/__tests__/page.test.tsx#L1)
- Commands, evidence limits and independent review.
  [verification.json:1](../docs/audits/preschool-finance-truth/verification.json#L1)

Local UI scope done; DB/Auth/Safety/full-tenant readiness remains unproven. PR does not authorize merge/deployment.
- Contrast follow-up: 36/36 raw WCAG normal-text ratios PASS at threshold 4.5, minimum 4.758842787868666 for newly displayed error/empty/preview texts across light/dark desktop/mobile. Measured computed foreground and native raster backgrounds with ancestor/gradient/alpha compositing; standalone fonts/preset/layout limitations remain explicit. No source change or prior suite rerun needed.
