# Independent review and triage

Three fresh, no-history reviewers examined the six-file preparation diff before committed execution. They did not use credentials, network, DB, server or test tools. SQL also received an earlier independent schema/security review.

| Finding | Classification | Resolution |
|---|---|---|
| Effective service privileges could change through PUBLIC even if direct service ACL stays equal | patch | SQL asserts effective table/column privileges including PG17 MAINTAIN before/after revocation; no service grant added |
| SQL manifest/hash was recorded but not compared to the reviewed candidate | patch | Hardcoded approved SQL SHA256 compared before environment loading or connection; changed-SQL CLI rejection executed with native exit1 |
| Privileged DB connection disabled certificate verification | patch | Reuse existing `scripts/bdgf/database-connection.mjs`; trusted vendor CA plus hostname verification; pin vendor fingerprint; helper included in source guard |
| Slow row cleanup could consume the authority-revocation window | patch | Deactivate fixture profiles and terminate own tenant authority before best-effort row deletion |
| Retention checked owned-tenant rows but could miss unrelated rows in new tables | patch | Lock new tables, require total row counts zero and exact prepared metadata before retaining; never delete unaccounted data |
| Evidence write failure changed exit code but could print a successful result | patch | Set aggregate/functional result FAIL and sanitized REPORT_WRITE_FAILED; native exit1 |

Acceptance and edge reviewers reread the relevant hardening and reported no remaining confirmed actionable defect. Acceptance reviewed the final TLS-helper and evidence-write delta separately. Actual runtime proof is exclusively in the execution reports, not inferred from review.

The aggregate retains the known local literal-private header `NOT_PROVEN` separately from functional acceptance. The approved scope request explicitly permits retention only when functional, denial and cleanup gates PASS with this one known exception. A separate `functionalAcceptance` field makes that distinction explicit.

Source-only review does not establish Production change, Browser E2E, full regression or Go-Live.

Post-execution acceptance review cross-checked raw reports and final status: full14/2/2 exit1; metadata4/0/1 exit0; both exact baseline restored; Party4 residues with authority0 remain FAIL. No confirmed evidence inconsistency. The metadata-only and sanitized REST error-code deltas received bounded review; no claim that they clear the full-run failure.
