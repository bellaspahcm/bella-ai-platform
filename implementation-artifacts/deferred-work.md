# Deferred work

## Tenant initial render — 2026-10-19

- **Legacy automatic theme persistence (pre-existing):** dashboard startup still calls `needsThemeUpgrade` / `upgradeTheme`. Explicit pink presets may be persisted to module defaults. This task narrows its readiness guard but does not authorize changing the legacy producer/action. Assess separately before claiming all custom-color semantics are sealed.
- **Existing palette source assertion:** `tenant-isolation-source-guards.test.ts` expects `--beauty-night: #0B1F3A`; this failed before the UI patch. Ready CSS must remain unchanged in this task.
- **Healthcare Real DB test environment:** `.env.test` points to the currently used production project. A separate `.env.e2e` project is reachable, but REST returns `PGRST205` for `hc_encounters` and `hc_cds_rules`, and the Healthcare fixture tenant IDs were absent. Physical schema absence versus stale/excluded REST schema is not established. A canonical Healthcare test target/schema must be identified before running create/delete integration fixtures. Do not copy secrets into this report or provision/migrate a database as part of the render fix.
