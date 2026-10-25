# Preschool — Production rollout preparation, 2026-10-24

**PREPARED_PARTIAL / PRODUCTION_EXECUTION_HELD.** This packet prepares the next release step. It does not approve or execute Production changes. E2E acceptance remains `PASS_BOUNDED_E2E`; `PRESCHOOL_GO_LIVE=NOT_READY`.

## Fresh evidence and the minimum delta

Read-only metadata reconfirmed Production `lvnvkpyxtuilhrabtlwv`, name `bellaspahcm's Project`, host `db.lvnvkpyxtuilhrabtlwv.supabase.co`, `ACTIVE_HEALTHY`, at01:28 UTC. All database requests used `read_only:true` and explicit `BEGIN READ ONLY`/ROLLBACK. No business rows, account lists, keys or dumps were exported. Metadata SHA256: `37b0b834d293c2b981df57340f3cbbe35bbbbbc8f4f4e43f7a5606057fbbe399`.

Production is missing the Course–branch binding table and school bulletin table. The prepared capability inventory contains the13 accepted MVP function signatures:12 missing functions and one existing Attendance function requiring exact baseline review/replacement. The new binding table's accepted SELECT policy also depends on two existing E2E branch predicates absent on Production: `preschool_branch_access(uuid,uuid,uuid,text)` and `preschool_course_assignment_visible(uuid,uuid,uuid)`. Both are listed explicitly in the15-signature draft. They were unchanged dependencies during E2E; creating them on Production is proposed scope, not previously granted Production authority. No helper is silently assumed present or replaced by an improvised access path.

The existing Production Attendance signature is unchanged, but its body MD5 is `0bd77a772ef098df2f09ba02bd58ec5e`; the accepted E2E body is `5e47d73d163c5fdf3cc0fcba4cea91c2`. A matching signature does not prove equivalent authorization. Existing EXECUTE ACLs and custom verification/migration-role privileges must be preserved or explicitly reconciled; do not reset the shared ACL to E2E defaults.

The security module proposes anonymous/PUBLIC direct-grant containment on nine existing relations and authenticated TRUNCATE removal on ten, exactly listed in the manifest. This is outside the earlier32-relation Production authorization. Current catalog additionally retains the unconditional public `tenant_isolation_students USING(true)` alongside another permissive policy; a permissive tenant policy cannot negate that OR path. This is catalog evidence, not a real-user business-data exposure probe. No destructive privilege probe was run.

**The existing-table scoped RLS/column-ACL module is intentionally not implemented.** Production policies differ materially from the accepted E2E profile. That module must close the Student bypass, enforce the accepted Preschool role/tenant/branch/nonhealth boundaries, enable required caller reads, and preserve legitimate non-Preschool/HQ access. Blindly copying E2E grants or adding its permissive policies would not satisfy those conditions. Exact target reconciliation, independent review and rehearsal remain required before a complete execution package can exist.

E2E has extra legacy Student identity/contact/finance columns and a different primary key. All six Student columns required by the inspected active MVP paths exist on Production: `tenant_id`, `party_id`, `student_id`, `student_code`, `academic_status`, `enrollment_date`. Do not add the legacy columns, change the Student primary key, relax NOT NULL or copy legacy Course FKs merely to resemble E2E. This is a bounded static dependency finding, not Production runtime acceptance.

The E2E audit index, Timeline tenant FK and Enrollment event worker schema are excluded from this packet. Production does not have the same Enrollment event trigger dependency; no T2/event producer is proposed. Missing dependency resources are not provisioned automatically.

## Source and publication

Vercel's fresh READY Production deployment inventory identifies source `bb7007e7632c3bf7d88f760fc8239a0720d2d327`, deployment `dpl_3gDwjToSwdUvtBtqeaxppgRNfbMt`, URL `bella-spa-dy03uomq4-bella-spa-s-projects.vercel.app`. Direct deployment inspection confirms READY and targetProduction. Separate inspection of `bella-spa-erp.vercel.app` resolves to that same deployment/URL; matching the deployment-list URL binds its recorded source commit. This proves the observed alias target at inspection time, not application correctness. Evidence is retained in `PRODUCTION_ALIAS_READONLY_20261024.json`.

Since the accepted integration base `80e13ea92ee70742d26cd890a45aaa94d8fc7494`,56 paths changed. None overlaps the119 selected Preschool paths. Preserve the newer Auto/CI/governance changes rather than deploying the old whole branch. `SOURCE_SELECTION.json` pins the exact119 file bytes. Integration/build/affected regression on the new combined source epoch is **NOT_RUN**; zero path overlap does not certify that new combined build.

The original accepted3,324 source/control paths still have zero drift. The E2E build ID `fUdaRHs7DypX3PUAjLJK2` is not a Production deployment artifact and is not relabelled as one.

## Backup, rollback and live inputs

