# Preschool Courses authorization delivery

Base 339c89250d87964ba8d58860a5ecdbc0bdde4956; branch codex/preschool-courses-auth-20261021. Owner requested push on2026-10-21.

Courses list/detail validate Auth before profile/business reads, bind active profile to Auth subject and tenant, reject foreign/duplicate tenant overrides and use the session/RLS client. Removed service-role/mock/default tenant fallback; kept classroom payload and POST503 behavior. Teacher lookups are tenant-fenced, and API responses are dynamic/no-store.

The small shared request adapter belongs to this Education API boundary; no shared identity/Kernel source or SQL migration is changed in this branch. Profile authority containment is delivered separately. This is not a new read-role/guardian/branch entitlement matrix.

Included evidence records the earlier24/24 focused tests,4/4 actual local Next HTTP denials and independent review. Prior broad Education/Healthcare checks failed against deliberate offline DB and are not reported as passing. Code remained undeployed at the last production probe: Courses200 with8 classrooms; source push alone cannot close that exposure. Full original audit is preserved in the originating workspace.

## Delivery checks

Fresh checks on this isolated branch are stored in check-results.json and verification logs. Source-manifest.json seals exactly5 source/test/migration paths. No PR, merge, source deployment, production DML or new migration execution is performed by this push. Required CI/build checks and real authenticated business regression remain separate gates.
