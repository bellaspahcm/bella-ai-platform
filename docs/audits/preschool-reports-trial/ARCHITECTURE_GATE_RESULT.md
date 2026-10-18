# Báo cáo — phản hồi tải xuống trung thực

Result: **PASS cho sửa UI độc lập**; Preschool Product/Data/Safety gate giữ BLOCKED.

1. Process/Truth: FEATURE_DB_COVERAGE.md tại audit base0bc9bba ghi export không download, báo cáo dùng mảng mẫu. Source reports/page.tsx tại91468 có nút export/download không handler. Owner cho tiếp tục SAFE_TO_FIX sau PR362; không giả lập thành công.
2. Manifest/capability: unchanged. Chỉ presentation màn /dashboard/education/reports; không tạo report/export capability.
3. Ownership: UI sở hữu label và feedback; Product/Finance/Education giữ dữ liệu và tính toán. Không thiết kế metric/WHO/AI hoặc export contract mới.
4. Dependency: UI local action → unavailable feedback. Không API/DB/contract mới; các link/tab hiện hữu giữ nguyên. Hai endpoint503 kế thừa91468, không đổi.
5. Change Authority/exact allowlist: src/app/dashboard/education/reports/page.tsx, colocated __tests__/page.test.tsx, spec/gate/proof/harness trong thư mục này. Không sửa src khác, package/config/theme/shared, Kernel, Course allowlist8, migration/RLS/Auth. Lead sở hữu spec/gate/evidence/delivery, builder độc quyền UI/test/proof; reviewers chỉ đọc.
6. UI reconciliation: header export và quick/detail downloads phải giải thích chưa khả dụng, không báo tiến trình hoặc thành công giả. Feedback cạnh đúng thao tác, không ở ngoài viewport khi vừa click. Số liệu/KPI/biểu đồ/AI/tài liệu là minh họa; đổi kỳ không được khiến người dùng tưởng đã tải/phân tích dữ liệu thật. Không tạo file mẫu để giả capability.
7. Migration: NONE. Không E01/C10, baseline, Auth/DB/remote probe, fixture, seed hoặc dữ liệu trẻ thật. Không merge/deploy.
8. Eleven gates: G1 exact source scope/type/lint; G2 no contract changes; G3/G4 identity/tenant giữ NOT_PROVEN; G5 no schema; G6 no persistence/event claim; G7-G9 no clinical/consent/history semantics change; G10 commit/hash/proof; G11 focused new UI tests and4 synthetic browser cases/light-dark/mobile, targeted changed-text contrast. Không rerun test cũ hoặc suy diễn DB/Go-Live proof.

Business Test Contract: Given unavailable report output, click export/download shows persistent truthful non-success status identifying the attempted output, near that control; repeated attempts, period/tab changes never create a fake file. Given sample metrics, every report view makes their illustrative origin clear. Negative proof stays within synthetic UI, not security acceptance.
