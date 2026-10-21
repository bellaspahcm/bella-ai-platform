---
title: 'Executive Copilot Preschool theo theme preset'
type: 'bugfix'
created: '2026-10-21'
status: 'in-review'
route: 'one-shot'
baseline_commit: 'ecfaf23ab06d043c5f2caec38ea67856705b6c26'
---

# Executive Copilot Preschool theo theme preset

## Intent

**Problem:** Executive Copilot trên trang tổng quan dùng màu tím/vàng cố định; CSS toàn cục ghi đè màu tiêu đề và một số trạng thái chữ.

**Approach:** `UI_ONLY`: dùng primary/foreground/hover và education-brand-ink hiện hữu; giữ màu trạng thái và độ tương phản sáng/tối. Chỉ đổi className trong khối Copilot; dữ liệu, handler, trạng thái, API, quyền và DB không đổi. Không cần migration hay khả năng Kernel mới.

Branch mới được tách từ HEAD có Executive Copilot trong worktree riêng và cập nhật lên main đã squash merge các commit nền. Giữ nguyên checkout audit đang có thay đổi. Người dùng đã yêu cầu commit/push/PR; kiểm tra Healthcare rộng có lỗi môi trường nên chưa có kết luận merge readiness.

## Suggested Review Order

- Nền, tiêu đề, biểu tượng và tab theo preset của tenant.
  [page.tsx:927](../src/app/dashboard/education/page.tsx#L927)

- Màu trạng thái dùng token, tránh CSS toàn cục ghi đè.
  [page.tsx:1000](../src/app/dashboard/education/page.tsx#L1000)

- Ô nhập, placeholder, nút Gửi đang khóa và hover đủ tương phản.
  [page.tsx:1229](../src/app/dashboard/education/page.tsx#L1229)

- Bằng chứng, lệnh tái chạy và giới hạn của kiểm tra giao diện.
  [README.md](../docs/audits/preschool-executive-copilot-theme/README.md)
