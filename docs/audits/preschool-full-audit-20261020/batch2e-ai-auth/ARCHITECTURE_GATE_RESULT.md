# Copilot request authorization change map

Decision: PASS for the bounded source-only identity/tenant/executive-action repair. Complete Preschool RBAC/RLS and clinical semantics remain NOT_PROVEN.

Process: existing security bug, not a new Product/OS/UI feature. Owner requests continuing remaining audit fixes. The original audit F04 confirms role header override and tenant selector bypass. Approved Copilot Phase1 gate assigns API authorization/tenant enforcement and names the existing permission helper; approved Phase4 section1 item3 names the five leadership roles. These documents and governing isolation rules are the independent Business Test Contract for this repair. No expected health thresholds are added or changed.

Manifest/ownership: existing bella-education `preschool_ai_copilot` capability; API owns Auth/profile binding, tenant selection and action authorization. Platform owns canonical Auth/users/tenant status. Product owns existing stateless Copilot executor/capability rules; Core owns its public AI capability interface. Dependency is UI → API → existing Product service → AI capability contract. Frozen Education and Healthcare code is untouched.

Authority: only one Copilot route and three directly related tests, plus evidence. Keep original dirty audit checkout separate; reuse the clean merged Education worktree on a fresh `codex/preschool-api-identity-20261021` branch from main30134055d. Builder owns those four TypeScript files. Lead owns evidence, commands, production READ ONLY verification. No SQL mutation, grant/policy/default ACL/membership change, new role alias, AI rule, UI or control change.

UI reconciliation: callers use the same endpoint/action payload. A mock header/query no longer supplies authority. Legitimate session actors keep general behavior; only explicitly authorized leadership actors may run the two executive actions. Demo-only callers without Auth now receive401; this is intentional containment, not grounds for bypass.

Migration NOT_APPLICABLE. Verification addresses all11 specialized gate categories proportionally: architecture/strict types, existing contract behavior, tenant selector negatives, role/action negatives, no migration, no new events/persistence, no academic-rule change, no temporal change, no governance-rule change, no audit-format change, applicable Education/Healthcare checks. DB/full real-user/browser/production gates remain separate; no skipped/offline failure is PASS.

Roles: Software Engineer via bmad-quick-dev for four owned files; Business Analyst/Security read-only canonical evidence; QA reviewers independent bounded diff. The skill explicitly calls for delegated implementation/review; no additional autonomous workstream or approval authority is delegated.
