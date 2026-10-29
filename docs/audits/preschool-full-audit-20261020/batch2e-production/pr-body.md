## Description

Preschool staff endpoints could accept caller identity/role assertions or publish through privileged clients without a proven resource boundary. Enforce the owner-approved Product matrix at the request boundary, retire medication administration, and explicitly hold missing authorization/lifecycle dependencies before side effects.

- Copilot: verified Auth/live profile tenant and approved general/executive action roles; forged headers confer no permission.
- Medication: every POST410 `PRESCHOOL_MEDICATION_DISABLED`, before body/Auth/DB/service.
- Care: same session/RLS client, canonical Platform branch grant and current active enrollment; authorize every bulk target before writes. Health input, missing teacher mapping and unproven historical-day eligibility return503.
- Portal: issuance admin/Product gate then503 until full scoped issuer composition is proven. Configured signing only, new TTL≤24h, legacy expiry retained, current directed guardian/Party/tenant checks, parent Copilot questions only.
- Announcements: verified admin/Product gate then503 before writes until scoped recipients/idempotent lifecycle are proven. Remove fake identities and global-thread publication.

Canonical decision: `docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md`. Five independently reviewed groups composed without runtime edits; all21 Git blobs match their reviewed originals.98 changed files comprise21 source/test paths and77 scoped contract/audit evidence paths. No shared/Platform/Kernel/CI/schema/grant/policy change.

## Type of Change

- [x] Security bug fix
- [x] Intentional breaking containment: medication410 and explicit unavailable paths503, approved by owner
- [x] Contract and verification documentation

## Platform Architecture Compliance

Real Estate-specific template items are not applicable. Reuses Platform Auth/current profile/tenant/Party/branch access projection and Education Enrollment public contract. Existing Product repository reads and signed-token server capability are documented; no new privileged retry after RLS denial. No new tables, duplicated identities or frozen-layer change.

## Testing

- [x] Combined focused Jest:10 suites,286/286 tests, zero skipped/pending; native0
- [x] ESLint21 touched TS paths, scoped Education TypeScript zero diagnostics, secret scan; native0
- [x] Three fresh independent source reviewer roles per group, no actionable introduced defect remaining
- [x] Local Next16.3.8: Care4/4, Portal8/8, Announcements2/2 anonymous/spoof401 and effective no-store; listeners stopped
- [x] Copilot/Medication each4/4 actual expected status/code and effective no-store; earlier exact-header harness raw FAIL retained with separate dev-header assessment
- [x] Exact-head Vercel preview dpl_CxwkgfbVR889YBdj26dfqvmmsb79:22/22 actual anonymous/forged requests across11 route/method paths return expected401/410 and private/no-store, no business rows saved; production target remained unchanged
- [ ] Full Platform regression: actual broader local Education/Healthcare DB-dependent checks failed against explicitly offline DB (FAIL/ENVIRONMENT); chained later gates NOT_RUN
- [ ] Real authenticated allowed/denied DB/RLS and Browser E2E for this patch: NOT_PROVEN
- [x] Exact-head CI b85722f6e:28 successful emitted checks,5 skipped, zero pending/failure; unit10 suites/286 tests and Logistics15 suites/547 tests actually passed

The5 skipped checks include Real Database Business E2E and Migration Gates under existing scope routing; they are not PASS. An initial preview harness imposed an unsupported success:false field on Copilot's preserved error-only DTO, causing2 raw FAIL despite expected401/code/cache. That raw report is retained; a bounded rerun validated the exact existing error-only shape and passed22/22 without source/config changes.

No unit/source result certifies production or complete RLS. Raw commands, counters, provenance and limitations: `docs/audits/preschool-full-audit-20261020/batch2j-delivery/README.md` and included group artifacts. Original production/audit evidence and raw logs remain preserved locally.

## Database Changes

- [x] No schema, migration, grant, policy, membership or business-data changes

## Deployment and remaining gates

Draft source review only; no merge or production rollout performed. Configured existing Portal secret precedence is retained; missing configuration503, no hardcoded fallback. Retired/unavailable paths must not be reopened with anonymous access, fake identity or privileged fallback to make UI work.

Earlier production ACL containment has separate verified32-relation/RPC/Courses scope. For this source batch: `PRODUCTION_CHANGE=NOT_RUN`, `AUTHENTICATED_ACCESS_REGRESSION=NOT_PROVEN`, `BATCH2B_RBAC_RLS=IN_PROGRESS`, `PRESCHOOL_GO_LIVE=NOT_READY`. Actual transaction/TOCTOU, teacher identity mapping, historical enrollment authority, complete issuer composition, broadcast lifecycle and other canonical-truth audit findings remain separate dependencies.

## Checklist

- [x] Approved Product scope and canonical matrix applied
- [x] Documentation and risk-related denial tests included
- [x] Frozen/protected tracked surfaces unchanged; source hashes independently checked
- [ ] Applicable CI/release gates passed
- [ ] Ready for merge or Go-Live
