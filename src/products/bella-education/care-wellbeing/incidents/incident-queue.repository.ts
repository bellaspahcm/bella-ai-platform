import type { Database } from '@/types/database.types';
import type { QueueQuery } from '../../work-queue/work-queue.types';

export type IncidentRow = Database['public']['Tables']['edu_health_incidents']['Row'];
export interface IncidentQueueRepository {
  list(tenantId: string, query: QueueQuery): Promise<{ rows: IncidentRow[]; total: number; pages: number; page: number; pageSize: number }>;
  get(tenantId: string, id: string): Promise<IncidentRow>;
}
