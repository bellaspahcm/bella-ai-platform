---
title: 'G1 — Guardian read-only'
type: 'feature'
created: '2026-10-24'
status: 'in-review'
baseline_commit: 'b3107b2c495b30307fc6f8503a744ae60d055fa3'
context:
  - 'docs/governance/BELLA_AI_CODING_CONSTITUTION.md'
  - 'docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md'
---

<frozen-after-approval reason="ý định do Owner xác nhận">

## Intent

Đọc guardian theo một Student đã được Auth/Registry cho phép, nối vào Student 360. Giữ profile hiện hữu và PATCH 405.

## Boundaries & Constraints

**Luôn:** caller-scoped client; admin hiện hành; tenant/branch/Student qua Registry; quan hệ guardian→child `guardian_of`/`parent_of` còn hiệu lực ngày Việt Nam; tên/điện thoại tối thiểu; pickup trạng thái riêng.

**Dừng:** cần grant/policy/RPC mới, quyền contact rộng hơn, nguồn dữ liệu chưa đủ chứng minh hoặc thay đổi frozen layer.

**Cấm:** service-role; Product đọc trực tiếp Party tables; chọn guardian đầu tiên; suy quyền đón/liên hệ khẩn cấp từ gia đình; ghi identity/quan hệ/pickup; thay Finance/Health hoặc Production.

## I/O & Edge-Case Matrix

| Trường hợp | Kết quả |
| --- | --- |
| Nhiều guardian hiện hành | Trả đủ, không chọn primary |
| Hết hạn/thu hồi | Không nhận là quan hệ/quyền hiện hành |
| Thiếu phone | Chưa ghi nhận; không lấy identifier khác thay thế |
| Emergency contact chưa có contract | Chưa được xác minh, không suy thành false/true |
| Sai tenant/branch/Student | Từ chối trước đọc contact |
| Provider/RLS lỗi hoặc completeness chưa chứng minh | Unavailable; không trả danh sách rỗng như thành công |

</frozen-after-approval>

## Code Map

- `docs/audits/preschool-full-audit-20261020/g1-guardian-read-e2e/` — SQL riêng cho E2E, rehearsal/recovery và evidence; không phải migration Production.
- `src/products/bella-education/services/preschool-student-guardian-read.service.ts` — gọi đúng RPC, kiểm tra response fail-closed.
- `src/app/api/education/enrollments/[id]/guardians/route.ts` — Real Auth, admin canonical, GET-only, `private, no-store`.
- `src/app/dashboard/education/enrollments/[id]/StudentGuardians.tsx` và `page.tsx` — section độc lập; lỗi Guardian không biến thành dữ liệu rỗng hoặc làm mất profile.
- Focused tests cạnh từng service/route/component; Browser E2E chỉ sau khi E2E capability được apply và có phiên Auth hợp lệ.

## Tasks & Acceptance

**Execution:**
- [x] Owner phê duyệt amendment nhạy cảm: tạo duy nhất `preschool_g1_guardians_read(uuid)` trên Supabase E2E `bmnbqbcdbuklhopfbopv`, `STABLE SECURITY DEFINER`, `search_path=''`, EXECUTE chỉ `authenticated`; giữ nguyên table ACL/RLS, schema/default privileges và Production.
- [x] RPC tự lấy `auth.uid()`, xác minh active Preschool admin/tenant, branch access và Student có active/pending enrollment trong lớp active thuộc branch được cấp quyền; caller không truyền actor/tenant/date/guardian.
- [x] RPC chỉ đọc relationship hiện hành theo ngày Việt Nam, Party person chưa xóa, phone loại `preschool_guardian_phone`, và pickup status riêng; projection có allowlist, giới hạn 50, completeness rõ ràng, không `SELECT *`/dynamic SQL.
- [x] Rehearsal rollback, security review và fingerprint trước/sau; chỉ apply E2E khi PASS. Recovery chỉ drop đúng signature bằng `RESTRICT` sau dependency check.
- [x] Nối typed service → route → UI; giữ Student 360 hiện tại và `PATCH 405`.
- [ ] Chạy focused tests, architecture checks, Auth positive/negative, Browser reload, independent DB readback và zero-write check.

**Acceptance Criteria:**
- Given Preschool admin có quyền với lớp của Student, when mở Student 360, then thấy đầy đủ guardian hiện hành, phone tối thiểu và pickup status tách biệt, reload vẫn khớp nguồn canonical.
- Given sai role/tenant/branch/Student, relation hết hạn, phone mâu thuẫn hoặc provider lỗi, when đọc, then không lộ contact, không trả partial/empty giả và không có side effect.
- Given direct authenticated table access trước/sau, then các denial hiện hữu vẫn giữ nguyên.

## Verification

