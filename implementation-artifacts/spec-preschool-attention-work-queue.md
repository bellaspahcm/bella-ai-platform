---
title: 'Xử lý cảnh báo Preschool bằng dữ liệu thật'
type: feature
created: '2026-10-19'
status: done
baseline_commit: '3ec04c91fd5bf2c67d523e3a65ee559ba978c1e3'
context:
  - docs/governance/BELLA_AI_CODING_CONSTITUTION.md
  - docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md
  - docs/audits/preschool-attention-work-queue/ARCHITECTURE_GATE_RESULT.md
---

<frozen-after-approval reason="User authorized actual alert workflows and explicitly chose decision-only leave review">

## Intent

**Problem:** Tổng quan có bản ghi DB thật nhưng các nút nghỉ học, sự cố và yêu cầu phụ huynh dẫn sang nội dung khác hoặc mẫu.
**Approach:** Một workspace có ba nhóm độc lập, đọc đúng bản ghi và lưu kết quả xử lý; giữ liên kết Công nợ đã sửa.

## Boundaries & Constraints

**Always:** tenant/actor từ phiên đã xác thực; admin hiện hành, đúng Product; giữ nội dung gốc; chỉ báo lưu sau server thành công; tái đọc dữ liệu; từ chối thao tác trùng/cross-tenant; preserve legacy notes. Leave approval/rejection records a decision only, as explicitly selected by the user.
**Ask First:** thay đổi điểm danh/học phí, quyền của vai trò khác, xác nhận phụ huynh hay schema/Kernel.
**Never:** approve/close existing user records for verification; send messages; administer medication; create pickup/club/financial effects; fabricate ack; fake metrics; commit/push without new request.

## I/O & Edge-Case Matrix

| Tình huống | Kết quả |
|---|---|
| OPEN absence, approve/decline | RESOLVED + decision/note/original text + authenticated operator/time |
| OPEN parent request, resolve | RESOLVED + original text + operator outcome; no external side effect |
| OPEN incident, allowed close | Existing P4 contract closes; missing stored escalation ack blocks |
| Duplicate/foreign/wrong kind | Reject, no extra write, draft retained |
| Read/write failure | Distinct error; no success/seed substitute; retry possible |

</frozen-after-approval>

## Code Map

- `src/products/bella-education/parent-engagement/` — P6 request read/review persistence and versioned receipt; preserve legacy services.
- `src/products/bella-education/care-wellbeing/incidents/incident-safety.contract.ts` and service — reuse closure invariant.
- `src/app/api/education/work-queue/route.ts` — active admin/current tenant/product, validated scoped reads/commands, no identity payload.
- `src/app/api/education/work-queue/persistence.ts` — typed Product-port adapter for tenant-scoped storage; no new direct Product-layer DB query sites.
- `src/app/dashboard/education/work-queue/page.tsx` — deep-linked three groups, real record details, decision/notes, loading/error/empty/history and pagination.
- `src/app/dashboard/education/page.tsx` — matching alert URLs, precise labels, unavailable counts; preserve pending Finance debt URL.
- `src/products/bella-education/analytics/repositories/preschool-analytics.repository.ts` — command-center read failures must not become demo counts.
- Colocated focused tests — actual command/tenant/status guards, UI failure retention and navigation.

## Tasks & Acceptance

- [x] Product DTO/notes receipt + tenant-scoped queue service and conditional resolution.
- [x] API authenticates before DB, checks product/admin, rejects identity injection/invalid commands.
- [x] UI lists actual records with labels, preserves original text and drafts on failure, supports approval/rejection/closure/history.
- [x] Overview links match queue groups; no static attention fallback/realtime claim.
- [x] Focused tests/lint/type diagnostics, required guards, independent review and source synchronization.

Given an authenticated active Preschool admin and OPEN absence, when approving or declining, then a persisted reviewed record contains decision/operator/time/note/original content and attendance/finance stay unchanged.
Given an escalation-required incident without persisted acknowledgement, when closing, then reject without a safety mutation.
Given wrong tenant/product/role, duplicate decision or failed persistence, when submitting, then no successful result or unrelated mutation is produced.
Given an attention deep link, when loading its workspace, then actual corresponding records are shown and successful actions remain visible in history after reload.

