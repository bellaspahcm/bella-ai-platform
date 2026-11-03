// Audit extractor: reads committed source and the sealed 77-match inventory.
// It neither changes enforcement nor edits the reviewed baseline.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(evidenceDir, '../../..');
const sourceSha = 'f1299e3138f3700062a1ed84271db315737b0071';
const frozen = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'f13-scan-final.json'), 'utf8'));
const groups = frozen.categories.directDatabaseAccess.added;
const expected = new Map(groups.map((group, index) => [group.signature, { count: group.delta, groupId: `G${String(index + 1).padStart(2, '0')}` }]));
const occurrences = [];
const files = [...new Set(groups.map(group => group.signature.split(':L*')[0]))];

for (const legacyPath of files) {
  const sourceFile = path.posix.normalize(path.posix.join('src/products/bella-education', legacyPath));
  const content = execFileSync('git', ['show', `${sourceSha}:${sourceFile}`], { cwd: repoRoot, encoding: 'utf8' });
  const lines = content.split('\n');
  lines.forEach((line, lineIndex) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    const patterns = [
      ['sql', /\.from\s*\(\s*['"`](edu_|students|assessment_|attendance_|journal_)/g],
      ['rpc', /\.rpc\s*\(\s*['"`]/g],
    ];
    for (const [kind, pattern] of patterns) {
      for (const match of line.matchAll(pattern)) {
        const signature = kind === 'sql'
          ? `${legacyPath}:L* - Direct database query targeting '${match[0]}' is prohibited in the Product layer.`
          : `${legacyPath}:L* - Direct RPC database execution is prohibited in the Product layer.`;
        const group = expected.get(signature);
        if (!group) continue;
        const quoteIndex = line.slice(match.index).search(/['"`]/) + match.index;
        const quote = line[quoteIndex];
        const quoteEnd = line.indexOf(quote, quoteIndex + 1);
        const target = quoteEnd < 0 ? null : line.slice(quoteIndex + 1, quoteEnd);
        occurrences.push({ groupId: group.groupId, signature, sourceFile, line: lineIndex + 1,
          column: match.index + 1, kind, target, sourceText: line.trim(),
          context: lines.slice(Math.max(0, lineIndex - 2), lineIndex + 7).join('\n'),
          layer: sourceFile.startsWith('src/app/dashboard/') ? 'UI' : 'API',
        });
      }
    }
  });
}

for (const [signature, group] of expected) {
  const observed = occurrences.filter(item => item.signature === signature).length;
  if (observed !== group.count) throw new Error(`Frozen inventory mismatch: ${group.groupId} expected ${group.count}, found ${observed}`);
}
occurrences.sort((a, b) => a.groupId.localeCompare(b.groupId) || a.sourceFile.localeCompare(b.sourceFile) || a.line - b.line || a.column - b.column);
occurrences.forEach((item, index) => { item.id = `M${String(index + 1).padStart(3, '0')}`; });
if (occurrences.length !== 77 || expected.size !== 33) throw new Error('Unexpected frozen inventory size');
const targetCounts = {};
for (const item of occurrences) {
  const key = `${item.kind}:${item.target ?? 'UNRESOLVED'}`;
  targetCounts[key] = (targetCounts[key] ?? 0) + 1;
}
fs.writeFileSync(path.join(evidenceDir, 'f13-ownership-inventory.json'), JSON.stringify({ sourceSha, frozenInventory: 'f13-scan-final.json', occurrences: 77, signatures: 33, matches: occurrences }, null, 2));
console.log(JSON.stringify({ sourceSha, occurrences: occurrences.length, signatures: expected.size, targets: targetCounts }, null, 2));

// Audit findings, NOT executable exceptions or a replacement baseline.
const kernel = {
  students: ['Student', 'src/platform/education/student/student.repository.ts:31'],
  edu_courses: ['Course', 'src/platform/education/contracts/canonical-course-catalog.contract.impl.ts:19'],
  edu_enrollments: ['Enrollment', 'docs/products/bella-preschool/AUTHORIZATION_CONTRACT.md#9-enrollment-v1--quyết-định-owner-ngày22-10-2026'],
  edu_attendance: ['Attendance', 'src/platform/education/contracts/attendance.contract.impl.ts:127'],
  edu_attendance_daily_state: ['Attendance projection', 'src/platform/education/contracts/attendance.contract.impl.ts:209'],
  edu_assessments: ['Assessment', 'supabase/migrations/20260813000020_create_edu_attendance_and_assessment.sql:16'],
};
const product = {
  edu_child_allergies: '20260909000051_p41_safety_critical.sql:31',
  edu_medication_authorizations: '20260909000051_p41_safety_critical.sql:80',
  edu_health_incidents: '20260909000051_p41_safety_critical.sql:130',
  edu_daily_care_sessions: '20260909000052_p42_daily_care_operations.sql:11',
  edu_daily_care_records: '20260909000052_p42_daily_care_operations.sql:22',
  edu_daily_parent_digests: '20260909000052_p42_daily_care_operations.sql:39',
  edu_dev_observations: '20260909000053_p51_framework_observation_evidence.sql:98',
  edu_dev_observation_students: '20260909000053_p51_framework_observation_evidence.sql:113',
  edu_dev_milestone_progress: '20260909000054_p52_milestone_progress_next_steps.sql:5',
  edu_comm_threads: '20260909000056_p61_parent_communication.sql:13',
  edu_comm_notices: '20260909000056_p61_parent_communication.sql:28',
  edu_comm_responses: '20260909000056_p61_parent_communication.sql:111',
  edu_comm_exceptions: '20260909000056_p61_parent_communication.sql:124',
  edu_fin_billing_periods: '20260909000058_p71_preschool_finance.sql:29',
  edu_fin_invoices: '20260909000058_p71_preschool_finance.sql:59',
  edu_fin_invoice_line_items: '20260909000058_p71_preschool_finance.sql:82',
  edu_fin_payments: '20260909000058_p71_preschool_finance.sql:98',
  edu_sched_shift_assignments: '20260909000060_p8_staff_scheduling_schema.sql:41',
  edu_sched_leave_requests: '20260909000060_p8_staff_scheduling_schema.sql:57',
  edu_sched_substitutions: '20260909000060_p8_staff_scheduling_schema.sql:73',
};
const workflowRpc = {
  preschool_list_school_announcements: 'supabase/migrations/20261030220000_preschool_school_announcements.sql:49',
  preschool_publish_school_announcement: 'supabase/migrations/20261030220000_preschool_school_announcements.sql:83',
  preschool_record_handover: 'supabase/migrations/20261024010000_preschool_handover_atomic_command.sql:6',
  preschool_save_care_records: 'supabase/migrations/20261031143000_preschool_care_rpc_and_rls.sql:67',
  preschool_portal_daily_read: 'docs/audits/preschool-full-audit-20261020/release-production-20261024/PRODUCTION_CAPABILITIES_DRAFT.sql:521',
  preschool_portal_issuer_context: 'docs/audits/preschool-full-audit-20261020/release-production-20261024/PRODUCTION_CAPABILITIES_DRAFT.sql:602',
  preschool_portal_school_announcements_read: 'supabase/migrations/20261031090000_fix_edu_announcements_rls_and_portal_read.sql:30',
};
const reviewed = occurrences.map(item => {
  let category, owner, evidence, disposition;
  if (item.kind === 'sql' && kernel[item.target]) {
    category = 'EDUCATION_DIRECT_SQL';
    [owner, evidence] = kernel[item.target];
    disposition = 'Source-level public-contract bypass; no applicable direct-API exception established. BLOCK; do not rewrite runtime in F13.';
  } else if (item.kind === 'sql' && product[item.target]) {
    category = item.layer === 'UI' ? 'PRODUCT_UI_REVIEW' : 'PRODUCT_API_SQL';
    owner = 'Preschool Product';
    evidence = `supabase/migrations/${product[item.target]}`;
    disposition = item.layer === 'UI'
      ? 'Product-owned resource, but browser SQL/hardcoded actor and destructive seed context remain F08 HELD. No exception.'
      : 'Not a Kernel table solely because of edu_ prefix. Ownership recognized; API/adapter layering and security are not thereby approved. No exception.';
  } else if (item.kind === 'rpc' && workflowRpc[item.target]) {
    category = 'WORKFLOW_RPC';
    owner = 'Preschool workflow contract';
    evidence = workflowRpc[item.target];
    disposition = 'Named command/read adapter corresponds to existing Care/Portal/Announcement/Handover contract. Not raw table access; runtime authority/ACL/security still require separate proof. No exception.';
  } else if (item.kind === 'rpc' && item.target.startsWith('preschool_admin_')) {
    category = 'PROFILE_RPC_REVIEW';
    owner = 'Party identity / Education / Preschool boundary unresolved';
    evidence = item.target.includes('teacher')
      ? 'supabase/migrations/20261030100000_preschool_admin_teacher_360_profile_management.sql:8'
      : 'src/app/api/education/enrollments/[id]/route.ts:137';
    disposition = item.target.includes('teacher')
      ? 'Source DDL exists and touches Platform Party/users. No matching independent public-contract authority established by this review; do not infer approval from function name/DDL.'
      : 'Typed API call exists; no definition found in tracked source outside tests/audit captures. Canonical producer/authority unresolved. NOT_PROVEN; no exception.';
  } else throw new Error(`Unclassified occurrence ${item.id}: ${item.target}`);
  return { ...item, category, owner, evidence, disposition };
});
const categoryCounts = {};
for (const item of reviewed) categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
assertCounts();
function assertCounts() {
  for (const [category, count] of Object.entries({ EDUCATION_DIRECT_SQL: 26, PRODUCT_API_SQL: 34, PRODUCT_UI_REVIEW: 6, WORKFLOW_RPC: 8, PROFILE_RPC_REVIEW: 3 })) {
    if (categoryCounts[category] !== count) throw new Error(`Unexpected category count ${category}`);
  }
}
fs.writeFileSync(path.join(evidenceDir, 'f13-ownership-review.json'), JSON.stringify({
  sourceSha, frozenInventory: 'f13-scan-final.json', status: 'BLOCK', categoryCounts,
  baselineChanged: false, runtimeAuthorizationProven: false, matches: reviewed,
}, null, 2));
const rows = reviewed.map(item => `| ${item.id}/${item.groupId} | ${item.category} | \`${item.target}\` | ${item.sourceFile}:${item.line} | ${item.evidence} |`);
fs.writeFileSync(path.join(evidenceDir, 'F13_OCCURRENCES.md'), [
  '# F13 — frozen occurrence ownership review', '',
  `Source main: \`${sourceSha}\`. Exactly 77 occurrences / 33 legacy normalized signatures.`, '',
  'This is an audit inventory, not an allowlist. Full reasoning is in F13_REVIEW.md and f13-ownership-review.json. Source locations refer to the pinned main commit, not moving WIP line numbers.', '',
  '| ID/group | Classification | Resource | Caller at pinned main | Ownership evidence |',
  '| --- | --- | --- | --- | --- |', ...rows, '',
].join('\n'));
console.log(JSON.stringify({ categoryCounts, status: 'BLOCK', baselineChanged: false }));
