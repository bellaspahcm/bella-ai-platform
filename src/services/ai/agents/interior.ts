/**
 * Bella Interior AI executive agent.
 *
 * The previous implementation fell back to hard-coded portfolio and finance
 * baselines when tenant-scoped database reads were unavailable. Interior
 * reports include customer and financial information, so the agent stays
 * unavailable until a canonical, action-authorized read model is wired in.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { SubAgentResponse } from '../types';

export async function runInteriorAgent(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  activeDate: Date,
  requestedSubRole?: string,
): Promise<SubAgentResponse> {
  void supabase;
  void tenantId;
  void activeDate;
  void requestedSubRole;
  throw new Error('INTERIOR_AI_DATA_SOURCE_UNAVAILABLE');
}
