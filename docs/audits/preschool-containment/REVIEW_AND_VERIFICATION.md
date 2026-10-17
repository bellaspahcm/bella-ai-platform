# Temporary containment — bounded verification

Result: **PASS_SCOPED**. No merge, manual deployment, Production Go-Live or Pre-Go-Live readiness.

## Implemented scope

- Parent Daily GET always returns HTTP 503 / `PARENT_ACCESS_NOT_READY`.
- Course POST always returns HTTP 503 / `COURSE_AUTHORIZATION_NOT_READY`. Body, authority, persistence, assignment and event paths are not invoked. Course GET/import/helper prefix remains equal to source baseline `0bc9bba1b888ca121dd4ae56eb9ff7ebb1c9831f` after line-ending normalization.
- On the existing private synthetic C10 target only, the exact reviewed restrictive anonymous SELECT policy was committed. This PR introduces **no migration** and does not deploy that policy anywhere else.

Both held endpoints are unavailable to legitimate callers too. The policy limits direct anonymous SELECT; it is not a functional guardian/parent authorization repair.

## Executed evidence

`node docs/audits/preschool-containment/verify-http-containment.cjs`: 12/12 focused Jest tests PASS, including real NextResponse envelopes, poisoned/malformed request and downstream tripwires, plus two handler responses transported over loopback HTTP. Focused ESLint PASS; Education typecheck and test-inclusive typecheck have zero diagnostics. Course GET equality and source/log hashes are in `http-verification.json`. These are handler/adapter tests with downstream dependencies replaced by tripwires; they do not prove Next routing, middleware, Auth or UI→DB.

`node node_modules/tsx/dist/cli.mjs scripts/healthcare/architecture-guard.ts`: PASS, zero violations. Full Healthcare verification/integration was not run: no safe full baseline/environment has been established, and remote suites remain outside scope. Healthcare regression therefore stays NOT_PROVEN. No full Next build/production runtime claim.

`c10-containment-proof.json`: real PostgreSQL RLS role execution against nonempty synthetic fixtures. Separate setup/state-verifier session uses private OS peer access; subject transactions explicitly use non-superuser/non-BYPASSRLS `anon` or `authenticated`, with `row_security_active=true`. No service role is used as subject proof. Before policy all seven probes read both synthetic students; afterwards four anonymous cases read zero and three authenticated cases retain exactly the same two rows. The forged role-claim case remains an `anon` database subject and is denied.

The actual catalog excluding the single named new policy has identical before/after fingerprint, including existing policies, tables/columns/constraints/triggers/functions, ownership, ACL/default ACL and schemas; role/membership/settings fingerprint is also unchanged. Authenticated does not inherit or SET anon. Fixtures are removed by exact IDs, verified business/Auth user counts are zero; target is cleanly stopped, all batch containers removed, listeners zero, original E01 volume byte-identical and encrypted post-load snapshot unchanged. No Auth principals or real child data were created. This is four-table C10 trial proof, not Auth/JWT/PostgREST or Production-equivalence.

One initial verifier attempt failed on an evidence-variable naming error before target start or SQL write. Its failure receipt is retained separately, the code was corrected, and the successful attempt is recorded without relabelling the failure as PASS.

## Independent review

QuickDev required three read-only reviews. Blind hunter: no actionable finding. Acceptance auditor: PASS_SCOPED, patch reverse-check/evidence hashes and GET preservation confirmed. Edge-case hunter: no HTTP blocker; four operational harness findings were repaired before any DB mutation (launch reconciliation, helper cleanup, listener errors and final-failure recovery). Re-review confirmed those repairs. Reviewers did not modify implementation or run DB probes.

## Remaining gates and stop

Parent RLS **FAIL**, authenticated unrelated-parent/cross-tenant visibility **FAIL**, protected authority/guardian binding **NOT_PROVEN**, Course authorization **BLOCKED**, UI→DB E2E **NOT_PROVEN**, external-device isolation **NOT_PROVEN**, canonical baseline **NOT_APPROVED**, Pre-Go-Live **BLOCKED**. The unchanged authenticated result is containment compatibility evidence, not evidence of acceptable privacy. Existing UI PR358–360 remain draft at their original commits.

Temporary containment must not be removed without an approved functional repair and matching real-principal access/revoke/tenant evidence. Source-only tests cannot open those gates. Keep the C10 target stopped/private and retain the verified encrypted pre-containment recovery snapshot; do not automatically expose a restored known-unsafe baseline.

Automatic approval review rejected cache cleanup commands. `.cache/containment-http/` remains local and is excluded from the staged change; no cleanup bypass was attempted.
