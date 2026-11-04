# Preschool API surface inventory

Source: f1299e3138f3700062a1ed84271db315737b0071. Generated from source; flags are review leads, not effective DB/authorization proof.

| Route | Methods | Privileged client reference | Tables (literal) | RPC (literal) |
| --- | --- | --- | --- | --- |
| `/api/education/ai/copilot` | POST | No local reference | tenants |  |
| `/api/education/analytics` | GET | No local reference | user_org_unit_access, org_units, preschool_chain_course_branch_assignments |  |
| `/api/education/announcements` | GET, POST | No local reference |  | preschool_list_school_announcements, preschool_publish_school_announcement |
| `/api/education/attendance/courses` | GET | YES — inspect contract |  |  |
| `/api/education/attendance/handover` | POST | YES — inspect contract |  | preschool_record_handover |
| `/api/education/attendance` | GET, POST | YES — inspect contract |  |  |
| `/api/education/branches/manage` | GET, POST | No local reference | tenants |  |
| `/api/education/branches` | GET | YES — inspect contract |  |  |
| `/api/education/care/bulk` | GET, POST | No local reference | edu_attendance_daily_state | preschool_save_care_records |
| `/api/education/care/classes` | GET | No local reference | preschool_chain_course_branch_assignments, org_units, user_org_unit_access |  |
| `/api/education/care/digest` | GET, POST | YES — inspect contract | users, edu_daily_parent_digests |  |
| `/api/education/care/medication` | POST | No local reference |  |  |
| `/api/education/communication/messages` | POST | YES — inspect contract | edu_comm_threads |  |
| `/api/education/communication/threads` | GET | YES — inspect contract | edu_comm_threads, edu_comm_responses, edu_comm_exceptions |  |
| `/api/education/courses/catalog` | GET, POST, PUT, PATCH, DELETE | No local reference | tenants |  |
| `/api/education/courses` | GET, POST | YES — inspect contract | edu_courses, preschool_chain_course_branch_assignments, courses, edu_enrollments, edu_attendance_daily_state |  |
| `/api/education/courses/[id]` | GET | No local reference | courses, party_parties, edu_enrollments, students |  |
| `/api/education/courses/[id]/teachers` | POST, DELETE | No local reference |  |  |
| `/api/education/curriculum` | GET, POST, PUT, DELETE | YES — inspect contract |  |  |
| `/api/education/enrollments/confirm-admission` | POST | YES — inspect contract | edu_enrollments, students, edu_fin_billing_periods, edu_fin_invoices, edu_fin_payments, edu_fin_invoice_line_items, edu_courses |  |
| `/api/education/enrollments` | GET, POST | YES — inspect contract | edu_enrollments, party_parties, students, edu_courses, preschool_admission_operations |  |
| `/api/education/enrollments/[id]/communications` | GET, POST, PUT, PATCH, DELETE | YES — inspect contract | edu_daily_care_records, edu_comm_exceptions |  |
| `/api/education/enrollments/[id]/development` | GET, POST, PUT, PATCH, DELETE | YES — inspect contract | students, edu_enrollments, edu_assessments, edu_dev_milestone_progress |  |
| `/api/education/enrollments/[id]/finance-summary` | GET, POST, PUT, PATCH, DELETE | YES — inspect contract | students, edu_fin_invoices |  |
| `/api/education/enrollments/[id]/guardians` | GET, POST, PUT, PATCH, DELETE | No local reference |  |  |
| `/api/education/enrollments/[id]/health` | GET, POST, PUT, PATCH, DELETE | YES — inspect contract | edu_child_allergies, edu_medication_authorizations, edu_health_incidents |  |
| `/api/education/enrollments/[id]` | GET, PATCH | No local reference |  | preschool_admin_update_student_profile |
| `/api/education/finance` | GET, POST | YES — inspect contract | tenants, user_org_unit_access |  |
| `/api/education/grades` | GET, POST, PUT, PATCH, DELETE | YES — inspect contract | edu_courses, edu_dev_observations, edu_dev_milestone_progress, edu_dev_observation_students |  |
| `/api/education/nutrition/weekly-menu` | GET, POST, PUT | YES — inspect contract |  |  |
| `/api/education/parent-daily` | GET | No local reference |  |  |
| `/api/education/portal/token` | GET, POST | No local reference | tenants | preschool_portal_issuer_context |
| `/api/education/portal/[token]/attendance` | GET | YES — inspect contract | edu_enrollments, edu_attendance_daily_state, edu_attendance |  |
| `/api/education/portal/[token]/care` | GET | YES — inspect contract | edu_enrollments, edu_daily_care_records, edu_daily_care_sessions |  |
| `/api/education/portal/[token]/chat` | POST | YES — inspect contract |  |  |
| `/api/education/portal/[token]/copilot` | POST | YES — inspect contract |  |  |
| `/api/education/portal/[token]` | GET | YES — inspect contract |  | preschool_portal_daily_read, preschool_portal_school_announcements_read |
| `/api/education/portal/[token]/tuition` | GET | YES — inspect contract | edu_fin_invoices, tenants |  |
| `/api/education/student-registry` | GET | No local reference |  |  |
| `/api/education/teachers` | GET, POST | YES — inspect contract |  |  |
| `/api/education/teachers/[id]` | GET, PATCH | YES — inspect contract |  |  |
| `/api/education/work-queue` | GET, POST | YES — inspect contract | tenants |  |

Dynamic RPC names, imported factories and contract-owned queries require tracing their owning source. GET-only/read-only/held handlers are identified in REPORT.md; an exported method alone does not mean mutation is enabled.
