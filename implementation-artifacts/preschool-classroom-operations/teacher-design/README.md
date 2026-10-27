# Preschool Teacher SQL provenance

The three SQL files and `DESIGN.md`/`WIRE.md` are exact copies of the reviewed package from the classroom audit checkout. The original design headers describe their state when drafted; the subsequent approved application and read-back supersede that draft status.

On 2026-10-25, E2E received the empty-profile `011` and shared `020`; Production received the legacy-preserving `010` and shared `020`. E2E Auth/HTTP/DB verification covered the lifecycle and denials. Production retained its 16 legacy rows and received no canonical teacher fixture. The local no-op migration checkpoint records the manual application event; it does not provision a clean database. Target-aware provisioning remains separate work.

SHA256: `010` 242e943d8bdba6905d5369b381306bd28bcc4e2eaa14ddf91ede6b046e51465e; `011` 058aaaf478e78eb88b2b503256b24b8d6ab26e3a2b3eea2b05e43c306145b02a; `020` a551fbd6a35cb668ffda6f6ac03e441c2718ff027d94f5e6959ef463b2e62764.

Current source wiring and acceptance are tracked in `../ARCHITECTURE_GATE_RESULT_TEACHER.md`.
