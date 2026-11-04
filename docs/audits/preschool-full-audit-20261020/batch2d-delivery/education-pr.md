## Problem and behavior

Anonymous Courses requests could choose a tenant before authentication and read classroom data through a service-role client. List/detail now validate Auth before profile/data access, bind the active profile to the Auth subject and tenant, reject foreign or duplicate tenant overrides, and read through the session/RLS client. Mock/default tenant and privileged fallback paths are removed; teacher lookups are tenant-fenced and responses are dynamic/no-store.

Classroom payload mapping and existing POST503 containment remain unchanged. This does not invent a guardian/read-role/branch entitlement matrix. Shared identity authority containment is delivered separately; complete authenticated RBAC/RLS remains unproven.

## Product scope declaration

- Primary: Preschool/Education Courses API authorization.
- Secondary products: None; no shared identity runtime, SQL or Kernel changes in this PR.
- Five sealed API/test files plus selected verification evidence under `docs/audits/preschool-full-audit-20261020/delivery-education-20261021/`.
- Reuses existing Auth/profile/session client; no new Platform abstraction or business semantics. Real Estate template provisions are not applicable.
- Base ancestry synchronized by normal merge with no tree/source changes; PR excludes already squash-merged Phase3/4 history.

## Testing evidence

- Isolated delivery branch:2 suites /24 tests PASS, zero skips; lint, Education scoped TypeScript and secret/log guard exit0; Architecture Guard actually ran.
- Actual local Next HTTP:4/4 anonymous/plain/spoofed list/detail requests denied401 before business data; no business-row values saved. Positive projection tests retain the existing payload contract.
- Three independent reviews completed for the source security work; evidence included.
- Prior broad Education/Healthcare offline DB-dependent failures remain failures. Current-head CI is pending; real authenticated role/branch/guardian E2E remains NOT_PROVEN and Preschool Go-Live NOT_READY.

## Database and deployment

No database migration or production mutation. Source is undeployed; the last production probe still returned200/8 classrooms anonymously, so end-to-end anonymous containment remains FAIL until a separately authorized release and actual post-deployment verification. Source push/PR checks are not production closure. Existing DB/RPC containment must stay in place during any code rollback.

## Exception justification

None: one Product API boundary, below100 files, no guard/workflow/baseline/protection changes.
