# Agent Flow MVP — scoped development tooling gate

Result: PASS for the tooling scope below, 2026-10-18. This is not a Product readiness gate.

## Development process / truth

Owner's latest instruction is the authority: Intake → Lead → Builder → Verify → independent Reviewer; one REVISE cycle, then HELD on further rejection, uncertainty, missing evidence, exhausted time or stopped runtime. No silent redispatch/resume. Evidence must come from real native execution and the final candidate. Existing AppServer, repository authority, canonical lifecycle normalization and DevelopmentStore remain unchanged.

## Manifest and ownership

Development tooling, not a new OS/Product or permission engine. Lead owns intake/scope; Builder alone owns task files; Verify executes actual tests; fresh Reviewer reads actual candidate diff/test evidence. The driver owns fingerprints, bounded sequencing and receipts. Native App Server owns thread/turn/item history; existing store owns canonical facts.

## Dependencies / boundary

Role driver → existing AppServer → native thread/turn history; collector → existing contract → DevelopmentStore. Companion receipts bind role, candidate, commands/output hashes and review to the canonical binding; they are collector artifacts, not invented native events. No Product → DB path is added.

## Change authority / exact allowlist

Implementation: `scripts/agent-flow/role-pipeline.mjs`, `scripts/agent-flow/role-pipeline.test.mjs`, `scripts/agent-flow/role-native.mjs`, `scripts/agent-flow/README.md`, `src/__tests__/agent-flow-tooling.test.ts`; evidence under this directory. A separately admitted new task may modify only its explicitly listed tooling files, recorded before dispatch. It cannot modify the running driver, collector, authority, store, constitution, CI workflows or Product code. Protected files and source inventory are checked between roles; violations stop HELD. Sandbox restrictions and observed scope checks are distinct claims.

## UI reconciliation

N/A. No UI, dashboard or product action changes. No Preschool batch, endpoint reopening or readiness upgrade.

## Migration plan

None. No DB/Auth/RLS, fixtures, schema/baseline loads, migrations, network-policy changes, merge, release or deploy. GitHub read-only authority check remains the existing mechanism. Normal branch/commit/draft PR permitted by Owner; no automatic merge.

## Verification plan (11 gates)

1. Owner authority and strict task admission. 2. Existing repository actor verification. 3. Exact source/HEAD fingerprint. 4. One Builder writer, read-only other roles. 5. Native actual fileChange plus observed source changes. 6. Exact real test commands, complete non-skipped counters and exits. 7. Fresh independent review of diff/output, no Builder conversation. 8. At most one revision with new Verify/Reviewer. 9. Negative tests for stale candidates, ambiguous results, forbidden paths, time limits and duplicate dispatch. 10. Native history/store reconciliation and fresh-process readback. 11. Final diff/syntax/scoped regression review and immutable handoff; Product gates unchanged.

Tests of state transitions are fixture evidence. They do not substitute for a real role task or prove a live REVISE loop. Runtime proof will be reported separately, including any missing link.
