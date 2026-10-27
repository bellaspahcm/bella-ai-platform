// Generated from isolated Supabase public schema; selected by TypeScript AST.
// Full generated snapshot SHA256 a073e8e409c71764a30d41fbbd4bacbc5582a1ad0bba512384eb269f7cf1808a
// Regenerate through .audit-local-cache/extract_admission_db_types.cjs after CLI generation.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = { public: {
Tables: {
party_registration_receipts: {
        Row: {
          actor_id: string
          created_at: string
          party_id: string
          payload: Json
          registration_key: string
          tenant_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          party_id: string
          payload: Json
          registration_key: string
          tenant_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          party_id?: string
          payload?: Json
          registration_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_registration_receipts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "party_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_registration_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
preschool_admission_operations: {
        Row: {
          actor_id: string
          branch_id: string
          created_at: string
          enrollment_request_id: string
          operation_key: string
          payload: Json
          student_code: string
          tenant_id: string
        }
        Insert: {
          actor_id: string
          branch_id: string
          created_at?: string
          enrollment_request_id?: string
          operation_key: string
          payload: Json
          student_code: string
          tenant_id: string
        }
        Update: {
          actor_id?: string
          branch_id?: string
          created_at?: string
          enrollment_request_id?: string
          operation_key?: string
          payload?: Json
          student_code?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preschool_admission_operations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_admission_operations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
preschool_chain_course_branch_assignments: {
        Row: {
          assigned_by: string | null
          branch_id: string
          course_id: string
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          branch_id: string
          course_id: string
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          branch_id?: string
          course_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preschool_chain_course_branch_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_chain_course_branch_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_chain_course_branch_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
preschool_chain_enrollment_branch_assignments: {
        Row: {
          assigned_by: string | null
          branch_id: string
          course_id: string
          created_at: string
          enrollment_id: string
          id: string
          request_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          branch_id: string
          course_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          request_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          branch_id?: string
          course_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          request_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preschool_chain_enrollment_branch_assignment_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "edu_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_chain_enrollment_branch_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_chain_enrollment_branch_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "edu_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preschool_chain_enrollment_branch_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
edu_preschool_pickup_authorizations: {
        Row: {
          created_at: string
          guardian_party_id: string
          id: string
          status: string
          student_party_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          guardian_party_id: string
          id?: string
          status?: string
          student_party_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          guardian_party_id?: string
          id?: string
          status?: string
          student_party_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_preschool_pickup_authorizations_guardian_party_id_fkey"
            columns: ["guardian_party_id"]
            isOneToOne: false
            referencedRelation: "party_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_preschool_pickup_authorizations_student_party_id_fkey"
            columns: ["student_party_id"]
            isOneToOne: false
            referencedRelation: "party_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_preschool_pickup_authorizations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
};
Views: { [_ in never]: never };
Functions: {
party_register_or_recover: {
        Args: {
          p_actor_id: string
          p_payload: Json
          p_registration_key: string
          p_reuse_identifier_type?: string
          p_reuse_identifier_value?: string
          p_tenant_id: string
        }
        Returns: Json
      }
preschool_open_admission: {
        Args: {
          p_actor_id: string
          p_operation_key: string
          p_payload?: Json
          p_tenant_id: string
        }
        Returns: {
          actor_id: string
          branch_id: string
          created_at: string
          enrollment_request_id: string
          operation_key: string
          payload: Json
          student_code: string
          tenant_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "preschool_admission_operations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
preschool_branch_access: {
        Args: {
          p_action?: string
          p_actor_id: string
          p_branch_id: string
          p_tenant_id: string
        }
        Returns: boolean
      }
preschool_course_assignment_visible: {
        Args: { p_branch_id: string; p_course_id: string; p_tenant_id: string }
        Returns: boolean
      }
preschool_enrollment_assignment_visible: {
        Args: {
          p_branch_id: string
          p_course_id: string
          p_enrollment_id: string
          p_request_id: string
          p_tenant_id: string
        }
        Returns: boolean
      }
preschool_assign_chain: {
        Args: {
          p_actor_id: string
          p_branch_id: string
          p_course_id: string
          p_enrollment_id: string
          p_request_id: string
          p_tenant_id: string
        }
        Returns: {
          assigned_by: string | null
          branch_id: string
          course_id: string
          created_at: string
          enrollment_id: string
          id: string
          request_id: string
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "preschool_chain_enrollment_branch_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
preschool_admission_pickup: {
        Args: {
          p_actor_id: string
          p_guardian_party_id: string
          p_normalized_phone: string
          p_student_party_id: string
          p_tenant_id: string
        }
        Returns: {
          created_at: string
          guardian_party_id: string
          id: string
          status: string
          student_party_id: string
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "edu_preschool_pickup_authorizations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
};
Enums: { [_ in never]: never };
CompositeTypes: { [_ in never]: never };
} };
