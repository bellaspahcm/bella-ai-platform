# Architecture Gate Result: Tourism OS Foundation MVP

Date: 2026-10-12

Baseline: `383972b97ed5eee0baee188c9e58a35a75c03c94` (`origin/main`, verified before implementation)

Branch: `codex/tourism-foundation-mvp`

## Decision

Status: `PASS`

Scope approval is for the reusable Tourism OS foundation only.

- `TOURISM_OS_FOUNDATION_SCOPE = APPROVED`
- `TOURISM_OS_IMPLEMENTATION = NOT_STARTED_AT_GATE`
- `TOURISM_PRODUCT_IMPLEMENTATION = NOT_STARTED`
- `TOURISM_BUSINESS_PROOF = NOT_PROVEN_AT_GATE`
- `TOURISM_GO_LIVE = NOT_CLAIMED`

This gate does not approve a Tour Operator product surface, ProductRegistry registration, product routes, product dashboards, browser UX, or production readiness.

## Bella OS/Product Development Process Gate

The requested change is a new OS foundation slice, not a Product Vertical. The approved implementation layer is `src/platform/tourism/**` plus additive `tourism_*` database artifacts and tests.

The gate allows only additive Tourism OS artifacts needed to prove the first reusable tour-management flow:

`Create Tour -> Configure Itinerary -> Open Departure -> Manage Capacity -> Book Guests -> Confirm Booking`

The implementation must stop at the accepted OS scope. Product packaging and ProductRegistry identity are deferred until a separate Product MVP gate.

## OS Manifest

Approved Tourism OS capabilities:

1. Tour Catalog
2. Tour Package
3. Itinerary Days
4. Itinerary Segments
5. Departures
6. Tour Capacity
7. Tour Bookings
8. Participants
9. Tenant isolation, authorization, RLS, idempotency, and audit evidence

Explicitly excluded:

- Tour Operator product UI or routes
- ProductRegistry registration or `tenant.product_key` changes
- Hotel PMS, restaurant management, fleet management, accounting, loyalty, dynamic pricing
- New global Resource kernel
- Logistics, Hospitality, Healthcare, Education, or Finance Ledger kernel changes
- Production readiness or Go-Live claims

## Ownership Map

| Data | Owner | Approved Storage |
| --- | --- | --- |
| Tour definition | Tourism OS | `tourism_tours` |
| Tour package | Tourism OS | `tourism_tour_packages` |
| Itinerary day | Tourism OS | `tourism_itinerary_days` |
| Itinerary segment | Tourism OS | `tourism_itinerary_segments` |
| Departure and capacity counters | Tourism OS | `tourism_departures` |
| Tour booking lifecycle | Tourism OS | `tourism_bookings` |
| Participants | Tourism OS, linked to Party contract | `tourism_participants.party_id` |
| Idempotency records | Tourism OS | `tourism_command_idempotency` |
| Audit evidence | Tourism OS | `tourism_audit_events` |

Tourism OS does not own Party, Organization/Branch, Finance, Logistics, inventory, hotel rooms, restaurant tables, or vehicle/fleet assets.

## Contract Dependency Map

`Tourism OS -> Tenant`: every runtime entity is tenant-scoped and protected by RLS.

`Tourism OS -> Party`: bookings and participants reference existing `party_parties` where customer/guest identity is required.

`Tourism OS -> Organization/Branch`: deferred for Product MVP integration. No new organization kernel is introduced in this slice.

`Tourism OS -> Finance`: deferred. Booking confirmation does not create ledger entries or accounting outbox events in this MVP.

`Tourism OS -> Logistics`: deferred. Itinerary segments may describe movement, but do not reserve vehicles, routes, or Logistics resources.

`Tourism OS -> Audit`: Tourism OS records local audit events for approved commands. Cross-OS audit consolidation is not introduced here.

## Change Authority

Approved to modify:

- `docs/architecture/ARCHITECTURE_GATE_RESULT_TOURISM_OS_FOUNDATION_MVP_2026_10_12.md`
- `src/platform/tourism/**`
- `supabase/migrations/*tourism_os_foundation*.sql`
- Tourism OS tests only

Not approved to modify:

- ProductRegistry or product resolver
- Product UI/routes
- Logistics/Hospitality/Finance/Healthcare/Education kernels
- Existing sealed Logistics E7 artifacts
- Existing Healthcare H1-H12 artifacts
- Shared global resource abstractions

## Additive Migration Plan

Create only additive `tourism_*` tables, indexes, triggers, RLS policies, and grants:

- `tourism_tours`
- `tourism_tour_packages`
- `tourism_itinerary_days`
- `tourism_itinerary_segments`
- `tourism_departures`
- `tourism_bookings`
- `tourism_participants`
- `tourism_command_idempotency`
- `tourism_audit_events`

The migration must not introduce product keys, ProductRegistry rows, ledger writes, accounting outbox rows, Logistics artifacts, Hospitality artifacts, or global resource tables.

## Required Invariants

- Every Tourism OS row carries `tenant_id`.
- RLS denies cross-tenant reads/writes.
- Commands require authorization through an explicit authorization port.
- Idempotent retries return the original result for the same payload and reject conflicting payloads.
- Departures cannot be oversold.
- Booking confirmation moves seats from reserved to confirmed.
- Booking cancellation releases reserved or confirmed seats.
- Participants belong to the same booking tenant and reference Party identities.
- Audit events are appended for approved state-changing commands.

## 11 Automated Verification Gates Plan

