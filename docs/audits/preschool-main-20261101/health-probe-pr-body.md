Restore the existing Production health probe through one explicitly scoped migration path. The ordinary release runner currently blocks on unrelated historical ledger drift, so it remains unchanged and continues to report that drift.

This adds a manually dispatched Production-environment job and executor for the already reviewed health SQL only. It pins project, main SHA and artifact hash; verifies database-owner identity and privileges; serializes ledger access; rejects pre-existing target state; verifies the function and ACL; and commits only the real health version with the function in the same transaction. A lost COMMIT response requires inspection, not an automatic retry. No other migration or ledger entry is changed.

Validation: native PostgreSQL 17 isolated rehearsal PASS for exact SQL, ACL, concurrency, wrong principal, inherited/default grants and failure rollback; 8 focused Jest tests PASS; ESLint and workflow shell syntax PASS. Three scoped independent reviews completed, with findings addressed. These checks do not prove Production execution, PostgREST reload or the complete Preschool flow.

Existing Production deployment workflow, full-ledger guard and reviewed SQL artifact remain unchanged. Health and application smoke must be verified before any Promote; historical ledger drift remains unresolved.

