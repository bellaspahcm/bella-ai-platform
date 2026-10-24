# ADR — Approved canonical Course read for Care and exact private headers

Status: **ACCEPTED FOR EXACT IMPLEMENTATION SCOPE**. Decision owner: repository owner, direct human reply on2026-10-21: “Duyệt cả hai gói đúng phạm vi đề xuất”. This records that decision; the agent is not granting authority. Proposal source is batch2n `OWNER_DECISION.md` plus `ACR_COURSE_CATALOG_READ.md`; their pending/draft fields are historical, superseded by this approval record.

## Context

Actual real-Auth diagnostics show canonical `edu_courses` readable, legacy Course projection42703 and teacher dependencyPGRST205. Shared `courses` belongs to the Training shape. Existing Course public contract delegates to that legacy model; new Product direct DB access would bypass the Education boundary. Actual production-mode Care response loses private via proxy. Business matrix and E2E exact6/FK authority remain the approved sources.

## Decision

Add only the two named canonical catalog public-contract files, with a required caller-supplied authenticated client, required tenant and minimal identity/status DTO. No legacy contract mutation. Add the Care classes Product API that intersects canonical active Course IDs with existing Course/branch assignment, active branch and current actor's Platform access. Missing/ambiguous/error cases fail closed; no teacher mapping is inferred. Switch only Care's selector. Apply private/no-store only to exact bulk/classes paths, including cookie refresh. Preserve public/webhook/neighboring behavior.

## Unlock applicability

Education is FROZEN by documentation/convention. FREEZE_POLICY distinguishes that state from SEALED machine enforcement and permits “ARCHITECTURE_FREEZE_MANIFEST.json or manifest file”. Repository inspection found only E7 manifests/guards, no Education machine unlock mechanism. The approved ADR and `SCOPED_UNLOCK.json` therefore record a **manual, exact-artifact exception** under the existing documented process. No automated guard is modified or disabled, and this record is not represented as machine-enforced permission. Existing Education files remain frozen and fingerprinted; only the two absent/new paths are manually unlocked. Any automatic guard rejection remains binding and is investigated without weakening it.

## Consequences and alternatives

The new capability is read-only and remains isolated from the legacy API, avoiding Training schema changes and migration replay. DTO failures are distinct from a legitimate empty catalog. Product RBAC and underlying RLS both apply. The added contract is justified by the demonstrated canonical/legacy conflict. No DB migration, production operation, global role change, or Healthcare involvement.

## Verification and recovery

Dedicated11 gates in SPEC, including real Auth/browser/API/DB and negative boundaries, exact catalog/cleanup and mandatory regression. Restore the exact preimage for proxy/UI and remove only new files if code recovery is needed; DB is unchanged. A qualified source reseal can record approved file hashes while failed/environment-blocked regression remains unproven and prevents merge/release readiness. It must never claim the full protected scope is certified by a generic guard.
