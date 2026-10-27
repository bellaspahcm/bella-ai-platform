# Batch2B proportional change map

**Implementation decision: PASS for the two boundary-local fixes; BLOCKED for full authenticated RLS/role proof.** New Product/OS/UI redesign is not involved. No Kernel change is requested or permitted.

Truth/contract: Education tenant isolation and backend authorization are mandatory; Courses may not bypass session RLS using service-role or user-supplied tenant. Existing GET mapping/domain behavior remains. Live RPC comment and original migration identify exec_sql as maintenance-only; no educational client capability is created.

Ownership: Product API owns session/selector checks; Platform owns shared canonical `users` identity; DB owner controls exec_sql maintenance ACL. Existing32 allowlist is preserved. Shared identity mutation is an uncovered dependency, not authority to rewrite `users` automatically.

Boundary: Courses UI → API Auth validation → canonical active profile bound to Auth subject → session/RLS client → existing Education contract/read queries. Queries use that resolved tenant; no mock/default tenant, no admin fallback. RLS remains responsible for actual row entitlement. Current mutable identity means tenant/role security remains NOT_PROVEN even after API bypass closure.

Change authority: Owner `fix chuẩn đi` extends work to the reported Batch2B gaps. Runtime allowlist is Courses list/detail, one small request context adapter and focused tests. Production mutation allowlist is one function's EXECUTE ACL; all32 table catalogs and non-RPC controls remain fixed. No shared user writer, Platform helper, migration history or Healthcare/Education Kernel change.

Migration plan: RPC ACL-only explicit transaction, exact fingerprint guards, rehearsal, failed-transaction recovery, current target validation and independent live postchecks. No table/index creation or business DML. Shared-users proposal is preparation only and must not be executed under this authority.

Business semantic proof: Auth subject must be validated before data access; selector cannot grant a tenant different from the active profile; role/tenant/actor headers are not authority; RPC client raw SQL access is denied while original explicit maintenance principals remain. Sources are governing constitutions and deployed migration-helper comment. Course read role/branch matrix is NOT_PROVEN; Finance authorization cannot be reused as a Course permission rule. Mutable users fields are NOT a safe proof of entitlement.

Verification: negative Auth/selector tests and unchanged positive projection tests; lint/TypeScript; applicable Education and Healthcare commands with actual results; local native PostgreSQL ACL denial/positive/recovery tests; production read-only exact catalogs and safe SELECT1 role probes. Real-user browser E2E, API production deployment, shared identity repair and Go-Live reported independently. No test skip/timeout/environment error becomes PASS.

Delegation: Lead owns SQL/evidence/prod operations; builder exclusively owns Courses API/tests; analyst read-only canonical proof. Independent reviewers receive a bounded current-work diff, not historical audit blobs. No overlapping writable ownership or delegated approval authority.
