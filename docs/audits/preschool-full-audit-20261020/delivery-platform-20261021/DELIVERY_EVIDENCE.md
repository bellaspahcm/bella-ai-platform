# Shared identity and maintenance ACL delivery

Base 339c89250d87964ba8d58860a5ecdbc0bdde4956; branch codex/shared-identity-containment-20261021. Owner requested push on2026-10-21.

Client mutation of public.users and client EXECUTE of two onboarding writer RPCs are blocked by the approved production ACL transaction. This source commit preserves that boundary through ordered fail-closed migrations and holds shared createUser/deleteUser before privileged side effects. Configured onboarding keeps its existing HQ/BabyCare decision and cannot fall back to client RPC/signUp when privileged config is absent.

Maintenance/SELECT/policies/bodies were preserved. Profile/status/salary/partner direct writes may intentionally degrade; staff and Training account creation remain held. The exact assignable-role/delegation contract is not invented. Both migrations are source durability artifacts: production already ran guarded ACL SQL; no production history push is part of this delivery.

Evidence included here records actual production target/exit/postconditions,96 denied anonymous reads/32 retained service reads, local20/20 PostgreSQL with only the outside-fingerprint literal adapted, and three independent reviews. Recovery SQL is unsafe-prior-ACL restoration for local proof only, never an approved production rollback. Full original audit remains in the originating workspace.

Other relations2673 unchanged; no business rows or secrets copied. Production Courses anonymous exposure remains until the separate Education source patch is deployed. Previous broad Education/Healthcare checks failed against deliberate offline DB; these are not represented as successful regression gates.

## Delivery checks

Fresh checks on this isolated branch are stored in check-results.json and verification logs. Source-manifest.json seals exactly6 source/test/migration paths. No PR, merge, source deployment, production DML or new migration execution is performed by this push. Required CI/build checks and real authenticated business regression remain separate gates.
