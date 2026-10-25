# G1 Guardian read-only E2E package

E2E bmnbqbcdbuklhopfbopv only. Owner approved the G1 read RPC and, on 2026-10-25, existing Registry prerequisite plus one synthetic branch-denial fixture/cleanup. No Production/shared ACL/RLS/Auth-account changes.

- RETAINED_APPLY_E2E.sql: reviewed strict combined transaction; retains exactly two read RPCs after test/fixture cleanup. Executed after final SQL review; native0, fixture cleaned before COMMIT.
- RECOVER_BOTH_E2E.sql: exact-hash bounded recovery for both retained RPCs.
- PREREQUISITE_FIXTURE_REHEARSAL.sql: same business candidate/fixture checks; always rollback.
- FINAL_STRICT_REHEARSAL_EVENT_PINNED_20261025.txt: current SQL hash and native0 receipt; older receipt epochs remain historical.
- FIXTURE_INSERT.sql / FIXTURE_CLEANUP.sql: transaction include blocks, exact synthetic rows only; cleanup is one atomic DO with external-reference guards.
- REGISTRY_PREREQUISITE_E2E.sql / REGISTRY_RECOVERY_E2E.sql: existing Registry function-only capability and exact recovery.
- REGISTRY_RECOVERY_REHEARSAL.sql / DEFINITION_RECOVERY_REHEARSAL.sql: rollback-only technical checks; historical receipts bind only their recorded script epoch.
- APPLY_E2E.sql / REHEARSAL.sql / RECOVERY.sql: G1-only artifacts; standalone strict rehearsal on baseline without approved fixture remains historical native1.
- FINGERPRINTS.sql: read-only pinned dependency hash; same target/hash checks mandatory in execution transactions.
- RESULT.md: actual source/SQL status, historical failures and runtime gaps.

No artifact is a Production migration. No table grant/policy/role/schema/default privilege change. SQL caller simulation is not Real Auth. Do not claim Browser/Go-Live from focused or SQL checks.

- BOTH_RECOVERY_EVENT_PINNED_20261025.txt: current exact two-function recovery rehearsal0.
- RETAINED_APPLY_20261025.txt / POST_APPLY_READBACK_20261025.txt / POST_APPLY_FINGERPRINT_20261025.txt: actual retained change and fresh independent readback0.
- SQL_HASHES_REVIEWED.json and SOURCE_RUNTIME_PINS.json: settled SQL and exact source/runtime pinning.

Retained E2E capability PASS_BOUNDED; Owner manual UI/reload confirmed. Independent real Auth/Browser proof remains NOT_PROVEN. No Production or commit/push.
