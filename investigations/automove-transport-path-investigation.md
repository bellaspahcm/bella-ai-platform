# Investigation: AutoMove transport and environment path comparison

## Hand-off Brief

1. **What happened.** AutoMove pilot transport probes were held before dispatch because the current shell had no policy proxy endpoint; a prior AutoMove RC workflow is reported to have passed browser E2E, so the execution-path difference is not yet established.
2. **Where the case stands.** Active, evidence-light at the code-path comparison stage; prior RC success is a stronghold from historical evidence, while the cause of current transport unavailability remains open.
3. **What's needed next.** Compare the successful RC workflow's checkout, env loading, identity/client, and execution route against the pilot launcher and its configured permission profile.

## Case Info

| Field            | Value |
| ---------------- | ----- |
| Ticket           | N/A |
| Date opened      | 2026-10-22 |
| Status           | Active |
| System           | Windows; Bella main checkout `D:\Antigravity\Projects\BELLA SPA ERP`; AutoMove candidate worktree under `C:\Users\DELL\.codex\worktrees` |
| Evidence sources | Prior AutoMove RC CI summary; AutoMove pilot scratch receipts; main checkout and candidate worktree file inventory; `.env.e2e` metadata (secret values not read) |

## Problem Statement

The AutoMove pilot could not start Chromium, Next child, or PostgreSQL probes because the current shell had no visible proxy environment/listener and the AutoMove worktrees contained only `.env.example`. The user points out that earlier Factory flows succeeded and asks to compare their actual checkout, env-loading step, DB account/client, and execution path before deciding the cause.

## Evidence Inventory

| Source | Status | Notes |
| ------ | ------ | ----- |
| Prior AutoMove RC business-chain evidence | Available (historical, memory-derived) | Reported exact-SHA browser E2E success on candidate `e64a1aaf...`; must revalidate current workflow source and, if needed, historical artifacts. |
| AutoMove attempt-1 transport result | Available | `C:\Users\DELL\.codex\scratch\automove-mvp-attempt2-proposal-20261022-6d772d60\TRANSPORT_PREFLIGHT_ATTEMPT1_RESULT.md`; records pre-dispatch absence of profile-bound proxy. |
| AutoMove pilot and tooling worktrees | Available | Candidate worktree and proposal worktree were found; proposal run remains separate from old held candidate. |
| Main-checkout env-file names | Available | `.env.e2e`, `.env.test`, `.env.staging`, `.env.production*`, `.env.local`; actual values were not emitted. `.env.e2e` exposes AutoMove API host and Supabase pooler hostname in sanitized metadata; includes a service-role variable name. This alone does not establish Non-Production status or safe credential use. |
| Successful RC workflow source and execution code | Partial | Known from historical summary as `.github/workflows/automove-rc-business-chain.yml` and `scripts/run-automove-rc-business-chain.ts`; direct source comparison pending. |
| Live network policy endpoint for current shell | Missing | No proxy-related vars or loopback listener in the prior local preflight; no network request attempted. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --------------- | -------- | ------ | ----- |
| 1 | Compare successful RC workflow env setup, browser launch, DB client/auth, and checkout with pilot launcher | High | Open | Use source and run metadata; do not inspect/print secrets. |
| 2 | Verify whether `.env.e2e` is explicitly Non-Production and whether the successful flow uses service-role | High | Open | Hostname/name alone are insufficient. |
| 3 | Identify the current pilot execution API and permission-profile binding | High | Open | Do not send network or DB requests in this case step. |
| 4 | State the proven difference and minimal next diagnostic, if any | High | Open | No code or policy changes are authorized by this investigation. |

## Timeline of Events

| Time | Event | Source | Confidence |
| ----- | ----- | ------ | ---------- |
| 2026-10-19 | Prior AutoMove RC business chain reportedly passed browser/business E2E on exact SHA `e64a1aaf8645ca1f1a5b62fc0e341ffe803ab50a`; production mutation was not performed. | Historical rollout summary and CI reference | Confirmed as historical record; source revalidation pending |
| 2026-10-22 | Pilot diagnostic observed proxy/policy denial for a native command; allowed API health returned HTTP 401; raw receipts remained partially unverified. | Prior pilot records | Confirmed within the stated command route only |
| 2026-10-22 | Transport preflight stopped before dispatch; no HTTP request, Browser navigation, or DB query was sent. | `TRANSPORT_PREFLIGHT_ATTEMPT1_RESULT.md` | Confirmed |
| 2026-10-22 | Main checkout contains `.env.e2e`; AutoMove worktrees contain `.env.example`; safe metadata shows AutoMove API host and Supabase pooler host. | Read-only filename and sanitized metadata inspection | Confirmed; environment classification remains open |

