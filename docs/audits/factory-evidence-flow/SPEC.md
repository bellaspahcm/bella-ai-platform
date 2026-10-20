---
title: Luồng evidence Factory có thể đối chiếu
type: feature
created: 2026-10-20
status: in-progress
baseline_commit: 5ad15661f2dc2603881d50abdef17bcd7bc5fb20
context: []
---

<frozen-after-approval reason="Phạm vi đã được người dùng duyệt trong hội thoại">

## Intent

Khép kín luồng coding qua entrypoint hiện có bằng evidence liên kết được với native facts, candidate và commit; Monitor đọc đúng run. Không coi tài liệu, fixture hay artifact riêng lẻ là runtime proof.

## Boundaries

Giữ riêng baseline main `5ad15661f2dc2603881d50abdef17bcd7bc5fb20` và Constitution candidate `36a57668f5aba61da10d7c555dde2e6d01518a5b`. Giữ `role-pipeline.mjs run`, lifecycle facts và scope task hiện hữu. Một Lead, các vai trò native tuần tự. Được tạo commit cục bộ trong scope. Không push/PR/merge/deploy, không đổi Product/Core/kernel/registry/DB/migration/RLS/auth/CI/sandbox. Không resume task cũ.

## I/O

| Tình huống | Kết quả |
|---|---|
| Metadata đủ nguồn và binding nhất quán | Kiểm tra được liên kết; mức proof vẫn gắn với nguồn thực thi. |
| VERIFY chỉ readback | Không được khai báo là test execution. |
| Thiếu nguồn, artifact sai hash, scope sai | HELD hoặc trạng thái evidence tương ứng; không điền mặc định. |
| Lỗi store | Giữ operation/mã lỗi an toàn; chưa sửa khi chưa chứng minh nguyên nhân. |
| Candidate thay đổi hoặc commit khác nội dung | Không đạt candidate–commit verification. |

</frozen-after-approval>

## Code Map / Tasks

- [x] A: `scripts/agent-flow/run-evidence.mjs`, `run-evidence.test.mjs` và `FACTORY_EVIDENCE_CONTRACT.md`: companion metadata, source references, typed activities, immutable provenance; không đổi native facts.
- [x] B: `scripts/agent-flow/role-native.mjs`, `persistence-diagnostic.mjs`, `persistence-diagnostic.test.mjs`: chẩn đoán giới hạn, giữ lỗi an toàn. Chỉ sửa persistence khi có nguyên nhân được chứng minh.
- [x] C: `scripts/agent-flow-dashboard/`: đưa viewer hiện có vào phạm vi quản lý, reader thuần đọc và tương thích format có chứng cứ; không gọi store.read/readNative làm backend.
- [ ] D: entrypoint hiện hữu, task tooling mới, native Verify, independent Reviewer, fresh readback, browser đúng run, content/tree commit comparison và ba phép thử âm.

## Acceptance

- Given một nguồn bắt buộc thiếu, when đọc metadata, then không nhận evidence đầy đủ hoặc PASS.
- Given một native execution, when index stage, then giữ nguyên binding và phân biệt activity theo nguồn.
- Given lỗi persistence, when chẩn đoán, then xác định operation/cause code từ lỗi thật và giữ bất biến package cũ; thiếu exception lịch sử vẫn NOT_PROVEN.
- Given run mới thành công, when nghiệm thu, then cùng taskId/factoryRunId nối được stage, artifact, candidate, commit và Monitor.
- Given scope ngoài quyền, evidence thiếu hoặc lỗi ghi có kiểm soát, when kiểm tra âm, then bị chặn đúng và không sửa package gốc.

## Verification

Node tests của contract/diagnostic và suites Agent Flow hiện có; test reader và browser đúng package sau khi B đạt; git content/tree comparison sau khi được phép commit. Ghi command, exit/counters, environment và artifact hash thật. Không chuyển phase nếu prerequisite NOT_PROVEN.

