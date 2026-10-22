# BELLA AI CODING — MANDATORY ARCHITECTURAL CONTROL

Before changing software, architecture, or engineering controls anywhere in the Bella AI Platform ecosystem, you MUST read and comply with:

👉 **Bella AI Platform Architecture & Change Constitution:** `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`

Use its **[Fast, Correct, Evidence-Based Execution](docs/governance/BELLA_AI_CODING_CONSTITUTION.md#fast-correct-evidence-based-execution)**, **Workflow Routing**, **Scoped Autonomy and Approval**, **Verification Results and Applicability**, and **Enforcement Evidence** sections. Follow its authority/applicability map and retain applicable specialized rules. The complete common rules live in that document; this entrypoint does not create a separate workflow or grant additional authority.

For coding requests received in project Codex chat, follow **Factory Intake from Project Codex Chat** in that Constitution before implementation. It routes admitted tasks to the existing Factory and specifies the boundary for unsupported tasks and already-dispatched roles.

These rules are mandatory. Do not introduce new abstractions, Platform/Core changes, or cross-scope refactors without evidence and explicit justification.

For UI-driven changes, follow **UI-Driven Backend Change Safety** in the constitution: use its proportional Change Map and owner decision boundary before implementation.

For multi-agent work, the default is single-agent execution unless Multi-Agent Mode is explicitly requested or authorized by the task context. Follow the **Multi-Agent Coding Protocol** in `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`: one Lead, clear ownership, isolated worktrees/branches, public contracts across boundaries, QA before merge, and evidence before status.

Before modifying any Healthcare or Education code or implementing any Product Vertical, you MUST also read and strictly comply with:

👉 **Healthcare OS Constitution:** `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`
👉 **Education OS Constitution:** `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`

---

## 🔴 HARD KERNEL FREEZE LOCK (NON-NEGOTIABLE)

**Healthcare OS Kernel H1–H12 is FROZEN.**
**Logistics OS Kernel E7.1, E7.2, E7.3 is SEALED.**

You MUST NOT:
1. Create "H13" or any new core Healthcare Kernel engine in `src/platform/healthcare/engines/`.
2. Modify existing H1–H12 Kernel files, entities, or bounded-context responsibilities.
3. Modify E7.1 Domain Kernel (12 artifacts, 366 tests).
4. Modify E7.2 Operational Kernel (4 artifacts, 73 tests).
5. Modify E7.3 Rules & Traceability (9 artifacts, 108 tests).
6. Access `hc_*` Kernel database tables directly from Product Verticals.
7. Duplicate Kernel entities (`Patient`, `Doctor`, `Encounter`, `InventoryItem`, `Movement`).
8. Bypass Public Contracts (`Product → Contract → Kernel`).
9. Bypass H8 CDS, H9 Temporal, H10 Governance, or H11 Audit capabilities.
10. Violate Tenant Isolation (Gate 0 / P0).
11. Violate Event-After-Persistence (`DB COMMIT → DOMAIN EVENT`).
12. Introduce `any` types in any file.

---

## 📋 MANDATORY PRE-CODING ANALYSIS

Before writing or modifying code, apply the constitution's entry gate and proportional Change Map. Presentation-only maintenance may use a brief `UI_ONLY` classification and UI verification without a standalone report, as defined there. For work requiring `ARCHITECTURE_GATE_RESULT.md`, include:

1. **Bella OS/Product Development Process Gate** from `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
2. **Product Manifest** (Capabilities & Scope)
3. **Ownership Map** ("WHO OWNS THIS DATA?")
4. **Contract Dependency Map** (`Product → Contract → Kernel`)
5. **Change Authority** (which layers the requested change authorizes modifying)
6. **UI → Contract Reconciliation** for Product UI redesigns or data/action-bound UI changes
7. **Migration Applicability & Additive Migration Plan** (`CREATE` new product tables / indexes only where applicable; explain `NOT_APPLICABLE` when no migration is needed)
8. **Verification Plan** (mandatory applicable gates and risk-related checks; retain all 11 gates where the specialized constitution requires them)

For any new OS, new Product, Product vertical, or Product UI redesign, `ARCHITECTURE_GATE_RESULT.md` must conclude `PASS`, `BLOCKED`, or `DEFER` before product/runtime code is written.

### 🔴 ARCHITECTURAL GAP PROTOCOL
If the requested feature appears to require a new Kernel capability or modification to H1–H12:
- **STATUS:** `BLOCKED`
- **ACTION:** Output `ARCHITECTURAL GAP DETECTED`. Do NOT write code. Report the gap for Human Architect Review.

---

## 🛡️ ARCHITECTURE VERIFICATION & ENFORCEMENT EVIDENCE

### Healthcare OS
Before submitting Healthcare code, you MUST verify:
```bash
npm run healthcare:verify
```
Runs the configured Healthcare guard, architecture, conformance, and Kernel regression commands. Report the actual executed suites/tests and outcomes; historical counts do not prove the current run. Applicable Healthcare requirements remain mandatory.

### Logistics OS
Before submitting Logistics code, you MUST verify:
```bash
npm run logistics:verify
```
Runs the configured Logistics guard and Kernel regression commands. Report actual suite and test counts separately; the historical 547 figure refers to tests, not suites. Applicable freeze/regression requirements remain mandatory.

**Architecture Guard Control Surfaces:**
- **Layer 1:** Architecture Guard Script.
- **Layer 2:** Pre-Tool-Use Hook for its configured AI tool and matched operations.
- **Layer 3:** Git Pre-Commit Hook for the actual checkout configuration.
- **Layer 4:** CI Architecture Gate with applicable triggers and required-check policy.
- **Layer 5:** Regression Test Suite for the exercised scope.

These are control surfaces, not a claim that all five are enforced in every tool or scope. Assess their actual state using **Enforcement Evidence** in the Constitution.

**Frozen Artifacts:**
- E7.1: 12 artifacts (domain primitives)
- E7.2: 4 artifacts (operations)
- E7.3: 9 artifacts (rules & traceability)

**To modify frozen code:**
1. Create Architecture Change Request (ACR) using `docs/architecture/templates/ACR_TEMPLATE.md`
2. Submit for Human Architect Review
3. Document Architecture Decision Record (ADR)
4. Unlock layer in manifest
5. Implement changes
6. Run full regression (547/547 must PASS)
7. Update baseline and re-seal

**Reference:** `docs/architecture/FREEZE_POLICY.md`
