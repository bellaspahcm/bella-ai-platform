# Kiểm kê bằng chứng ngữ nghĩa và ontology Bella

Ngày: 2026-11-09. Trạng thái: KẾT THÚC KIỂM KÊ BAN ĐẦU; runtime và Production chưa được xác minh.

## Mục tiêu và phạm vi

Kiểm tra nhận định Bella có các nền tảng ngữ nghĩa phân tán nhưng chưa chứng minh Enterprise/Industry Ontology hoàn chỉnh; phân loại bằng chứng Enterprise, Industry và Product, ưu tiên Bella Interior, Business Truth, EIP/EOS và ranh giới Finance. Chỉ đọc code, tài liệu và bằng chứng sẵn có; không thay đổi runtime, database hoặc quyền.

## Giả thuyết ban đầu

1. Bella có các mô hình, contract và quy tắc nghiệp vụ nhưng chưa chứng minh một ontology thống nhất hoàn chỉnh. Trạng thái: bằng chứng được khảo sát ủng hộ; không khẳng định không có thành phần khác ngoài phạm vi.
2. Code hoặc tài liệu có tên ontology/knowledge graph không tự chứng minh chức năng đang chạy trên Production. Trạng thái: ĐÃ XÁC NHẬN về giới hạn bằng chứng; có cả graph adapter thực tế và ontology lookup stub.

## Bằng chứng ban đầu

- Constitution quy định Product-first, reuse trước abstraction; code hiện hữu không tự động là Business Truth (`docs/governance/BELLA_AI_CODING_CONSTITUTION.md:13`, `:19`, `:1231`).
- Có contract nền tảng và Product/Industry trong `src/foundation/contracts/`, `src/platform/` và `src/products/bella-interior/`; cần truy ngược implementation và usage.
- Bản kiểm tra sử dụng checkout `codex/bella-interior-rbac-phase6`; không thể suy diễn code trên nhánh này đã được merge hoặc deploy.

## Phương pháp và giới hạn

- Bản khảo sát đại diện: Foundation/Identity/Organization, Finance, Knowledge, EIP, Interior, ví dụ Healthcare và Education. Đây không phải inventory đầy đủ mọi Product/OS, không phải đánh giá bảo mật toàn hệ thống.
- `CODE`: khai báo/đoạn triển khai tồn tại trong checkout; `DOC`: tài liệu nêu thiết kế hoặc kỳ vọng; `NOT_PROVEN`: chưa có bằng chứng đủ cho luồng đầu cuối hoặc Production. `CODE` không đồng nghĩa chạy thật hoặc là business truth đã được chủ doanh nghiệp xác nhận.
- Checkout nhánh PR Interior thay đổi từ `bbfcc27237847397bc34f130bca24fb43cab6419` sang `fef75ea36772d3551e0df203412ea2210a32701e` trong lúc khảo sát. Diff thay đổi `AGENTS.md`, escape JSX và sửa chuỗi lỗi BOQ; các bằng chứng ngữ nghĩa đã trích không bị thay đổi. Nhiều thay đổi Interior Phase 6 chưa được chứng minh merge/deploy. Không truy vấn database hay kiểm tra môi trường trong cuộc khảo sát này.
- Tìm theo tên tệp và nội dung `E11_BUSINESS_TRUTH_DISCOVERY` trong repo/những đường đã khảo sát không thấy tài liệu; chưa thể xác minh nội dung, thời điểm hay trạng thái của tài liệu đó. Có thể nằm ngoài checkout.

## Inventory bằng chứng

