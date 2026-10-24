# Batch 1 — Environment and deployed authorization evidence

Requested scope: read-only follow-up to the existing audit, not a new audit and not remediation execution. Preserve all prior audit evidence.

Source branch: `codex/preschool-full-audit-20261020`, HEAD `339c89250d87964ba8d58860a5ecdbc0bdde4956`.

Authorized work: identify the previously probed endpoint and its production relationship; inspect deployed catalog/grants/RLS through an existing authorized administrative read channel; attribute anonymous access; prepare minimal migration/rollback/verification plan for approval. No business mutations, policy/grant/schema changes, token issuance, deployment or credential reset. Single-agent execution.

Existing rules/skills reused: Bella Architecture & Change Constitution, Deployment Governance, `bella-security-reliability`, `bella-qa-testing`. SQL is restricted to catalog SELECTs inside an explicit READ ONLY transaction; admin privileges are not evidence of anonymous/RLS correctness. No credentials or raw deployment env values may be saved.

Batch 1 closes only when endpoint identity, catalog evidence, root access mechanism and a concrete minimal remediation plan are established and ready for owner approval. Approval is a separate state; no DDL is executed here. Preserve FAIL/NOT_PROVEN/BLOCKED for gates not resolved by this scope.
