---
title: 'AutoMove: hiển thị trung thực các chức năng chưa có dữ liệu vận hành'
type: 'bugfix'
created: '2026-10-23'
status: 'done'
baseline_commit: 'bb7007e7632c3bf7d88f760fc8239a0720d2d327'
context:
  - '{project-root}/docs/governance/BELLA_AI_CODING_CONSTITUTION.md'
  - '{project-root}/docs/architecture/automove-business-chain/ARCHITECTURE_GATE_RESULT.md'
---

<frozen-after-approval reason="owner delegated local implementation after concrete findings">

## Intent

**Problem:** Leads và Journeys báo thành công dù chỉ chạy timer/state; Workshop và Experience hiển thị số liệu mẫu như dữ liệu vận hành. Trade-in tạo hồ sơ chỉ hiện thông báo chưa triển khai.

**Approach:** Giữ chức năng nhìn thấy, mô tả rõ chưa sẵn sàng, ngăn thao tác giả và không render dữ liệu mẫu. Bảo toàn các luồng đọc/ghi thật hiện có; đây là containment cần thiết cho MVP, chưa phải triển khai các capability bị thiếu.

## Boundaries & Constraints

**Always:** Tái sử dụng UI hiện hữu; phân biệt chưa kết nối với dữ liệu rỗng và số0. Giữ sales-chain, customer preferences, vehicle intake và contract hiện hành. Source đã chứng minh các handler giả. User đã giao chọn batch MVP và ngày2026-10-23 cấp quyền xử lý sau báo cáo cụ thể; dùng alternative local workflow theo Factory Intake:111, không gọi là native Factory.

**Ask First:** Khi cần sửa business semantics, public contract, identity/quyền, schema, protection hoặc Production/release, giữ phần phụ thuộc ở HELD và tiếp tục độc lập; không suy ra quyền từ nhãn hoàn thành.

**Never:** Không wire lead/SLA mutation khi semantic chưa thống nhất; không sửa guard/admission, migrations, auth/RLS, Kernel, ProductRegistry; không thay API; không commit/push/merge/deploy hay Production business mutation. Không xóa/ẩn chức năng để tuyên bố scope hoàn tất.

## I/O & Edge-Case Matrix

| Tình huống | Input/state | Hành vi |
| --- | --- | --- |
| Lead thật chưa gán | Lead từ query hiện hữu | Hiện lead thật, giữ nút phân bổ nhưng disabled và giải thích; không toast thành công/đổi người/status |
| Lead đang tải/lỗi | Query pending/rejected | Phân biệt loading/error; không gán lỗi thành tổng0/empty thành công |
| Chức năng chưa hỗ trợ | Journey/SLA/Experience/technicians | Tab/control vẫn nhìn thấy; không số mẫu, tên mẫu, timeline giả hoặc trạng thái engine active |
| Trade-in chưa có hồ sơ | Danh sách rỗng | Nút tạo vẫn nhìn thấy nhưng disabled, giải thích chưa hỗ trợ; existing upload không đổi |

</frozen-after-approval>

## Code Map

- src/app/dashboard/bella-auto/leads/page.tsx: list thật; fake allocation/leaderboard.
- src/app/dashboard/bella-auto/journeys/page.tsx: dữ liệu và SLA giả toàn màn hình.
- src/app/dashboard/bella-auto/workshop/page.tsx: technicians giả; appointments/orders thật.
- src/components/bella-auto/experience/ExperienceDashboard.tsx: parent và children chứa metrics mẫu.
- src/app/dashboard/bella-auto/trade-in/page.tsx: stub tạo hồ sơ; existing photo flow.
- src/__tests__/automove-ui-truthfulness.test.tsx: behavioral regressions.

## Tasks & Acceptance

**Execution:**
- [x] Sửa5 UI files nêu trên, giữ scope và trạng thái unavailable rõ ràng.
- [x] Thêm test cho cả5 surfaces, phân biệt unsupported/empty/error và hành động giả.
- [x] Chạy relevant Jest, lint, strict scoped typecheck, architecture guard và diff-check.
- [x] Review độc lập và sửa finding thuộc scope.

**Acceptance Criteria:**
- Given chức năng chưa có path vận hành, when mở tab/click control, then không hiển thị dữ liệu/thành công giả và control vẫn được nhận diện rõ.
- Given query lead thật thành công, when mở bảng/tìm/lọc, then giá trị persisted projection vẫn hiển thị; pending/error không bị gọi là0.
- Given workshop appointments/orders hoặc trade-in upload hiện hữu, when dùng chúng, then thay đổi không chạm handlers/contracts đó.
- Given batch hoàn tất, when bàn giao, then phân biệt containment PASS, missing capability NOT_PROVEN và Go-Live HELD.

