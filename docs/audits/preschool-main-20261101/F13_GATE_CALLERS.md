# F13 — exact callers blocked by the two assertions

Pinned main f1299e3138f3700062a1ed84271db315737b0071; technical resource identities/counts are equal. No exception approved/applied.

The legacy assertion blocks the 77 occurrences below, grouped into its 33 signatures. The exact-resource assertion blocks these same 77 plus 265 historical Product calls and 20 unresolved expressions. All 362 locations, caller scopes, identities and dispositions are in f13-gate-disposition.json; these are not 362 new vulnerabilities.

| Legacy group | Pinned caller file | Occurrences | Frozen IDs | Exact resources / operations |
| --- | --- | ---: | --- | --- |
| G01 | src/app/api/education/announcements/route.ts | 2 | M001, M002 | rpc/execute:preschool_list_school_announcements; rpc/execute:preschool_publish_school_announcement |
| G02 | src/app/api/education/attendance/handover/route.ts | 1 | M003 | rpc/execute:preschool_record_handover |
| G03 | src/app/api/education/care/bulk/route.ts | 1 | M004 | rpc/execute:preschool_save_care_records |
| G04 | src/app/api/education/care/bulk/route.ts | 1 | M005 | from/select:edu_attendance_daily_state |
| G05 | src/app/api/education/care/digest/route.ts | 2 | M006, M007 | from/select:edu_daily_parent_digests |
| G06 | src/app/api/education/communication/messages/route.ts | 2 | M008, M009 | from/select:edu_comm_threads; from/update:edu_comm_threads |
| G07 | src/app/api/education/communication/threads/route.ts | 3 | M010, M011, M012 | from/select:edu_comm_threads; from/select:edu_comm_responses; from/select:edu_comm_exceptions |
| G08 | src/app/api/education/courses/[id]/route.ts | 1 | M013 | from/select:edu_enrollments |
| G09 | src/app/api/education/courses/[id]/route.ts | 1 | M014 | from/select:students |
| G10 | src/app/api/education/courses/route.ts | 4 | M015, M016, M017, M018 | from/select:edu_courses; from/select:edu_enrollments; from/select:edu_attendance_daily_state |
| G11 | src/app/api/education/enrollments/[id]/communications/route.ts | 2 | M019, M020 | from/select:edu_daily_care_records; from/select:edu_comm_exceptions |
| G12 | src/app/api/education/enrollments/[id]/development/route.ts | 3 | M021, M022, M023 | from/select:edu_enrollments; from/select:edu_assessments; from/select:edu_dev_milestone_progress |
| G13 | src/app/api/education/enrollments/[id]/development/route.ts | 1 | M024 | from/select:students |
| G14 | src/app/api/education/enrollments/[id]/finance-summary/route.ts | 1 | M025 | from/select:edu_fin_invoices |
| G15 | src/app/api/education/enrollments/[id]/finance-summary/route.ts | 1 | M026 | from/select:students |
| G16 | src/app/api/education/enrollments/[id]/health/route.ts | 3 | M027, M028, M029 | from/select:edu_child_allergies; from/select:edu_medication_authorizations; from/select:edu_health_incidents |
| G17 | src/app/api/education/enrollments/[id]/route.ts | 1 | M030 | rpc/execute:preschool_admin_update_student_profile |
| G18 | src/app/api/education/enrollments/admission-course-reader.ts | 1 | M031 | from/select:edu_courses |
| G19 | src/app/api/education/enrollments/confirm-admission/route.ts | 11 | M032, M033, M034, M035, M036, M037, M038, M039, M040, M041, M042 | from/select:edu_enrollments; from/select:edu_fin_billing_periods; from/select:edu_fin_invoices; from/update:edu_fin_invoices; from/insert:edu_fin_payments; from/insert:edu_fin_invoices; from/insert:edu_fin_invoice_line_items; from/update:edu_enrollments; from/update:edu_courses |
| G20 | src/app/api/education/enrollments/confirm-admission/route.ts | 1 | M043 | from/select:students |
| G21 | src/app/api/education/enrollments/route.ts | 2 | M044, M045 | from/select:edu_enrollments; from/select:edu_courses |
| G22 | src/app/api/education/enrollments/route.ts | 1 | M046 | from/select:students |
| G23 | src/app/api/education/grades/route.ts | 5 | M047, M048, M049, M050, M051 | from/select:edu_courses; from/select:edu_dev_observations; from/select:edu_dev_milestone_progress; from/insert:edu_dev_observations; from/insert:edu_dev_observation_students |
| G24 | src/app/api/education/portal/[token]/attendance/route.ts | 3 | M052, M053, M054 | from/select:edu_enrollments; from/select:edu_attendance_daily_state; from/select:edu_attendance |
| G25 | src/app/api/education/portal/[token]/care/route.ts | 3 | M055, M056, M057 | from/select:edu_enrollments; from/select:edu_daily_care_records; from/select:edu_daily_care_sessions |
| G26 | src/app/api/education/portal/[token]/route.ts | 3 | M058, M059, M060 | rpc/execute:preschool_portal_daily_read; rpc/execute:preschool_portal_school_announcements_read |
| G27 | src/app/api/education/portal/[token]/tuition/route.ts | 1 | M061 | from/select:edu_fin_invoices |
| G28 | src/app/api/education/portal/token/route.ts | 1 | M062 | rpc/execute:preschool_portal_issuer_context |
| G29 | src/app/api/education/teachers/teacher-360.service.ts | 2 | M063, M064 | rpc/execute:preschool_admin_get_teacher_profile; rpc/execute:preschool_admin_update_teacher_profile |
| G30 | src/app/api/education/work-queue/identity.persistence.ts | 1 | M065 | from/select:students |
| G31 | src/app/api/education/work-queue/incident-queue.persistence.ts | 2 | M066, M067 | from/select:edu_health_incidents |
| G32 | src/app/api/education/work-queue/request-review.persistence.ts | 4 | M068, M069, M070, M071 | from/select:edu_comm_exceptions; from/update:edu_comm_exceptions; from/select:edu_comm_notices |
| G33 | src/app/dashboard/education/scheduling/page.tsx | 6 | M072, M073, M074, M075, M076, M077 | from/select:edu_sched_leave_requests; from/select:edu_sched_substitutions; from/delete:edu_sched_shift_assignments; from/delete:edu_sched_leave_requests; from/delete:edu_sched_substitutions; from/delete:edu_comm_exceptions |
