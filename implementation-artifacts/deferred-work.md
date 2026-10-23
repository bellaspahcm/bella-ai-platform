# Deferred work

## AutoMove photo metadata client reuse — 2026-10-23

- **Existing error handling, outside factory-only change:** TradeInPhotoService.reorderPhotos awaits PATCH but does not inspect returned error; setPrimaryPhoto ignores the first unset error; deletePhoto ignores the initial read error. These bodies are unchanged from baseline bb7007e7632c3bf7d88f760fc8239a0720d2d327. Current UI caller only reads statuses and uploads metadata. General denial propagation, multi-step atomicity and delete Storage cleanup remain NOT_PROVEN. A separate scoped repair needs owner-compatible error/transaction semantics and step-specific failure/read-back evidence; do not certify these methods from the7 global-denial tests.
- **Independent review runtime dependency:** blind reviewer completed; edge and acceptance agents errored with usage limit before final reports. Spec remains in-review, never done. Handoff prompts preserve the required three reviewer roles for the final cumulative diff; no repeated agent execution or alternate privilege used to bypass the runtime limit.

## Tenant initial render — 2026-10-19

- **Legacy automatic theme persistence (pre-existing):** dashboard startup still calls `needsThemeUpgrade` / `upgradeTheme`. Explicit pink presets may be persisted to module defaults. This task narrows its readiness guard but does not authorize changing the legacy producer/action. Assess separately before claiming all custom-color semantics are sealed.
- **Existing palette source assertion:** `tenant-isolation-source-guards.test.ts` expects `--beauty-night: #0B1F3A`; this failed before the UI patch. Ready CSS must remain unchanged in this task.
- **Healthcare Real DB test environment:** `.env.test` points to the currently used production project. A separate `.env.e2e` project is reachable, but REST returns `PGRST205` for `hc_encounters` and `hc_cds_rules`, and the Healthcare fixture tenant IDs were absent. Physical schema absence versus stale/excluded REST schema is not established. A canonical Healthcare test target/schema must be identified before running create/delete integration fixtures. Do not copy secrets into this report or provision/migrate a database as part of the render fix.
