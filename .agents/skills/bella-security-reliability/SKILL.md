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

- Distinguish local proof, CI proof, Real DB proof, Browser E2E proof, production integrity, and Go-Live.
- PR checks passing do not prove main, production, or Go-Live.
- A timeout is not a pass.
- A skipped test is not a pass.
- If runtime behavior cannot be proven, report `NOT_PROVEN`.

## Verification Packet

Return:

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

Stop and report `BLOCKED` or `NOT_PROVEN` when:

- Auth/RLS semantics are unclear.
- Runtime environment is unknown.
- Production behavior is unverified.
- The fix would require weakening security.
- The work requires credentials that are not available through approved process.
- The task requires a public contract or ProductRegistry change outside approved scope.
