---
title: Chứng minh một run Factory end-to-end trong sandbox hiện hành
type: bugfix
created: 2026-10-20
status: in-progress
baseline_commit: 2ef1c8ea6c0b58f45311ef8b2ad7d1d4b33801bc
context: []
---

<frozen-after-approval reason="Người dùng mở batch tiếp nối và cho phép sửa tối thiểu, chạy task mới trong scope hiện hữu">

## Intent

Hoàn thành một task coding thật qua role-pipeline.mjs run, với native Verify và Reviewer độc lập, persistence/readback, commit-content comparison và Monitor cùng run. Batch CLOSED/LOCAL_PARTIAL trước được giữ nguyên như lịch sử; không resume.

Chọn lỗi có thể tái hiện trong testCounters của task-workflow.mjs: duplicate counters bị ghi đè, counts mâu thuẫn được coi là test evidence hợp lệ. Hàm có consumer thật là projectHistory, task-reader và real-filechange. Sửa lỗi integrity này bằng native Builder, giữ suite thuần xử lý dữ liệu hiện hữu không cần fixture filesystem. Không chuyển suite filechange đang EPERM thành mock/skip, không nới sandbox.

## Boundaries & Constraints

Always: entrypoint cũ; task/factory IDs mới; exact Verify test command một lần/candidate; Reviewer chỉ sau Verify PASS; mọi facts và package lịch sử bất biến. Provenance phân biệt audited main 5ad15661, Constitution candidate lịch sử 36a57668 và governing Constitution hiện đã được duyệt ở a8b6c98c (PR395). Local commits trong scope vẫn được phép theo hội thoại.

Ask First: quyền sandbox mới, Product/Core/kernel/registry/DB/migration/RLS/auth/CI/deployment hoặc push/PR/merge. Never: launcher/framework mới, bật Multi-Agent mặc định, dùng operator PASS thay native Verify, tạo completion/ACK giả, bỏ test/giảm assertion để ép PASS, sửa store vì nguyên nhân lịch sử chưa biết.

## I/O & Edge-Case Matrix

| Input/state | Expected |
|---|---|
| Sáu counters độc nhất, số nguyên an toàn không âm, sum đúng | Parse đúng counters, giữ định dạng TAP/Node info hiện hữu. |
| Trùng key dù cùng giá trị, thiếu key, unsafe integer, sum mâu thuẫn | null; không được thành test evidence. |
| Verify FAIL hoặc counters không green | HELD trước Reviewer. |
| Native task đạt đủ stage + sources | Candidate giữ fingerprint; readback và commit tree độc lập kiểm chứng nội dung. |
| Thiếu/corrupt evidence hoặc source/commit khác candidate | Chặn; không sửa original package. |

</frozen-after-approval>

## Code Map

- scripts/agent-flow/task-workflow.mjs, task-workflow.test.mjs: hai owned files cho native coding task; legacy workflow không được chạy.
- scripts/agent-flow/role-pipeline.mjs và test: chặn Reviewer ngay khi Verify không green theo yêu cầu owner; gate độc lập với counter helper được sửa.
- scripts/agent-flow/factory-publication.mjs: chỉ cập nhật selected-rule section references; schema/native facts không đổi.
- AGENTS.md, CLAUDE.md, docs/governance/BELLA_AI_CODING_CONSTITUTION.md: đồng bộ nguyên bản canonical sources đã duyệt ở a8b6c98c, không viết quy tắc mới.
- docs/audits/factory-e2e-followup/: duy nhất task record mới. Runtime/operator evidence nằm ngoài repository.

## Tasks & Acceptance

