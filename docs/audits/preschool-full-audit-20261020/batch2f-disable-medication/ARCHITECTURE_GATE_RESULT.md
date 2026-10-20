# Disable medication operation — proportional change map

Decision: PASS for source-only endpoint retirement explicitly requested by the owner on2026-10-21. User selected: “Khóa API thuốc, đưa khỏi phạm vi hoạt động Preschool”.

Truth/contract: medication administration is outside active Preschool scope. This direct owner decision establishes the negative operation rule; no teacher, principal, admin or clinical-role entitlement is invented. Auth/caller fields cannot override a disabled Product operation.

Manifest/ownership: existing Preschool care API owns this HTTP entrypoint. The route previously constructed a privileged Supabase client and passed caller-selected tenant/actor to the existing Product medication service. The service, public Product contract and persisted history remain historical artifacts unchanged. Healthcare and Education Kernel are frozen and untouched.

Authority: only medication route and one directly related route test plus evidence. Fresh clean reused Platform delivery worktree on `codex/preschool-disable-medication-20261021` from main30134055d; do not mix Copilot runtime files. Builder owns those two TypeScript files. Lead owns evidence/verification. No source deployment or production SQL is implied.

UI reconciliation: current source search finds no dashboard consumer of `care/medication` or `administerDose`; the unsupported endpoint itself is closed for all callers. Historical service references are not instructions to expose the operation. No UI redesign is involved.

Migration NOT_APPLICABLE. No schema/data/ACL/RLS/helper/default privilege or role membership change. HTTP410 with private/no-store response denotes the retired operation; no payload parsing, Auth/DB access, domain execution or events occur.

Verification: route denial permutations and side-effect spies, unchanged medication service regressions, lint/scoped TypeScript, local HTTP denial, independent code review. Specialized11 gate categories are retained proportionally: architecture/strict types, disabled public boundary, caller/tenant-independent negative behavior, no new persistence/events/academic/temporal/governance/audit semantics, unchanged Kernel. Current broad Education/Healthcare offline verification is recorded in the sibling Copilot batch; failures and missing production/authenticated proof are never PASS.
