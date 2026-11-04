# M013/M014 — Registry ID producer provenance

Read-only source/historical-catalog follow-up on base `f1299e3138f3700062a1ed84271db315737b0071`. No runtime, contract, control, DB or release change. Earlier sealed reports remain observations of their bounded searches; this note adds evidence found elsewhere in the same checkout.

## Exact mapping

`Registry.students[].id = public.students.student_id`; `Registry.students[].partyId = public.students.party_id` in the checked SQL producers. This is explicit SQL projection, not an inference from `id`, and is not `students.id`.

- `docs/audits/preschool-full-audit-20261020/registry-production-20261024/REGISTRY_PRODUCTION.sql:112`
- `docs/audits/preschool-full-audit-20261020/g1-guardian-read-e2e/RETAINED_APPLY_E2E.sql:216`

Both contain `jsonb_build_object('id',s.student_id,'tenantId',v_tenant,'partyId',s.party_id,...)`, joining `s.party_id=e.student_party_id` and the same tenant. The complete extracted `CREATE FUNCTION ... END $registry$;` texts are equal after CRLF→LF normalization: SHA-256 **b53840f3c877c3b7d298df8974c35498922ec3a9ed3e261e13263b8493b5736b**. Whole-file hashes and exact evidence locations are retained in `registry-id-provenance.json`. These SQL files are read as evidence only; none was executed.

The TypeScript contract exposes the separate `id` and `partyId` fields; its validator checks shape/UUIDs but does not independently establish their relational meaning. Course Detail's current M014 read selects `students.student_id` and returns it as `roster[].studentId`. The checked producer therefore projects the same **column identity** needed by M014. This closes the source-level producer-mapping uncertainty, not complete caller/response parity.

## Evidence levels

| Claim | Result | Evidence / limit |
| --- | --- | --- |
| Explicit Registry ID → legacy Student ID projection | PASS — SOURCE | Two equal SQL definitions at the lines above. |
| Link to saved target catalog | PASS — HISTORICAL FINGERPRINT COMPARISON | `platform-risk-20261027/catalog-primary.execution.json` records explicit project ref `lvnvkpyxtuilhrabtlwv`, exit 0; catalog observed at `2026-10-27T03:59:24.368624+00:00`, read-only `on`, records `definition_md5=8dd5106a6d5ee18e857ffddfefdcd706`. |
| Retained E2E definition fingerprint | PASS — HISTORICAL EVIDENCE | Retained SQL asserts the same `md5(pg_get_functiondef(...))`; `FINAL_READBACK.sql` pins it, and the saved `POST_APPLY_READBACK_20261025.txt` records E2E `bmnbqbcdbuklhopfbopv`, exit 0, exact capability readback true. The 27/10 E2E catalog also records that fingerprint. |
| Current installed definition on 01/11 | NOT_PROVEN | Current saved catalog is scoped to F05/F06 helpers; `catalog-readonly.sql:27–34` excludes Registry and related-RPC filters also exclude it. Omission is not proof of function absence. No fresh DB call was made. |
| Current Auth/JWT/RLS/Browser behavior | NOT_PROVEN | SQL source and saved metadata do not execute a present-day caller or show business rows. |

The normalized SQL SHA-256 above is a local text comparison. The PostgreSQL definition MD5 is a **recorded server fingerprint**, compared with saved assertions/catalogs; it was not recomputed on PostgreSQL in this batch. Historical metadata is not promoted to current Production proof or release authority.

The first one-off collector did not recognize the assertion block because `END` and its closing dollar tag are on separate lines. Its false comparison is retained in `registry-id-provenance-attempt1.json`. Correct dollar-tag extraction retains the same exact Registry signature and expected-hash checks; no SQL, guard or policy was changed to obtain the final comparison.

## Why M013/M014 remain held

The identified producer requires authenticated active Preschool `admin`, allowed canonical branch relationships and active canonical Courses; the current default Course Detail context validates Auth/profile/tenant and leaves actual access to its caller client/RLS. Adding Registry's explicit predicate is not established as an equivalent permission change.

The producer also requires exactly one Student per Party with `academic_status='enrolled'` and valid nondeleted Person identity; default Detail does not express all those predicates. Registry groups per Student, nests/sorts enrollment IDs and pages by Student ID, while Detail emits one flat row per enrollment without an explicit order. Registry branch/configuration/identity denial and error behavior differ from the default legacy Training Course read and its Map joins. These are source-level differences; their live reachability remains NOT_PROVEN.

**Disposition: identity projection SOURCE PASS; M013/M014 replacement HELD / BLOCK.** No SQL-to-helper move, contract expansion, new exception, approval request or API change. F13 remains **88 BLOCK**, historical debt **265**, approved tuples **7**, 24 Education SQL expressions still blocked. Existing scanner/test evidence is reused because only documentation/evidence changes; no unrelated regression was rerun. Prior source/evidence and old WIP are hash-checked in the receipt.

The next exact missing observation is the current installed Registry definition/overloads/ACL in the verified project. `registry-identity-readonly.sql` is prepared solely for catalog metadata, **NOT EXECUTED**. There is no direct Supabase/PostgreSQL connector exposed in this session; no CLI/browser access or credentials were assumed. Executing an approved read elsewhere must record the target independently; `current_database()='postgres'` alone does not identify the Supabase project.

Preschool **NOT_READY**; Real Auth/RLS, Browser E2E and Production remain **NOT_PROVEN**. No build, commit, push, merge, deployment, migration, DML, business RPC or database probe execution.