| Phạm vi | Thành phần đã quan sát | Mức và giới hạn |
| --- | --- | --- |
| Enterprise | `OrgUnitRef`, `OrgRelationship`, `BranchRef`, quan hệ person/unit; `AssignableReference`, `PersonProfile` trong `src/foundation/contracts/organization.ts:41` và `src/foundation/contracts/people.ts:63`. | CODE là contract; chưa chứng minh một danh mục enterprise thống nhất cho mọi Product. |
| Enterprise | Actor hiện hành, tenant và quyết định quyền trong `src/platform/security/current-actor.contract.ts:21` và `src/platform/authorization/action-authorization.contract.ts:40`. | CODE là contract bảo mật; không coi mọi person, user, employee, customer là cùng một thực thể. |
| Enterprise/Finance | `FinanceEventEnvelope` có event, tenant, thời điểm, source, idempotency và correlation tại `src/platform/integration-hub/finance-event-contract.types.ts:24`; `DefaultSemanticResolver` ánh xạ loại sự kiện sang semantic tại `src/platform/finance/resolvers/semantic-resolver.service.ts:33`. | CODE từng lát Finance; không chứng minh ngữ nghĩa áp dụng đồng nhất toàn doanh nghiệp, hay một event tạo thành business truth hoàn chỉnh. |
| Industry/Education | Enrollment liên kết tenant, student và course; có chuyển trạng thái và kiểm tra tại `src/platform/education/enrollment/enrollment.aggregate.ts:16`. | CODE ví dụ lifecycle; chưa xác minh deployment hoặc toàn bộ Education Ontology. |
| Industry/Healthcare | Encounter có patient, provenance; contract temporal/CDS có dấu vết quyết định tại `src/platform/healthcare/engines/encounter-engine/domain/encounter.entity.ts:48` và `src/platform/healthcare/contracts/temporal-engine.contract.ts:75`. | CODE/contract; không sửa hay vượt Healthcare H1–H12. |
| Product/Interior | `DesignRevision` gắn tenant/project, `InteriorBOQ` gắn project/design revision, `InteriorContract` gắn project; handover/warranty gắn project/contract: `src/products/bella-interior/domain/design-specification/types.ts:88`, `src/products/bella-interior/domain/commercial-costing/types.ts:106`, `:186`, `src/products/bella-interior/domain/delivery-aftercare/types.ts:66`. | CODE là các quan hệ và trạng thái Product, chưa phải ontology được phê duyệt hay chứng cứ API end-to-end. |
| Product/Interior | Service tạo BOQ kiểm tra design approved và tự tạo BOQ `approved` (`src/products/bella-interior/services/commercial-costing.service.ts:60`, `:111`); migration Phase 6 lại yêu cầu tách lập và duyệt BOQ (`supabase/migrations/20261109130000_bella_interior_rbac_scopes.sql:2190`). | CODE có khác biệt ngữ nghĩa giữa các đường; cần xác định đường nào đang dùng và chủ nghiệp vụ xác nhận, không mặc định hợp nhất. |
| Product/Interior | Service tạo lệnh có kiểm tra thiết kế đã duyệt rồi lưu lệnh (`src/products/bella-interior/services/manufacturing-installation.service.ts:32`, `:52`, `:94`); API phát hành hiện trả unavailable (`src/app/api/interior/contracts/route.ts:193`). | CODE cho thấy một invariant và một API bị khóa; chưa chứng minh kiểm tra BOM/hợp đồng, quyền hay persistence end-to-end. |
| Product/Interior ↔ Finance | Adapter gửi `INTERIOR_CONTRACT_MILESTONE_INVOICED` (`src/products/bella-interior/adapters/supabase-finance-outbox.adapter.ts:39`); migration hardening xác minh milestone và chống duplicate (`supabase/migrations/20261108224216_bella_interior_production_security_hardening.sql:537`, `:653`). | CODE/migration; chưa chứng minh event đi xuyên consumer tới bút toán Finance. Không coi gửi outbox là bút toán đã ghi. |

## Knowledge Graph và ontology: đã có nhiều hơn tên gọi

1. `src/platform/knowledge/index.ts:64` định nghĩa graph edge, `:113` định nghĩa `OntologyTerm`, `:147` định nghĩa repository; engine ủy quyền sang repository và sẽ báo lỗi nếu chưa được inject (`:175`). Đây là contract và phần điều phối, không tự tạo storage.
2. Migration `supabase/migrations/20260806020000_blueprint_knowledge_policies_resources.sql:34` khai báo bảng graph edges, có tenant, loại quan hệ, evidence source và index; migration seed `20260806040000_healthcare_seed_data.sql:35` có ví dụ cạnh Healthcare. Đây là schema/seed trong repo, chưa chứng minh dữ liệu hoặc triển khai Production.
3. `SupabaseKnowledgeRepository` có code ghi cạnh và lấy neighbors (`src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts:1448`, `:1467`), được đưa vào composition qua bootstrap (`src/modules/bella-healthcare/kernel/bootstrap.ts:94`, `src/platform/composition/index.ts:314`). Vì vậy nói Bella chỉ có ý tưởng graph là thiếu chính xác; graph adapter có thật trong source, nhưng truy vấn, dữ liệu và quyền thực tế chưa được chứng minh trong cuộc khảo sát.
4. Cùng adapter này trả `null` cho `findOntologyTerm` và `[]` cho `getOntologyChildren` (`src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts:1637`). Không thể xem ontology lookup ở adapter này là hoàn chỉnh.
5. `semanticSearch` trong adapter trên dùng `ILIKE` và điểm số cố định giả lập `0.95` (`src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts:1490`). Không trình bày điểm số đó như độ tin cậy hay bằng chứng suy luận.
6. `evaluateInference` trả không có blocker khi truy vấn lỗi (`src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts:1534`). Đây là rủi ro nếu caller diễn giải kết quả đó là an toàn để thực thi; cần truy caller và kiểm tra runtime trước khi kết luận mức ảnh hưởng. Không dùng làm cổng y tế/tài chính khi chưa xác minh. Không thay đổi Healthcare kernel.
7. `docs/06-industries/DATA_AI_ARCHITECTURE.md:63` mô tả clinical graph và `docs/EOS_EIP_ARCHITECTURE_CURRENT_STATE.md:1` là tài liệu đánh giá ngày 2026-08-21. Cả hai là bằng chứng tài liệu, không tự chứng minh trạng thái vận hành hiện tại.

