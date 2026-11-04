# PR #479 — CI, Preview và staging tùy nhu cầu

Ngày 2026-11-02. Chủ dự án chỉ đạo dùng CI + Vercel Preview cho từng PR; staging riêng chỉ phục vụ nhu cầu tích hợp/nghiệp vụ được xác định. Không thay credential chỉ để làm job xanh.

## Bằng chứng và giới hạn

- Commit `eaada4877`: [Test Decision Engine PASS, gồm build và tests](https://github.com/bellaspahcm/bella-ai-platform/actions/runs/41403501590/job/125140267754). Thay đổi heap đã vượt lỗi OOM của run trước.
- Preview cùng commit: `dpl_BVBNjxmWqRo1qcdcC9kn5UHW4cwA`, target `preview`, trạng thái Ready theo Vercel CLI; [URL bất biến](https://bella-spa-mq1y37ly4-bella-spa-s-projects.vercel.app). GET /login trả HTTP 200. Đây là môi trường có thể dùng để kiểm tra UI, chưa phải bằng chứng browser/business acceptance.
- [Staging cũ vẫn FAIL 404](https://github.com/bellaspahcm/bella-ai-platform/actions/runs/41403501590). [Chẩn đoán chỉ đọc](https://github.com/bellaspahcm/bella-ai-platform/actions/runs/41404200653): token có mặt, user 404, team 403, project 200; org khớp, project thuộc org nhưng trùng Production project ID; thiếu staging project variable. Không kết luận token vô hiệu hoặc thay token.
- Job staging cũ dùng cùng project và mặc định deploy preview; không cung cấp môi trường cô lập riêng. Lệnh `npm run test:smoke` không có trong package.json. Chưa có bằng chứng kiểm thử staging từ job này; không ghi nhận bước bị loại bỏ là PASS.
- F09 Weekly Menu transaction/real Auth/RLS và acceptance nghiệp vụ của PR vẫn chưa được chứng minh. Tạo thêm deployment không tự giải quyết khoảng trống đó. Đề xuất contract và quyết định kiến trúc vẫn ở WEEKLY_MENU_CONTRACT_PROPOSAL.md.

## Thay đổi workflow được phép

Loại job deploy-staging tự động của decision-engine-deploy.yml. Giữ nguyên job test (build, unit, integration, security audit, artifacts) và toàn bộ job Production. Vercel GitHub integration tiếp tục cung cấp Preview. Job chẩn đoán credential chỉ chạy workflow_dispatch, không còn tự tạo lỗi PR khi push. deploy-staging.yml và quy trình isolated staging hiện có không thay đổi.

Preview đủ để thay deployment trùng cho mục đích cung cấp URL kiểm tra từng PR. Việc bỏ job trùng không phải kết luận Preview đã vượt kiểm thử nghiệp vụ, PR được phép merge hoặc đủ điều kiện Production. Khi một flow thực sự cần môi trường tích hợp riêng, xác định target/data/Auth và authority trước khi dùng workflow staging chuyên biệt.
