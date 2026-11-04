---
title: 'Preschool: acceptance với phiên Auth thật và RLS'
type: chore
created: '2026-10-21'
status: done
baseline_commit: ecfaf23ab06d043c5f2caec38ea67856705b6c26
context: []
---

<frozen-after-approval reason="Ý định chủ sở hữu: làm acceptance theo đề xuất đã duyệt bằng lời 'làm đi'">

## Intent

**Problem:** PR407 đã merge nhưng unit test và request anonymous chưa chứng minh được hành vi với phiên Supabase Auth thật. CI đã bỏ qua Real DB; không thể gọi authenticated RBAC/RLS là PASS.

**Approach:** Chạy source đã merge trên Next development thật với Supabase E2E cách ly; tạo fixture tổng hợp có ownership rõ, đăng nhập qua Auth, gọi HTTP và PostgREST bằng public key/session thật, đọc lại DB độc lập và dọn fixture. Đối chiếu source production và các đường deny an toàn bằng đọc metadata/request không ghi dữ liệu.

## Boundaries & Constraints

**Always:** Chỉ project E2E `bmnbqbcdbuklhopfbopv` cho fixture. Source merge `ecfaf23ab06d043c5f2caec38ea67856705b6c26`. Business authority là `AUTHORIZATION_CONTRACT.md` đã duyệt. Hai tenant tổng hợp, actor/branch riêng UUID ngẫu nhiên, không dùng dữ liệu thật. Password, JWT, cookie và key chỉ trong bộ nhớ. Maintenance chỉ setup/readback/cleanup; đường chứng minh quyền dùng phiên Auth thật. Giữ nguyên các hold 503 và thuốc 410. Mọi kết quả phải nêu điều kiện môi trường và exit code thực.

**Ask First:** Mở rộng thành sửa Platform/Kernel, business semantics hay cấp quyền/schema mới ngoài fixture. Phần phụ thuộc bị chặn phải báo rõ; tiếp tục phần acceptance độc lập.

**Never:** Production DDL/DML; triển khai hoặc merge bằng agent; sửa RLS/grant để test xanh; service-role fallback trên request người dùng; mock Auth, NODE_ENV=test, tự ký JWT, SET ROLE làm bằng chứng Auth; copy business rows; chạy toàn bộ lịch sử migration; sửa CI router, guard hoặc baseline.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Identity | Session thật, profile active cùng subject | Profile đọc được; quyền từ DB | Sai role/tenant/inactive bị deny |
| Care admin | Tenant Preschool active, hôm nay, đủ schema/ACL | Roster active; write nonhealth và readback đúng | Thiếu prerequisite: NOT_PROVEN, không cấp quyền tạm |
| Mixed students | Một student hợp lệ và một không thuộc scope | 403 trước mutation | Đếm session/record độc lập, zero delta |
| Care holds | admin_staff, ngày khác hoặc health write | 503 theo contract | Không tạo mapping/health policy |
| Portal / broadcast | Admin thật, tenant hợp lệ | 503 đúng hold | Forbidden role 403, anonymous 401 |
| Medication | Bất kỳ trạng thái phiên/body | 410 | Không gọi nghiệp vụ thuốc |
| RLS | JWT thật, record tổng hợp cùng/khác tenant | Cùng tenant có positive control; khác tenant bị chặn | Thiếu ACL không được tính là RLS PASS |

</frozen-after-approval>

## Code Map / Change Map

- Product manifest: `bella_preschool`; chỉ acceptance của authorization đã giao. Không thêm capability.
- Ownership: Auth/public profile, tenant và org projection thuộc Platform; course/enrollment qua public Education producer; Care/Portal/broadcast thuộc Product. Không thay ownership.
- Contract: HTTP Product → request-scoped public client → Platform identity/branch + public Enrollment contract. Không sửa frozen Education/Healthcare Kernel.
- `scripts/verify-preschool-real-auth-acceptance.cjs`: harness chạy thật, fixture và cleanup được giới hạn bằng target/UUID.
- `docs/audits/preschool-full-audit-20261020/batch2k-real-auth/`: spec, metadata catalog, kết quả và review. Không sửa evidence cũ.
- Migration applicability: NOT_APPLICABLE cho test harness. Live preflight hiện thiếu Care session/record và attendance tables; authenticated thiếu ACL ở course/enrollment/Party. Ghi nhận và chạy phần độc lập, không tự provision/grant.
- Enforcement: giữ nguyên CI/router/hooks. Npm prepare đã chạy native exit0 trong worktree riêng. Source baseline có tree giống PR407 head. Không coi hook tồn tại là kiểm chứng tất cả gates.

