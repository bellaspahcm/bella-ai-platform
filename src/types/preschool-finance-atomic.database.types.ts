// Generated from actual isolated Supabase public schema; complete members selected by TypeScript AST.
// Full generated schema SHA256 421b900a302be46b367485b383cfc376c46d0970cb5923569957ff2e332ad3bd
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type PreschoolFinanceAtomicDatabase = { public: {
Tables: {
edu_fin_reconciliation_operations: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          invoice_id: string
          operation_key: string
          payment_id: string
          receipt_id: string
          reconciliation_id: string
          request_payload: Json
          tenant_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          invoice_id: string
          operation_key: string
          payment_id: string
          receipt_id: string
          reconciliation_id: string
          request_payload: Json
          tenant_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          operation_key?: string
          payment_id?: string
          receipt_id?: string
          reconciliation_id?: string
          request_payload?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edu_fin_reconciliation_operations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "edu_fin_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_fin_reconciliation_operations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "edu_fin_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_fin_reconciliation_operations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "edu_fin_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_fin_reconciliation_operations_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "edu_fin_reconciliation_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edu_fin_reconciliation_operations_tenant_id_fkey"
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
preschool_reconcile_finance_atomic: {
        Args: {
          p_actor_id: string
          p_operation_key: string
          p_request: Json
          p_tenant_id: string
        }
        Returns: Json
      }
preschool_recover_finance_reconciliation: {
        Args: {
          p_actor_id: string
          p_operation_key: string
          p_request: Json
          p_tenant_id: string
        }
        Returns: Json
      }
};
Enums: { [_ in never]: never };
CompositeTypes: { [_ in never]: never };
} };
