# Bella Development Evidence Dashboard

## Factory integration candidate, 2026-10-20

Current implementation authority: `docs/audits/factory-evidence-flow/ARCHITECTURE_GATE_RESULT.md`.
From the approved isolated checkout run `node scripts/agent-flow-dashboard/server.mjs --open`.
The viewer retains the existing access/session policy and layout. It also discovers
new Factory companion indexes and historical pipeline/controller JSON sources.
New Factory runs validate native receipts, canonical facts, ACKs, test output and
candidate linkage. Historical unindexed records remain PARTIAL, retain the original
outcome, and have no invented factoryRunId. Controller VERIFY readback is displayed
as READBACK_ONLY. AVAILABLE describes accessible validated evidence, including HELD;
it is not a Factory, merge or Go-Live verdict. No data is rewritten or purged.
Tests: `node --test scripts/agent-flow-dashboard/dashboard.test.mjs scripts/agent-flow-dashboard/factory-reader.test.mjs`.

For the approved AutoMove existing-flow pilot, the reader validates the original
no-change Builder receipt as `SOURCE_ASSESSMENT`, together with unchanged full
source manifests. This is execution evidence without a Product code change or a
commit claim. Original indexes, receipts and retention deadlines remain unchanged.

The CLI accepts an optional absolute evidence root; the default remains
`%USERPROFILE%\.codex\agent-flow-evidence`. For the pilot package retained on D:

```powershell
node scripts/agent-flow-dashboard/server.mjs --root 'D:\Bella-AutoMove-Pilot-Temporary' --open
node scripts/agent-flow-dashboard/factory-browser-proof.mjs 'D:\Bella-AutoMove-Pilot-Temporary\monitor-proof-new' bella-agent-flow-XA3GLC PASS 'D:\Bella-AutoMove-Pilot-Temporary'
```

The browser proof uses the existing GitHub authority, checks the same retained run,
desktop/mobile layout, refresh/reload, anonymous denial and read-only methods.
It does not dispatch Factory stages, access the business DB, or create commit proof.

The sections below document the original viewer baseline and historical proof.

Local, read-only viewer for retained sealed **legacy task-workflow and launcher-v2 bounded-coding** packages. Not realtime. Not the Bella tenant dashboard. No agent launcher, persistence writer, production or deployment control.

```powershell
cd 'C:\Users\DELL\.codex\worktrees\bella-dashboard-reader-fix\BELLA SPA ERP'
node scripts/agent-flow-dashboard/server.mjs --open
```

Requires Node and an authenticated `gh` actor with existing BDGF development admin permission on `bellaspahcm/bella-ai-platform`. Server verifies identity/permission before listening and on every API read. It binds only `127.0.0.1` with an OS-selected port and opens a browser using a one-use in-memory capability (5-minute bootstrap deadline). The HttpOnly SameSite session lasts at most one hour from server startup. Restart with `--open` to open a fresh session; Ctrl+C stops the process. No permanent service is installed. No auth token is printed, persisted or included in artifacts. The local capability protects browser access; GitHub remains the backend authority.

Source: direct task-package children of `%USERPROFILE%\.codex\agent-flow-evidence`. Prior packages are not modified or deleted. Sealed packages are listed with explicit AVAILABLE, UNSUPPORTED, EXPIRED, FAILED or CORRUPT state (missing artifacts use MISSING). Unsealed trial directories are excluded. FAILED is a retained failure claim after artifact integrity checks; it does not expose a timeline or imply valid successful evidence. Unknown shapes are UNSUPPORTED, not automatically corrupt. Expired packages expose only expiration status; no content after the original deadline. Existing package cleanup policy remains the owner's responsibility; the dashboard is read-only, not a purge service.

Current integrity is computed from every artifact hash/size in the manifest. This checks package consistency, not cryptographic source authenticity. Reviews and RED/GREEN results are **retained historical evidence**, not a fresh execution. No source code, prompts, reasoning, raw command arguments, stdout or stderr is returned by the API. Only allowlisted lifecycle metadata is rendered with textContent. Recorded baseline is the historical source revision, not a deployed commit; current source-worktree drift is not verified by this viewer.

Tests:
```powershell
node --test scripts/agent-flow-dashboard/dashboard.test.mjs
$env:NODE_PATH = 'D:/Antigravity/Projects/BELLA SPA ERP/node_modules'
node scripts/agent-flow-dashboard/browser-proof.mjs 'C:/Users/DELL/.codex/dashboard-evidence/REPLACE_WITH_NEW_PROOF_DIRECTORY'
```

Browser proof uses the real GitHub authority and the retained F3oiu6 and mbTMET task packages, plus XvTmtM failure and R0fOzS unsupported cases; test fixtures only exist in unit tests. Output includes screenshots and numeric verification, never session capability or cookies. Keep proof artifacts private and delete by the source package deadline (7 days maximum). A passed dashboard proof does not grant production readiness, full notification replay, multi-agent orchestration or deployment authorization.

## Bounded reader compatibility fix
Baseline0d14935bb058852e42af2c36fdab67420c18adf3. The existing static UI, HTTP server and authority remain unchanged. The reader imports only the repository's canonical contract functions, never executable evidence artifacts. It recognizes legacy manifest/seal references and launcher-v2 bounded-coding context/writer/reader/seal fields without rewriting either package. It verifies binding and revision provenance, original package deadline, all manifest artifact hashes, canonical record key/digest/retention, ordered exact ACK linkage, lifecycle RED/GREEN, recomputed reconciliation compared with the saved reader, and bounded fileChange identity/scope/order before AVAILABLE. Counters must be complete and sum correctly. Review results and native-history matching remain historical claims; this reader does not query AppServer or execute tests/agents from evidence. A failed sealed run remains FAILED even if writer.json claims success.

The mbTMET manifest SHA-256 remains f48ec67757d596d1329c44b631a4cbb7b2a80a02cd6abd186dbbf2e348b08912 (26 artifacts), deadline2026-10-22T07:32:53.972Z. Legacy F3oiu6 remains b38b1f271b14f71b16ff69fb2958f47841ac65c782b2251d836a2ff28f95ddb5 (23 artifacts), deadline2026-10-22T05:42:34.307Z. Proof artifacts combining these packages must expire by the earlier deadline. No retention extension is implied. No new database, collector, launcher change, agent run, dashboard redesign, realtime integration or production deployment is included.
