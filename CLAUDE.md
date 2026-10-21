# BELLA AI PLATFORM — CLAUDE & AI CODING INSTRUCTIONS

Before changing software, architecture, or engineering controls anywhere in the Bella AI Platform ecosystem, you MUST read and obey:
- **Bella AI Platform Architecture & Change Constitution:** `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`

Use its **Workflow Routing**, **Scoped Autonomy and Approval**, **Verification Results and Applicability**, and **Enforcement Evidence** sections. Follow its authority/applicability map and retain applicable specialized rules. The complete common rules live in that document; this entrypoint does not create a separate workflow or grant additional authority.

For coding requests received in project Codex chat, follow **Factory Intake from Project Codex Chat** in that Constitution before implementation. It routes admitted tasks to the existing Factory and specifies the boundary for unsupported tasks and already-dispatched roles.

These rules are mandatory. Do not introduce new abstractions, Platform/Core changes, or cross-scope refactors without evidence and explicit justification.

For UI-driven changes, follow **UI-Driven Backend Change Safety** in the constitution: use its proportional Change Map and owner decision boundary before implementation.

For multi-agent work, the default is single-agent execution unless Multi-Agent Mode is explicitly requested or authorized by the task context. Follow the **Multi-Agent Coding Protocol** in `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`: one Lead, clear ownership, isolated worktrees/branches, public contracts across boundaries, QA before merge, and evidence before status.

Before creating or modifying any code, you MUST read and obey:
- **Healthcare OS Constitution:** `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`
- **Education OS Constitution:** `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`

## NON-NEGOTIABLE LAWS:
1. **KERNEL CANDIDATE FREEZE:** Boundedcontext kernels are FROZEN. Do NOT create core engines without approval.
2. **PRODUCT VERTICAL LAYER ONLY:** Product code belongs in `src/products/`.
3. **CONTRACT ACCESS ONLY:** `Product → Contract → Kernel`. Do NOT query `hc_*` or internal vertical tables directly from Product layer.
4. **ADDITIVE MIGRATIONS:** `CREATE` product tables/indexes only. Never alter/drop Kernel columns.
5. **ZERO ENTITY DUPLICATION:** Do not recreate `Patient`, `Doctor`, `Course`, or `Student` tables.
6. **EVENT-AFTER-PERSISTENCE:** `DB COMMIT → DOMAIN EVENT → CONSUMER`.
7. **TENANT ISOLATION (GATE 0):** Enforce `tenant_id` on all queries/services.
8. **PRE-CODING ANALYSIS:** Apply the entry gate and proportional Change Map in the Bella AI Coding Constitution. Presentation-only maintenance may use a brief `UI_ONLY` classification and UI verification without a standalone report, as defined there. For any new OS, new Product, Product vertical, or Product UI redesign, output `ARCHITECTURE_GATE_RESULT.md` with `PASS`, `BLOCKED`, or `DEFER` before product/runtime code is written, including explicit Change Authority.
9. **NO CROSS-INDUSTRY COUPLING:** Retail/Education/Healthcare OS must never import from each other. They must remain completely isolated.
10. **VERIFICATION:** Run `npm run healthcare:verify` before completion.
