# Review độc lập của candidate dependency

Reviewer: subagent `security_review`, chỉ đọc; không sửa file, không network/DB/mutation.

Phạm vi: manifest/lockfile, dependency tree, reconciliation script, catalog/ACL/anon evidence, audit trước–sau, regression/build execution và results. Review không chứng nhận an toàn toàn hệ thống hoặc Go-Live.

Candidate đã review:

- package.json SHA-256: `e9e36d19aa9b6707051e854f8a381881aadbbfe9ef9765bb9aed71de7061f677`.
- package-lock.json SHA-256: `2cae548c90b14606d78a5ff182e8a6d7841ffe0a9230a59a2b1958e82234c98e`.

Kết quả: không phát hiện regression runtime trong diff dependency. Các thay đổi transitive thuộc đồ thị Next/Sentry. Review xác nhận 20 suites / 256 tests và build exit 0; build bỏ qua type validation. Audit production vẫn exit 1, gate policy exit 0 theo allowlist hiện hữu. Hai Zod 3 của dev tooling vẫn còn advisory.

Finding P2: không trình bày version migration đã pad 8→14 chữ số như migration ID nguyên bản. Primary: 150 file / 143 ID nguyên bản chỉ ở Git, so với 143 file / 141 version chuẩn hóa. E2E: 430 file / 421 ID nguyên bản, so với 419 version chuẩn hóa.

Xử lý của Lead: đã sửa console của reconciliation script để ưu tiên raw IDs, giữ riêng các số chuẩn hóa, ghi rõ quy ước và giữ cả hai danh sách trong JSON. Báo cáo cuối dùng số nguyên bản. Việc này không thay đổi candidate dependency đã review.

Rủi ro chưa đóng: anon thấy 4 dòng / 2 tenant trong history primary; bản vá dependency không xử lý ACL. Containment cần quyền thực thi riêng. Kiểm tra mẫu secret của reviewer không thấy token/JWT/private key/DB URL có mật khẩu; đây không phải chứng nhận tuyệt đối.

## Review bổ sung của proposal

Reviewer xác nhận P2 đã được xử lý. Không thấy lỗi tĩnh chặn `PROPOSED_CONTAINMENT.sql`: transaction/DO/REVOKE hợp lý, đủ 5 bảng, fingerprint khớp snapshot preflight, kiểm tra quyền hiệu lực sau revoke và giữ quyền service_role. Không đổi schema/RLS/Kernel.

Giới hạn review: chưa parse hoặc chạy SQL trên PostgreSQL, chưa rehearsal, chưa refresh live preflight. Consumer authenticated chưa xác minh và truy cập gián tiếp RPC/SECURITY DEFINER còn ngoài phạm vi containment này. Chỉ thực thi sau quyền primary ACL rõ ràng và kiểm tra các điều kiện đã nêu.

- PROPOSED_CONTAINMENT.sql SHA-256: `e6dff8e3432f592f0c7a824e56c38006fd8038fc587954432a4c6620fc081afe`.
- reconcile-catalogs.cjs SHA-256: `c66feff03edaf56ee5cad518a15231b4c11bb1ce719fea379822c19c14dc02c8`.
- `node --check` reconciliation script: exit 0.

## Follow-up after refreshed production preflight

The review above applied only to the table-only draft and explicitly did not verify live consumers or indirect RPC paths. The refreshed read-only catalog then found active invoker write triggers on all three Auto history tables and browser-executable history RPCs. The reviewed table-only draft is therefore superseded and must not be executed; it is preserved as `PRELIMINARY_CONTAINMENT_SUPERSEDED.sql`. `PROPOSED_CONTAINMENT.sql` is now a non-executable decision note. This follow-up changes no source code or database state and does not claim independent review of a future containment plan.
