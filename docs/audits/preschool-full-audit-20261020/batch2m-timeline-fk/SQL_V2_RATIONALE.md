# Bounded RLS query repair

Actual real Auth attendance embed returned HTTP500/PostgreSQL57014, `STATEMENT_TIMEOUT`, in `care-rls-results-2026-10-21T01-31-55-524Z.json`. The same schema embed with privileged LIMIT0 previously passed. This proves the user path times out; the specific contribution from repeated policy expansion must be assessed by the next real run.

V1 copied the full transitive scope predicate into both permissive and restrictive SELECT policies for Course, Enrollment and Party. Every embedding and nested policy expands those subqueries repeatedly. V2 changes only the permissive predicate on those three approved relations to their existing actor predicate; the restrictive predicate remains byte-identical and contains that actor predicate plus every original tenant/role/product/branch/course/enrollment condition. All grants, columns, new-table policies, dependencies, helper/schema/default ACL/roles and timeouts remain unchanged.

Equivalence for authenticated SELECT: let A be the actor predicate, S the complete restrictive scope (S implies A), and L the original legacy permissive expression. V1 is `(L OR S) AND S = S`; V2 is `(L OR A) AND S = S`. Anonymous privileges stay absent, and service-role ACLs are unchanged. This is a technical repair within the approved six relations, not a new matrix or broadened authority.

Original SQL and raw FAIL artifacts remain immutable. New V2 bytes are independently reviewed and hash-pinned; preflight still references the same canonical source hashes. No timeout is raised and no helper or privileged runtime reader is introduced. Retention still requires the real functional/denial/cleanup gates PASS.
