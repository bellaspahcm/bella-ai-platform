# F13 — individual caller/resource/operation review

Pinned main: `f1299e3138f3700062a1ed84271db315737b0071`. 34 Product API SQL + 8 workflow RPC occurrences reviewed individually. No exceptions applied; this file is not imported by any guard. Exact reasons and contract pointers for all 77 occurrences are in f13-enforcement-review.json.

| ID | Pinned source | Caller | Method / operation | Full target | Disposition |
| --- | --- | --- | --- | --- | --- |
| M001 | src/app/api/education/announcements/route.ts:55 | GET | rpc/execute | preschool_list_school_announcements | HELD_ANNOUNCEMENT_CONTRACT |
| M002 | src/app/api/education/announcements/route.ts:83 | POST | rpc/execute | preschool_publish_school_announcement | BLOCK_F06_CONTRACT_MISMATCH |
| M003 | src/app/api/education/attendance/handover/route.ts:89 | POST/<callback> | rpc/execute | preschool_record_handover | HELD_EXECUTOR_RECONCILIATION |
| M004 | src/app/api/education/care/bulk/route.ts:200 | POST | rpc/execute | preschool_save_care_records | BOUNDED_COMMAND_CANDIDATE_HELD |
| M006 | src/app/api/education/care/digest/route.ts:83 | GET | from/select | edu_daily_parent_digests | HELD_CONTRACT_RECONCILIATION |
| M007 | src/app/api/education/care/digest/route.ts:146 | POST | from/select | edu_daily_parent_digests | HELD_CONTRACT_RECONCILIATION |
| M008 | src/app/api/education/communication/messages/route.ts:72 | POST | from/select | edu_comm_threads | BLOCK_CONTRACT_MISMATCH |
| M009 | src/app/api/education/communication/messages/route.ts:109 | POST | from/update | edu_comm_threads | BLOCK_CONTRACT_MISMATCH |
| M010 | src/app/api/education/communication/threads/route.ts:41 | GET | from/select | edu_comm_threads | BLOCK_CONTRACT_MISMATCH |
| M011 | src/app/api/education/communication/threads/route.ts:55 | GET | from/select | edu_comm_responses | BLOCK_CONTRACT_MISMATCH |
| M012 | src/app/api/education/communication/threads/route.ts:60 | GET | from/select | edu_comm_exceptions | BLOCK_CONTRACT_MISMATCH |
| M019 | src/app/api/education/enrollments/[id]/communications/route.ts:82 | GET | from/select | edu_daily_care_records | HELD_SCOPE_AUTHORITY |
| M020 | src/app/api/education/enrollments/[id]/communications/route.ts:89 | GET | from/select | edu_comm_exceptions | HELD_SCOPE_AUTHORITY |
| M023 | src/app/api/education/enrollments/[id]/development/route.ts:124 | GET | from/select | edu_dev_milestone_progress | HELD_LEARNING_CONTRACT |
| M025 | src/app/api/education/enrollments/[id]/finance-summary/route.ts:96 | GET | from/select | edu_fin_invoices | HELD_FINANCE_BOUNDARY |
| M027 | src/app/api/education/enrollments/[id]/health/route.ts:82 | GET | from/select | edu_child_allergies | HELD_SCOPE_AUTHORITY |
| M028 | src/app/api/education/enrollments/[id]/health/route.ts:88 | GET | from/select | edu_medication_authorizations | HELD_SCOPE_AUTHORITY |
| M029 | src/app/api/education/enrollments/[id]/health/route.ts:94 | GET | from/select | edu_health_incidents | HELD_SCOPE_AUTHORITY |
| M033 | src/app/api/education/enrollments/confirm-admission/route.ts:114 | POST | from/select | edu_fin_billing_periods | HELD_F01 |
| M034 | src/app/api/education/enrollments/confirm-admission/route.ts:129 | POST | from/select | edu_fin_invoices | HELD_F01 |
| M035 | src/app/api/education/enrollments/confirm-admission/route.ts:149 | POST | from/update | edu_fin_invoices | HELD_F01 |
| M036 | src/app/api/education/enrollments/confirm-admission/route.ts:160 | POST | from/insert | edu_fin_payments | HELD_F01 |
| M037 | src/app/api/education/enrollments/confirm-admission/route.ts:187 | POST | from/insert | edu_fin_invoices | HELD_F01 |
| M038 | src/app/api/education/enrollments/confirm-admission/route.ts:212 | POST | from/insert | edu_fin_invoice_line_items | HELD_F01 |
| M039 | src/app/api/education/enrollments/confirm-admission/route.ts:244 | POST | from/insert | edu_fin_payments | HELD_F01 |
| M048 | src/app/api/education/grades/route.ts:141 | GET | from/select | edu_dev_observations | HELD_F02_F05 |
| M049 | src/app/api/education/grades/route.ts:160 | GET | from/select | edu_dev_milestone_progress | HELD_F02_F05 |
| M050 | src/app/api/education/grades/route.ts:419 | POST | from/insert | edu_dev_observations | HELD_F02_F05 |
| M051 | src/app/api/education/grades/route.ts:432 | POST | from/insert | edu_dev_observation_students | HELD_F02_F05 |
| M056 | src/app/api/education/portal/[token]/care/route.ts:304 | GET | from/select | edu_daily_care_records | HELD_PORTAL_CONTRACT |
| M057 | src/app/api/education/portal/[token]/care/route.ts:336 | GET | from/select | edu_daily_care_sessions | HELD_PORTAL_CONTRACT |
| M058 | src/app/api/education/portal/[token]/route.ts:54 | GET | rpc/execute | preschool_portal_daily_read | HELD_PORTAL_EXECUTOR |
| M059 | src/app/api/education/portal/[token]/route.ts:59 | GET | rpc/execute | preschool_portal_school_announcements_read | HELD_PORTAL_FEED_CONTRACT |
| M060 | src/app/api/education/portal/[token]/route.ts:87 | GET | rpc/execute | preschool_portal_school_announcements_read | HELD_LEGACY_PORTAL_CONTRACT |
| M061 | src/app/api/education/portal/[token]/tuition/route.ts:83 | GET | from/select | edu_fin_invoices | HELD_PORTAL_FINANCE_CONTRACT |
| M062 | src/app/api/education/portal/token/route.ts:44 | issue | rpc/execute | preschool_portal_issuer_context | HELD_ISSUER_CONTRACT |
| M066 | src/app/api/education/work-queue/incident-queue.persistence.ts:10 | IncidentQueuePersistence/query | from/select | edu_health_incidents | BOUNDED_STORAGE_CANDIDATE_HELD |
| M067 | src/app/api/education/work-queue/incident-queue.persistence.ts:26 | IncidentQueuePersistence/get | from/select | edu_health_incidents | BOUNDED_STORAGE_CANDIDATE_HELD |
| M068 | src/app/api/education/work-queue/request-review.persistence.ts:13 | RequestReviewPersistence/query | from/select | edu_comm_exceptions | BOUNDED_STORAGE_CANDIDATE_HELD |
| M069 | src/app/api/education/work-queue/request-review.persistence.ts:33 | RequestReviewPersistence/get | from/select | edu_comm_exceptions | BOUNDED_STORAGE_CANDIDATE_HELD |
| M070 | src/app/api/education/work-queue/request-review.persistence.ts:40 | RequestReviewPersistence/resolveOpen | from/update | edu_comm_exceptions | BOUNDED_STORAGE_CANDIDATE_HELD |
| M071 | src/app/api/education/work-queue/request-review.persistence.ts:49 | RequestReviewPersistence/financeNoticeIds | from/select | edu_comm_notices | BOUNDED_STORAGE_CANDIDATE_HELD |
