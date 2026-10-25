# Scoped ADR — canonical Preschool classroom command

Date 2026-10-25. Human authority: `approve` to the concrete ACR presented in this chat. Source base 990ea3842dc1a31735af7f2299a20e7e89b4db0d plus retained read/context patch.

## Decision

`edu_courses` remains the single canonical course identity for Preschool. Add a write interface beside the read contract, retaining unchanged reader signatures and legacy `IEducationCourseContract`. Reuse existing Course aggregate and Education repository; do not write `courses` or create another Course entity/table.

The proposed create operation is caller-authenticated, active Preschool tenant, admin-only (no super_admin/nonadmin expansion over the current catalog), and requires an explicitly authorized active branch. Atomic persistence must create course, immutable branch mapping and idempotent receipt together. Same operation key/payload returns same course; mismatched payload/tenant/actor/branch denies without writes. No default academic year, age group, room, health or capacity metric is introduced. Capacity remains null where the canonical schema permits it; schema evidence must confirm before SQL is finalized.

No new general Course engine or action matrix is introduced. This least-privilege create scope is part of the approved classroom design; existing admission rules are not broadened. Backend transaction revalidates live actor, Product and branch after locks. UI and contract remain unavailable on missing transaction capability; no client-side multi-write fallback. Publication is not added where no existing course-created event contract requires it.

Teacher assignment retains its existing aggregate and legacy behavior. Canonical Preschool must never pass its ID into the legacy FK. A compatible additive relation option and exact migration will be prepared for owner review; no existing FK is silently retargeted and no legacy shadow course is created. Actual assignable-teacher identity source must be independently established before a teacher selector or mutation is enabled.

## Scope and tradeoffs

Shared Education changes are limited to the public contract, its owning adapter/repository and focused tests. Product/API/UI consume public contracts. Existing legacy Course consumers remain unchanged. SQL is a reviewable draft until exact migration approval; no remote schema/grant changes are authorized now. Frozen global controls and baselines stay unchanged.

## Verification

Run unit/request/UI positive/negative/idempotency/payload checks and full type/architecture checks for changed source. Rehearsal and real persistence proof follow separately approved migration/application prerequisites. No mock success proves runtime RLS or full flow; preserve current partial state until actual E2E proves create/read/branch/teacher/attendance behavior.
