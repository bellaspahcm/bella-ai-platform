# BELLA AI CODING — MANDATORY ARCHITECTURAL CONTROL

Before implementing or modifying any Bella OS or Product, you MUST read and comply with:

👉 **Bella AI Coding Constitution:** `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`

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
7. **Additive Migration Plan** (`CREATE` new product tables / indexes only)
8. **11 Automated Verification Gates Plan**

For any new OS, new Product, Product vertical, or Product UI redesign, `ARCHITECTURE_GATE_RESULT.md` must conclude `PASS`, `BLOCKED`, or `DEFER` before product/runtime code is written.

### 🔴 ARCHITECTURAL GAP PROTOCOL
If the requested feature appears to require a new Kernel capability or modification to H1–H12:
- **STATUS:** `BLOCKED`
- **ACTION:** Output `ARCHITECTURAL GAP DETECTED`. Do NOT write code. Report the gap for Human Architect Review.

---

## 🛡️ MACHINE ARCHITECTURE GUARD ENFORCEMENT

### Healthcare OS
Before submitting Healthcare code, you MUST verify:
```bash
npm run healthcare:verify
```
Which runs `scripts/healthcare/architecture-guard.ts` and the 52/52 Kernel Regression Test Suites.

### Logistics OS
Before submitting Logistics code, you MUST verify:
```bash
npm run logistics:verify
```
Which runs `scripts/architecture/architecture-guard.ts` and the 547/547 Kernel Regression Test Suites (E7.1: 366, E7.2: 73, E7.3: 108).

**Architecture Guard Protection:**
- **Layer 1:** Architecture Guard Script (manual/pre-commit)
- **Layer 2:** Pre-Tool-Use Hook (blocks AI modifications in real-time)
- **Layer 3:** Git Pre-Commit Hook (prevents commits)
- **Layer 4:** CI Architecture Gate (blocks PRs)
- **Layer 5:** Regression Test Suite (validates integrity)

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
