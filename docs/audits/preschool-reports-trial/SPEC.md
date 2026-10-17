---
title: 'Báo cáo thử nghiệm với phản hồi tải xuống trung thực'
type: bugfix
created: '2026-10-17'
status: done
baseline_commit: 91468e5cb98030636f339e160d6baad70c4348ff
context:
  - docs/audits/preschool-reports-trial/ARCHITECTURE_GATE_RESULT.md
---

<frozen-after-approval reason="Owner authorizes next independent SAFE_TO_FIX UI batch after PR362 CI and scope checks">

## Intent

Nút xuất và tải báo cáo hiện không phản hồi, trong khi các KPI/biểu đồ/tài liệu là dữ liệu mẫu. Người thử cần biết kết quả chưa khả dụng và giới hạn dữ liệu, thay vì tưởng một file thật đang được tạo.

## Boundaries & Constraints

Always: chỉ sửa Reports page và test/proof; giữ tab/link hiện có, số liệu mẫu và logic nghiệp vụ. Chỉ feedback/label/accessibility/wrapping nhỏ. Feedback phải cạnh thao tác, dùng status truy cập được, không tự biến mất. Phân biệt lựa chọn kỳ với số liệu minh họa chưa được tải lại.

Ask first: export thật, thay business/metric/WHO, API/contract/Auth/DB/RLS, mở endpoint hoặc rộng src allowlist.

Never: giả file/lưu, seed/Auth fixture/E01/C10, baseline/migration, đọc env/credential/data thật, sửa Course/Kernel/theme chung, chạy lại suites cũ, merge hoặc phát hành. Không sửa các control ngoài export/download chỉ vì thấy lỗi cũ.

## I/O & Edge-Case Matrix

| Tình huống | Input | Kết quả |
|---|---|---|
| Xuất | Header export | Status chưa khả dụng, không progress/success/file |
| Tải nhanh | Mỗi tài liệu mẫu | Nêu đúng tài liệu và chưa tải; feedback ngay cạnh control |
| Tải chi tiết | Mỗi dòng tab detail | Cùng giới hạn, accessible name phân biệt tài liệu |
| Lặp/đổi kỳ | Click lại, đổi lựa chọn kỳ | Không mất phản hồi một cách gây hiểu nhầm hoặc giả refresh/report thật |
| Đổi tab | Sáu tab hiện hữu | Data sample disclaimer vẫn rõ; không fetch/Auth |
| Mobile/light-dark |390x844,1440x1000 | Feedback thấy ngay trước scroll/measurement, changed text đạt4.5:1 |

</frozen-after-approval>

## Code Map

- src/app/dashboard/education/reports/page.tsx: static reports, header/quick/detail output buttons hiện không handler.
- src/app/dashboard/education/reports/__tests__/page.test.tsx: new regressions, outbound denied.
- docs/audits/preschool-reports-trial/: offline proof; reuse established Grades harness pattern, not old test rerun.

## Tasks & Acceptance

- [x] Reproduce unavailable-output defect via failing new focused tests.
- [x] Reports page: truthful status and sample/period labels; preserve existing views and no downstream calls.
- [x] Tests/proof: output buttons, repeated actions and sample labels; lint/typecheck; four synthetic browser cases with immediate-feedback visibility and targeted contrast.
- [x] Independent review, exact diff/commit/draft PR and current evidence index.

Given any unavailable output, when clicked, then accessible persistent feedback identifies its unavailable outcome near the correct control with no file/network/success claim.
Given different sample views/period, when selected, then existing navigation still works and the UI does not claim live refreshed data or AI analysis.
Given final proof, when reported, then only scoped UI PASS is allowed; Parent RLS FAIL, Course authorization BLOCKED, UI-to-DB NOT_PROVEN and Pre-Go-Live BLOCKED remain.

## Verification

Only new offline Jest suite, changed-file ESLint, Education/new-test typecheck and isolated component browser. Reuse actual globals CSS; stub framework boundaries, deny project env and outbound. No full Next/Auth/DB or broad existing regression. Stage only exact allowlist and retain cache ignored.

Kết quả scoped: 11/11 new tests,4/4 browser cases,84/84 targeted contrast; changed-file lint và test/Education typecheck PASS. Ba reviewer độc lập không còn finding trong diff. Có giới hạn palette tên tài liệu dark cũ, chưa sửa hoặc tính vào PASS toàn trang. Không DB/Auth/migration hoặc test cũ.

## Suggested Review Order

**Phản hồi thao tác**

- Các yêu cầu xuất/tải giữ feedback riêng và cuộn tối thiểu tới status.
  [page.tsx:355](../../../src/app/dashboard/education/reports/page.tsx#L355)

**Giới hạn dữ liệu**

- Phân biệt đổi kỳ lựa chọn với tải lại dữ liệu thật.
  [page.tsx:435](../../../src/app/dashboard/education/reports/page.tsx#L435)

**Tài liệu minh họa**

- Nút tải nhanh có tên phân biệt tài liệu và feedback riêng.
  [page.tsx:829](../../../src/app/dashboard/education/reports/page.tsx#L829)

- Nút tải chi tiết giữ cùng giới hạn, không tạo file giả.
  [page.tsx:965](../../../src/app/dashboard/education/reports/page.tsx#L965)

**Kiểm chứng**

- Kiểm thử9output, trạng thái lặp, đổi kỳ và tab.
  [page.test.tsx:29](../../../src/app/dashboard/education/reports/__tests__/page.test.tsx#L29)

- Xác minh feedback trước cuộn đo và lưu proof có giới hạn.
  [browser-component.cjs:113](browser-component.cjs#L113)
