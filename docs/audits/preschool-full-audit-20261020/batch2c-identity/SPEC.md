---
title: Bảo vệ shared identity authority — users và writer boundaries
type: bugfix
created: 2026-10-21
status: in-progress
baseline_commit: 339c89250d87964ba8d58860a5ecdbc0bdde4956
context: []
---

<frozen-after-approval reason="Owner approve mở rộng đúng users và shared user-writers liên quan">

## Intent

**Problem:** Direct users ACL+self ALL policy cho client sửa role/tenant/status; claims-sync lan thay đổi sang Auth. Privileged user-actions/onboarding writers có thể vượt ACL. Sửa nguồn authority trước khi khẳng định Preschool RLS an toàn.

**Approach:** Revoke direct mutation của anon/authenticated trên đúng users; giữ SELECT, maintenance, policy/body/schema. Đóng client EXECUTE của hai stored identity writers đang bỏ qua ACL. Shared server actions xác thực Auth subject và fail-closed trước privileged side effects nếu thiếu proven management entitlement. Không tự tạo writable-column/role matrix để giữ UI.

## Boundaries & Constraints

**Always:** Preserve32-table/RPC containment và Courses diff trước. Không sửa business rows/Auth claims, không tạo account production. Exact metadata/rehearsal/recovery/postchecks và command exits. Không gửi email thật. Existing legitimate maintenance execution được kiểm thử cô lập. Ordinary authenticated profile/admin writes có thể bị giảm khả dụng theo đề xuất fail-closed đã approved.

**Ask First:** Table ngoài users+32, unrelated RPC/business rules, Kernel/Platform engine changes, deployment/commit/push chưa có authority thực tế. Không hỏi lại users/shared-writer scope.

**Never:** Chuyển hàng loạt writer sang service-role; tin role/tenant từ client hoặc JWT cached claims; dùng UI permission làm canonical; thay default/schema ACL hay role memberships; export business data; re-enable anonymous.

## I/O & Edge-Case Matrix

| State | Expected behavior |
| --- | --- |
| anon/authenticated direct users INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN | Effective privilege false; actual SQL42501 |
| Authenticated reads own profile | Existing SELECT/RLS outcome preserved |
| Service/maintenance writer | Existing privileges unchanged; synthetic positive persisted/readback/rollback |
| Client calls onboarding RPCs | Permission denied before function body; no account or tenant created |
| Server createUser untrusted/missing Auth/profile | Return explicit error before Auth.admin/create/mail/audit writes |
| Management permission unknown | Explicit temporary hold, including admin, rather than fabricated entitlement |
| Missing privileged onboarding config | Fail before creating Auth account; no unprivileged RPC fallback |

</frozen-after-approval>

## Code Map

- `src/services/user-actions.ts` — privileged create/auth delete and session user mutations.
- `src/services/onboarding-actions.ts` — authorized server onboarding, remove unsafe fallback.
- `src/services/attendance-actions.ts` — user-profile HR mutation, keep non-user attendance paths unchanged.
- `src/__tests__/user-actions.test.ts`, focused new identity/onboarding tests — actual boundary expectations and existing unaffected behavior.
- `batch2c-identity/*` — metadata, current dependency inventory, exact users+twoRPC execution artifact, local schema/ACL proof and production verification.
- Add scoped durable migration only for users mutation ACL/twoRPC EXECUTE; no row/policy/body modifications.

## Tasks & Acceptance

- [x] Prove entitlement sources and inventory related writers; missing precise management matrix documented, temporary holds selected.
- [x] Shared writer code/tests prepared: block side effects and missing-config fallback without adding service grants; configured onboarding decision retained. Source release pending.
- [x] Live users schema/constraints/indexes/policies/triggers/helpers/roles/dependencies captured; six dependent views have no writeback; incoming writer references empty.
- [x] Native PostgreSQL20/20: exact scoped schema/core catalog, denied/retained rights, claims, rollback/recovery/replay. Only frozen outside-fingerprint literal adapted; full production catalog not cloned.
- [x] Bounded production ACL transaction exit0 after drift/identity/rehearsal/review; independent role/REST/catalog postchecks passed; zero production business-row mutations.
- [x] Targeted Jest80/80, lint and scoped TypeScript exit0; three independent reviews closed findings; previous broad failures retained.

Implementation progress is complete for this approved containment batch. Full task remains in-progress: source Git/release authority and applicable CI/deployment gates are outstanding; production Courses still leaks anonymously. See FINAL_REPORT.md and SOURCE_RELEASE_PACKET.md. This is not a completed RBAC/RLS or Go-Live claim.

Acceptance: Given a client identity, when attempting direct authority mutation or either privileged onboarding RPC, then denial precedes body execution. Given maintenance synthetic fixtures, when operating through retained grants, then read/write/claims-sync remain coherent. Given a server action with absent authorization, then no account provisioning/mail/Auth deletion occurs. Given catalog drift or an unaccounted effective write path, then abort production delta without widening scope. Report direct ACL proof separately from public identity provisioning, Product role/branch matrix, production code rollout and Go-Live.

## Design Notes

Owner-approved fail-closed proposal is canonical for temporary holds. Approved ADR-001 requires least privilege/audited role assignment but does not define complete tenant admin/HR/self write matrix. Current policy names are consumer evidence, not independent business authority. Therefore permission gaps may use explicit hold without inventing a new admin entitlement. DB ACLs preserve service/maintenance and SELECT; server configuration is necessary for privileged onboarding and cannot fall back to client SECURITY DEFINER calls.

Investigation amendment: ADR-010 says HR creates employee accounts, but provides no assignable-role/tenant delegation contract; admin-only arbitrary-role creation would invent authority and remove HR capability. Temporary `createUser`/`deleteUser` holds are selected under the approved fail-closed scope. Other direct session users mutations (including attendance HR/partner metadata) become unavailable through ACL and must not be migrated to service-role. No runtime edits to attendance/partner are needed for containment; report degradation. Existing public BabyCare server registration with configured service credentials remains unchanged; remove only the unprivileged RPC/signUp fallback when that configuration is missing. Exactly two additional stored writer EXECUTE boundaries are directly part of shared identity-writer scope; no function body or downstream seeded-table mutation.

## Verification

Focused user/onboarding/Auth/Courses regressions; scoped TypeScript/lint. Real local PostgreSQL users schema+triggers, exact metadata fingerprints, safe synthetic role claims, recovery and twoRPC denied calls. Production probes use READ ONLY or requests guaranteed denied by ACL (no valid business payload/row contents). Service-positive production verification is read/permission only; write proof local. No full Auth/browser/E2E/Go-Live claim.
