---
title: Preschool Batch2B — đóng bypass Courses và SQL executor
type: bugfix
created: 2026-10-21
status: in-review
baseline_commit: 339c89250d87964ba8d58860a5ecdbc0bdde4956
context: []
---

<frozen-after-approval reason="Owner yêu cầu fix chuẩn sau Batch2A; giữ nguyên giới hạn bảng và business semantics">

## Intent

**Problem:** Courses GET dùng service-role trước khi xác thực và tin tenant query; SQL executor còn cho authenticated/legacy client roles thực thi SQL đặc quyền. Hai bypass phải được đóng trong phạm vi đã có authority.

**Approach:** Courses list/detail xác thực phiên Auth trước data query, chỉ dùng session/RLS client và tenant profile được đối chiếu với Auth subject; không dùng mock/default tenant hoặc privileged fallback. RPC chỉ giữ các explicit maintenance principals có trước PUBLIC containment. Không coi hai sửa này là full RBAC/RLS PASS khi nguồn profile còn mutable và chưa có read-role/branch matrix chuẩn.

## Boundaries & Constraints

**Always:** Giữ anonymous denial trên32 bảng/RPC. Không thay classroom mapping, domain rules, teacher contract hoặc POST hold. Mọi selector tenant khác phiên phải bị từ chối trước business reads. DB RPC change có snapshot, exact pre/post assertions, isolated rehearsal, recovery và anonymous/service/user role checks. Không lưu secret hay business-row values.

**Ask First:** Mở rộng sang `public.users` hoặc bảng ngoài32; đổi read-role/guardian/branch semantics; commit/push/merge/deploy code khi chưa có authority riêng. Chuẩn bị packet cụ thể trước khi xin mở rộng.

**Never:** Tin JWT app_metadata như nguồn độc lập (claims sync từ cùng mutable profile); dùng Finance roles cho Courses; sửa Kernel/Platform helper để che lỗ hổng; cấp lại anonymous; tự tuyên bố Go-Live.

## I/O & Edge-Case Matrix

| Scenario | Input/state | Expected behavior | Error handling |
| --- | --- | --- | --- |
| Anonymous | Có tenant query/mock headers nhưng không Auth user | Không đọc business data | 401 |
| Invalid session | Auth error/no user | Không đọc profile/course | 401 |
| Invalid profile | Thiếu/inactive profile hoặc ID khác Auth subject | Không đọc course | 403 |
| Foreign selector | Auth/profile tenant A, query tenant B | Không đọc course | 403 |
| Session RLS read | Auth/profile active đồng nhất, tenant selector absent/matching | Giữ payload hiện hữu; tất cả business reads qua session client và tenant scope | Existing query errors |
| RPC client roles | anon/authenticated hoặc role từng hưởng PUBLIC | Constant SELECT denied | 42501 / HTTP401/403 |
| RPC maintenance | postgres owner, service_role, bella_migration_executor; inherent superuser | Constant SELECT still executes | No new grant options |

</frozen-after-approval>

## Code Map

- `src/app/api/education/courses/route.ts` — list bypass, POST đã hold.
- `src/app/api/education/courses/[id]/route.ts` — detail selector/mock fallback.
- `src/app/api/education/courses/request-context.ts` — adapter nhỏ chung cho hai handler, không là Platform abstraction.
- `src/app/api/education/courses/__tests__/route.test.ts` — giữ projection assertions, thêm Auth/session/tenant denies.
- `src/services/user-actions.ts`, `src/lib/supabase-server.ts` — reuse identity/session, không sửa shared sources.
- `batch2a-rpc-20261021/*` — catalog/rehearsal utilities đã có; giữ nguyên bằng chứng cũ.

## Tasks & Acceptance

**Execution:**

- [x] API helper/list/detail + focused tests — loại service-role và selector bypass, giữ semantics/mapping.
- [x] `batch2b/*` — tạo/test/thực thi RPC-only artifact với exact ACL delta, giữ32 table catalogs.
- [x] `batch2b/*` — kiểm chứng identity trust bằng live metadata và isolated synthetic reproduction; chuẩn bị đề xuất đúng một bảng nếu cần, không tự áp dụng.
- [x] Targeted tests, lint/typecheck, applicable architecture/conformance checks và runtime HTTP denial; ghi raw exits, không coi mock là production proof.
- [x] Independent code review, final evidence và chỉ rõ source/local/production trạng thái riêng.

**Acceptance Criteria:**

- Given anonymous hoặc forged tenant/mock headers, when gọi Courses list/detail, then không query business DB và trả401.
- Given verified Auth subject và active matching profile, when selector tenant khác profile, then403 trước data reads; selector hợp lệ giữ projection test expectations qua session client.
- Given frozen approved32 catalogs, when RPC ACL transaction commits, then chỉ RPC client EXECUTE mất; bodies/policies/table ACLs/memberships/schema/defaults không đổi.
- Given mutable profile identity, when đánh giá Batch2B, then tenant/role security vẫn NOT_PROVEN và không apply policy matrix từ suy đoán.

## Spec Change Log

2026-10-21: Scope được Owner giao trực tiếp bằng `fix chuẩn đi`, sau phê duyệt production containment. Checkpoint intent dùng authority này; không yêu cầu duyệt lại scope đã giao. Hai work items là cùng security goal; rollout code và shared identity ngoài32 được giữ riêng.

## Design Notes

Sources: Education Constitution tenant isolation, common Constitution backend authorization, deployed RPC comment service-role migration helper, canonical live identity helper migration. Fresh catalog xác nhận `users` authenticated có UPDATE role/tenant/status và self ALL policy; chỉ có audit, updated_at, claims-sync triggers. Đây là blocker của full role/tenant proof. Session/RLS read giảm bypass hiện hữu, không tạo entitlement mới hoặc khẳng định role matrix đã được approve.

## Verification

- Focused Jest route/helper tests, giữ canonical classroom payload tests.
- ESLint changed API/test files; changed TypeScript gate hoặc scoped diagnostics nếu baseline ngăn full check.
- `npm run education:verify`, `npm run healthcare:verify` — ghi actual outcomes; không sửa baseline/infra để green.
- Native PostgreSQL RPC rehearsal: explicit allowed/denied roles, failure rollback, scoped recovery và fingerprints.
- Production read-only catalog/role probes + constant SELECT RPC; HTTP local API denies. Deployment production API chưa chạy phải báo NOT_RUN.

## Suggested Review Order

- Auth/profile/tenant boundary; full role matrix remains unresolved.
  [request-context.ts:24](../../../../src/app/api/education/courses/request-context.ts#L24)

- Session data path replaces the service-role bypass.
  [route.ts:53](../../../../src/app/api/education/courses/route.ts#L53)

- Detail uses the same verified context.
  [route.ts:8](../../../../src/app/api/education/courses/[id]/route.ts#L8)

- Keep maintenance RPC, deny existing client grants.
  [20261021030000_restrict_exec_sql_client_execution.sql:5](../../../../supabase/migrations/20261021030000_restrict_exec_sql_client_execution.sql#L5)

- Deny spoofed and foreign tenant inputs before business queries.
  [access.test.ts:47](../../../../src/app/api/education/courses/__tests__/access.test.ts#L47)

Review state remains in-review: independent reviews retried successfully and both introduced migration findings were fixed/reviewed closed; broad DB-dependent gates did not PASS and shared identity remains held. No automatic commit or done status.