## Spec Change Log

2026-10-20: Ghi lại phạm vi đã được duyệt; không yêu cầu duyệt lại các quyết định triển khai thông thường.

2026-10-20: Người dùng cho phép tiếp tục C/D sau diagnostic mới 15 live facts / 7 matches không tái hiện lỗi; store giữ nguyên, nguyên nhân lịch sử vẫn NOT_PROVEN. Không coi đây là sửa xong persistence.

## Pre-acceptance evidence

A: strict v1 companion schema preserves native facts and source references. B: new diagnostic `34151eb6-1f87-4506-86f2-b717f62b6d90`, root `bella-agent-flow-2WTNKD`, completed one read-only Lead, 15 live facts / 7 history matches / zero source changes. No historical root cause proven, no store repair. Owner explicitly authorized C/D. C: existing viewer imported, pure read-only readers tested against incomplete/corrupt/expired/HELD and contradictory source artifacts. Independent reviews found validation gaps; these were fixed with source-binding regressions.

D task selected: canonical file-change reader currently accepts a non-fileChange fact with a well-formed incorrect digest. A disposable protocol fixture reproduced this before any task edit; `baseline-repro.json` is external operator evidence, not a native run. The newly admitted coding task owns only `filechange-reader.mjs` and `filechange.test.mjs`; expectation comes from canonical fact signatures, not a fabricated business requirement. D runtime acceptance is still pending.

## D execution boundary

First admitted task `bb41c924-c1eb-4197-baa3-6ce800676420` / Factory `1b5bf105-8d69-4345-a625-3bfc763271e4` / package `bella-agent-flow-QeG0TU` stopped HELD at Lead due native `usageLimitExceeded`; no source changes. The owner explicitly authorized a new same-scope task, without resuming the old one.

Second task `8d76e706-2c35-4273-b1f8-2275ffa91c39` / Factory `a29ce101-c9be-4d98-ac6a-59b7fd4674e4` / package `bella-agent-flow-OxwBsf` used source `4d2a831c3804d94ce03e88414fd72bee42be4176`. Lead ACCEPT: 19 live / 9 history matches; Builder DONE: 43 live / 21 matches / one native fileChange covering both owned files. Candidate fingerprint `c965d20e9196482149011be0bb0c39a47f537c03e8c66494733c5cf29d5634d6`.

Verify executed an extra pre-read command, so the strict exact-command gate returned HELD / EXACT_TEST_REQUIRED. Its actual test command also exited 1: 11 tests, 6 pass, 5 fail, zero skip/todo/cancelled. The five failures are EPERM creating fixture directories under TEMP in the unchanged read-only native sandbox. Reviewer was not dispatched. No accepted Verify, native fresh PASS readback, verified candidate artifact or commit link exists. Neither run is resumed.

Operator environment: full 122 Node tests PASS and independent static review has no findings in the two-file Builder diff. These do not replace native acceptance. The two-file fix is retained in local commit `2abc0ecada95169a50c821d8ea54465f93ffbb19`; it is not a verified Factory handoff. The contradictory general pre-read prompt was narrowed for future Verify roles; no subsequent positive native run is claimed. Sandbox, store and native fact contract remain unchanged.

Monitor browser proof opened this exact second run on desktop/mobile: HELD, two accepted stages, task/factory IDs, original source artifact hashes. Missing/corrupt/expired controlled copies fail closed and original bytes remain unchanged. Forbidden Product scope is rejected before native dispatch. Controlled storage negative still pending.

`FACTORY_END_TO_END = NOT_PROVEN`, `FACTORY_DEFAULT_EXECUTION = NOT_PROVEN`, `SEALED_ON_MAIN = NOT_PROVEN`, `GO_LIVE = NOT_PROVEN`. C is implemented locally; no main integration/merge was authorized. Further positive D execution needs a separately approved task and a decision about the fixture-write requirement; this batch does not change sandbox permissions or weaken tests.