## Design Notes

Existing Product tables suffice: no migration. Review receipt is versioned Product notes data, not a new shared state. Server-side conditional OPEN update prevents reviewer overwrites. Health uses its existing contract; parent notes do not claim actual medication/pickup/club execution. Current user authorization covers the unified outcome flow and the explicit decision-only choice; no second scope approval is needed.

## Verification

Focused unit/API/component suites use synthetic records and do not mutate existing tenant data. Scoped lint/typecheck/Architecture Guard and required Healthcare verification; actual output must distinguish baseline failures and unexecuted DB/browser writes. Existing read-only DB evidence stays in primary `.cache/preschool-enrollment-toolbar/attention-db-reconciliation-2026-10-19.json`.

## Review resolutions

Three introduced issues classified as patches within the approved invariants: bind a decision to the displayed row revision, preserve ambiguity after a possibly committed POST, and fail unavailable instead of returning an RLS-hidden empty queue when the server storage configuration is absent. Existing auth/tenant checks, P4 acknowledgement, original request text and decision-only behavior must remain. No business-owner loopback is required.

Final metadata correction: P4 parent-notification and close updates advance `updated_at`, making the existing Product writers participate in the observed-revision guard. Added regression proves an earlier displayed revision is rejected after notification. No signature or domain-outcome change for default callers.

## Verification result

5 focused suites / 80 tests PASS, scoped ESLint PASS, 18 TypeScript roots with zero affected or dependency diagnostics. Source scope/JSX/no-any checks PASS; no Platform/frozen files changed. Education architecture still reports 222 direct-query/RPC sites, exactly 222 on this branch's baseline; `education:verify` stops at the existing architecture failure (3 tests PASS, 1 FAIL). Required `healthcare:verify`: guard PASS, architecture 9 PASS, medical conformance 7 PASS, Kernel run 374 PASS / 151 FAIL / 5 skipped because the isolated worktree has no reachable integration DB. No full Education/Healthcare PASS is claimed and no production credentials were injected into these tests.

Read-only execution of actual new Product service + storage adapters against runtime DB: 2 absence requests, 2 health incidents, 4 parent requests; all 8 child names and all 6 request guardian names resolved; totals equal runtime Overview. DB methods restricted to GET/HEAD; no decisions/closures executed on existing records. Authless localhost HTTP verifies queue API401 and dashboard307 to login; analytics200 serves real counts. These checks do not establish authenticated-browser, RLS or live mutation proof. Three independent reviewers completed; all actionable introduced findings patched, acceptance and edge final reviews have no findings. All 18 runtime/test files synchronized to active localhost checkout after pre-task source-hash preservation checks. No commit/push.

## Suggested Review Order

Delivery: user explicitly authorized `commit push` after the completed local verification. Commit only the 18 reviewed source/test files, this spec, the architecture gate and verification report, plus the existing Overview source-audit work record. Local cache/evidence scripts, credentials and unrelated primary-checkout changes are excluded. Branch `codex/preschool-attention-work-queue` continues the previously pushed UI commit `3ec04c91f`; no PR creation or merge is requested.

- Cửa vào xác thực, tenant và Product trước khi đọc/ghi.
  [route.ts:49](../src/app/api/education/work-queue/route.ts#L49)
- Giữ nội dung gốc và chỉ lưu quyết định nghỉ học.
  [request-review.service.ts:8](../src/products/bella-education/parent-engagement/services/request-review.service.ts#L8)
- Chặn duyệt phiên bản cũ và ghi đè kết quả.
  [request-review.persistence.ts:40](../src/app/api/education/work-queue/request-review.persistence.ts#L40)
- Sự cố dùng hợp đồng an toàn sẵn có, không tự tạo xác nhận.
  [work-queue.service.ts:61](../src/products/bella-education/work-queue/work-queue.service.ts#L61)
- Màn hình ba nhóm, lịch sử và giữ ghi chú khi kết quả chưa rõ.
  [page.tsx:36](../src/app/dashboard/education/work-queue/page.tsx#L36)
- Bằng chứng và giới hạn kiểm tra.
  [VERIFICATION.md:1](../docs/audits/preschool-attention-work-queue/VERIFICATION.md#L1)
