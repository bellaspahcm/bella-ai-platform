// Function signatures generated from the isolated DB on 2026-10-22.
import type { Database, Json } from './database.types';
export type PreschoolFinanceBranchDatabase = Omit<Database, 'public'> & { public: Omit<Database['public'], 'Functions'> & { Functions: {
preschool_finance_branch_command: {
        Args: {
          p_action: string
          p_actor_id: string
          p_branch_id: string
          p_payload: Json
          p_tenant_id: string
        }
        Returns: Json
      }
preschool_finance_read_branch: {
        Args: { p_actor_id: string; p_branch_id?: string; p_tenant_id: string }
        Returns: Json
      }
} } };
