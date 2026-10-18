---
title: Learning và Communication không báo lưu gửi giả
type: bugfix
created: 2026-10-17
status: done
baseline_commit: 0bc9bba1b888ca121dd4ae56eb9ff7ebb1c9831f
context:
  - docs/governance/BELLA_AI_CODING_CONSTITUTION.md
  - docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md
---
<frozen-after-approval reason="Latest Product-first mission explicitly authorizes safe UI and validation; no false success is an accepted invariant">
## Intent
**Problem:** Audit đã chứng minh Learning save/publish và Communication reply/broadcast/primary actions chỉ thay state/toast, không persist. Thông báo thành công làm người dùng mất nội dung/hiểu sai việc đã gửi.
**Approach:** UI containment trung thực: đánh dấu minh họa và trả thông báo chưa thể lưu/gửi, giữ input/modal/draft. Không tự nối backend, suy diễn recipient/consent hoặc tạo checksum/version giả.
## Boundaries & Constraints
**Always:** no success without persistence; preserve user-entered data on unavailable command; labels distinguish sample display from real records.
**Ask First:** contract/persistence/binding/consent/recipient decisions; Parent RLS/Course authorization; DB schema/load/mutation/remote/deploy.
**Never:** sửa API/Product/domain/Kernel/tenant resolution; thêm storage/timer/fake checksum; tự xác nhận consent; đổi quyền; mở dữ liệu thật.
</frozen-after-approval>
## Code Map
- src/app/dashboard/education/learning/page.tsx: remove success/publish/version local simulation only, retain form/tabs.
- src/app/dashboard/education/communication/page.tsx: reply/broadcast/primary notices, no loss/reset/modal close; label sample UI.
- src/app/dashboard/education/learning/__tests__/page.test.tsx
- src/app/dashboard/education/communication/__tests__/page.test.tsx
## Tasks & Acceptance
- [x] Hai pages hiển thị trạng thái minh họa/chưa lưu thật rõ ràng; không bịa backend.
- [x] Learning save giữ observation; publish không đổi PUBLISHED/checksum; loại bỏ nhánh edit/version mô phỏng bằng timer.
- [x] Communication reply giữ text, broadcast giữ modal/content khi phát hành chưa được hỗ trợ; primary action không claim care/pickup persistence. Đóng rõ ràng xóa notice giữ bản nháp để không báo sai sau khi unmount.
- [x] 13 focused component regressions với context synthetic và các tab thực; không auth/DB claim.
- [x] Education/test-source typecheck, lint, 8 standalone browser cases; 36/36 phép đo text mới đạt contrast >=4.5; source hashes trong verification artifacts.
Given user content, when unsupported save/send/publish is clicked, then clear not-completed feedback and unchanged content/state, no network persistence or success.
Given current display, when viewed, then sample/reference content is explicitly labeled.
## Verification
Offline nextJest without env/project setup; outbound denied; mock only existing tenant-brand lookup. Education + test-source typecheck, targeted lint. No full Next/Auth/DB/Healthcare execution without approved environment.

## Suggested Review Order

- Learning actions preserve draft without simulated publication/checksum.
  [page.tsx:82](../src/app/dashboard/education/learning/page.tsx#L82)
- Communication reports unavailable operation and retains input.
  [page.tsx:549](../src/app/dashboard/education/communication/page.tsx#L549)
- Explicit modal close clears only its stale retention notice.
  [page.tsx:564](../src/app/dashboard/education/communication/page.tsx#L564)
- Regression coverage for save/publish and draft retention.
  [page.test.tsx:1](../src/app/dashboard/education/learning/__tests__/page.test.tsx#L1)
  [page.test.tsx:1](../src/app/dashboard/education/communication/__tests__/page.test.tsx#L1)
- Evidence and review limits.
  [verification.json:1](../docs/audits/preschool-learning-truth/verification.json#L1)

Local UI scope done; real persistence and safety remain independent open gates. No merge/deployment authority from this spec.