## Gap và giả thuyết cần đối chiếu

| Gap | Bằng chứng hiện có | Cần chứng minh hoặc quyết định |
| --- | --- | --- |
| Định nghĩa, owner, từ đồng nghĩa và phiên bản thuật ngữ | Có `OntologyTerm` nhưng adapter tra từ trả rỗng. | Ai sở hữu từng nghĩa, hiệu lực, phạm vi áp dụng, xung đột và quy trình thay đổi? Không tự nâng thành contract dùng chung. |
| Business Truth và provenance | Một số fact có source/effective dates; Finance event có correlation/idempotency; Healthcare có provenance riêng. | Với mỗi kết luận: bản ghi nguồn, phiên bản, thời điểm hiệu lực và ghi nhận, actor/cách tạo, quyền, độ đầy đủ, liên kết sự kiện và quyết định. Thiếu dữ liệu phải trả `UNKNOWN`, không kết luận sai hoặc suy ra nguyên nhân. |
| Quan hệ xuyên domain | Interior có ID quan hệ cục bộ, outbox và Finance contract. | Chứng minh nguồn, consumer, semantic mapping, commit/idempotency, ledger read-back và ownership; không suy ra đã hạch toán từ outbox. |
| Production Order ↔ Manufacturing | Type comment mô tả ownership và dự kiến port tại `src/products/bella-interior/domain/manufacturing-install/types.ts:4`; service đang dùng `IInteriorRepository`, không quan sát thấy import contract Manufacturing trong đường khảo sát. | Cần trace adapter/caller và trạng thái triển khai; không kết luận đã tích hợp Manufacturing OS. |
| AI giải thích và EOS thực thi | EIP có service truy vấn/tổng hợp (`src/services/intelligence/executive/service.ts:93`); có action/quy tắc rải rác. | Chứng minh câu trả lời có nguồn và scope, phân biệt fact/suy luận/giả thuyết; chứng minh command API re-check actor, scope, điều kiện và audit tại thời điểm ghi. |
| Ontology/graph vận hành | Có schema và graph adapter; ontology methods stub, một số tài liệu mô tả mục tiêu. | Kiểm tra cấu hình wiring, schema/ACL/RLS, dữ liệu, truy vấn thực và usage trên môi trường được phép trước khi tuyên bố capability. |

## Minimal Canonical Model đề xuất — thử nghiệm Product-local, chưa phải contract mới

Chọn câu hỏi duy nhất: **“Vì sao dự án này chưa thể phát hành sản xuất và còn thiếu bằng chứng nào?”** Trả lời chỉ đọc trên dữ liệu và quyền mà actor đã được phép xem. Không tự động phát lệnh.

| Khái niệm | Nghĩa/lát thử nghiệm | Nguồn cần xác minh | Trạng thái |
| --- | --- | --- | --- |
| `ProjectRef` | Tham chiếu dự án trong một tenant, kèm quyền đọc/scope. | Read model/RPC Product được bảo vệ; không tin tenant/project từ client. | Đề xuất |
| `DesignRevisionRef` | Phiên bản thiết kế thuộc dự án, trạng thái và bằng chứng duyệt. | Design revision + hành động duyệt được chứng minh. | Có types/code; runtime chưa chứng minh |
| `BOQRef` | BOQ và revision thiết kế nguồn; trạng thái lập/duyệt cần reconciliation. | BOQ, lineage và audit. | Có types/code; còn xung đột đường tạo |
| `ReleaseAssessment` | Kết quả tổng hợp `SATISFIED` / `NOT_SATISFIED` / `UNKNOWN` cho từng điều kiện và lý do. | Chỉ từ nguồn hợp lệ về thiết kế, BOM, hợp đồng và quyền; thiếu nguồn là UNKNOWN. | Đề xuất, không có command phát hành |
| `EvidenceRef` | Nguồn sở hữu, entity ID, phiên bản/trạng thái, thời điểm hiệu lực và quan sát, actor/quyền, trạng thái bằng chứng. | Read model/audit/ledger có thẩm quyền cho từng điều kiện. | Đề xuất, chưa khẳng định mọi trường đã tồn tại |