- Focused Jest cho resolver, service, route và component; TypeScript, ESLint, `git diff --check`.
- SQL rehearsal/rollback và catalog ACL/RLS/function fingerprint trên E2E.
- Real Auth RPC + Browser → API → RPC → canonical source; wrong-role/cross-tenant/cross-branch denial và reload.
- Giữ nguyên `education:verify` lịch sử; nếu chạy lại, báo raw PASS/FAIL theo candidate, không sửa guard/fixture.

## Spec Change Log

- 2026-10-24: Thu hẹp proposal thành một RPC Product-specific trên E2E; loại bỏ ba Platform Party artifact chung vì capability cần Preschool branch/Student authorization.

## Current Execution Result — 2026-10-25

SOURCE_CHECKS = PASS_BOUNDED: focused 4 suites/71 tests, full TypeScript diagnostics0, focused lint0, architecture 1 suite/4 tests0, diff-check0.
STRICT_SQL_REHEARSAL = PASS_BOUNDED on approved prerequisite/fixture transaction; exact hash and receipt in RESULT.md.
G1_SOURCE_AND_E2E_SQL = PASS_BOUNDED; retained apply/readback and exact rollback recovery complete.
OWNER_MANUAL_BROWSER_RELOAD = CONFIRMED. Independent positive real Auth/Browser execution remains NOT_PROVEN because the tool is disabled.

Owner amendment explicitly allows the existing Registry prerequisite plus one synthetic branch-denial fixture/cleanup E2E. The original stop on new RPC/dependencies is overridden only within those exact approvals. No shared ACL/RLS, Auth account creation/reset, Production or commit/push authority.

Final source keeps generated DB types unchanged and no double assertion. API binds the exact getUser(token)-verified caller token to the approved RPC HTTP POST. Parent route and child Student state are both identity-bound; snapshot date, timeout, UUID and negative paths have focused regression tests.

SQL artifacts enforce exact E2E cluster/dependency/function identity, postgres owner and authenticated-only EXECUTE with no overload. Strict rehearsal checks fixed valid synthetic branch denial, wrong-role/valid foreign-tenant/unknown Student, canonical Guardian projection, Registry positive/denial, direct-table access preservation, row-dependency zero-write and exact atomic fixture cleanup; whole transaction rolls back.

The earlier missing-branch context failures are historical and retained, not converted to PASS. The latest approved fixture execution has native0. Real Auth expiry/contact/provider-failure runtime rows and Browser reload remain NOT_PROVEN. See RESULT.md for exact receipts and remaining limitations.

## Spec Change Log — approved continuation

2026-10-25: Owner approved existing Registry prerequisite + one branch-denial fixture E2E with cleanup, user-controlled Auth session, no account creation/reset or shared ACL/RLS/Production. Implemented bounded test prerequisites; no further business scope.

## Review Repairs

Stale PII at parent/child transitions; Product RPC/type escapes; Student–Party uniqueness; target/fingerprint/owner/hash/config; UUID/snapshot/timeout; strict isolated negative selection; canonical readback; atomic cleanup with all FK ownership guards. All source changes remain uncommitted. Final SQL review PASS_BOUNDED_SQL_SAFE_TO_APPLY_E2E; exact retained apply and postconditions native0. Expanded event/trigger fingerprint9e2a... preserved; no fixture residue. Owner manually confirmed Guardian display/reload; independent Browser automation/positive Auth traces remain unproven.


## Suggested Review Order

- Authenticated request and caller binding
  [route.ts:25](../../../../src/app/api/education/enrollments/[id]/guardians/route.ts#L25)

- Exact Student and complete projection validation
  [preschool-student-guardian-read.service.ts:86](../../../../src/products/bella-education/services/preschool-student-guardian-read.service.ts#L86)

- E2E authority and atomic fixture disposal
  [RETAINED_APPLY_E2E.sql:6](../../../audits/preschool-full-audit-20261020/g1-guardian-read-e2e/RETAINED_APPLY_E2E.sql#L6)

- Canonical SQL read contract
  [APPLY_E2E.sql:143](../../../audits/preschool-full-audit-20261020/g1-guardian-read-e2e/APPLY_E2E.sql#L143)

- Parent route ownership prevents stale contact
  [page.tsx:208](../../../../src/app/dashboard/education/enrollments/[id]/page.tsx#L208)

- Guardian identity and explicit state
  [StudentGuardians.tsx:90](../../../../src/app/dashboard/education/enrollments/[id]/StudentGuardians.tsx#L90)

- Exact recovery and readback evidence
  [RESULT.md:66](../../../audits/preschool-full-audit-20261020/g1-guardian-read-e2e/RESULT.md#L66)

- Pre-passive-effect navigation regression
  [page.test.tsx:123](../../../../src/app/dashboard/education/enrollments/[id]/__tests__/page.test.tsx#L123)

