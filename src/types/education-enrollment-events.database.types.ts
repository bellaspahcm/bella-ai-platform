// RPC signatures extracted from actual isolated PostgreSQL schema, 2026-10-23.
import type { Database, Json } from './database.types';
export type EducationEnrollmentEventsDatabase = Omit<Database, 'public'> & {
 public: Omit<Database['public'], 'Functions'> & { Functions: {
edu_claim_enrollment_event_replay: {
        Args: {
          p_course_id: string
          p_enrollment_id: string
          p_replay_key: string
          p_request_id: string
          p_student_party_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
edu_finish_enrollment_event_replay: {
        Args: {
          p_course_id: string
          p_enrollment_id: string
          p_error_code?: string
          p_lease_token: string
          p_outcome: string
          p_replay_key: string
          p_request_id: string
          p_student_party_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
edu_get_enrollment_created_event: {
        Args: {
          p_course_id: string
          p_enrollment_id: string
          p_request_id: string
          p_student_party_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
 } }
};