1. Architecture gate document exists and concludes `PASS` for OS-only scope.
2. Migration shape test proves only approved `tourism_*` tables are created.
3. Migration shape test proves no ProductRegistry/product key/Product UI coupling.
4. TypeScript/domain tests prove tour catalog and itinerary lifecycle.
5. Service tests prove departure opening and availability.
6. Service tests prove capacity limit and cancellation release.
7. Service tests prove idempotent retry and conflict behavior.
8. Authorization tests prove denied actors cannot mutate Tourism OS state.
9. RLS/Real DB tests prove cross-tenant denial when an approved non-production database is available.
10. Audit tests prove command evidence is recorded.
11. Browser E2E is `DEFERRED` until a Product MVP surface is approved.

## Final Gate Boundary

Architecture Gate: `PASS`

Implementation may proceed only for the Tourism OS Foundation MVP. Product implementation remains `NOT_STARTED`.

## Implementation Seal

Initial implementation commit: `5004487326a9899184f03ffd21d8ab54278f3a6c`

Branch: `codex/tourism-foundation-mvp`

Changed runtime scope:

- `src/platform/tourism/**`
- `supabase/migrations/20261012020000_create_tourism_os_foundation.sql`

Changed governance scope:

- `docs/architecture/ARCHITECTURE_GATE_RESULT_TOURISM_OS_FOUNDATION_MVP_2026_10_12.md`

Evidence recorded after implementation:

- Focused service and migration tests: `PASS`
- Strict changed typecheck: `PASS`
- Whitespace diff check: `PASS`
- Tourism source `any` scan: `PASS`
- ProductRegistry/Product runtime modification: `NOT_CHANGED`
- Real DB/RLS execution: `SUPERSEDED_BY_PHASE_2_SEAL`
- Browser E2E: `DEFERRED` because no Product MVP surface was approved
- Go-Live: `NOT_CLAIMED`

Exact proven boundary:

Tourism OS Foundation runtime behavior is proven by focused automated tests for tour catalog, package, itinerary, departure opening, booking, participant seat count, capacity guard, idempotent retry/conflict handling, confirmation, cancellation release, authorization denial, migration shape, RLS policy presence, anon revoke, audit table presence, and explicit exclusion of ProductRegistry/product identity coupling.

Production readiness, browser workflow proof, and Tour Operator Product MVP remain outside this seal.

## Phase 2 Verification Seal

Baseline refresh:

- `origin/main` fetched on 2026-10-12.
- `origin/main = a5fd4c26005a17cfe8926fd7ea27032bef7dd100`.
- `PR #296 = MERGED` with merge commit `a5fd4c26005a17cfe8926fd7ea27032bef7dd100`.
- Tourism branch merged current `origin/main` using merge commit `616dfa65f`.
- Existing Tourism commits were preserved.

Migration ordering fix:

- Tourism migration moved from `20261012010000_create_tourism_os_foundation.sql` to `20261012020000_create_tourism_os_foundation.sql` to avoid timestamp collision with Retail `20261012010000_create_retail_sale_pos_mvp.sql` on `main`.

Runtime fix from Real DB evidence:

- Party tenant validation triggers now run as `SECURITY DEFINER` with `search_path = public`.
- Trigger execute privileges are revoked from `PUBLIC`.
- Reason: authenticated Tourism writes must validate Party tenant ownership without granting broad direct `party_parties` read permissions to the application role.

Verification commands:

- `npm test -- src/platform/tourism/__tests__/tourism-foundation.service.test.ts src/platform/tourism/__tests__/tourism-foundation-migration.test.ts --runInBand`: `PASS`, 2 suites, 12 tests.
- `npm test -- src/platform/tourism/__tests__/tourism-foundation-real-db.e2e.test.ts --runInBand`: `PASS`, 1 suite, 2 tests.
- `npm run typecheck:changed`: `PASS`, full strict TypeScript, zero diagnostics.
- `git diff --check`: `PASS`.
- `rg "\bany\b" src/platform/tourism`: `PASS`, no hits.
- `npm run db:migration:check`: `NOT_PROVEN`, blocked by `LegacyProjectNotLinkedError` because the checkout is not linked to a Supabase project.

Real DB evidence:

- The E2E test validates the canonical non-production Supabase project ref before connecting.
- The Tourism migration is applied to the approved E2E database by the test before assertions.
- Tour catalog, package, itinerary day, itinerary segment, departure, booking, participants, idempotency, audit, confirmation, cancellation, cross-tenant denial, and concurrent capacity protection are executed through `PostgresTourismRepository`.
- Cross-tenant read is checked under authenticated tenant-B RLS context and returns no rows.
- Concurrent booking attempts against a one-seat departure result in exactly one accepted booking and one `TourismCapacityError`.

Phase 2 status:

- Tour Catalog: `PASS`
- Itinerary: `PASS`
- Departure: `PASS`
- Capacity: `PASS`
- Booking lifecycle: `PASS`
- Participants: `PASS`
- Tenant authorization and RLS: `PASS`
- Idempotency and audit: `PASS`
- Product MVP: `NOT_STARTED`
- ProductRegistry/Product identity: `NOT_CHANGED`
- Browser E2E: `DEFERRED`
- Go-Live: `NOT_CLAIMED`

Phase 3 boundary:

Tour Operator Management MVP is not implemented in this OS seal. A separate Product identity decision is still required before adding ProductRegistry entries, product routes, navigation, product UI, or browser E2E expectations.
