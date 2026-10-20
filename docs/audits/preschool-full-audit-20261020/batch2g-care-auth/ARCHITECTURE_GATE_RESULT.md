# Care authorization change map

Decision: PASS for source-only bounded Care auth/resource containment under the owner's approved Product matrix. Teacher identity mapping, full authenticated RLS/atomicity and production behavior remain NOT_PROVEN.

Truth/authority: owner approved Product-local admin/admin_staff mapping, active enrollment only, branch/class scope and hold of UI-derived health truth. The canonical contract is docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md, copied without semantic changes from the approved artifact. No role is inferred from current UI/tests/policy names.

Ownership/manifest: existing Preschool daily care capability; API owns request identity/resource checks. Platform owns Auth/users/tenant/Product identity and branch access projection. Education owns course/enrollment/teacher assignment through public contracts. Product owns DailyCareService and Chain assignment. Do not change frozen Kernel or any lower public contract.

Boundaries: UI → verified Auth/live profile → Product role/tenant/branch gate → existing DailyCare read contract + Education Enrollment public contract → same session/RLS-backed operation. No admin/mock client, no default actor/tenant, no inferred User→Party mapping. admin_staff remains explicit503 until mapping is proven. Missing relation or branch scope fails closed; no DB prerequisites are provisioned here.

Change authority: three Care API/context/test paths, the approved contract document and evidence. No Platform/shared/Kernel change, new schemas/ACL/policies/default grants/memberships, service safety rules or UI change. Lead evidence/verification; builder exclusively those three TypeScript files.

Migration NOT_APPLICABLE. UI reconciliation: mock-only requests now401; authorized admin gets existing projection/action behavior only in permitted branch. Health writes and unproven teacher mappings are unavailable with explicit code. Existing historical care/health records are not rewritten merely by this patch.

Verification retains11 gate categories proportionally: architecture/types, public contract reuse, tenant/branch negatives, role/resource matrix, no migration, existing persistence/events, no academic/temporal/governance/audit change, applicable specialized regression evidence. Broad offline DB failures, local runtime limits, missing real Auth/Real DB/RLS and source deployment are reported separately and never PASS.
