import type { Database } from '@/types/database.types';
import type { QueueQuery } from '../../work-queue/work-queue.types';

export type RequestRow = Database['public']['Tables']['edu_comm_exceptions']['Row'];
/** P6 persistence port. The authenticated delivery adapter supplies tenant-scoped storage. */
export interface RequestReviewRepository {
  list(tenantId: string, query: QueueQuery): Promise<{ rows: RequestRow[]; total: number; pages: number; page: number; pageSize: number }>;
  get(tenantId: string, id: string): Promise<RequestRow>;
  resolveOpen(tenantId: string, row: RequestRow, actorId: string, at: string, receipt: string): Promise<void>;
  financeNoticeIds(tenantId: string, ids: string[]): Promise<Set<string>>;
}