- [x] Preflight: phân loại lỗi cũ ENVIRONMENT; lưu baseline repro cho bug integrity mới và fingerprint packages cũ; cập nhật governing sources nguyên bản.
- [x] Đồng bộ gate không dispatch Reviewer sau Verify FAIL; test legitimate/pass và prohibited/fail.
- [ ] Commit nguồn sạch T; tạo owner task mới, native Lead → Builder → Verify → Reviewer. Không sửa code task trước Builder.
- [ ] Fresh-process canonical readback trước commit C; C chỉ chứa hai file Builder đã được Verify/Reviewer chấp nhận; canonical commit linkage so path/content/mode/add/delete và toàn inventory.
- [ ] Monitor đọc và mở đúng run; kiểm tra refresh/reload và bất biến sources. Negative copies từ positive run khi có; dùng lại evidence storage-negative đã xác nhận nếu không có thay đổi store.
- [ ] Review source cuối, ghi actual outcomes và provenance; local commit tài liệu kết quả riêng.

Given candidate chưa đổi, when Verify chạy exact command và Reviewer fresh thread đọc đủ diff/files/Verify receipt, then handoff PASS chỉ khi đầy đủ bằng chứng. Given candidate/commit khác path/mode/bytes, when link, then từ chối. Given run PASS đã lưu, when Monitor chọn đúng package, then task/factory/native IDs, actual counters, commit proof và hashes khớp sources.

## Verification

Operator: existing role-pipeline tests, pure task-workflow baseline, relevant Node suites và lint nếu tooling code đổi. Native: node --test --test-reporter=tap scripts/agent-flow/task-workflow.test.mjs. No install/dependency change. Healthcare/Education/DB/CI/deployment gates NOT_APPLICABLE: không thay code hoặc policy thuộc các scope đó; không coi là waiver cho future changes.

## Spec Change Log

2026-10-20: Intent và authority đã có trong hội thoại; không lặp checkpoint xin duyệt cho lựa chọn kỹ thuật bên trong scope. Preserve no-sandbox-change và historical evidence invariants. Skill workflow bmad-quick-dev + bella-qa-testing, một Lead thực hiện integration; native roles tuần tự theo yêu cầu owner.

Preflight executed: task-workflow baseline 6/6 PASS; duplicate and contradictory summaries reproduced as wrongly accepted. Role pipeline + actual Git tree fixtures 20/20 PASS; additions, deletions, executable mode and recreated deletion checked against real disposable Git commits. No native dispatch yet.

2026-10-20: Fresh task 73aaa1d6 / Factory 96c7c6da / package 2E3T9o held at Lead with NATIVE_PAYLOAD_MISMATCH, before source edits. Fresh native read confirms 13 reconciliation MATCH rows and identical command item order; no evidence for the initially considered order hypothesis. Raw live payload is not retained, so add hash-only mismatch observation without changing the strict comparison or native facts. Preserve run; use a fresh task to diagnose, not resume. This is collection diagnostics within approved adapter scope, not a guard bypass.

2026-10-20: Second fresh run 7b8ba89d / Factory 4c3342e2 / package 5LpJWO reached Builder but strict payload comparison rejected exactly commands[3].outputHash. That command printed the whole Constitution; retained history output is 65,536 bytes, the corresponding operator document read is 78,376 bytes, and fresh history still has the recorded mismatching hash. No line-ending variant established equality; do not claim a complete transport algorithm/root cause. Preserve strict comparison. Bound policy-read outputs to <=400 lines/command to avoid this loss of readback fidelity, preserving all applicable rules and sandbox. Save exact unaccepted Builder bytes, patch and manifest externally before restoring only the two owned files to HEAD; neither failed run is resumed or rewritten. Fresh task must perform the actual fix anew.

2026-10-20: Bounded-read run 2020342e / Factory 0d3e534e / package pzz5r3 still failed on a 20,437-byte output; therefore output size alone is not the root cause. Source inspection found AppServer decoding each stdout Buffer independently, corrupting UTF-8 characters split between pipe chunks. A deterministic real-child-process fixture reproduced DOWN ARROW becoming two replacement characters (RED 0/1). Minimal transport fix uses Node StringDecoder across chunks, with incomplete EOF flagged. Same fixture becomes GREEN; strict JSON/payload checks, canonical facts and sandbox remain unchanged. Earlier cap-only inference is insufficient; bounded policy reads remain lossless and avoid observed history size limits. New task/IDs only.