## Business Test Contract

Nguồn: Constitution Fast Execution:127-130, Business Semantic Gate, MVP UI-to-Database và Operational SOP Rule10. Invariant: UI không phát minh business data hoặc báo thành công khi chưa có persistence. Negative: timer/local state không được tạo success hay operational metric. Tài liệu SLA80% đối lập service75%; allocation guide chọnB đối lập conversion-first chọnA: BUSINESS_SEMANTICS=NOT_PROVEN cho mutation, không viết test tự định nghĩa thuật toán.

## Verification

Jest test mới và customer/HTTP regression; ESLint đúng files; tsc strict/noEmit đúng changed roots/dependencies; Architecture Guard; git diff --check. Browser chỉ khi canonical Non-Production environment sẵn có; không dùng mock/fixture-only PASS thay runtime proof.

## Spec Change Log

- 2026-10-23: Independent review found incomplete Trade-in readiness/selection lifecycle and removed Journey/Experience affordances. Fixed within the existing truthful-state invariant: preserve disabled controls, gate all photo panels on verified current-appraisal reads, cancel stale reads, clear selection-specific previews, lock selection while an upload/refresh is pending, and distinguish saved photos from failed status refresh. Storage/database service calls and business rules remain unchanged. Behavioral suite expanded from11 to17 tests.

## Completion Evidence

Local truthfulness containment COMPLETE at source/unit scope only. New Jest:1 suite/17 tests PASS, zero failed/pending/todo; retained Customer/Management regression:2 suites/14 tests PASS. Strict noEmit scoped typecheck:6 changed roots,511 source/dependency files,0 diagnostics (skipLibCheck inherited); focused ESLint:0 errors,1 pre-existing img warning. Three independent static reviewers closed their findings, new actionable findings0; no independent test rerun is claimed. Review snapshot SHA256:ee6e35a765d185b71059a7f5e498e5cca57904b26d2873fac5f43cbc1374bf50; subsequent spec/gate edits record closure without changing reviewed code.

Evidence directory: D:/Bella-AutoMove-MVP-Evidence/20261023-bb7007e-01a1690f/local-truthfulness. No canonical Non-Production E2E environment is available in this isolated worktree; candidate Browser/API/Real DB proof NOT_PROVEN. Existing main sales-chain RC is baseline-only evidence and does not prove these new UI changes. Full MVP PARTIAL; Go-Live HELD/NOT_PROVEN. No stage/commit/push/merge/deploy or Production mutation.

## Suggested Review Order

**Authority and scope**

- Giới hạn quyền và trạng thái hoàn thành của batch.
  [ARCHITECTURE_GATE_RESULT.md:10](../docs/architecture/automove-business-chain/ARCHITECTURE_GATE_RESULT.md#L10)

**Photo lifecycle**

- Chỉ hiển thị trạng thái ảnh đã đọc cho đúng hồ sơ.
  [page.tsx:136](../src/app/dashboard/bella-auto/trade-in/page.tsx#L136)

- Phân biệt ảnh đã lưu với lỗi tải lại trạng thái.
  [page.tsx:251](../src/app/dashboard/bella-auto/trade-in/page.tsx#L251)

**Unavailable controls**

- Giữ selector nhưng không gán khách hàng hoặc SLA mẫu.
  [page.tsx:89](../src/app/dashboard/bella-auto/journeys/page.tsx#L89)

- Giữ tabs và hành động chưa sẵn sàng nhìn thấy.
  [ExperienceDashboard.tsx:56](../src/components/bella-auto/experience/ExperienceDashboard.tsx#L56)

**Retained real reads**

- Phân biệt lỗi đọc lead với danh sách rỗng.
  [page.tsx:224](../src/app/dashboard/bella-auto/leads/page.tsx#L224)

- Tách staffing chưa sẵn sàng khỏi lịch hẹn và lệnh sửa thật.
  [page.tsx:405](../src/app/dashboard/bella-auto/workshop/page.tsx#L405)

**Regression evidence**

- Kiểm tra availability, lỗi đọc và các race đổi hồ sơ.
  [automove-ui-truthfulness.test.tsx:150](../src/__tests__/automove-ui-truthfulness.test.tsx#L150)