## Confirmed Findings

### Finding 1: Prior AutoMove RC E2E success is a real comparison lead

**Evidence:** Historical rollout summary `rollout_summaries/2026-10-19T08-10-34-DHQK-automove_dashboard_ci_repair_merge.md`; CI run `39227479176`; candidate SHA `e64a1aaf8645ca1f1a5b62fc0e341ffe803ab50a`.

**Detail:** The prior flow is reported to have used the repository's exact-SHA AutoMove RC business-chain workflow, a canonical Non-Production Supabase target, a fresh production-mode build/start, and browser E2E. This establishes that one prior route worked, not that the current pilot shares its runner, identity, environment, or policy path.

## Deduced Conclusions

No root cause is deduced yet. The current missing proxy and worktree env differences are observations only.

## Hypothesized Paths

### Hypothesis 1: Pilot uses a different execution transport than the successful RC workflow

**Status:** Open

**Theory:** The pilot's current shell/launcher is not the same runner or policy-bound path used by the successful RC workflow.

**Supporting indicators:** Current shell had no proxy variables or loopback proxy listener; old successful flow was CI workflow-driven.

**Would confirm:** Workflow source/run metadata shows different execution actors, proxy-binding/permission setup, or runner boundary.

**Would refute:** Both routes use the same explicitly profile-bound runner and the prior successful run still has matching transport evidence.

**Resolution:** Pending source and run-record comparison.

### Hypothesis 2: `.env.e2e` belongs to a different environment or identity than the successful Non-Production target

**Status:** Open

**Theory:** The file may not be the correct Non-Production input for the pilot, or may expose credentials the pilot must not use.

**Supporting indicators:** It contains a service-role variable name; filenames and hostnames do not prove environment or auth semantics.

**Would confirm:** Workflow/input validation or secret-safe metadata shows a mismatched project/environment or service-role path.

**Would refute:** The successful RC workflow explicitly consumes the same E2E file/secret set with a scoped non-production identity and approved access path.

**Resolution:** Pending direct workflow and source inspection; do not print or persist values.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | ------ | ------------- |
| Successful run's effective checkout, runner, env source, and network setup | Cannot compare execution paths | Inspect workflow YAML, runner code, and exact historical run metadata. |
| DB client, auth role, and connection path used by successful E2E | Cannot safely infer whether `.env.e2e` is suitable | Trace code path and workflow env mapping; only inspect variable names/hosts, never values. |
| Current pilot's effective runner/profile binding | Cannot prove a shell command would be policy-enforced | Trace launcher to the native execution API/config; no request until the route is established. |

## Source Code Trace

| Element | Detail |
| ------- | ------ |
| Error origin | Not yet traced; prior stop occurred before dispatch because no policy proxy endpoint was available in the shell. |
| Trigger | Attempt to prepare Chromium, Next child, and PostgreSQL transport probes. |
| Condition | Current execution environment did not expose profile-bound transport; candidate worktree did not contain a real env file. |
| Related files | `.github/workflows/automove-rc-business-chain.yml`; `scripts/run-automove-rc-business-chain.ts`; AutoMove pilot runner and launcher; `.env.e2e` metadata. |

## Conclusion

**Confidence:** Low

A prior AutoMove workflow reportedly completed browser E2E, so the current pilot's inability to begin transport probes does not establish a Factory limitation. The cause is still open: successful and current execution paths have not yet been compared directly, and `.env.e2e` has not been classified as an approved Non-Production credential source.

## Recommended Next Steps

### Fix direction

None yet. The user's requested next step is diagnosis only; do not alter launcher, environment, permissions, schema, DB, or Product code.

### Diagnostic

Inspect and compare the successful RC workflow/source and pilot launcher/profile binding, then report the exact proven differences and remaining gaps. Do not make network requests or DB connections during this case step.

## Reproduction Plan

Read-only source/config/run-record comparison: identify checkout/SHA, runner identity, env injection point, browser launch mechanism, DB client/auth path, and network policy binding on each route. Reproduce no application operation.

## Side Findings

- A service-role variable name exists in `.env.e2e`; its value was not read. Do not assume it is used by the prior successful flow or use it for E2E until the actual identity path is proven.

## Follow-up: 2026-10-22

### New Evidence

