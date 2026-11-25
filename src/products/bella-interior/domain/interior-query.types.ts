/**
 * Bella Interior OS — Query Types for Database Entities
 *
 * Provides strongly-typed representations for Interior tables that may not yet
 * be registered in the root platform Database schema, preventing infinite
 * TypeScript recursion (TS2589) while avoiding any 'any' types.
 */

export interface RawInteriorProject {
  id: string;
  code?: string | null;
  name: string;
  customer_name?: string | null;
  site_address?: string | null;
  target_completion_date?: string | null;
  estimated_budget?: number | null;
  status?: string | null;
}

export interface RawInteriorContract {
  id: string;
  project_id: string;
  contract_number?: string | null;
  title?: string | null;
  baseline_contract_value?: number | null;
  current_contract_value?: number | null;
  status?: string | null;
  signed_date?: string | null;
}

export interface RawInteriorPaymentMilestone {
  id: string;
  contract_id: string;
  amount?: number | null;
  status?: string | null;
  collected_amount?: number | null;
  paid_at?: string | null;
  due_date?: string | null;
}

export interface RawInteriorPunchListItem {
  id: string;
  project_id?: string;
  room_zone_name?: string | null;
  item_name?: string | null;
  defect_category?: string | null;
  description?: string | null;
  severity?: string | null;
  assigned_fixer?: string | null;
  deadline?: string | null;
  status?: string | null;
  rectification_note?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at?: string | null;
  interior_projects?: { id?: string; code?: string; name?: string } | null;
}

export interface RawInteriorProductionOrder {
  id: string;
  order_number?: string | null;
  status?: string | null;
  scheduled_start_date?: string | null;
  scheduled_completion_date?: string | null;
  actual_dispatched_date?: string | null;
  workshop_manager_name?: string | null;
  notes?: string | null;
  mode?: string | null;
  subcontractor_name?: string | null;
  project_id?: string;
  interior_projects?: { id?: string; code?: string; name?: string; customer_name?: string } | null;
}

export interface InteriorQueryChain<T> extends PromiseLike<{ data: T[] | null; error: unknown }> {
  select(columns?: string): InteriorQueryChain<T>;
  order(column: string, options?: { ascending?: boolean }): InteriorQueryChain<T>;
  eq(column: string, value: unknown): InteriorQueryChain<T>;
  limit(count: number): InteriorQueryChain<T>;
}

export interface InteriorQueryClient {
  from<T = Record<string, unknown>>(table: string): InteriorQueryChain<T>;
}
