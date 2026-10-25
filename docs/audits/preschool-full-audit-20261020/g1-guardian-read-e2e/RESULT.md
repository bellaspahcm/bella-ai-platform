# G1 Guardian read-only — current result

Date: 2026-10-25. Target: Supabase E2E bmnbqbcdbuklhopfbopv only.
Base/HEAD: b3107b2c495b30307fc6f8503a744ae60d055fa3.
Branch: codex/preschool-g1-guardian-read-20261024.

## Authority and current decision

Owner approved one caller-bound G1 read RPC and subsequently the existing Registry prerequisite plus one synthetic branch-denial fixture/cleanup on E2E. No shared table ACL/RLS changes, Auth creation/reset, Production, commit/push/merge/deploy authority is granted.

SOURCE_CHECKS = PASS_BOUNDED. STRICT_SQL_REHEARSAL = PASS_BOUNDED.
G1_SOURCE_AND_E2E_SQL = PASS_BOUNDED.
OWNER_MANUAL_BROWSER_RELOAD = CONFIRMED.
INDEPENDENT_REAL_AUTH_HTTP_BROWSER = NOT_PROVEN (Browser tool unavailable).
PRODUCTION_CHANGE = NOT_RUN. Commit/push/merge/deploy = NOT_RUN.

## Source behavior and verification

The API validates the exact bearer or cookie-session token with getUser(token). The existing server-client wrapper binds that token before canonical actor RPC; the same verified token and public key go to the G1 RPC POST. Product service receives a typed reader and validates DTO, exact Student, dates, duplicates and contact projection. No service key, generated-type edit or double assertion is present.

Parent ready profile state is bound to its route selector; Guardian ready data is bound to the Student prop. Pre-passive-effect tests cover both transitions. UI shows the relationship snapshot date and explicit missing/error states, with a bounded 15-second request timeout/retry. Guardian relationship and pickup status remain distinct. Existing profile service and PATCH 405 are unchanged.

| Check | Actual outcome |
| --- | --- |
| Focused Jest: service/API/Guardian section/profile page | 4 suites / 71 tests PASS; native 0 |
| typecheck:changed | Runner invoked full TypeScript; zero diagnostics; native 0 |
| Focused ESLint on 8 changed source/test paths | Native 0; existing eslintignore deprecation warning |
| Final education:architecture | 1 suite / 4 tests PASS; native 0 |
| git diff --check | Native 0 |

No full Education/Healthcare aggregate was rerun; historical FAIL/HELD remains. The focused checks do not certify the whole product.

## SQL execution evidence

Initial strict rehearsal exited 1 at G1_REHEARSAL_BRANCH_DENIAL_CONTEXT_MISSING. Read-only baseline showed 7 active Preschool Admin identities, one authorized Admin–Student pair, no inaccessible-branch pair; Registry was absent. These failures remain in REHEARSAL_20261025.txt and REHEARSAL_REVIEWED_20261025.txt.

After the explicit prerequisite/fixture amendment, the strict combined rehearsal passed on the exact reviewed source:
Current PREREQUISITE_FIXTURE_REHEARSAL.sql SHA256 68742ACCCDD18FA777DBD0EF051571DEDB1847D61759081DB6E7B9CBF4F7920A.
Receipt: FINAL_STRICT_REHEARSAL_EVENT_PINNED_20261025.txt, native 0.
Prior 79C561... strict and C2D06F... recovery receipts are historical script epochs, preserved unchanged.

Executed assertions include canonical positive Guardian projection and count; wrong role, valid foreign-tenant Student, unknown Student and fixed synthetic inaccessible active branch denial; Registry exact positive Student and synthetic class denial; direct authenticated table-access preservation; all row-dependency zero-write fingerprint; exact fixture cleanup and affected-row fingerprint. All run within a repeatable-read transaction that rolls back.

The synthetic fixture comprises exactly one branch, Course, Party, Student, mapping and enrollment. The existing enrollment trigger produces its own test event. Cleanup is a single atomic DO statement that validates each identity, refuses replay and unowned FK/polymorphic references, includes both Student id and student_id targets, and checks the affected-row fingerprint. No fixture remains after rollback.

Technical construction/recovery rehearsal and exact Registry recovery also passed independently in rollback-only transactions. Earlier function hash 7213... and initial failure receipts are historical; the current G1 hash is 1b531ba582bd0f6f49867c66f1b7e088, Registry hash 8dd5106a6d5ee18e857ffddfefdcd706.

Original dependency fingerprint 95e1c2ae9139a9dfc195cfa7946cda8f was broadened after review to include both Enrollment event tables and all non-internal triggers/trigger function definitions. Current exact fingerprint is 9e2a86a83c73256f6ac9bd8572fdf0dd. This was a verification-coverage amendment, not a database security change. Exact E2E cluster fingerprint, postgres owner, dependency hash, function hash, search_path and authenticated-only grants are asserted in transaction. Same-name overloads are refused. No source check, fingerprint or SQL JWT simulation is described as Real Auth.

## Review disposition