- Successful RC workflow runs on GitHub Actions `ubuntu-latest`, checks out an exact candidate SHA, and injects E2E configuration from GitHub Secrets. It does not configure Codex `permissionProfile` or `E2E_ENV_FILE` in the workflow. See `.github/workflows/automove-rc-business-chain.yml:38-65`.
- The RC runner enforces API/DB project matching and an exact commit SHA; it builds/starts a fresh production-mode app and runs Playwright. The successful E2E uses `pg.Client` for fixture SQL and Supabase admin auth with a service-role key; this is a mutating fixture flow, unlike the proposed transport-only `SELECT 1`. See `scripts/run-automove-rc-business-chain.ts:11-31,65-74,91-120`, `src/modules/bella-auto/services/AutoMoveSaleChainConnection.ts:32-58`, and `e2e/tests/42-automove-dashboard-sales-chain.spec.ts:17-60`.
- The pilot candidate and tooling proposal share HEAD `cde2d9133c650e2d1abef5315b4255e583e02b2e` but have dirty, uncommitted pilot files. The main checkout is on `codex/preschool-full-audit-20261020` with unrelated Education changes; leave it untouched.
- The frozen pilot launcher omits `features.network_proxy`; the separate proposal turns it on for VERIFY and checks effective config read-back. Existing diagnostic evidence says the baseline had no proxy environment despite `NODE_USE_ENV_PROXY=1`, while the process override produced proxy variables. See `scripts/agent-flow/mvp-pilot.mjs:117-126` in the respective worktrees and `DIAGNOSTIC_RESULT.md:7-17`.
- Pilot VERIFY does not auto-discover `.env.e2e`: `role-native` forwards `process.env.E2E_ENV_FILE`, and the runner requires an explicit file outside the worktree. The proposal runner constructs a narrowed Next/Playwright child environment that omits proxy variables. Whether the policy is enforced independently of these variables remains unproven. See `role-native.mjs:113-124`, `mvp-pilot.mjs:107-140`, and `mvp-pilot-runner.mjs:14-37,59-65,75-115` in the proposal worktree.
- The previous source-only comparison accidentally caused a PowerShell URI parsing error to echo a credential-bearing DB URL in tool output. The value has not been copied into this case file or other artifacts; stop reading `.env.e2e` and treat the exposed DB password as potentially compromised pending owner rotation.

### Additional Findings

- The prior successful CI run proves that its GitHub-hosted runner, GitHub Secrets, TLS-validated PostgreSQL client, and fixture workflow worked for that exact SHA. It does not prove the current native Factory/profile/child-process route is equivalent.
- The immediate reason the local transport attempt remained `NOT_RUN` is that it was launched from a shell with no policy proxy endpoint; this shell is not evidenced to be the native profile-bound route.
- A root cause is confirmed for the pilot baseline's missing proxy setup: its selected process profile omitted `features.network_proxy`. The proposal addresses that at the VERIFY role configuration, but it does not yet prove proxy inheritance/enforcement for Next.js or Chromium children.

### Updated Hypotheses

- **Native-vs-CI execution-path mismatch — Confirmed as a configuration difference; open as full root cause.** Successful flow uses GitHub-hosted CI and secret injection; pilot uses native app-server role execution and a local permission profile.
- **Child proxy variables are stripped — Confirmed statically in the proposal runner; runtime enforcement impact remains open.** A direct runtime test through the profile-bound runner is needed to prove whether policy interception still applies.
- **`.env.e2e` is the same Non-Production identity as CI secrets — Open.** API hostname matches AutoMove, but the file and CI secret equivalence/target classification are not established. Do not use the service-role key for transport-only checks.

### Backlog Changes

- Done: compare successful RC workflow and source with current pilot profile/launcher without making network or DB requests.
- Open: verify child-process policy behavior only through a supported profile-bound executor; do not use ambient shell or direct egress.
- Open: classify the intended Non-Production DB identity without exposing or re-reading the compromised DB URL; owner should rotate the exposed DB password through the secret-management process.
- Open: after the runtime gate and a separate owner decision, consider the next Factory attempt; no attempt 2 or Product E2E is authorized by this comparison.

### Updated Conclusion

The evidence rejects the premise that the successful prior run used the same path as this pilot: it did not. The confirmed difference is GitHub Actions with injected secrets versus native Factory role execution with a permission profile and a Next/Playwright child environment that drops proxy variables. The baseline also lacked `features.network_proxy`; the isolated proposal adds it for VERIFY. That identifies a minimal configuration defect in the baseline, but the product-child enforcement outcome is still `NOT_PROVEN`, so do not resume Verify or run Product E2E yet. Confidence: Medium for the execution-path/configuration difference; Low for whether Chromium/Next children are actually outside enforcement.
