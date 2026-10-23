---
title: 'AutoMove reuse client Platform cho metadata ảnh Trade-in'
type: 'bugfix'
created: '2026-10-23'
status: 'in-review'
baseline_commit: 'bb7007e7632c3bf7d88f760fc8239a0720d2d327'
input_candidate_source_sha256: 'a59a7e729b849508f3d059c97913cb2b783e81d064e4291b29d85adad9a343d7'
context:
  - '{project-root}/docs/governance/BELLA_AI_CODING_CONSTITUTION.md'
  - '{project-root}/docs/architecture/automove-business-chain/ARCHITECTURE_GATE_RESULT.md'
---

<frozen-after-approval reason="user delegated local fixes and explicitly prioritizes reuse of existing Platform/OS capabilities">

## Intent

**Problem:** Trang Trade-in dùng browser client có session cho Auth/Storage, nhưng metadata service tạo client riêng qua read-replica. Source không chứng minh hai đường gọi dùng cùng định danh.

**Approach:** Reuse nguyên client chuẩn `@/lib/supabase-client` trong consumer TradeInPhotoService. Giữ API/payload/schema/business rules hiện hữu; chỉ sửa nguồn client. Không tạo auth/storage/service framework mới.

## Boundaries & Constraints

**Always:** Product consumer gọi capability Platform hiện hữu. Giữ tenant filters, bảng metadata, category rules và lỗi đọc/ghi; mọi method dùng cùng factory chuẩn. Phân biệt session propagation với DB permission/persistence proof. Tiếp tục cùng goal/worktree; giữ diff8file đã seal làm input, không reset/rewrite phần đó.

**Ask First:** Giữ HELD phần cần sửa public contract, shared Auth, ACL/RLS/schema, Product identity, business policy hay Production/release; không suy ra authority từ unit PASS.

**Never:** Không sửa `src/lib`, Platform/Core/OS, Kernel, migrations, permission/Storage policy, guards hoặc runner. Không dùng service key/fallback khi bị denied. Không đổi signatures hay mặc định pricing/SLA. Không stage/commit/push/merge/deploy hoặc gọi DB/Production.

## I/O & Edge-Case Matrix

| Tình huống | Kết quả cần chứng minh |
| --- | --- |
| Metadata read/write sau Auth | Gọi cùng client/session của browser, giữ payload/filter |
| Session thay đổi | Request tiếp theo dùng session hiện tại, không cache token cũ tại Product |
| DB từ chối | Error giữ nguyên; không gọi privileged client hoặc báo persistence thành công |
| Category/completion | Tính từ kết quả đọc hiện hữu; không đổi semantic ảnh bắt buộc |

</frozen-after-approval>

## Code Map

- src/lib/supabase-client.ts: browser singleton chuẩn, chỉ đọc.
- src/lib/database/read-replica.ts: client cũ không nhận caller session, chỉ đọc.
- src/modules/bella-auto/services/TradeInPhotoService.ts: consumer cần sửa.
- src/modules/bella-auto/services/__tests__/TradeInPhotoServiceClient.test.ts: kiểm thử session boundary.
- src/app/dashboard/bella-auto/trade-in/page.tsx: caller runtime duy nhất, giữ source.

## Tasks & Acceptance

**Execution:**
- [x] Reuse factory Platform trong8 nơi lấy client, không đổi service contract.
- [x] Kiểm thử metadata requests, session đổi, denial và retained UI regression.
- [ ] Lint/typecheck scoped, diff/architecture check và review độc lập.

**Acceptance Criteria:**
- Given trang và service cùng runtime browser, when service đọc/ghi metadata, then dùng factory chuẩn, không read-replica/service-role fallback.
- Given session actor đổi, when request tiếp theo chạy, then authorization đi theo client hiện tại.
- Given DB trả denial, when consumer nhận lỗi, then lỗi được truyền và không tự tăng quyền.
- Given local batch xong, when báo cáo, then chỉ đóng source divergence; RLS/Storage/Real DB và Go-Live còn NOT_PROVEN.

## Business Test Contract

Constitution Truth/ownership/reuse và SOP Rule10 là invariant: caller identity không được thay bằng privileged fixture; success phải theo kết quả persistence. Test dùng explicit synthetic Auth/HTTP boundary, không định nghĩa business price/SLA hay chứng minh live policy. Đúng actor và tenant trên request là session-boundary proof; DB phải tự enforce own/cross-tenant/role và parent binding qua E2E riêng.

## Verification

Jest đúng suite mới + UI truthfulness17cases; ESLint hai file; strict/noEmit scoped roots/dependencies; Architecture Guard; diff check. Network stub chỉ chứng minh header/request/error behavior, không gọi DB. Canonical RC còn cần clean committed candidate và E2E environment; không bypass preconditions.

### Acceptance evidence limits — 2026-10-23

- Client reuse/session: source dùng factory chuẩn tại cả8 nơi. Actual SDK trên synthetic Auth/PostgREST transport kiểm tra8 methods và thay đổi actor. Factory Platform được mock tại module boundary; đây không phải browser singleton integration hoặc live identity/RLS proof.
- Denial:7 methods reject khi mọi request đều nhận403. `reorderPhotos` không nằm trong denial matrix: source cũ không kiểm tra returned error. Error propagation của method này = NOT_PROVEN, không được suy từ suite PASS.
- `setPrimaryPhoto` bỏ qua error ở lần unset đầu; `deletePhoto` bỏ qua error của initial read. Global-denial cases không chứng minh first-step failure followed by success, atomicity, affected rows hoặc Storage cleanup. Các hành vi cũ này không được sửa trong batch chỉ đổi nguồn client; ghi deferred-work.md.
- General denial-propagation AC và frozen I/O criterion chỉ có PARTIAL evidence; không coi tất cả AC đã đạt và không sửa frozen intent để làm báo cáo PASS.
- Review: blind static reviewer hoàn tất với1 P2 về độ rộng claim denial. Ghi rõ giới hạn ở trên theo phương án reviewer đề xuất. Edge reviewer có progress message, nhưng edge/acceptance final đều errored bởi agent usage limit; không có final verdict hợp lệ. Status giữ `in-review`; independent review completion = HELD. Ba prompt handoff được lưu cùng spec; không chạy lại agent khi dependency quota chưa đổi.
- Local source/unit verification không đóng Product UI→API→service→DB, current candidate RC hoặc Go-Live.

## Spec Change Log

- 2026-10-23 — Blind P2 evidence-completeness finding: append explicit NOT_PROVEN/PARTIAL limits for reorder denial and partial failures. KEEP factory-only runtime diff, signatures/payloads/filters/category rules, prior UI candidate and frozen intent unchanged. Avoid known-bad claim that passing synthetic denial cases establish all service error paths. This is a report correction; the broader acceptance criterion remains unmet rather than being silently narrowed.

## Design Notes

Independent owner review phân loại EXISTING_CAPABILITY_REUSE, trong Product consumer authority. Không đổi shared helper hoặc public contract. Browser client là singleton được trang dùng; service không giữ token riêng.
