// Generated RPC signatures from actual isolated PostgreSQL public schema.
// Full schema SHA256 fb8230b928a436ec26a15b8f5edd94d62ef9d20d1e92e528044eeed9be43dd9a
import type { Database } from './database.types';
export type AttendanceCommandDatabase = Omit<Database, 'public'> & { public: Omit<Database['public'],'Functions'> & { Functions: {
edu_set_scoped_daily_attendance: {
        Args: {
          p_actor_id: string
          p_branch_id: string
          p_course_id: string
          p_enrollment_id: string
          p_expected_role: string
          p_request_id: string
          p_roll_call_time: string
          p_school_day: string
          p_status: string
          p_student_party_id: string
          p_tenant_id: string
        }
        Returns: {
          created_at: string
          enrollment_id: string
          event_id: string
          id: string
          roll_call_time: string
          school_day: string
          status: string
          tenant_id: string
          updated_at: string
        }[]
      }
preschool_set_scoped_daily_attendance: {
        Args: {
          p_actor_id: string
          p_branch_id: string
          p_course_id: string
          p_enrollment_id: string
          p_expected_role: string
          p_roll_call_time: string
          p_school_day: string
          p_status: string
          p_student_party_id: string
          p_tenant_id: string
        }
        Returns: {
          created_at: string
          enrollment_id: string
          event_id: string
          id: string
          roll_call_time: string
          school_day: string
          status: string
          tenant_id: string
          updated_at: string
        }[]
      }
} } };