Fresh native0 `supabase backups list --project-ref lvnvkpyxtuilhrabtlwv --output json` returned `backups=null`, empty physical-backup metadata and `pitr_enabled=false`; `walg_enabled=true` alone does not establish a restorable point. **BACKUP_RESTORE=NOT_PROVEN.** No export, restore, new resource, billing change or backup plan upgrade was performed. The older backup/budget hold is not considered resolved by Docker availability or this metadata read.

Before any export or restore, the Owner must select the backup approach, approve protected storage and an isolated compatible restore destination, and set acceptable RPO/RTO. Restore evidence must bind an actual protected restore point to a successful isolated restoration, schema/ACL/RLS and critical-data checks. Do not place business dumps or credentials in this repository or restore over Production/E2E used by other workstreams.

Owner-confirmed live inputs are still absent:

- Exact tenant/Course → active branch UUID mappings, plus intended active operating users and their canonical persisted branch relationships.
- Existing Student Party/guardian readiness for the first operational cohort, without creating or guessing identities.
- Owner/observer, release window and rollback/stop-traffic decision maker. Monitoring checkpoints remain before traffic, immediately after, +15minutes and +60minutes.

No names or sample IDs have been filled in. Operational rollback must preserve new business records and security containment, close affected workflows and select a rehearsed compatible application artifact. Do not restore anonymous grants/public-true policies, drop occupied new tables, or assume the old app works with new permissions. DDL transaction reversal, E2E disposal and a READY old deployment are not a complete Production rollback/restore demonstration.

## Reviewable artifacts and execution boundary

- `PRODUCTION_BASELINE_READONLY.sql`: exact fresh catalog assertion; read-only and rollback. It is not full dependency/runtime verification.
- `PRODUCTION_CAPABILITIES_DRAFT.sql`: proposed two tables,15 function signatures including two explicit branch dependencies, and the accepted new binding-table SELECT policy.
- `PRODUCTION_CONTAINMENT_DRAFT.sql`: proposed bounded anonymous/PUBLIC and authenticated TRUNCATE revokes; all other non-anonymous grants require preservation.
- `FUNCTION_INVENTORY.json`, `SOURCE_SELECTION.json`, `PRODUCTION_PACKAGE_MANIFEST.json`: exact target, before/after function hashes, proposed scope, source selection and held modules.
- `OPERATING_MAPPING.template.csv`: header-only input format for exact Owner-confirmed Course/branch/operating identity relationships; no sample values or business rows.

Both DDL drafts contain an **unconditional exception before any DDL**, terminate with ROLLBACK, and have no apply runner. They are intentionally incomplete and cannot be treated as a migration or a request for immediate execution approval. Do not remove the hold merely because a general approval arrives. First complete the missing security/source/rehearsal/restore conditions and independently review an exact final package; then obtain the separate Production/publication decision required by the Constitution and deployment framework.

Preparation verification: collector native0; all database reads used read-only transactions; Vercel/backup metadata commands native0; the separately executed `PRODUCTION_BASELINE_READONLY.sql` assertion also returned native0/readOnly=on at01:35:54 UTC. Neither DDL draft was executed, even under rollback. The original name-check failure is preserved as a collector assumption failure before catalog reads, not Production identity drift. Generator is offline. No runtime, Kernel, guard, role membership, default ACL or deployed state changed. Current evidence is under ignored `.audit-local-cache/preschool-release-integration-20261023/production-preflight-2026-10-24T01-28-16-866Z/` and the named `PRODUCTION_*_20261024.json` receipts. Preserve the preflight receipt and its exact directory name as recorded in `PRODUCTION_PREFLIGHT_LATEST.json`; times/file paths are not substitute authority.

| Gate | Current result |
| --- | --- |
| Existing MVP E2E / independent acceptance review | PASS_BOUNDED |
| Fresh Production target/catalog and candidate hash check | PASS_BOUNDED_READONLY |
| Selected-source overlap with observed new Production revision | Zero overlap; new integrated runtime NOT_PROVEN |
| Production-specific final SQL / target rehearsal / authenticated regression | NOT_PROVEN |
| Current broader anonymous runtime verification | NOT_PROVEN |
| Production backup/restore and compatible rollback | NOT_PROVEN |
| Live mapping/operating-identity confirmation | NOT_PROVEN |
| Production execution / publication authority | NOT_GRANTED |
| PRODUCTION_CHANGE / commit / push / merge / deploy | NOT_RUN |
| BATCH2B_RBAC_RLS | IN_PROGRESS |
| Education/Healthcare aggregate and full Kernel reseal | Existing FAIL/HELD retained |
| PRESCHOOL_GO_LIVE | NOT_READY |

The next implementation is one bounded Production-baseline rehearsal/source integration package. The sensitive inputs are backup/restore authority and real operational mapping; the earlier RouteB/MVP/E2E decisions do not need to be repeated.
