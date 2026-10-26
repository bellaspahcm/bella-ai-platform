# BELLA AI PLATFORM — CLAUDE & AI CODING INSTRUCTIONS

Before changing software, architecture, or engineering controls anywhere in the Bella AI Platform ecosystem, you MUST read and obey:
- **Bella AI Platform Architecture & Change Constitution:** `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`

Use its **[Fast, Correct, Evidence-Based Execution](docs/governance/BELLA_AI_CODING_CONSTITUTION.md#fast-correct-evidence-based-execution)**, **Workflow Routing**, **Scoped Autonomy and Approval**, **Verification Results and Applicability**, and **Enforcement Evidence** sections. Follow its authority/applicability map and retain applicable specialized rules. The complete common rules live in that document; this entrypoint does not create a separate workflow or grant additional authority.

Follow **[Autonomous Execution](docs/governance/OPERATIONAL_RULES.md)** for all Bella AI Platform work and current or future Products; apply **[Factory Operating Rules](docs/governance/FACTORY_RULES.md)** when Factory is selected. Reuse these sources rather than copying their rules here or into Products.

Factory is optional for coding requests received in project Codex chat. Follow the Constitution's Workflow Routing to use the normal direct workflow unless the user or a task-specific rule selects Factory. When Factory is selected, follow **Factory Intake from Project Codex Chat**; do not claim Factory evidence for direct work or bypass a held Factory run.

These rules are mandatory. Do not introduce new abstractions, Platform/Core changes, or cross-scope refactors without evidence and explicit justification.

For UI-driven changes, follow **UI-Driven Backend Change Safety** in the constitution: use its proportional Change Map and owner decision boundary before implementation.

For `BELLA MVP UI-TO-DATABASE COMPLETION` or an equivalent request to complete an existing MVP after redesign, connect real data, or finish related features, follow **[MVP UI-to-Database Completion](docs/governance/BELLA_AI_CODING_CONSTITUTION.md#mvp-ui-to-database-completion)**. Apply its scoped inventory, MVP reuse, real persistence/E2E evidence, and authority boundaries through the normal authorized workflow; Factory is optional, and direct work does not prove native launcher activation.

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
10. **VERIFICATION:** For Healthcare code, run `npm run healthcare:verify` before completion. Select other checks using the Constitution's Verification Selection and mandatory applicable policies.