Three independent reviewers identified and the candidate repaired: stale PII on both navigation boundaries, direct Product RPC, generated types/type escape, Student–Party ambiguity, target/drift/owner/config controls, non-isolated negative selection, canonical projection/read-only proof, UUID casing, snapshot labels, stalled fetch and cleanup safety.

Latest application-source reviews: PASS_BOUNDED / no source blockers. Blind reviewer retracted its token concern after verifying the existing getUser wrapper and installed PostgREST header behavior. Final SQL review: PASS_BOUNDED_SQL_SAFE_TO_APPLY_E2E. Independent acceptance review: no code defects, source/strict SQL/pre-apply recovery PASS_BOUNDED. Retained apply and independent readback subsequently executed successfully as recorded below.

Pinned schema disproved hypothetical multiple Course assignments, unbounded relationship rows and NULL pickup: UNIQUE tenant/course; UNIQUE tenant/source/target/type; NOT NULL + authorized/revoked CHECK. SQL explicitly rejects unknown/NULL pickup anyway. Same-status duplicate pickup history is not ambiguous in a status-only projection; conflicting states fail closed.

## Remaining actual evidence

Real Auth HTTP positive/denials and independently observed Browser/reload are not yet proven. Owner manually confirmed Guardian display and successful reload on the exact E2E URL after apply. Expiry exclusion, malformed contact/provider failure and boundary dates have focused source tests, but their real Auth runtime cases remain NOT_PROVEN. No claim of Go-Live.

Browser tool repeatedly reports Local browser use is disabled despite user saying it is enabled. A source-exact runtime copy was prepared under D:/Antigravity/Projects/BELLA SPA ERP/.audit-local-cache/g1-runtime-20261025. Its port 3016 login returns 200, uses only the E2E public key in process memory, and no environment files/service key. Source runtime initially failed across C→D junction (Turbopack and webpack); the same-drive copy resolves that environment issue. Server 3000 was not changed.

F1 remains dependent on G1 acceptance. H1 remains scope-decision only. PRESCHOOL_GO_LIVE = NOT_READY.

## Retained E2E change and final readback

- Exact current both-function recovery rehearsal: BOTH_RECOVERY_EVENT_PINNED_20261025.txt, script SHA256 9928A952FFB885D667F1C0C85DBBECD66297A74A780039A969FA284B0C4AC274, native0. It ran strict candidate/fixture cleanup then exact two-function recovery in a transaction that rolled back. Both functions absent and dependency fingerprint matched afterward.
- RETAINED_APPLY_20261025.txt: script SHA256 59E1FA94D9ACA5275E79888AD92A7BB851C36DF4CE9F5D61F333B37B781C4F75, native0; strict business checks, Registry caller projection and fixture cleanup passed before COMMIT.
- POST_APPLY_READBACK_20261025.txt: native0; exact two capability hashes/owner/volatility/grants matched; same-name overload absent; no fixture residue.
- POST_APPLY_FINGERPRINT_20261025.txt: native0, current dependency fingerprint9e2a... matched. Shared table ACL/RLS/policy/schema, event-table metadata and triggers unchanged.
- No later committed drop/reapply was performed. Recovery is proven by exact-current rollback rehearsal; Production recovery is not claimed.
- Application HTTP smoke on exact source runtime: login200; unauthenticated Guardian GET401; PATCH405 with Allow GET. Runtime cache header is no-store,must-revalidate from existing proxy; exact private,no-store preservation remains outside this package.
- Owner confirmed login using their E2E account and Guardian display/reload success on the supplied Student360 URL. This is human-reported manual Browser evidence. CUA continued to report disabled; no independent automated positive Auth/Browser request trace is claimed.
- The foreground development runner later ended with exit1 and no positive request trace available. A Hidden background runtime was restarted from the same exact candidate at port3016; login200 was reverified. Its PID/logs are in the ignored runtime directory. Main server3000 source/config was not modified.
- Failure provenance retained: initial missing branch context; first cleanup probe invalid OID-to-regclass formatting (native1, transaction rollback); ENOSPC while saving an otherwise passing receipt (owned G1 .next cache removed and source-bound rehearsal repeated); C→D dependency-junction bundler errors. None changed into PASS or hidden by source assertions.

Current handoff: G1 code and E2E read capabilities implemented, reviewed and SQL-verified; Owner manual UI/reload confirmed. Full independent real Auth/Browser coverage remains NOT_PROVEN. No commit/push/Production. Preschool Go-Live remains NOT_READY.

## Git publication preflight — 2026-10-25

Owner explicitly authorized commit and push of this G1 candidate. The evidence above describes the pre-publication execution epoch; publication does not certify Production or the remaining independent Real Auth/Browser cases.

The full staged diff check returned native 2 for a trailing blank line in PREREQUISITE_FIXTURE_REHEARSAL.sql, REHEARSAL.sql and G1_IMPLEMENTATION_SPEC.md. Earlier native-0 working-tree diff checks covered tracked files and did not include these then-untracked files. The exact executed/reviewed SQL bytes and their pinned hashes are retained; this staged whitespace result is not claimed as PASS. No runtime source or SQL was changed during publication preparation.