## Tasks & Acceptance

**Execution:**
- [x] `catalog-before.json` — đọc catalog E2E trong transaction READ ONLY, xác nhận target và ACL/schema thiếu.
- [x] `scripts/verify-preschool-real-auth-acceptance.cjs` — harness thực hiện Auth/HTTP/PostgREST/readback và cleanup; không in request payload hoặc session.
- [x] `results-*.json` — chạy bounded, lưu counts/status/error codes, source identity và cleanup thực:105 PASS,0 FAIL,85 NOT_PROVEN; aggregate PARTIAL_NOT_PROVEN.
- [x] `FINAL_REPORT.md` — tách API/ACL/RLS/environment/production; ghi phần không chứng minh được.

**Acceptance Criteria:**
- Given project hoặc source sai, when harness khởi động, then abort trước mọi fixture write.
- Given fixture setup lỗi ở bất kỳ bước, when finally chạy, then dọn đúng các UUID đã sở hữu, kiểm tra residual và giữ primary failure.
- Given các bảng prerequisite thiếu, when acceptance chạy, then phần phụ thuộc NOT_PROVEN và phần identity/hold độc lập vẫn chạy.
- Given response deny, when readback độc lập chạy, then mutation counters không đổi nếu relation tồn tại; không mở rộng thành claim transaction rollback chung.
- Given production metadata, when readonly probes chạy, then chỉ báo source/runtime PASS nếu đúng merge và target ổn định trước/sau.

## Spec Change Log

- Live catalog không có claims-sync trigger: giữ xác minh Auth subject và quyền từ live profile/tenant, ghi metadata producer NOT_PROVEN; không tự cấp claims.
- Audit append-only ngăn xóa tenant: giữ shell terminated, yêu cầu zero active authority và zero Auth/profile/branch/person/relationship. Giữ raw lần cleanup lỗi, không xóa audit history.
-72 raw FAIL là literal header local sau status/code khớp: tách authorization check và header contract check, giữ literal-private NOT_PROVEN. Không thay Product/proxy hay giảm yêu cầu để gọi full PASS. Giữ raw FAIL và binding source, target, cleanup.
- Review patches: hỏi foreign admin/branch thực sự để test projection; Courses unexpected response phải FAIL; Auth/REST redirect:error; cleanup theo lifecycle Auth và tiếp tục từng owned residual sau lỗi. Giữ snapshot harness đã Real Auth chạy và hash handler cuối đã unit fault-test riêng; không đổi Product/Platform contract.

## Verification

- `node --check scripts/verify-preschool-real-auth-acceptance.cjs` — syntax exit0.
- `node scripts/verify-preschool-real-auth-acceptance.cjs` — actual exit, separate PASS/FAIL/NOT_PROVEN per gate; no false aggregate PASS.
- `git diff --check` — exit0; review độc lập trước seal. Healthcare/Logistics runtime regression không bị thay bởi harness; full DB regression không được gọi PASS từ suite thiếu schema.

ARCHITECTURE_GATE_RESULT: PASS cho harness/evidence trong scope; Product Go-Live vẫn NOT_READY.

## Suggested Review Order

- Đọc kết quả và giới hạn trước khi xem số PASS.
  [FINAL_REPORT.md:1](FINAL_REPORT.md#L1)

- Target và key được kiểm tra trước fixture writes.
  [verify-preschool-real-auth-acceptance.cjs:75](../../../../scripts/verify-preschool-real-auth-acceptance.cjs#L75)

- Foreign sentinel dùng đúng actor và branch khác tenant.
  [verify-preschool-real-auth-acceptance.cjs:301](../../../../scripts/verify-preschool-real-auth-acceptance.cjs#L301)

- Thu hồi authority và dọn theo lifecycle Auth owner.
  [verify-preschool-real-auth-acceptance.cjs:445](../../../../scripts/verify-preschool-real-auth-acceptance.cjs#L445)

- Fault injection xác minh tiếp tục cleanup và vẫn giữ lỗi.
  [cleanup-continuation-unit.cjs:1](cleanup-continuation-unit.cjs#L1)

- Cách chạy và đọc exit0 có NOT_PROVEN.
  [RUNBOOK.md:1](RUNBOOK.md#L1)