Đây là vocabulary và ví dụ read model phục vụ một workflow, không tạo bảng ontology, graph DB hay dependency bắt buộc. Không gom `Customer`, `Person`, `Employee`, `Tenant` hoặc semantic Finance chỉ vì giống tên. Hạn chế dữ liệu theo tenant/branch/project/action, ẩn tài chính theo quyền; kết quả không suy ra quan hệ nhân quả chỉ từ tương quan.

## Thứ tự đề xuất

1. Sửa và hoàn tất các gate RBAC Interior đang fail; chỉ sau release mới có cơ sở kiểm tra user thật. Xác nhận với người vận hành điều kiện phát hành và định nghĩa BOQ draft/approved trước khi chuẩn hóa.
2. Lập bảng ownership + nguồn sự thật cho từng điều kiện trong một dự án pilot; trace Design → BOQ → yêu cầu sản xuất → Manufacturing và milestone → outbox → Finance đến persisted read-back. Ghi `UNKNOWN` cho mắt xích chưa được chứng minh.
3. Tạo Product-local read model chỉ đọc, có evidence/permission và kiểm tra test dương/âm, tenant/project isolation, thiếu nguồn, dữ liệu cũ và trạng thái thay đổi. EIP giải thích từ evidence; EOS/command vẫn tự kiểm tra quyền và business rule khi ghi. Đây là đề xuất chưa triển khai.
4. Chỉ sau khi quan sát nhu cầu tương tự ở các Product/Industry khác và thống nhất ownership/semantics mới cân nhắc chia sẻ hoặc trích xuất; graph hoặc registry chỉ bổ sung khi có use case chứng minh cần.

## Kết luận và bằng chứng còn thiếu

**Tin cậy cao đối với code đã đọc; không suy rộng thành kết luận Production.** Bella có các contract, lifecycle, Finance semantics và graph adapter cụ thể; ontology lookup ở adapter được khảo sát chưa triển khai và EIP → verified truth → authorized EOS chưa được chứng minh đầu cuối. Cần kiểm tra `E11_BUSINESS_TRUTH_DISCOVERY.md` tại nguồn khác nếu có, luồng chạy thực tế, source-of-truth/owner của từng fact, và bằng chứng user thật trước khi xác nhận enterprise hoặc industry ontology hoàn chỉnh.

## Follow-up 2026-11-09 — Baseline và bằng chứng bổ sung

- Người dùng xác nhận bản kiểm kê ngày 09/11/2026 là baseline cho cuộc khảo sát có phạm vi và giới hạn nêu trên. Giữ nguyên các nhận định lịch sử; phần follow-up phản ánh thông tin mới.
- Đã tìm được `D:/Antigravity/Projects/BELLA_E11_REVALIDATION_1698280e5/docs/architecture/E11_BUSINESS_TRUTH_DISCOVERY.md`: tài liệu tự ghi `REQUIREMENTS DEFINITION`, `Pre-Implementation`, cập nhật 2026-09-04, có yêu cầu evidence, reasoning, alternatives, critique và provenance. Phát hiện này đính chính nhận định trước rằng tệp chưa tìm thấy trong checkout hiện tại.
- Các checkout E11 cũ có source `src/platform/business-truth/`, gồm types và `validators/provenance-tracker.ts`; bằng chứng code trong checkout cũ không chứng minh hợp nhất vào main hoặc vận hành Production. `git ls-tree HEAD src/platform/business-truth` trong checkout main hiện tại không trả kết quả.
- Production read-only hiện xác nhận migration RBAC `20261109130000` đã ghi trong ledger, các bảng role tồn tại và có đúng một assignment OWNER/TENANT/ACTIVE. Không suy ra quyền user thật hoặc isolation đã được kiểm thử đầu cuối từ bằng chứng catalog đó.
- Trace ban đầu inference: `SupabaseKnowledgeRepository.evaluateInference` → `knowledgeEngine.evaluateRules` → `HealthcareKnowledgeEngine.checkPrescriptionSafety` → `HealthcareKnowledgeProvider.verifyRules`. Chưa tìm thấy caller của `verifyRules` trong source đã tìm; chưa chứng minh provider này cho phép EOS thực thi hoặc đang phục vụ Production. Khi thiếu `allergies` hoặc `prescribed_drugs`, provider hiện chuyển thành mảng rỗng, cần xử lý fail-closed trong giới hạn Healthcare và contract được phép.
- Trace ban đầu Finance: adapter Interior enqueue vào `interior_finance_outbox`; chưa tìm thấy consumer của bảng/event này trong phạm vi `src` và `scripts` đã tìm. Vì vậy `Consumer → Finance Transaction → Ledger Read-back` vẫn NOT_PROVEN.
