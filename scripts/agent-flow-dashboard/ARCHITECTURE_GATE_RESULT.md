# Development Evidence Dashboard — Architecture Gate

2026-10-15. PASS for the user-approved minimal dashboard batch only.

## Process / manifest
Truth: retained, sealed development evidence; not a live stream. Source: existing task package manifest, seal, facts, independent reader and runtime review artifacts. This consumer must distinguish current byte integrity from historical runtime conclusions. Platform development tooling owns telemetry; no Product is registered. Business semantics are outside this batch.

## Ownership / dependency / change authority
Read-only filesystem consumer -> existing sealed task evidence contract. Server authorization -> GitHub identity -> existing BDGF dev permission policy. No tenant administration permission is substituted. Prior worktrees, source and sealed evidence stay untouched. Changes confined to scripts/agent-flow-dashboard: gate, evidence reader, server, static HTML/CSS/JS, tests and README. No schema, migration, DB, CI/CD, kernel, ProductRegistry, deployment, commit, push or PR. Separate worktree based on 49f78e358817bb3991f699cc678204a3bd5ea8f9.

## UI -> contract reconciliation
Package selection -> sealed task package IDs only. Timeline -> persisted live/history metadata with received/source timestamps separately. RED/GREEN -> retained test counters and item IDs. Review -> historical seal claims, separately labeled. Integrity -> manifest artifact hashes checked on each read. No prompt, reasoning, command arguments, source content or stdout/stderr is projected. No run/deploy controls, simulated live data or reconstructed events. Runtime authenticity is not established by SHA-256 alone.

## Security / retention / migration
Loopback-only local server; short-lived browser session bootstrapped using an in-memory capability and HttpOnly SameSite cookie, strict Host/Origin checks. Backend checks real GitHub actor and existing BDGF authority for API reads. No credentials persisted. Safe fixed package IDs and bounded, non-symlink file reads. Allowlisted DTO only. Expired packages expose status only; deadline is earliest approved deadline, metadata<=14d, output<=7d. Reader never purges or writes existing packages. No additive migration required. On-demand process only, no installed service.

## Eleven verification gates
1. Git baseline/isolation. 2. Existing authority reuse and denial tests. 3. Capability/Origin/Host/session boundary. 4. Path/symlink and size limits. 5. Manifest corruption/missing handling. 6. Expiry denied content. 7. Allowlist projection without payloads. 8. Actual sealed package read and source/hash validation. 9. Desktop/mobile browser proof and no console errors. 10. Syntax/lint/architecture/diff checks. 11. Independent code/security and acceptance review with retained scoped evidence.

Completion is NOT_PROVEN until executable checks and real browser evidence support it. Prior seals remain historical, independently scoped; production readiness remains NOT_PROVEN.

## APPROVED_FOR_BOUNDED_DASHBOARD_READER_FIX — 2026-10-15
PASS for design/change authority before code. Reuse this dashboard in a fresh worktree at merged0d14935bb. Root cause: legacy-only manifest/seal assumptions misclassify launcher-v2 retained evidence. Owner: Platform development tooling; dependency: read-only package adapters -> existing canonical contract validation (repository source only, never import artifacts) -> same allowlisted DTO/UI. Lead-only execution. Allowed files: evidence.mjs, dashboard.test.mjs, browser-proof.mjs, README.md and this gate. Server/auth/UI assets and runtime launcher/store remain byte-identical. Normalize known legacy and bounded-coding package shapes; validate metadata deadline, all artifact hashes, binding, canonical digest/key/retention, exact ACK and reconciliation before AVAILABLE. Preserve UNSUPPORTED/EXPIRED/FAILED/CORRUPT distinctions, no fail promoted to PASS. No migration, database, kernel, auth policy, CI, agent run, source package mutation, commit/push/merge/deploy. Existing11 checks adapted: regression legacy+new+semantic tampering+classification; real retained old/new desktop/mobile reads; hashes before/after; syntax/lint/Architecture Guard/diff; single-agent changed-hunk boundary review. No realtime claim or new gate framework.

## Final bounded batch result
PASS in approved dashboard-reader scope. Legacy F3oiu6 and launcher-v2 mbTMET are both read from retained real evidence; mbTMET26/26 hashes unchanged. XvTmtM remains FAILED, R0fOzS UNSUPPORTED; expired/semantic corruption covered by tests.22/22 Node tests, real GitHub-authorized desktop/mobile browser proof, syntax/lint/Architecture Guard and tracked/untracked diff checks required before seal. Lead performed changed-hunk boundary review; no independent reviewer or fresh runtime execution claimed. Server/auth/static UI bytes and original dashboard worktree/package seals are preserved. No launcher/store/schema/CI/deployment changes. This PASS does not authorize release or prove realtime.
# Historical viewer gate — imported baseline

This retained document describes the earlier local viewer, not the current branch's
acceptance or a main merge. Current authority and phase evidence are recorded in
`docs/audits/factory-evidence-flow/ARCHITECTURE_GATE_RESULT.md`.
