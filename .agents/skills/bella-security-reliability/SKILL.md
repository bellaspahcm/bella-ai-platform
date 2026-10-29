---
name: bella-security-reliability
description: Bella security and reliability wrapper for auth, RLS, tenant isolation, runtime integrity, production evidence, and reliability gates. Use when a task touches security, permissions, operational readiness, production behavior, or resilience.
---

# Bella Security & Reliability Wrapper

## Purpose

Use this wrapper when a Bella task touches or could affect security, reliability, runtime integrity, production readiness, or operational evidence.

This wrapper does not grant authority to change security, auth, RLS, production configuration, ProductRegistry, or public contracts. It verifies and reports within the user-approved scope.

## Mandatory Checks

Assess whether the task affects:

- Authentication.
- Authorization.
- Tenant isolation.
- RLS.
- Service-role usage.
- PII or sensitive business data.
- Input validation.
- Audit trail.
- Migration safety.
- Runtime environment assumptions.
- Production integrity.
- Backup/restore or rollback behavior.

## Security Rules

- Do not bypass RLS.
- Do not hardcode tenant IDs, user IDs, branch IDs, or privileged identities.
- Do not use service-role access to hide authorization failures.
- Do not weaken auth checks to make tests pass.
- Do not persist credentials, secrets, passwords, tokens, or `.env` values.
- Do not report security as `PASS` without executable or inspectable evidence.

## Reliability Rules

- Apply the Constitution's three control levels, evidence reuse and environment selection; tool failure alone does not block independent safe work. An authorized direct administrative route retains the same security, operation authority and recovery requirements as BDGF.

- Distinguish local proof, CI proof, Real DB proof, Browser E2E proof, production integrity, and Go-Live.
- PR checks passing do not prove main, production, or Go-Live.
- A timeout is not a pass.
- A skipped test is not a pass.
- If runtime behavior cannot be proven, report `NOT_PROVEN`.

## Verification Packet

Keep applicable fields in the existing task response/work record; no additional report is required:

```text
SCOPE:
SECURITY SURFACE:
RELIABILITY SURFACE:
AUTH / RLS / TENANT EVIDENCE:
RUNTIME EVIDENCE:
COMMANDS OR INSPECTIONS:
RESULT:
GAPS:
STOP CONDITIONS:
```

## Stop Conditions

Hold only the dependent unsafe/unauthorized action and report the actual finding. Continue independent authorized work. Use `NOT_PROVEN` for missing proof and `BLOCKED` for an identified execution obstacle; these are not interchangeable. Boundaries include:

- Auth/RLS semantics are unclear.
- The target/executor or runtime environment for a sensitive operation cannot be verified safely.
- Required Production preconditions, operation authority, impact or recovery cannot be established. Missing Production evidence does not stop an independent local fix or establish Go-Live.
- The fix would require weakening security.
- The work requires credentials that are not available through approved process.
- The task requires a public contract or ProductRegistry change outside approved scope.
